// Skerrywind — Island Air Courier: an original flight game in plain JavaScript, WebGL2, Canvas 2D
// and Web Audio, with no engine, libraries or loaded assets. You fly the Saltrunner SR-2, a two-seat
// island courier, over an archipelago built from one seed: the snowy Cairnhold range, the Silverrun
// river canyon, beaches and shallows, four towns and two airfields.
//
// Five sorties ask for different skills, each with its own sky, wind and fuel load: First Light
// (take off, seven harbour rings, land home), Silverrun Gates (ten canyon gates against the clock),
// Mail to Ostmere (a fuel-tight crossing into a stiff headwind), Squall Final (a gusty crosswind
// landing in rain) and Lantern Run (dusk rings, then a night landing); Free Flight has no clock.
// A ring scores more the nearer its centre you thread it, every landing is graded (sink rate,
// centreline, touchdown point, bank, rollout), fuel burns and the airframe takes damage as you fly,
// and each scored sortie keeps its medal and personal best.
//
// Where things live: flight/ is the six-degree-of-freedom flight model (lift up to a sharp stall,
// ground effect, propeller wash, wheels and brakes, engine and fuel, damage); missions/ runs and
// scores the sorties; hud/ draws the tapes, sortie card, moving map and the backlit six-gauge panel;
// render/ is the hand-written WebGL2 renderer (terrain with baked mountain shadows, sea and river
// with waves and surf, sky with sun, stars and cirrus, cumulus billboards, instanced trees and
// houses, runways with painted markings, approach lights and a working PAPI, windsocks, rings, the
// aircraft with moving control surfaces and its shadow, particles, and four cameras); world/ builds
// the archipelago; audio/ synthesises every sound; ui/ holds the title, briefing, help, settings
// and results screens.
//
// This file boots the world, runs the fixed-step game loop and moves between title, briefing,
// flight, pause and results; ?shot=<name> stages a screenshot scene instead.
import { createAircraft, stepAircraft, applyPilotInput, flightReadout, PHYSICS_STEP } from './flight/flight-dynamics.js';
import { SALTRUNNER } from './flight/aircraft-spec.js';
import { enduranceMinutes } from './flight/powerplant.js';
import { MISSIONS, missionById } from './missions/mission-catalog.js';
import { createMissionDirector, spawnFor } from './missions/mission-director.js';
import { createFlightHud, HUD_COLOURS } from './hud/flight-hud.js';
import { createMinimap } from './hud/minimap.js';
import { createPilotInput } from './input/pilot-input.js';
import { createSoundEngine } from './audio/sound-engine.js';
import { createScreens } from './ui/screens.js';
import { loadSettings, saveSettings, loadProgress, recordResult } from './ui/settings-store.js';
import { buildWorld } from './world/world-builder.js';
import { DEFAULT_SEED } from './world/landmarks.js';
import { buildAtmosphere } from './world/sky-presets.js';
import { createSceneRenderer } from './render/scene-renderer.js';
import { createCameraRig } from './render/camera-rig.js';
import { createParticleSystem } from './render/particle-system.js';
import { stageShot } from './shots/shot-scenes.js';
import { quatRotate, add } from './core/vector-math.js';
import { smoothstep } from './core/noise.js';

const params = new URLSearchParams(location.search);
const world = buildWorld(Number(params.get('seed')) || DEFAULT_SEED);
const view = document.getElementById('world-view');
const hudCanvas = document.getElementById('hud-overlay');
const renderer = createSceneRenderer(view, world);
const hud = createFlightHud(hudCanvas, createMinimap(world.terrain));
const rig = createCameraRig();
const particles = createParticleSystem();
const settings = loadSettings();
const progress = loadProgress();
const input = createPilotInput(view, settings);
const sound = createSoundEngine();
const screens = createScreens(document.getElementById('screen-root'), handleAction);
document.getElementById('loading-card').classList.add('done');

const game = { mode: 'title', mission: null, director: null, plane: null, atmosphere: buildAtmosphere('golden'), time: 0, accumulator: 0, resultDelay: 0, back: 'title', size: [0, 0, 0] };

