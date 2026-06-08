import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";

function crc32(buf) {
  let c = 0xffffffff;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[n] = v;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function createPNG(width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const off = y * (1 + width * 4);
    raw[off] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const po = off + 1 + x * 4;
      raw[po] = r;
      raw[po + 1] = g;
      raw[po + 2] = b;
      raw[po + 3] = a;
    }
  }

  const compressed = deflateSync(raw, { level: 9 });
  const idat = pngChunk("IDAT", compressed);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), idat, pngChunk("IEND", Buffer.alloc(0))]);
}

function pixel(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > r) return [15, 20, 25, 255];

  const angle = Math.atan2(dy, dx);
  const snakeR = r * 0.35;
  const segments = 6;
  const segLen = (2 * Math.PI) / segments;

  let inSnake = false;
  for (let i = 0; i < segments; i++) {
    const sa = i * segLen;
    const sx = cx + snakeR * Math.cos(sa);
    const sy = cy + snakeR * Math.sin(sa);
    const sdx = x - sx, sdy = y - sy;
    const sd = Math.sqrt(sdx * sdx + sdy * sdy);
    if (sd < r * 0.12) { inSnake = true; break; }
  }

  if (inSnake) return [62, 207, 142, 255];

  const isHead = dist < r * 0.1;
  if (isHead) return [62, 207, 142, 255];

  if (dist < r * 0.08) return [232, 93, 117, 255];

  const isEye = Math.sqrt((x - cx - r * 0.05) ** 2 + (y - cy - r * 0.05) ** 2) < r * 0.02;
  if (isEye) return [15, 20, 25, 255];

  const cornerDist = Math.max(Math.abs(x), Math.abs(y)) - r * 0.85;
  if (cornerDist > 0) return [26, 35, 50, 255];

  return [15, 20, 25, 255];
}

function roundedRectEdge(x, y, w, h, rad) {
  const left = rad, right = w - rad, top = rad, bottom = h - rad;
  if (x < left && y < top) return Math.sqrt((x - left) ** 2 + (y - top) ** 2) > rad;
  if (x > right && y < top) return Math.sqrt((x - right) ** 2 + (y - top) ** 2) > rad;
  if (x < left && y > bottom) return Math.sqrt((x - left) ** 2 + (y - bottom) ** 2) > rad;
  if (x > right && y > bottom) return Math.sqrt((x - right) ** 2 + (y - bottom) ** 2) > rad;
  return x < left || x > right || y < top || y > bottom;
}

function generatePixelFn(size) {
  const cornerRadius = size * 0.2;
  return function (x, y, w, h) {
    const [r, g, b, a] = pixel(x, y, w, h);
    if (a === 0) return [0, 0, 0, 0];
    if (roundedRectEdge(x, y, w, h, cornerRadius)) return [0, 0, 0, 0];
    return [r, g, b, a];
  };
}

const sizes = [192, 512];
for (const size of sizes) {
  const png = createPNG(size, size, generatePixelFn(size));
  const dir = ".";
  writeFileSync(`${dir}/icon-${size}.png`, png);
  console.log(`Created icon-${size}.png (${png.length} bytes)`);
}
