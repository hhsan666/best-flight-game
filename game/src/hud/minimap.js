// A track-up moving map: the archipelago painted once from the heightfield (sea depth, beaches,
// fields, rock and snow, hill shading), with runways, the course's rings and your aircraft.
import { AIRFIELDS, TOWNS, runwayEnds } from '../world/landmarks.js';
import { SANS } from './instrument-panel.js';

function paintMap(terrain) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const step = terrain.size / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = -terrain.half + (i + 0.5) * step;
      const z = -terrain.half + (j + 0.5) * step;
      const h = terrain.heightAt(x, z);
      const shade = Math.max(0.55, Math.min(1.35, 1 + (terrain.heightAt(x - step, z - step) - h) * 0.03));
      let c;
      if (h < 0) {
        const d = Math.min(1, -h / 40);
        c = [30 + 70 * (1 - d), 92 + 95 * (1 - d), 140 + 60 * (1 - d)];
      } else if (h < 3) c = [226, 210, 160];
      else if (h > 880) c = [236, 240, 245];
      else if (h > 560) c = [128, 122, 110];
      else c = [92 + h * 0.05, 140 - h * 0.04, 72];
      const k = (j * size + i) * 4;
      image.data[k] = Math.min(255, c[0] * (h >= 0 ? shade : 1));
      image.data[k + 1] = Math.min(255, c[1] * (h >= 0 ? shade : 1));
      image.data[k + 2] = Math.min(255, c[2] * (h >= 0 ? shade : 1));
      image.data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const toPx = (x, z) => [((x + terrain.half) / terrain.size) * size, ((z + terrain.half) / terrain.size) * size];
  ctx.strokeStyle = '#f4f4f0';
  ctx.lineWidth = 3;
  for (const field of AIRFIELDS) {
    const [a, b] = runwayEnds(field);
    ctx.beginPath();
    ctx.moveTo(...toPx(a.x, a.z));
    ctx.lineTo(...toPx(b.x, b.z));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,40,30,0.75)';
  for (const town of TOWNS) {
    const [px, pz] = toPx(town.x, town.z);
    ctx.beginPath();
    ctx.arc(px, pz, (town.radius / terrain.size) * size * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export function createMinimap(terrain) {
  const map = paintMap(terrain);
  const scale = map.width / terrain.size;
  return {
    /** Draws a circular map of radius r (pixels) centred at (cx, cy), `span` metres across. */
    draw(ctx, cx, cy, r, plane, headingDeg, targets, span = 5200) {
      const k = (2 * r) / span;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0d2233';
      ctx.fill();
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate((-headingDeg * Math.PI) / 180);
      ctx.scale(k / scale, k / scale);
      ctx.translate(-(plane.position[0] + terrain.half) * scale, -(plane.position[2] + terrain.half) * scale);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(map, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((-headingDeg * Math.PI) / 180);
      for (const t of targets) {
        const dx = (t.x - plane.position[0]) * k;
        const dz = (t.z - plane.position[2]) * k;
        const d = Math.hypot(dx, dz);
        const s = d > r - 6 ? (r - 6) / d : 1;
        ctx.fillStyle = t.next ? '#ffc23a' : 'rgba(255,240,200,0.75)';
        ctx.beginPath();
        ctx.arc(dx * s, dz * s, t.next ? r * 0.07 : r * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0b1a22';
      ctx.lineWidth = r * 0.03;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.13);
      ctx.lineTo(r * 0.1, r * 0.1);
      ctx.lineTo(0, r * 0.05);
      ctx.lineTo(-r * 0.1, r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const north = (-headingDeg * Math.PI) / 180;
      ctx.fillStyle = '#ff6b5a';
      ctx.font = `800 ${Math.round(r * 0.22)}px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', Math.sin(north) * r * 0.82, -Math.cos(north) * r * 0.82);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,231,184,0.65)';
      ctx.lineWidth = Math.max(1.5, r * 0.04);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  };
}
