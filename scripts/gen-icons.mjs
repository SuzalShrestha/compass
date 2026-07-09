#!/usr/bin/env node
// Generate the extension PNG icons from a single vector definition — no
// dependencies (uses only Node's built-in zlib). Run: `node scripts/gen-icons.mjs`.
// Output: public/icons/icon-{16,32,48,128}.png
//
// The drawing mirrors public/icons/icon.svg: a slate rounded-square tile with a
// compass ring and a two-tone north/south needle. Edit the geometry/colours here
// (and the SVG) to rebrand.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const SIZES = [16, 32, 48, 128]
const SS = 4 // supersample factor for antialiasing

// Colours (r,g,b)
const SLATE = [0x3a, 0x41, 0x50]
const RING = [0x6b, 0x76, 0x86]
const LIGHT = [0xe8, 0xea, 0xed]
const MUTED = [0x8a, 0x93, 0xa3]

// Geometry in a 128×128 design space
const C = 64
const TILE = { x: 6, y: 6, w: 116, h: 116, r: 28 }
const RING_R = 42
const RING_W = 4
const NORTH = [[64, 26], [76, 64], [52, 64]]
const SOUTH = [[64, 102], [76, 64], [52, 64]]

function inRoundRect(x, y, t) {
  if (x < t.x || y < t.y || x > t.x + t.w || y > t.y + t.h) return false
  const rx = Math.min(t.r, t.w / 2)
  const nx = x < t.x + rx ? t.x + rx : x > t.x + t.w - rx ? t.x + t.w - rx : x
  const ny = y < t.y + rx ? t.y + rx : y > t.y + t.h - rx ? t.y + t.h - rx : y
  return (x - nx) ** 2 + (y - ny) ** 2 <= rx * rx
}
function inRing(x, y) {
  const d = Math.hypot(x - C, y - C)
  return d >= RING_R - RING_W / 2 && d <= RING_R + RING_W / 2
}
function inTri(x, y, [a, b, c]) {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
  const d1 = s([x, y], a, b), d2 = s([x, y], b, c), d3 = s([x, y], c, a)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}
function dist(x, y) { return Math.hypot(x - C, y - C) }

// Return [r,g,b,a] for a point in 128-space, layering back-to-front.
function sample(x, y) {
  let col = null
  if (inRoundRect(x, y, TILE)) col = SLATE
  if (inRing(x, y)) col = RING
  if (inTri(x, y, NORTH)) col = LIGHT
  if (inTri(x, y, SOUTH)) col = MUTED
  const d = dist(x, y)
  if (d <= 7.5) col = d <= 4.5 ? SLATE : LIGHT // centre pivot: fill + light stroke
  return col ? [...col, 255] : [0, 0, 0, 0]
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4)
  const scale = 128 / size
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dx = (px + (sx + 0.5) / SS) * scale
          const dy = (py + (sy + 0.5) / SS) * scale
          const [sr, sg, sb, sa] = sample(dx, dy)
          const w = sa / 255
          r += sr * w; g += sg * w; b += sb * w; a += sa
        }
      }
      const n = SS * SS
      const av = a / (255 * n) // coverage 0..1
      const i = (py * size + px) * 4
      // premultiplied average -> straight colour
      buf[i] = av > 0 ? Math.round(r / (av * n)) : 0
      buf[i + 1] = av > 0 ? Math.round(g / (av * n)) : 0
      buf[i + 2] = av > 0 ? Math.round(b / (av * n)) : 0
      buf[i + 3] = Math.round(av * 255)
    }
  }
  return buf
}

// --- Minimal PNG encoder (RGBA, no interlace) ---
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  const png = encodePng(size, render(size))
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), png)
  console.log(`wrote public/icons/icon-${size}.png (${png.length} bytes)`)
}
