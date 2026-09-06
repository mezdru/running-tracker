// Génère les bips de l'écran de course. Ils sont produits par un script plutôt
// que téléchargés : deux sinusoïdes de quelques kilo-octets, sans licence à
// traîner, régénérables à l'identique, et surtout calibrées pour rester
// audibles sous un casque en pleine séance (fréquence haute, attaque nette).
//
//   npm run cues
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'audio');
const SAMPLE_RATE = 44100;

/** WAV PCM 16 bits mono : le format le plus universellement décodé. */
function encodeWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // taille du bloc fmt
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // octets par seconde
  buffer.writeUInt16LE(2, 32); // alignement de bloc
  buffer.writeUInt16LE(16, 34); // bits par échantillon
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

/**
 * Une note. L'enveloppe (montée de 5 ms, descente exponentielle) n'est pas
 * cosmétique : une sinusoïde coupée net produit un claquement désagréable, et
 * le claquement porte plus loin que le bip lui-même.
 */
function tone(frequency, durationS, gain = 0.5) {
  const count = Math.round(SAMPLE_RATE * durationS);
  const attack = Math.round(SAMPLE_RATE * 0.005);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    const envelope =
      (i < attack ? i / attack : 1) * Math.exp(-3 * (i / count) ** 2);
    samples[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * gain;
  }
  return samples;
}

function silence(durationS) {
  return new Float32Array(Math.round(SAMPLE_RATE * durationS));
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const cues = {
  // Décompte : bip court et médium, trois fois de suite avant le changement.
  'beep-tick': tone(880, 0.09),
  // Changement d'étape : bip aigu, plus long, impossible à confondre avec le
  // décompte qui vient de le précéder.
  'beep-step': concat([tone(1320, 0.16), silence(0.04), tone(1760, 0.22)]),
  // Fin de séance : trois notes montantes.
  'beep-finish': concat([
    tone(880, 0.14),
    silence(0.05),
    tone(1174, 0.14),
    silence(0.05),
    tone(1760, 0.35),
  ]),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, samples] of Object.entries(cues)) {
  const file = join(OUT_DIR, `${name}.wav`);
  writeFileSync(file, encodeWav(samples));
  console.log(`${file} — ${(samples.length / SAMPLE_RATE).toFixed(2)} s`);
}
