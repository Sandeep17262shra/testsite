import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEFT_SRC = path.join(ROOT, 'public/3d-models/RING-HEAD/TWO-STONE/left-head/heart.glb');
const RIGHT_SRC = path.join(ROOT, 'public/3d-models/RING-HEAD/TWO-STONE/right-head/heart.glb');

const LEFT_BACKUP_DIR = path.join(ROOT, 'model-sources/3d-models/RING-HEAD/TWO-STONE/left-head');
const RIGHT_BACKUP_DIR = path.join(ROOT, 'model-sources/3d-models/RING-HEAD/TWO-STONE/right-head');

const SECRET_KEY = 'r!ng$3cur3K3y#2024XoR';

function xorEncrypt(buffer) {
  const key = Buffer.from(SECRET_KEY, 'utf8');
  const out = Buffer.allocUnsafe(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    out[i] = buffer[i] ^ key[i % key.length];
  }
  return out;
}

async function processFile(inputPath, backupPath, encPath) {
  console.log(`\n--- Processing ${inputPath} ---`);
  
  // 1. Backup raw file if backup doesn't exist
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(inputPath, backupPath);
    console.log(`Backed up pristine model to: ${backupPath}`);
  } else {
    console.log(`Backup already exists at: ${backupPath}`);
  }

  // 2. Read GLB
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  const doc = await io.read(backupPath);

  // 3. Apply Draco compression
  console.log('Applying Draco mesh compression...');
  await doc.transform(
    weld({ tolerance: 0.0001 }),
    draco({
      method: 'edgebreaker',
      quantizePositionBits: 14,
      quantizeNormalBits: 10,
      quantizeTexcoordBits: 12,
      quantizeColorBits: 8,
      quantizeGenericBits: 12,
    })
  );

  // 4. Write Draco-compressed GLB
  const dracoGlbBytes = await io.writeBinary(doc);
  fs.writeFileSync(inputPath, dracoGlbBytes);
  console.log(`Wrote Draco GLB to: ${inputPath} (${dracoGlbBytes.length} bytes, was ${fs.statSync(backupPath).size} bytes)`);

  // 5. Encrypt with XOR
  const encryptedBytes = xorEncrypt(Buffer.from(dracoGlbBytes));
  fs.writeFileSync(encPath, encryptedBytes);
  console.log(`Wrote XOR-encrypted model to: ${encPath} (${encryptedBytes.length} bytes)`);
}

async function main() {
  await processFile(
    LEFT_SRC,
    path.join(LEFT_BACKUP_DIR, 'heart.raw.glb'),
    path.join(ROOT, 'public/3d-models/RING-HEAD/TWO-STONE/left-head/heart.enc')
  );

  await processFile(
    RIGHT_SRC,
    path.join(RIGHT_BACKUP_DIR, 'heart.raw.glb'),
    path.join(ROOT, 'public/3d-models/RING-HEAD/TWO-STONE/right-head/heart.enc')
  );

  console.log('\nAll TWO-STONE heart models processed, compressed, and encrypted successfully.');
}

main().catch((err) => {
  console.error('Error processing TWO-STONE heart models:', err);
  process.exit(1);
});
