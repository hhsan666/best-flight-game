// Every sound is synthesised with Web Audio, nothing is loaded: an engine whose firing note and
// filter follow RPM and throttle, propeller buzz, wind that rises with airspeed, tyre rumble on the
// ground, the stall horn, and one-shot cues (ring chime, miss, touchdown, crash, flaps, fanfare).

export function createSoundEngine() {
  let ctx = null;
  let master;
  let nodes = null;
  let volume = 0.7;

  function noiseBuffer(seconds = 2) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    return buffer;
  }

  function loopNoise() {
    const source = ctx.createBufferSource();
    source.buffer = nodes.noise;
    source.loop = true;
    source.start();
    return source;
  }

  function build() {
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    nodes = { noise: noiseBuffer() };
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.Q.value = 2.5;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineFilter.connect(engineGain).connect(master);
    const firing = ctx.createOscillator();
    firing.type = 'sawtooth';
    const rumble = ctx.createOscillator();
    rumble.type = 'square';
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.35;
    firing.connect(engineFilter);
    rumble.connect(rumbleGain).connect(engineFilter);
    firing.start();
    rumble.start();
    const prop = ctx.createBiquadFilter();
    prop.type = 'bandpass';
    prop.Q.value = 3;
    const propGain = ctx.createGain();
    propGain.gain.value = 0;
    loopNoise().connect(prop).connect(propGain).connect(master);
    const wind = ctx.createBiquadFilter();
    wind.type = 'bandpass';
    wind.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    loopNoise().connect(wind).connect(windGain).connect(master);
    const roll = ctx.createBiquadFilter();
    roll.type = 'lowpass';
    roll.frequency.value = 180;
    const rollGain = ctx.createGain();
    rollGain.gain.value = 0;
    loopNoise().connect(roll).connect(rollGain).connect(master);
    const horn = ctx.createOscillator();
    horn.type = 'square';
    horn.frequency.value = 540;
    const hornGain = ctx.createGain();
    hornGain.gain.value = 0;
    horn.connect(hornGain).connect(master);
    horn.start();
    Object.assign(nodes, { engineFilter, engineGain, firing, rumble, prop, propGain, wind, windGain, rollGain, hornGain });
  }

  const at = (param, value, smooth = 0.08) => param.setTargetAtTime(value, ctx.currentTime, smooth);

  function tone(freq, start, length, type = 'sine', gain = 0.25, sweepTo = null) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + start + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
    osc.connect(g).connect(master);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + length + 0.05);
  }

  function burst(length, freq, q, gain, type = 'bandpass') {
    const source = ctx.createBufferSource();
    source.buffer = nodes.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + length);
    source.connect(filter).connect(g).connect(master);
    source.start();
    source.stop(ctx.currentTime + length + 0.05);
  }

  const CUES = {
    ring: () => [880, 1108.7, 1318.5].forEach((f, i) => tone(f, i * 0.07, 0.5, 'sine', 0.18)),
    miss: () => tone(150, 0, 0.35, 'sawtooth', 0.12, 90),
    touchdown: () => {
      burst(0.25, 2600, 2.5, 0.25);
      tone(70, 0, 0.3, 'sine', 0.35, 45);
    },
    hard: () => {
      burst(0.4, 900, 1.2, 0.5);
      tone(55, 0, 0.5, 'sine', 0.6, 30);
    },
    crash: () => {
      burst(2.2, 400, 0.5, 0.9, 'lowpass');
      tone(48, 0, 1.6, 'sine', 0.8, 24);
      burst(0.8, 3000, 1, 0.35);
    },
    flaps: () => burst(0.7, 700, 4, 0.12),
    click: () => tone(1250, 0, 0.06, 'square', 0.06),
    tree: () => burst(0.5, 1800, 0.8, 0.4),
    fanfare: () => [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, i * 0.13, i === 3 ? 0.9 : 0.3, 'triangle', 0.2)),
    fail: () => [392, 311.1, 233.1].forEach((f, i) => tone(f, i * 0.18, 0.45, 'triangle', 0.18)),
  };

  return {
    /** Must run inside a user gesture (a click or key press) before audio can play. */
    start() {
      if (!ctx) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        ctx = new Context();
        build();
      }
      if (ctx.state === 'suspended') ctx.resume();
    },
    setVolume(v) {
      volume = v;
      if (master) at(master.gain, v, 0.05);
    },
    /** Continuous sounds follow the aircraft every frame; `active` silences them in menus. */
    update(plane, active) {
      if (!ctx || !nodes) return;
      const on = active ? 1 : 0;
      const rpm = plane ? plane.engine.rpm : 0;
      const throttle = plane ? plane.controls.throttle : 0;
      const airspeed = plane ? plane.airspeed : 0;
      const running = plane?.engine.running ? 1 : 0;
      at(nodes.firing.frequency, Math.max(20, (rpm / 60) * 2));
      at(nodes.rumble.frequency, Math.max(10, rpm / 60));
      at(nodes.engineFilter.frequency, 220 + throttle * 900 + rpm * 0.12);
      at(nodes.engineGain.gain, on * running * (0.05 + throttle * 0.11));
      at(nodes.prop.frequency, Math.max(40, (rpm / 60) * 3 * 2));
      at(nodes.propGain.gain, on * Math.min(1, rpm / 2700) * 0.22);
      at(nodes.wind.frequency, 350 + airspeed * 14);
      at(nodes.windGain.gain, on * Math.min(0.5, (airspeed / 75) ** 2 * 0.35));
      const rolling = plane?.onGround ? Math.min(1, Math.hypot(plane.velocity[0], plane.velocity[2]) / 25) : 0;
      at(nodes.rollGain.gain, on * rolling * 0.5);
      const horn = plane?.stallWarning && active ? 0.07 * (Math.sin(ctx.currentTime * 18) > 0 ? 1 : 0.2) : 0;
      at(nodes.hornGain.gain, horn, 0.01);
    },
    cue(name) {
      if (ctx && nodes && CUES[name]) CUES[name]();
    },
  };
}
