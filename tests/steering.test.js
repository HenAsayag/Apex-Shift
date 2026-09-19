import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { driverSteering } from "../src/core/input.js";
import { Track } from "../src/core/track.js";
import { TRACKS } from "../src/data/tracks.js";

test("human right steering moves toward camera right on every circuit", () => {
  for (const config of TRACKS) {
    const track = new Track(config);
    for (const fraction of [0, 0.15, 0.5, 0.8]) {
      const frame = track.frame(track.length * fraction);
      const camera = new PerspectiveCamera();
      camera.position.copy(frame.pos).addScaledVector(frame.forward, -10);
      camera.up.copy(frame.up);
      camera.lookAt(frame.pos);
      camera.updateMatrixWorld();
      const screenRight = new Vector3().setFromMatrixColumn(
        camera.matrixWorld,
        0,
      );
      assert.ok(
        frame.right.clone().multiplyScalar(driverSteering(1)).dot(screenRight) >
          0.99,
      );
      assert.ok(
        frame.right
          .clone()
          .multiplyScalar(driverSteering(-1))
          .dot(screenRight) < -0.99,
      );
    }
  }
});
