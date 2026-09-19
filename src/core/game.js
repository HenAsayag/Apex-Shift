import { TRACKS, medalFor, CUPS } from "../data/tracks.js";
import { VEHICLES } from "../data/vehicles.js";
import { COLORS, DEFAULT_BINDINGS } from "../config.js";
import { Track } from "./track.js";
import { createRacer, stepPhysics, respawn } from "./physics.js";
import { Input } from "./input.js";
import { SaveData, ACHIEVEMENTS } from "./storage.js";
import { AudioSystem } from "./audio.js";
import { GhostRecorder, sampleGhost } from "./ghost.js";
import { GhostOnline, runId } from "./ghost-online.js";
import { aiInput } from "./ai.js";
import { World } from "../render/world.js";
import { UI } from "../ui/ui.js";
import { PlayDisplay } from "./play-display.js";

export class Game {
  constructor() {
    this.save = new SaveData();
    this.input = new Input(this.save.data.bindings);
    this.audio = new AudioSystem(this.save.data.settings);
    this.vehicle =
      VEHICLES.find(
        (v) =>
          v.id === this.save.data.selectedVehicle &&
          v.unlock <= this.save.medals,
      ) || VEHICLES[0];
    this.selectedTrack = TRACKS[0];
    this.mode = "quick";
    this.state = "menu";
    this.options = {
      laps: 1,
      players: 1,
      ai: 0,
      difficulty: this.save.data.settings.difficulty,
      weather: "clear",
      time: "track",
      names: ["You", "Player 2", "Player 3", "Player 4"],
    };
    this.world = new World(
      document.querySelector("#world"),
      this.save.data.settings,
    );
    this.track = new Track(this.selectedTrack);
    this.world.build(this.track, this.vehicle, "clear", "track");
    this.ui = new UI(this);
    this.display = new PlayDisplay(this);
    this.online = new GhostOnline((...args) => {
      this.ui.toast(...args);
      this.ui.updateSharing();
    }, this.save.storage);
    this.onlineGhosts = false;
    this.ui.render();
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.hudAccumulator = 0;
    this.raceTime = 0;
    this.racers = [];
    this.ranking = [];
    this.raceGeneration = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    window.addEventListener("blur", () => this.pause());
    document.addEventListener("pointerdown", () => this.audio.start(), {
      once: true,
    });
    if (!this.save.available)
      this.ui.toast(
        "Local storage unavailable",
        "Racing works, but this browser may not preserve your records.",
      );
    requestAnimationFrame((t) => this.frame(t));
  }
  selectTrack(id) {
    const selected = TRACKS.find((tr) => tr.id === id);
    if (!selected) return;
    this.selectedTrack = selected;
    this.track = new Track(selected);
    this.world.build(this.track, this.vehicle, "clear", "track");
  }
  setMode(mode, silent = false) {
    this.onlineGhosts = false;
    this.challenge = null;
    this.mode = mode;
    this.options.players = mode === "local" ? 2 : 1;
    this.options.ai = mode === "ai" ? 5 : mode === "custom" ? 3 : 0;
    this.options.laps = 1;
    this.options.weather = "clear";
    this.options.time = "track";
    if (!silent)
      this.ui.nav(
        mode === "career"
          ? "career"
          : mode === "local" || mode === "custom" || mode === "ai"
            ? "setup"
            : "tracks",
      );
  }
  async startRace() {
    if (!this.display.require(() => this.startRace())) return;
    if (this.mode !== "time-trial") this.onlineGhosts = false;
    if (
      this.mode === "career" &&
      this.save.medals < CUPS[this.selectedTrack.cup].requirement
    )
      return;
    if (this.state === "loading") return;
    const generation = ++this.raceGeneration;
    this.state = "loading";
    this.input.clear();
    this.audio.start();
    this.ui.loading();
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (generation !== this.raceGeneration) return;
    if (!document.fullscreenElement) {
      this.state = "menu";
      this.display.require(() => this.startRace());
      return;
    }
    if (
      this.mode === "quick" ||
      this.mode === "time-trial" ||
      this.mode === "career"
    ) {
      this.options.players = 1;
      this.options.ai = 0;
      this.options.laps = 1;
      this.options.weather = "clear";
      this.options.time = "track";
    }
    this.track = new Track(this.selectedTrack);
    this.world.build(
      this.track,
      this.vehicle,
      this.options.weather,
      this.options.time,
    );
    this.racers = [];
    for (let i = 0; i < this.options.players; i++)
      this.racers.push(
        createRacer({
          name: this.options.names[i],
          vehicle: this.vehicle,
          color: COLORS[i],
          index: i,
          lane: (i - (this.options.players - 1) / 2) * 3,
        }),
      );
    for (let i = 0; i < this.options.ai; i++)
      this.racers.push(
        createRacer({
          name: ["Nova", "Rook", "Juno", "Cipher", "Blitz"][i],
          vehicle: VEHICLES[i % VEHICLES.length],
          color: ["#73d8f0", "#d6e785", "#c6a7f0", "#f2b457", "#e783b4"][i],
          human: false,
          index: i + this.options.players,
          lane: ((i % 3) - 1) * 4,
        }),
      );
    this.racers.forEach((r, i) => {
      if (!r.human) r.s = -6 - Math.floor(i / 3) * 6;
    });
    this.recordKey = this.save.recordKey(
      this.selectedTrack.id,
      this.options.laps,
      this.options.weather,
      this.options.time,
    );
    this.save.attempt(this.recordKey);
    this.ghostSamples = this.save.data.records[this.recordKey]?.ghost;
    this.ghostName = "Personal best";
    this.ghostTime = this.save.data.records[this.recordKey]?.best;
    const challenge =
      this.onlineGhosts && this.challenge?.track === this.selectedTrack.id
        ? this.challenge
        : null;
    if (challenge) {
      this.ghostSamples = challenge.samples;
      this.ghostName = challenge.name;
      this.ghostTime = challenge.time;
    }
    const ghostCar =
      VEHICLES.find(
        (v) =>
          v.id ===
          (challenge?.vehicle ||
            this.save.data.records[this.recordKey]?.vehicle),
      ) || this.vehicle;
    this.world.setRacers(
      this.racers,
      this.shadowEnabled && this.ghostSamples ? ghostCar : null,
    );
    this.recorders = Array.from(
      { length: this.options.players },
      () => new GhostRecorder(),
    );
    this.recorder = this.recorders[0];
    this.racers
      .filter((r) => r.human)
      .forEach((r) => this.recorders[r.index].capture(0, r));
    this.sharedRun = null;
    this.recordedPlayers = new Set();
    this.raceTime = 0;
    this.countdown = 3;
    this.previousBeep = 4;
    this.state = "countdown";
    this.accumulator = 0;
    this.newBest = false;
    this.recordSaved = false;
    this.finishWait = 0;
    this.ranking = [...this.racers];
    this.ui.race();
    this.audio.play("countdown");
  }
  get shadowEnabled() {
    return this.mode === "quick" || this.mode === "time-trial";
  }
  event(name, r) {
    if (r.human) {
      this.audio.play(name === "finish" && !r.medal ? "defeat" : name);
      if (
        ["collision", "land"].includes(name) &&
        this.save.data.settings.vibration
      )
        this.input.vibrate(r.index);
      if (name === "respawn")
        this.ui.toast("Back on track", "Checkpoint respawn · +3 seconds");
    }
  }
  updateRace(dt) {
    if (this.state === "countdown") {
      this.countdown -= dt;
      if (Math.ceil(this.countdown) !== this.previousBeep) {
        this.previousBeep = Math.ceil(this.countdown);
        this.audio.play(this.countdown > 0 ? "countdown" : "go");
      }
      if (this.countdown <= 0) {
        this.state = "racing";
        this.input.pressed.clear();
      }
      return;
    }
    if (this.state !== "racing") return;
    this.raceTime += dt;
    for (const r of this.racers) {
      if (r.finished) continue;
      const input = r.human
        ? this.input.read(r.index)
        : aiInput(
            r,
            this.track,
            this.raceTime,
            this.options.difficulty,
            this.racers[0],
            this.save.data.settings,
          );
      stepPhysics(
        r,
        input,
        this.track,
        dt,
        { ...this.save.data.settings, weather: this.options.weather },
        (name, racer) => this.event(name, racer),
      );
      const next =
        (r.lap - 1 + [0.25, 0.5, 0.75, 1][r.checkpoint]) * this.track.length;
      if (r.s >= next) {
        if (Math.abs(r.lateral) > this.track.width / 2 || r.height > 12) {
          respawn(r);
          r.penalty += 2;
          if (r.human)
            this.ui.toast(
              "Checkpoint missed",
              "Returned to your last checkpoint · +5 seconds",
            );
          continue;
        }
        if (r.checkpoint < 3) {
          r.checkpoint++;
          r.checkpointS = next;
          this.event("checkpoint", r);
        } else {
          r.bestLap = Math.min(r.bestLap, this.raceTime - r.lapStart);
          r.lapStart = this.raceTime;
          if (r.lap >= this.options.laps) {
            r.finished = true;
            r.finishTime = this.raceTime + r.penalty;
            r.medal = medalFor(
              r.finishTime,
              this.selectedTrack,
              this.options.laps,
            );
            this.event("finish", r);
            if (r.human) this.recordFinish(r);
          } else {
            r.lap++;
            r.checkpoint = 0;
            r.checkpointS = (r.lap - 1) * this.track.length;
            this.event("checkpoint", r);
          }
        }
      }
    }
    for (let i = 0; i < this.racers.length; i++)
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i],
          b = this.racers[j];
        if (
          a.finished ||
          b.finished ||
          Math.abs(a.s - b.s) > 4.4 ||
          Math.abs(a.height - b.height) > 1.5
        )
          continue;
        const lateral = a.lateral - b.lateral;
        if (Math.abs(lateral) < 2.4) {
          const shift = (2.4 - Math.abs(lateral)) * 0.5,
            sign = lateral >= 0 ? 1 : -1;
          a.lateral += shift * sign;
          b.lateral -= shift * sign;
          const rear = a.s < b.s ? a : b;
          rear.speed = Math.min(a.speed, b.speed) * 0.96;
        }
      }
    this.ranking = [...this.racers].sort((a, b) =>
      a.finished && b.finished
        ? a.finishTime - b.finishTime
        : a.finished
          ? -1
          : b.finished
            ? 1
            : b.s - a.s,
    );
    for (const r of this.racers)
      if (r.human && !r.finished)
        this.recorders[r.index].capture(this.raceTime, r);
    if (this.racers.filter((r) => r.human).every((r) => r.finished)) {
      this.finishWait += dt;
      if (
        (this.racers.every((r) => r.finished) && this.finishWait > 2) ||
        this.finishWait > 20
      ) {
        this.state = "results";
        this.audio.play("finish");
        this.ui.results();
      }
    }
  }
  recordFinish(r) {
    if (this.recordedPlayers.has(r.index)) return;
    this.recordedPlayers.add(r.index);
    const recorder = this.recorders[r.index];
    recorder.capture(this.raceTime, r, true);
    if (this.onlineGhosts) {
      const run = {
        version: 1,
        id: runId(),
        track: this.selectedTrack.id,
        vehicle: r.vehicle.id,
        name: r.name.slice(0, 32),
        time: r.finishTime,
        samples: recorder.samples,
      };
      this.sharedRun = run;
      void this.online.enqueue(run);
    }
    const medalsBefore = this.save.medals;
    const best = this.save.finish(
      this.recordKey,
      {
        time: r.finishTime,
        medal: r.medal,
        vehicle: r.vehicle.id,
        date: new Date().toISOString(),
        name: r.name,
      },
      recorder.samples,
    );
    if (r.index === 0) this.newBest = best;
    const conditions = {
      first: true,
      gold: ["Gold", "Platinum"].includes(r.medal),
      air: r.airtime >= 3,
      drift: r.driftTime >= 5,
      boost: r.boostTime >= 10,
      clean: r.collisions === 0 && r.respawns === 0,
      tour: this.save.medals >= 10,
    };
    for (const [id, yes] of Object.entries(conditions))
      if (yes && this.save.unlock(id)) {
        const a = ACHIEVEMENTS.find((a) => a.id === id);
        this.ui.toast("Achievement unlocked", a.name, a.icon);
      }
    for (const v of VEHICLES)
      if (v.unlock > medalsBefore && v.unlock <= this.save.medals)
        this.ui.toast("New machine unlocked", v.name, "▰");
    for (const c of CUPS)
      if (c.requirement > medalsBefore && c.requirement <= this.save.medals)
        this.ui.toast("New cup unlocked", c.name, "◈");
    if (!this.save.available)
      this.ui.toast(
        "Record could not be saved",
        "Browser storage is full or unavailable.",
      );
  }
  pause() {
    if (["racing", "countdown"].includes(this.state)) {
      this.beforePause = this.state;
      this.state = "paused";
      this.input.clear();
      this.ui.pause();
    }
  }
  resume() {
    if (!this.display.require(() => this.resume())) return;
    if (this.state === "paused") {
      this.state = this.beforePause;
      this.input.clear();
      document.querySelector("#pause-menu")?.remove();
    }
  }
  quit() {
    this.display.close();
    this.input.clear();
    this.raceGeneration++;
    this.state = "menu";
    this.racers = [];
    this.selectTrack(this.selectedTrack.id);
    this.ui.nav("home");
  }
  resetControls() {
    this.input.bindings = structuredClone(DEFAULT_BINDINGS);
    this.save.data.bindings = this.input.bindings;
    this.save.persist();
    this.ui.render();
    this.ui.toast("Default controls restored");
  }
  frame(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    if (this.input.consume("Escape")) {
      if (this.state === "paused") this.resume();
      else this.pause();
    }
    if (
      ["racing", "countdown", "paused", "results"].includes(this.state) &&
      this.input.consume("Backspace")
    )
      this.startRace();
    if (this.state === "racing" && this.input.consume("KeyR")) {
      this.racers
        .filter((r) => r.human && !r.finished)
        .forEach((r) => respawn(r));
      this.world.cameraReady = false;
      this.audio.play("respawn");
    }
    if (this.input.consume("KeyC")) {
      const modes = ["chase", "close", "far", "hood"],
        s = this.save.data.settings;
      s.camera = modes[(modes.indexOf(s.camera) + 1) % modes.length];
      this.world.cameraReady = false;
      this.save.persist();
      if (this.state === "racing") this.ui.toast("Camera", s.camera + " view");
    }
    if (["racing", "countdown"].includes(this.state)) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.updateRace(1 / 120);
        this.accumulator -= 1 / 120;
      }
    }
    if (this.state === "menu")
      this.world.renderMenu(dt, this.ui.route === "garage");
    else if (
      ["racing", "countdown", "paused", "results"].includes(this.state)
    ) {
      this.world.renderRace(
        this.racers,
        this.options.players,
        this.state === "paused" ? 0 : dt,
        this.state === "results",
      );
      this.world.updateGhost(
        this.shadowEnabled
          ? sampleGhost(this.ghostSamples, this.raceTime)
          : null,
      );
      this.hudAccumulator += dt;
      if (
        this.hudAccumulator > 0.04 &&
        ["racing", "countdown"].includes(this.state)
      ) {
        this.ui.updateHUD();
        this.hudAccumulator = 0;
      }
    }
    this.audio.update(this.racers[0], dt, this.state === "racing");
    requestAnimationFrame((t) => this.frame(t));
  }
}
