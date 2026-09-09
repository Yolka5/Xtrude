/**
 * Icon generator. Run: npm run icons
 *
 * Rasterises the Xtrude mark directly to PNG with a small scanline renderer
 * and Node's built-in zlib, so the repo needs no image toolchain to rebuild
 * its icons. Output is committed to public/icons/.
 *
 * The mark is an oblique-projected cube outline: a square profile extruded
 * back and up. Bold strokes and a single silhouette, so it survives being
 * shrunk to a 40px home-screen tile.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

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
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // truecolour with alpha
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- geometry helpers (all in a 0..1 unit square) --------------------------
/** Signed distance to a rounded rectangle centred in the unit square. */
function sdRoundRect(px, py, halfW, halfH, r) {
  const qx = Math.abs(px - 0.5) - (halfW - r);
  const qy = Math.abs(py - 0.5) - (halfH - r);
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) -
    r
  );
}
/** Distance from a point to a line segment. */
function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(wx - t * vx, wy - t * vy);
}

/** The mark: front square, the extruded back square's visible edges, and the
 *  three visible connecting edges. */
function edges(scale) {
  const f = [0.235, 0.365, 0.655, 0.785];    // front square: l, t, r, b
  const d = 0.17;                            // extrusion offset, up and right

  // The extrusion pushes the silhouette up and to the right, so the mark's
  // bounding box is not centred on the canvas. Re-centre it explicitly rather
  // than eyeballing it.
  const bx0 = f[0], bx1 = f[2] + d;
  const by0 = f[1] - d, by1 = f[3];
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const P = (x, y) => [0.5 + (x - cx) * scale, 0.5 + (y - cy) * scale];

  const A = P(f[0], f[1]), B = P(f[2], f[1]);
  const C = P(f[2], f[3]), D = P(f[0], f[3]);
  const A2 = P(f[0] + d, f[1] - d), B2 = P(f[2] + d, f[1] - d);
  const C2 = P(f[2] + d, f[3] - d);

  return [
    [A, B], [B, C], [C, D], [D, A],   // front profile
    [A2, B2], [B2, C2],               // visible back edges
    [A, A2], [B, B2], [C, C2],        // extrusion direction
  ];
}

// --- render -----------------------------------------------------------------
const BG_TOP = [0x3a, 0xa0, 0xff];
const BG_BOT = [0x00, 0x53, 0xd6];

/**
 * @param size      pixel dimension
 * @param radius    corner radius as a fraction of size (0 = square, full bleed)
 * @param markScale mark size relative to the canvas (maskable icons shrink it
 *                  into the 40% safe zone)
 */
function render(size, radius, markScale) {
  const buf = Buffer.alloc(size * size * 4);
  const segs = edges(markScale);
  const stroke = 0.048 * markScale;   // half-width of the mark's stroke
  const px = 1 / size;                // one pixel in unit space, for AA

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;

      // background: rounded square (or full bleed when radius is 0)
      let bgA;
      if (radius <= 0) {
        bgA = 1;
      } else {
        const d = sdRoundRect(u, v, 0.5, 0.5, radius);
        bgA = Math.max(0, Math.min(1, 0.5 - d / (1.6 * px)));
      }

      // vertical gradient, warped slightly toward the top-left light source
      const t = Math.max(0, Math.min(1, v * 0.82 + u * 0.18));
      const r = BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t;
      const g = BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t;
      const b = BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t;

      // the mark
      let dm = Infinity;
      for (const [[ax, ay], [bx, by]] of segs) {
        const d = sdSegment(u, v, ax, ay, bx, by);
        if (d < dm) dm = d;
      }
      const markA = Math.max(0, Math.min(1, (stroke - dm) / (1.4 * px) + 0.5));

      const o = (y * size + x) * 4;
      buf[o + 0] = Math.round(r + (255 - r) * markA);
      buf[o + 1] = Math.round(g + (255 - g) * markA);
      buf[o + 2] = Math.round(b + (255 - b) * markA);
      buf[o + 3] = Math.round(bgA * 255);
    }
  }
  return png(size, size, buf);
}

const FILES = [
  // [filename, size, corner radius (fraction), mark scale]
  ["icon-192.png",          192, 0.22, 0.86],
  ["icon-512.png",          512, 0.22, 0.86],
  // maskable icons are cropped to a circle by some launchers, so the mark has
  // to live inside the central 80% safe zone and the background must bleed
  ["maskable-512.png",      512, 0,    0.60],
  // iOS applies its own mask, so this one is square and full bleed
  ["apple-touch-icon.png",  180, 0,    0.80],
  ["favicon-32.png",         32, 0.22, 0.90],
];

for (const [name, size, radius, markScale] of FILES) {
  const data = render(size, radius, markScale);
  writeFileSync(join(OUT, name), data);
  console.log(`${name.padEnd(22)} ${String(size).padStart(4)}px  ${(data.length / 1024).toFixed(1)} KB`);
}
