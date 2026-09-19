import { clamp, DIFFICULTIES } from "../config.js";
export function aiInput(
  r,
  track,
  time,
  difficulty = "normal",
  human,
  settings = {},
) {
  const factor = DIFFICULTIES[difficulty] || 0.8,
    look = track.frame(r.s + Math.max(16, r.speed * 0.65));
  let target = (r.vehicle.speed * factor) / (1 + Math.abs(look.curvature) * 22);
  if (settings.rubberBand && human)
    target *= clamp(1 + (human.s - r.s) / 3000, 0.97, 1.04);
  const lane = Math.sin(r.index * 4 + time * 0.12) * track.width * 0.14;
  const error = lane - r.lateral,
    desired = clamp(error * 0.065, -0.48, 0.48),
    feed = track.frame(r.s).curvature * r.speed;
  const steering = clamp(
    (desired * (settings.assist ? 4.8 : 2.6) +
      feed +
      (desired - r.heading) * 2.5) /
      r.vehicle.handling,
    -1,
    1,
  );
  const mistake =
    Math.sin(time * 0.39 + r.index * 19) > 0.996
      ? 0.22 * Math.sin(time * 3 + r.index)
      : 0;
  return {
    throttle: r.speed < target ? 1 : 0.18,
    brake: r.speed > target + 7 ? 0.28 : 0,
    steer: clamp(steering + mistake, -1, 1),
    boost: Math.abs(look.curvature) < 0.003 && r.boost > 25 && r.speed > 40,
    drift: false,
  };
}
