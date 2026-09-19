import { lerp } from "../config.js";
export class GhostRecorder {
  constructor() {
    this.samples = [];
    this.nextSample = 0;
  }
  capture(time, r, force = false) {
    const previous = this.samples.at(-1),
      jump = !!previous && (r.respawns || 0) !== previous.respawns;
    if (!force && !jump && time < this.nextSample) return;
    const sample = {
      t: time,
      s: r.s,
      lateral: r.lateral,
      height: r.height,
      heading: r.heading,
      penalty: r.penalty || 0,
      respawns: r.respawns || 0,
      jump,
    };
    if (previous?.t === time) this.samples[this.samples.length - 1] = sample;
    else this.samples.push(sample);
    this.nextSample = time + 0.08;
  }
}
export function sampleGhost(samples, time) {
  if (!samples?.length || time > samples.at(-1).t) return null;
  if (time <= samples[0].t) return samples[0];
  let lo = 0,
    hi = samples.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid].t < time) lo = mid + 1;
    else hi = mid;
  }
  const b = samples[lo],
    a = samples[Math.max(0, lo - 1)];
  if (time === b.t) return b;
  if (b.jump || Math.abs(b.s - a.s) > 30) return a;
  const t = (time - a.t) / (b.t - a.t),
    angle = Math.atan2(
      Math.sin(b.heading - a.heading),
      Math.cos(b.heading - a.heading),
    );
  return {
    s: lerp(a.s, b.s, t),
    lateral: lerp(a.lateral, b.lateral, t),
    height: lerp(a.height, b.height, t),
    heading: a.heading + angle * t,
  };
}
// First forward crossing of this distance; negative means the player is ahead.
export function ghostDelta(samples, distance, elapsed, penalty = 0) {
  if (!samples?.length || distance < 0) return null;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i];
    if (b.jump || b.s <= a.s || distance < a.s || distance > b.s) continue;
    return (
      elapsed +
      penalty -
      (lerp(a.t, b.t, (distance - a.s) / (b.s - a.s)) + (a.penalty || 0))
    );
  }
  return null;
}
