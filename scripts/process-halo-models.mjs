import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

// FileReader polyfill for Node.js GLTFExporter
global.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
};

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const HALO_DIR = path.join(PUBLIC_DIR, '3d-models/RING-HEAD/HALO');
const BACKUP_DIR = path.join(ROOT, 'model-sources/3d-models/RING-HEAD/HALO');

// Must match SECRET_KEY in src/lib/ring-configurator/utility/modelLoader.js
const SECRET_KEY = 'r!ng$3cur3K3y#2024XoR';

function xorEncrypt(buffer) {
  const key = Buffer.from(SECRET_KEY, 'utf8');
  const out = Buffer.allocUnsafe(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) out[i] = buffer[i] ^ key[i % key.length];
  return out;
}

const SHAPES = [
  { shape: 'round',    centerNodeName: 'HALOCENTER__Diamond_Round',    oldDiagonal: 8.288 },
  { shape: 'princess', centerNodeName: 'HALOCENTER__Diamond_Princess', oldDiagonal: 7.363 },
  { shape: 'cushion',  centerNodeName: 'HALOCENTER__Diamond_Cushion',  oldDiagonal: 7.394 },
  { shape: 'oval',     centerNodeName: 'HALOCENTER__Diamond_Oval',     oldDiagonal: 7.764 },
  { shape: 'radiant',  centerNodeName: 'HALOCENTER__Diamond_Radiant',  oldDiagonal: 7.948 },
  { shape: 'pear',     centerNodeName: 'HALOCENTER__Diamond_Pear',     oldDiagonal: 11.904 },
  { shape: 'emerald',  centerNodeName: 'HALOCENTER__Diamond_Emerald',  oldDiagonal: 8.407 },
  { shape: 'marquise', centerNodeName: 'HALOCENTER__Diamond_Marquise', oldDiagonal: 11.954 },
  { shape: 'asscher',  centerNodeName: 'HALOCENTER__Diamond_Asscher',  oldDiagonal: 7.552 },
  { shape: 'heart',    centerNodeName: 'HALOCENTER__Diamond_Heart',    oldDiagonal: 6.567 },
];

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const loader = new GLTFLoader();
const exporter = new GLTFExporter();

fs.mkdirSync(BACKUP_DIR, { recursive: true });

