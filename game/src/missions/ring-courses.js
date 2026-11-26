// Ring courses laid over the real terrain: a harbour circuit, gates up the Silverrun canyon that
// follow the river's own bends, and a dusk lantern run along the lit coast. Each ring faces the
// line of flight from the ring before it.
import { AIRFIELDS, LIGHTHOUSE, TOWNS, runwayEnds } from '../world/landmarks.js';

const DEG = 180 / Math.PI;

function faceAlong(points, radius) {
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dz = next[2] - prev[2];
    const heading = (Math.atan2(dx, -dz) * DEG + 360) % 360;
    return { position: p, heading, radius: p[3] ?? radius, pitch: 0 };
  });
}

function aboveGround(world, x, z, clearance) {
  return [x, Math.max(world.terrain.heightAt(x, z), 0) + clearance, z];
}

export function buildRingCourse(name, world) {
  const halloway = AIRFIELDS[0];
  const [low, high] = runwayEnds(halloway);
  const h = (halloway.heading * Math.PI) / 180;
  const along = [Math.sin(h), -Math.cos(h)];
  const across = [Math.cos(h), Math.sin(h)];
  if (name === 'harbour') {
    const pts = [
      [high.x + along[0] * 700, 120, high.z + along[1] * 700],
      [LIGHTHOUSE.x + 650, 140, LIGHTHOUSE.z + 420],
      [LIGHTHOUSE.x - 250, 115, LIGHTHOUSE.z + 700],
      [TOWNS[0].x + 300, 120, TOWNS[0].z + 950],
      [TOWNS[0].x - 450, 150, TOWNS[0].z + 380],
      [TOWNS[0].x - 520, 170, TOWNS[0].z - 520],
      [low.x - along[0] * 1500 - across[0] * 450, 150, low.z - along[1] * 1500 - across[1] * 450],
    ];
    return faceAlong(pts, 17);
  }
  if (name === 'silverrun') {
    const river = world.terrain.river;
    const picks = [118, 106, 95, 84, 74, 64, 54, 44, 34, 24, 14, 4];
    const pts = picks.map((k, i) => {
      const p = river[Math.min(river.length - 1, k)];
      return [p.x, Math.max(p.surface, 0) + 38 + i * 6, p.z, 15];
    });
    return faceAlong(pts, 15);
  }
  if (name === 'lantern') {
    const ostmere = AIRFIELDS[1];
    const [, ostEnd] = runwayEnds(ostmere);
    const pts = [
      [ostEnd.x - 900, 150, ostEnd.z + 650],
      [3400, 120, -900],
      [3050, 110, 600],
      [LIGHTHOUSE.x + 350, 95, LIGHTHOUSE.z - 120],
      aboveGround(world, TOWNS[0].x + 150, TOWNS[0].z - 60, 85),
      aboveGround(world, TOWNS[0].x - 380, TOWNS[0].z - 420, 95),
      [low.x - along[0] * 2300, 140, low.z - along[1] * 2300],
    ];
    return faceAlong(pts, 18);
  }
  return [];
}
