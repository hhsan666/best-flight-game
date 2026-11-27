// GLSL for every pass: terrain, sea and river, sky, lit meshes (aircraft, buildings, trees, rings),
// glowing point lights and particles, cloud billboards, the textured runway, and the ground shadow.
// All lighting happens in linear colour; toDisplay() tone-maps and gamma-encodes at the end.

const ATMOSPHERE = /* glsl */ `
uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundAmbient;
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uNight;
uniform float uExposure;
uniform float uTime;
uniform vec4 uLandingLight;
uniform vec3 uLandingDir;
uniform sampler2D uTerrainLight;
uniform vec2 uTerrainMap;
uniform float uUseTerrainLight;

vec3 toLinear(vec3 c) { return c * c; }

vec2 terrainLight(vec3 p) {
  if (uUseTerrainLight < 0.5) return vec2(0.0);
  return texture(uTerrainLight, (p.xz + uTerrainMap.x) / uTerrainMap.y).rg;
}
vec3 toDisplay(vec3 c) {
  c = sqrt(vec3(1.0) - exp(-c * uExposure));
  vec3 curved = c * c * (3.0 - 2.0 * c);
  c = mix(c, curved, 0.28);
  float grey = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(vec3(grey), c, 1.08);
}

vec3 skyRadiance(vec3 dir) {
  float up = clamp(dir.y, -1.0, 1.0);
  vec3 sky = mix(uHorizonColor, uZenithColor, pow(smoothstep(-0.02, 0.6, up), 0.45));
  float sun = max(dot(dir, uSunDir), 0.0);
  sky += uSunColor * (pow(sun, 7.0) * 0.18 + pow(sun, 140.0) * 0.32);
  return mix(sky, uFogColor, smoothstep(0.04, -0.12, up));
}

float fogFactor(vec3 worldPos) {
  vec3 ray = worldPos - uCameraPos;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-3);
  float k = dist * dir.y * uFogFalloff;
  float path = abs(k) < 1e-4 ? dist : (1.0 - exp(-k)) / (dir.y * uFogFalloff);
  float depth = uFogDensity * exp(-max(uCameraPos.y, 0.0) * uFogFalloff) * path;
  return clamp(1.0 - exp(-max(depth, 0.0)), 0.0, 1.0);
}

vec3 applyFog(vec3 color, vec3 worldPos) {
  vec3 dir = normalize(worldPos - uCameraPos);
  float sun = pow(max(dot(dir, uSunDir), 0.0), 6.0);
  vec3 haze = uFogColor + uSunColor * 0.3 * sun;
  return mix(color, haze, fogFactor(worldPos));
}

vec3 litSurface(vec3 albedo, vec3 n, vec3 worldPos, float shine) {
  vec2 tl = terrainLight(worldPos);
  float diffuse = max(dot(n, uSunDir), 0.0) * (1.0 - tl.r * 0.86);
  vec3 ambient = mix(uGroundAmbient, uSkyAmbient, n.y * 0.5 + 0.5) * (1.0 - tl.g * 0.45) * (1.0 + tl.r * 0.12);
  vec3 color = albedo * (ambient + uSunColor * diffuse);
  if (shine > 0.0) {
    vec3 v = normalize(uCameraPos - worldPos);
    vec3 h = normalize(v + uSunDir);
    color += uSunColor * pow(max(dot(n, h), 0.0), 70.0) * shine * step(0.0, diffuse);
    vec3 r = reflect(-v, n);
    color += skyRadiance(r) * shine * 0.12 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
  }
  if (uLandingLight.w > 0.0) {
    vec3 toLight = uLandingLight.xyz - worldPos;
    float d = length(toLight);
    vec3 l = toLight / d;
    float cone = smoothstep(0.88, 0.975, dot(-l, uLandingDir));
    color += albedo * vec3(1.0, 0.93, 0.8) * uLandingLight.w * cone * max(dot(n, l), 0.0) * 2600.0 / (d * d + 900.0);
  }
  return color;
}
`;

const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const HEADER = '#version 300 es\nprecision highp float;\nprecision highp int;\n';

