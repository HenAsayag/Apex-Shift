import { TRACKS, CUPS } from "../data/tracks.js";
import { VEHICLES } from "../data/vehicles.js";
import { COLORS, formatTime, keyLabel, t } from "../config.js";
import { ACHIEVEMENTS } from "../core/storage.js";
import { ghostDelta } from "../core/ghost.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const arrow = '<span aria-hidden="true">↗</span>';
const icons = {
  home: "⌁",
  career: "◈",
  garage: "▰",
  leaderboards: "▥",
  settings: "⚙",
  achievements: "◇",
  controls: "⌨",
  credits: "ⓘ",
};
export function trackMap(track, cls = "") {
  const xs = track.points.map((p) => p[0]),
    zs = track.points.map((p) => p[2]),
    minX = Math.min(...xs),
    minZ = Math.min(...zs),
    w = Math.max(...xs) - minX,
    h = Math.max(...zs) - minZ;
  const pts = track.points.map((p) => [
    28 + ((p[0] - minX) / w) * 180,
    18 + ((p[2] - minZ) / h) * 102,
  ]);
  const d =
    pts
      .map((p, i) => {
        const n = pts[(i + 1) % pts.length];
        return `${i === 0 ? `M ${(p[0] + pts.at(-1)[0]) / 2} ${(p[1] + pts.at(-1)[1]) / 2}` : ""} Q ${p[0]} ${p[1]} ${(p[0] + n[0]) / 2} ${(p[1] + n[1]) / 2}`;
      })
      .join(" ") + " Z";
  return `<svg class="track-map ${cls}" viewBox="0 0 236 140" fill="none" aria-label="${esc(track.name)} circuit layout"><path d="${d}" stroke="currentColor" stroke-opacity=".1" stroke-width="14"/><path d="${d}" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="${(pts[0][0] + pts.at(-1)[0]) / 2}" cy="${(pts[0][1] + pts.at(-1)[1]) / 2}" r="5" fill="var(--orange)" stroke="#111" stroke-width="2"/></svg>`;
}
function scenerySvg(track) {
  const c = track.color;
  return `<svg class="card-landscape" viewBox="0 0 360 160" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g-${track.id}" x2="0" y2="1"><stop stop-color="${track.sky}"/><stop offset="1" stop-color="${track.ground}"/></linearGradient></defs><path fill="url(#g-${track.id})" d="M0 0h360v160H0z"/><circle cx="275" cy="37" r="18" fill="#fff5d9" opacity=".6"/><path d="M0 80 38 43 73 73 117 23 179 83 230 49 293 97 330 64 360 77v83H0z" fill="${track.rock}"/><path d="M0 122 53 81 100 131 168 80 207 110 248 94 310 126 360 90v70H0z" fill="${track.ground}"/><path d="M360 161H12C135 122 50 113 176 94s86-42 141-44" stroke="${c}" stroke-width="25" fill="none"/><path d="M360 161H12C135 122 50 113 176 94s86-42 141-44" stroke="#343e40" stroke-width="20" fill="none"/><path d="M360 161H12C135 122 50 113 176 94s86-42 141-44" stroke="#e0dccb" stroke-width="1" stroke-dasharray="8 6" fill="none"/></svg>`;
}
export class UI {
  constructor(game) {
    this.g = game;
    this.app = document.querySelector("#app");
    this.route = "home";
    this.remap = null;
    this.app.addEventListener("click", (e) => this.click(e));
    this.app.addEventListener("change", (e) => this.change(e));
    this.app.addEventListener("input", (e) => {
      if (e.target.matches("[data-setting]") && e.target.type === "range")
        this.change(e);
    });
  }
  toast(title, message = "", icon = "↗") {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<span class="toast-icon">${icon}</span><div><strong>${esc(title)}</strong><small>${esc(message)}</small></div>`;
    document.querySelector("#toasts").append(el);
    setTimeout(() => el.remove(), 5200);
  }
  nav(route) {
    this.ghostRequest = (this.ghostRequest || 0) + 1;
    this.g.input.clear();
    this.route = route;
    this.render();
    if (route === "ghosts") void this.loadGhosts();
  }
  ghosts() {
    const g = this.g,
      best = g.save.data.records[g.selectedTrack.id];
    return `${this.title("GHOST MODE", "CHASE YOUR NEXT BEST.", "Race your personal best or challenge a saved run from another driver.")}
      <div class="ghost-layout"><section class="panel ghost-settings">
      <label>Circuit<select data-ghost-track>${TRACKS.map((tr) => `<option value="${tr.id}" ${tr.id === g.selectedTrack.id ? "selected" : ""}>${tr.name}</option>`).join("")}</select></label>
      ${trackMap(g.selectedTrack)}<h2>Your personal best</h2><p class="mono">${formatTime(best?.best)}</p>
      <button class="button glass full" data-ghost="${g.selectedTrack.id}">${best?.ghost ? "RACE PERSONAL GHOST" : "SET YOUR FIRST TIME"} ↗</button>
      <p class="muted">Personal runs stay in this browser. The translucent ghost never collides with your car.</p>
      <hr><h2>Online ghosts</h2><label>Your public driver name<input data-ghost-name maxlength="32" value="${esc(g.save.data.ghostName || g.options.names[0])}"></label>
      <p>${g.online.enabled ? "Every completed online run is saved and shared with players on this game server. One lap · clear weather · circuit default time." : "This edition supports personal shadows and local play. Shared online ghosts require a game server."}</p>
      <button class="button primary full" data-action="online-run" ${g.online.enabled ? "" : "disabled"}>START ONLINE RUN ↗</button>
      <p class="muted">Community times are unverified. Display names are not unique accounts.</p>
      <button class="text-button" data-action="retry-ghosts" ${g.online.enabled ? "" : "disabled"}>RETRY PENDING UPLOADS (${g.online.pending.length})</button>
      </section><section class="panel"><h2>Challenge a ghost</h2>
      <div class="ghost-search"><label>Find a friend or run<input data-ghost-query maxlength="100" placeholder="Driver name or exact run ID" value="${esc(this.ghostQuery || "")}"></label><button class="button glass" data-action="search-ghosts">SEARCH / REFRESH</button></div>
      <p class="muted">Fastest matching runs first. Friends can share the run ID shown after finishing.</p>
      <div id="online-ghost-list" aria-live="polite">Loading shared ghosts…</div></section></div>`;
  }
  async loadGhosts() {
    const request = (this.ghostRequest = (this.ghostRequest || 0) + 1);
    const host = this.app.querySelector("#online-ghost-list");
    if (!host) return;
    if (!this.g.online.enabled) {
      host.textContent =
        "Online ghosts require a game server. Race your personal shadow using the button on the left.";
      return;
    }
    host.textContent = "Loading shared ghosts…";
    try {
      const { runs, total } = await this.g.online.list(
        this.g.selectedTrack.id,
        this.ghostQuery || "",
      );
      if (request !== this.ghostRequest || this.route !== "ghosts") return;
      host.innerHTML = runs.length
        ? `<p>${runs.length} of ${total} matching runs</p><div class="table-scroll"><table><thead><tr><th>DRIVER</th><th>TIME</th><th>VEHICLE</th><th></th></tr></thead><tbody>${runs.map((r) => `<tr><td>${esc(r.name)}</td><td class="mono">${formatTime(r.time)}</td><td>${esc(VEHICLES.find((v) => v.id === r.vehicle)?.name || r.vehicle)}</td><td><button class="text-button" data-online-ghost="${esc(r.id)}">RACE GHOST ↗</button></td></tr>`).join("")}</tbody></table></div>`
        : "<p>No matching ghosts yet. Complete an online run to put one on the board.</p>";
    } catch {
      if (request === this.ghostRequest && this.route === "ghosts")
        host.textContent =
          "Online ghosts are unavailable. Try Search / Refresh again, or race your personal ghost.";
    }
  }
  async onlineRace(id) {
    if (!this.g.online.enabled) return;
    const request = (this.ghostRequest = (this.ghostRequest || 0) + 1);
    const track = this.g.selectedTrack.id;
    try {
      const run = id ? await this.g.online.get(id) : null;
      if (
        request !== this.ghostRequest ||
        this.route !== "ghosts" ||
        this.g.state !== "menu"
      )
        return;
      if (
        run &&
        (run.version !== 1 ||
          run.track !== track ||
          !Array.isArray(run.samples))
      )
        throw new Error("Incompatible ghost.");
      this.g.setMode("time-trial", true);
      this.g.onlineGhosts = true;
      this.g.challenge = run;
      this.g.options.names[0] = this.g.save.data.ghostName || "You";
      await this.g.startRace();
    } catch {
      this.toast("Could not load ghost", "Refresh the board and try again.");
    }
  }
  header() {
    const medals = this.g.save.medals;
    return `<header class="topbar"><button class="brand" data-nav="home" aria-label="APEX SHIFT home">APEX<span>//</span>SHIFT<small>PRECISION MEETS ADRENALINE</small></button><nav aria-label="Main navigation">${[
      ["home", "Race"],
      ["career", t("career")],
      ["garage", t("garage")],
      ["leaderboards", t("records")],
      ["ghosts", "Ghost Mode"],
    ]
      .map(
        ([r, n]) =>
          `<button class="nav-link ${this.route === r ? "active" : ""}" data-nav="${r}">${n}</button>`,
      )
      .join(
        "",
      )}</nav><div class="header-right"><div class="driver-avatar">R</div><div class="driver-info"><b>ROOKIE DRIVER</b><small><i></i> ${medals} / 10 medals collected</small></div><button class="icon-button" data-nav="achievements" title="Achievements" aria-label="Achievements">◇</button><button class="icon-button" data-nav="settings" title="Settings" aria-label="Settings">⚙</button></div></header>`;
  }
  footer() {
    return `<footer class="footer"><span><i class="status-dot"></i> ALL SYSTEMS GO <em>•</em> LOCAL PLAY</span><div><button data-nav="controls">⌨ &nbsp; Controls</button><button data-nav="credits">Credits</button><span class="version">BUILD 1.0</span></div></footer>`;
  }
  render() {
    this.app.className = "menu-app";
    const route = this.route;
    this.app.innerHTML = `${this.header()}<main class="page ${route === "home" ? "home-page" : route === "garage" ? "garage-page" : "inner-page"}">${this[route]?.() || this.home()}</main>${this.footer()}`;
    this.g.world.hero.visible = true;
  }
  title(kicker, title, sub = "", extra = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${extra}</div>`;
  }
  home() {
    const track = this.g.selectedTrack;
    return `<div class="hero-copy"><div class="eyebrow"><span class="tiny-line"></span> EVERY MILLISECOND MATTERS</div><h1>FIND<br>YOUR <span>LIMIT.</span></h1><p>Ten worlds. One perfect run.<br>Push harder. Brake later. Make it count.</p><div class="hero-actions"><button class="button primary" data-action="race">LET’S RACE ${arrow}</button><button class="button glass" data-nav="play">EXPLORE MODES <span>→</span></button></div><div class="hero-meta"><span><b>10</b> UNIQUE CIRCUITS</span><span><b>05</b> ORIGINAL MACHINES</span><span><b>04</b> LOCAL PLAYERS</span></div></div><div class="scene-caption"><span class="live-dot"></span> ${esc(this.g.vehicle.name.toUpperCase())}<span class="caption-rule"></span><span>PURE ARCADE. PURE ADRENALINE.</span></div><aside class="featured-event"><div class="event-top"><span class="eyebrow">ON THE GRID</span><span class="live-tag">TIME ATTACK</span></div>${trackMap(track)}<div class="event-title"><small>${track.region}</small><h2>${track.name}</h2></div><div class="event-stats"><div><span>YOUR BEST</span><b>${formatTime(this.g.save.data.records[track.id]?.best)}</b></div><div><span>GOLD TARGET</span><b class="gold">${formatTime(track.medals[1])}</b></div></div><button class="text-button" data-action="time-trial">BEAT THE CLOCK <span>↗</span></button></aside><section class="discover-section"><div class="section-title"><h2>THE WORLD IS YOUR RACETRACK<span> PICK YOUR NEXT CHALLENGE</span></h2><button data-nav="tracks">VIEW ALL CIRCUITS <span>↗</span></button></div><div class="featured-tracks">${TRACKS.slice(
      0,
      3,
    )
      .map((tr, i) => this.trackCard(tr, i, true))
      .join("")}</div></section>`;
  }
  trackCard(tr, i, compact = false, career = false) {
    const locked = career && this.g.save.medals < CUPS[tr.cup].requirement;
    const best = this.g.save.data.records[tr.id];
    return `<button class="track-card ${compact ? "compact" : ""} ${tr.id === this.g.selectedTrack.id ? "selected" : ""} ${locked ? "locked" : ""}" data-track="${tr.id}" ${locked ? "disabled" : ""} style="--track-color:${tr.color}"><div class="track-art">${scenerySvg(tr)}<span class="track-number">${String(TRACKS.indexOf(tr) + 1).padStart(2, "0")} /</span><span class="track-type">${locked ? "LOCKED" : tr.environment.toUpperCase()}</span>${compact ? "" : trackMap(tr)}</div><div class="track-card-info"><div><h3>${tr.name}</h3><span>${tr.difficulty === 1 ? "ROOKIE" : tr.difficulty === 2 ? "INTERMEDIATE" : "EXPERT"} <i>•</i> ${best?.medal || tr.features[0]}</span></div><span class="card-arrow">${locked ? "⊘" : "↗"}</span></div></button>`;
  }
  play() {
    return `${this.title("CHOOSE YOUR CHALLENGE", "CHASE SOMETHING GREAT.", "Your next personal best starts here.")}<div class="mode-grid">${[
      [
        "quick",
        "01",
        "Quick Race",
        "Race for a medal with Shadow Mode always on. Chase your best run.",
        "↗",
      ],
      [
        "career",
        "02",
        "Career",
        "Three cups. Ten circuits. Build your racing legacy.",
        "◈",
      ],
      [
        "time-trial",
        "03",
        "Time Trial",
        "You, the clock, and the ghost of your best lap.",
        "◷",
      ],
      [
        "ai",
        "04",
        "AI Race",
        "Four difficulty levels. Five rivals. One finish line.",
        "⚑",
      ],
      [
        "local",
        "05",
        "Local Multiplayer",
        "Bring your friends. Up to four players in split-screen.",
        "▦",
      ],
      [
        "custom",
        "06",
        "Custom Race",
        "Your track, your weather, your rules.",
        "⊞",
      ],
    ]
      .map(
        ([mode, n, title, desc, icon]) =>
          `<button class="mode-card" data-mode="${mode}"><div><span class="eyebrow">MODE ${n}</span><b>${icon}</b></div><h2>${title}</h2><p>${desc}</p><span class="mode-arrow">↗</span></button>`,
      )
      .join("")}</div>`;
  }
  tracks() {
    return `${this.title("THE CIRCUIT COLLECTION", "TEN WORLDS. NO LIMITS.", "Every circuit is available in free play. Earn medals to advance through Career.", `<button class="button primary" data-action="race">RACE ${arrow}</button>`)}<div class="track-toolbar"><span class="eyebrow">${this.g.mode.toUpperCase().replace("-", " ")} / SELECT A CIRCUIT</span><span>SELECTED <b>${this.g.selectedTrack.name}</b></span><button class="text-button" data-nav="setup">RACE OPTIONS →</button></div><div class="track-grid">${TRACKS.map((tr, i) => this.trackCard(tr, i)).join("")}</div>`;
  }
  career() {
    return `${this.title("YOUR ROAD TO THE TOP", "MAKE A NAME FOR YOURSELF.", `${this.g.save.medals} of 10 circuit medals earned. Bronze or better unlocks the next cup.`)}<div class="career-cups">${CUPS.map(
      (cup, i) =>
        `<section class="cup"><div class="cup-heading"><span class="cup-index">0${i + 1}</span><div><div class="eyebrow">${cup.subtitle}</div><h2>${cup.name}</h2></div><span class="pill">${this.g.save.medals >= cup.requirement ? "UNLOCKED" : `${cup.requirement} MEDALS TO UNLOCK`}</span></div><div class="cup-tracks">${TRACKS.filter(
          (tr) => tr.cup === i,
        )
          .map((tr, j) => this.trackCard(tr, j, true, true))
          .join("")}</div></section>`,
    ).join("")}</div>`;
  }
  setup() {
    const c = this.g.options;
    return `${this.title("RACE CONTROL", this.g.mode === "local" ? "BETTER WITH RIVALS." : "SET YOUR OWN PACE.", "Fine-tune the race. Then leave everything on the track.")}<div class="setup-layout"><section class="panel setup-fields"><h2>Race configuration</h2><label>Circuit<select data-option="track">${TRACKS.map((tr) => `<option value="${tr.id}" ${tr.id === this.g.selectedTrack.id ? "selected" : ""}>${tr.name}</option>`).join("")}</select></label><label>Race mode<select data-option="mode">${["quick", "time-trial", "ai", "local", "custom"].map((mode) => `<option value="${mode}" ${this.g.mode === mode ? "selected" : ""}>${mode.replace("-", " ").toUpperCase()}</option>`).join("")}</select></label><label>Laps<select data-option="laps">${[1, 2, 3, 5].map((n) => `<option ${c.laps === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Local players<select data-option="players">${[1, 2, 3, 4].map((n) => `<option ${c.players === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>AI opponents<select data-option="ai">${[0, 1, 2, 3, 5].map((n) => `<option ${c.ai === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>AI difficulty<select data-option="difficulty">${["easy", "normal", "hard", "expert"].map((d) => `<option ${d === c.difficulty ? "selected" : ""}>${d}</option>`).join("")}</select></label><label>Weather<select data-option="weather">${["clear", "rain", "snow"].map((v) => `<option ${c.weather === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Time of day<select data-option="time">${["track", "day", "night"].map((v) => `<option value="${v}" ${c.time === v ? "selected" : ""}>${v === "track" ? "Circuit default" : v}</option>`).join("")}</select></label></section><section class="panel drivers-panel"><div class="eyebrow">YOUR STARTING GRID</div><h2>${this.g.selectedTrack.name}</h2>${trackMap(this.g.selectedTrack)}${Array.from({ length: c.players }, (_, i) => `<div class="player-setup" style="--player:${COLORS[i]}"><b>P${i + 1}</b><div><input aria-label="Player ${i + 1} name" data-player="${i}" value="${esc(c.names[i])}" maxlength="16"><small>${Object.values(this.g.input.bindings[i]).map(keyLabel).join(" · ")}</small></div></div>`).join("")}<p class="muted">${c.ai} AI ${c.ai === 1 ? "rival" : "rivals"} · ${c.laps} ${c.laps === 1 ? "lap" : "laps"} · ${this.g.vehicle.name}</p><button class="button primary full" data-action="race">TAKE THE GRID ${arrow}</button><button class="text-button" data-nav="controls">CONFIGURE CONTROLS →</button></section></div>`;
  }
  garage() {
    const car = this.g.previewVehicle || this.g.vehicle,
      unlocked = this.g.save.medals >= car.unlock;
    return `${this.title("THE GARAGE", "BUILT TO BE DRIVEN.", "Five machines. Five different ways to find the limit.")}<section class="vehicle-detail"><div class="eyebrow">${car.type}</div><h2>${car.name}</h2><p>${car.description}</p><div class="vehicle-stats">${["Top speed", "Acceleration", "Handling", "Drift", "Boost", "Air control"].map((label, i) => `<div><span>${label}</span><div><i style="width:${car.stats[i]}%"></i></div><b>${car.stats[i]}</b></div>`).join("")}</div><button class="button ${unlocked ? "primary" : "glass"} full" data-select-vehicle="${car.id}" ${unlocked ? "" : "disabled"}>${unlocked ? (this.g.vehicle.id === car.id ? "SELECTED" : "SELECT VEHICLE") : `EARN ${car.unlock} CIRCUIT MEDALS`} ${arrow}</button></section><div class="garage-note">360° VEHICLE SHOWCASE <span>•</span> ${(car.speed * 3.6) | 0} KM/H TOP SPEED</div><div class="vehicle-picker">${VEHICLES.map((v, i) => `<button class="vehicle-pick ${car.id === v.id ? "active" : ""}" data-preview="${v.id}" style="--car-color:${v.color}"><span class="eyebrow">0${i + 1} / ${this.g.save.medals >= v.unlock ? "AVAILABLE" : v.unlock + " MEDALS"}</span><div class="car-silhouette"><i></i><i></i></div><strong>${v.name}</strong><small>${v.type}</small></button>`).join("")}</div>`;
  }
  settings() {
    const s = this.g.save.data.settings;
    const select = (key, label, values) =>
      `<label>${label}<select data-setting="${key}">${values.map((v) => `<option value="${v}" ${String(s[key]) === String(v) ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
    const toggle = (key, label) =>
      `<label class="toggle-row">${label}<input type="checkbox" data-setting="${key}" ${s[key] ? "checked" : ""}><span class="switch"></span></label>`;
    const range = (key, label, min = 0, max = 1, step = 0.05) =>
      `<label>${label}<div class="range-wrap"><input type="range" min="${min}" max="${max}" step="${step}" data-setting="${key}" value="${s[key]}"><output>${Math.round(s[key] * 100)}%</output></div></label>`;
    return `${this.title("MAKE IT YOURS", "DIALED IN.", "Settings save automatically on this device.")}<div class="settings-grid"><section class="panel"><h2>Display & effects</h2>${select("graphics", "Graphics quality", ["low", "medium", "high"])}${select("resolution", "Resolution scale", [0.5, 0.75, 1, 1.25])}${toggle("shadows", "Vehicle & scenery shadows")}${toggle("effects", "Particles & weather effects")}${toggle("motion", "Speed effects & dynamic FOV")}${toggle("shake", "Camera shake")}</section><section class="panel"><h2>Sound studio</h2>${range("engine", "Engine volume")}${range("sfx", "Effects volume")}${range("music", "Music volume")}<button class="text-button" data-action="test-sound">TEST AUDIO ♪</button><p class="muted">Original synthesized engine, effects, and electronic score. Audio starts after your first interaction.</p></section><section class="panel"><h2>Driving & camera</h2>${select("camera", "Camera", ["chase", "close", "far", "hood"])}${range("sensitivity", "Steering sensitivity", 0.5, 1.5, 0.05)}${toggle("assist", "Steering assist")}${select("difficulty", "Default AI difficulty", ["easy", "normal", "hard", "expert"])}${toggle("rubberBand", "Gentle AI catch-up")}${toggle("vibration", "Controller vibration")}<button class="text-button" data-nav="controls">REMAP CONTROLS →</button></section></div><div class="settings-bottom"><span>Stored locally · ${this.g.save.available ? "Save system connected" : "Browser storage unavailable"}</span><button class="text-button danger" data-action="reset-progress">RESET ALL PROGRESS</button></div>`;
  }
  controls() {
    return `${this.title("PRECISION AT YOUR FINGERTIPS", "TAKE CONTROL.", "Click any key to remap it. Gamepads work automatically: right trigger to accelerate, left stick to steer.")}<div class="controls-grid">${this.g.input.bindings
      .map(
        (b, i) =>
          `<section class="panel control-player"><h2 style="color:${COLORS[i]}">PLAYER 0${i + 1}</h2>${Object.entries(
            b,
          )
            .map(
              ([action, key]) =>
                `<div class="binding-row"><span>${action}</span><button class="keycap" data-remap="${i}:${action}">${keyLabel(key)}</button></div>`,
            )
            .join("")}</section>`,
      )
      .join(
        "",
      )}</div><section class="panel global-controls"><div><kbd>Esc</kbd> Pause / Resume</div><div><kbd>R</kbd> Respawn all humans (+3s)</div><div><kbd>Backspace</kbd> Restart race</div><div><kbd>C</kbd> Cycle camera</div><div><kbd>Gamepad B</kbd> Boost</div><div><kbd>Gamepad X</kbd> Drift</div></section><p class="muted">Air control uses the steering keys. R resets the camera with the car. Keyboard rollover varies by device; use gamepads if multiple held keys conflict.</p><button class="text-button" data-action="reset-controls">RESTORE DEFAULT BINDINGS →</button>`;
  }
  leaderboards() {
    const recordTrack = this.recordTrack || this.g.selectedTrack.id;
    const localRuns = this.g.save.data.records[recordTrack]?.runs || [];
    const entries = TRACKS.map((tr) => ({
      tr,
      r: this.g.save.data.records[tr.id],
    }));
    return `${this.title("THE LOCAL RECORD BOOK", "LEAVE YOUR MARK.", "Best single-lap runs under circuit-default conditions. Custom races keep separate records.")}<section class="panel records-panel"><div class="table-scroll"><table><thead><tr><th>CIRCUIT</th><th>BEST TIME</th><th>MEDAL</th><th>VEHICLE</th><th>ATTEMPTS</th><th>DATE</th><th></th></tr></thead><tbody>${entries
      .sort((a, b) => (a.r?.best || Infinity) - (b.r?.best || Infinity))
      .map(
        ({ tr, r }) =>
          `<tr><td><span class="record-dot" style="background:${tr.color}"></span>${tr.name}</td><td class="mono">${formatTime(r?.best)}</td><td><span class="medal ${r?.medal?.toLowerCase() || ""}">${r?.medal || "—"}</span></td><td>${VEHICLES.find((v) => v.id === r?.vehicle)?.name || "—"}</td><td>${r?.attempts || 0}</td><td>${r?.date ? new Date(r.date).toLocaleDateString() : "—"}</td><td><button class="text-button" data-ghost="${tr.id}">${r?.ghost ? "RACE GHOST" : "SET A TIME"} ↗</button></td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div></section><section class="panel lap-records"><div class="lap-records-heading"><h2>Top runs</h2><select aria-label="Leaderboard circuit" data-record-track>${TRACKS.map((tr) => `<option value="${tr.id}" ${tr.id === recordTrack ? "selected" : ""}>${tr.name}</option>`).join("")}</select></div><div class="table-scroll"><table><thead><tr><th>RANK</th><th>DRIVER</th><th>TIME</th><th>MEDAL</th><th>VEHICLE</th><th>DATE</th></tr></thead><tbody>${localRuns.length ? localRuns.map((r, i) => `<tr><td>${String(i + 1).padStart(2, "0")}</td><td>${esc(r.name || "You")}</td><td class="mono">${formatTime(r.time)}</td><td class="medal ${r.medal?.toLowerCase() || ""}">${r.medal || "—"}</td><td>${VEHICLES.find((v) => v.id === r.vehicle)?.name || "—"}</td><td>${new Date(r.date).toLocaleDateString()}</td></tr>`).join("") : '<tr><td colspan="6">The first line is yours. Complete a race to set a time.</td></tr>'}</tbody></table></div></section><div class="settings-bottom"><span>Your records stay on this browser. Ghosts replay your fastest completed run.</span><button class="text-button danger" data-action="reset-records">RESET RECORDS</button></div>`;
  }
  achievements() {
    return `${this.title("THE EXTRA MILE", "MORE THAN A FINISH LINE.", `${this.g.save.data.achievements.length} of ${ACHIEVEMENTS.length} achievements unlocked.`)}<div class="achievement-grid">${ACHIEVEMENTS.map(
      (a) => {
        const earned = this.g.save.data.achievements.includes(a.id);
        return `<section class="panel achievement ${earned ? "earned" : ""}"><div class="achievement-icon">${a.icon}</div><div class="eyebrow">${earned ? "UNLOCKED" : "YOUR NEXT CHALLENGE"}</div><h2>${a.name}</h2><p>${a.description}</p><span class="achievement-status">${earned ? "✓ COMPLETE" : "○ IN PROGRESS"}</span></section>`;
      },
    ).join("")}</div>`;
  }
  credits() {
    return `${this.title("CRAFTED FOR THE CHASE", 'APEX<span class="orange">//</span>SHIFT.', "An original, independent browser arcade racer.")}<section class="panel credits-panel"><h2>Every second is a new opportunity.</h2><p>Ten procedural worlds. Five original vehicle designs. A soundtrack made from oscillators. Built for the simple pleasure of finding a faster line.</p><div class="credits-grid"><div><span class="eyebrow">ENGINE</span><h3>Three.js + WebGL</h3><p>Three.js is distributed under the MIT License.</p></div><div><span class="eyebrow">DESIGN & ASSETS</span><h3>Original, by construction</h3><p>Code-generated cars, tracks, scenery, interface artwork, and Web Audio synthesis.</p></div><div><span class="eyebrow">RACE TOGETHER</span><h3>Made for local play</h3><p>One computer. Up to four drivers. Local records and ghosts. No account or backend required.</p></div></div><button class="button primary" data-nav="home">BACK TO THE GRID ${arrow}</button></section>`;
  }
  loading() {
    this.app.className = "loading-screen";
    this.app.innerHTML = `<div class="loading-brand">APEX<span>//</span>SHIFT</div><div class="eyebrow">PREPARING ${this.g.selectedTrack.name.toUpperCase()}</div><div class="loading-bar"><i></i></div><p>Find the line. Own the moment.</p>`;
  }
  race() {
    const n = this.g.options.players;
    this.app.className = `race-ui players-${n}`;
    this.app.innerHTML = `<div class="race-top"><span class="race-brand">APEX<span>//</span>SHIFT</span><span>${this.g.selectedTrack.name.toUpperCase()} <i> / </i> ${this.g.mode.toUpperCase().replace("-", " ")}</span><button class="icon-button" data-action="pause" aria-label="Pause race">Ⅱ</button></div><div class="split-huds">${Array.from({ length: n }, (_, i) => `<div class="player-hud" id="hud-${i}" style="--player:${COLORS[i]}"><div class="hud-timing"><small>P${i + 1} · ${esc(this.g.options.names[i])}</small><strong class="hud-time">00:00.000</strong><span class="hud-lap">LAP 1 / ${this.g.options.laps}</span><span class="hud-checkpoint">CHECKPOINT 0 / 3</span><div class="hud-message"></div></div><div class="hud-position"><strong>1<span> / ${this.g.racers.length}</span></strong><small>POSITION</small></div><div class="hud-speed"><div class="speed-value">0</div><span>KM/H <b class="gear">N</b></span><div class="boost-label"><small>ϟ BOOST</small><small class="boost-percent">100%</small></div><div class="boost-bar"><i></i></div><small class="boost-key">HOLD ${keyLabel(this.g.input.bindings[i].boost)} TO BOOST</small></div><div class="hud-minimap">${trackMap(this.g.selectedTrack).replace("</svg>", '<circle class="map-driver" r="4" fill="#fff" stroke="#ff7139" stroke-width="2"/></svg>')}<span>GOLD ${formatTime(this.g.selectedTrack.medals[1] * this.g.options.laps)}</span></div></div>`).join("")}</div><div class="countdown" aria-live="assertive"></div><div class="race-controls"><span><kbd>W A S D</kbd> DRIVE</span><span><kbd>SPACE</kbd> BOOST</span><span><kbd>SHIFT</kbd> DRIFT</span><span><kbd>R</kbd> RESPAWN</span><span><kbd>ESC</kbd> PAUSE</span></div><div class="race-standings"></div><div class="finish-status"></div><div class="speed-lines"></div>`;
    if (this.g.shadowEnabled) {
      const el = document.createElement("div");
      el.className = "ghost-hud";
      el.innerHTML = `<small>${this.g.onlineGhosts ? "ONLINE · RUN WILL BE SHARED" : "SHADOW MODE · PERSONAL BEST"}</small><span>${this.g.ghostSamples ? esc(this.g.ghostName) + " · " + formatTime(this.g.ghostTime) : "Finish this run to create your first shadow"}</span><strong class="ghost-delta">—</strong><small>TIME GAP AT YOUR POSITION · INCLUDES PENALTIES</small>`;
      this.app.append(el);
    }
    const controls = document.createElement("div");
    controls.className = "touch-controls";
    controls.innerHTML = `<div class="touch-steering"><button data-drive="left" aria-label="Steer left">◀</button><button data-drive="right" aria-label="Steer right">▶</button></div><div class="touch-pedals"><button data-drive="drift">DRIFT</button><button data-drive="boost">BOOST</button><button data-drive="brake">BRAKE</button><button data-drive="throttle">GO</button></div><button class="touch-reset" data-action="touch-reset">RESET CAR</button>`;
    this.app.append(controls);
    this.huds = Array.from({ length: n }, (_, i) => {
      const root = this.app.querySelector(`#hud-${i}`);
      return Object.fromEntries(
        [
          "hud-time",
          "hud-lap",
          "hud-checkpoint",
          "hud-message",
          "hud-position",
          "speed-value",
          "gear",
          "boost-percent",
          "boost-bar",
        ].map((c) => [c, root.querySelector("." + c)]),
      );
    });
  }
  updateHUD() {
    const g = this.g;
    const gap = this.app.querySelector(".ghost-delta");
    if (gap && g.ghostSamples) {
      const r = g.racers[0],
        delta = r.finished
          ? r.finishTime - g.ghostTime
          : ghostDelta(g.ghostSamples, r.s, g.raceTime, r.penalty);
      gap.textContent =
        delta === null
          ? "—"
          : `${Math.abs(delta).toFixed(3)}s ${delta <= 0 ? "AHEAD" : "BEHIND"}`;
      gap.classList.toggle("ahead", delta !== null && delta <= 0);
    }
    this.huds?.forEach((h, i) => {
      const r = g.racers[i];
      h["hud-time"].textContent = formatTime(
        r.finished ? r.finishTime : g.raceTime + r.penalty,
      );
      h["hud-lap"].textContent =
        `LAP ${Math.min(r.lap, g.options.laps)} / ${g.options.laps}`;
      h["hud-checkpoint"].textContent =
        `CHECKPOINT ${r.checkpoint} / 3${r.penalty ? " · +" + r.penalty + "s" : ""}`;
      h["hud-position"].innerHTML =
        `<strong>${g.ranking.indexOf(r) + 1}<span> / ${g.racers.length}</span></strong><small>POSITION</small>`;
      h["speed-value"].textContent = Math.round(r.speed * 3.6);
      h.gear.textContent =
        r.speed < 2 ? "N" : Math.min(6, Math.floor(r.speed / 16) + 1);
      h["boost-percent"].textContent = Math.round(r.boost) + "%";
      h["boost-bar"].firstElementChild.style.width = r.boost + "%";
      const dot = this.app.querySelector("#hud-" + i + " .map-driver");
      if (dot) {
        const points = g.selectedTrack.points,
          xs = points.map((p) => p[0]),
          zs = points.map((p) => p[2]),
          pos = g.track.frame(r.s).pos;
        dot.setAttribute(
          "cx",
          28 +
            ((pos.x - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs))) *
              180,
        );
        dot.setAttribute(
          "cy",
          18 +
            ((pos.z - Math.min(...zs)) / (Math.max(...zs) - Math.min(...zs))) *
              102,
        );
      }
      h["hud-message"].textContent = r.finished
        ? "FINISHED"
        : r.offTime > 0
          ? "OFF TRACK — RETURN NOW"
          : r.height > 1
            ? "AIR TIME"
            : r.drifting
              ? "DRIFT + RECHARGE"
              : r.boosting
                ? "BOOST ACTIVE"
                : "";
    });
    const standings = this.app.querySelector(".race-standings");
    if (standings && g.racers.length > 1)
      standings.innerHTML = g.ranking
        .slice(0, 6)
        .map(
          (r, i) =>
            "<div><b>" +
            String(i + 1).padStart(2, "0") +
            '</b><i style="background:' +
            r.color +
            '"></i><span>' +
            esc(r.name) +
            "</span><small>" +
            (r.finished
              ? formatTime(r.finishTime)
              : Math.max(
                  0,
                  Math.floor(((r.s / g.track.length) * 100) / g.options.laps),
                ) + "%") +
            "</small></div>",
        )
        .join("");
    const status = this.app.querySelector(".finish-status");
    if (status)
      status.textContent =
        g.finishWait > 0
          ? "FINISHED · WAITING FOR RIVALS · " +
            Math.max(0, Math.ceil(20 - g.finishWait)) +
            "s"
          : "";
    const count = this.app.querySelector(".countdown");
    if (count)
      count.textContent =
        g.state === "countdown"
          ? Math.ceil(g.countdown)
          : g.raceTime < 0.7 && g.state === "racing"
            ? "GO!"
            : "";
    this.app.classList.toggle(
      "boosting",
      g.racers[0]?.boosting && g.save.data.settings.motion,
    );
  }
  pause() {
    const el = document.createElement("div");
    el.className = "modal-backdrop";
    el.id = "pause-menu";
    el.innerHTML = `<section class="pause-panel"><div class="eyebrow">TAKE A BREATHER</div><h1>PAUSED.</h1><p>Your next great corner can wait.</p><button class="button primary full" data-action="resume">RESUME RACE <span>→</span></button><button class="button glass full" data-action="restart">RESTART RACE <span>↻</span></button><button class="text-button full" data-action="quit">RETURN TO MENU</button><p class="muted">WASD · Drive &nbsp; Space · Boost &nbsp; Shift · Drift</p></section>`;
    this.app.append(el);
  }
  results() {
    const g = this.g,
      results = g.ranking,
      player = g.racers[0],
      medal = player.medal;
    this.app.className = "results-screen";
    this.app.innerHTML = `<div class="result-confetti">${Array.from({ length: 28 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--delay:${i * 0.09}s;--rotate:${i * 19}deg"></i>`).join("")}</div><section class="results-panel"><div class="eyebrow">${g.selectedTrack.name} / RACE COMPLETE</div><div class="result-medal ${medal?.toLowerCase() || ""}">◇</div><h1>${medal ? medal.toUpperCase() + " STANDARD." : "FINISH STRONG."}</h1><div class="result-time">${formatTime(player.finishTime)}</div><div class="result-record">${g.newBest ? "↗ NEW PERSONAL BEST" : medal ? `${medal} medal earned` : "Keep pushing. Your medal is within reach."}</div><div class="result-targets">${["Platinum", "Gold", "Silver", "Bronze"].map((m, i) => `<div class="${m === medal ? "active" : ""}"><span class="medal ${m.toLowerCase()}">◇ ${m}</span><b>${formatTime(g.selectedTrack.medals[i] * g.options.laps)}</b></div>`).join("")}</div><div class="result-rankings">${results.map((r, i) => `<div><b>${String(i + 1).padStart(2, "0")}</b><span style="color:${r.color}">●</span><strong>${esc(r.name)}</strong><span>${r.vehicle.name}</span><b class="mono">${r.finished ? formatTime(r.finishTime) : "DNF"}</b></div>`).join("")}</div><div class="result-details"><span>BEST LAP <b>${formatTime(player.bestLap)}</b></span><span>AIR TIME <b>${player.airtime.toFixed(1)}s</b></span><span>PENALTY <b>+${player.penalty}s</b></span></div><div class="result-actions"><button class="button glass" data-action="quit">BACK TO MENU</button><button class="button primary" data-action="restart">ONE MORE RUN <span>↻</span></button></div></section>`;
    if (g.sharedRun) {
      const share = document.createElement("div");
      share.className = "ghost-share";
      share.innerHTML = `<p class="ghost-share-status" aria-live="polite"></p><label>Share this run ID with a friend<input readonly aria-label="Ghost run ID" value="${esc(g.sharedRun.id)}"></label>`;
      share
        .querySelector("input")
        .addEventListener("click", (e) => e.target.select());
      this.app.querySelector(".result-actions").before(share);
      this.updateSharing();
    }
  }
  updateSharing() {
    const status = this.app.querySelector(".ghost-share-status");
    if (status && this.g.sharedRun)
      status.textContent = this.g.online.pending.some(
        (r) => r.id === this.g.sharedRun.id,
      )
        ? "Upload pending · Retry from Ghost Mode"
        : "Shared · Friends can find this run using its ID";
  }
  confirm(title, message, action) {
    const el = document.createElement("div");
    el.className = "modal-backdrop";
    el.innerHTML = `<section class="pause-panel"><h2>${title}</h2><p>${message}</p><button class="button primary full" data-action="confirm-${action}">YES, RESET</button><button class="button glass full" data-action="dismiss">KEEP MY PROGRESS</button></section>`;
    this.app.append(el);
  }
  click(e) {
    const el = e.target.closest("button");
    if (!el || el.disabled) return;
    this.g.audio.start();
    this.g.audio.play("menu");
    const d = el.dataset;
    if (d.action === "touch-reset") {
      this.g.input.pressed.add("KeyR");
      return;
    }
    if (d.onlineGhost) {
      void this.onlineRace(d.onlineGhost);
      return;
    }
    if (d.action === "online-run") {
      void this.onlineRace();
      return;
    }
    if (d.action === "search-ghosts") {
      this.ghostQuery = this.app
        .querySelector("[data-ghost-query]")
        .value.trim();
      void this.loadGhosts();
      return;
    }
    if (d.action === "retry-ghosts") {
      el.disabled = true;
      void this.g.online.flush().then(() => {
        if (this.route === "ghosts" && this.g.state === "menu")
          this.nav("ghosts");
      });
      return;
    }
    if (d.nav) {
      if (d.nav === "garage") this.g.world.setHero(this.g.vehicle);
      this.nav(d.nav);
      return;
    }
    if (d.track) {
      this.g.selectTrack(d.track);
      if (this.route === "career") {
        this.g.mode = "career";
        this.g.startRace();
      } else this.render();
      return;
    }
    if (d.mode) {
      if (d.mode === "time-trial") {
        this.nav("ghosts");
        return;
      }
      this.g.setMode(d.mode);
      return;
    }
    if (d.preview) {
      this.g.previewVehicle = VEHICLES.find((v) => v.id === d.preview);
      this.g.world.setHero(this.g.previewVehicle);
      this.render();
      return;
    }
    if (d.selectVehicle) {
      const v = VEHICLES.find((v) => v.id === d.selectVehicle);
      if (this.g.save.medals >= v.unlock) {
        this.g.vehicle = v;
        this.g.save.data.selectedVehicle = v.id;
        this.g.save.persist();
        this.toast("Vehicle selected", v.name);
        this.render();
      }
      return;
    }
    if (d.ghost) {
      this.g.selectTrack(d.ghost);
      this.g.setMode("time-trial", true);
      this.g.startRace();
      return;
    }
    if (d.remap) {
      const [i, action] = d.remap.split(":");
      el.textContent = "PRESS A KEY";
      this.g.input.capturing = (code) => {
        if (["Escape", "KeyR", "KeyC", "Backspace"].includes(code)) {
          this.toast(
            "That key is reserved",
            "Choose another key for this action.",
          );
          this.render();
          return;
        }
        const conflict = this.g.input.bindings.some((b, j) =>
          Object.entries(b).some(
            ([a, k]) => k === code && !(Number(i) === j && a === action),
          ),
        );
        if (conflict) {
          this.toast("Key already assigned", "Choose an unused key.");
          this.render();
          return;
        }
        this.g.input.bindings[i][action] = code;
        this.g.save.data.bindings = this.g.input.bindings;
        this.g.save.persist();
        this.render();
      };
      return;
    }
    const action = d.action;
    if (action === "race") {
      if (this.route === "home") this.g.setMode("quick", true);
      this.g.startRace();
    } else if (action === "time-trial") {
      this.g.setMode("time-trial", true);
      this.g.startRace();
    } else if (action === "pause") this.g.pause();
    else if (action === "resume") this.g.resume();
    else if (action === "restart") this.g.startRace();
    else if (action === "quit") this.g.quit();
    else if (action === "test-sound") this.g.audio.play("finish");
    else if (action === "reset-controls") this.g.resetControls();
    else if (action === "reset-records" || action === "reset-progress")
      this.confirm(
        "Start a clean page?",
        "This permanently removes the selected saved data from this browser.",
        action,
      );
    else if (action === "confirm-reset-records") {
      this.g.save.resetRecords();
      this.render();
    } else if (action === "confirm-reset-progress") {
      this.g.save.reset();
      this.g.vehicle = VEHICLES[0];
      this.render();
    } else if (action === "dismiss") el.closest(".modal-backdrop").remove();
  }
  change(e) {
    const el = e.target,
      d = el.dataset;
    if (d.ghostTrack !== undefined) {
      this.g.selectTrack(el.value);
      this.nav("ghosts");
      return;
    }
    if (d.ghostName !== undefined) {
      this.g.save.data.ghostName = el.value.trim().slice(0, 32) || "You";
      this.g.save.persist();
      return;
    }
    if (d.recordTrack !== undefined) {
      this.recordTrack = el.value;
      this.render();
      return;
    }
    if (d.setting) {
      const s = this.g.save.data.settings;
      s[d.setting] =
        el.type === "checkbox"
          ? el.checked
          : el.type === "range" || d.setting === "resolution"
            ? Number(el.value)
            : el.value;
      if (el.type === "range")
        el.nextElementSibling.textContent = Math.round(el.value * 100) + "%";
      this.g.save.persist();
      this.g.world.applySettings(s);
      if (d.setting === "difficulty") this.g.options.difficulty = el.value;
    }
    if (d.option) {
      if (
        !["track", "mode", "difficulty", "players"].includes(d.option) &&
        ["quick", "time-trial", "career"].includes(this.g.mode)
      )
        this.g.mode = "custom";
      if (d.option === "track") {
        this.g.selectTrack(el.value);
      } else if (d.option === "mode") {
        this.g.setMode(el.value, true);
      } else {
        this.g.options[d.option] = ["laps", "players", "ai"].includes(d.option)
          ? Number(el.value)
          : el.value;
        if (d.option === "players" && Number(el.value) > 1)
          this.g.mode = "local";
      }
      this.render();
    }
    if (d.player !== undefined)
      this.g.options.names[Number(d.player)] =
        el.value.trim() || `Player ${Number(d.player) + 1}`;
  }
}
