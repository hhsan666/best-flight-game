// The Saltrunner SR-2 built from code: a lofted fuselage in cream and teal livery, a bubble canopy
// with the pilot inside, tapered low wings with dihedral, spatted wheels, and hinged control surfaces
// (ailerons, flaps, elevator, rudder) plus a three-blade propeller that the renderer animates.
import { MeshBuilder, MATTE, GLOSS, GLASS, GLOW } from './mesh-builder.js';
import { quatFromAxisAngle, quatRotate, normalize, sub, add } from '../core/vector-math.js';
import { SALTRUNNER } from '../flight/aircraft-spec.js';

const CREAM = [0.95, 0.93, 0.87, GLOSS];
const CREAM_SHADE = [0.86, 0.84, 0.78, GLOSS];
const TEAL = [0.04, 0.46, 0.52, GLOSS];
const ORANGE = [0.97, 0.52, 0.12, GLOSS];
const BELLY = [0.78, 0.8, 0.8, GLOSS];
const GLASS_TINT = [0.16, 0.25, 0.33, GLASS];
const METAL = [0.55, 0.56, 0.58, GLOSS];
const RUBBER = [0.08, 0.08, 0.09, MATTE];
const FIN_FRAME = quatFromAxisAngle([0, 0, 1], -Math.PI / 2);
const FIN_OFFSET = [0, 0.3, 0];

const FUSELAGE = [
  { z: -3.18, width: 0.66, top: 0.33, bottom: 0.33, y: 0.02 },
  { z: -2.95, width: 0.92, top: 0.45, bottom: 0.44, y: 0.02 },
  { z: -2.45, width: 1.06, top: 0.52, bottom: 0.5, y: 0.02 },
  { z: -1.6, width: 1.14, top: 0.56, bottom: 0.56, y: 0.0 },
  { z: -0.5, width: 1.12, top: 0.54, bottom: 0.58, y: 0.0 },
  { z: 0.7, width: 0.96, top: 0.48, bottom: 0.46, y: 0.02 },
  { z: 2.0, width: 0.66, top: 0.38, bottom: 0.3, y: 0.08 },
  { z: 3.3, width: 0.34, top: 0.26, bottom: 0.15, y: 0.18 },
  { z: 4.12, width: 0.08, top: 0.08, bottom: 0.05, y: 0.24 },
];

const ANTI_GLARE = [0.1, 0.11, 0.12, MATTE];

function fuselageColour(section, angle) {
  const side = Math.cos(angle);
  if (section.z < -1.5 && side > 0.86) return ANTI_GLARE;
  if (section.z < -2.5) return side > -0.2 ? TEAL : BELLY;
  if (side < -0.62) return BELLY;
  if (side > -0.22 && side < 0.12) return TEAL;
  if (side >= 0.12 && side < 0.22) return ORANGE;
  return CREAM;
}

/** One airfoil panel between two span stations, from the leading edge to the hinge line. */
function wingPanel(b, inner, outer, colour, hingeAt = 0.74) {
  const station = (s) => {
    const crest = s.le + s.chord * 0.3;
    const hinge = s.le + s.chord * hingeAt;
    return {
      le: [s.x, s.y, s.le],
      topCrest: [s.x, s.y + s.thick * 0.62, crest],
      bottomCrest: [s.x, s.y - s.thick * 0.38, crest],
      topHinge: [s.x, s.y + s.thick * 0.22, hinge],
      bottomHinge: [s.x, s.y - s.thick * 0.12, hinge],
    };
  };
  const a = station(inner);
  const c = station(outer);
  const flip = inner.x > outer.x;
  const quad = (p0, p1, p2, p3, col) => b.polygon(flip ? [p3, p2, p1, p0] : [p0, p1, p2, p3], col);
  quad(a.le, c.le, c.topCrest, a.topCrest, colour);
  quad(a.topCrest, c.topCrest, c.topHinge, a.topHinge, colour);
  quad(a.bottomCrest, c.bottomCrest, c.le, a.le, CREAM_SHADE);
  quad(a.bottomHinge, c.bottomHinge, c.bottomCrest, a.bottomCrest, CREAM_SHADE);
  quad(a.topHinge, c.topHinge, c.bottomHinge, a.bottomHinge, CREAM_SHADE);
  b.polygon(flip ? [c.le, c.bottomCrest, c.bottomHinge, c.topHinge, c.topCrest] : [c.le, c.topCrest, c.topHinge, c.bottomHinge, c.bottomCrest], colour);
}

