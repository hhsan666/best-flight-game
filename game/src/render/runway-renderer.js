// Runways with painted markings (threshold bars, designators, centreline, touchdown and aiming
// points) drawn into a canvas texture, plus edge, threshold and approach lights and a PAPI whose
// four lights turn red or white from the pilot's actual approach angle.
import { createProgram, createVertexArray, createTextureFromCanvas, setAtmosphereUniforms } from './gl-utils.js';
import { SURFACE_VERTEX, SURFACE_FRAGMENT } from './shaders.js';
import { runwayEnds } from '../world/landmarks.js';
import { createRandom } from '../core/seeded-random.js';

const PX_PER_M_ACROSS = 4;
const PX_PER_M_ALONG = 2.2;
const PAPI_ANGLES = [3.5, 3.17, 2.83, 2.5];

function paintRunway(field, ends) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((field.width + 8) * PX_PER_M_ACROSS);
  canvas.height = Math.min(4096, Math.round(field.length * PX_PER_M_ALONG));
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const ay = H / field.length;
  const ax = PX_PER_M_ACROSS;
  const cx = W / 2;
  ctx.fillStyle = '#5f6a52';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#3b3d40';
  ctx.fillRect(4 * ax, 0, field.width * ax, H);
  const random = createRandom(field.length);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(${random.chance(0.5) ? '255,255,255' : '0,0,0'},${random.range(0.03, 0.09)})`;
    ctx.fillRect(4 * ax + random.range(0, field.width * ax), random.range(0, H), random.range(1, 3), random.range(1, 4));
  }
  ctx.fillStyle = 'rgba(20,20,22,0.35)';
  for (const end of [0, 1]) {
    for (let k = 0; k < 40; k++) {
      const y = (end ? field.length - random.range(150, 600) : random.range(150, 600)) * ay;
      ctx.fillRect(cx + random.range(-6, 6) * ax, y, random.range(2, 5), random.range(20, 80));
    }
  }
  const white = '#e9e8e2';
  ctx.fillStyle = white;
  const stripe = (u0, u1, v0, v1) => ctx.fillRect(cx + u0 * ax, v0 * ay, (u1 - u0) * ax, (v1 - v0) * ay);
  const mirrorV = (v) => field.length - v;
  stripe(-field.width / 2 + 0.6, -field.width / 2 + 1.5, 0, field.length);
  stripe(field.width / 2 - 1.5, field.width / 2 - 0.6, 0, field.length);
  for (const [lowEnd, sign] of [[true, 1], [false, -1]]) {
    const at = (v) => (lowEnd ? v : mirrorV(v));
    const span = (a, b) => [Math.min(at(a), at(b)), Math.max(at(a), at(b))];
    const bars = Math.floor(field.width / 4);
    for (let i = 0; i < bars; i++) {
      const u = -field.width / 2 + 2 + i * ((field.width - 4) / bars);
      if (Math.abs(u + 0.9) < 1.5) continue;
      stripe(u, u + 1.8, ...span(6, 36));
    }
    for (const d of [150, 450, 600]) for (const s of [-1, 1]) stripe(s > 0 ? 4 : -7, s > 0 ? 7 : -4, ...span(d, d + 22));
    for (const s of [-1, 1]) stripe(s > 0 ? 3.5 : -8.5, s > 0 ? 8.5 : -3.5, ...span(300, 345));
    const label = (lowEnd ? ends[0] : ends[1]).name;
    ctx.save();
    ctx.translate(cx, at(46) * ay);
    ctx.scale(sign > 0 ? ax : -ax, sign > 0 ? -ay : ay);
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  for (let v = 80; v < field.length - 80; v += 50) stripe(-0.45, 0.45, v, v + 30);
  return canvas;
}

export function createRunwayRenderer(gl, airfields, terrain) {
  const program = createProgram(gl, SURFACE_VERTEX, SURFACE_FRAGMENT, 'runway');
  const strips = airfields.map((field) => {
    const ends = runwayEnds(field);
    const h = (field.heading * Math.PI) / 180;
    const along = [Math.sin(h), 0, -Math.cos(h)];
    const across = [Math.cos(h), 0, Math.sin(h)];
    const half = (field.width + 8) / 2;
    const y = field.elevation + 0.06;
    const corner = (e, s) => [ends[e].x + across[0] * s, y, ends[e].z + across[2] * s];
    const positions = new Float32Array([...corner(0, -half), ...corner(0, half), ...corner(1, half), ...corner(1, -half)]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const mesh = createVertexArray(gl, [{ location: 0, data: positions, size: 3 }, { location: 1, data: uvs, size: 2 }], new Uint16Array([0, 2, 1, 0, 3, 2]));
    return { field, ends, along, across, mesh, texture: createTextureFromCanvas(gl, paintRunway(field, ends), { repeat: false }) };
  });

  /** Elevation angle (degrees) from a PAPI box to a point, and which lights show white. */
  const papiLights = (strip, endIndex, eye) => {
    const end = strip.ends[endIndex];
    const dir = endIndex === 0 ? strip.along : strip.along.map((v) => -v);
    const side = endIndex === 0 ? -1 : 1;
    const base = [end.x + dir[0] * 300 + strip.across[0] * side * (strip.field.width / 2 + 15), strip.field.elevation + 0.8, end.z + dir[2] * 300 + strip.across[2] * side * (strip.field.width / 2 + 15)];
    const dx = eye[0] - base[0];
    const dz = eye[2] - base[2];
    const ahead = -(dx * dir[0] + dz * dir[2]);
    const angle = (Math.atan2(eye[1] - base[1], Math.max(1, ahead)) * 180) / Math.PI;
    return PAPI_ANGLES.map((setting, i) => ({
      at: [base[0] + strip.across[0] * side * i * 9, base[1], base[2] + strip.across[2] * side * i * 9],
      white: angle > setting,
      facing: ahead > 0,
    }));
  };

  return {
    strips,
    papiLights,
    draw(frame) {
      gl.useProgram(program.program);
      setAtmosphereUniforms(gl, program, frame);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-2, -4);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (const strip of strips) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, strip.texture);
        gl.uniform1i(program.u.uSurfaceTexture, 0);
        gl.bindVertexArray(strip.mesh.vao);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    },
    /** Edge, threshold, end and approach lights, plus each PAPI as seen from `eye`. */
    emitLights(sprites, eye, night, time) {
      const strength = 0.55 + night * 0.9;
      for (const strip of strips) {
        const { field, ends, along, across } = strip;
        const y = field.elevation + 0.5;
        for (let v = 0; v <= field.length; v += 60) {
          for (const s of [-1, 1]) {
            sprites.light([ends[0].x + along[0] * v + across[0] * s * (field.width / 2 + 1.5), y, ends[0].z + along[2] * v + across[2] * s * (field.width / 2 + 1.5)], [1, 0.95, 0.8], 0.9, strength * 0.8);
          }
        }
        for (let e = 0; e < 2; e++) {
          const dir = e === 0 ? along : along.map((v) => -v);
          for (let u = -field.width / 2; u <= field.width / 2 + 0.1; u += field.width / 7) {
            sprites.light([ends[e].x + across[0] * u - dir[0] * 2, y, ends[e].z + across[2] * u - dir[2] * 2], [0.2, 1, 0.35], 1.0, strength);
          }
          for (let d = 30; d <= 300; d += 30) {
            const px = ends[e].x - dir[0] * d;
            const pz = ends[e].z - dir[2] * d;
            const py = Math.max(terrain.heightAt(px, pz), 0) + 1.5;
            const rabbit = Math.floor((time * 2.2) % 1 * 10) === Math.floor((300 - d) / 30) ? 2.2 : 1;
            sprites.light([px, py, pz], [1, 0.97, 0.9], 1.1 * rabbit, strength * rabbit * 0.8);
            if (d === 150) {
              for (const s of [-1, 1]) for (let k = 1; k <= 3; k++) sprites.light([px + across[0] * s * k * 4.5, py, pz + across[2] * s * k * 4.5], [1, 0.97, 0.9], 1.0, strength * 0.8);
            }
          }
          for (const lamp of papiLights(strip, e, eye)) {
            if (!lamp.facing) continue;
            sprites.light(lamp.at, lamp.white ? [1, 1, 0.95] : [1, 0.1, 0.05], 2.6, 1.6 + night);
          }
        }
      }
    },
  };
}