export const TERRAIN_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aSurface;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vSurface;
void main() {
  vWorld = aPosition;
  vNormal = aNormal;
  vSurface = aSurface;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}`;

export const TERRAIN_FRAGMENT = `${HEADER}
in vec3 vWorld;
in vec3 vNormal;
in vec4 vSurface;
out vec4 outColor;
uniform float uSnowLine;
${ATMOSPHERE}
${NOISE}
vec3 farmland(vec2 xz) {
  vec2 q = mat2(0.9, -0.43, 0.43, 0.9) * xz / vec2(120.0, 75.0);
  vec2 cell = floor(q);
  float pick = hash12(cell + 7.0);
  vec3 crop = pick < 0.25 ? vec3(0.74, 0.66, 0.32) : pick < 0.5 ? vec3(0.44, 0.60, 0.22) : pick < 0.68 ? vec3(0.58, 0.45, 0.30) : vec3(0.36, 0.52, 0.19);
  vec2 edge = abs(fract(q) - 0.5);
  crop *= 0.93 + 0.07 * sin((q.x * 1.7 + q.y * 0.3 + pick * 5.0) * 38.0);
  return mix(crop, vec3(0.17, 0.29, 0.11), smoothstep(0.46, 0.5, max(edge.x, edge.y)));
}
vec3 terrainAlbedo(vec3 p, vec3 n, vec4 s) {
  float steep = 1.0 - n.y;
  float n1 = valueNoise(p.xz * 0.011);
  float n2 = valueNoise(p.xz * 0.085);
  float n3 = valueNoise(p.xz * 0.55);
  vec3 grass = mix(vec3(0.33, 0.55, 0.21), vec3(0.47, 0.60, 0.26), n1);
  grass = mix(grass, vec3(0.58, 0.60, 0.33), smoothstep(0.6, 0.85, n2) * 0.45);
  vec3 forest = mix(vec3(0.12, 0.26, 0.11), vec3(0.19, 0.33, 0.14), n2);
  vec3 rock = mix(vec3(0.43, 0.41, 0.38), vec3(0.58, 0.54, 0.49), n2);
  vec3 sand = mix(vec3(0.88, 0.81, 0.62), vec3(0.79, 0.71, 0.53), n3);
  vec3 c = grass;
  if (s.x > 0.01) c = mix(c, farmland(p.xz), s.x);
  c = mix(c, forest, s.y);
  c = mix(c, mix(vec3(0.56, 0.53, 0.47), vec3(0.36, 0.48, 0.25), step(0.55, n2)) * (0.85 + 0.3 * n3), s.z * 0.45);
  float rockiness = smoothstep(0.26, 0.48, steep + (n2 - 0.5) * 0.16) + smoothstep(620.0, 880.0, p.y + n1 * 90.0) * 0.7;
  c = mix(c, rock, clamp(rockiness, 0.0, 1.0));
  float snowy = smoothstep(uSnowLine, uSnowLine + 80.0, p.y + n1 * 140.0) * (1.0 - smoothstep(0.42, 0.72, steep));
  c = mix(c, vec3(0.93, 0.95, 0.99), snowy);
  float beach = 1.0 - smoothstep(1.6, 4.2, p.y + n3 * 1.3);
  c = mix(c, sand, beach * (1.0 - s.z * 0.8));
  c = mix(c, vec3(0.56, 0.53, 0.41), 1.0 - smoothstep(-5.0, 0.2, p.y));
  c = mix(c, c * 0.72, s.w);
  float tufts = valueNoise(p.xz * 0.23) * 0.6 + valueNoise(p.xz * 1.7) * 0.4;
  float grassy = (1.0 - rockiness) * (1.0 - snowy) * (1.0 - beach) * smoothstep(0.0, 3.0, p.y);
  c *= mix(1.0, 0.78 + 0.34 * tufts, grassy);
  c *= 0.86 + 0.14 * smoothstep(0.0, 0.25, n.y - 0.75) + 0.1 * (n1 - 0.5);
  return c * (0.92 + 0.16 * n3);
}
void main() {
  vec3 n = normalize(vNormal);
  vec3 albedo = toLinear(terrainAlbedo(vWorld, n, vSurface));
  vec3 color = applyFog(litSurface(albedo, n, vWorld, 0.0), vWorld);
  outColor = vec4(toDisplay(color), 1.0);
}`;

export const WATER_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
uniform mat4 uViewProj;
out vec3 vWorld;
void main() {
  vWorld = aPosition;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}`;

