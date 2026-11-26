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
  const fromThreshold = field.length / 2 + (travel >= 0 ? along : -along);
  return {
    field,
    sinkFpm: Math.round((plane.airframe.lastTouchdown?.sink ?? 0) * FEET_PER_MINUTE),
    centreline: Math.abs(across),
    fromThreshold,
    bank: Math.abs(readout.bank),
  };
}

export function gradeLanding(t, stoppedOnRunway) {
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
  return { points, grade, notes };
}
