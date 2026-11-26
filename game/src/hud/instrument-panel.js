// The Saltrunner's backlit panel: six round gauges with glowing markings and needles — airspeed
// with its coloured arcs, attitude ball, altimeter, heading card with the course needle, vertical
// speed, and engine RPM with fuel — on a dark coaming. Drawn with Canvas 2D every frame.
import { SALTRUNNER, KNOTS, FEET, FEET_PER_MINUTE } from '../flight/aircraft-spec.js';

export const MONO = '"JetBrains Mono", ui-monospace, Consolas, "DejaVu Sans Mono", monospace';
export const SANS = 'Inter, system-ui, "Segoe UI", Roboto, "DejaVu Sans", sans-serif';
const GLOW = '#ffe7b8';
const NEEDLE = '#ff9d3c';

function bezel(ctx, x, y, r, label) {
  const rim = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.2, x, y, r * 1.08);
  rim.addColorStop(0, '#4a4f57');
  rim.addColorStop(1, '#16181c');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.08, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
  face.addColorStop(0, '#24262b');
  face.addColorStop(1, '#0b0c0e');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const backlight = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
  backlight.addColorStop(0, 'rgba(255,190,110,0.0)');
  backlight.addColorStop(1, 'rgba(255,170,90,0.16)');
  ctx.fillStyle = backlight;
  ctx.fill();
  if (label) {
    ctx.fillStyle = 'rgba(255,231,184,0.75)';
    ctx.font = `600 ${Math.round(r * 0.17)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + r * 0.42);
  }
}

function glass(ctx, x, y, r) {
  const shine = ctx.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.3);
  shine.addColorStop(0, 'rgba(255,255,255,0.16)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.9);
  ctx.fill();
}

function lit(ctx, colour, blur) {
  ctx.shadowColor = colour;
  ctx.shadowBlur = blur;
}

function needle(ctx, x, y, r, angle, length = 0.82, colour = NEEDLE, width = 0.07) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  lit(ctx, colour, r * 0.25);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(-r * width, r * 0.12);
  ctx.lineTo(0, -r * length);
  ctx.lineTo(r * width, r * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2b2d31';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function ticks(ctx, x, y, r, from, to, count, major, toAngle, labels) {
  ctx.save();
  lit(ctx, GLOW, r * 0.12);
  ctx.strokeStyle = GLOW;
  ctx.fillStyle = GLOW;
  ctx.font = `700 ${Math.round(r * 0.2)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= count; i++) {
    const value = from + ((to - from) * i) / count;
    const a = toAngle(value);
    const isMajor = i % major === 0;
    ctx.lineWidth = isMajor ? r * 0.045 : r * 0.022;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(a) * r * (isMajor ? 0.74 : 0.82), y - Math.cos(a) * r * (isMajor ? 0.74 : 0.82));
    ctx.lineTo(x + Math.sin(a) * r * 0.93, y - Math.cos(a) * r * 0.93);
    ctx.stroke();
    if (isMajor && labels) ctx.fillText(labels(value), x + Math.sin(a) * r * 0.57, y - Math.cos(a) * r * 0.57);
  }
  ctx.restore();
}

function arc(ctx, x, y, r, a0, a1, colour, width) {
  ctx.save();
  lit(ctx, colour, r * 0.15);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, a0 - Math.PI / 2, a1 - Math.PI / 2);
  ctx.stroke();
  ctx.restore();
}

export function drawAirspeedIndicator(ctx, x, y, r, airspeed) {
  bezel(ctx, x, y, r, 'KNOTS');
  const toAngle = (kt) => (-0.82 + (Math.min(kt, 180) / 180) * 1.64) * Math.PI;
  const { flapRange, normal, caution, redLine } = SALTRUNNER.arcs;
  arc(ctx, x, y, r * 0.88, toAngle(flapRange[0]), toAngle(flapRange[1]), '#f3f3f3', r * 0.06);
  arc(ctx, x, y, r * 0.95, toAngle(normal[0]), toAngle(normal[1]), '#46e07a', r * 0.07);
  arc(ctx, x, y, r * 0.95, toAngle(caution[0]), toAngle(caution[1]), '#ffd23f', r * 0.07);
  arc(ctx, x, y, r * 0.95, toAngle(redLine - 1.5), toAngle(redLine + 1.5), '#ff3b2f', r * 0.09);
  ticks(ctx, x, y, r, 0, 180, 36, 4, toAngle, (v) => (v > 0 ? String(v) : ''));
  needle(ctx, x, y, r, toAngle(airspeed * KNOTS));
  glass(ctx, x, y, r);
}

