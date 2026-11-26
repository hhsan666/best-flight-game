// Forests: a seeded density field (shared with the ground shading, so dark forest floor and trees
// coincide), tree placement on a jittered grid, and a spatial index for low-flying collisions.
import { createGradientNoise, fractalNoise, smoothstep } from '../core/noise.js';
import { hashCell, subSeed } from '../core/seeded-random.js';
import { AIRFIELDS, TOWNS, inApproachFunnel } from './landmarks.js';

const TREE_SPACING = 26;
const INDEX_CELL = 64;

/** How far a point is from anything that must stay clear of trees (runways, towns, the river). */
function clearingFactor(terrain, x, z) {
  let factor = 1;
  for (const field of AIRFIELDS) {
    const h = (field.heading * Math.PI) / 180;
    const dx = x - field.x;
    const dz = z - field.z;
    const u = Math.abs(dx * Math.sin(h) - dz * Math.cos(h)) - field.length / 2 - 380;
    const v = Math.abs(dx * Math.cos(h) + dz * Math.sin(h)) - field.width / 2 - 170;
    factor *= smoothstep(0, 140, Math.max(u, v));
  }
  for (const town of TOWNS) factor *= smoothstep(town.radius * 0.85, town.radius * 1.25, Math.hypot(x - town.x, z - town.z));
  if (inApproachFunnel(x, z, 2000)) return 0;
  return factor * riverClearance(terrain, x, z);
}

function riverClearance(terrain, x, z) {
  const course = terrain.river;
  let best = Infinity;
  for (let k = 0; k < course.length; k += 3) best = Math.min(best, Math.hypot(x - course[k].x, z - course[k].z) - course[k].halfWidth);
  return smoothstep(18, 70, best);
}

/** Forest density in [0, 1] at a point: patches on mid-slopes, thinning with height and steepness. */
export function createForestField(terrain, seed) {
  const noise = createGradientNoise(subSeed(seed, 'forest'));
  return function forestDensity(x, z, withClearings = true) {
    const h = terrain.heightAt(x, z);
    if (h < 3.5 || h > 780) return 0;
    const slope = terrain.slopeAt(x, z);
    const patches = fractalNoise(noise, x / 1100, z / 1100, 4) * 0.5 + 0.5;
    let density = smoothstep(0.45, 0.59, patches + smoothstep(120, 480, h) * 0.12);
    density *= 1 - smoothstep(560, 780, h);
    density *= 1 - smoothstep(0.75, 1.1, slope);
    density *= smoothstep(3.5, 9, h);
    return withClearings ? density * clearingFactor(terrain, x, z) : density;
  };
}

/** Places every tree; conifers climb the slopes, broadleaf trees keep to the lowlands. */
export function plantForests(terrain, seed, forestDensity) {
  const trees = [];
  const cells = Math.floor(terrain.size / TREE_SPACING);
  const s = subSeed(seed, 'trees');
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const roll = hashCell(i, j, s);
      const x = -terrain.half + (i + 0.15 + 0.7 * hashCell(i, j, s + 1)) * TREE_SPACING;
      const z = -terrain.half + (j + 0.15 + 0.7 * hashCell(i, j, s + 2)) * TREE_SPACING;
      const density = forestDensity(x, z);
      if (roll > density * 0.92) continue;
      const y = terrain.heightAt(x, z);
      const conifer = y > 240 || hashCell(i, j, s + 3) < 0.35;
      const height = (conifer ? 11 : 9) + 8 * hashCell(i, j, s + 4);
      trees.push({ x, y: y - 0.6, z, height, radius: height * (conifer ? 0.3 : 0.42), conifer, seed: 0.05 + 0.95 * hashCell(i, j, s + 5), yaw: hashCell(i, j, s + 6) * Math.PI * 2 });
    }
  }
  return { trees, index: buildTreeIndex(trees, terrain) };
}

/** A grid of tree lists so a collision check only looks at trees near the aircraft. */
function buildTreeIndex(trees, terrain) {
  const side = Math.ceil(terrain.size / INDEX_CELL);
  const cells = new Map();
  for (const tree of trees) {
    const key = Math.floor((tree.x + terrain.half) / INDEX_CELL) + Math.floor((tree.z + terrain.half) / INDEX_CELL) * side;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(tree);
  }
  return {
    near(x, z) {
      const ci = Math.floor((x + terrain.half) / INDEX_CELL);
      const cj = Math.floor((z + terrain.half) / INDEX_CELL);
      const found = [];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const list = cells.get(ci + di + (cj + dj) * side);
        if (list) found.push(...list);
      }
      return found;
    },
  };
}
