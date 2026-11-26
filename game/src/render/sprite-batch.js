// Collects point sprites each frame and draws them in two batches: glowing lights (additive:
// runway and navigation lights, ring beacons, fire) and soft particles (smoke, dust, spray).
import { createProgram, createVertexArray, refillBuffer, setAtmosphereUniforms } from './gl-utils.js';
import { SPRITE_VERTEX, SPRITE_FRAGMENT } from './shaders.js';

const CAPACITY = 6000;

function createBatch(gl) {
  const positions = new Float32Array(CAPACITY * 3);
  const colors = new Float32Array(CAPACITY * 4);
  const sizes = new Float32Array(CAPACITY);
  const mesh = createVertexArray(gl, [
    { name: 'p', location: 0, data: positions, size: 3, usage: gl.DYNAMIC_DRAW },
    { name: 'c', location: 1, data: colors, size: 4, usage: gl.DYNAMIC_DRAW },
    { name: 's', location: 2, data: sizes, size: 1, usage: gl.DYNAMIC_DRAW },
  ]);
  return { positions, colors, sizes, mesh, count: 0 };
}

export function createSpriteBatch(gl) {
  const program = createProgram(gl, SPRITE_VERTEX, SPRITE_FRAGMENT, 'sprites');
  const glow = createBatch(gl);
  const soft = createBatch(gl);
  const push = (batch, p, rgb, size, alpha) => {
    if (batch.count >= CAPACITY) return;
    const i = batch.count++;
    batch.positions.set(p, i * 3);
    batch.colors.set([rgb[0], rgb[1], rgb[2], alpha], i * 4);
    batch.sizes[i] = size;
  };
  const flush = (batch, frame, additive) => {
    if (batch.count === 0) return;
    refillBuffer(gl, batch.mesh.buffers.p, batch.positions.subarray(0, batch.count * 3));
    refillBuffer(gl, batch.mesh.buffers.c, batch.colors.subarray(0, batch.count * 4));
    refillBuffer(gl, batch.mesh.buffers.s, batch.sizes.subarray(0, batch.count));
    gl.uniform1f(program.u.uGlow, additive ? 1 : 0);
    gl.uniform1f(program.u.uMinPixels, additive ? 2.5 : 0);
    if (additive) gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(batch.mesh.vao);
    gl.drawArrays(gl.POINTS, 0, batch.count);
    gl.bindVertexArray(null);
  };

  return {
    begin() {
      glow.count = 0;
      soft.count = 0;
    },
    /** A glowing light of world-space size `size` metres. */
    light(p, rgb, size, intensity = 1) {
      push(glow, p, rgb, size, intensity);
    },
    /** A soft, sunlit particle (smoke, dust, spray). */
    puff(p, rgb, size, alpha) {
      push(soft, p, rgb, size, alpha);
    },
    draw(frame) {
      gl.useProgram(program.program);
      setAtmosphereUniforms(gl, program, frame);
      gl.uniform1f(program.u.uPixelsPerUnit, frame.camera.pixelsPerUnit);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      flush(soft, frame, false);
      flush(glow, frame, true);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    },
  };
}