for (const { shape, centerNodeName, oldDiagonal } of SHAPES) {
  const backupFile = path.join(BACKUP_DIR, `${shape}.raw.glb`);
  const originalGlb = path.join(HALO_DIR, `${shape}.glb`);
  const fixGlb = path.join(HALO_DIR, `${shape}_fix.glb`);

  let srcFile;
  if (fs.existsSync(fixGlb)) {
    fs.copyFileSync(fixGlb, backupFile);
    srcFile = backupFile;
    console.log(`Using newly added fix model: ${path.relative(ROOT, fixGlb)}`);
  } else {
    srcFile = fs.existsSync(backupFile) ? backupFile : originalGlb;
  }

  if (!fs.existsSync(srcFile)) {
    console.warn(`File not found: ${srcFile}`);
    continue;
  }

  console.log(`\n========================================`);
  console.log(`Processing shape: ${shape.toUpperCase()}`);

  // Backup pristine original if not already backed up
  if (!fs.existsSync(backupFile)) {
    fs.copyFileSync(originalGlb, backupFile);
    console.log(`Backed up original to: ${path.relative(ROOT, backupFile)}`);
  }

  const rawBuf = fs.readFileSync(srcFile);
  const gltf = await new Promise((res, rej) =>
    loader.parse(rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength), '', res, rej)
  );

  gltf.scene.updateMatrixWorld(true);

  let centerMesh = null;
  let metalMesh = null;
  const accentMeshes = [];

  gltf.scene.traverse((child) => {
    if (!child.isMesh) return;
    const name = child.name;
    const s = child.scale;
    // Skip zero-scale dummy nodes
    if (s.x === 0 || s.y === 0 || s.z === 0) return;
    // Skip stray duplicate nodes ending with _1 that were left in Scene
    if (child.parent?.name === 'Scene' && child.name.endsWith('_1')) return;

    if (name.includes('Metal')) {
      metalMesh = child;
    } else if (name.includes('Round') || name.includes('Gem_HD')) {
      accentMeshes.push(child);
    } else {
      centerMesh = child;
    }
  });

  if (!metalMesh || !centerMesh || accentMeshes.length === 0) {
    throw new Error(`Failed to identify meshes for ${shape}: metal=${!!metalMesh}, center=${!!centerMesh}, accents=${accentMeshes.length}`);
  }

  console.log(`  Identified:`);
  console.log(`    Center:  "${centerMesh.name}"`);
  console.log(`    Metal:   "${metalMesh.name}"`);
  console.log(`    Accents: ${accentMeshes.length} stones`);

  // Bake transforms into vertices
  const metalGeom = metalMesh.geometry.clone().applyMatrix4(metalMesh.matrixWorld);
  const centerGeom = centerMesh.geometry.clone().applyMatrix4(centerMesh.matrixWorld);
  const accentGeoms = accentMeshes.map((m) => {
    const geom = m.geometry.clone().applyMatrix4(m.matrixWorld);
    // If determinant is negative (mirrored instance), reverse face winding so triangles are front-facing
    if (m.matrixWorld.determinant() < 0) {
      const idx = geom.index;
      if (idx) {
        const arr = idx.array;
        for (let i = 0; i < arr.length; i += 3) {
          const tmp = arr[i + 1];
          arr[i + 1] = arr[i + 2];
          arr[i + 2] = tmp;
        }
      }
    }
    geom.computeVertexNormals();
    return geom;
  });
  const mergedAccentGeom = accentGeoms.length === 1 ? accentGeoms[0] : BufferGeometryUtils.mergeGeometries(accentGeoms);

  // Compute metal base and center
  metalGeom.computeBoundingBox();
  centerGeom.computeBoundingBox();
  mergedAccentGeom.computeBoundingBox();

  const metalBox = metalGeom.boundingBox;
  const metalMinY = metalBox.min.y;
  const metalCenter = new THREE.Vector3();
  metalBox.getCenter(metalCenter);

  const totalBox = new THREE.Box3();
  totalBox.union(metalBox);
  totalBox.union(centerGeom.boundingBox);
  totalBox.union(mergedAccentGeom.boundingBox);

  const totalSize = new THREE.Vector3();
  totalBox.getSize(totalSize);
  const currentDiag = Math.sqrt(totalSize.x * totalSize.x + totalSize.z * totalSize.z);
  const scaleFactor = oldDiagonal / currentDiag;

  console.log(`  Metal min Y: ${metalMinY.toFixed(3)}, Center: [${metalCenter.x.toFixed(3)}, ${metalCenter.z.toFixed(3)}]`);
  console.log(`  Scale factor: ${scaleFactor.toFixed(4)} (raw diag ${currentDiag.toFixed(3)} -> ${oldDiagonal.toFixed(3)})`);

  // Translate and scale all geometries:
  // - Anchors metal bottom to Y = 0
  // - Centers lateral X, Z at (0, 0)
  // - Scales to match configurator diagonal
  for (const geom of [metalGeom, centerGeom, mergedAccentGeom]) {
    geom.translate(-metalCenter.x, -metalMinY, -metalCenter.z);
    geom.scale(scaleFactor, scaleFactor, scaleFactor);
    geom.computeBoundingBox();
    geom.computeVertexNormals();
  }

  // Name geometries so GLTFExporter names the meshes
  metalGeom.name = 'HeadMetal.001';
  centerGeom.name = centerNodeName;
  mergedAccentGeom.name = 'HALOACCENT__Diamond_Round';

  // Build clean scene with canonical node names for Head.jsx
  const exportScene = new THREE.Scene();

  const newMetal = new THREE.Mesh(metalGeom, new THREE.MeshStandardMaterial({ name: 'Metal01' }));
  newMetal.name = 'HeadMetal.001';

  const newCenter = new THREE.Mesh(centerGeom, new THREE.MeshStandardMaterial({ name: `Center_${shape}` }));
  newCenter.name = centerNodeName;

  const newAccent = new THREE.Mesh(mergedAccentGeom, new THREE.MeshStandardMaterial({ name: 'Halo_Round' }));
  newAccent.name = 'HALOACCENT__Diamond_Round';

  exportScene.add(newMetal);
  exportScene.add(newCenter);
  exportScene.add(newAccent);

  // Export intermediate raw GLB
  const rawGlbArrayBuffer = await new Promise((res, rej) =>
    exporter.parse(exportScene, res, rej, { binary: true })
  );

  // Apply Draco compression & welding
  const doc = await io.readBinary(new Uint8Array(rawGlbArrayBuffer));
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (mesh) mesh.setName(node.getName());
  }

  await doc.transform(
    weld(),
    draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10 })
  );

  const compressedGlb = Buffer.from(await io.writeBinary(doc));
  const encryptedBuf = xorEncrypt(compressedGlb);

  console.log(`  Compressed size: ${(compressedGlb.length / 1024).toFixed(1)} KB (raw was ${(rawBuf.length / 1024).toFixed(1)} KB, ${(rawBuf.length / compressedGlb.length).toFixed(1)}x compression)`);

  // Write to canonical path: HALO/halo-<shape>/halo-<shape>-3.glb and .enc
  const oldFolder = path.join(HALO_DIR, `halo-${shape}`);
  fs.mkdirSync(oldFolder, { recursive: true });
  const oldGlbPath = path.join(oldFolder, `halo-${shape}-3.glb`);
  const oldEncPath = path.join(oldFolder, `halo-${shape}-3.enc`);
  fs.writeFileSync(oldGlbPath, compressedGlb);
  fs.writeFileSync(oldEncPath, encryptedBuf);
  console.log(`  Updated: ${path.relative(ROOT, oldGlbPath)} & .enc`);
}

// Moval diamond: use the current oval halo model as requested
console.log(`\n========================================`);
console.log(`Processing shape: MOVAL (using OVAL halo model)`);
const ovalGlbPath = path.join(HALO_DIR, 'halo-oval/halo-oval-3.glb');
const ovalEncPath = path.join(HALO_DIR, 'halo-oval/halo-oval-3.enc');
const movalFolder = path.join(HALO_DIR, 'halo-moval');
fs.mkdirSync(movalFolder, { recursive: true });

const movalOldGlbPath = path.join(movalFolder, 'halo-moval-3.glb');
const movalBackupFile = path.join(BACKUP_DIR, 'moval.raw.glb');
if (fs.existsSync(movalOldGlbPath) && !fs.existsSync(movalBackupFile)) {
  fs.copyFileSync(movalOldGlbPath, movalBackupFile);
  console.log(`Backed up original moval to: ${path.relative(ROOT, movalBackupFile)}`);
}

fs.copyFileSync(ovalGlbPath, path.join(movalFolder, 'halo-moval-3.glb'));
fs.copyFileSync(ovalEncPath, path.join(movalFolder, 'halo-moval-3.enc'));
console.log(`  Updated moval using oval: halo-moval/halo-moval-3.glb & .enc`);

console.log('\nAll halo models (including heart and moval) successfully processed, compressed, and encrypted!');
