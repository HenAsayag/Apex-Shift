import { clamp, mod } from "../config.js";
export function createRacer({
  name = "You",
  vehicle,
  color,
  human = true,
  index = 0,
  lane = 0,
}) {
  return {
    name,
    vehicle,
    color,
    human,
    index,
    s: 0,
    lateral: lane,
    heading: 0,
    speed: 0,
    height: 0,
    verticalSpeed: 0,
    boost: 100,
    boosting: false,
    drifting: false,
    offTime: 0,
    checkpoint: 0,
    checkpointS: 0,
    lap: 1,
    lapStart: 0,
    bestLap: Infinity,
    penalty: 0,
    finished: false,
    finishTime: null,
    shake: 0,
    airtime: 0,
    driftTime: 0,
    boostTime: 0,
    collisions: 0,
    respawns: 0,
    trail: [],
    lastJump: -100,
    collisionCooldown: 0,
  };
}
export function respawn(racer, penalty = true) {
  racer.s = racer.checkpointS;
  racer.lateral = 0;
  racer.heading = 0;
  racer.speed = 0;
  racer.height = 0;
  racer.verticalSpeed = 0;
  racer.offTime = 0;
  if (penalty) {
    racer.penalty += 3;
    racer.respawns++;
  }
  racer.shake = 0.4;
}
export function stepPhysics(r, input, track, dt, settings, onEvent = () => {}) {
  if (r.finished) {
    r.speed *= Math.exp(-dt * 2);
    return;
  }
  const grip =
    settings.weather === "rain"
      ? 0.85
      : settings.weather === "snow"
        ? 0.7
        : track.config.id === "snow"
          ? 0.9
          : 1;
  const v = r.vehicle,
    previousS = r.s,
    frame = track.frame(r.s),
    grounded = r.height <= 0.015;
  r.collisionCooldown = Math.max(0, r.collisionCooldown - dt);
  r.boosting = input.boost && r.boost > 1 && input.throttle > 0;
  r.drifting =
    input.drift && grounded && r.speed > 14 && Math.abs(input.steer) > 0.1;
  const top = v.speed * (r.boosting ? v.boost : 1);
  const drag = 0.0025 * r.speed * r.speed + 1.4;
  r.speed = clamp(
    r.speed +
      (input.throttle * v.acceleration * (r.boosting ? 1.6 : 1) -
        input.brake * 42 -
        drag) *
        dt,
    0,
    top,
  );
  if (r.boosting) {
    r.boost = Math.max(0, r.boost - 25 * dt);
    r.boostTime += dt;
  } else r.boost = Math.min(100, r.boost + 9 * dt);
  const steering =
    input.steer *
    settings.sensitivity *
    v.handling *
    grip *
    (0.22 + 0.78 * Math.min(1, r.speed / 20)) *
    (r.drifting ? 1.15 + v.drift * 0.2 : 1) *
    (grounded ? 1 : v.air * 0.5);
  r.heading += steering * dt - frame.curvature * r.speed * dt;
  r.heading *= Math.exp(
    -dt * grip * (r.drifting ? 2.5 - v.drift : settings.assist ? 4.8 : 2.6),
  );
  r.heading = clamp(r.heading, -1.4, 1.4);
  r.s += Math.max(0, Math.cos(r.heading)) * r.speed * dt;
  r.lateral += Math.sin(r.heading) * r.speed * dt;
  if (settings.assist && !input.steer && !r.drifting)
    r.lateral *= Math.exp(-dt * 0.08);
  if (r.drifting) {
    r.driftTime += dt;
    r.speed *= Math.exp(-dt * 0.1);
    r.boost = Math.min(100, r.boost + 13 * dt);
  }
  const u = mod(r.s, track.length) / track.length;
  for (const pad of track.boosts)
    if (
      Math.abs(u - pad) < 0.011 &&
      grounded &&
      Math.abs(r.lateral) < track.width * 0.45
    ) {
      r.speed = Math.min(v.speed * v.boost, r.speed + 45 * dt);
      r.boost = Math.min(100, r.boost + 30 * dt);
      r.boosting = true;
    }
  for (const ramp of track.ramps) {
    const at =
      Math.floor(r.s / track.length) * track.length + ramp * track.length;
    if (previousS < at && r.s >= at && r.speed > 23 && r.s - r.lastJump > 30) {
      r.height = 1.25;
      r.verticalSpeed = 10 + r.speed * 0.08;
      r.lastJump = r.s;
      onEvent("jump", r);
    }
  }
  for (const obstacle of track.obstacles)
    if (
      Math.abs(mod(r.s, track.length) - obstacle.u * track.length) < 2.8 &&
      Math.abs(r.lateral - obstacle.lane) < 2.4 &&
      r.height < 1.5 &&
      r.collisionCooldown === 0
    ) {
      r.speed *= 0.4;
      r.heading += (r.lateral > obstacle.lane ? 1 : -1) * 0.25;
      r.shake = 0.6;
      r.collisionCooldown = 1;
      r.collisions++;
      onEvent("collision", r);
    }
  r.verticalSpeed -= 24 * dt;
  r.height += r.verticalSpeed * dt;
  if (r.height < 0) {
    if (r.verticalSpeed < -8) {
      r.shake = 0.28;
      onEvent("land", r);
    }
    r.height = 0;
    r.verticalSpeed = 0;
  }
  if (r.height > 0.1) r.airtime += dt;
  const edge = track.width / 2 - 1.1;
  const openEdge = track.ramps.some((p) => Math.abs(u - p) < 0.04);
  if (Math.abs(r.lateral) > edge && !openEdge && r.height < 2.5) {
    r.lateral = Math.sign(r.lateral) * edge;
    r.heading *= -0.4;
    r.speed *= 0.78;
    r.shake = 0.5;
    if (r.collisionCooldown === 0) {
      r.collisions++;
      r.collisionCooldown = 0.6;
      onEvent("collision", r);
    }
  }
  if (Math.abs(r.lateral) > track.width / 2 + 2) {
    r.offTime += dt;
    r.speed *= Math.exp(-dt * 1.2);
    if (r.offTime > 1.1) {
      respawn(r);
      onEvent("respawn", r);
    }
  } else r.offTime = 0;
  r.shake = Math.max(0, r.shake - dt);
}
