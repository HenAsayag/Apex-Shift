import { Track } from "../src/core/track.js";
import { TRACKS } from "../src/data/tracks.js";
import { VEHICLES } from "../src/data/vehicles.js";
import { createRacer, stepPhysics } from "../src/core/physics.js";
import { aiInput } from "../src/core/ai.js";
import { DEFAULT_SETTINGS } from "../src/config.js";
for (const cfg of TRACKS) {
  const track = new Track(cfg);
  for (const difficulty of ["easy", "normal", "hard", "expert"]) {
    const r = createRacer({ vehicle: VEHICLES[0], human: false });
    let time = 0;
    while (r.s < track.length && time < 180) {
      stepPhysics(
        r,
        aiInput(r, track, time, difficulty, r, DEFAULT_SETTINGS),
        track,
        1 / 120,
        DEFAULT_SETTINGS,
      );
      time += 1 / 120;
    }
    console.log(
      cfg.id,
      difficulty,
      time.toFixed(2),
      r.collisions,
      r.respawns,
      r.airtime.toFixed(1),
    );
  }
}
