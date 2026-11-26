// The Skerrywind Isles: the hand-placed layout the seeded generator builds around. Islands, the
// Cairnhold range, the Silverrun river, two airfields, the towns and the lighthouse all live here,
// so missions and the map can name them. Positions are metres: +X east, +Z south.

export const WORLD_NAME = 'The Skerrywind Isles';
export const DEFAULT_SEED = 7;

/** Island footprints (several lobes make one island): centre, radii, rotation, and how hilly it is. */
export const ISLANDS = [
  { name: 'Halloway', x: -900, z: 150, rx: 3700, rz: 2900, angle: 0.32, hills: 1.0 },
  { name: 'Halloway', x: 1250, z: -1250, rx: 1650, rz: 800, angle: -0.75, hills: 0.7 },
  { name: 'Halloway', x: 2150, z: 2350, rx: 1650, rz: 1050, angle: 0.42, hills: 0.35 },
  { name: 'Halloway', x: -3500, z: 2650, rx: 1450, rz: 700, angle: -0.6, hills: 0.6 },
  { name: 'Ostmere', x: 4350, z: -3050, rx: 1750, rz: 1150, angle: -0.55, hills: 0.6 },
  { name: 'Ostmere', x: 5300, z: -1900, rx: 800, rz: 420, angle: 1.1, hills: 0.4 },
  { name: 'Brindle', x: -5050, z: -3850, rx: 950, rz: 700, angle: 0.2, hills: 0.5 },
  { name: 'Gull Skerry', x: 3900, z: 4050, rx: 650, rz: 430, angle: 0.9, hills: 0.3 },
  { name: 'Tarn Rock', x: 5550, z: 1150, rx: 380, rz: 300, angle: 0, hills: 0.25 },
];

/** Bays bitten out of the coast: the harbour where the Silverrun meets the sea, and two coves. */
export const BAYS = [
  { name: 'Halloway Harbour', x: 850, z: 3300, radius: 650 },
  { name: 'Westwater Cove', x: -4900, z: 350, radius: 520 },
  { name: 'Skua Inlet', x: -300, z: -2950, radius: 600 },
];

/** The snow-capped range on Halloway's north-west, and the river that drains it to the south coast. */
export const CAIRNHOLD_RANGE = { name: 'Cairnhold', x: -2350, z: -1350, radius: 2750, height: 1320 };
export const SILVERRUN_RIVER = { name: 'Silverrun', sourceX: -1650, sourceZ: -650, mouthX: 1750, mouthZ: 3350 };

/**
 * Runways: centre, true heading of the "low" end's direction of travel (degrees), length and width.
 * Halloway Field sits on the coastal plain east of the river mouth; Ostmere Strip is short and windy.
 */
export const AIRFIELDS = [
  { id: 'halloway', name: 'Halloway Field', code: 'HLW', x: 2350, z: 2350, heading: 68, length: 1500, width: 32, elevation: 9 },
  { id: 'ostmere', name: 'Ostmere Strip', code: 'OST', x: 4250, z: -2950, heading: 122, length: 980, width: 24, elevation: 24 },
];

/** Towns and their rough sizes; buildings are scattered on a street grid around each centre. */
export const TOWNS = [
  { id: 'port-halloway', name: 'Port Halloway', x: 1250, z: 2700, radius: 520, buildings: 150, streetAngle: 0.45 },
  { id: 'ostmere', name: 'Ostmere', x: 3650, z: -3350, radius: 300, buildings: 55, streetAngle: -0.5 },
  { id: 'brindle-cove', name: 'Brindle Cove', x: -4800, z: -3550, radius: 200, buildings: 26, streetAngle: 0.2 },
  { id: 'cairn-hollow', name: 'Cairn Hollow', x: -520, z: 620, radius: 220, buildings: 30, streetAngle: 0.9 },
];

/** A lighthouse on the headland south of Port Halloway: a tall, striped landmark for approaches. */
export const LIGHTHOUSE = { name: 'Ness Light', x: 3450, z: 2930 };

/** Runway designators ("07", "25") from a heading in degrees. */
export function runwayNumber(headingDegrees) {
  const n = Math.round((((headingDegrees % 360) + 360) % 360) / 10) || 36;
  return String(n === 0 ? 36 : n).padStart(2, '0');
}

/** Whether a point lies under a final-approach funnel (kept clear of buildings and trees). */
export function inApproachFunnel(x, z, length = 1800) {
  for (const field of AIRFIELDS) {
    const h = (field.heading * Math.PI) / 180;
    const along = (x - field.x) * Math.sin(h) - (z - field.z) * Math.cos(h);
    const across = Math.abs((x - field.x) * Math.cos(h) + (z - field.z) * Math.sin(h));
    const before = Math.abs(along) - field.length / 2;
    if (before > 0 && before < length && across < 110 + before * 0.14) return true;
  }
  return false;
}

/** The two thresholds of a runway, each with the heading of a landing toward the far end. */
export function runwayEnds(airfield) {
  const h = (airfield.heading * Math.PI) / 180;
  const dir = [Math.sin(h), 0, -Math.cos(h)];
  const half = airfield.length / 2;
  const low = { x: airfield.x - dir[0] * half, z: airfield.z - dir[2] * half, heading: airfield.heading };
  const high = { x: airfield.x + dir[0] * half, z: airfield.z + dir[2] * half, heading: (airfield.heading + 180) % 360 };
  low.name = runwayNumber(low.heading);
  high.name = runwayNumber(high.heading);
  return [low, high];
}
