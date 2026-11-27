// Uploads MeshBuilder meshes and draws them lit: single meshes with a model matrix (aircraft,
// rings, landmarks) or many copies at once through instancing, grouped by area for culling.
import { createProgram, setAtmosphereUniforms } from './gl-utils.js';
import { MESH_VERTEX, MESH_FRAGMENT } from './shaders.js';
import { mat4Identity, boxInFrustum } from '../core/vector-math.js';

const IDENTITY = mat4Identity();
const WHITE = [1, 1, 1];
const NONE = [0, 0, 0];

export function createMeshProgram(gl) {
  return createProgram(gl, MESH_VERTEX, MESH_FRAGMENT, 'mesh');
}

/** Puts a built mesh on the GPU; its vertex buffers can be shared by instanced groups. */
export function uploadMesh(gl, built) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const bind = (location, data, size) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    return buffer;
  };
  const buffers = { position: bind(0, built.positions, 3), normal: bind(1, built.normals, 3), color: bind(2, built.colors, 4) };
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, built.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, buffers, indexBuffer, count: built.count, indexType: built.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
}

/** Prepares the mesh program for a frame (call once before a run of drawMesh / drawGroups). */
export function beginMeshPass(gl, program, frame) {
  gl.useProgram(program.program);
  setAtmosphereUniforms(gl, program, frame);
}

export function drawMesh(gl, program, mesh, { model = IDENTITY, tint = WHITE, emissive = NONE, alpha = 1, grounded = false } = {}) {
  gl.uniform1f(program.u.uInstanced, 0);
  if (program.u.uUseTerrainLight) gl.uniform1f(program.u.uUseTerrainLight, grounded ? 1 : 0);
  gl.uniformMatrix4fv(program.u.uModel, false, model);
  gl.uniform3fv(program.u.uTint, tint);
  gl.uniform3fv(program.u.uEmissive, emissive);
  gl.uniform1f(program.u.uAlpha, alpha);
  gl.bindVertexArray(mesh.vao);
  gl.disableVertexAttribArray(3);
  gl.disableVertexAttribArray(4);
  gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
  gl.bindVertexArray(null);
}

/**
 * Splits instances ({x, y, z, yaw, sx, sy, sz, seed}) into square areas of `cell` metres, each
 * with its own vertex array sharing the mesh's buffers, so whole areas can be culled at once.
 */
export function createInstanceGroups(gl, mesh, instances, cell, reach, thinning = null) {
  const buckets = new Map();
  for (const it of instances) {
    const key = `${Math.floor(it.x / cell)},${Math.floor(it.z / cell)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(it);
  }
  const groups = [];
  for (const list of buckets.values()) {
    // Shuffled by each instance's own seed, so drawing only the first part of a distant group still
    // spreads what is drawn evenly over its cell.
    if (thinning) list.sort((a, b) => a.seed - b.seed);
    const placement = new Float32Array(list.length * 4);
    const sizing = new Float32Array(list.length * 4);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    list.forEach((it, i) => {
      placement.set([it.x, it.y, it.z, it.yaw], i * 4);
      sizing.set([it.sx, it.sy, it.sz, it.seed], i * 4);
      const r = Math.max(it.sx, it.sz) * 0.75;
      min[0] = Math.min(min[0], it.x - r); min[1] = Math.min(min[1], it.y); min[2] = Math.min(min[2], it.z - r);
      max[0] = Math.max(max[0], it.x + r); max[1] = Math.max(max[1], it.y + it.sy * 1.5); max[2] = Math.max(max[2], it.z + r);
    });
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attach = (buffer, location, size) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };
    attach(mesh.buffers.position, 0, 3);
    attach(mesh.buffers.normal, 1, 3);
    attach(mesh.buffers.color, 2, 4);
    for (const [location, data] of [[3, placement], [4, sizing]]) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(location, 1);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.bindVertexArray(null);
    groups.push({ vao, count: list.length, min, max, centre: [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2] });
  }
  return { mesh, groups, reach, cell, thinning };
}

export function drawInstanceGroups(gl, program, set, frame, tint = WHITE) {
  gl.uniform1f(program.u.uInstanced, 1);
  if (program.u.uUseTerrainLight) gl.uniform1f(program.u.uUseTerrainLight, 1);
  gl.uniform3fv(program.u.uTint, tint);
  gl.uniform3fv(program.u.uEmissive, NONE);
  gl.uniform1f(program.u.uAlpha, 1);
  const eye = frame.camera.position;
  const thin = set.thinning;
  for (const group of set.groups) {
    const distance = Math.hypot(group.centre[0] - eye[0], group.centre[1] - eye[2]);
    if (distance > set.reach) continue;
    if (!boxInFrustum(frame.camera.planes, group.min, group.max)) continue;
    let count = group.count;
    if (thin) {
      // Far groups draw a shrinking share of their instances: a few pixels each, the ground shading carries the rest.
      const far = Math.max(0, distance - set.cell * 0.7 - thin.near) / Math.max(1, set.reach - thin.near);
      count = Math.ceil(group.count * Math.max(thin.least, 1 - far * (1 - thin.least)));
    }
    gl.bindVertexArray(group.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, set.mesh.count, set.mesh.indexType, 0, count);
  }
  gl.bindVertexArray(null);
}
