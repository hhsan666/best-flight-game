// Cameras that never fight the pilot: a chase view that eases toward the flight path and keeps
// the horizon readable (it follows only part of the bank), the same chase from over the right
// wing's shoulder, a cockpit view from the pilot's seat, and an orbit view the mouse can drag.
import {
  add, sub, scale, normalize, mix, cross, quatRotate, mat4Perspective, mat4LookAt, mat4Multiply, mat4Invert, frustumPlanes, DEG,
} from '../core/vector-math.js';
import { SALTRUNNER } from '../flight/aircraft-spec.js';

export const CAMERA_MODES = ['chase', 'quarter', 'cockpit', 'orbit'];

/** Where each chase camera sits behind the aircraft: metres back, up and to the right. */
const CHASE_OFFSETS = { chase: [11, 2.9, 0], quarter: [12.5, 3.4, 4] };

export function createCameraRig() {
  const rig = {
    mode: 'chase',
    lookDir: [0, 0, -1],
    upDir: [0, 1, 0],
    orbitYaw: 0.6,
    orbitPitch: 0.25,
    orbitDistance: 19,
    override: null,
  };

  rig.reset = (plane) => {
    rig.lookDir = quatRotate(plane.orientation, [0, 0, -1]);
    rig.upDir = [0, 1, 0];
  };

  rig.cycle = () => {
    rig.mode = CAMERA_MODES[(CAMERA_MODES.indexOf(rig.mode) + 1) % CAMERA_MODES.length];
  };

  /** Computes the camera for this frame; `terrain` keeps the chase camera above the ground. */
  rig.update = (plane, terrain, dt, viewport) => {
    let eye;
    let target;
    let up;
    let fov = 62 * DEG;
    const forward = quatRotate(plane.orientation, [0, 0, -1]);
    const planeUp = quatRotate(plane.orientation, [0, 1, 0]);
    if (rig.override) {
      ({ eye, target, up } = rig.override);
      fov = (rig.override.fov ?? 62) * DEG;
    } else if (rig.mode === 'cockpit') {
      eye = add(plane.position, quatRotate(plane.orientation, SALTRUNNER.pilotEye));
      target = add(eye, forward);
      up = planeUp;
      fov = 72 * DEG;
    } else if (rig.mode === 'orbit') {
      const c = Math.cos(rig.orbitPitch);
      const offset = [Math.sin(rig.orbitYaw) * c, Math.sin(rig.orbitPitch), Math.cos(rig.orbitYaw) * c];
      eye = add(plane.position, scale(offset, rig.orbitDistance));
      target = plane.position;
      up = [0, 1, 0];
    } else {
      const speed = Math.hypot(...plane.velocity);
      const path = speed > 8 ? normalize(plane.velocity) : forward;
      const wanted = normalize(mix(forward, path, 0.45));
      const ease = 1 - Math.exp(-dt * 3.2);
      rig.lookDir = normalize(mix(rig.lookDir, wanted, ease));
      rig.upDir = normalize(mix(rig.upDir, normalize(mix([0, 1, 0], planeUp, 0.4)), 1 - Math.exp(-dt * 2.5)));
      const [back, lift, side] = CHASE_OFFSETS[rig.mode] ?? CHASE_OFFSETS.chase;
      const right = normalize(cross(rig.lookDir, rig.upDir));
      eye = add(add(sub(plane.position, scale(rig.lookDir, back)), scale(rig.upDir, lift)), scale(right, side));
      target = add(plane.position, add(scale(rig.lookDir, 26), scale(rig.upDir, 1.9)));
      up = rig.upDir;
    }
    const ground = Math.max(terrain.heightAt(eye[0], eye[2]), 0) + 1.6;
    if (eye[1] < ground && rig.mode !== 'cockpit') eye = [eye[0], ground, eye[2]];
    const aspect = viewport.width / viewport.height;
    const near = rig.mode === 'cockpit' && !rig.override ? 0.2 : 0.6;
    const proj = mat4Perspective(fov, aspect, near, 60000);
    const view = mat4LookAt(eye, target, up);
    const viewProj = mat4Multiply(proj, view);
    const look = normalize(sub(target, eye));
    const right = normalize(cross(look, up));
    return {
      position: eye, view, proj, viewProj, invViewProj: mat4Invert(viewProj), planes: frustumPlanes(viewProj),
      forward: look, right, up: cross(right, look), fov, aspect, pixelsPerUnit: proj[5] * viewport.height * 0.5,
    };
  };
  return rig;
}
