// Engine, propeller and fuel: RPM chases the throttle with inertia, thrust fades as airspeed
// approaches the propeller's limit, and fuel burns fast enough that every sortie needs a plan.
// Run the tank dry and the engine winds down to a windmilling propeller: you are a glider.

const GAME_FUEL_RATE = 11.5;

export function createPowerplant(spec, fuelFraction) {
  return { rpm: spec.idleRpm, propAngle: 0, fuel: spec.fuelCapacity * fuelFraction, running: true, thrust: 0, flow: 0, starved: false };
}

/** Advances engine and fuel by dt; returns thrust in newtons along the nose. */
export function updatePowerplant(engine, spec, throttle, forwardSpeed, damage, dt) {
  if (engine.fuel <= 0 && engine.running) {
    engine.fuel = 0;
    engine.running = false;
    engine.starved = true;
  }
  const windmill = Math.max(0, forwardSpeed) * 16;
  const target = engine.running ? spec.idleRpm + throttle * (spec.maxRpm - spec.idleRpm) * (1 - damage * 0.35) + forwardSpeed * 2.2 : windmill;
  engine.rpm += (target - engine.rpm) * Math.min(1, dt * (engine.running ? 1.8 : 0.7));
  engine.propAngle = (engine.propAngle + (engine.rpm / 60) * Math.PI * 2 * dt) % (Math.PI * 2);
  const power = engine.running ? Math.min(1.05, Math.max(0, (engine.rpm - spec.idleRpm * 0.85) / (spec.maxRpm - spec.idleRpm * 0.85))) : 0;
  const speedFactor = Math.max(-0.2, 1 - Math.max(0, forwardSpeed) / spec.propellerTopSpeed);
  engine.thrust = engine.running ? spec.staticThrust * power * speedFactor : -Math.max(0, forwardSpeed) * 4;
  engine.flow = engine.running ? (spec.fuelBurnIdle + (spec.fuelBurnFull - spec.fuelBurnIdle) * Math.pow(throttle, 1.3)) * GAME_FUEL_RATE : 0;
  engine.fuel = Math.max(0, engine.fuel - engine.flow * dt);
  return engine.thrust;
}

/** Minutes of flight left at the current fuel flow. */
export function enduranceMinutes(engine) {
  return engine.flow > 0 ? engine.fuel / engine.flow / 60 : Infinity;
}
