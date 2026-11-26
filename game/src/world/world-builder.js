// Assembles the whole world from one seed: terrain, forests, towns, airfields, and the surface
// query the landing gear uses (ground or water, its slope, and whether it is runway).
import { generateArchipelago } from './archipelago.js';
import { createForestField, plantForests } from './vegetation.js';
import { buildSettlements } from './settlements.js';
import { AIRFIELDS } from './landmarks.js';

/** The airfield whose paved runway (with shoulders) contains a point, or null. */
export function runwayUnder(x, z) {
  for (const field of AIRFIELDS) {
    const h = (field.heading * Math.PI) / 180;
    const dx = x - field.x;
    const dz = z - field.z;
    const along = dx * Math.sin(h) - dz * Math.cos(h);
    const across = dx * Math.cos(h) + dz * Math.sin(h);
    if (Math.abs(along) <= field.length / 2 + 15 && Math.abs(across) <= field.width / 2 + 4) return { field, along, across };
  }
  return null;
}

export function buildWorld(seed) {
  const terrain = generateArchipelago(seed);
  const forestDensity = createForestField(terrain, seed);
  const forest = plantForests(terrain, seed, forestDensity);
  const buildings = buildSettlements(terrain, seed);
  const surfaceAt = (x, z) => {
    const height = terrain.heightAt(x, z);
    if (height < 0) return { height: 0, normal: [0, 1, 0], water: true, runway: false };
    return { height, normal: terrain.normalAt(x, z), water: false, runway: runwayUnder(x, z) !== null };
  };
  return { seed, terrain, forestDensity, forest, buildings, surfaceAt, airfields: AIRFIELDS };
}
