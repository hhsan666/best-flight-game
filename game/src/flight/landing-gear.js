// Wheels on the ground: a spring and damper per tyre, rolling resistance, side grip that keeps
// the aircraft tracking straight, toe brakes on the mains and nose-wheel steering on the rudder.
import { add, sub, scale, dot, cross, normalize, quatRotate } from '../core/vector-math.js';

// Side grip stays well under the tip-over limit (half-track / CG height = 1.35 / 1.55 ~ 0.87 g),
// so a touchdown with some drift skids and straightens instead of rolling onto a wingtip.
const SIDE_GRIP = 0.5;
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
      // Limit the angle so a steered turn stays under ~0.35 g sideways at any taxi speed.
      const steer = controls.yaw * Math.min(0.45, 8 / (speed * speed + 1));
      const side = cross(rolling, n);
      rolling = normalize(add(scale(rolling, Math.cos(steer)), scale(side, Math.sin(steer))));
    }
    const lateral = cross(n, rolling);
    const vRoll = dot(pointVelocity, rolling);
    const vSide = dot(pointVelocity, lateral);
    const resist = (ground.runway ? ROLLING : GRASS_ROLLING) + (wheel.brake ? controls.brakes * BRAKING : 0);
    const rollForce = -Math.sign(vRoll) * Math.min(Math.abs(vRoll) * 900, resist * load);
    const sideForce = -Math.max(-SIDE_GRIP * load, Math.min(SIDE_GRIP * load, vSide * 1700));
    const f = add(add(scale(n, load), scale(rolling, rollForce)), scale(lateral, sideForce));
    force = add(force, f);
    torque = add(torque, cross(arm, f));
    contacts.push({ wheel: wheel.name, point, sink: -closing, load, water: ground.water, runway: ground.runway, skid: Math.abs(vSide) > 2.5 || (controls.brakes > 0.5 && Math.abs(vRoll) > 3) });
  }
  return { force, torque, contacts };
}
