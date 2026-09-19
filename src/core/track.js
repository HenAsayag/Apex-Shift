import * as THREE from "three";
import { mod, lerp } from "../config.js";
export class Track {
  constructor(config) {
    this.config = config;
    this.curve = new THREE.CatmullRomCurve3(
      config.points.map((p) => new THREE.Vector3(...p)),
      true,
      "catmullrom",
      0.45,
    );
    this.curve.arcLengthDivisions = 4000;
    this.length = this.curve.getLength();
    this.width = config.width;
    this.samples = 1600;
    this.frames = [];
    let previousForward = null,
      previousRight = null;
    for (let i = 0; i <= this.samples; i++) {
      const u = (i % this.samples) / this.samples,
        pos = this.curve.getPointAt(u),
        forward = this.curve.getTangentAt(u).normalize();
      let right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), forward)
        .normalize();
      if (config.loop && previousForward)
        right = previousRight
          .clone()
          .applyQuaternion(
            new THREE.Quaternion().setFromUnitVectors(previousForward, forward),
          )
          .normalize();
      if (right.lengthSq() < 0.1) right.set(1, 0, 0);
      const up = new THREE.Vector3().crossVectors(forward, right).normalize();
      this.frames.push({ pos, forward, right, up, curvature: 0, bank: 0 });
      previousForward = forward;
      previousRight = right;
    }
    if (config.loop) {
      const first = this.frames[0],
        last = this.frames[this.samples];
      const angle = Math.atan2(
        last.right.clone().cross(first.right).dot(first.forward),
        last.right.dot(first.right),
      );
      this.frames.forEach((f, i) => {
        f.right.applyAxisAngle(f.forward, (angle * i) / this.samples);
        f.up.crossVectors(f.forward, f.right).normalize();
      });
    }
    this.frames.forEach((f, i) => {
      const next = this.frames[(i + 3) % this.samples];
      f.curvature =
        f.forward.clone().cross(next.forward).dot(f.up) /
        ((this.length * 3) / this.samples);
      f.bank = Math.max(-0.3, Math.min(0.3, -f.curvature * 16));
      f.right.applyAxisAngle(f.forward, f.bank);
      f.up.applyAxisAngle(f.forward, f.bank);
    });
    this.checkpoints = [0.25, 0.5, 0.75, 1];
    this.boosts = config.loop ? [0.01, 0.51] : [0.065, 0.51];
    this.ramps = config.loop ? [0.43, 0.71] : [0.19, 0.66];
    this.obstacles =
      config.difficulty > 1
        ? [
            { u: 0.39, lane: -this.width * 0.27 },
            { u: 0.78, lane: this.width * 0.25 },
          ]
        : [];
  }
  rampHeight(distance) {
    const s = mod(distance, this.length);
    for (const u of this.ramps) {
      const d = s - u * this.length;
      if (d >= -8 && d < 0) return ((d + 8) / 8) * 1.25;
    }
    return 0;
  }
  frame(distance) {
    const p = (mod(distance, this.length) / this.length) * this.samples,
      i = Math.floor(p),
      f = p - i,
      a = this.frames[i],
      b = this.frames[i + 1];
    return {
      pos: a.pos.clone().lerp(b.pos, f),
      forward: a.forward.clone().lerp(b.forward, f).normalize(),
      right: a.right.clone().lerp(b.right, f).normalize(),
      up: a.up.clone().lerp(b.up, f).normalize(),
      curvature: lerp(a.curvature, b.curvature, f),
      bank: lerp(a.bank, b.bank, f),
    };
  }
  world(distance, lateral = 0, height = 0) {
    const f = this.frame(distance);
    return f.pos
      .addScaledVector(f.right, lateral)
      .addScaledVector(f.up, height);
  }
}
