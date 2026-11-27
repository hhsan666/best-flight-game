// Windsocks beside each runway: an orange and white sock on a pole that swings to point downwind
// and lifts from a droop to straight out as the wind builds toward 15 knots.
import { MeshBuilder, MATTE, GLOSS } from './mesh-builder.js';
import { uploadMesh, drawMesh } from './mesh-renderer.js';
import { mat4FromPose, quatFromAttitude, quatFromAxisAngle } from '../core/vector-math.js';
import { runwayEnds } from '../world/landmarks.js';
import { KNOTS } from '../flight/aircraft-spec.js';

const POLE_HEIGHT = 6.2;
const ORANGE = [0.96, 0.42, 0.1, MATTE];
const WHITE = [0.95, 0.94, 0.9, MATTE];

function poleMesh() {
  const b = new MeshBuilder();
  b.cylinder(0.07, 0.05, 0, POLE_HEIGHT, 6, [0.62, 0.64, 0.66, GLOSS]);
  b.cylinder(0.46, 0.46, POLE_HEIGHT - 0.05, POLE_HEIGHT + 0.05, 10, [0.3, 0.31, 0.33, MATTE]);
  return b.build();
}

/** Five tapering bands built along the sock's own axis, which the pose turns downwind. */
function sockMesh() {
  const b = new MeshBuilder();
  b.withFrame(quatFromAxisAngle([1, 0, 0], -Math.PI / 2), [0, 0, 0], () => {
    for (let i = 0; i < 5; i++) {
      const r0 = 0.44 - i * 0.05;
      b.cylinder(r0, r0 - 0.05, i * 0.62, (i + 1) * 0.62, 10, i % 2 ? WHITE : ORANGE, { caps: false });
    }
  });
  return b.build();
}

/** Where each airfield's sock stands: abeam the touchdown zone of runway end 0, clear of the strip. */
function sockSites(airfields, terrain) {
  return airfields.map((field) => {
    const [low] = runwayEnds(field);
    const h = (low.heading * Math.PI) / 180;
    const along = [Math.sin(h), -Math.cos(h)];
    const across = [Math.cos(h), Math.sin(h)];
    const side = field.width / 2 + 42;
    const x = low.x + along[0] * 220 - across[0] * side;
    const z = low.z + along[1] * 220 - across[1] * side;
    return [x, Math.max(terrain.heightAt(x, z), field.elevation), z];
  });
}

export function createWindsockRenderer(gl, program, airfields, terrain) {
  const pole = uploadMesh(gl, poleMesh());
  const sock = uploadMesh(gl, sockMesh());
  const sites = sockSites(airfields, terrain);
  return {
    /** `wind` is the wind vector in metres per second where the aircraft is. */
    draw(frame, wind) {
      const w = wind ?? [0, 0, 0];
      const knots = Math.hypot(w[0], w[2]) * KNOTS;
      const lift = Math.min(1, knots / 15);
      const to = Math.atan2(w[0], -w[2]);
      const flutter = Math.sin(frame.time * 3.1) * 0.05 * Math.min(1, knots / 5);
      const droop = (-(1 - lift) * 70 * Math.PI) / 180 + Math.sin(frame.time * 4.3) * 0.03 * lift;
      for (const site of sites) {
        drawMesh(gl, program, pole, { model: mat4FromPose([0, 0, 0, 1], site, 1), grounded: true });
        const top = [site[0], site[1] + POLE_HEIGHT, site[2]];
        drawMesh(gl, program, sock, { model: mat4FromPose(quatFromAttitude(to + flutter, droop, 0), top, 1), grounded: true });
      }
    },
  };
}
