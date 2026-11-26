// Keyboard and mouse flying. Keys: W/S or arrows pitch, A/D or arrows roll, Q/E rudder, R/F or the
// wheel throttle, G/T flaps down/up, B or Space brakes, C camera, L landing light, Esc pause.
// Click the view to fly with the mouse: it becomes a self-centring stick (Esc releases it).

const FLIGHT_KEYS = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyG', 'KeyT', 'KeyB', 'KeyC', 'KeyL',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);

export const CONTROL_HELP = [
  ['W / S  or  ↑ / ↓', 'Pitch: push the nose down / pull it up'],
  ['A / D  or  ← / →', 'Roll left / right (bank to turn)'],
  ['Q / E', 'Rudder: yaw left / right, steer on the ground'],
  ['R / F  or  mouse wheel', 'Throttle up / down'],
  ['G / T', 'Flaps down / up a notch (UP, 1, FULL)'],
  ['B  or  Space', 'Wheel brakes'],
  ['Click the view', 'Fly with the mouse as a self-centring stick'],
  ['Right-drag', 'Look around (orbit camera)'],
  ['C', 'Camera: chase, cockpit, orbit'],
  ['L', 'Landing light'],
  ['Esc  or  P', 'Pause'],
];

export function createPilotInput(surface, settings) {
  const held = new Set();
  const actions = [];
  const stick = { x: 0, y: 0 };
  let wheel = 0;
  let mouseFlying = false;
  let dragging = false;
  let orbit = { dx: 0, dy: 0 };

  window.addEventListener('keydown', (e) => {
    if (FLIGHT_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) actions.push(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  surface.addEventListener('contextmenu', (e) => e.preventDefault());
  surface.addEventListener('mousedown', (e) => {
    if (e.button === 2) dragging = true;
    else if (e.button === 0 && input.flightActive && surface.requestPointerLock) surface.requestPointerLock();
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) dragging = false;
  });
  document.addEventListener('pointerlockchange', () => {
    mouseFlying = document.pointerLockElement === surface;
    stick.x = 0;
    stick.y = 0;
  });
  window.addEventListener('mousemove', (e) => {
    if (mouseFlying) {
      const k = 0.0042 * settings.mouseSensitivity;
      stick.x = Math.max(-1, Math.min(1, stick.x + e.movementX * k));
      stick.y = Math.max(-1, Math.min(1, stick.y + e.movementY * k));
    } else if (dragging) {
      orbit.dx += e.movementX;
      orbit.dy += e.movementY;
    }
  });
  surface.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheel += -Math.sign(e.deltaY);
  }, { passive: false });

  const axis = (neg, pos) => (held.has(pos[0]) || held.has(pos[1]) ? 1 : 0) - (held.has(neg[0]) || held.has(neg[1]) ? 1 : 0);

  const input = {
    flightActive: false,
    get mouseFlying() {
      return mouseFlying;
    },
    releaseMouse() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    /** One frame of pilot intent plus the edge-triggered keys pressed since the last call. */
    sample(dt) {
      const invert = settings.invertPitch ? -1 : 1;
      let pitch = axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) * invert;
      let roll = axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
      let analog = false;
      if (mouseFlying) {
        stick.x *= Math.max(0, 1 - dt * 1.4);
        stick.y *= Math.max(0, 1 - dt * 1.4);
        if (pitch === 0 && roll === 0) {
          pitch = Math.abs(stick.y) > 0.03 ? stick.y * invert : 0;
          roll = Math.abs(stick.x) > 0.03 ? stick.x : 0;
          analog = true;
        }
      }
      const throttleKeys = axis(['KeyF', 'KeyF'], ['KeyR', 'KeyR']);
      const frame = {
        pitch, roll, analog,
        yaw: axis(['KeyQ', 'KeyQ'], ['KeyE', 'KeyE']),
        throttleDelta: throttleKeys,
        throttleNotches: wheel,
        throttleSet: null,
        brakes: held.has('KeyB') || held.has('Space') ? 1 : 0,
        flapStep: 0,
        actions: actions.splice(0),
        orbit,
      };
      wheel = 0;
      orbit = { dx: 0, dy: 0 };
      for (const code of frame.actions) {
        if (code === 'KeyG') frame.flapStep += 1;
        if (code === 'KeyT') frame.flapStep -= 1;
      }
      return frame;
    },
    stick,
  };
  return input;
}
