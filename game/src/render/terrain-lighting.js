// Mountain shadows and valley occlusion, baked from the heightfield into one small two-channel
// texture whenever the sun moves (each mission has its own time of day). Ground, trees, buildings,
// runways and water read it, so a low sun lets the Cairnhold range throw long shadows.

const RESOLUTION = 257;

/** For every texel: R = how shadowed from the sun (soft penumbra), G = sky occlusion in hollows. */
export function bakeTerrainLight(terrain, sunDirection) {
  const data = new Uint8Array(RESOLUTION * RESOLUTION * 2);
  const step = terrain.size / (RESOLUTION - 1);
  let peak = 0;
  for (const h of terrain.heights) peak = Math.max(peak, h);
  const horizontal = Math.hypot(sunDirection[0], sunDirection[2]) || 1e-6;
  const dx = sunDirection[0] / horizontal;
  const dz = sunDirection[2] / horizontal;
  const rise = sunDirection[1] / horizontal;
  const ring = [];
  for (const radius of [110, 260]) for (let k = 0; k < 8; k++) ring.push([Math.cos((k / 8) * Math.PI * 2) * radius, Math.sin((k / 8) * Math.PI * 2) * radius]);
  for (let j = 0; j < RESOLUTION; j++) {
    for (let i = 0; i < RESOLUTION; i++) {
      const x = -terrain.half + i * step;
      const z = -terrain.half + j * step;
      const ground = Math.max(terrain.heightAt(x, z), 0);
      let shadow = 0;
      let t = terrain.cellSize;
      while (t < terrain.size) {
        const px = x + dx * t;
        const pz = z + dz * t;
        if (Math.abs(px) > terrain.half || Math.abs(pz) > terrain.half) break;
        const ray = ground + 2 + rise * t;
        if (ray > peak) break;
        const blocked = (terrain.heightAt(px, pz) - ray) / (8 + t * 0.035);
        if (blocked > shadow) {
          shadow = blocked;
          if (shadow >= 1) break;
        }
        t += terrain.cellSize * (1 + t / 1800);
      }
      let around = 0;
      for (const [ox, oz] of ring) around += Math.max(terrain.heightAt(x + ox, z + oz), 0);
      const hollow = Math.min(1, Math.max(0, (around / ring.length - ground) / 80));
      const k = (j * RESOLUTION + i) * 2;
      data[k] = Math.round(Math.min(1, Math.max(0, shadow)) * 255);
      data[k + 1] = Math.round(hollow * 255);
    }
  }
  return data;
}

/** Keeps the baked texture in step with the atmosphere; returns what the shaders sample. */
export function createTerrainLighting(gl, terrain) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, RESOLUTION, RESOLUTION, 0, gl.RG, gl.UNSIGNED_BYTE, new Uint8Array(RESOLUTION * RESOLUTION * 2));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  let bakedFor = null;
  const light = { texture, half: terrain.half, size: terrain.size };
  return {
    /** Re-bakes only when the sun direction has changed since the last bake. */
    update(sunDirection) {
      const key = sunDirection.map((v) => v.toFixed(4)).join(',');
      if (key === bakedFor) return light;
      bakedFor = key;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, RESOLUTION, RESOLUTION, gl.RG, gl.UNSIGNED_BYTE, bakeTerrainLight(terrain, sunDirection));
      return light;
    },
  };
}