/** Wind for the mission: a steady breeze plus deterministic gusts, lighter near the ground. */
function windAt(plane, mission, time) {
  if (!mission) return [0, 0, 0];
  const { from, knots, gust } = mission.wind;
  const to = ((from + 180) * Math.PI) / 180;
  const ground = Math.max(world.terrain.heightAt(plane.position[0], plane.position[2]), 0);
  const shear = 0.55 + 0.45 * smoothstep(0, 160, plane.position[1] - ground);
  const gusting = 1 + (gust / Math.max(1, knots)) * (0.6 * Math.sin(time * 0.73) + 0.4 * Math.sin(time * 1.91 + 1.3));
  const speed = (knots / 1.944) * gusting * shear;
  const lift = gust * 0.06 * Math.sin(time * 2.7) * Math.sin(time * 0.53);
  return [Math.sin(to) * speed, lift, -Math.cos(to) * speed];
}

function startMission(mission) {
  game.mission = mission;
  game.director = createMissionDirector(world, mission);
  const spawn = spawnFor(mission);
  game.plane = createAircraft(SALTRUNNER, { ...spawn, fuel: mission.fuel });
  game.atmosphere = buildAtmosphere(mission.sky);
  game.plane.landingLight = game.atmosphere.night > 0.5;
  rig.mode = 'chase';
  rig.override = null;
  rig.reset(game.plane);
  particles.clear();
  game.mode = 'flying';
  game.resultDelay = 0;
  game.accumulator = 0;
  input.flightActive = true;
  screens.hide();
  sound.start();
}

function showTitle() {
  game.mode = 'title';
  input.flightActive = false;
  input.releaseMouse();
  game.mission = null;
  game.atmosphere = buildAtmosphere('golden');
  game.plane = createAircraft(SALTRUNNER, { position: [2500, 210, 3200], heading: 4.9, speed: 50, fuel: 0.6, throttle: 0.66 });
  game.plane.holdBank = 0.32;
  rig.mode = 'orbit';
  rig.override = null;
  rig.orbitDistance = 24;
  rig.orbitPitch = 0.12;
  screens.title(progress);
}

/** The length of a mission's route from where it starts, for the briefing (null for free flight). */
function routeKilometres(mission) {
  if (mission.steps.some((step) => step.type === 'explore')) return null;
  return createMissionDirector(world, mission).routeAhead({ position: spawnFor(mission).position }) / 1000;
}

function handleAction(action, data) {
  sound.start();
  sound.cue('click');
  if (action === 'brief') {
    game.mission = missionById(data.mission);
    game.atmosphere = buildAtmosphere(game.mission.sky);
    screens.briefing(game.mission, routeKilometres(game.mission));
  } else if (action === 'fly' || action === 'restart') startMission(game.mission ?? MISSIONS[0]);
  else if (action === 'title') showTitle();
  else if (action === 'resume') {
    game.mode = 'flying';
    input.flightActive = true;
    screens.hide();
  } else if (action === 'help') {
    game.back = game.mode === 'paused' ? 'pause' : game.mission && game.mode === 'title' ? 'brief-back' : 'title';
    screens.help(game.back);
  } else if (action === 'settings') {
    game.back = game.mode === 'paused' ? 'pause' : 'title';
    screens.settings(settings, game.back);
  } else if (action === 'pause') screens.pause();
  else if (action === 'brief-back') screens.briefing(game.mission, routeKilometres(game.mission));
  else if (action === 'setting') {
    settings[data.name] = data.value;
    if (data.name === 'volume') sound.setVolume(data.value);
    saveSettings(settings);
  }
}

function handleKeys(actions) {
  for (const code of actions) {
    if (game.mode === 'flying') {
      if (code === 'Escape' || code === 'KeyP') {
        game.mode = 'paused';
        input.flightActive = false;
        input.releaseMouse();
        screens.pause();
      } else if (code === 'KeyC') rig.cycle();
      else if (code === 'KeyL') game.plane.landingLight = !game.plane.landingLight;
    } else if (game.mode === 'paused' && (code === 'Escape' || code === 'KeyP')) handleAction('resume', {});
    else if (game.mode === 'results' && code === 'Enter') handleAction('restart', {});
  }
}

