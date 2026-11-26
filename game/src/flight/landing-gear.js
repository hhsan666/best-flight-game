// Wheels on the ground: a spring and damper per tyre, rolling resistance, side grip that keeps
// the aircraft tracking straight, toe brakes on the mains and nose-wheel steering on the rudder.
import { add, sub, scale, dot, cross, normalize, quatRotate } from '../core/vector-math.js';

const SIDE_GRIP = 0.85;
const ROLLING = 0.022;
const GRASS_ROLLING = 0.07;
const BRAKING = 0.6;

/**
 * Computes the forces of every wheel touching the ground. Returns world force, world torque about
 * the centre of gravity, and per-wheel contact facts for touchdown detection and effects.
 */
export function wheelForces(plane, spec, surface, controls) {
  let force = [0, 0, 0];
  let torque = [0, 0, 0];
  const contacts = [];
  const omegaWorld = quatRotate(plane.orientation, plane.angularVelocity);
  const forward = quatRotate(plane.orientation, [0, 0, -1]);
  for (const wheel of spec.wheels) {
    const arm = quatRotate(plane.orientation, wheel.at);
    const point = add(plane.position, arm);
    const ground = surface(point[0], point[2]);
    const depth = ground.height - point[1];
    if (depth <= 0) continue;
    const n = ground.normal;
    const pointVelocity = add(plane.velocity, cross(omegaWorld, arm));
    const closing = dot(pointVelocity, n);
    const load = Math.max(0, wheel.spring * depth - wheel.damper * closing);
    let rolling = normalize(sub(forward, scale(n, dot(forward, n))));
    if (wheel.steer) {
      const speed = Math.hypot(...plane.velocity);
      const steer = controls.yaw * 0.4 * Math.max(0.15, 1 - speed / 30);
      const side = cross(rolling, n);
      rolling = normalize(add(scale(rolling, Math.cos(steer)), scale(side, Math.sin(steer))));
    }
    const lateral = cross(n, rolling);
    const vRoll = dot(pointVelocity, rolling);
    const vSide = dot(pointVelocity, lateral);
    const resist = (ground.runway ? ROLLING : GRASS_ROLLING) + (wheel.brake ? controls.brakes * BRAKING : 0);
    const rollForce = -Math.sign(vRoll) * Math.min(Math.abs(vRoll) * 900, resist * load);
    const sideForce = -Math.max(-SIDE_GRIP * load, Math.min(SIDE_GRIP * load, vSide * 3200));
    const f = add(add(scale(n, load), scale(rolling, rollForce)), scale(lateral, sideForce));
    force = add(force, f);
    torque = add(torque, cross(arm, f));
    contacts.push({ wheel: wheel.name, point, sink: -closing, load, water: ground.water, runway: ground.runway, skid: Math.abs(vSide) > 2.5 || (controls.brakes > 0.5 && Math.abs(vRoll) > 3) });
  }
  return { force, torque, contacts };
}