/** A control surface from the hinge line to the trailing edge, with its hinge pivot and axis. */
function controlSurface(inner, outer, colour, hingeAt = 0.74, frame = null, offset = [0, 0, 0]) {
  const b = new MeshBuilder();
  const place = (p) => (frame ? add(quatRotate(frame, p), offset) : p);
  const pts = (s) => ({
    top: place([s.x, s.y + s.thick * 0.22, s.le + s.chord * hingeAt]),
    bottom: place([s.x, s.y - s.thick * 0.12, s.le + s.chord * hingeAt]),
    trail: place([s.x, s.y, s.le + s.chord]),
  });
  const a = pts(inner);
  const c = pts(outer);
  b.polygon([a.top, c.top, c.trail, a.trail], colour);
  b.polygon([a.trail, c.trail, c.bottom, a.bottom], colour);
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
  const pivot = mid(a.top, a.bottom);
  return { mesh: b.build(), pivot, axis: normalize(sub(mid(c.top, c.bottom), pivot)) };
}

function wingStation(sign, x) {
  const t = (x - 0.5) / 4.35;
  return {
    x: sign * x,
    y: -0.4 + (x - 0.5) * Math.tan((5 * Math.PI) / 180),
    chord: 1.7 - 0.7 * t,
    le: -0.78 + 0.31 * t,
    thick: 0.24 - 0.14 * t,
  };
}

const tailStation = (x, chord, le) => ({ x, y: 0.24, chord, le, thick: 0.08 });

/** Block glyphs on a 3x5 grid: rectangles [u0, v0, u1, v1], v growing toward the leading edge. */
const GLYPHS = {
  S: [[0, 4, 3, 5], [0, 2, 3, 3], [0, 0, 3, 1], [0, 2, 1, 5], [2, 0, 3, 3]],
  K: [[0, 0, 1, 5], [1, 2, 2, 3], [2, 3, 3, 5], [2, 0, 3, 2]],
  R: [[0, 0, 1, 5], [0, 4, 3, 5], [0, 2, 3, 3], [2, 2, 3, 5], [1.6, 0, 2.6, 2]],
  W: [[0, 0, 1, 5], [3, 0, 4, 5], [1.5, 0, 2.5, 3], [0, 0, 4, 1]],
  D: [[0, 0, 1, 5], [0, 4, 2.2, 5], [0, 0, 2.2, 1], [2, 1, 3, 4]],
  '-': [[0, 2, 2, 3]],
};

/** The registration painted on top of the right wing, following the airfoil's upper surface. */
function paintRegistration(b, text) {
  const ink = [0.05, 0.3, 0.34, GLOSS];
  const cell = 0.075;
  let x = 0.64;
  for (const ch of text) {
    for (const [u0, v0, u1, v1] of GLYPHS[ch] ?? []) {
      const corner = (u, v) => {
        const px = x + u * cell;
        const s = wingStation(1, px);
        const z = s.le + s.chord * 0.71 - v * cell;
        const t = (z - s.le) / s.chord;
        const lift = t < 0.3 ? (t / 0.3) * 0.62 : 0.62 - ((t - 0.3) / 0.44) * 0.4;
        return [px, s.y + s.thick * lift + 0.012, z];
      };
      b.polygon([corner(u0, v0), corner(u1, v0), corner(u1, v1), corner(u0, v1)].reverse(), ink);
    }
    x += ((GLYPHS[ch]?.reduce((m, r) => Math.max(m, r[2]), 0) ?? 2) + 1.2) * cell;
  }
}
const finStation = (h, chord, le) => ({ x: -h, y: 0, chord, le, thick: 0.08 });

function addWheel(b, hub, radius, width) {
  b.withFrame(quatFromAxisAngle([0, 0, 1], Math.PI / 2), hub, () => {
    b.cylinder(radius, radius, -width / 2, width / 2, 12, RUBBER);
    b.cylinder(radius * 0.45, radius * 0.45, -width / 2 - 0.01, width / 2 + 0.01, 8, METAL);
  });
  b.blob([hub[0], hub[1] + 0.05, hub[2] - 0.05], [width * 0.95, radius * 1.05, radius * 1.9], CREAM);
}

/** Three blades around the hub, built in the propeller's own frame (it spins about Z). */
function propellerMesh() {
  const b = new MeshBuilder();
  for (let k = 0; k < 3; k++) {
    b.withFrame(quatFromAxisAngle([0, 0, 1], (k / 3) * Math.PI * 2), [0, 0, 0], () => {
      b.withFrame(quatFromAxisAngle([0, 1, 0], 0.35), [0, 0, 0], () => {
        b.box([-0.07, 0.12, -0.02], [0.07, 0.78, 0.02], [0.14, 0.14, 0.15, MATTE]);
        b.box([-0.06, 0.78, -0.02], [0.06, 0.92, 0.02], [0.98, 0.78, 0.1, MATTE]);
      });
    });
  }
  return b.build();
}

