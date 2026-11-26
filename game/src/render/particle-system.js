// Short-lived effects that make events readable: tyre smoke and dust at touchdown, engine smoke
// when damaged, sea spray, and the fire, smoke and sparks of a crash.
const KINDS = {
  smoke: { life: 4.0, grow: 9, rise: 2.5, drag: 0.6, color: [0.32, 0.32, 0.33], alpha: 0.55, glow: false },
  dust: { life: 1.6, grow: 6, rise: 0.6, drag: 1.5, color: [0.72, 0.66, 0.54], alpha: 0.45, glow: false },
  tyre: { life: 1.1, grow: 4, rise: 0.4, drag: 2.0, color: [0.85, 0.85, 0.86], alpha: 0.5, glow: false },
  spray: { life: 1.4, grow: 5, rise: -4, drag: 0.8, color: [0.92, 0.95, 1.0], alpha: 0.6, glow: false },
  fire: { life: 0.9, grow: 3, rise: 4, drag: 1.0, color: [1.0, 0.45, 0.12], alpha: 1.4, glow: true },
  spark: { life: 0.6, grow: 0, rise: -9, drag: 0.2, color: [1.0, 0.8, 0.4], alpha: 1.6, glow: true },
};

export function createParticleSystem() {
  const particles = [];
  let seed = 1;
  const jitter = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  return {
    emit(kind, position, velocity, size = 2, count = 1, spread = 1) {
      const k = KINDS[kind];
      for (let i = 0; i < count && particles.length < 2500; i++) {
        particles.push({
          kind: k, age: 0, life: k.life * (0.7 + 0.6 * (jitter() + 0.5)), size,
          p: [position[0] + jitter() * spread, position[1] + jitter() * spread * 0.5, position[2] + jitter() * spread],
          v: [velocity[0] + jitter() * spread * 2, velocity[1] + jitter() * spread, velocity[2] + jitter() * spread * 2],
        });
      }
    },
    update(dt, wind) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const q = particles[i];
        q.age += dt;
        if (q.age >= q.life) {
          particles.splice(i, 1);
          continue;
        }
        const k = q.kind;
        for (let a = 0; a < 3; a++) q.v[a] += ((wind[a] ?? 0) - q.v[a]) * Math.min(1, k.drag * dt);
        q.v[1] += k.rise * dt;
        for (let a = 0; a < 3; a++) q.p[a] += q.v[a] * dt;
      }
    },
    clear() {
      particles.length = 0;
    },
    draw(sprites) {
      for (const q of particles) {
        const t = q.age / q.life;
        const k = q.kind;
        const size = q.size + k.grow * q.age;
        if (k.glow) sprites.light(q.p, k.color, size, k.alpha * (1 - t));
        else sprites.puff(q.p, k.color, size, k.alpha * (1 - t) * Math.min(1, q.age * 8));
      }
    },
  };
}
