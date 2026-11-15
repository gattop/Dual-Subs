// node scripts/pack.js -> dist/dual-subs-<versione>.zip, solo zlib di Node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
// test, script e README restano fuori
const INCLUDE = [
  'manifest.json',
  'vtt-parser.js', 'ttml-parser.js', 'hls.js', 'tracks.js', 'platforms',
  'overlay.js', 'page.js', 'content.js',
  'overlay.css', 'popup.html', 'popup.css', 'popup.js',
  'icons', '_locales',
  'THIRD_PARTY_NOTICES.md'
];
// data fissa: stesso codice, stesso zip
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

function listFiles(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs.readdirSync(abs).sort().flatMap((name) => listFiles(rel + '/' + name));
}

// ogni file citato nel manifest deve esserci
function checkManifestFiles(files, manifest) {
  const referenced = [manifest.action.default_popup];
  referenced.push(...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon));
  for (const cs of manifest.content_scripts) referenced.push(...(cs.js || []), ...(cs.css || []));
  referenced.push('_locales/' + manifest.default_locale + '/messages.json');
  const missing = referenced.filter((file) => !files.includes(file));
  if (missing.length) throw new Error('File del manifest esclusi dallo zip: ' + missing.join(', '));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function localEntry(name, data, compressed, crc) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // versione necessaria
  header.writeUInt16LE(0x0800, 6); // nomi in UTF-8
  header.writeUInt16LE(8, 8); // deflate
  header.writeUInt16LE(DOS_TIME, 10);
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  return Buffer.concat([header, name, compressed]);
}

function centralEntry(name, data, compressed, crc, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4); // creato con
  header.writeUInt16LE(20, 6); // versione necessaria
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(DOS_TIME, 12);
  header.writeUInt16LE(DOS_DATE, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(compressed.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

function endOfCentralDirectory(count, size, offset) {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return end;
}

function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file, 'utf8');
    const data = fs.readFileSync(path.join(ROOT, file));
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = localEntry(name, data, compressed, crc);
    centrals.push(centralEntry(name, data, compressed, crc, offset));
    locals.push(local);
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  return Buffer.concat([...locals, central, endOfCentralDirectory(files.length, central.length, offset)]);
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const files = INCLUDE.flatMap(listFiles);
  checkManifestFiles(files, manifest);
  const outDir = path.join(ROOT, 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'dual-subs-' + manifest.version + '.zip');
  const zip = buildZip(files);
  fs.writeFileSync(outFile, zip);
  console.log('Creato', path.relative(ROOT, outFile), '-', files.length, 'file,', zip.length, 'byte');
  for (const file of files) console.log('  ' + file);
}

main();
