// Génère l'icône de l'app et l'image de l'écran de démarrage.
//
// Dessinée par un script plutôt qu'exportée d'un outil graphique : l'icône est
// géométrique, elle se décrit en quelques lignes, et elle se régénère à
// l'identique — dans n'importe quelle taille et sans dépendance. Le rendu est
// fait par distance signée aux segments, ce qui donne un anticrénelage propre
// sans bibliothèque.
//
//   npm run icon
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const SIZE = 1024;

// --- Encodeur PNG (RGBA 8 bits) --------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 6; // RGBA
  // Chaque ligne est précédée de son octet de filtre ; 0 = aucun filtre, ce
  // qui suffit largement : deflate fait le travail sur une image aussi plate.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1);
    raw[start] = 0;
    rgba.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Dessin -----------------------------------------------------------------

/** Distance d'un point au segment [a, b], en coordonnées normalisées. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Couverture d'un chevron : union de deux segments à bouts ronds. */
function chevron(x, y, apexX, apexY, spread, drop, halfWidth, feather) {
  const distance = Math.min(
    distanceToSegment(x, y, apexX, apexY, apexX - spread, apexY + drop),
    distanceToSegment(x, y, apexX, apexY, apexX + spread, apexY + drop),
  );
  // Rampe linéaire sur l'épaisseur d'un pixel et demi : anticrénelage.
  return Math.max(0, Math.min(1, (halfWidth - distance) / feather + 0.5));
}

function mix(background, foreground, alpha) {
  return Math.round(background * (1 - alpha) + foreground * alpha);
}

const ACCENT = [0xd6, 0xff, 0x3f];
const ACCENT_DIM = [0x7f, 0x99, 0x25];

function render({ background }) {
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  const feather = 1.5 / SIZE;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const nx = (x + 0.5) / SIZE;
      const ny = (y + 0.5) / SIZE;
      const i = (y * SIZE + x) * 4;

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      if (background) {
        // Dégradé vertical discret : l'icône reste sombre mais pas plate.
        const t = ny;
        r = Math.round(0x14 * (1 - t) + 0x06 * t);
        g = Math.round(0x18 * (1 - t) + 0x08 * t);
        b = Math.round(0x1e * (1 - t) + 0x0b * t);
        a = 255;
      }

      // Chevron secondaire d'abord : le principal passe par-dessus.
      const small = chevron(nx, ny, 0.5, 0.605, 0.175, 0.17, 0.043, feather);
      if (small > 0) {
        r = mix(r, ACCENT_DIM[0], small);
        g = mix(g, ACCENT_DIM[1], small);
        b = mix(b, ACCENT_DIM[2], small);
        a = Math.max(a, Math.round(small * 255));
      }

      const big = chevron(nx, ny, 0.5, 0.345, 0.265, 0.265, 0.063, feather);
      if (big > 0) {
        r = mix(r, ACCENT[0], big);
        g = mix(g, ACCENT[1], big);
        b = mix(b, ACCENT[2], big);
        a = Math.max(a, Math.round(big * 255));
      }

      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
  return encodePng(SIZE, SIZE, rgba);
}

// L'icône iOS ne doit PAS être transparente : le système ne compose rien
// derrière, un canal alpha y produit du noir sale sur certains rendus.
writeFileSync(join(OUT, 'icon.png'), render({ background: true }));
// L'écran de démarrage, lui, pose la marque sur la couleur de fond déclarée
// dans app.config.ts : fond transparent.
writeFileSync(join(OUT, 'splash-icon.png'), render({ background: false }));
writeFileSync(join(OUT, 'android-icon-foreground.png'), render({ background: false }));
console.log('icon.png, splash-icon.png, android-icon-foreground.png régénérés');