export function drawAttitudeIndicator(ctx, x, y, r, pitchDeg, bankDeg) {
  bezel(ctx, x, y, r, '');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate((-bankDeg * Math.PI) / 180);
  const shift = Math.max(-r, Math.min(r, (pitchDeg / 25) * r * 0.8));
  const sky = ctx.createLinearGradient(0, -r, 0, shift);
  sky.addColorStop(0, '#1d6fd0');
  sky.addColorStop(1, '#5fb0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(-r * 1.5, -r * 2.5, r * 3, r * 2.5 + shift);
  const earth = ctx.createLinearGradient(0, shift, 0, r * 1.5);
  earth.addColorStop(0, '#9c5a26');
  earth.addColorStop(1, '#4a2a12');
  ctx.fillStyle = earth;
  ctx.fillRect(-r * 1.5, shift, r * 3, r * 2.5);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.03;
  ctx.beginPath();
  ctx.moveTo(-r * 1.5, shift);
  ctx.lineTo(r * 1.5, shift);
  ctx.stroke();
  for (const p of [-20, -10, 10, 20]) {
    const py = shift - (p / 25) * r * 0.8;
    const w = Math.abs(p) === 10 ? 0.28 : 0.4;
    ctx.beginPath();
    ctx.moveTo(-r * w, py);
    ctx.lineTo(r * w, py);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  lit(ctx, '#ffb347', r * 0.2);
  ctx.strokeStyle = '#ffb347';
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y);
  ctx.lineTo(x - r * 0.2, y);
  ctx.lineTo(x - r * 0.1, y + r * 0.1);
  ctx.moveTo(x + r * 0.55, y);
  ctx.lineTo(x + r * 0.2, y);
  ctx.lineTo(x + r * 0.1, y + r * 0.1);
  ctx.stroke();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ticks(ctx, x, y, r, -60, 60, 12, 3, (b) => (b * Math.PI) / 180, null);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-bankDeg * Math.PI) / 180);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.92);
  ctx.lineTo(-r * 0.07, -r * 0.78);
  ctx.lineTo(r * 0.07, -r * 0.78);
  ctx.fill();
  ctx.restore();
  glass(ctx, x, y, r);
}

