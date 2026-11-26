// The Saltrunner SR-2: Skerrywind's two-seat island courier. One set of numbers drives the flight
// model, the landing gear, the damage rules and the 3D model, so what you see is what flies.
// Units: metres, kilograms, seconds, newtons, radians. Body axes: +X right, +Y up, -Z nose.

export const SALTRUNNER = {
  name: 'Saltrunner SR-2',
  emptyMass: 720,
  fuelCapacity: 140,
  wingArea: 13.8,
  wingSpan: 9.8,
  chord: 1.42,

  // Lift: linear up to the stall, then it breaks away; flaps add lift and drag.
  liftSlope: 5.1,
  zeroLiftCoefficient: 0.26,
  stallAngle: 0.27,
  flapLift: [0, 0.28, 0.55],
  flapDrag: [0, 0.012, 0.045],
  flapStallShift: [0, -0.015, -0.035],
  parasiteDrag: 0.031,
  inducedDragFactor: 0.056,
  gearDrag: 0.009,
  sideForceSlope: -0.9,

  // Propulsion: a 180 hp engine and fixed-pitch propeller.
  staticThrust: 3900,
  propellerTopSpeed: 118,
  idleRpm: 700,
  maxRpm: 2700,
  fuelBurnFull: 0.0105,
  fuelBurnIdle: 0.0012,

  // Moments: static stability, damping and control power per axis.
  pitch: { inertia: 1500, stability: -0.95, damping: -16, control: 0.3, trim: 0.04 },
  roll: { inertia: 1050, damping: -0.55, control: 0.072, dihedral: -0.11 },
  yaw: { inertia: 2300, stability: 0.11, damping: -0.16, control: 0.07, adverse: -0.012 },
  propwashControl: 0.3,

  // Limits the damage model enforces.
  neverExceed: 82,
  structuralG: [-3.2, 6.2],
  landingSinkLimit: 4.2,
  hardLandingSink: 2.6,

  // Landing gear contact points (wheel bottoms) and the parts that must never touch.
  wheels: [
    { name: 'nose', at: [0, -1.52, -2.25], steer: true, spring: 42000, damper: 5200, radius: 0.27 },
    { name: 'left main', at: [-1.35, -1.55, 0.18], brake: true, spring: 62000, damper: 7000, radius: 0.3 },
    { name: 'right main', at: [1.35, -1.55, 0.18], brake: true, spring: 62000, damper: 7000, radius: 0.3 },
  ],
  hardPoints: [
    { name: 'propeller', at: [0, -0.05, -3.45] },
    { name: 'left wingtip', at: [-4.9, -0.02, 0.05] },
    { name: 'right wingtip', at: [4.9, -0.02, 0.05] },
    { name: 'tail', at: [0, -0.05, 4.1] },
    { name: 'belly', at: [0, -0.62, -0.6] },
    { name: 'fin', at: [0, 1.65, 4.0] },
    { name: 'canopy', at: [0, 1.05, -0.6] },
  ],

  // Where the pilot's eyes are, and where the lights sit (for the cockpit camera and the model).
  pilotEye: [-0.26, 0.94, -0.72],
  lights: {
    left: [-4.92, -0.02, 0.0],
    right: [4.92, -0.02, 0.0],
    tail: [0, 0.32, 4.15],
    beacon: [0, 1.72, 3.85],
    landing: [-1.6, -0.3, -0.75],
  },

  // Speeds in knots for the instrument arcs.
  arcs: { flapRange: [42, 85], normal: [50, 128], caution: [128, 159], redLine: 159 },
};

export const KNOTS = 1.943844;
export const FEET = 3.28084;
export const FEET_PER_MINUTE = 196.8504;
