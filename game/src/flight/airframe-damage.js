// Damage and crash rules, each with a reason a pilot can read: over-stress and overspeed wear the
// airframe, firm touchdowns bend the gear, treetops tear the skin, and terrain, sea or a rooftop
// end the flight. Damage also degrades lift, thrust and control authority (see flight-dynamics).
import { add, quatRotate, length } from '../core/vector-math.js';
import { FEET_PER_MINUTE, KNOTS } from './aircraft-spec.js';
import { buildingAt } from '../world/settlements.js';

export function createAirframeState() {
  return { damage: 0, crashed: false, crashReason: '', crashKind: '', lastTouchdown: null, treeStrikes: 0 };
}

function crash(state, kind, reason) {
  if (state.crashed) return;
  state.crashed = true;
  state.crashKind = kind;
  state.crashReason = reason;
  state.damage = 1;
}

/** Applies stress, landing and collision rules after a physics step; returns this step's events. */
export function assessAirframe(plane, spec, world, contacts, wasAirborne, dt) {
  const events = [];
  const state = plane.airframe;
  if (state.crashed) return events;
  const speed = length(plane.velocity);
  const [minG, maxG] = spec.structuralG;
  if (plane.gForce > maxG || plane.gForce < minG) {
    const excess = plane.gForce > maxG ? plane.gForce - maxG : minG - plane.gForce;
    state.damage += excess * 0.35 * dt;
    if (plane.gForce > maxG * 1.3 || plane.gForce < minG * 1.3) crash(state, 'overstress', `The wings folded at ${plane.gForce.toFixed(1)} g`);
  }
  if (plane.airspeed > spec.neverExceed) {
    state.damage += (plane.airspeed - spec.neverExceed) * 0.012 * dt;
    if (plane.airspeed > spec.neverExceed * 1.18) crash(state, 'flutter', `Control flutter tore the tail off at ${Math.round(plane.airspeed * KNOTS)} kt`);
  }

  if (contacts.length > 0) {
    const water = contacts.find((c) => c.water);
    if (water) crash(state, 'ditched', speed > 12 ? `Ditched in the sea at ${Math.round(speed * KNOTS)} kt` : 'Rolled into the sea');
    if (wasAirborne && !state.crashed) {
      const sink = Math.max(...contacts.map((c) => c.sink));
      const fpm = Math.round(sink * FEET_PER_MINUTE);
      state.lastTouchdown = { sink, fpm, time: plane.clock, runway: contacts.every((c) => c.runway) };
      if (sink > spec.landingSinkLimit) crash(state, 'gear-collapse', `The gear collapsed: touchdown at ${fpm} ft/min`);
      else if (sink > spec.hardLandingSink) {
        state.damage += (sink - spec.hardLandingSink) * 0.18;
        events.push({ type: 'hard-landing', fpm });
      } else events.push({ type: 'touchdown', fpm });
    }
  }

  for (const hard of spec.hardPoints) {
    const p = add(plane.position, quatRotate(plane.orientation, hard.at));
    const ground = world.terrain.heightAt(p[0], p[2]);
    if (p[1] < 0 && ground < 0) {
      crash(state, 'ditched', `The ${hard.name} caught the sea at ${Math.round(speed * KNOTS)} kt`);
      break;
    }
    if (p[1] < ground) {
      crash(state, 'terrain', speed < 6 ? `Tipped onto the ${hard.name}` : `The ${hard.name} struck the ground at ${Math.round(speed * KNOTS)} kt`);
      break;
    }
  }

  const p = plane.position;
  for (const tree of world.forest.index.near(p[0], p[2])) {
    const d = Math.hypot(p[0] - tree.x, p[2] - tree.z);
    if (d > tree.radius + 4 || p[1] > tree.y + tree.height + 1.5) continue;
    if (p[1] > tree.y + tree.height * 0.72 && d > tree.radius * 0.3) {
      if (plane.clock - (tree.lastHit ?? -9) > 1) {
        tree.lastHit = plane.clock;
        state.damage += 0.22;
        state.treeStrikes += 1;
        events.push({ type: 'tree-strike' });
      }
    } else if (d < tree.radius + 1) {
      crash(state, 'trees', 'Flew into the treetops and came down in the forest');
    }
  }
  if (!state.crashed && buildingAt(world.buildings, p[0], p[1], p[2])) crash(state, 'building', 'Struck a building');
  if (!state.crashed && state.damage >= 1) crash(state, 'structural', 'The damaged airframe broke up');
  if (state.crashed) events.push({ type: 'crash', reason: state.crashReason, kind: state.crashKind });
  return events;
}
