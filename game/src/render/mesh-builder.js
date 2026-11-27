// Procedural mesh construction: boxes, prisms, cylinders, cones, tori and lofted hulls with
// per-vertex colour and a material id (0 matte, 1 windowed wall, 2 self-lit, 3 gloss paint, 4 glass,
// 5 banded gloss paint: alternating colour and white bands around the local Z axis, for course gates).
import { cross, sub, normalize, quatRotate, add } from '../core/vector-math.js';

export const MATTE = 0;
export const WINDOWED = 1;
export const GLOW = 2;
export const GLOSS = 3;
export const GLASS = 4;
export const BANDED = 5;

export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
    this.frames = [];
  }

  /** Applies a rotation (quaternion), then an offset, to every primitive added inside fn. */
  withFrame(rotation, offset, fn) {
    this.frames.push({ rotation, offset });
    fn();
    this.frames.pop();
    return this;
  }

  place(p, n) {
    let point = p;
    let normal = n;
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const { rotation, offset } = this.frames[i];
      point = add(quatRotate(rotation, point), offset);
      normal = quatRotate(rotation, normal);
    }
    return [point, normal];
  }

  vertex(p, n, color) {
    const [point, normal] = this.place(p, n);
    this.positions.push(point[0], point[1], point[2]);
    this.normals.push(normal[0], normal[1], normal[2]);
    this.colors.push(color[0], color[1], color[2], color[3] ?? MATTE);
    return this.positions.length / 3 - 1;
  }

  /** A flat polygon (convex, counter-clockwise seen from its front). */
  polygon(points, color) {
    const n = normalize(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    const first = this.vertex(points[0], n, color);
    for (let i = 1; i < points.length; i++) this.vertex(points[i], n, color);
    for (let i = 1; i < points.length - 1; i++) this.indices.push(first, first + i, first + i + 1);
    return this;
  }

  /** Axis-aligned box from min to max corner; faces optional (e.g. skip the bottom). */
  box(min, max, color, { bottom = true, top = true } = {}) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    this.polygon([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], color);
    this.polygon([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], color);
    this.polygon([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], color);
    this.polygon([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], color);
    if (top) this.polygon([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], color);
    if (bottom) this.polygon([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], color);
    return this;
  }

  /** A gable roof prism over [x0,x1] x [z0,z1], ridge along Z, eaves at y0 and ridge at y1. */
  gableRoof(x0, x1, z0, z1, y0, y1, color, overhang = 0.4) {
    const a = x0 - overhang;
    const b = x1 + overhang;
    const c = z0 - overhang;
    const d = z1 + overhang;
    const m = (x0 + x1) / 2;
    this.polygon([[a, y0, d], [m, y1, d], [m, y1, c], [a, y0, c]], color);
    this.polygon([[b, y0, c], [m, y1, c], [m, y1, d], [b, y0, d]], color);
    this.polygon([[a, y0, d], [b, y0, d], [m, y1, d]], color);
    this.polygon([[b, y0, c], [a, y0, c], [m, y1, c]], color);
    return this;
  }

  /** A cylinder or cone frustum along +Y from y0 to y1 (smooth sides). */
  cylinder(radius0, radius1, y0, y1, segments, color, { caps = true } = {}) {
    const ring = (r, y) => Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });
    const lower = ring(radius0, y0);
    const upper = ring(radius1, y1);
    const slope = (radius0 - radius1) / Math.max(1e-6, y1 - y0);
    const start = this.positions.length / 3;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const n = normalize([Math.cos(a), slope, Math.sin(a)]);
      this.vertex(lower[i], n, color);
      this.vertex(upper[i], n, color);
    }
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const a0 = start + i * 2;
      const a1 = start + j * 2;
      this.indices.push(a0, a0 + 1, a1 + 1, a0, a1 + 1, a1);
    }
    if (caps && radius1 > 0) this.polygon([...upper].reverse(), color);
    if (caps && radius0 > 0) this.polygon(lower, color);
    return this;
  }

  /** A torus around the Z axis (rings face along Z), centred on the origin. */
  torus(radius, tube, segments, sides, color) {
    const start = this.positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * Math.PI * 2;
      for (let j = 0; j <= sides; j++) {
        const v = (j / sides) * Math.PI * 2;
        const n = [Math.cos(u) * Math.cos(v), Math.sin(u) * Math.cos(v), Math.sin(v)];
        const p = [Math.cos(u) * (radius + tube * Math.cos(v)), Math.sin(u) * (radius + tube * Math.cos(v)), tube * Math.sin(v)];
        this.vertex(p, n, color);
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < sides; j++) {
        const a = start + i * (sides + 1) + j;
        const b = a + sides + 1;
        this.indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return this;
  }

  /** A low-poly blob (octahedron subdivided once) for tree crowns and rocks. */
  blob(center, radii, color) {
    const t = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
    const mid = (a, b) => normalize([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
    for (const [i, j, k] of faces) {
      const a = t[i];
      const b = t[j];
      const c = t[k];
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      for (const tri of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) {
        const pts = tri.map((p) => [center[0] + p[0] * radii[0], center[1] + p[1] * radii[1], center[2] + p[2] * radii[2]]);
        this.polygon(pts, color);
      }
    }
    return this;
  }

  /**
   * A smooth hull lofted through cross-sections along -Z (nose first). Each section is
   * { z, width, height, top, bottom } and is an ellipse-like superellipse, used for fuselages.
   */
  loft(sections, around, colorAt) {
    const start = this.positions.length / 3;
    for (const s of sections) {
      for (let i = 0; i <= around; i++) {
        const a = (i / around) * Math.PI * 2;
        const cx = Math.sin(a);
        const cy = Math.cos(a);
        const half = cy >= 0 ? s.top ?? s.height / 2 : s.bottom ?? s.height / 2;
        const p = [cx * s.width / 2, (s.y ?? 0) + cy * half, s.z];
        const n = normalize([cx / Math.max(0.05, s.width / 2), cy / Math.max(0.05, half), 0]);
        this.vertex(p, n, colorAt(s, a, p));
      }
    }
    const stride = around + 1;
    for (let k = 0; k < sections.length - 1; k++) {
      for (let i = 0; i < around; i++) {
        const a = start + k * stride + i;
        const b = a + stride;
        this.indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return this;
  }

  build() {
    const count = this.positions.length / 3;
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: new Float32Array(this.colors),
      indices: count > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices),
      count: this.indices.length,
    };
  }
}
