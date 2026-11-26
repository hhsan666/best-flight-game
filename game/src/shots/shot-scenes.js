// Screenshot scenes (?shot=<name>): each stages a moment of a real mission — the aircraft's pose,
// the mission's progress, the camera — and renders it once with the game's own renderer, HUD and
// screens, so every screenshot is the game drawing itself. Nothing here is drawn by hand.
import { missionById } from '../missions/mission-catalog.js';
import { flightReadout } from '../flight/flight-dynamics.js';
import { quatFromAttitude, quatRotate } from '../core/vector-math.js';
import { AIRFIELDS, runwayEnds } from '../world/landmarks.js';
import { SALTRUNNER } from '../flight/aircraft-spec.js';
import { gradeLanding } from '../missions/landing-grader.js';
import { buildRingCourse } from '../missions/ring-courses.js';

const DEG = Math.PI / 180;

/** Puts the aircraft at a pose with a speed along its nose and the engine at the given throttle. */
function pose(plane, position, headingDeg, pitchDeg, bankDeg, speed, throttle, flaps) {
  plane.position = [...position];
  plane.orientation = quatFromAttitude(headingDeg * DEG, pitchDeg * DEG, bankDeg * DEG);
  const along = quatRotate(quatFromAttitude(headingDeg * DEG, (pitchDeg - 2.5) * DEG, 0), [0, 0, -1]);
  plane.velocity = along.map((v) => v * speed);
  plane.airspeed = speed;
  plane.controls.throttle = throttle;
  plane.controls.flaps = flaps;
  plane.controls.roll = bankDeg > 0 ? 0.15 : bankDeg < 0 ? -0.15 : 0;
  plane.controls.pitch = 0.08;
  plane.engine.rpm = SALTRUNNER.idleRpm + throttle * (SALTRUNNER.maxRpm - SALTRUNNER.idleRpm) + speed * 2.2;
  plane.engine.propAngle = 0.4;
  plane.engine.flow = (SALTRUNNER.fuelBurnIdle + (SALTRUNNER.fuelBurnFull - SALTRUNNER.fuelBurnIdle) * Math.pow(throttle, 1.3)) * 11.5;
  plane.gForce = 1 / Math.cos(bankDeg * DEG);
  plane.onGround = false;
}

const headingBetween = (a, b) => ((Math.atan2(b[0] - a[0], -(b[2] - a[2])) / DEG) + 360) % 360;

function approachTo(rings, index, distance, drop = 0) {
  const ring = rings[index];
  const prev = rings[Math.max(0, index - 1)];
  const dx = ring.position[0] - prev.position[0];
  const dz = ring.position[2] - prev.position[2];
  const l = Math.hypot(dx, dz) || 1;
  return [ring.position[0] - (dx / l) * distance, ring.position[1] - drop, ring.position[2] - (dz / l) * distance];
}

function settleChase(api) {
  for (let i = 0; i < 60; i++) api.rig.update(api.game.plane, api.world.terrain, 0.1, { width: 768, height: 480 });
}