/** Builds every part of the aircraft; movable parts carry their hinge pivot and axis. */
export function buildAircraftParts() {
  const body = new MeshBuilder();
  body.loft(FUSELAGE, 20, fuselageColour);
  body.polygon(Array.from({ length: 10 }, (_, i) => {
    const a = (-i / 10) * Math.PI * 2;
    return [Math.sin(a) * 0.04, 0.24 + Math.cos(a) * 0.04, 4.13];
  }), CREAM);
  body.withFrame(quatFromAxisAngle([1, 0, 0], -Math.PI / 2), [0, 0.02, -3.18], () => body.cylinder(0.3, 0.02, 0, 0.42, 14, ORANGE, { caps: false }));
  body.box([-0.28, -0.3, -3.12], [0.28, -0.18, -2.9], [0.08, 0.09, 0.1, MATTE]);
  const cabin = new MeshBuilder();
  cabin.loft([
    { z: -1.55, width: 0.7, top: 0.01, bottom: 0.01, y: 0.5 },
    { z: -1.2, width: 0.9, top: 0.33, bottom: 0.02, y: 0.5 },
    { z: -0.5, width: 0.98, top: 0.5, bottom: 0.02, y: 0.5 },
    { z: 0.3, width: 0.9, top: 0.42, bottom: 0.02, y: 0.48 },
    { z: 1.15, width: 0.5, top: 0.05, bottom: 0.02, y: 0.45 },
  ], 16, () => GLASS_TINT);
  cabin.blob([-0.2, 0.76, -0.55], [0.12, 0.14, 0.13], [0.86, 0.66, 0.5, MATTE]);
  cabin.blob([-0.2, 0.84, -0.56], [0.13, 0.09, 0.14], [0.2, 0.22, 0.26, MATTE]);
  cabin.blob([0.2, 0.76, -0.35], [0.12, 0.14, 0.13], [0.86, 0.66, 0.5, MATTE]);
  for (const sign of [-1, 1]) {
    wingPanel(body, wingStation(sign, 0.5), wingStation(sign, 2.55), CREAM);
    wingPanel(body, wingStation(sign, 2.55), wingStation(sign, 2.75), CREAM, 1.0);
    wingPanel(body, wingStation(sign, 2.75), wingStation(sign, 4.3), CREAM);
    wingPanel(body, wingStation(sign, 4.3), wingStation(sign, 4.85), TEAL);
    wingPanel(body, tailStation(sign * 0.12, 0.95, 3.12), tailStation(sign * 1.65, 0.6, 3.38), CREAM, 0.58);
  }
  body.withFrame(FIN_FRAME, FIN_OFFSET, () => wingPanel(body, finStation(0, 1.25, 2.85), finStation(1.35, 0.68, 3.42), TEAL, 0.6));
  paintRegistration(body, 'SK-RWD');
  for (const sign of [-1, 1]) {
    body.polygon([[sign * 0.42, -0.5, 0.05], [sign * 1.33, -1.22, 0.12], [sign * 1.33, -1.22, 0.26], [sign * 0.42, -0.5, 0.3]], METAL);
    addWheel(body, [sign * 1.35, -1.25, 0.18], 0.3, 0.16);
  }
  body.withFrame([0, 0, 0, 1], [0, 0, -2.25], () => body.cylinder(0.05, 0.05, -1.22, -0.45, 6, METAL));
  addWheel(body, [0, -1.25, -2.25], 0.27, 0.13);
  for (const [name, colour] of [['left', [1, 0.15, 0.1]], ['right', [0.15, 1, 0.3]], ['tail', [1, 1, 1]]]) {
    body.blob(SALTRUNNER.lights[name], [0.07, 0.05, 0.08], [...colour, GLOW]);
  }

  return {
    body: body.build(),
    cabin: cabin.build(),
    aileronLeft: controlSurface(wingStation(-1, 2.75), wingStation(-1, 4.85), CREAM_SHADE),
    aileronRight: controlSurface(wingStation(1, 2.75), wingStation(1, 4.85), CREAM_SHADE),
    flapLeft: controlSurface(wingStation(-1, 0.5), wingStation(-1, 2.55), CREAM_SHADE),
    flapRight: controlSurface(wingStation(1, 0.5), wingStation(1, 2.55), CREAM_SHADE),
    elevatorLeft: controlSurface(tailStation(-0.12, 0.95, 3.12), tailStation(-1.65, 0.6, 3.38), CREAM_SHADE, 0.58),
    elevatorRight: controlSurface(tailStation(0.12, 0.95, 3.12), tailStation(1.65, 0.6, 3.38), CREAM_SHADE, 0.58),
    rudder: controlSurface(finStation(0, 1.25, 2.85), finStation(1.35, 0.68, 3.42), TEAL, 0.6, FIN_FRAME, FIN_OFFSET),
    propeller: propellerMesh(),
    propellerHub: [0, 0.02, -3.32],
  };
}
