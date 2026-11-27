// Runs one sortie: places the aircraft, walks the mission's steps (take off, rings, fly to a field,
// land), detects ring passes and misses through each ring's plane (a pass nearer the centre scores
// more), grades the landing, plans the fuel the rest of the route needs, ends the flight on a crash
// or a stop, and totals the score card with its medal.
import { AIRFIELDS, runwayEnds } from '../world/landmarks.js';
import { runwayUnder } from '../world/world-builder.js';
import { buildRingCourse } from './ring-courses.js';
import { measureTouchdown, gradeLanding, distancePastThreshold } from './landing-grader.js';
import { SALTRUNNER } from '../flight/aircraft-spec.js';

const fieldById = (id) => AIRFIELDS.find((f) => f.id === id);
const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Points for threading a ring `offset` metres from its centre: 150, plus up to 40 for a pass near the middle. */
export function ringPoints(offset, radius) {
  return 150 + Math.round(40 * Math.max(0, 1 - offset / radius));
}

/** Minutes of flying the rest of a route needs at a ground speed, with a minute for the approach when it ends on a runway. */
export function routeMinutes(metres, groundSpeed, endsWithLanding) {
  return metres / Math.max(groundSpeed, 38) / 60 + (endsWithLanding ? 1 : 0);
}

/** Where and how the aircraft starts: on a runway, in the air, or established on final. */
export function spawnFor(mission) {
  const s = mission.start;
  if (s.airfield) {
    const field = fieldById(s.airfield);
    const end = runwayEnds(field)[s.end];
    const h = (end.heading * Math.PI) / 180;
    return { position: [end.x + Math.sin(h) * 45, field.elevation + 1.53, end.z - Math.cos(h) * 45], heading: h, speed: 0, throttle: 0, flaps: 1 };
  }
  if (s.approach) {
    const field = fieldById(s.approach.airfield);
    const end = runwayEnds(field)[s.approach.end];
    const h = (end.heading * Math.PI) / 180;
    const d = s.approach.distance;
    return { position: [end.x - Math.sin(h) * d, field.elevation + s.approach.height, end.z + Math.cos(h) * d], heading: h, speed: s.approach.speed, throttle: 0.3, flaps: s.approach.flaps };
  }
  const a = s.air;
  return { position: [a.x, a.altitude, a.z], heading: (a.heading * Math.PI) / 180, speed: a.speed, throttle: 0.68, flaps: 0 };
}