export const WATER_FRAGMENT = `${HEADER}
in vec3 vWorld;
out vec4 outColor;
uniform sampler2D uHeightMap;
uniform float uWorldHalf;
uniform float uWorldSize;
uniform float uFlow;
${ATMOSPHERE}
${NOISE}
vec3 waveNormal(vec2 p, float t, float dist) {
  vec2 g = vec2(0.0);
  vec2 dirs[4] = vec2[4](vec2(0.95, 0.31), vec2(-0.62, 0.78), vec2(0.21, -0.98), vec2(-0.86, -0.51));
  float freqs[4] = float[4](0.05, 0.083, 0.13, 0.21);
  float speeds[4] = float[4](0.8, 1.2, 1.7, 2.3);
  for (int i = 0; i < 4; i++) {
    float wavelength = 6.2832 / freqs[i];
    float fade = 1.0 - smoothstep(wavelength * 2.5, wavelength * 9.0, dist);
    float phase = dot(p, dirs[i]) * freqs[i] + t * speeds[i];
    g += dirs[i] * cos(phase) * freqs[i] * (1.4 / (float(i) + 1.0)) * fade;
  }
  float near = 1.0 - smoothstep(40.0, 220.0, dist);
  float a = valueNoise(p * 0.32 + vec2(t * 0.35, t * 0.1 * uFlow));
  float b = valueNoise(p * 0.32 + vec2(-t * 0.1, t * 0.35));
  g += vec2(a - 0.5, b - 0.5) * 0.12 * near;
  float c = valueNoise(p * 0.045 + vec2(t * 0.05, -t * 0.03));
  g += vec2(c - 0.5, 0.5 - c) * 0.05 * (1.0 - smoothstep(300.0, 1500.0, dist));
  return normalize(vec3(-g.x, 1.0, -g.y));
}
void main() {
  vec2 uv = (vWorld.xz + uWorldHalf) / uWorldSize;
  bool inside = uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0;
  float ground = inside ? texture(uHeightMap, uv).r : -90.0;
  float depth = max(0.0, vWorld.y - ground);
  vec3 toCamera = uCameraPos - vWorld;
  float dist = length(toCamera);
  vec3 v = toCamera / dist;
  vec3 n = waveNormal(vWorld.xz, uTime, dist);
  vec3 shallow = uFlow > 0.5 ? toLinear(vec3(0.3, 0.62, 0.6)) : toLinear(vec3(0.22, 0.70, 0.67));
  vec3 deep = uFlow > 0.5 ? toLinear(vec3(0.12, 0.38, 0.45)) : toLinear(vec3(0.03, 0.19, 0.33));
  vec3 body = mix(shallow, deep, smoothstep(0.5, uFlow > 0.5 ? 4.0 : 30.0, depth));
  vec2 tl = terrainLight(vWorld);
  vec3 lit = body * (uSkyAmbient * 0.95 + uSunColor * max(uSunDir.y, 0.05) * 0.6 * (1.0 - tl.r * 0.8));
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  vec3 color = mix(lit, skyRadiance(r), fresnel * mix(0.9, 0.55, smoothstep(800.0, 6000.0, dist)) * (uFlow > 0.5 ? 0.6 : 1.0));
  if (uFlow > 0.5) color *= 0.85 + 0.3 * valueNoise(vWorld.xz * vec2(0.08, 0.3) + uTime * 0.6);
  color += uSunColor * pow(max(dot(r, uSunDir), 0.0), 700.0) * 10.0;
  float foamBand = 1.0 - smoothstep(0.0, 2.4, depth);
  float foam = foamBand * smoothstep(0.45, 0.8, valueNoise(vWorld.xz * 0.16 + uTime * 0.25) * 0.55 + 0.45 * sin(depth * 4.5 - uTime * 1.5));
  color = mix(color, (uSkyAmbient + uSunColor * 0.7) * 0.9, foam * 0.75);
  if (uLandingLight.w > 0.0) color = litSurface(color, n, vWorld, 0.0) * 0.5 + color * 0.5;
  float alpha = mix(0.25, 1.0, smoothstep(0.0, 3.5, depth));
  outColor = vec4(toDisplay(applyFog(color, vWorld)), alpha);
}`;

export const SKY_VERTEX = `${HEADER}
out vec2 vClip;
void main() {
  vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  vClip = corners[gl_VertexID];
  gl_Position = vec4(vClip, 1.0, 1.0);
}`;

