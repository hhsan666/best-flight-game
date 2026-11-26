// The sea out to the horizon and the Silverrun river ribbon. Both use one shader that reads the
// terrain heightfield for depth: turquoise shallows, deep blue water, surf on the beaches.
import { createProgram, createVertexArray, createHeightTexture, setAtmosphereUniforms } from './gl-utils.js';
import { WATER_VERTEX, WATER_FRAGMENT } from './shaders.js';

const SEA_REACH = 45000;

function riverRibbon(course) {
  const positions = [];
  const indices = [];
  for (let k = 0; k < course.length; k++) {
    const a = course[Math.max(0, k - 1)];
    const b = course[Math.min(course.length - 1, k + 1)];
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l;
    const nz = tx / l;
    const w = course[k].halfWidth + 3;
    const y = course[k].surface + 0.05;
    positions.push(course[k].x + nx * w, y, course[k].z + nz * w, course[k].x - nx * w, y, course[k].z - nz * w);
    if (k > 0) {
      const i = k * 2;
      indices.push(i - 2, i - 1, i, i, i - 1, i + 1);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

export function createWaterRenderer(gl, terrain) {
  const program = createProgram(gl, WATER_VERTEX, WATER_FRAGMENT, 'water');
  const heightTexture = createHeightTexture(gl, terrain.heights, terrain.side);
  const r = SEA_REACH;
  const sea = createVertexArray(gl, [{ location: 0, data: new Float32Array([-r, 0, -r, r, 0, -r, r, 0, r, -r, 0, r]), size: 3 }], new Uint16Array([0, 3, 1, 1, 3, 2]));
  const ribbon = riverRibbon(terrain.river);
  const river = createVertexArray(gl, [{ location: 0, data: ribbon.positions, size: 3 }], ribbon.indices);

  return {
    draw(frame) {
      gl.useProgram(program.program);
      setAtmosphereUniforms(gl, program, frame);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, heightTexture);
      gl.uniform1i(program.u.uHeightMap, 0);
      gl.uniform1f(program.u.uWorldHalf, terrain.half);
      gl.uniform1f(program.u.uWorldSize, terrain.size);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(program.u.uFlow, 0);
      gl.bindVertexArray(sea.vao);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      gl.uniform1f(program.u.uFlow, 3);
      gl.bindVertexArray(river.vao);
      gl.drawElements(gl.TRIANGLES, ribbon.indices.length, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    },
  };
}