export function drawAltimeter(ctx, x, y, r, altitudeMetres) {
  bezel(ctx, x, y, r, 'ALT FT');
  const feet = altitudeMetres * FEET;
  ticks(ctx, x, y, r, 0, 1000, 50, 5, (v) => (v / 1000) * Math.PI * 2, (v) => (v < 1000 ? String(v / 100) : ''));
  ctx.save();
  lit(ctx, GLOW, r * 0.12);
  ctx.fillStyle = '#050607';
  ctx.fillRect(x - r * 0.36, y + r * 0.12, r * 0.72, r * 0.26);
  ctx.fillStyle = GLOW;
  ctx.font = `700 ${Math.round(r * 0.22)}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.max(0, Math.round(feet / 10) * 10)).padStart(5, ' '), x, y + r * 0.26);
  ctx.restore();
  needle(ctx, x, y, r, ((feet % 10000) / 10000) * Math.PI * 2, 0.5, '#f0e6d2', 0.1);
  needle(ctx, x, y, r, ((feet % 1000) / 1000) * Math.PI * 2, 0.86, NEEDLE, 0.06);
  glass(ctx, x, y, r);
}

export function drawHeadingIndicator(ctx, x, y, r, headingDeg, courseDeg) {
  bezel(ctx, x, y, r, '');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-headingDeg * Math.PI) / 180);
  lit(ctx, GLOW, r * 0.12);
  ctx.strokeStyle = GLOW;
  ctx.fillStyle = GLOW;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 10) {
    const a = (d * Math.PI) / 180;
    const major = d % 30 === 0;
    ctx.lineWidth = major ? r * 0.04 : r * 0.02;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * r * (major ? 0.74 : 0.82), -Math.cos(a) * r * (major ? 0.74 : 0.82));
    ctx.lineTo(Math.sin(a) * r * 0.92, -Math.cos(a) * r * 0.92);
    ctx.stroke();
    if (major) {
      ctx.save();
      ctx.translate(Math.sin(a) * r * 0.58, -Math.cos(a) * r * 0.58);
      ctx.rotate(a);
      ctx.font = `700 ${Math.round(r * (d % 90 === 0 ? 0.24 : 0.17))}px ${SANS}`;
      ctx.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10), 0, 0);
      ctx.restore();
    }
  }
  if (courseDeg !== null && courseDeg !== undefined) {
    const a = (courseDeg * Math.PI) / 180;
    lit(ctx, '#ff5ad1', r * 0.2);
    ctx.strokeStyle = '#ff6ad8';
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(-Math.sin(a) * r * 0.62, Math.cos(a) * r * 0.62);
    ctx.lineTo(Math.sin(a) * r * 0.62, -Math.cos(a) * r * 0.62);
    ctx.stroke();
    ctx.fillStyle = '#ff6ad8';
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * r * 0.78, -Math.cos(a) * r * 0.78);
    ctx.lineTo(Math.sin(a) * r * 0.62 + Math.cos(a) * r * 0.1, -Math.cos(a) * r * 0.62 + Math.sin(a) * r * 0.1);
    ctx.lineTo(Math.sin(a) * r * 0.62 - Math.cos(a) * r * 0.1, -Math.cos(a) * r * 0.62 - Math.sin(a) * r * 0.1);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  lit(ctx, '#ffb347', r * 0.2);
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.3);
  ctx.lineTo(x - r * 0.18, y + r * 0.22);
  ctx.lineTo(x, y + r * 0.12);
  ctx.lineTo(x + r * 0.18, y + r * 0.22);
  ctx.fill();
  ctx.fillRect(x - r * 0.02, y - r * 0.98, r * 0.04, r * 0.14);
  ctx.restore();
  glass(ctx, x, y, r);
}

export function drawVerticalSpeed(ctx, x, y, r, verticalSpeed) {
  bezel(ctx, x, y, r, 'VS ×100');
  const toAngle = (fpm) => -Math.PI / 2 + (Math.max(-2000, Math.min(2000, fpm)) / 2000) * Math.PI * 0.85;
  ticks(ctx, x, y, r, -2000, 2000, 16, 4, toAngle, (v) => String(Math.abs(v / 100)));
  needle(ctx, x, y, r, toAngle(verticalSpeed * FEET_PER_MINUTE));
  glass(ctx, x, y, r);
}

export function drawEngineGauge(ctx, x, y, r, rpm, fuelFraction, running) {
  bezel(ctx, x, y, r, running ? 'RPM ×100' : 'ENGINE OUT');
  const toAngle = (v) => (-0.75 + (v / 3000) * 1.0) * Math.PI;
  arc(ctx, x, y, r * 0.95, toAngle(2100), toAngle(2700), '#46e07a', r * 0.07);
  arc(ctx, x, y, r * 0.95, toAngle(2700), toAngle(2780), '#ff3b2f', r * 0.09);
  ticks(ctx, x, y, r, 0, 3000, 15, 5, toAngle, (v) => String(v / 100));
  needle(ctx, x, y, r, toAngle(rpm), 0.8);
  const fa = (f) => Math.PI * 0.42 + f * Math.PI * 0.32;
  arc(ctx, x, y, r * 0.66, fa(0), fa(0.15), '#ff3b2f', r * 0.06);
  arc(ctx, x, y, r * 0.66, fa(0.15), fa(1), '#ffe7b8', r * 0.03);
  needle(ctx, x, y, r * 0.7, fa(fuelFraction), 0.95, fuelFraction < 0.15 ? '#ff3b2f' : '#7fd8ff', 0.09);
  ctx.save();
  ctx.fillStyle = 'rgba(255,231,184,0.8)';
  ctx.font = `700 ${Math.round(r * 0.15)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', x + r * 0.5, y + r * 0.72);
  ctx.restore();
  glass(ctx, x, y, r);
}

/** The whole panel: a dark coaming with the six gauges in a row, centred at (cx, bottom). */
export function drawInstrumentPanel(ctx, cx, bottom, r, data) {
  const gap = r * 2.36;
  const width = gap * 6 + r * 0.3;
  const top = bottom - r * 2.5;
  ctx.save();
  const coaming = ctx.createLinearGradient(0, top, 0, bottom);
  coaming.addColorStop(0, 'rgba(34,37,42,0.92)');
  coaming.addColorStop(1, 'rgba(14,15,18,0.96)');
  ctx.fillStyle = coaming;
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, top, width, bottom - top + r * 0.4, [r * 0.5, r * 0.5, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,140,0.25)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();
  ctx.restore();
  const y = top + r * 1.25;
  const x0 = cx - gap * 2.5;
  drawAirspeedIndicator(ctx, x0, y, r, data.airspeed);
  drawAttitudeIndicator(ctx, x0 + gap, y, r, data.pitch, data.bank);
  drawAltimeter(ctx, x0 + gap * 2, y, r, data.altitude);
  drawHeadingIndicator(ctx, x0 + gap * 3, y, r, data.heading, data.course);
  drawVerticalSpeed(ctx, x0 + gap * 4, y, r, data.verticalSpeed);
  drawEngineGauge(ctx, x0 + gap * 5, y, r, data.rpm, data.fuelFraction, data.running);
}
