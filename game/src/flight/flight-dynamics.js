// Six-degree-of-freedom flight model for the Saltrunner. Lift follows angle of attack up to a
// sharp stall, drag grows with lift (less in ground effect), the nose weathervanes into the airflow,
// and every control surface's authority scales with dynamic pressure plus propeller wash, so the
// aircraft answers crisply at cruise and goes soft and mushy as it slows toward the stall.
import { add, sub, scale, dot, cross, normalize, length, quatRotate, quatConjugate, quatIntegrateBody, quatFromAttitude, attitudeOf } from '../core/vector-math.js';
import { smoothstep, lerp, clamp } from '../core/noise.js';
import { createPowerplant, updatePowerplant } from './powerplant.js';
import { wheelForces } from './landing-gear.js';
import { createAirframeState, assessAirframe } from './airframe-damage.js';

export const PHYSICS_STEP = 1 / 240;
const GRAVITY = 9.81;

/** A fresh aircraft at a position, heading (radians) and airspeed, with a fuel load (0..1). */
export function createAircraft(spec, { position, heading = 0, pitch = 0, speed = 0, fuel = 0.6, flaps = 0, throttle = 0 }) {
  const orientation = quatFromAttitude(heading, pitch, 0);
  const plane = {
    spec,
    position: [...position],
    velocity: scale(quatRotate(orientation, [0, 0, -1]), speed),
    orientation,
    angularVelocity: [0, 0, 0],
    controls: { pitch: 0, roll: 0, yaw: 0, throttle, flaps, brakes: 0 },
    engine: createPowerplant(spec, fuel),
    airframe: createAirframeState(),
    onGround: false,
    gForce: 1,
    alpha: 0,
    beta: 0,
    airspeed: speed,
    verticalSpeed: 0,
    stallWarning: false,
    clock: 0,
    landingLight: false,
    contacts: [],
  };
  plane.engine.rpm = speed > 10 ? spec.idleRpm + throttle * (spec.maxRpm - spec.idleRpm) : spec.idleRpm;
  return plane;
}

/** Lift coefficient: linear to the stall angle, then a sudden loss toward flat-plate lift. */
export function liftCoefficient(spec, alpha, flaps) {
  const cl0 = spec.zeroLiftCoefficient + spec.flapLift[flaps];
  const stall = spec.stallAngle + spec.flapStallShift[flaps];
  const linear = cl0 + spec.liftSlope * alpha;
  if (alpha > stall) return lerp(cl0 + spec.liftSlope * stall, 0.95 * Math.sin(2 * alpha) + cl0 * 0.25, smoothstep(0, 0.13, alpha - stall));
  if (alpha < -stall * 0.85) return lerp(cl0 - spec.liftSlope * stall * 0.85, 0.95 * Math.sin(2 * alpha), smoothstep(0, 0.13, -stall * 0.85 - alpha));
  return linear;
}

/** Air density falls with altitude (an exponential atmosphere). */
const airDensity = (altitude) => 1.225 * Math.exp(-Math.max(0, altitude) / 9500);