const SHOTS = {
  /** Chasing the Saltrunner up the Silverrun canyon toward the snowy Cairnhold, a gate ahead. */
  canyon(api) {
    api.startMission(missionById('silverrun-gates'));
    const st = api.game.director.state;
    st.nextRing = 4;
    st.cleared = 4;
    st.elapsed = 52;
    const at = approachTo(st.rings, 4, 210, 6);
    pose(api.game.plane, at, headingBetween(at, st.rings[4].position) - 4, 3, 14, 54, 0.82, 0);
    api.game.time = 37.5;
    api.rig.mode = 'chase';
    api.rig.reset(api.game.plane);
    settleChase(api);
  },
  /** Silverrun Gates: the instant the Saltrunner threads gate 6, the glowing hoop around it. */
  gatePass(api) {
    api.startMission(missionById('silverrun-gates'));
    const st = api.game.director.state;
    st.nextRing = 5;
    st.cleared = 5;
    st.elapsed = 61;
    const at = approachTo(st.rings, 5, 24, 1.5);
    pose(api.game.plane, at, headingBetween(at, st.rings[5].position) + 2, 2, -18, 55, 0.85, 0);
    api.game.time = 44.5;
    api.rig.mode = 'chase';
    api.rig.reset(api.game.plane);
    settleChase(api);
  },
  /** Cover. First Light along the harbour coast: beach, shallows, forest and the Cairnhold peaks, ring 5 ahead. */
  coast(api) {
    api.startMission(missionById('first-light'));
    const st = api.game.director.state;
    st.step = 1;
    st.rings = buildRingCourse('harbour', api.world);
    st.nextRing = 4;
    st.cleared = 4;
    st.elapsed = 162;
    const at = approachTo(st.rings, 4, 250, 6);
    pose(api.game.plane, at, headingBetween(at, st.rings[4].position) + 7, 3, 12, 52, 0.72, 0);
    api.game.time = 51.5;
    api.rig.mode = 'chase';
    api.rig.reset(api.game.plane);
    settleChase(api);
  },
  /** Cockpit at dusk on the Lantern Run, over Port Halloway's lit streets with the lantern rings ahead. */
  cockpit(api) {
    api.startMission(missionById('lantern-run'));
    const st = api.game.director.state;
    st.nextRing = 4;
    st.cleared = 4;
    st.elapsed = 171;
    const at = approachTo(st.rings, 4, 520, 4);
    pose(api.game.plane, at, headingBetween(at, st.rings[4].position) + 3, 1, -9, 50, 0.6, 0);
    api.game.plane.landingLight = true;
    api.game.time = 91.4;
    api.rig.mode = 'cockpit';
  },
  /** Short final into Halloway runway 07 at morning: flaps full, PAPI two red two white, lights on. */
  approach(api) {
    const mission = missionById('first-light');
    api.startMission(mission);
    const st = api.game.director.state;
    st.step = 2;
    st.cleared = 7;
    st.nextRing = 7;
    st.elapsed = 236;
    const field = AIRFIELDS[0];
    const [low] = runwayEnds(field);
    const h = low.heading * DEG;
    const d = 260;
    const at = [low.x - Math.sin(h) * d - Math.cos(h) * 3, field.elevation + 300 * Math.tan(3 * DEG) + d * Math.tan(3 * DEG) + 1.5, low.z + Math.cos(h) * d - Math.sin(h) * 3];
    const plane = api.game.plane;
    pose(plane, at, low.heading + 1.5, 1.5, -2, 33, 0.24, 2);
    plane.velocity[1] = -1.75;
    api.game.time = 18.6;
    api.rig.mode = 'chase';
    const forward = [Math.sin(h), 0, -Math.cos(h)];
    const right = [Math.cos(h), 0, Math.sin(h)];
    const eye = [0, 1, 2].map((i) => plane.position[i] - forward[i] * 15 - right[i] * 3 + (i === 1 ? 4.6 : 0));
    const target = [low.x + forward[0] * 230, field.elevation + 4, low.z + forward[2] * 230];
    api.rig.override = { eye, target, up: [0, 1, 0], fov: 56 };
  },
  /** Lantern Run's last leg from the cockpit: a dusk final into lit runway 07 over Port Halloway. */
  nightFinal(api) {
    api.startMission(missionById('lantern-run'));
    const st = api.game.director.state;
    st.step = 1;
    st.cleared = 7;
    st.nextRing = 7;
    st.elapsed = 287;
    const field = AIRFIELDS[0];
    const [low] = runwayEnds(field);
    const h = low.heading * DEG;
    const d = 380;
    const at = [low.x - Math.sin(h) * d, field.elevation + (300 + d) * Math.tan(3 * DEG) + 1.5, low.z + Math.cos(h) * d];
    pose(api.game.plane, at, low.heading, -4, 0, 34, 0.25, 2);
    api.game.plane.velocity[1] = -1.8;
    api.game.plane.landingLight = true;
    api.game.time = 70.3;
    api.rig.mode = 'cockpit';
  },
  /** Squall Final: crabbing into the crosswind on short final to runway 25, flaps out, lights on. */
  squall(api) {
    api.startMission(missionById('squall-final'));
    const st = api.game.director.state;
    st.elapsed = 96;
    const field = AIRFIELDS[0];
    const end = runwayEnds(field)[1];
    const h = end.heading * DEG;
    const d = 280;
    const at = [end.x - Math.sin(h) * d + Math.cos(h) * 4, field.elevation + (300 + d) * Math.tan(3 * DEG) + 1.5, end.z + Math.cos(h) * d + Math.sin(h) * 4];
    const plane = api.game.plane;
    pose(plane, at, end.heading + 9, 1.5, 4, 34, 0.3, 2);
    plane.velocity[1] = -1.8;
    api.game.time = 26.6;
    const forward = [Math.sin(h), 0, -Math.cos(h)];
    const right = [Math.cos(h), 0, Math.sin(h)];
    const eye = [0, 1, 2].map((i) => plane.position[i] - forward[i] * 15 + right[i] * 3 + (i === 1 ? 4.6 : 0));
    const target = [end.x + forward[0] * 230, field.elevation + 4, end.z + forward[2] * 230];
    api.rig.mode = 'chase';
    api.rig.override = { eye, target, up: [0, 1, 0], fov: 56 };
  },
  /** The results card after a First Light landing on Halloway Field at golden hour. */
  results(api) {
    const mission = missionById('first-light');
    api.startMission(mission);
    const field = AIRFIELDS[0];
    const [low] = runwayEnds(field);
    const h = low.heading * DEG;
    const st = api.game.director.state;
    st.rings.forEach((r) => (r.clearedAt = -99));
    Object.assign(st, { step: 3, nextRing: 7, cleared: 7, missed: 0, elapsed: 247, status: 'complete' });
    st.landing = gradeLanding({ sinkFpm: 186, centreline: 1.3, fromThreshold: 292, bank: 0.8 }, true);
    const plane = api.game.plane;
    pose(plane, [low.x + Math.sin(h) * 760, field.elevation + 1.53, low.z - Math.cos(h) * 760], low.heading + 12, 0.2, 0, 0, 0, 2);
    plane.onGround = true;
    plane.engine.rpm = SALTRUNNER.idleRpm;
    plane.engine.fuel = SALTRUNNER.fuelCapacity * 0.27;
    api.game.time = 64;
    api.game.mode = 'results';
    const hp = (low.heading + 12) * DEG;
    const fwd = [Math.sin(hp), 0, -Math.cos(hp)];
    const side = [Math.cos(hp), 0, Math.sin(hp)];
    const p = plane.position;
    api.rig.override = {
      eye: [p[0] + fwd[0] * 12 - side[0] * 4, p[1] + 1.6, p[2] + fwd[2] * 12 - side[2] * 4],
      target: [p[0] + side[0] * 6.5, p[1] + 0.9, p[2] + side[2] * 6.5],
      up: [0, 1, 0], fov: 50,
    };
    const card = api.game.director.scoreCard(plane);
    api.screens.results(mission, card, false, '', missionById('silverrun-gates'));
  },
  /** The title screen and its mission list over the circling Saltrunner. */
  title(api) {
    api.showTitle();
    api.game.time = 22;
    api.rig.orbitYaw = 0.25;
    for (let i = 0; i < 40; i++) api.simulate(0.05, { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, throttleNotches: 0, brakes: 0, flapStep: 0, analog: false }, true);
  },
};

export const SHOT_NAMES = Object.keys(SHOTS);

export function stageShot(name, api) {
  (SHOTS[name] ?? SHOTS.coast)(api);
  const plane = api.game.plane;
  const readout = flightReadout(plane, api.world.terrain);
  const draw = () => api.renderFrame(0, api.game.mode === 'flying' ? readout : null);
  draw();
  requestAnimationFrame(() => {
    draw();
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}