export const SKY_FRAGMENT = `${HEADER}
in vec2 vClip;
out vec4 outColor;
uniform mat4 uInvViewProj;
${ATMOSPHERE}
${NOISE}
void main() {
  vec4 far = uInvViewProj * vec4(vClip, 1.0, 1.0);
  vec3 dir = normalize(far.xyz / far.w - uCameraPos);
  vec3 color = skyRadiance(dir);
  float sd = dot(dir, uSunDir);
  color += uSunColor * smoothstep(0.99955, 0.99975, sd) * 3.0;
  if (uNight > 0.01 && dir.y > 0.02) {
    vec2 sp = dir.xz / (dir.y + 0.25) * 260.0;
    float dark = 1.0 - smoothstep(0.02, 0.12, dot(color, vec3(0.3, 0.5, 0.2)));
    float star = step(0.9975, hash12(floor(sp))) * uNight * smoothstep(0.05, 0.35, dir.y) * dark;
    color += vec3(star) * 0.8;
  }
  outColor = vec4(toDisplay(color), 1.0);
}`;

export const MESH_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec4 aInstance;
layout(location = 4) in vec4 aInstanceScale;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform float uInstanced;
out vec3 vWorld;
out vec3 vNormal;
out vec4 vColor;
out vec3 vLocal;
out vec3 vScale;
out float vSeed;
void main() {
  vec4 world;
  if (uInstanced > 0.5) {
    float c = cos(aInstance.w);
    float s = sin(aInstance.w);
    vec3 sp = aPosition * aInstanceScale.xyz;
    vec3 sn = aNormal / aInstanceScale.xyz;
    world = vec4(vec3(c * sp.x + s * sp.z, sp.y, -s * sp.x + c * sp.z) + aInstance.xyz, 1.0);
    vNormal = normalize(vec3(c * sn.x + s * sn.z, sn.y, -s * sn.x + c * sn.z));
    vScale = aInstanceScale.xyz;
    vSeed = aInstanceScale.w;
  } else {
    world = uModel * vec4(aPosition, 1.0);
    vNormal = normalize(mat3(uModel) * aNormal);
    vScale = vec3(1.0);
    vSeed = 0.0;
  }
  vLocal = aPosition;
  vWorld = world.xyz;
  vColor = aColor;
  gl_Position = uViewProj * world;
}`;

export const MESH_FRAGMENT = `${HEADER}
in vec3 vWorld;
in vec3 vNormal;
in vec4 vColor;
in vec3 vLocal;
in vec3 vScale;
in float vSeed;
out vec4 outColor;
uniform vec3 uTint;
uniform vec3 uEmissive;
uniform float uAlpha;
${ATMOSPHERE}
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float material = vColor.a;
  vec3 base = vColor.rgb * uTint;
  if (vSeed > 0.0) base *= 0.8 + 0.4 * fract(vSeed * 7.31);
  float band = 0.0;
  if (material > 4.5) {
    band = step(0.72, fract(atan(vLocal.y, vLocal.x) * 1.2732395 + 0.36));
    base = mix(base, vec3(0.97, 0.96, 0.92), band * 0.9);
  }
  vec3 albedo = toLinear(base);
  float shine = material > 4.5 ? 0.7 : material > 2.5 ? (material > 3.5 ? 1.6 : 0.7) : 0.04;
  vec3 color = litSurface(albedo, n, vWorld, shine);
  if (material > 0.5 && material < 1.5) {
    vec3 q = vLocal * vScale;
    vec2 w = vec2(abs(n.x) > 0.5 ? q.z : q.x, q.y);
    vec2 cell = floor(w / vec2(3.1, 3.3));
    vec2 f = fract(w / vec2(3.1, 3.3));
    float window = step(0.28, f.x) * step(f.x, 0.72) * step(0.32, f.y) * step(f.y, 0.78) * step(1.2, q.y) * step(0.5, 1.0 - abs(n.y));
    float lit = step(0.42, hash12(cell + floor(vSeed * 97.0)));
    color = mix(color, albedo * 0.35 * (uSkyAmbient + uSunColor * 0.4), window * mix(0.3, 0.7, uNight));
    color += window * lit * uNight * toLinear(vec3(1.0, 0.8, 0.48)) * 1.8;
  }
  if (material > 1.5 && material < 2.5) color = albedo * 2.4;
  color += uEmissive * (1.0 - band * 0.6);
  outColor = vec4(toDisplay(applyFog(color, vWorld)), uAlpha);
}`;

export const SPRITE_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec4 aColor;
layout(location = 2) in float aSize;
uniform mat4 uViewProj;
uniform float uPixelsPerUnit;
uniform float uMinPixels;
out vec4 vColor;
out vec3 vWorld;
void main() {
  vec4 clip = uViewProj * vec4(aPosition, 1.0);
  gl_Position = clip;
  float pixels = aSize * uPixelsPerUnit / max(clip.w, 0.5);
  gl_PointSize = clamp(max(pixels, uMinPixels * step(0.0, aColor.a)), 1.0, 220.0);
  vColor = aColor;
  vWorld = aPosition;
}`;

