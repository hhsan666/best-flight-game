// Skerrywind's sorties. Each has its own goal, sky, wind and fuel load, so they ask for different
// skills: a first circuit, a low canyon time trial, a fuel-tight delivery into a headwind, a gusty
// crosswind landing in a squall, and a dusk run that ends on a lit runway.

export const MISSIONS = [
  {
    id: 'first-light',
    title: 'First Light',
    tagline: 'Take off, thread the harbour rings, land home',
    brief: 'The mail boat is late, so the morning run is yours. Lift off from Halloway Field, fly the seven harbour rings past Ness Light and over Port Halloway, then bring the Saltrunner back down on either runway.',
    sky: 'morning', wind: { from: 250, knots: 6, gust: 2 }, fuel: 0.42,
    start: { airfield: 'halloway', end: 0 },
    steps: [{ type: 'takeoff' }, { type: 'rings', course: 'harbour' }, { type: 'land', airfield: 'halloway' }],
    par: 300, medals: [2600, 2100, 1500],
  },
  {
    id: 'silverrun-gates',
    title: 'Silverrun Gates',
    tagline: 'Twelve gates up the river canyon, against the clock',
    brief: 'Race the Silverrun from its mouth to the Cairnhold foothills. The gates follow the river through every bend and climb with the valley. Carry speed, keep the turns tight, and do not touch the slopes.',
    sky: 'golden', wind: { from: 200, knots: 4, gust: 3 }, fuel: 0.3,
    start: { air: { x: 2300, z: 4300, altitude: 130, heading: 320, speed: 52 } },
    steps: [{ type: 'rings', course: 'silverrun' }],
    par: 150, medals: [2400, 1900, 1300],
  },
  {
    id: 'ostmere-mail',
    title: 'Mail to Ostmere',
    tagline: 'A fuel-tight crossing into a stiff headwind',
    brief: 'The Ostmere post office needs the mail before the afternoon ferry. You have barely enough fuel for the crossing into a stiff north-easterly: climb, ease back to an economical throttle, and land on the short Ostmere strip before the tank runs dry.',
    sky: 'noon', wind: { from: 40, knots: 16, gust: 4 }, fuel: 0.16,
    start: { airfield: 'halloway', end: 0 },
    steps: [{ type: 'takeoff' }, { type: 'fly-to', airfield: 'ostmere', label: 'OSTMERE' }, { type: 'land', airfield: 'ostmere' }],
    par: 330, medals: [2500, 2000, 1400],
  },
  {
    id: 'squall-final',
    title: 'Squall Final',
    tagline: 'A gusty crosswind landing under the squall line',
    brief: 'A squall is crossing Halloway with the wind across runway 25. You are on a long final with flaps out. Hold the centreline with crab and rudder, keep two white and two red on the PAPI, and put it down gently.',
    sky: 'storm', wind: { from: 330, knots: 15, gust: 9 }, fuel: 0.2,
    start: { approach: { airfield: 'halloway', end: 1, distance: 4200, height: 230, speed: 40, flaps: 1 } },
    steps: [{ type: 'land', airfield: 'halloway' }],
    par: 150, medals: [1900, 1500, 1000],
  },
  {
    id: 'lantern-run',
    title: 'Lantern Run',
    tagline: 'Dusk rings over the lit coast, then a night landing',
    brief: 'Bring the last parcels home as the lights come on. Seven lantern rings lead from Ostmere across the strait, past Ness Light and over the rooftops of Port Halloway. Finish on the lit runway at Halloway: follow the PAPI down.',
    sky: 'dusk', wind: { from: 270, knots: 5, gust: 2 }, fuel: 0.3,
    start: { air: { x: 4800, z: -2200, altitude: 170, heading: 225, speed: 50 } },
    steps: [{ type: 'rings', course: 'lantern' }, { type: 'land', airfield: 'halloway' }],
    par: 330, medals: [2800, 2200, 1600],
  },
  {
    id: 'free-flight',
    title: 'Free Flight',
    tagline: 'No clock, no rings: explore the isles',
    brief: 'Take the Saltrunner anywhere: the snowy Cairnhold peaks, the Silverrun canyon, the lighthouse, the Ostmere strip. Full tanks, golden light, and nobody counting.',
    sky: 'golden', wind: { from: 260, knots: 6, gust: 2 }, fuel: 1,
    start: { airfield: 'halloway', end: 0 },
    steps: [{ type: 'explore' }],
    par: 0, medals: null,
  },
];

export const missionById = (id) => MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
