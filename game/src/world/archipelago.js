// Archipelago generator: a seeded heightfield of islands with warped coastlines, the ridged
// Cairnhold range, rolling hills, a carved river valley that runs to the sea, and runways levelled
// into the land. Everything downstream (mesh, trees, towns, rings, physics) samples this field.
import { createGradientNoise, fractalNoise, ridgedNoise, smoothstep, lerp, clamp } from '../core/noise.js';
import { createRandom, subSeed } from '../core/seeded-random.js';
import { ISLANDS, BAYS, CAIRNHOLD_RANGE, SILVERRUN_RIVER, AIRFIELDS, TOWNS } from './landmarks.js';

export const WORLD_SIZE = 12800;
export const GRID_CELLS = 512;
export const CELL_SIZE = WORLD_SIZE / GRID_CELLS;
export const SEA_LEVEL = 0;
const HALF = WORLD_SIZE / 2;
const SIDE = GRID_CELLS + 1;
const DEEP_SEA = -90;

/** Signed "how far inside an island" field (0 at the coast) and how hilly that island is. */
function islandField(x, z, warp) {
  let inside = -10;
  let hills = 0;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const c = Math.cos(island.angle);
    const s = Math.sin(island.angle);
    const u = (dx * c + dz * s) / island.rx;
    const v = (-dx * s + dz * c) / island.rz;
    const e = (1 - Math.sqrt(u * u + v * v)) * Math.min(1, island.rx / 1600) + warp;
    if (e > inside) inside = e;
    hills = Math.max(hills, island.hills * smoothstep(0, 0.45, e));
  }
  for (const bay of BAYS) {
    const bite = (Math.hypot(x - bay.x, z - bay.z) / bay.radius - 1) * 0.5 + warp * 0.6;
    if (bite < inside) inside = bite;
  }
  return { inside, hills };
}

/** The untouched landform at one point: sea floor, beaches, hills and mountains. */
function landformHeight(x, z, noise) {
  const warp =
    0.17 * fractalNoise(noise.coast, x / 2100, z / 2100, 3) +
    0.08 * fractalNoise(noise.coast, x / 650 + 31.7, z / 650 - 17.2, 3) +
    0.035 * noise.coast(x / 190 - 5.1, z / 190 + 8.3);
  const { inside, hills } = islandField(x, z, warp);
  const landness = smoothstep(-0.09, 0.07, inside);
  const seaFloor = -5 - 80 * smoothstep(0, 0.4, -inside) - 5 * noise.detail(x / 800, z / 800);
  const interior = smoothstep(0.02, 0.45, inside);
  const rolling = (0.5 + 0.5 * fractalNoise(noise.hills, x / 1700, z / 1700, 5)) * 175 * hills;
  const rangeDistance = Math.hypot(x - CAIRNHOLD_RANGE.x, z - CAIRNHOLD_RANGE.z) / CAIRNHOLD_RANGE.radius;
  const rangeMask = smoothstep(1.05, 0.12, rangeDistance + 0.22 * fractalNoise(noise.hills, x / 1500 + 7.3, z / 1500 - 2.1, 3));
  const crests = ridgedNoise(noise.ridge, x / 2050, z / 2050, 6);
  const mountains = CAIRNHOLD_RANGE.height * rangeMask * rangeMask * (0.22 + 0.78 * crests);
  const bumps = 7 * fractalNoise(noise.detail, x / 260, z / 260, 3) * interior;
  const land = 2.2 + 15 * smoothstep(0, 0.22, inside) + rolling * interior + mountains * smoothstep(0.06, 0.5, inside) + bumps;
  return lerp(seaFloor, land, landness);
}

