// Target rings: glowing hoops along a course. The next ring burns gold with orbiting beacons,
// later ones glow pale, cleared ones turn green and fade.
import { MeshBuilder, MATTE } from './mesh-builder.js';
import { uploadMesh, drawMesh } from './mesh-renderer.js';
import { mat4FromPose, quatFromAttitude } from '../core/vector-math.js';

export function createRingRenderer(gl, program) {
  const hoop = uploadMesh(gl, new MeshBuilder().torus(1, 0.11, 48, 10, [0.95, 0.9, 0.8, MATTE]).build());
  const inner = uploadMesh(gl, new MeshBuilder().torus(0.9, 0.018, 48, 4, [1, 1, 1, MATTE]).build());

  const poseOf = (ring) => mat4FromPose(quatFromAttitude((ring.heading * Math.PI) / 180, (ring.pitch ?? 0) * Math.PI / 180, 0), ring.position, ring.radius);

  return {
    draw(frame, rings, nextIndex) {
      if (!rings) return;
      const pulse = 0.65 + 0.35 * Math.sin(frame.time * 4);
      rings.forEach((ring, i) => {
        const model = poseOf(ring);
        if (i < nextIndex) {
          if (frame.time - (ring.clearedAt ?? -99) < 1.5) drawMesh(gl, program, hoop, { model, tint: [0.4, 1, 0.5], emissive: [0.1, 0.6, 0.2] });
          return;
        }
        if (i === nextIndex) {
          drawMesh(gl, program, hoop, { model, tint: [1, 0.74, 0.22], emissive: [0.75 * pulse, 0.36 * pulse, 0.05] });
          drawMesh(gl, program, inner, { model, tint: [1, 1, 1], emissive: [0.9, 0.7, 0.3] });
        } else if (i < nextIndex + 4) {
          drawMesh(gl, program, hoop, { model, tint: [0.85, 0.92, 1], emissive: [0.25, 0.32, 0.45] });
        }
      });
    },
    emitLights(sprites, rings, nextIndex, time) {
      const ring = rings?.[nextIndex];
      if (!ring) return;
      const h = (ring.heading * Math.PI) / 180;
      const right = [Math.cos(h), 0, Math.sin(h)];
      for (let k = 0; k < 8; k++) {
        const a = time * 1.6 + (k / 8) * Math.PI * 2;
        const x = Math.cos(a) * ring.radius;
        const y = Math.sin(a) * ring.radius;
        sprites.light([ring.position[0] + right[0] * x, ring.position[1] + y, ring.position[2] + right[2] * x], [1, 0.8, 0.3], 2.2, 1.2);
      }
    },
  };
}
