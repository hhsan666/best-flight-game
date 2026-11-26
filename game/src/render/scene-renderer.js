// One frame, in order: sky, terrain, runways, buildings and trees, rings, the aircraft, the sea
// and river, the aircraft's shadow, clouds, then glowing lights and particles on top.
import { createGlContext } from './gl-utils.js';
import { createMeshProgram, beginMeshPass } from './mesh-renderer.js';
import { createSkyRenderer } from './sky-renderer.js';
import { createTerrainRenderer } from './terrain-renderer.js';
import { createWaterRenderer } from './water-renderer.js';
import { createSceneryRenderer } from './scenery-renderer.js';
import { createRunwayRenderer } from './runway-renderer.js';
import { createRingRenderer } from './ring-renderer.js';
import { createAircraftRenderer } from './aircraft-renderer.js';
import { createAircraftShadow } from './aircraft-shadow.js';
import { createCloudRenderer } from './cloud-renderer.js';
import { createSpriteBatch } from './sprite-batch.js';
import { LIGHTHOUSE } from '../world/landmarks.js';

export function createSceneRenderer(canvas, world) {
  const gl = createGlContext(canvas);
  const meshProgram = createMeshProgram(gl);
  const sky = createSkyRenderer(gl);
  const ground = createTerrainRenderer(gl, world.terrain, world.forestDensity, world.seed);
  const water = createWaterRenderer(gl, world.terrain);
  const scenery = createSceneryRenderer(gl, meshProgram, world);
  const runways = createRunwayRenderer(gl, world.airfields, world.terrain);
  const rings = createRingRenderer(gl, meshProgram);
  const aircraft = createAircraftRenderer(gl, meshProgram);
  const shadow = createAircraftShadow(gl, world.terrain);
  const clouds = createCloudRenderer(gl, world.seed, world.terrain.size);
  const sprites = createSpriteBatch(gl);
  const lighthouseLamp = [LIGHTHOUSE.x, world.terrain.heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) + 35.5, LIGHTHOUSE.z];

  return {
    gl,
    runways,
    /** scene: { plane, rings, nextRing, particles, showAircraft, pilotEye } */
    render(frame, scene) {
      const { atmosphere } = frame;
      clouds.setCover(atmosphere.clouds);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      sky.draw(frame);
      ground.draw(frame);
      runways.draw(frame);
      beginMeshPass(gl, meshProgram, frame);
      scenery.draw(frame);
      rings.draw(frame, scene.rings, scene.nextRing);
      if (scene.showAircraft) aircraft.draw(frame, scene.plane, scene.cockpit);
      water.draw(frame);
      if (scene.showAircraft) shadow.draw(frame, scene.plane);
      clouds.draw(frame);
      if (scene.showAircraft) {
        beginMeshPass(gl, meshProgram, frame);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        aircraft.drawBlended(frame, scene.plane, scene.cockpit);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
      sprites.begin();
      runways.emitLights(sprites, scene.pilotEye ?? frame.camera.position, atmosphere.night, frame.time);
      if (scene.rings) rings.emitLights(sprites, scene.rings, scene.nextRing, frame.time);
      if (scene.showAircraft) aircraft.emitLights(sprites, scene.plane, frame.time);
      const sweep = 0.5 + 0.5 * Math.cos(frame.time * 1.3);
      sprites.light(lighthouseLamp, [1, 0.9, 0.6], 3 + sweep * 6 * (0.3 + atmosphere.night), 0.7 + sweep * atmosphere.night * 2);
      scene.particles?.draw(sprites);
      sprites.draw(frame);
    },
  };
}