/** The Silverrun's course: a meandering line from its spring in the Cairnhold foothills to the sea. */
function traceRiverCourse(seed) {
  const random = createRandom(subSeed(seed, 'silverrun'));
  const { sourceX, sourceZ, mouthX, mouthZ } = SILVERRUN_RIVER;
  const dx = mouthX - sourceX;
  const dz = mouthZ - sourceZ;
  const span = Math.hypot(dx, dz);
  const nx = -dz / span;
  const nz = dx / span;
  const phase = random.range(0, Math.PI * 2);
  const wobble = random.range(2.6, 3.4);
  const points = [];
  const samples = 120;
  for (let k = 0; k <= samples + 8; k++) {
    const s = k / samples;
    const meander = Math.sin(s * Math.PI * wobble + phase) * 240 * Math.sin(Math.PI * Math.min(1, s)) + Math.sin(s * 23.0 + phase) * 22;
    points.push({ x: sourceX + dx * s + nx * meander, z: sourceZ + dz * s + nz * meander, s: Math.min(1, s) });
  }
  return points;
}

/** Cuts the river channel and its valley into the heightfield; returns the course with water levels. */
function carveRiver(heights, course, sample) {
  let lowest = Infinity;
  const spring = sample(course[0].x, course[0].z);
  for (const point of course) {
    const ground = sample(point.x, point.z);
    lowest = Math.min(lowest, ground);
    const profile = lerp(spring - 18, -0.35, Math.pow(point.s, 0.75));
    point.surface = Math.max(-0.35, Math.min(profile, lowest - 5));
    point.halfWidth = lerp(4, 18, Math.pow(point.s, 0.8));
  }
  for (let k = 0; k < course.length - 1; k++) {
    const a = course[k];
    const b = course[k + 1];
    const valley = lerp(240, 420, a.s);
    const minI = Math.max(0, Math.floor((Math.min(a.x, b.x) - valley + HALF) / CELL_SIZE));
    const maxI = Math.min(GRID_CELLS, Math.ceil((Math.max(a.x, b.x) + valley + HALF) / CELL_SIZE));
    const minJ = Math.max(0, Math.floor((Math.min(a.z, b.z) - valley + HALF) / CELL_SIZE));
    const maxJ = Math.min(GRID_CELLS, Math.ceil((Math.max(a.z, b.z) + valley + HALF) / CELL_SIZE));
    const sx = b.x - a.x;
    const sz = b.z - a.z;
    const segment = sx * sx + sz * sz || 1;
    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const x = -HALF + i * CELL_SIZE;
        const z = -HALF + j * CELL_SIZE;
        const t = clamp(((x - a.x) * sx + (z - a.z) * sz) / segment, 0, 1);
        const d = Math.hypot(x - (a.x + sx * t), z - (a.z + sz * t));
        if (d > valley) continue;
        const surface = lerp(a.surface, b.surface, t);
        const halfWidth = lerp(a.halfWidth, b.halfWidth, t);
        let target;
        if (d < halfWidth) target = surface - 0.8 - 3.2 * (1 - (d / halfWidth) ** 2);
        else {
          const bank = (d - halfWidth) / (valley - halfWidth);
          target = surface + 0.7 + 18 * bank + 260 * bank * bank * bank;
        }
        const index = j * SIDE + i;
        if (heights[index] > target) heights[index] = target;
      }
    }
  }
  return course;
}

/** Levels each runway (and a wide apron around it) to its published elevation. */
function levelAirfields(heights) {
  for (const field of AIRFIELDS) {
    const h = (field.heading * Math.PI) / 180;
    const along = [Math.sin(h), -Math.cos(h)];
    const across = [Math.cos(h), Math.sin(h)];
    const halfLength = field.length / 2 + 240;
    const halfWidth = field.width / 2 + 150;
    const fade = 320;
    const reach = halfLength + fade;
    const minI = Math.max(0, Math.floor((field.x - reach + HALF) / CELL_SIZE));
    const maxI = Math.min(GRID_CELLS, Math.ceil((field.x + reach + HALF) / CELL_SIZE));
    const minJ = Math.max(0, Math.floor((field.z - reach + HALF) / CELL_SIZE));
    const maxJ = Math.min(GRID_CELLS, Math.ceil((field.z + reach + HALF) / CELL_SIZE));
    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const dx = -HALF + i * CELL_SIZE - field.x;
        const dz = -HALF + j * CELL_SIZE - field.z;
        const u = Math.abs(dx * along[0] + dz * along[1]);
        const v = Math.abs(dx * across[0] + dz * across[1]);
        const outside = Math.hypot(Math.max(0, u - halfLength), Math.max(0, v - halfWidth));
        const weight = 1 - smoothstep(0, fade, outside);
        if (weight <= 0) continue;
        const index = j * SIDE + i;
        heights[index] = lerp(heights[index], field.elevation, weight);
      }
    }
  }
}