/** Sounds and particles for what just happened to the aircraft. */
function react(events, plane) {
  for (const e of events) {
    if (e.type === 'touchdown' || e.type === 'hard-landing') {
      sound.cue(e.type === 'touchdown' ? 'touchdown' : 'hard');
      for (const c of plane.contacts) particles.emit(c.runway ? 'tyre' : 'dust', c.point, [plane.velocity[0] * 0.3, 0.5, plane.velocity[2] * 0.3], 1.2, 6, 0.6);
    } else if (e.type === 'tree-strike') sound.cue('tree');
    else if (e.type === 'crash') {
      sound.cue('crash');
      const wet = plane.position[1] < 3 && world.terrain.heightAt(plane.position[0], plane.position[2]) < 0;
      particles.emit(wet ? 'spray' : 'fire', plane.position, [0, wet ? 8 : 3, 0], wet ? 3 : 2.5, 60, 4);
      particles.emit('smoke', plane.position, [0, 3, 0], 4, 30, 5);
      if (!wet) particles.emit('spark', plane.position, [plane.velocity[0] * 0.2, 6, plane.velocity[2] * 0.2], 0.5, 40, 3);
    }
  }
  const engine = add(plane.position, quatRotate(plane.orientation, [0, 0, -2.6]));
  if (plane.airframe.damage > 0.35 && !plane.airframe.crashed && Math.random() < plane.airframe.damage) particles.emit('smoke', engine, [0, 1, 0], 1.2, 1, 0.3);
  if (plane.airframe.crashed && Math.random() < 0.5) {
    particles.emit('smoke', plane.position, [0, 4, 0], 3, 1, 2);
    if (plane.position[1] > 1) particles.emit('fire', plane.position, [0, 2, 0], 2, 1, 1.5);
  }
  for (const c of plane.contacts) if (c.skid) particles.emit('tyre', c.point, [0, 0.5, 0], 0.8, 1, 0.3);
}

function warningsFor(plane, readout) {
  const list = [];
  const { RED, AMBER } = HUD_COLOURS;
  if (plane.airframe.crashed) return list;
  if (plane.stallWarning) list.push({ text: 'STALL', colour: RED, blink: true });
  const impact = readout.verticalSpeed < -3 ? readout.heightAboveGround / -readout.verticalSpeed : Infinity;
  if (!plane.onGround && impact < 7 && readout.verticalSpeed < -6) list.push({ text: 'PULL UP', colour: RED, blink: true });
  if (plane.airspeed > SALTRUNNER.neverExceed * 0.96) list.push({ text: 'OVERSPEED', colour: AMBER, blink: true });
  if (!plane.engine.running) list.push({ text: 'ENGINE OUT', colour: RED, blink: false });
  else if (plane.engine.fuel / SALTRUNNER.fuelCapacity < 0.06) list.push({ text: 'LOW FUEL', colour: AMBER, blink: true });
  if (plane.gForce > 5.2) list.push({ text: `OVER-G ${plane.gForce.toFixed(1)}`, colour: AMBER, blink: true });
  return list;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (game.size[0] === w && game.size[1] === h && game.size[2] === dpr && game.size[3] === settings.hudScale) return;
  game.size = [w, h, dpr, settings.hudScale];
  const scale = Math.min(dpr, Math.sqrt(2600000 / (w * h)));
  view.width = Math.round(w * scale);
  view.height = Math.round(h * scale);
  hud.resize(w, h, dpr, settings.hudScale);
}

function simulate(dt, intent, assist = settings.assist) {
  const plane = game.plane;
  plane.controls.throttle = Math.max(0, Math.min(1, plane.controls.throttle + intent.throttleNotches * 0.05));
  if (intent.flapStep) sound.cue('flaps');
  game.accumulator = Math.min(game.accumulator + dt, 0.25);
  const events = [];
  let first = true;
  while (game.accumulator >= PHYSICS_STEP) {
    applyPilotInput(plane, first ? intent : { ...intent, flapStep: 0 }, assist, PHYSICS_STEP);
    first = false;
    events.push(...stepAircraft(plane, world, windAt(plane, game.mission, game.time)));
    game.accumulator -= PHYSICS_STEP;
  }
  return events;
}

