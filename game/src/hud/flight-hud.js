// The head-up display: airspeed and altitude tapes, heading tape with the course bug, flight-path
// marker, a marker on the next ring or runway (an edge arrow when it is off screen), warnings,
// mission status, event call-outs, aircraft state chips, the moving map and the lit panel.
import { drawInstrumentPanel, MONO, SANS } from './instrument-panel.js';
import { KNOTS, FEET, FEET_PER_MINUTE, SALTRUNNER } from '../flight/aircraft-spec.js';
import { projectPoint } from '../core/vector-math.js';

const GREEN = '#a6ffcf';
const AMBER = '#ffc23a';
const RED = '#ff4a3d';
const INK = 'rgba(4,12,10,0.85)';

export function createFlightHud(canvas, minimap) {
  const ctx = canvas.getContext('2d');
  let W = 1;
  let H = 1;
  let u = 1;

  const text = (s, x, y, size, colour = GREEN, align = 'center', weight = 700, family = SANS) => {
    ctx.font = `${weight} ${Math.round(size)}px ${family}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, size * 0.22);
    ctx.strokeText(s, x, y);
    ctx.fillStyle = colour;
    ctx.fillText(s, x, y);
  };
  const glassPanel = (x, y, w, h, radius = 8 * u) => {
    ctx.fillStyle = 'rgba(6,18,16,0.42)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(166,255,207,0.35)';
    ctx.lineWidth = Math.max(1, u);
    ctx.stroke();
  };

  function speedTape(kt) {
    const w = 72 * u;
    const h = 236 * u;
    const x = 22 * u;
    const cy = H * 0.43;
    const perKt = h / 80;
    glassPanel(x, cy - h / 2, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, cy - h / 2, w, h);
    ctx.clip();
    const bands = [[0, 50, RED], [42, 85, '#f3f3f3'], [50, 128, '#46e07a'], [128, 159, AMBER], [159, 260, RED]];
    for (const [a, b, colour] of bands) {
      ctx.fillStyle = colour;
      const y0 = cy - (b - kt) * perKt;
      const y1 = cy - (a - kt) * perKt;
      ctx.fillRect(x + w - (colour === '#f3f3f3' ? 9 : 5) * u, y0, 4 * u, y1 - y0);
    }
    for (let v = Math.floor((kt - 45) / 5) * 5; v <= kt + 45; v += 5) {
      if (v < 0) continue;
      const y = cy - (v - kt) * perKt;
      ctx.fillStyle = GREEN;
      ctx.fillRect(x + w - (v % 10 === 0 ? 22 : 14) * u, y - u, (v % 10 === 0 ? 12 : 6) * u, 2 * u);
      if (v % 10 === 0) text(String(v), x + w - 30 * u, y, 14 * u, GREEN, 'right');
    }
    ctx.restore();
    readout(Math.round(kt), x - 2 * u, cy, w - 8 * u, 'left');
    text('IAS KT', x + w / 2, cy - h / 2 - 12 * u, 12 * u, GREEN);
  }

  function altitudeTape(feet, fpm, agl) {
    const w = 84 * u;
    const h = 236 * u;
    const x = W - 22 * u - w;
    const cy = H * 0.43;
    const perFoot = h / 800;
    glassPanel(x, cy - h / 2, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, cy - h / 2, w, h);
    ctx.clip();
    for (let v = Math.floor((feet - 450) / 50) * 50; v <= feet + 450; v += 50) {
      const y = cy - (v - feet) * perFoot;
      ctx.fillStyle = v < 0 ? AMBER : GREEN;
      ctx.fillRect(x + 4 * u, y - u, (v % 100 === 0 ? 12 : 6) * u, 2 * u);
      if (v % 100 === 0) text(String(v), x + 20 * u, y, 14 * u, GREEN, 'left');
    }
    const groundY = cy + agl * FEET * perFoot;
    if (groundY < cy + h / 2) {
      ctx.fillStyle = 'rgba(180,110,40,0.55)';
      ctx.fillRect(x, groundY, w, h);
    }
    ctx.restore();
    readout(Math.round(feet / 10) * 10, x + 8 * u, cy, w - 6 * u, 'right');
    text('ALT FT', x + w / 2, cy - h / 2 - 12 * u, 12 * u, GREEN);
    const vs = Math.round(fpm / 10) * 10;
    text(`${vs > 0 ? '▲' : vs < 0 ? '▼' : ''} ${Math.abs(vs)} fpm`, x + w / 2, cy + h / 2 + 14 * u, 14 * u, Math.abs(fpm) > 1500 ? AMBER : GREEN);
    if (agl * FEET < 1000) text(`AGL ${Math.max(0, Math.round(agl * FEET))}`, x + w / 2, cy + h / 2 + 32 * u, 13 * u, AMBER);
  }

  function readout(value, x, cy, w, pointer) {
    const h = 34 * u;
    ctx.fillStyle = 'rgba(2,10,8,0.92)';
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    if (pointer === 'left') {
      ctx.moveTo(x, cy - h / 2);
      ctx.lineTo(x + w, cy - h / 2);
      ctx.lineTo(x + w + 10 * u, cy);
      ctx.lineTo(x + w, cy + h / 2);
      ctx.lineTo(x, cy + h / 2);
    } else {
      ctx.moveTo(x + w, cy - h / 2);
      ctx.lineTo(x, cy - h / 2);
      ctx.lineTo(x - 10 * u, cy);
      ctx.lineTo(x, cy + h / 2);
      ctx.lineTo(x + w, cy + h / 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    text(String(value), x + w / 2, cy + u, 24 * u, '#ffffff', 'center', 800, MONO);
  }

  function headingTape(heading, course) {
    const w = 330 * u;
    const h = 34 * u;
    const cx = W / 2;
    const y = 12 * u;
    const perDeg = w / 70;
    glassPanel(cx - w / 2, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w / 2, y, w, h);
    ctx.clip();
    for (let d = Math.floor((heading - 40) / 5) * 5; d <= heading + 40; d += 5) {
      const x = cx + (d - heading) * perDeg;
      const deg = ((d % 360) + 360) % 360;
      ctx.fillStyle = GREEN;
      ctx.fillRect(x - u, y + h - (deg % 10 === 0 ? 10 : 6) * u, 2 * u, (deg % 10 === 0 ? 10 : 6) * u);
      if (deg % 10 === 0) {
        const name = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] ?? String(deg / 10).padStart(2, '0');
        text(name, x, y + 12 * u, (name.length === 1 ? 15 : 13) * u, name.length === 1 ? '#ffffff' : GREEN);
      }
    }
    if (course !== null && course !== undefined) {
      let diff = ((course - heading + 540) % 360) - 180;
      diff = Math.max(-34, Math.min(34, diff));
      const x = cx + diff * perDeg;
      ctx.fillStyle = '#ff6ad8';
      ctx.beginPath();
      ctx.moveTo(x, y + h - 2 * u);
      ctx.lineTo(x - 7 * u, y + h - 12 * u);
      ctx.lineTo(x + 7 * u, y + h - 12 * u);
      ctx.fill();
    }
    ctx.restore();
    const boxW = 64 * u;
    ctx.fillStyle = 'rgba(2,10,8,0.92)';
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2, y + h + 2 * u, boxW, 28 * u, 4 * u);
    ctx.fill();
    ctx.stroke();
    text(`${String(Math.round(heading) % 360).padStart(3, '0')}°`, cx, y + h + 17 * u, 21 * u, '#ffffff', 'center', 800, MONO);
  }

  function project(camera, p) {
    const n = projectPoint(camera.viewProj, p);
    return { x: (n.x * 0.5 + 0.5) * W, y: (0.5 - n.y * 0.5) * H, ahead: n.w > 0 };
  }

  function flightPathMarker(camera, plane) {
    const p = plane.position;
    const v = plane.velocity;
    if (Math.hypot(...v) < 12) return;
    const s = project(camera, [p[0] + v[0] * 60, p[1] + v[1] * 60, p[2] + v[2] * 60]);
    if (!s.ahead) return;
    ctx.save();
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 2.4 * u;
    ctx.shadowColor = INK;
    ctx.shadowBlur = 3 * u;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8 * u, 0, Math.PI * 2);
    ctx.moveTo(s.x - 8 * u, s.y);
    ctx.lineTo(s.x - 20 * u, s.y);
    ctx.moveTo(s.x + 8 * u, s.y);
    ctx.lineTo(s.x + 20 * u, s.y);
    ctx.moveTo(s.x, s.y - 8 * u);
    ctx.lineTo(s.x, s.y - 15 * u);
    ctx.stroke();
    ctx.restore();
  }

  function targetMarker(camera, target) {
    if (!target) return;
    const s = project(camera, target.position);
    const margin = 46 * u;
    const onScreen = s.ahead && s.x > margin && s.x < W - margin && s.y > margin * 1.6 && s.y < H - margin * 2.4;
    const label = `${target.label} · ${target.distance >= 1000 ? (target.distance / 1000).toFixed(1) + ' km' : Math.round(target.distance) + ' m'}`;
    ctx.save();
    ctx.strokeStyle = AMBER;
    ctx.fillStyle = AMBER;
    ctx.lineWidth = 2.4 * u;
    if (onScreen) {
      const r = 13 * u;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.lineTo(s.x + r, s.y);
      ctx.lineTo(s.x, s.y + r);
      ctx.lineTo(s.x - r, s.y);
      ctx.closePath();
      ctx.stroke();
      text(label, s.x, s.y - r - 12 * u, 13 * u, AMBER);
    } else {
      let dx = s.x - W / 2;
      let dy = s.y - H / 2;
      if (!s.ahead) {
        dx = -dx;
        dy = -dy;
      }
      const a = Math.atan2(dy, dx);
      const ex = W / 2 + Math.cos(a) * (W / 2 - margin);
      const ey = H / 2 + Math.sin(a) * (H / 2 - margin * 1.8);
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(16 * u, 0);
      ctx.lineTo(-8 * u, -11 * u);
      ctx.lineTo(-8 * u, 11 * u);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-a);
      text(label, 0, 24 * u, 12 * u, AMBER);
    }
    ctx.restore();
  }

  function missionPanel(m) {
    if (!m) return;
    const x = 22 * u;
    const y = 12 * u;
    const w = Math.min(250 * u, W * 0.3);
    glassPanel(x, y, w, 64 * u);
    text(m.title.toUpperCase(), x + 10 * u, y + 13 * u, 12 * u, AMBER, 'left', 800);
    text(m.time, x + w - 10 * u, y + 13 * u, 14 * u, '#ffffff', 'right', 700, MONO);
    text(m.objective, x + 10 * u, y + 33 * u, 13 * u, '#ffffff', 'left', 600);
    ctx.fillStyle = 'rgba(166,255,207,0.25)';
    ctx.fillRect(x + 10 * u, y + 50 * u, w - 20 * u, 5 * u);
    ctx.fillStyle = AMBER;
    ctx.fillRect(x + 10 * u, y + 50 * u, (w - 20 * u) * Math.min(1, m.progress), 5 * u);
  }

  function warnings(list, time) {
    let y = H * 0.27;
    for (const w of list) {
      const blink = w.blink ? 0.45 + 0.55 * (Math.sin(time * 9) > 0 ? 1 : 0) : 1;
      ctx.globalAlpha = blink;
      const width = (w.text.length * 13 + 34) * u;
      ctx.fillStyle = w.colour === RED ? 'rgba(80,8,4,0.75)' : 'rgba(70,46,0,0.7)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - width / 2, y - 15 * u, width, 30 * u, 6 * u);
      ctx.fill();
      text(w.text, W / 2, y + u, 20 * u, w.colour, 'center', 900);
      ctx.globalAlpha = 1;
      y += 36 * u;
    }
  }

  function chips(plane, assist, x, y) {
    const c = plane.controls;
    const items = [
      [`THR ${Math.round(c.throttle * 100)}%`, '#ffffff'],
      [`FLAPS ${['UP', '1', 'FULL'][c.flaps]}`, c.flaps ? AMBER : '#ffffff'],
      [c.brakes > 0.1 ? 'BRAKES' : assist ? 'ASSIST' : 'MANUAL', c.brakes > 0.1 ? RED : GREEN],
    ];
    items.forEach(([label, colour], i) => {
      glassPanel(x, y + i * 26 * u, 92 * u, 22 * u, 5 * u);
      text(label, x + 46 * u, y + i * 26 * u + 11 * u, 12 * u, colour, 'center', 800);
    });
  }

  return {
    resize(width, height, dpr, hudScale = 1) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = width;
      H = height;
      u = Math.max(0.75, Math.min(1.9, height / 560)) * hudScale;
    },
    clear() {
      ctx.clearRect(0, 0, W, H);
    },
    /** view: { plane, readout, camera, mission, target, course, warnings, messages, time, cockpit, assist, mapTargets } */
    draw(view) {
      ctx.clearRect(0, 0, W, H);
      const { plane, readout } = view;
      const kt = readout.airspeed * KNOTS;
      flightPathMarker(view.camera, plane);
      targetMarker(view.camera, view.target);
      speedTape(kt);
      altitudeTape(readout.altitude * FEET, readout.verticalSpeed * FEET_PER_MINUTE, readout.heightAboveGround);
      headingTape(readout.heading, view.course);
      missionPanel(view.mission);
      warnings(view.warnings, view.time);
      let my = 96 * u;
      for (const m of view.messages) {
        ctx.globalAlpha = Math.min(1, m.life);
        text(m.text, W / 2, my, (m.big ? 24 : 17) * u, m.colour ?? '#ffffff', 'center', 800);
        ctx.globalAlpha = 1;
        my += (m.big ? 30 : 24) * u;
      }
      const r = (view.cockpit ? 48 : 31) * u;
      const panelWidth = r * 2.36 * 6;
      drawInstrumentPanel(ctx, W / 2, H, r, {
        airspeed: readout.airspeed, pitch: readout.pitch, bank: readout.bank, altitude: readout.altitude, heading: readout.heading,
        course: view.course, verticalSpeed: readout.verticalSpeed, rpm: plane.engine.rpm, fuelFraction: plane.engine.fuel / SALTRUNNER.fuelCapacity, running: plane.engine.running,
      });
      chips(plane, view.assist, Math.max(8 * u, W / 2 - panelWidth / 2 - 104 * u), H - 82 * u);
      const mapR = 58 * u;
      if (minimap) minimap.draw(ctx, W - 22 * u - mapR, 12 * u + mapR, mapR, plane, readout.heading, view.mapTargets ?? []);
      const fuelMin = view.fuelMinutes;
      const fuelText = Number.isFinite(fuelMin) ? `FUEL ${Math.floor(fuelMin)}:${String(Math.floor((fuelMin % 1) * 60)).padStart(2, '0')}` : 'FUEL --';
      const right = Math.min(W - 8 * u - 104 * u, W / 2 + panelWidth / 2 + 12 * u);
      glassPanel(right, H - 82 * u, 104 * u, 22 * u, 5 * u);
      text(fuelText, right + 52 * u, H - 71 * u, 12 * u, fuelMin < 1.5 ? RED : '#ffffff', 'center', 800);
      glassPanel(right, H - 56 * u, 104 * u, 22 * u, 5 * u);
      text(`DAMAGE ${Math.round(plane.airframe.damage * 100)}%`, right + 52 * u, H - 45 * u, 12 * u, plane.airframe.damage > 0.3 ? RED : '#ffffff', 'center', 800);
      glassPanel(right, H - 30 * u, 104 * u, 22 * u, 5 * u);
      text(`G ${plane.gForce.toFixed(1)}`, right + 52 * u, H - 19 * u, 12 * u, plane.gForce > 4.5 ? AMBER : '#ffffff', 'center', 800);
    },
  };
}

export const HUD_COLOURS = { GREEN, AMBER, RED };
