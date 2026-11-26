// Cumulus clouds as clusters of soft billboard puffs, sunlit on top and shaded below, sorted back
// to front each frame. The puff texture is painted once at start-up from overlapping gradients.
import { createProgram, createTextureFromCanvas, setAtmosphereUniforms } from './gl-utils.js';
import { CLOUD_VERTEX, CLOUD_FRAGMENT } from './shaders.js';
import { createRandom, subSeed } from '../core/seeded-random.js';

function paintPuff() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const random = createRandom(4242);
  for (let i = 0; i < 18; i++) {
    const r = random.range(18, 40);
    const x = 64 + random.range(-28, 28);
    const y = 64 + random.range(-20, 20);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** Seeded cloud field: clusters of puffs at a cumulus base between 650 and 1150 m. */
function scatterClouds(seed, cover, size) {
  const random = createRandom(subSeed(seed, 'clouds'));
  const puffs = [];
  const clusters = Math.round(14 + cover * 46);
  for (let c = 0; c < clusters; c++) {
    const cx = random.range(-size * 0.75, size * 0.75);
    const cz = random.range(-size * 0.75, size * 0.75);
    const base = random.range(650, 1150);
    const width = random.range(260, 640);
    const count = random.int(7, 15);
    for (let i = 0; i < count; i++) {
      const u = random.signed();
      const v = random.signed();
      const lift = random.next();
      puffs.push({
        x: cx + u * width * 0.5, y: base + lift * width * 0.28, z: cz + v * width * 0.35,
        size: random.range(90, 190) * (1 - Math.abs(u) * 0.35),
        shade: 0.35 + lift * 0.65, alpha: random.range(0.55, 0.9), spin: random.range(0, Math.PI * 2),
      });
    }
  }
  return puffs;
}

export function createCloudRenderer(gl, seed, worldSize) {
  const program = createProgram(gl, CLOUD_VERTEX, CLOUD_FRAGMENT, 'clouds');
  const texture = createTextureFromCanvas(gl, paintPuff(), { repeat: false });
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const corner = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corner);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const instanceBuffers = [1, 2].map((location) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(location, 1);
    return buffer;
  });
  gl.bindVertexArray(null);
  let puffs = [];
  let cover = -1;

  return {
    setCover(value) {
      if (value === cover) return;
      cover = value;
      puffs = scatterClouds(seed, value, worldSize);
    },
    draw(frame) {
      if (puffs.length === 0) return;
      const eye = frame.camera.position;
      const order = puffs.map((p) => ({ p, d: (p.x - eye[0]) ** 2 + (p.y - eye[1]) ** 2 + (p.z - eye[2]) ** 2 })).sort((a, b) => b.d - a.d);
      const placement = new Float32Array(order.length * 4);
      const shading = new Float32Array(order.length * 4);
      order.forEach(({ p }, i) => {
        placement.set([p.x + frame.time * 1.5, p.y, p.z, p.size], i * 4);
        shading.set([p.shade, p.alpha, p.spin, 0], i * 4);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffers[0]);
      gl.bufferData(gl.ARRAY_BUFFER, placement, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffers[1]);
      gl.bufferData(gl.ARRAY_BUFFER, shading, gl.DYNAMIC_DRAW);
      gl.useProgram(program.program);
      setAtmosphereUniforms(gl, program, frame);
      gl.uniform3fv(program.u.uCameraRight, frame.camera.right);
      gl.uniform3fv(program.u.uCameraUp, frame.camera.up);
      gl.uniform1f(program.u.uCloudiness, frame.atmosphere.clouds);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(program.u.uPuff, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, order.length);
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    },
  };
}