function updateFlight(dt, intent) {
  const plane = game.plane;
  const events = simulate(dt, intent);
  react(events, plane);
  const readout = flightReadout(plane, world.terrain);
  const director = game.director;
  director.update(plane, readout, events, dt);
  if (director.state.lastEvent) {
    sound.cue(director.state.lastEvent === 'ring' ? 'ring' : 'miss');
    director.state.lastEvent = null;
  }
  if (director.state.status !== 'flying') {
    game.resultDelay += dt;
    if (game.resultDelay > (director.state.status === 'failed' ? 3.2 : 2.2)) showResults();
  }
  return readout;
}

function showResults() {
  const director = game.director;
  const failed = director.state.status === 'failed';
  const card = director.scoreCard(game.plane);
  if (!failed && game.mission.medals) recordResult(progress, game.mission.id, card);
  sound.cue(failed ? 'fail' : 'fanfare');
  const index = MISSIONS.indexOf(game.mission);
  game.mode = 'results';
  input.flightActive = false;
  input.releaseMouse();
  rig.mode = 'orbit';
  rig.orbitDistance = 22;
  screens.results(game.mission, card, failed, director.state.failReason, MISSIONS[index + 1] ?? null);
}

function renderFrame(dt, readout) {
  const plane = game.plane;
  const camera = rig.update(plane, world.terrain, dt, { width: view.width, height: view.height });
  const forward = quatRotate(plane.orientation, [0, -0.08, -1]);
  const frame = {
    time: game.time, camera, atmosphere: game.atmosphere, wind: windAt(plane, game.mission, game.time),
    landingLight: plane.landingLight ? [...add(plane.position, forward), 1] : [0, 0, 0, 0], landingDirection: forward,
  };
  const director = game.director;
  const flying = game.mode === 'flying' || game.mode === 'paused';
  renderer.render(frame, {
    plane, showAircraft: true, cockpit: rig.mode === 'cockpit' && !rig.override, particles,
    rings: flying || game.mode === 'results' ? director?.state.rings : null, nextRing: director?.state.nextRing ?? 0,
    pilotEye: plane.position,
  });
  if (flying && readout) {
    const target = director.target(plane);
    const course = target ? ((Math.atan2(target.position[0] - plane.position[0], -(target.position[2] - plane.position[2])) * 180) / Math.PI + 360) % 360 : null;
    hud.draw({
      plane, readout, camera, target, course, time: game.time, cockpit: rig.mode === 'cockpit', assist: settings.assist, rain: game.atmosphere.rain,
      mission: director.hudMission(plane), warnings: warningsFor(plane, readout), messages: director.state.messages,
      mapTargets: director.mapTargets(), fuelMinutes: enduranceMinutes(plane.engine), wind: windAt(plane, game.mission, game.time),
    });
  } else hud.clear();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  game.time += dt;
  resize();
  const intent = input.sample(dt);
  handleKeys(intent.actions);
  rig.orbitYaw -= intent.orbit.dx * 0.006;
  rig.orbitPitch = Math.max(-0.2, Math.min(1.2, rig.orbitPitch + intent.orbit.dy * 0.004));
  let readout = null;
  if (game.mode === 'flying') readout = updateFlight(dt, intent);
  else if (game.mode === 'title' || game.mode === 'results') {
    if (game.mode === 'title') simulate(dt, { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, throttleNotches: 0, brakes: 0, flapStep: 0, analog: false }, true);
    else particles.update(dt, [0, 0, 0]);
    rig.orbitYaw += dt * 0.12;
  } else if (game.mode === 'paused') readout = flightReadout(game.plane, world.terrain);
  if (game.mode !== 'paused') particles.update(dt, windAt(game.plane, game.mission, game.time));
  sound.update(game.plane, game.mode === 'flying');
  renderFrame(dt, readout);
  requestAnimationFrame(loop);
}

if (params.get('shot')) {
  resize();
  stageShot(params.get('shot'), { world, game, rig, screens, hud, renderer, startMission, showTitle, simulate, updateFlight, renderFrame, react, particles, progress });
} else {
  showTitle();
  requestAnimationFrame(loop);
}
