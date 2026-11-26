// Seeded random numbers. Every island, tree, rooftop and ring in Skerrywind comes from one seed,
// so the same seed always rebuilds the same archipelago (and the same screenshots).

/** A small, fast generator (mulberry32) with helpers; returns numbers in [0, 1). */
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x2f6b1d35;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    signed: () => next() * 2 - 1,
  };
}

/** FNV-1a hash of a string, used to derive sub-seeds such as "forest" or "town:ostmere". */
export function hashText(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A child seed for one purpose, so adding a feature never reshuffles the others. */
export function subSeed(seed, purpose) {
  return (hashText(purpose) ^ Math.imul(seed >>> 0, 0x9e3779b1)) >>> 0;
}

/** Integer lattice hash in [0, 1): stable per cell, for jitter that must not depend on visit order. */
export function hashCell(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
