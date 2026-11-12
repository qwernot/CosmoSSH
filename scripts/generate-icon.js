const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height) {
  // RGBA buffer
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.42;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Gradient from Deep Cosmic Purple to Cyan
        const t = (x + y) / (width + height);
        // Cosmic palette: #7928ca to #00f2fe
        const r = Math.round(121 * (1 - t) + 0 * t);
        const g = Math.round(40 * (1 - t) + 242 * t);
        const b = Math.round(202 * (1 - t) + 254 * t);
        
        // Inner terminal icon shape: a prompt "> _"
        const isPrompt =
          (dx > -radius * 0.5 && dx < -radius * 0.1 && Math.abs(dy - (dx + radius * 0.3) * 0.8) < 6) ||
          (dx > -radius * 0.5 && dx < -radius * 0.1 && Math.abs(dy + (dx + radius * 0.3) * 0.8) < 6) ||
          (dx > 0 && dx < radius * 0.45 && Math.abs(dy - radius * 0.25) < 5);

        if (isPrompt) {
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
        } else {
          rawData[offset++] = r;
          rawData[offset++] = g;
          rawData[offset++] = b;
          rawData[offset++] = 255;
        }
      } else if (dist <= radius + 4) {
        // Subtle glow border
        rawData[offset++] = 0;
        rawData[offset++] = 242;
        rawData[offset++] = 254;
        rawData[offset++] = Math.round(255 * (1 - (dist - radius) / 4));
      } else {
        // Transparent
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      }
    }
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', idatData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcData = Buffer.alloc(4 + len);
  crcData.write(type, 0, 4, 'ascii');
  data.copy(crcData, 4);
  chunk.writeUInt32BE(crc32(crcData), 8 + len);
  return chunk;
}

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const pngBuffer = createPNG(256, 256);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngBuffer);
console.log('Generated assets/icon.png (256x256 RGBA)');