export function createMissionDirector(world, mission) {
  const st = {
    mission, step: 0, elapsed: 0, rings: [], nextRing: 0, cleared: 0, missed: 0, ringScore: 0, offsets: [], status: 'flying', failReason: '',
    messages: [], touchdown: null, landing: null, stopTimer: 0, startFuel: mission.fuel, previous: null, airborneTime: 0, warned: false,
  };
  const say = (text, colour = '#ffffff', big = false, life = 2.8) => st.messages.push({ text, colour, big, life });
  const current = () => mission.steps[st.step];
  const courses = new Map();
  /** The rings of a rings step (built once per course, for steps not yet flown). */
  const courseOf = (step) => {
    if (step === current() && st.rings.length) return st.rings;
    if (!courses.has(step.course)) courses.set(step.course, buildRingCourse(step.course, world));
    return courses.get(step.course);
  };

  const enterStep = () => {
    const step = current();
    if (!step) return;
    if (step.type === 'rings') {
      st.rings = buildRingCourse(step.course, world);
      st.nextRing = 0;
    }
  };
  enterStep();

  const advance = () => {
    st.step += 1;
    if (st.step >= mission.steps.length) complete();
    else enterStep();
  };

  function complete() {
    st.status = 'complete';
    say('MISSION COMPLETE', '#ffc23a', true, 4);
  }
  function fail(reason) {
    if (st.status !== 'flying') return;
    st.status = 'failed';
    st.failReason = reason;
  }

  function checkRing(plane) {
    const ring = st.rings[st.nextRing];
    if (!ring || !st.previous) return;
    const h = (ring.heading * Math.PI) / 180;
    const n = [Math.sin(h), 0, -Math.cos(h)];
    const side = (p) => (p[0] - ring.position[0]) * n[0] + (p[2] - ring.position[2]) * n[2];
    const before = side(st.previous);
    const after = side(plane.position);
    if (!(before < 0 && after >= 0)) return;
    const t = before / (before - after);
    const cross = st.previous.map((v, i) => v + (plane.position[i] - v) * t);
    const offset = Math.hypot(cross[0] - ring.position[0], cross[1] - ring.position[1], cross[2] - ring.position[2]);
    if (offset <= ring.radius) {
      const points = ringPoints(offset, ring.radius);
      st.cleared += 1;
      st.ringScore += points;
      st.offsets.push(offset);
      st.lastRing = { points, offset };
      ring.clearedAt = st.elapsed;
      say(`RING ${st.nextRing + 1}/${st.rings.length}  ${offset.toFixed(1)} m off centre  +${points}`, '#9dffc6', true);
      st.lastEvent = 'ring';
    } else if (offset <= ring.radius * 4) {
      st.missed += 1;
      st.ringScore -= 100;
      st.lastRing = { points: -100, offset: null };
      say(`MISSED RING ${st.nextRing + 1}  −100`, '#ff7a6b', true);
      st.lastEvent = 'miss';
    } else return;
    st.nextRing += 1;
    if (st.nextRing >= st.rings.length) advance();
  }

  function checkLanding(plane, readout, step, dt, airborneBefore) {
    if (plane.onGround && !st.touchdown && airborneBefore > 2) {
      const facts = measureTouchdown(plane, readout);
      if (facts && (facts.field.id === step.airfield || step.type === 'explore')) {
        st.touchdown = facts;
        say(`TOUCHDOWN  ${facts.sinkFpm} ft/min`, '#ffffff', true);
      } else st.touchdown = { offRunway: true };
    }
    if (!plane.onGround && st.touchdown && plane.airborneFor > 4) st.touchdown = null;
    const speed = Math.hypot(plane.velocity[0], plane.velocity[2]);
    if (plane.onGround && st.touchdown && speed < 1.5) st.stopTimer += dt;
    else st.stopTimer = 0;
    if (st.stopTimer > 1.2) {
      if (st.touchdown.offRunway) return fail('Landed away from the runway');
      const onRunway = runwayUnder(plane.position[0], plane.position[2]) !== null;
      const t = st.touchdown;
      st.landing = gradeLanding(t, onRunway, distancePastThreshold(t.field, plane.position[0], plane.position[2], t.direction));
      advance();
    }
  }

  return {
    state: st,
    /** Per-frame update after physics; `events` are the airframe events of this frame. */
    update(plane, readout, events, dt) {
      if (st.status !== 'flying') return;
      st.elapsed += dt;
      const airborneBefore = st.airborneTime;
      st.airborneTime = plane.onGround ? 0 : st.airborneTime + dt;
      plane.airborneFor = st.airborneTime;
      for (const m of st.messages) m.life -= dt;
      st.messages = st.messages.filter((m) => m.life > 0).slice(-3);
      for (const e of events) {
        if (e.type === 'crash') fail(e.reason);
        if (e.type === 'hard-landing') say(`HARD LANDING  ${e.fpm} ft/min`, '#ffc23a', true);
        if (e.type === 'tree-strike') say('TREETOPS!  Airframe damaged', '#ff7a6b', true);
      }
      if (st.status !== 'flying') return;
      const step = current();
      if (step.type === 'takeoff' && !plane.onGround && readout.heightAboveGround > 25) {
        say('AIRBORNE', '#9dffc6', true);
        advance();
      } else if (step.type === 'rings') checkRing(plane);
      else if (step.type === 'fly-to') {
        const f = fieldById(step.airfield);
        if (Math.hypot(plane.position[0] - f.x, plane.position[2] - f.z) < 1800) {
          say(`${f.name.toUpperCase()} IN SIGHT — LAND`, '#ffc23a', true, 4);
          advance();
        }
      } else if (step.type === 'land' || step.type === 'explore') checkLanding(plane, readout, step, dt, airborneBefore);
      const edge = Math.max(Math.abs(plane.position[0]), Math.abs(plane.position[2])) - world.terrain.half;
      const outward = plane.position[0] * plane.velocity[0] + plane.position[2] * plane.velocity[2] > 0;
      if (edge > 0 && outward && !st.warned) {
        st.warned = true;
        say('LEAVING THE ISLES — TURN BACK', '#ffc23a', true, 4);
      }
      if (edge < -400) st.warned = false;
      if (edge > 3500) fail('Strayed out over the open sea');
      if (plane.engine.starved && !st.starvedSaid) {
        st.starvedSaid = true;
        say('ENGINE STOPPED — OUT OF FUEL. GLIDE!', '#ff7a6b', true, 5);
      }
      st.previous = [...plane.position];
    },
    /** The world point the HUD should point at, with a label. */
    target(plane) {
      if (st.status !== 'flying') return null;
      const step = current();
      let position = null;
      let label = '';
      if (step.type === 'rings' && st.rings[st.nextRing]) {
        position = st.rings[st.nextRing].position;
        label = `RING ${st.nextRing + 1}`;
      } else if (step.type === 'fly-to' || step.type === 'land') {
        const f = fieldById(step.airfield);
        const ends = runwayEnds(f);
        const best = ends.reduce((a, b) => (Math.hypot(plane.position[0] - a.x, plane.position[2] - a.z) < Math.hypot(plane.position[0] - b.x, plane.position[2] - b.z) ? a : b));
        position = [best.x, f.elevation + 2, best.z];
        label = `${f.code} RWY ${best.name}`;
      } else if (step.type === 'takeoff') return null;
      if (!position) return null;
      return { position, label, distance: Math.hypot(position[0] - plane.position[0], position[1] - plane.position[1], position[2] - plane.position[2]) };
    },
    objective() {
      const step = current();
      if (st.status === 'complete') return 'Complete';
      if (!step) return '';
      if (step.type === 'takeoff') return 'Full throttle, rotate at 55 kt';
      if (step.type === 'rings') return `Fly through ring ${Math.min(st.nextRing + 1, st.rings.length)} of ${st.rings.length}`;
      if (step.type === 'fly-to') return `Fly to ${fieldById(step.airfield).name}`;
      if (step.type === 'land') return `Land at ${fieldById(step.airfield).name} and stop`;
      return 'Explore — land anywhere to log the flight';
    },
    progress() {
      const steps = mission.steps.length;
      const step = current();
      const within = step?.type === 'rings' && st.rings.length ? st.nextRing / st.rings.length : 0;
      return st.status === 'complete' ? 1 : (st.step + within) / steps;
    },
    /** The steps as a checklist: each with a short label and whether it is done, current or still to come. */
    checklist() {
      return mission.steps.map((step, i) => {
        const state = st.status === 'complete' || i < st.step ? 'done' : i === st.step ? 'current' : 'next';
        let label = 'EXPLORE';
        if (step.type === 'takeoff') label = 'TAKE OFF';
        else if (step.type === 'rings') label = `RINGS ${i < st.step ? courseOf(step).length : i === st.step ? st.nextRing : 0}/${courseOf(step).length}`;
        else if (step.type === 'fly-to') label = `FLY TO ${fieldById(step.airfield).code}`;
        else if (step.type === 'land') label = `LAND ${fieldById(step.airfield).code}`;
        return { label, state };
      });
    },
    /** Metres still to fly: through the rings left, then to each field the remaining steps name. */
    /** The rest of the sortie in order: each ring still to thread, then the field to reach or land on. */
    routePoints() {
      const points = [];
      for (let i = st.step; i < mission.steps.length; i++) {
        const step = mission.steps[i];
        if (step.type === 'rings') points.push(...(i === st.step ? st.rings.slice(st.nextRing) : courseOf(step)).map((r) => ({ at: r.position, field: false })));
        else if (step.type === 'fly-to' || (step.type === 'land' && (i === st.step || mission.steps[i - 1]?.type !== 'fly-to'))) {
          const f = fieldById(step.airfield);
          points.push({ at: [f.x, f.elevation, f.z], field: true });
        }
      }
      return points;
    },
    routeAhead(plane) {
      let from = plane.position;
      let metres = 0;
      for (const { at } of this.routePoints()) {
        metres += Math.hypot(at[0] - from[0], at[2] - from[2]);
        from = at;
      }
      return metres;
    },
    /** Minutes the rest of the sortie needs at the present ground speed, or null when there is no route to fly. */
    fuelNeeded(plane) {
      if (st.status !== 'flying' || mission.steps[st.step]?.type === 'explore') return null;
      const lands = mission.steps.slice(st.step).some((s) => s.type === 'land');
      return routeMinutes(this.routeAhead(plane), Math.hypot(plane.velocity[0], plane.velocity[2]), lands);
    },
    hudMission(plane) {
      return {
        title: mission.title, objective: this.objective(), time: formatTime(st.elapsed), progress: this.progress(),
        checklist: this.checklist(), score: mission.steps.some((step) => step.type === 'rings') ? st.ringScore : null, lastRing: st.lastRing ?? null, wind: mission.wind,
        par: mission.par ? formatTime(mission.par) : null,
        overPar: mission.par ? st.elapsed > mission.par : false, fuelNeeded: plane ? this.fuelNeeded(plane) : null,
      };
    },
    /** What the moving map plots: the next stretch of the route, joined by a line from the aircraft. */
    mapTargets() {
      if (st.status !== 'flying') return [];
      return this.routePoints().slice(0, 8).map((p, i) => ({ x: p.at[0], z: p.at[2], next: i === 0, field: p.field }));
    },
    /** The score card shown on the results screen. */
    scoreCard(plane) {
      const lines = [];
      if (st.status !== 'complete') return { total: 0, medal: null, lines: [['Mission failed', st.failReason, 0]] };
      lines.push(['Mission complete', mission.title, 1000]);
      if (st.rings.length) {
        const mean = st.offsets.length ? st.offsets.reduce((a, b) => a + b, 0) / st.offsets.length : 0;
        lines.push(['Rings', `${st.cleared} cleared, ${st.missed} missed · ${mean.toFixed(1)} m off centre`, st.ringScore]);
      }
      if (mission.par) {
        const bonus = Math.max(0, Math.round((mission.par - st.elapsed) * 4));
        lines.push(['Time', `${formatTime(st.elapsed)} (par ${formatTime(mission.par)})`, bonus]);
      }
      if (st.landing) lines.push(...st.landing.notes);
      const fuelLeft = plane.engine.fuel / SALTRUNNER.fuelCapacity;
      lines.push(['Fuel remaining', `${Math.round(fuelLeft * 100)}% of tank`, Math.round(Math.min(1, fuelLeft / Math.max(0.05, st.startFuel)) * 300)]);
      if (plane.airframe.damage > 0) lines.push(['Damage', `${Math.round(plane.airframe.damage * 100)}%`, -Math.round(plane.airframe.damage * 600)]);
      const total = lines.reduce((sum, l) => sum + l[2], 0);
      const m = mission.medals;
      const medal = !m ? null : total >= m[0] ? 'gold' : total >= m[1] ? 'silver' : total >= m[2] ? 'bronze' : null;
      return { total, medal, lines, grade: st.landing?.grade ?? null, plot: st.landing?.plot ?? null, time: formatTime(st.elapsed) };
    },
  };
}
