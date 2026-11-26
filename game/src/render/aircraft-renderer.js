// Draws the Saltrunner at its flight-model pose with live control surfaces, a spinning propeller
// (blades when slow, a translucent disc when fast), and its navigation, strobe and beacon lights.
import { buildAircraftParts } from './aircraft-model.js';
import { uploadMesh, drawMesh } from './mesh-renderer.js';
import { MeshBuilder, MATTE } from './mesh-builder.js';
import { mat4FromPose, mat4Multiply, quatFromAxisAngle, quatRotate, add, sub } from '../core/vector-math.js';
import { SALTRUNNER } from '../flight/aircraft-spec.js';

const MAX_AILERON = 0.36;
const MAX_ELEVATOR = 0.38;
const MAX_RUDDER = 0.42;
const FLAP_ANGLES = [0, 0.26, 0.6];

function hingeMatrix(part, angle) {
  const signed = part.axis[0] < -0.5 ? -angle : angle;
  const q = quatFromAxisAngle(part.axis, signed);
  return mat4FromPose(q, sub(part.pivot, quatRotate(q, part.pivot)));
}

function discMesh() {
  const b = new MeshBuilder();
  const ring = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return [Math.cos(a) * 0.93, Math.sin(a) * 0.93, 0];
  });
  b.polygon(ring, [0.2, 0.2, 0.22, MATTE]);
  return b.build();
}

export function createAircraftRenderer(gl, program) {
  const parts = buildAircraftParts();
  const meshes = {};
  for (const [name, part] of Object.entries(parts)) {
    if (part.positions) meshes[name] = uploadMesh(gl, part);
    else if (part.mesh) meshes[name] = uploadMesh(gl, part.mesh);
  }
  const disc = uploadMesh(gl, discMesh());

  return {
    /** Opaque pass: airframe and moving surfaces (from the cockpit, without the canopy and crew). */
    draw(frame, plane, cockpit = false) {
      const model = mat4FromPose(plane.orientation, plane.position);
      const c = plane.controls;
      drawMesh(gl, program, meshes.body, { model });
      if (!cockpit) drawMesh(gl, program, meshes.cabin, { model });
      const deflect = (name, angle) => drawMesh(gl, program, meshes[name], { model: mat4Multiply(model, hingeMatrix(parts[name], angle)) });
      deflect('aileronLeft', c.roll * MAX_AILERON);
      deflect('aileronRight', -c.roll * MAX_AILERON);
      const flap = FLAP_ANGLES[c.flaps] ?? 0;
      deflect('flapLeft', flap);
      deflect('flapRight', flap);
      deflect('elevatorLeft', -c.pitch * MAX_ELEVATOR);
      deflect('elevatorRight', -c.pitch * MAX_ELEVATOR);
      deflect('rudder', c.yaw * MAX_RUDDER);
      if (plane.engine.rpm < 1100) {
        const spin = mat4FromPose(quatFromAxisAngle([0, 0, 1], plane.engine.propAngle), parts.propellerHub);
        drawMesh(gl, program, meshes.propeller, { model: mat4Multiply(model, spin) });
      }
    },
    /** Blended pass: the propeller disc once the blades blur. */
    drawBlended(frame, plane, cockpit = false) {
      if (plane.engine.rpm < 1100) return;
      const model = mat4Multiply(mat4FromPose(plane.orientation, plane.position), mat4FromPose([0, 0, 0, 1], add(parts.propellerHub, [0, 0, -0.02])));
      drawMesh(gl, program, disc, { model, alpha: cockpit ? 0.1 : 0.28 });
    },
    /** Navigation lights, strobes and beacon as glow sprites. */
    emitLights(sprites, plane, time) {
      const at = (p) => add(plane.position, quatRotate(plane.orientation, p));
      const L = SALTRUNNER.lights;
      sprites.light(at(L.left), [1, 0.12, 0.08], 0.38, 1.0);
      sprites.light(at(L.right), [0.1, 1, 0.25], 0.38, 1.0);
      sprites.light(at(L.tail), [1, 1, 1], 0.3, 0.8);
      const strobe = time % 1.2 < 0.06 ? 1 : 0;
      if (strobe) {
        sprites.light(at(L.left), [1, 1, 1], 0.7, 0.9);
        sprites.light(at(L.right), [1, 1, 1], 0.7, 0.9);
      }
      const beacon = 0.5 + 0.5 * Math.sin(time * 6.0);
      sprites.light(at(L.beacon), [1, 0.15, 0.05], 0.35 + beacon * 0.35, beacon);
      if (plane.landingLight) sprites.light(at(L.landing), [1, 0.96, 0.85], 1.3, 1.4);
    },
  };
}
