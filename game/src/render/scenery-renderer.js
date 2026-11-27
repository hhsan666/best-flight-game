// Trees and buildings: instanced conifers and broadleaf trees, town houses in a few paint and roof
// colours (lit windows after dusk), plus one baked mesh for hangars, towers and the striped lighthouse.
import { MeshBuilder, MATTE, WINDOWED, GLOW, GLOSS } from './mesh-builder.js';
import { uploadMesh, createInstanceGroups, drawInstanceGroups, drawMesh } from './mesh-renderer.js';
import { quatFromAxisAngle } from '../core/vector-math.js';

const WALL_PAINTS = [[0.93, 0.91, 0.86], [0.92, 0.83, 0.64], [0.8, 0.67, 0.5], [0.72, 0.8, 0.84], [0.95, 0.95, 0.95]];
const ROOF_PAINTS = [[0.66, 0.3, 0.2], [0.36, 0.38, 0.42], [0.5, 0.22, 0.18]];

function coniferMesh() {
  const b = new MeshBuilder();
  b.cylinder(0.05, 0.04, 0, 0.25, 5, [0.36, 0.25, 0.16, MATTE], { caps: false });
  b.cylinder(0.34, 0.02, 0.18, 0.72, 7, [0.16, 0.33, 0.17, MATTE]);
  b.cylinder(0.24, 0.0, 0.5, 1.0, 7, [0.18, 0.37, 0.19, MATTE]);
  return b.build();
}

function broadleafMesh() {
  const b = new MeshBuilder();
  b.cylinder(0.06, 0.05, 0, 0.4, 5, [0.38, 0.27, 0.17, MATTE], { caps: false });
  b.blob([0, 0.62, 0], [0.42, 0.36, 0.42], [0.23, 0.41, 0.17, MATTE]);
  b.blob([0.16, 0.78, 0.05], [0.24, 0.2, 0.24], [0.28, 0.47, 0.2, MATTE]);
  return b.build();
}

function wallMesh(paint) {
  return new MeshBuilder().box([-0.5, 0, -0.5], [0.5, 1, 0.5], [...paint, WINDOWED], { bottom: false }).build();
}

function gableMesh(paint) {
  return new MeshBuilder().gableRoof(-0.5, 0.5, -0.5, 0.5, 0, 1, [...paint, MATTE], 0.06).build();
}

/** Hangars, control towers, town clock towers and the lighthouse, baked into one world-space mesh. */
function landmarkMesh(buildings) {
  const b = new MeshBuilder();
  for (const bd of buildings) {
    if (bd.kind === 'house') continue;
    const frame = quatFromAxisAngle([0, 1, 0], bd.yaw);
    b.withFrame(frame, [bd.x, bd.y, bd.z], () => {
      const w = bd.width / 2;
      const d = bd.depth / 2;
      if (bd.kind === 'hangar') {
        b.box([-w, 0, -d], [w, bd.height * 0.7, d], [0.74, 0.76, 0.78, MATTE], { bottom: false, top: false });
        const arc = 9;
        for (let i = 0; i < arc; i++) {
          const a0 = (i / arc) * Math.PI;
          const a1 = ((i + 1) / arc) * Math.PI;
          const y0 = bd.height * 0.7 + Math.sin(a0) * bd.height * 0.3;
          const y1 = bd.height * 0.7 + Math.sin(a1) * bd.height * 0.3;
          const x0 = -Math.cos(a0) * w;
          const x1 = -Math.cos(a1) * w;
          b.polygon([[x0, y0, d], [x1, y1, d], [x1, y1, -d], [x0, y0, -d]], [0.58, 0.6, 0.63, GLOSS]);
          b.polygon([[x0, y0, d], [x0, bd.height * 0.7, d], [x1, bd.height * 0.7, d], [x1, y1, d]], [0.74, 0.76, 0.78, MATTE]);
          b.polygon([[x1, y1, -d], [x1, bd.height * 0.7, -d], [x0, bd.height * 0.7, -d], [x0, y0, -d]], [0.74, 0.76, 0.78, MATTE]);
        }
        b.box([-w * 0.8, 0, d - 0.1], [w * 0.8, bd.height * 0.62, d + 0.05], [0.36, 0.42, 0.5, MATTE], { bottom: false });
      } else if (bd.kind === 'control-tower') {
        b.box([-w, 0, -d], [w, bd.height - 4, d], [0.9, 0.9, 0.88, WINDOWED], { bottom: false });
        b.box([-w - 1.2, bd.height - 4, -d - 1.2], [w + 1.2, bd.height - 0.8, d + 1.2], [0.25, 0.45, 0.55, GLOSS]);
        b.box([-w - 1.6, bd.height - 0.8, -d - 1.6], [w + 1.6, bd.height, d + 1.6], [0.85, 0.85, 0.82, MATTE]);
        b.cylinder(0.15, 0.15, bd.height, bd.height + 5, 4, [0.8, 0.8, 0.8, MATTE]);
        b.box([-0.5, bd.height + 5, -0.5], [0.5, bd.height + 6, 0.5], [1.0, 0.25, 0.15, GLOW]);
      } else if (bd.kind === 'tower') {
        b.box([-w, 0, -d], [w, bd.height * 0.82, d], [0.86, 0.82, 0.74, WINDOWED], { bottom: false });
        b.gableRoof(-w, w, -d, d, bd.height * 0.82, bd.height * 1.12, [0.32, 0.42, 0.4, MATTE], 0.3);
        b.box([-w - 0.05, bd.height * 0.66, -1.4], [w + 0.05, bd.height * 0.74, 1.4], [0.96, 0.94, 0.85, GLOW]);
      } else if (bd.kind === 'lighthouse') {
        const bands = 6;
        for (let i = 0; i < bands; i++) {
          const y0 = (i / bands) * bd.height;
          const y1 = ((i + 1) / bands) * bd.height;
          const r0 = 3.6 - (i / bands) * 1.4;
          const r1 = 3.6 - ((i + 1) / bands) * 1.4;
          b.cylinder(r0, r1, y0, y1, 14, i % 2 ? [0.82, 0.14, 0.12, MATTE] : [0.96, 0.95, 0.92, MATTE], { caps: false });
        }
        b.cylinder(3.0, 3.0, bd.height, bd.height + 0.6, 14, [0.2, 0.2, 0.22, MATTE]);
        b.cylinder(1.6, 1.6, bd.height + 0.6, bd.height + 3.4, 10, [1.0, 0.92, 0.62, GLOW], { caps: false });
        b.cylinder(1.9, 0.2, bd.height + 3.4, bd.height + 5.6, 10, [0.18, 0.18, 0.2, GLOSS]);
        b.box([-5, -2, -4], [6, 0.4, 5], [0.62, 0.6, 0.56, MATTE], { bottom: false });
      }
    });
  }
  return b.build();
}

