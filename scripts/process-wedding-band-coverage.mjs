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
const BACKUP_DIR = path.join(ROOT, 'model-sources');

const SECRET_KEY = 'r!ng$3cur3K3y#2024XoR';

function xorEncrypt(buffer) {
  const key = Buffer.from(SECRET_KEY, 'utf8');
  const out = Buffer.allocUnsafe(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    out[i] = buffer[i] ^ key[i % key.length];
  }
  return out;
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const loader = new GLTFLoader();
const exporter = new GLTFExporter();

const MODELS = [
  {
    type: 'channel',
    srcPath: '3d-models/WEDDING-BANDS/CHANNEL-WED-MODELS/1_2-chnl-WED.glb',
    outPath: '3d-models/WEDDING-BANDS/Channel-Models/1_2.glb',
  },
  {
    type: 'channel',
    srcPath: '3d-models/WEDDING-BANDS/CHANNEL-WED-MODELS/3_4-chnl-WED.glb',
    outPath: '3d-models/WEDDING-BANDS/Channel-Models/3_4.glb',
  },
  {
    type: 'channel',
    srcPath: '3d-models/WEDDING-BANDS/CHANNEL-WED-MODELS/full-chnl-WED.glb',
    outPath: '3d-models/WEDDING-BANDS/Channel-Models/full.glb',
  },
  {
    type: 'pave',
    srcPath: '3d-models/WEDDING-BANDS/PAVE-WED-MODELS/1:2 pave.glb',
    outPath: '3d-models/WEDDING-BANDS/Pave-Models/1_2.glb',
  },
  {
    type: 'pave',
    srcPath: '3d-models/WEDDING-BANDS/PAVE-WED-MODELS/3:4 pave.glb',
    outPath: '3d-models/WEDDING-BANDS/Pave-Models/3_4.glb',
  },
  {
    type: 'pave',
    srcPath: '3d-models/WEDDING-BANDS/PAVE-WED-MODELS/full pave.glb',
    outPath: '3d-models/WEDDING-BANDS/Pave-Models/full.glb',
  },
];

for (const { type, srcPath, outPath } of MODELS) {
  const srcFullPath = path.join(PUBLIC_DIR, srcPath);
  const outFullPath = path.join(PUBLIC_DIR, outPath);
  const backupSrcPath = path.join(BACKUP_DIR, srcPath);
  const encPath = outFullPath.replace(/\.glb$/, '.enc');

  console.log(`\n========================================`);
  console.log(`Processing: ${srcPath} -> ${outPath}`);

  // Backup pristine original source if not already backed up
  if (!fs.existsSync(backupSrcPath)) {
    fs.mkdirSync(path.dirname(backupSrcPath), { recursive: true });
    fs.copyFileSync(srcFullPath, backupSrcPath);
    console.log(`Backed up source to: ${path.relative(ROOT, backupSrcPath)}`);
  }

  // Load via gltf-transform first to decode any preexisting Draco compression safely
  const rawBuf = fs.readFileSync(backupSrcPath);
  const doc = await io.readBinary(new Uint8Array(rawBuf));
  const dracoExt = doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === 'KHR_draco_mesh_compression');
  if (dracoExt) dracoExt.dispose();

  const uncompressedBuf = Buffer.from(await io.writeBinary(doc));
  const gltf = await new Promise((res, rej) =>
    loader.parse(uncompressedBuf.buffer.slice(uncompressedBuf.byteOffset, uncompressedBuf.byteOffset + uncompressedBuf.byteLength), '', res, rej)
  );

  gltf.scene.updateMatrixWorld(true);

  let metalMeshes = [];
  let diamondMeshes = [];

  gltf.scene.traverse((child) => {
    if (!child.isMesh) return;
    const matName = (child.material?.name || '').toLowerCase();

    if (type === 'channel') {
      if (matName.includes('metal')) {
        metalMeshes.push(child);
      } else {
        diamondMeshes.push(child);
      }
    } else {
      // pave
      if (matName.includes('yellow') || matName.includes('gold')) {
        metalMeshes.push(child);
      } else {
        diamondMeshes.push(child);
      }
    }
  });

  console.log(`  Found: ${metalMeshes.length} metal meshes, ${diamondMeshes.length} diamond meshes`);

  if (!metalMeshes.length || !diamondMeshes.length) {
    throw new Error(`Failed to find meshes for ${srcPath}: metal=${metalMeshes.length}, diamonds=${diamondMeshes.length}`);
  }

  // Wedding band models are in ring shank space (-9.6 to +6.3), matching CHANNEL and PLATE-PRONG.
  // Bake matrixWorld without unshift.
  const metalGeoms = metalMeshes.map((m) => {
    const geom = m.geometry.clone().applyMatrix4(m.matrixWorld);
    geom.computeVertexNormals();
    return geom;
  });
  const mergedMetalGeom = metalGeoms.length === 1 ? metalGeoms[0] : BufferGeometryUtils.mergeGeometries(metalGeoms);

  const diamondGeoms = diamondMeshes.map((m) => {
    const geom = m.geometry.clone().applyMatrix4(m.matrixWorld);
    geom.computeVertexNormals();
    return geom;
  });
  const mergedDiamondGeom = diamondGeoms.length === 1 ? diamondGeoms[0] : BufferGeometryUtils.mergeGeometries(diamondGeoms);

  mergedMetalGeom.computeBoundingBox();
  mergedDiamondGeom.computeBoundingBox();

  console.log(`  Metal bounds: min [${mergedMetalGeom.boundingBox.min.toArray().map((v) => v.toFixed(3))}], max [${mergedMetalGeom.boundingBox.max.toArray().map((v) => v.toFixed(3))}]`);
  console.log(`  Diamond bounds: min [${mergedDiamondGeom.boundingBox.min.toArray().map((v) => v.toFixed(3))}], max [${mergedDiamondGeom.boundingBox.max.toArray().map((v) => v.toFixed(3))}]`);

  // Build clean scene with canonical mesh names:
  // 'metal003' matches COLORED_MESH_NAMES in Ring.jsx
  // 'diamond003' gets diamond material
  mergedMetalGeom.name = 'metal003';
  mergedDiamondGeom.name = 'diamond003';

  const exportScene = new THREE.Scene();
  const metalMesh = new THREE.Mesh(mergedMetalGeom, new THREE.MeshStandardMaterial({ name: 'ROSE GOLD' }));
  metalMesh.name = 'metal003';

  const diamondMesh = new THREE.Mesh(mergedDiamondGeom, new THREE.MeshStandardMaterial({ name: 'DIAMOND' }));
  diamondMesh.name = 'diamond003';

  exportScene.add(metalMesh);
  exportScene.add(diamondMesh);

  // Export raw GLB
  const rawGlbArrayBuffer = await new Promise((res, rej) =>
    exporter.parse(exportScene, res, rej, { binary: true })
  );

  // Draco compress with @gltf-transform
  const outDoc = await io.readBinary(new Uint8Array(rawGlbArrayBuffer));
  for (const node of outDoc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (mesh) mesh.setName(node.getName());
  }

  await outDoc.transform(
    weld(),
    draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10 })
  );

  const compressedGlb = Buffer.from(await io.writeBinary(outDoc));
  const encryptedBuf = xorEncrypt(compressedGlb);

  fs.mkdirSync(path.dirname(outFullPath), { recursive: true });
  fs.writeFileSync(outFullPath, compressedGlb);
  fs.writeFileSync(encPath, encryptedBuf);

  console.log(`  Compressed: ${(rawBuf.length / 1024).toFixed(1)} KB -> ${(compressedGlb.length / 1024).toFixed(1)} KB (${(rawBuf.length / compressedGlb.length).toFixed(1)}x)`);
  console.log(`  Wrote ${outPath} & .enc`);
}

console.log('\nAll updated wedding band coverage models processed, Draco compressed, and encrypted successfully!');
