// The sky dome as one full-screen triangle: horizon-to-zenith gradient, sun disc and glow, and a
// scatter of stars once the sun is down.
import { createProgram, setAtmosphereUniforms } from './gl-utils.js';
import { SKY_VERTEX, SKY_FRAGMENT } from './shaders.js';

export function createSkyRenderer(gl) {
  const program = createProgram(gl, SKY_VERTEX, SKY_FRAGMENT, 'sky');
  const vao = gl.createVertexArray();
  return {
    draw(frame) {
      gl.useProgram(program.program);
      setAtmosphereUniforms(gl, program, frame);
      gl.uniformMatrix4fv(program.u.uInvViewProj, false, frame.camera.invViewProj);
      gl.depthMask(false);
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    },
  };
}
