// Grades a landing the way an instructor would: sink rate at touchdown, distance from the
// centreline, where on the runway the wheels met it (the touchdown zone is 150-450 m past the
// threshold), bank at touchdown, and whether the aircraft stopped on the paved surface.
import { runwayUnder } from '../world/world-builder.js';
import { FEET_PER_MINUTE } from '../flight/aircraft-spec.js';

/** Facts about the moment of touchdown on a runway; null when the wheels touched elsewhere. */
export function measureTouchdown(plane, readout) {
  const under = runwayUnder(plane.position[0], plane.position[2]);
  if (!under) return null;
  const { field, along, across } = under;
  const h = (field.heading * Math.PI) / 180;
  const travel = plane.velocity[0] * Math.sin(h) - plane.velocity[2] * Math.cos(h);
  const direction = travel >= 0 ? 1 : -1;
  return {
    field,
    direction,
    sinkFpm: Math.round((plane.airframe.lastTouchdown?.sink ?? 0) * FEET_PER_MINUTE),
    centreline: Math.abs(across),
    offset: direction * across,
    fromThreshold: field.length / 2 + direction * along,
    bank: Math.abs(readout.bank),
  };
}

/** How far past the landing threshold a point lies along the runway, for a landing in `direction` (±1). */
export function distancePastThreshold(field, x, z, direction) {
  const h = (field.heading * Math.PI) / 180;
  return field.length / 2 + direction * ((x - field.x) * Math.sin(h) - (z - field.z) * Math.cos(h));
}

/** Points, a letter grade and the score card's lines for a landing, plus what the results card plots of it. */
export function gradeLanding(t, stoppedOnRunway, stopDistance = null) {
  const notes = [];
  let points = 0;
  if (t.sinkFpm < 200) { points += 650; notes.push(['Touchdown', `${t.sinkFpm} ft/min — a greaser`, 650]); }
  else if (t.sinkFpm < 380) { points += 480; notes.push(['Touchdown', `${t.sinkFpm} ft/min — smooth`, 480]); }
  else if (t.sinkFpm < 560) { points += 260; notes.push(['Touchdown', `${t.sinkFpm} ft/min — firm`, 260]); }
  else { points += 80; notes.push(['Touchdown', `${t.sinkFpm} ft/min — hard`, 80]); }
  const cl = t.centreline;
  const clPts = cl < 3 ? 220 : cl < 7 ? 120 : 30;
  points += clPts;
  notes.push(['Centreline', `${cl.toFixed(1)} m off`, clPts]);
  const d = t.fromThreshold;
  const zonePts = d >= 150 && d <= 450 ? 220 : d > 450 && d <= 700 ? 110 : 20;
  points += zonePts;
  notes.push(['Touchdown point', `${Math.round(d)} m past the threshold`, zonePts]);
  const bankPts = t.bank < 3 ? 80 : t.bank < 7 ? 40 : 0;
  points += bankPts;
  notes.push(['Wings level', `${t.bank.toFixed(1)}° of bank`, bankPts]);
  if (stoppedOnRunway) { points += 120; notes.push(['Rollout', 'Stopped on the runway', 120]); }
  const grade = points >= 1150 ? 'A' : points >= 900 ? 'B' : points >= 650 ? 'C' : points >= 400 ? 'D' : 'E';
  const plot = t.field ? { length: t.field.length, width: t.field.width, touchdown: t.fromThreshold, offset: t.offset ?? 0, stop: stopDistance } : null;
  return { points, grade, notes, plot };
}
