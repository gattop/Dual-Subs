// node scripts/make-icons.js icons
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = process.argv[2];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// rettangoli arrotondati, coordinate 0..96
const shapes = [
  { x: 4, y: 12, w: 88, h: 72, r: 12, c: [30, 36, 52] },
  { x: 18, y: 46, w: 60, h: 10, r: 4, c: [255, 255, 255] },
  { x: 26, y: 62, w: 44, h: 10, r: 4, c: [77, 163, 255] }
];

function inside(s, x, y) {
  if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return false;
  const cx = Math.min(Math.max(x, s.x + s.r), s.x + s.w - s.r);
  const cy = Math.min(Math.max(y, s.y + s.r), s.y + s.h - s.r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= s.r ** 2;
}

function render(size) {
  const ss = 4; // supersampling per bordi morbidi
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const x = ((px + (sx + 0.5) / ss) / size) * 96;
        const y = ((py + (sy + 0.5) / ss) / size) * 96;
        let col = null;
        for (const s of shapes) if (inside(s, x, y)) col = s.c;
        if (col) { r += col[0]; g += col[1]; b += col[2]; a += 255; }
      }
      const n = ss * ss, cov = a / 255;
      const o = 1 + px * 4;
      row[o] = cov ? Math.round(r / cov) : 0;
      row[o + 1] = cov ? Math.round(g / cov) : 0;
      row[o + 2] = cov ? Math.round(b / cov) : 0;
      row[o + 3] = Math.round(a / n);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), render(size));
}
console.log('ok');
