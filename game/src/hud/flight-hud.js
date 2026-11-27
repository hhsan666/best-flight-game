// The head-up display: airspeed and altitude tapes, heading tape with the course bug, flight-path
// marker, a marker on the next ring or runway (an edge arrow when it is off screen), warnings,
// mission status, event call-outs, aircraft state chips, the moving map and the lit panel.
import { drawInstrumentPanel, MONO, SANS } from './instrument-panel.js';
import { KNOTS, FEET, FEET_PER_MINUTE, SALTRUNNER } from '../flight/aircraft-spec.js';
import { projectPoint } from '../core/vector-math.js';
import { drawRain } from './rain-overlay.js';

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
    const cy = H * 0.47;
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
    const cy = H * 0.47;
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

  /** The wind beside the heading box: an arrow showing where it blows relative to the nose, and its speed. */
  function windChip(x, y, heading, wind) {
    const speed = Math.hypot(wind[0], wind[2]) * KNOTS;
    glassPanel(x, y, 76 * u, 22 * u, 5 * u);
    if (speed < 1) {
      text('CALM', x + 38 * u, y + 11 * u, 11 * u, GREEN, 'center', 800);
      return;
    }
    const to = (Math.atan2(wind[0], -wind[2]) * 180) / Math.PI;
    const ax = x + 13 * u;
    const ay = y + 11 * u;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(((to - heading) * Math.PI) / 180);
    ctx.strokeStyle = '#7fd7ff';
    ctx.fillStyle = '#7fd7ff';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(0, 7 * u);
    ctx.lineTo(0, -3 * u);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -8 * u);
    ctx.lineTo(-4.5 * u, -2 * u);
    ctx.lineTo(4.5 * u, -2 * u);
    ctx.fill();
    ctx.restore();
    text(`WIND ${Math.round(speed)}`, x + 47 * u, y + 11 * u, 11 * u, '#7fd7ff', 'center', 800);
  }

  function headingTape(heading, course, wind) {
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
    if (wind) windChip(cx + boxW / 2 + 8 * u, y + h + 5 * u, heading, wind);
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

  /** From the cockpit: the windscreen frame and canopy rails around the view. */
  function canopyFrame() {
    ctx.save();
    const frame = (points) => {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#1b1e22');
      g.addColorStop(0.5, '#2b3036');
      g.addColorStop(1, '#1b1e22');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      ctx.fill();
    };
    frame([[0, H * 0.78], [W * 0.09, 0], [W * 0.125, 0], [W * 0.03, H * 0.8]]);
    frame([[W, H * 0.78], [W * 0.91, 0], [W * 0.875, 0], [W * 0.97, H * 0.8]]);
    frame([[0, 0], [W, 0], [W, H * 0.035], [W * 0.5, H * 0.055], [0, H * 0.035]]);
    ctx.strokeStyle = 'rgba(255,220,170,0.18)';
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.moveTo(W * 0.03, H * 0.8);
    ctx.lineTo(W * 0.125, 0);
    ctx.moveTo(W * 0.97, H * 0.8);
    ctx.lineTo(W * 0.875, 0);
    ctx.stroke();
    ctx.restore();
  }

  /** The cockpit's coaming: a curved glare shield from pillar to pillar that the panel sits in. */
  function glareShield(panelTop) {
    const edge = (path) => {
      path.moveTo(0, H * 0.8);
      path.quadraticCurveTo(W * 0.5, panelTop - 30 * u, W, H * 0.8);
    };
    ctx.save();
    const g = ctx.createLinearGradient(0, panelTop - 20 * u, 0, H);
    g.addColorStop(0, '#2a2d32');
    g.addColorStop(0.3, '#17191c');
    g.addColorStop(1, '#0b0c0e');
    ctx.fillStyle = g;
    ctx.beginPath();
    edge(ctx);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,0.2)';
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    edge(ctx);
    ctx.stroke();
    ctx.restore();
  }

  /** The sortie card: title and clock, the objective, progress, the steps as a checklist, score and par. */
  function missionPanel(m) {
    if (!m) return;
    const x = 22 * u;
    const y = 12 * u;
    const w = Math.min(250 * u, W * 0.3);
    glassPanel(x, y, w, 94 * u);
    text(m.title.toUpperCase(), x + 10 * u, y + 13 * u, 12 * u, AMBER, 'left', 800);
    text(m.time, x + w - 10 * u, y + 13 * u, 14 * u, '#ffffff', 'right', 700, MONO);
    text(m.objective, x + 10 * u, y + 32 * u, 13 * u, '#ffffff', 'left', 600);
    ctx.fillStyle = 'rgba(166,255,207,0.25)';
    ctx.fillRect(x + 10 * u, y + 45 * u, w - 20 * u, 4 * u);
    ctx.fillStyle = AMBER;
    ctx.fillRect(x + 10 * u, y + 45 * u, (w - 20 * u) * Math.min(1, m.progress), 4 * u);
    let cx = x + 10 * u;
    for (const item of m.checklist ?? []) {
      const label = `${item.state === 'done' ? '✓' : item.state === 'current' ? '▸' : '○'} ${item.label}`;
      text(label, cx, y + 62 * u, 10.5 * u, item.state === 'done' ? GREEN : item.state === 'current' ? AMBER : 'rgba(225,235,230,0.6)', 'left', 800);
      cx += ctx.measureText(label).width + 10 * u;
    }
    const wind = m.wind ? `WIND ${String(m.wind.from).padStart(3, '0')}°/${m.wind.knots}${m.wind.gust >= 5 ? `G${m.wind.knots + m.wind.gust}` : ''} KT` : '';
    text(m.score !== null && m.score !== undefined ? `SCORE ${m.score}` : wind, x + 10 * u, y + 80 * u, 11.5 * u, '#ffffff', 'left', 700, MONO);
    if (m.par) text(`PAR ${m.par}`, x + w - 10 * u, y + 80 * u, 11.5 * u, m.overPar ? RED : GREEN, 'right', 700, MONO);
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
      drawRain(ctx, W, H, view.rain ?? 0, view.time, readout.airspeed, view.cockpit);
      if (view.cockpit) canopyFrame();
      flightPathMarker(view.camera, plane);
      targetMarker(view.camera, view.target);
      speedTape(kt);
      altitudeTape(readout.altitude * FEET, readout.verticalSpeed * FEET_PER_MINUTE, readout.heightAboveGround);
      headingTape(readout.heading, view.course, view.wind);
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
      if (view.cockpit) glareShield(H - r * 2.5);
      drawInstrumentPanel(ctx, W / 2, H, r, {
        airspeed: readout.airspeed, pitch: readout.pitch, bank: readout.bank, altitude: readout.altitude, heading: readout.heading,
        course: view.course, verticalSpeed: readout.verticalSpeed, rpm: plane.engine.rpm, fuelFraction: plane.engine.fuel / SALTRUNNER.fuelCapacity, running: plane.engine.running,
      });
      chips(plane, view.assist, Math.max(8 * u, W / 2 - panelWidth / 2 - 104 * u), H - 82 * u);
      const mapR = 58 * u;
      if (minimap) minimap.draw(ctx, W - 22 * u - mapR, 12 * u + mapR, mapR, plane, readout.heading, view.mapTargets ?? []);
      const fuelMin = view.fuelMinutes;
      const clock = (m) => `${Math.floor(m)}:${String(Math.floor((m % 1) * 60)).padStart(2, '0')}`;
      const need = view.mission?.fuelNeeded;
      const planned = Number.isFinite(need);
      const panelRight = W / 2 + panelWidth / 2 + 12 * u;
      // FUEL and NEED share one wide chip where the panel leaves room, else stack in a taller narrow one.
      const wide = planned && W - 8 * u - panelRight >= 150 * u;
      const chipW = wide ? 150 * u : 104 * u;
      const fuelH = planned && !wide ? 38 * u : 22 * u;
      const right = Math.min(W - 8 * u - chipW, panelRight);
      const top = H - 60 * u - fuelH;
      glassPanel(right, top, chipW, fuelH, 5 * u);
      const fuelText = Number.isFinite(fuelMin) ? `FUEL ${clock(fuelMin)}` : 'FUEL --';
      const fuelColour = fuelMin < 1.5 ? RED : '#ffffff';
      if (planned) {
        // Endurance at the present fuel flow against what the rest of the route needs at this ground speed.
        const margin = Number.isFinite(fuelMin) ? fuelMin / Math.max(need, 0.01) : Infinity;
        const needColour = margin < 1 ? RED : margin < 1.25 ? AMBER : GREEN;
        if (wide) {
          text(fuelText, right + 8 * u, top + 11 * u, 12 * u, fuelColour, 'left', 800);
          text(`NEED ${clock(need)}`, right + chipW - 8 * u, top + 11 * u, 12 * u, needColour, 'right', 800);
        } else {
          text(fuelText, right + chipW / 2, top + 11 * u, 12 * u, fuelColour, 'center', 800);
          text(`NEED ${clock(need)}`, right + chipW / 2, top + 27 * u, 12 * u, needColour, 'center', 800);
        }
      } else text(fuelText, right + chipW / 2, top + 11 * u, 12 * u, fuelColour, 'center', 800);
      glassPanel(right, H - 56 * u, chipW, 22 * u, 5 * u);
      text(`DAMAGE ${Math.round(plane.airframe.damage * 100)}%`, right + chipW / 2, H - 45 * u, 12 * u, plane.airframe.damage > 0.3 ? RED : '#ffffff', 'center', 800);
      glassPanel(right, H - 30 * u, chipW, 22 * u, 5 * u);
      text(`G ${plane.gForce.toFixed(1)}`, right + chipW / 2, H - 19 * u, 12 * u, plane.gForce > 4.5 ? AMBER : '#ffffff', 'center', 800);
    },
  };
}

export const HUD_COLOURS = { GREEN, AMBER, RED };
