/**
 * Icon generator. Run: npm run icons
 *
 * Reads Logo.jpg (the beaver mark at the repo root) and writes the PWA /
 * favicon set to public/icons/. PNG encoding is still a few dozen lines of
 * Node + zlib so regenerating icons doesn't need an image toolchain beyond
 * Windows' built-in JPEG decoder (System.Drawing).
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "Logo.jpg");
const OUT = join(ROOT, "public", "icons");
mkdirSync(OUT, { recursive: true });

const BG = [0xf2, 0xf2, 0xf5];   // --ground / PWA theme_color
const INK = [0x17, 0x17, 0x1a];  // --label, so the mark matches UI text

// --- minimal PNG writer -----------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function sdRoundRect(px, py, halfW, halfH, r) {
  const qx = Math.abs(px - 0.5) - (halfW - r);
  const qy = Math.abs(py - 0.5) - (halfH - r);
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    r
  );
}

/** Decode Logo.jpg to {width, height, rgba} via a 32-bit BMP dump. */
function loadJpeg(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path} - put Logo.jpg at the repo root.`);
  }
  const bmpPath = join(tmpdir(), "xtrude-logo.bmp");
  const inEsc = path.replaceAll("'", "''");
  const outEsc = bmpPath.replaceAll("'", "''");
  const ps = `
Add-Type -AssemblyName System.Drawing
$src = New-Object System.Drawing.Bitmap '${inEsc}'
$bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)
$g.Dispose()
$bmp.Save('${outEsc}', [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmp.Dispose()
$src.Dispose()
`;
  const r = spawnSync("powershell.exe", ["-NoProfile", "-STA", "-Command", ps], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`JPEG decode failed: ${r.stderr || r.stdout || r.status}`);
  }
  const buf = readFileSync(bmpPath);
  try { unlinkSync(bmpPath); } catch { /* temp */ }
  if (buf[0] !== 0x42 || buf[1] !== 0x4d) throw new Error("BMP dump was not a bitmap");
  const dataOff = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const heightRaw = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  if (bpp !== 32) throw new Error(`expected 32bpp BMP, got ${bpp}`);
  const bottomUp = heightRaw > 0;
  const height = Math.abs(heightRaw);
  const stride = width * 4;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcY = bottomUp ? height - 1 - y : y;
    for (let x = 0; x < width; x++) {
      const si = dataOff + srcY * stride + x * 4;
      const di = (y * width + x) * 4;
      rgba[di] = buf[si + 2];
      rgba[di + 1] = buf[si + 1];
      rgba[di + 2] = buf[si];
      rgba[di + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function inkAt(img, x, y) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return 0;
  const i = (y * img.width + x) * 4;
  const lum = (img.rgba[i] + img.rgba[i + 1] + img.rgba[i + 2]) / 3 / 255;
  return Math.max(0, Math.min(1, (0.96 - lum) / 0.92));
}

function sampleInk(img, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const a = inkAt(img, x0, y0);
  const b = inkAt(img, x0 + 1, y0);
  const c = inkAt(img, x0, y0 + 1);
  const d = inkAt(img, x0 + 1, y0 + 1);
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function contentBox(img) {
  let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (inkAt(img, x, y) < 0.12) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0) throw new Error("Logo.jpg looks empty after trimming white");
  const pad = 2;
  return {
    x: Math.max(0, x0 - pad),
    y: Math.max(0, y0 - pad),
    w: Math.min(img.width, x1 + pad + 1) - Math.max(0, x0 - pad),
    h: Math.min(img.height, y1 + pad + 1) - Math.max(0, y0 - pad),
  };
}

/**
 * @param size      pixel dimension
 * @param radius    corner radius as a fraction of size (0 = square, full bleed)
 * @param markScale beaver size relative to the canvas (maskable icons shrink
 *                  it into the central safe zone)
 */
function render(img, box, size, radius, markScale) {
  const buf = Buffer.alloc(size * size * 4);
  const inner = size * markScale;
  const scale = Math.min(inner / box.w, inner / box.h);
  const dw = box.w * scale;
  const dh = box.h * scale;
  const dx0 = (size - dw) / 2;
  const dy0 = (size - dh) / 2;
  const px = 1 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgA = 1;
      if (radius > 0) {
        const d = sdRoundRect((x + 0.5) / size, (y + 0.5) / size, 0.5, 0.5, radius);
        bgA = Math.max(0, Math.min(1, 0.5 - d / (1.6 * px)));
      }

      let ink = 0;
      const sx = dx0 <= x && x < dx0 + dw ? box.x + ((x + 0.5 - dx0) / dw) * box.w - 0.5 : null;
      const sy = dy0 <= y && y < dy0 + dh ? box.y + ((y + 0.5 - dy0) / dh) * box.h - 0.5 : null;
      if (sx !== null && sy !== null) ink = sampleInk(img, sx, sy);

      const o = (y * size + x) * 4;
      buf[o + 0] = Math.round(BG[0] + (INK[0] - BG[0]) * ink);
      buf[o + 1] = Math.round(BG[1] + (INK[1] - BG[1]) * ink);
      buf[o + 2] = Math.round(BG[2] + (INK[2] - BG[2]) * ink);
      buf[o + 3] = Math.round(bgA * 255);
    }
  }
  return png(size, size, buf);
}

const img = loadJpeg(SRC);
const box = contentBox(img);

const FILES = [
  // [filename, size, corner radius (fraction), mark scale]
  ["icon-192.png",          192, 0.22, 0.72],
  ["icon-512.png",          512, 0.22, 0.72],
  ["maskable-512.png",      512, 0,    0.56],
  ["apple-touch-icon.png",  180, 0,    0.70],
  ["favicon-32.png",         32, 0.22, 0.78],
  ["shortcut-96.png",        96, 0.22, 0.72],
];

for (const [name, size, radius, markScale] of FILES) {
  const data = render(img, box, size, radius, markScale);
  writeFileSync(join(OUT, name), data);
  console.log(`${name.padEnd(22)} ${String(size).padStart(4)}px  ${(data.length / 1024).toFixed(1)} KB`);
}
