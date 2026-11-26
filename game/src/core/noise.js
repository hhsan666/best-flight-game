// Gradient noise for the terrain: one permutation table per seed, plus the fractal sums
// (rolling hills, ridged mountains, warped coastlines) the archipelago generator layers together.
import { createRandom } from './seeded-random.js';

const GRADIENTS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

/** Returns noise(x, y) in roughly [-1, 1], smooth, with features about one unit apart. */
export function createGradientNoise(seed) {
  const random = createRandom(seed);
  const table = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [table[i], table[j]] = [table[j], table[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = table[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const dotGrad = (hash, x, y) => {
    const g = GRADIENTS[hash & 7];
    return g[0] * x + g[1] * y;
  };
  return function gradientNoise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const u = fade(xf);
    const v = fade(yf);
    const x1 = dotGrad(aa, xf, yf) + u * (dotGrad(ba, xf - 1, yf) - dotGrad(aa, xf, yf));
    const x2 = dotGrad(ab, xf, yf - 1) + u * (dotGrad(bb, xf - 1, yf - 1) - dotGrad(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 1.41;
  };
}

/** Fractal Brownian motion: octaves of noise, each finer and fainter. */
export function fractalNoise(noise, x, y, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency + i * 17.31, y * frequency - i * 9.73);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

/** Ridged multifractal in [0, 1]: sharp crests for mountain ranges. */
export function ridgedNoise(noise, x, y, octaves = 6) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let weight = 1;
  for (let i = 0; i < octaves; i++) {
    let ridge = 1 - Math.abs(noise(x * frequency + i * 3.7, y * frequency + i * 5.1));
    ridge *= ridge;
    ridge *= weight;
    weight = Math.min(1, Math.max(0, ridge * 2));
    sum += ridge * amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return Math.min(1, sum);
}

export const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, min, max) => (x < min ? min : x > max ? max : x);