export function createSceneryRenderer(gl, program, world) {
  const trees = world.forest.trees;
  const conifers = trees.filter((t) => t.conifer).map((t) => ({ x: t.x, y: t.y, z: t.z, yaw: t.yaw, sx: t.height * 0.62, sy: t.height, sz: t.height * 0.62, seed: t.seed }));
  const broadleaf = trees.filter((t) => !t.conifer).map((t) => ({ x: t.x, y: t.y, z: t.z, yaw: t.yaw, sx: t.height * 0.9, sy: t.height, sz: t.height * 0.9, seed: t.seed }));
  const treeSets = [
    createInstanceGroups(gl, uploadMesh(gl, coniferMesh()), conifers, 900, 7000),
    createInstanceGroups(gl, uploadMesh(gl, broadleafMesh()), broadleaf, 900, 7000),
  ];
  const houses = world.buildings.filter((b) => b.kind === 'house');
  const wallSets = WALL_PAINTS.map((paint, i) => {
    const list = houses.filter((h) => Math.floor(h.seed * 997) % WALL_PAINTS.length === i);
    return createInstanceGroups(gl, uploadMesh(gl, wallMesh(paint)), list.map((h) => ({ x: h.x, y: h.y, z: h.z, yaw: h.yaw, sx: h.width, sy: h.height, sz: h.depth, seed: h.seed })), 600, 9000);
  });
  const roofSets = ROOF_PAINTS.map((paint, i) => {
    const list = houses.filter((h) => h.roof === 'gable' && Math.floor(h.seed * 613) % ROOF_PAINTS.length === i);
    return createInstanceGroups(gl, uploadMesh(gl, gableMesh(paint)), list.map((h) => ({ x: h.x, y: h.y + h.height, z: h.z, yaw: h.yaw, sx: h.width, sy: Math.min(h.width, h.depth) * 0.42, sz: h.depth, seed: h.seed })), 600, 9000);
  });
  const flatRoofs = houses.filter((h) => h.roof === 'flat');
  const flatRoofSet = createInstanceGroups(gl, uploadMesh(gl, new MeshBuilder().box([-0.52, 0, -0.52], [0.52, 1, 0.52], [0.55, 0.55, 0.53, MATTE]).build()),
    flatRoofs.map((h) => ({ x: h.x, y: h.y + h.height, z: h.z, yaw: h.yaw, sx: h.width, sy: 0.6, sz: h.depth, seed: h.seed })), 600, 9000);
  const landmarks = uploadMesh(gl, landmarkMesh(world.buildings));

  return {
    draw(frame) {
      for (const set of treeSets) drawInstanceGroups(gl, program, set, frame);
      for (const set of wallSets) drawInstanceGroups(gl, program, set, frame);
      for (const set of roofSets) drawInstanceGroups(gl, program, set, frame);
      drawInstanceGroups(gl, program, flatRoofSet, frame);
      drawMesh(gl, program, landmarks, { grounded: true });
    },
  };
}