export const SPRITE_FRAGMENT = `${HEADER}
in vec4 vColor;
in vec3 vWorld;
out vec4 outColor;
uniform float uGlow;
${ATMOSPHERE}
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  if (uGlow > 0.5) {
    // Daylight washes out the halo: by day a lamp shows as its bright core.
    float core = exp(-r2 * 9.0) * 1.6 + exp(-r2 * 2.2) * 0.45 * mix(0.2, 1.0, uNight);
    float fade = 1.0 - fogFactor(vWorld) * 0.8;
    outColor = vec4(vColor.rgb * core * vColor.a * fade, 1.0);
  } else {
    float soft = smoothstep(1.0, 0.15, r2);
    vec3 lit = toLinear(vColor.rgb) * (uSkyAmbient + uSunColor * 0.75);
    outColor = vec4(toDisplay(applyFog(lit, vWorld)), soft * vColor.a);
  }
}`;

export const CLOUD_VERTEX = `${HEADER}
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aCloud;
layout(location = 2) in vec4 aShade;
uniform mat4 uViewProj;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
out vec2 vUv;
out vec3 vWorld;
out vec4 vShade;
void main() {
  float c = cos(aShade.z);
  float s = sin(aShade.z);
  vec2 corner = vec2(c * aCorner.x - s * aCorner.y, s * aCorner.x + c * aCorner.y);
  vec3 p = aCloud.xyz + (uCameraRight * corner.x + uCameraUp * corner.y * 0.62) * aCloud.w;
  vUv = aCorner * 0.5 + 0.5;
  vWorld = p;
  vShade = aShade;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

export const CLOUD_FRAGMENT = `${HEADER}
in vec2 vUv;
in vec3 vWorld;
in vec4 vShade;
out vec4 outColor;
uniform sampler2D uPuff;
uniform float uCloudiness;
${ATMOSPHERE}
void main() {
  vec4 puff = texture(uPuff, vUv);
  float light = mix(0.55, 1.15, clamp(vShade.x + (vUv.y - 0.5) * 0.5, 0.0, 1.0));
  vec3 color = (uSkyAmbient * 1.15 + uSunColor * 0.85 * light) * mix(1.0, 0.7, uCloudiness) * mix(1.0, 0.62, smoothstep(0.6, 0.9, uCloudiness));
  color = applyFog(color, vWorld);
  float near = smoothstep(80.0, 320.0, length(vWorld - uCameraPos));
  outColor = vec4(toDisplay(color), puff.a * vShade.y * near);
}`;

export const SURFACE_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUv;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec2 vUv;
void main() {
  vWorld = aPosition;
  vUv = aUv;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}`;

export const SURFACE_FRAGMENT = `${HEADER}
in vec3 vWorld;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSurfaceTexture;
${ATMOSPHERE}
${NOISE}
void main() {
  vec4 texel = texture(uSurfaceTexture, vUv);
  // Asphalt grain where the painted texture runs out of detail: two octaves of noise in metres,
  // faded out with distance before it can shimmer.
  float near = 1.0 - smoothstep(25.0, 140.0, distance(vWorld, uCameraPos));
  float grain = valueNoise(vWorld.xz * 6.0) * 0.6 + valueNoise(vWorld.xz * 1.7) * 0.4;
  vec3 albedo = toLinear(texel.rgb) * (1.0 + (grain - 0.5) * 0.22 * near);
  vec3 color = litSurface(albedo, vec3(0.0, 1.0, 0.0), vWorld, 0.0);
  outColor = vec4(toDisplay(applyFog(color, vWorld)), texel.a);
}`;

export const SHADOW_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUv;
uniform mat4 uViewProj;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}`;

export const SHADOW_FRAGMENT = `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform float uStrength;
float box(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float body = box(p, vec2(0.0, 0.0), vec2(0.07, 0.72));
  float wing = box(p, vec2(0.0, -0.12), vec2(0.98, 0.09));
  float tail = box(p, vec2(0.0, 0.62), vec2(0.34, 0.06));
  float d = min(min(body, wing), tail);
  float a = (1.0 - smoothstep(-0.02, 0.06, d)) * uStrength;
  outColor = vec4(0.0, 0.0, 0.0, a);
}`;
