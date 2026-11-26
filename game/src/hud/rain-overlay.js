// Rain in a squall: slanted streaks that lean with airspeed, and drops beading on the windscreen
// in the cockpit view. Drawn first on the HUD layer so instruments stay readable over it.
import { hashCell } from '../core/seeded-random.js';

export function drawRain(ctx, W, H, intensity, time, airspeed, cockpit) {
  if (intensity <= 0) return;
  const streaks = Math.round(260 * intensity);
  const lean = Math.min(0.55, 0.12 + airspeed / 140);
  const length = H * (0.05 + Math.min(0.08, airspeed / 900));
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < streaks; i++) {
    const cycle = Math.floor(time * 3 + hashCell(i, 7, 3) * 3);
    const x = hashCell(i, cycle, 11) * (W + length * lean) - length * lean * 0.5;
    const fall = ((time * 2.6 + hashCell(i, 3, 5)) % 1) * (H + length) - length;
    const alpha = 0.10 + 0.22 * hashCell(i, cycle, 19);
    ctx.strokeStyle = `rgba(210,222,235,${alpha * intensity})`;
    ctx.lineWidth = 1 + hashCell(i, 1, 23) * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, fall);
    ctx.lineTo(x - lean * length, fall + length);
    ctx.stroke();
  }
  if (cockpit) {
    for (let i = 0; i < 70 * intensity; i++) {
      const life = (time * 0.4 + hashCell(i, 2, 29)) % 1;
      const x = hashCell(i, Math.floor(time * 0.4 + hashCell(i, 2, 29)), 31) * W;
      const y = hashCell(i, 5, 37) * H * 0.7 + life * H * 0.06;
      const r = 1.5 + hashCell(i, 9, 41) * 3;
      ctx.fillStyle = `rgba(220,230,240,${0.25 * (1 - life)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
