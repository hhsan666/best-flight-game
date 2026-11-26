// Towns, hangars and the lighthouse: building footprints laid on each town's street grid, kept off
// water, steep ground, the river and the runways. Each building records what the renderer and the
// collision check need: footprint, height, roof and a colour seed.
import { createRandom, subSeed } from '../core/seeded-random.js';
import { AIRFIELDS, TOWNS, LIGHTHOUSE, inApproachFunnel } from './landmarks.js';

const STREET_PITCH = 23;

function nearRunway(x, z, margin) {
  for (const field of AIRFIELDS) {
    const h = (field.heading * Math.PI) / 180;
    const dx = x - field.x;
    const dz = z - field.z;
    const u = Math.abs(dx * Math.sin(h) - dz * Math.cos(h));
    const v = Math.abs(dx * Math.cos(h) + dz * Math.sin(h));
    if (u < field.length / 2 + margin && v < field.width / 2 + margin) return true;
  }
  return false;
}

function nearRiver(terrain, x, z, margin) {
  for (const point of terrain.river) if (Math.hypot(x - point.x, z - point.z) < point.halfWidth + margin) return true;
  return false;
}

/** Lays out every town's buildings plus the airfield hangars and the lighthouse. */
export function buildSettlements(terrain, seed) {
  const buildings = [];
  for (const town of TOWNS) {
    const random = createRandom(subSeed(seed, `town:${town.id}`));
    const cos = Math.cos(town.streetAngle);
    const sin = Math.sin(town.streetAngle);
    const span = Math.ceil(town.radius / STREET_PITCH);
    for (let row = -span; row <= span; row++) {
      for (let col = -span; col <= span; col++) {
        if (row % 4 === 0 || col % 5 === 0) continue;
        const lx = col * STREET_PITCH + random.range(-3, 3);
        const lz = row * STREET_PITCH + random.range(-3, 3);
        const d = Math.hypot(lx, lz) / town.radius;
        if (d > 1 || random.next() > 1.05 - d * 0.85) continue;
        const x = town.x + lx * cos - lz * sin;
        const z = town.z + lx * sin + lz * cos;
        const width = random.range(8, 14);
        const depth = random.range(7, 12);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => terrain.heightAt(x + a * width * 0.5, z + b * depth * 0.5));
        const low = Math.min(...corners);
        const high = Math.max(...corners);
        if (low < 1.4 || high - low > 4 || nearRunway(x, z, 120) || nearRiver(terrain, x, z, 26) || inApproachFunnel(x, z)) continue;
        const centre = 1 - d;
        const storeys = 1 + Math.floor(random.next() * (1.6 + centre * 2.6));
        buildings.push({
          kind: 'house', x, z, y: low - 0.5, width, depth,
          height: storeys * 3.4 + (high - low) + 0.5, yaw: -town.streetAngle,
          roof: random.next() < 0.78 ? 'gable' : 'flat', seed: random.range(0.05, 1), town: town.id,
        });
      }
    }
    const tower = { kind: 'tower', x: town.x, z: town.z, width: 7, depth: 7, height: town.radius > 400 ? 30 : 20, yaw: -town.streetAngle, roof: 'gable', seed: 0.5 };
    tower.y = terrain.heightAt(tower.x, tower.z) - 0.5;
    if (tower.y > 1 && !inApproachFunnel(tower.x, tower.z, 2600)) buildings.push(tower);
  }
  for (const field of AIRFIELDS) {
    const h = (field.heading * Math.PI) / 180;
    const along = [Math.sin(h), -Math.cos(h)];
    const side = [Math.cos(h), Math.sin(h)];
    const hangars = field.id === 'halloway' ? 3 : 1;
    for (let k = 0; k < hangars; k++) {
      const offset = -field.length * 0.18 + k * 70;
      const x = field.x + along[0] * offset + side[0] * (field.width / 2 + 95);
      const z = field.z + along[1] * offset + side[1] * (field.width / 2 + 95);
      buildings.push({ kind: 'hangar', x, z, y: field.elevation - 0.3, width: 46, depth: 34, height: 12, yaw: Math.PI / 2 - h, roof: 'flat', seed: 0.3 + k * 0.2 });
    }
    const towerOffset = field.length * 0.08;
    buildings.push({
      kind: 'control-tower', x: field.x + along[0] * towerOffset + side[0] * (field.width / 2 + 110), z: field.z + along[1] * towerOffset + side[1] * (field.width / 2 + 110),
      y: field.elevation - 0.3, width: 6, depth: 6, height: field.id === 'halloway' ? 22 : 12, yaw: Math.PI / 2 - h, roof: 'flat', seed: 0.8,
    });
  }
  const light = { kind: 'lighthouse', x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, width: 7, depth: 7, height: 34, yaw: 0, roof: 'cap', seed: 0.9 };
  light.y = terrain.heightAt(light.x, light.z) - 0.5;
  buildings.push(light);
  return buildings;
}

/** Whether a point is inside any building's box: used to detect a collision with the town. */
export function buildingAt(buildings, x, y, z) {
  for (const b of buildings) {
    if (y > b.y + b.height + (b.roof === 'gable' ? 3 : 0)) continue;
    const dx = x - b.x;
    const dz = z - b.z;
    if (Math.abs(dx) > 40 || Math.abs(dz) > 40) continue;
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    const u = dx * c - dz * s;
    const v = dx * s + dz * c;
    if (Math.abs(u) < b.width / 2 && Math.abs(v) < b.depth / 2 && y > b.y) return b;
  }
  return null;
}