/** Every force and moment on the airframe for one step. */
function aerodynamics(plane, wind, groundHeight) {
  const { spec, controls } = plane;
  const damage = plane.airframe.damage;
  const inverse = quatConjugate(plane.orientation);
  const air = quatRotate(inverse, sub(plane.velocity, wind));
  const V = Math.max(length(air), 0.01);
  const rho = airDensity(plane.position[1]);
  const qbar = 0.5 * rho * V * V;
  const alpha = Math.atan2(-air[1], -air[2]);
  const beta = Math.asin(clamp(air[0] / V, -1, 1));
  const S = spec.wingArea;
  const b = spec.wingSpan;
  const c = spec.chord;
  const heightAboveGround = plane.position[1] - groundHeight;
  const groundEffect = 1 - 0.55 * Math.exp(-Math.max(0, heightAboveGround - 1.2) / (b * 0.35));
  const CL = liftCoefficient(spec, alpha, controls.flaps) * (1 - damage * 0.25);
  const stall = spec.stallAngle + spec.flapStallShift[controls.flaps];
  const beyondStall = Math.max(0, Math.abs(alpha) - stall);
  const CD = spec.parasiteDrag + spec.inducedDragFactor * CL * CL * groundEffect + spec.flapDrag[controls.flaps] + spec.gearDrag + 1.1 * Math.sin(beyondStall) ** 2 + damage * 0.035;
  const vHat = scale(air, 1 / V);
  const liftDir = normalize(cross([1, 0, 0], vHat));
  const forceBody = add(add(scale(liftDir, CL * qbar * S), scale(vHat, -CD * qbar * S)), [spec.sideForceSlope * beta * qbar * S, 0, 0]);

  const forward = -air[2];
  const thrust = updatePowerplant(plane.engine, spec, controls.throttle, forward, damage, PHYSICS_STEP);
  forceBody[2] -= thrust;

  // Moments about the body axes, written as nose-up, roll-right and nose-right positive.
  const authority = 1 - damage * 0.3;
  const washedTail = qbar + Math.max(0, thrust) * spec.propwashControl * 0.12;
  const washedRudder = qbar + Math.max(0, thrust) * spec.propwashControl * 0.4;
  const stalled = smoothstep(0, 0.1, beyondStall);
  const pitchRate = plane.angularVelocity[0];
  const yawRate = -plane.angularVelocity[1];
  const rollRate = -plane.angularVelocity[2];
  const P = spec.pitch;
  const R = spec.roll;
  const Y = spec.yaw;
  const flapPitch = -0.05 * spec.flapLift[controls.flaps];
  const pitchMoment = qbar * S * c * (P.trim + flapPitch + P.stability * alpha) + washedTail * S * c * P.control * controls.pitch * authority + P.damping * pitchRate * 0.25 * rho * V * S * c * c - stalled * qbar * S * c * 0.13;
  const rollMoment = qbar * S * b * (R.control * controls.roll * authority * (1 - stalled * 0.6) + R.dihedral * beta) + R.damping * rollRate * 0.25 * rho * V * S * b * b + stalled * qbar * S * b * 0.012 * Math.sin(plane.clock * 1.7);
  const yawMoment = qbar * S * b * (Y.stability * beta + Y.adverse * controls.roll) + washedRudder * S * b * Y.control * controls.yaw * authority + Y.damping * yawRate * 0.25 * rho * V * S * b * b;

  const angularAcceleration = [
    pitchMoment / P.inertia - pitchRate * 0.6,
    -yawMoment / Y.inertia + plane.angularVelocity[1] * -0.5,
    -rollMoment / R.inertia + plane.angularVelocity[2] * -0.4,
  ];
  return { forceBody, angularAcceleration, V, alpha, beta, stall, thrust };
}

/** Advances the aircraft by one physics step under the given wind and terrain. */
export function stepAircraft(plane, world, wind, dt = PHYSICS_STEP) {
  if (plane.airframe.crashed) {
    plane.velocity = scale(plane.velocity, Math.max(0, 1 - dt * 2.5));
    plane.position = add(plane.position, scale(plane.velocity, dt));
    plane.engine.rpm = Math.max(0, plane.engine.rpm - dt * 3000);
    return [];
  }
  const { spec } = plane;
  plane.clock += dt;
  const ground = world.terrain.heightAt(plane.position[0], plane.position[2]);
  const aero = aerodynamics(plane, wind, Math.max(ground, 0));
  const mass = spec.emptyMass + plane.engine.fuel;
  const surface = (x, z) => world.surfaceAt(x, z);
  const gear = wheelForces(plane, spec, surface, plane.controls);
  const aeroWorld = quatRotate(plane.orientation, aero.forceBody);
  const contactForce = add(aeroWorld, gear.force);
  const accel = add(scale(contactForce, 1 / mass), [0, -GRAVITY, 0]);
  const wasAirborne = !plane.onGround;
  plane.velocity = add(plane.velocity, scale(accel, dt));
  plane.position = add(plane.position, scale(plane.velocity, dt));

  const gearTorqueBody = quatRotate(quatConjugate(plane.orientation), gear.torque);
  const inertia = [spec.pitch.inertia, spec.yaw.inertia, spec.roll.inertia];
  for (let i = 0; i < 3; i++) plane.angularVelocity[i] += (aero.angularAcceleration[i] + gearTorqueBody[i] / inertia[i]) * dt;
  if (gear.contacts.length > 0) {
    for (let i = 0; i < 3; i++) plane.angularVelocity[i] *= 1 - Math.min(1, dt * 1.5);
    // The gear's track and a pilot's hands keep a rolling aircraft upright: a righting moment
    // grows with bank (and with a nose pitched onto its wheel), so crosswinds skid, not capsize.
    const att = attitudeOf(plane.orientation);
    plane.angularVelocity[2] += (att.bank * 9 - plane.angularVelocity[2] * 4) * dt;
    if (att.pitch < -0.08) plane.angularVelocity[0] += (-att.pitch - 0.08) * 8 * dt;
  }
  plane.orientation = quatIntegrateBody(plane.orientation, plane.angularVelocity, dt);

  const up = quatRotate(plane.orientation, [0, 1, 0]);
  plane.gForce = dot(contactForce, up) / (mass * GRAVITY);
  plane.alpha = aero.alpha;
  plane.beta = aero.beta;
  plane.airspeed = aero.V;
  plane.verticalSpeed = plane.velocity[1];
  plane.stallWarning = aero.alpha > aero.stall - 0.04 && aero.V > 3 && gear.contacts.length < 2;
  plane.contacts = gear.contacts;
  plane.onGround = gear.contacts.length > 0;
  return assessAirframe(plane, spec, world, gear.contacts, wasAirborne, dt);
}

