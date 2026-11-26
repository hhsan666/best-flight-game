// The aircraft's shadow: a soft airplane silhouette cast along the sun onto the ground or sea,
// fading with height. It tells the pilot how high the wheels are in the last seconds of a landing.
import { createProgram, createVertexArray, refillBuffer } from './gl-utils.js';
import { SHADOW_VERTEX, SHADOW_FRAGMENT } from './shaders.js';
import { attitudeOf } from '../core/vector-math.js';

export function createAircraftShadow(gl, terrain) {
  const program = createProgram(gl, SHADOW_VERTEX, SHADOW_FRAGMENT, 'shadow');
  const positions = new Float32Array(12);
  const mesh = createVertexArray(gl, [
    { name: 'p', location: 0, data: positions, size: 3, usage: gl.DYNAMIC_DRAW },
    { location: 1, data: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), size: 2 },
  ], new Uint16Array([0, 1, 2, 0, 2, 3]));

  return {
    draw(frame, plane) {
      const sun = frame.atmosphere.sunDirection;
      const p = plane.position;
      let ground = Math.max(terrain.heightAt(p[0], p[2]), 0);
      const height = p[1] - ground;
      if (height > 260 || sun[1] < 0.08) return;
      const reach = height / sun[1];
      const cx = p[0] - sun[0] * reach;
      const cz = p[2] - sun[2] * reach;
      ground = Math.max(terrain.heightAt(cx, cz), 0) + 0.25;
      const { heading } = attitudeOf(plane.orientation);
      const fx = Math.sin(heading);
      const fz = -Math.cos(heading);
      const half = 5.1;
      const corner = (u, v) => [cx + fz * -u * half + fx * v * half, ground, cz + fx * u * half + fz * v * half];
      positions.set([...corner(-1, 1), ...corner(1, 1), ...corner(1, -1), ...corner(-1, -1)]);
      refillBuffer(gl, mesh.buffers.p, positions);
      gl.useProgram(program.program);
      gl.uniformMatrix4fv(program.u.uViewProj, false, frame.camera.viewProj);
      gl.uniform1f(program.u.uStrength, 0.45 * (1 - height / 260) * Math.min(1, sun[1] * 3));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-4, -8);
      gl.depthMask(false);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.disable(gl.BLEND);
    },
  };
}
