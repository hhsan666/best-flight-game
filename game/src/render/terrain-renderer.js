// Draws the archipelago's ground: one vertex grid with per-vertex surface masks (farmland, forest
// floor, town paving, river banks), split into chunks so only what the camera sees is drawn.
import { createProgram, createVertexArray, setAtmosphereUniforms } from './gl-utils.js';
import { TERRAIN_VERTEX, TERRAIN_FRAGMENT } from './shaders.js';
import { boxInFrustum } from '../core/vector-math.js';
import { createGradientNoise, fractalNoise, smoothstep } from '../core/noise.js';
import { subSeed } from '../core/seeded-random.js';
import { TOWNS, AIRFIELDS } from '../world/landmarks.js';

const CHUNK_CELLS = 32;

/** Per-vertex surface masks: x farmland, y forest floor, z paved ground, w wet river bank. */
function surfaceMasks(terrain, forestDensity, seed) {
  const { side, half, cellSize, heights } = terrain;
  const masks = new Float32Array(side * side * 4);
  const patch = createGradientNoise(subSeed(seed, 'fields'));
  const river = terrain.river;
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const x = -half + i * cellSize;
      const z = -half + j * cellSize;
      const h = heights[j * side + i];
      const k = (j * side + i) * 4;
      if (h < -2) continue;
      let farm = 0;
      let paved = 0;
      for (const town of TOWNS) {
        const d = Math.hypot(x - town.x, z - town.z);
        farm = Math.max(farm, smoothstep(town.radius * 3.4, town.radius * 1.2, d));
        paved = Math.max(paved, smoothstep(town.radius * 0.95, town.radius * 0.45, d));
      }
      for (const field of AIRFIELDS) farm = Math.max(farm, 0.7 * smoothstep(1900, 900, Math.hypot(x - field.x, z - field.z)));
      const flatness = 1 - smoothstep(0.12, 0.25, terrain.slopeAt(x, z));
      farm *= flatness * smoothstep(3, 6, h) * (1 - smoothstep(140, 220, h)) * smoothstep(-0.25, 0.1, fractalNoise(patch, x / 700, z / 700, 3));
      const forest = forestDensity(x, z);
      let wet = 0;
      if (h < 700) {
        for (let r = 0; r < river.length; r += 2) {
          const d = Math.hypot(x - river[r].x, z - river[r].z) - river[r].halfWidth;
          if (d < 60) wet = Math.max(wet, 1 - smoothstep(0, 45, d));
        }
      }
      masks[k] = farm * (1 - forest);
      masks[k + 1] = forest;
      masks[k + 2] = paved;
      masks[k + 3] = wet * 0.8;
    }
  }
  return masks;
}

export function createTerrainRenderer(gl, terrain, forestDensity, seed) {
  const program = createProgram(gl, TERRAIN_VERTEX, TERRAIN_FRAGMENT, 'terrain');
  const { side, half, cellSize, heights, cells } = terrain;
  const positions = new Float32Array(side * side * 3);
  const normals = new Float32Array(side * side * 3);
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      const k = j * side + i;
      positions[k * 3] = -half + i * cellSize;
      positions[k * 3 + 1] = heights[k];
      positions[k * 3 + 2] = -half + j * cellSize;
      const hl = heights[j * side + Math.max(0, i - 1)];
      const hr = heights[j * side + Math.min(cells, i + 1)];
      const hd = heights[Math.max(0, j - 1) * side + i];
      const hu = heights[Math.min(cells, j + 1) * side + i];
      const nx = hl - hr;
      const nz = hd - hu;
      const ny = 2 * cellSize;
      const l = Math.hypot(nx, ny, nz);
      normals[k * 3] = nx / l;
      normals[k * 3 + 1] = ny / l;
      normals[k * 3 + 2] = nz / l;
    }
  }
  const masks = surfaceMasks(terrain, forestDensity, seed);
  const chunks = [];
  const indexList = [];
  for (let cj = 0; cj < cells; cj += CHUNK_CELLS) {
    for (let ci = 0; ci < cells; ci += CHUNK_CELLS) {
      const offset = indexList.length;
      let low = Infinity;
      let high = -Infinity;
      for (let j = cj; j < Math.min(cells, cj + CHUNK_CELLS); j++) {
        for (let i = ci; i < Math.min(cells, ci + CHUNK_CELLS); i++) {
          const a = j * side + i;
          const b = a + 1;
          const c = a + side;
          const d = c + 1;
          indexList.push(a, c, b, b, c, d);
          low = Math.min(low, heights[a], heights[b], heights[c], heights[d]);
          high = Math.max(high, heights[a], heights[b], heights[c], heights[d]);
        }
      }
      chunks.push({
        offset, count: indexList.length - offset,
        min: [-half + ci * cellSize, low, -half + cj * cellSize],
        max: [-half + Math.min(cells, ci + CHUNK_CELLS) * cellSize, high, -half + Math.min(cells, cj + CHUNK_CELLS) * cellSize],
      });
    }
  }
  const mesh = createVertexArray(gl, [
    { location: 0, data: positions, size: 3 },
    { location: 1, data: normals, size: 3 },
    { location: 2, data: masks, size: 4 },
  ], new Uint32Array(indexList));

  return {
    draw(frame) {
      gl.useProgram(program.program);
      setAtmosphereUniforms(gl, program, frame);
      gl.uniform1f(program.u.uSnowLine, frame.atmosphere.snowLine);
      gl.bindVertexArray(mesh.vao);
      for (const chunk of chunks) {
        if (chunk.max[1] < -6 && frame.camera.position[1] > 60) continue;
        if (!boxInFrustum(frame.camera.planes, chunk.min, chunk.max)) continue;
        gl.drawElements(gl.TRIANGLES, chunk.count, gl.UNSIGNED_INT, chunk.offset * 4);
      }
      gl.bindVertexArray(null);
    },
  };
}