/**
 * Turns the pilot's stick, rudder and throttle into control-surface positions: keyboard input is
 * eased in and out, and with the assist on a released stick holds the current flight path (an
 * auto-trim), so the aircraft flies hands-off instead of porpoising.
 */
export function applyPilotInput(plane, input, assist, dt) {
  const c = plane.controls;
  const ease = (from, to, rate) => from + Math.max(-rate * dt, Math.min(rate * dt, to - from));
  const airborne = !plane.onGround && plane.airspeed > 20;
  let roll = input.analog ? input.roll : ease(plane.rollStick ?? 0, input.roll, input.roll === 0 ? 5 : 2.6);
  plane.rollStick = roll;
  if (assist && airborne && Math.abs(input.roll) < 0.02) {
    const bank = attitudeOf(plane.orientation).bank;
    if (plane.holdBank === null || plane.holdBank === undefined) plane.holdBank = Math.abs(bank) < 0.09 ? 0 : clamp(bank, -1.05, 1.05);
    roll += clamp((plane.holdBank - bank) * 1.4 + plane.angularVelocity[2] * 0.35, -0.6, 0.6);
  } else plane.holdBank = null;
  if (assist && plane.onGround && Math.abs(input.roll) < 0.02) {
    // On the ground the assist holds the wings level, the aileron a pilot would hold into a crosswind.
    roll += clamp(-attitudeOf(plane.orientation).bank * 4 + plane.angularVelocity[2] * 0.8, -1, 1);
  }
  c.roll = clamp(roll, -1, 1);
  c.yaw = clamp(ease(plane.yawPedal ?? 0, input.yaw, 3) + (assist && airborne ? clamp(plane.beta * 4, -0.5, 0.5) : 0), -1, 1);
  plane.yawPedal = ease(plane.yawPedal ?? 0, input.yaw, 3);
  c.throttle = clamp(c.throttle + input.throttleDelta * dt * 0.55, 0, 1);
  if (input.throttleSet !== null && input.throttleSet !== undefined) c.throttle = input.throttleSet;
  c.brakes = input.brakes;
  c.flaps = clamp(c.flaps + input.flapStep, 0, 2);
  const stick = input.analog ? input.pitch : ease(plane.stick ?? 0, input.pitch, input.pitch === 0 ? 4 : 1.8);
  plane.stick = stick;
  plane.trim = plane.trim ?? 0;
  let assistPitch = assist ? plane.trim : 0;
  if (assist && airborne && Math.abs(input.pitch) < 0.02) {
    const path = Math.asin(clamp(plane.velocity[1] / Math.max(plane.airspeed, 1), -1, 1));
    if (plane.holdPath === null || plane.holdPath === undefined) plane.holdPath = Math.abs(path) < 0.05 ? 0 : clamp(path, -0.2, 0.2);
    if (plane.airspeed < 31 && plane.holdPath > -0.05) plane.holdPath -= 0.07 * dt;
    const error = plane.holdPath - path;
    plane.trim = clamp(plane.trim + error * 0.35 * dt, -0.4, 0.4);
    assistPitch = clamp(plane.trim + error * 1.1 - plane.angularVelocity[0] * 0.55, -0.6, 0.6);
  } else {
    plane.holdPath = null;
    if (plane.onGround) plane.trim *= 1 - Math.min(1, dt * 2);
  }
  c.pitch = clamp(stick + assistPitch, -1, 1);
}

/** Heading, pitch and bank in degrees, plus altitude and speeds, for instruments and missions. */
export function flightReadout(plane, terrain) {
  const att = attitudeOf(plane.orientation);
  const ground = Math.max(terrain.heightAt(plane.position[0], plane.position[2]), 0);
  return {
    heading: (att.heading * 180) / Math.PI,
    pitch: (att.pitch * 180) / Math.PI,
    bank: (att.bank * 180) / Math.PI,
    altitude: plane.position[1],
    heightAboveGround: plane.position[1] - ground + plane.spec.wheels[1].at[1],
    airspeed: plane.airspeed,
    groundSpeed: Math.hypot(plane.velocity[0], plane.velocity[2]),
    verticalSpeed: plane.velocity[1],
    track: (Math.atan2(plane.velocity[0], -plane.velocity[2]) * 180) / Math.PI,
  };
}
