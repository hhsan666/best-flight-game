// Time of day and weather: sun position, sky and fog colours, cloud cover and wind for each preset.
// Colours are written as display colours and converted to linear light here, once.

const toLinear = (rgb, scale = 1) => rgb.map((c) => c * c * scale);

function sunDirection(azimuthDegrees, elevationDegrees) {
  const az = (azimuthDegrees * Math.PI) / 180;
  const el = (elevationDegrees * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

const PRESETS = {
  morning: {
    label: 'Morning',
    sun: [158, 22], sunColor: [1.0, 0.88, 0.7], sunPower: 2.5,
    zenith: [0.32, 0.55, 0.86], horizon: [0.78, 0.84, 0.92], fog: [0.74, 0.8, 0.88],
    groundAmbient: [0.3, 0.32, 0.26], fogDensity: 0.00011, fogFalloff: 0.0012, exposure: 1.45, night: 0, clouds: 0.35,
  },
  noon: {
    label: 'Midday',
    sun: [160, 58], sunColor: [1.0, 0.97, 0.92], sunPower: 2.6,
    zenith: [0.22, 0.47, 0.86], horizon: [0.7, 0.82, 0.95], fog: [0.72, 0.81, 0.92],
    groundAmbient: [0.3, 0.33, 0.27], fogDensity: 0.00009, fogFalloff: 0.0011, exposure: 1.35, night: 0, clouds: 0.45,
  },
  golden: {
    label: 'Golden hour',
    sun: [182, 19], sunColor: [1.0, 0.76, 0.48], sunPower: 2.8,
    zenith: [0.25, 0.44, 0.78], horizon: [0.98, 0.82, 0.64], fog: [0.88, 0.78, 0.68],
    groundAmbient: [0.34, 0.3, 0.25], fogDensity: 0.00011, fogFalloff: 0.0012, exposure: 1.55, night: 0, clouds: 0.75,
  },
  dusk: {
    label: 'Dusk',
    sun: [282, 1.5], sunColor: [1.0, 0.5, 0.28], sunPower: 1.6,
    zenith: [0.1, 0.14, 0.32], horizon: [0.9, 0.5, 0.34], fog: [0.42, 0.33, 0.4],
    groundAmbient: [0.12, 0.11, 0.14], fogDensity: 0.00013, fogFalloff: 0.0013, exposure: 2.1, night: 0.85, clouds: 0.3,
  },
  storm: {
    label: 'Squall',
    sun: [200, 32], sunColor: [0.9, 0.92, 0.95], sunPower: 0.95,
    zenith: [0.42, 0.47, 0.54], horizon: [0.62, 0.65, 0.68], fog: [0.6, 0.63, 0.66],
    groundAmbient: [0.26, 0.27, 0.27], fogDensity: 0.00026, fogFalloff: 0.0009, exposure: 1.6, night: 0.15, clouds: 0.85, rain: 0.75,
  },
};

export const SKY_PRESET_NAMES = Object.keys(PRESETS);

/** The atmosphere a frame is rendered with: everything the shaders' shared uniforms need. */
export function buildAtmosphere(name) {
  const p = PRESETS[name] ?? PRESETS.golden;
  const sunDir = sunDirection(p.sun[0], p.sun[1]);
  const lightDir = sunDir[1] < 0.06 ? [sunDir[0], 0.06, sunDir[2]] : sunDir;
  const len = Math.hypot(...lightDir);
  return {
    name,
    label: p.label,
    sunDirection: lightDir.map((v) => v / len),
    sunAzimuth: p.sun[0],
    sunColor: toLinear(p.sunColor, p.sunPower),
    zenithColor: toLinear(p.zenith),
    horizonColor: toLinear(p.horizon),
    fogColor: toLinear(p.fog),
    skyAmbient: toLinear(p.zenith.map((c, i) => c * 0.75 + p.horizon[i] * 0.25), 1.0),
    groundAmbient: toLinear(p.groundAmbient),
    fogDensity: p.fogDensity,
    fogFalloff: p.fogFalloff,
    exposure: p.exposure,
    night: p.night,
    clouds: p.clouds,
    rain: p.rain ?? 0,
    snowLine: 860,
  };
}