/** Softens the ground under each town so streets and roofs sit on gentle slopes. */
function settleTowns(heights) {
  const copy = heights.slice();
  for (const town of TOWNS) {
    const reach = town.radius * 1.5;
    const minI = Math.max(1, Math.floor((town.x - reach + HALF) / CELL_SIZE));
    const maxI = Math.min(GRID_CELLS - 1, Math.ceil((town.x + reach + HALF) / CELL_SIZE));
    const minJ = Math.max(1, Math.floor((town.z - reach + HALF) / CELL_SIZE));
    const maxJ = Math.min(GRID_CELLS - 1, Math.ceil((town.z + reach + HALF) / CELL_SIZE));
    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const d = Math.hypot(-HALF + i * CELL_SIZE - town.x, -HALF + j * CELL_SIZE - town.z);
        const weight = 0.75 * (1 - smoothstep(town.radius * 0.6, reach, d));
        if (weight <= 0) continue;
        let sum = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) sum += copy[(j + dj) * SIDE + i + di];
        const index = j * SIDE + i;
        heights[index] = lerp(copy[index], Math.max(sum / 9, 1.6), weight);
      }
    }
  }
}

/** Builds the Skerrywind Isles from a seed. The result answers height, normal and slope queries. */
export function generateArchipelago(seed) {
  const noise = {
    coast: createGradientNoise(subSeed(seed, 'coast')),
    hills: createGradientNoise(subSeed(seed, 'hills')),
    ridge: createGradientNoise(subSeed(seed, 'ridge')),
    detail: createGradientNoise(subSeed(seed, 'detail')),
  };
  const heights = new Float32Array(SIDE * SIDE);
  for (let j = 0; j < SIDE; j++) {
    for (let i = 0; i < SIDE; i++) heights[j * SIDE + i] = landformHeight(-HALF + i * CELL_SIZE, -HALF + j * CELL_SIZE, noise);
  }
  const terrain = createTerrainQueries(heights);
  terrain.seed = seed;
  terrain.river = carveRiver(heights, traceRiverCourse(seed), (x, z) => terrain.heightAt(x, z));
  levelAirfields(heights);
  settleTowns(heights);
  return terrain;
}

/** Height, normal and slope lookups over a heightfield, matching the rendered triangles exactly. */
export function createTerrainQueries(heights) {
  const cellOf = (x, z) => {
    const gx = clamp((x + HALF) / CELL_SIZE, 0, GRID_CELLS - 1e-4);
    const gz = clamp((z + HALF) / CELL_SIZE, 0, GRID_CELLS - 1e-4);
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    return { i, j, fx: gx - i, fz: gz - j };
  };
  const heightAt = (x, z) => {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return DEEP_SEA;
    const { i, j, fx, fz } = cellOf(x, z);
    const h00 = heights[j * SIDE + i];
    const h10 = heights[j * SIDE + i + 1];
    const h01 = heights[(j + 1) * SIDE + i];
    const h11 = heights[(j + 1) * SIDE + i + 1];
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  };
  const normalAt = (x, z) => {
    const e = CELL_SIZE;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    return [-dx / l, (2 * e) / l, -dz / l];
  };
  const slopeAt = (x, z) => {
    const n = normalAt(x, z);
    return Math.sqrt(1 - n[1] * n[1]) / Math.max(n[1], 1e-3);
  };
  /** Ground or water surface below a point, and whether it is water. */
  const surfaceAt = (x, z) => {
    const ground = heightAt(x, z);
    return ground < SEA_LEVEL ? { height: SEA_LEVEL, water: true, ground } : { height: ground, water: false, ground };
  };
  return { size: WORLD_SIZE, cells: GRID_CELLS, cellSize: CELL_SIZE, side: SIDE, half: HALF, heights, heightAt, normalAt, slopeAt, surfaceAt };
}
