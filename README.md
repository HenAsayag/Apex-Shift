# APEX//SHIFT

An original browser-based 3D arcade racer. Ten circuits, five vehicles, six race modes, local split-screen, synthesized audio, and local records. No account or backend is needed.

## Start

Install **Node.js 22.12 or newer**, then run these commands in this folder:

```sh
npm install
npm run dev
```

Open **http://localhost:5187** in a desktop browser with WebGL 2 and hardware acceleration enabled. Click **LET’S RACE** to start a one-lap race in Redline Canyon. Audio begins after the first click or race start.

If the default npm cache is restricted in your environment, use `npm install --cache .npm-cache`.

### Production build

```sh
npm run build
npm run preview
```

The production game is in `dist/`. Serve that folder with any static HTTP server; opening `index.html` as a `file://` URL is unsupported. Once built, the game has no CDN, font service, external asset, API, or runtime network dependency. The preview command prints its own local URL.

## Driving

### GitHub Pages edition

Play at **https://henasayag.github.io/Apex-Shift/**. The Pages workflow builds the WebGL game with `VITE_STATIC_PAGES=true`, uses `/Apex-Shift/` as the asset base, and publishes only `dist/`. In repository Settings → Pages, select **GitHub Actions** as the source. Pushes to `main` redeploy automatically.

This static edition supports racing, personal shadows, local records, touch controls, and fullscreen. Shared online ghosts are disabled because GitHub Pages cannot run the Node API. Normal `npm run dev`, `npm run build`, and `npm start` retain server-backed sharing.

| Action     | Player 1   | Player 2            | Player 3 | Player 4       |
| ---------- | ---------- | ------------------- | -------- | -------------- |
| Accelerate | W          | Up arrow            | I        | Numpad 8       |
| Brake      | S          | Down arrow          | K        | Numpad 5       |
| Steer      | A / D      | Left / Right arrows | J / L    | Numpad 4 / 6   |
| Boost      | Space      | Right Shift         | U        | Numpad Enter   |
| Drift      | Left Shift | /                   | O        | Numpad Decimal |

- **Esc**: pause/resume.
- **Backspace**: restart the race.
- **R**: return unfinished human racers to their last checkpoint; adds 3 seconds per racer and resets the camera.
- **C**: cycle chase, close, far, and hood cameras.
- Boost refills while coasting; drifting also recharges it. Cyan pads supply a temporary speed boost.
- Ramps launch automatically at sufficient speed. Steering also adjusts the car while airborne.
- Missing a checkpoint returns you to the last valid checkpoint with a 5-second penalty. Staying off an unguarded track section triggers a 3-second recovery.
- Rain and snow reduce grip. Steering assist is enabled initially and can be disabled.

The **Controls** screen supports individual key remapping. Duplicate bindings and reserved global shortcuts are rejected. Remapping is cancelled when you navigate away.

### Gamepads

The first four connected standard gamepads map to players 1–4. Use the left stick to steer, right trigger to accelerate, left trigger to brake, B to boost, and X to drift. A also accelerates. Controller vibration is optional and depends on browser/controller support. Menus use the mouse and keyboard.

Keyboard rollover differs by hardware. If four players cannot hold all their keys simultaneously, connect gamepads or remap the bindings. Num Lock may affect numpad behavior on some keyboards.

## Modes

- **Quick Race** — immediately race the selected circuit for a medal.
- **Career** — progress through Ignition Series, Velocity Cup, and Limitless Tour. Earn Bronze or better on distinct circuits to unlock the next cup at 3 and 6 medals.
- **Time Trial** — race the ghost of the fastest recorded run for that circuit and configuration.
- **AI Race** — race up to five opponents with Easy, Normal, Hard, or Expert difficulty. Rivals use the same driving physics as humans. Optional catch-up is capped at ±4% of the AI target speed.
- **Local Multiplayer** — 2–4 human players with separate cameras, controls, names, and colors. AI can fill additional grid places. Three-player mode uses the fourth quadrant for standings.
- **Custom Race** — choose laps, AI count/difficulty, weather, and time of day. Editing incompatible Quick Race or Time Trial options automatically switches to Custom.

After all humans finish, remaining opponents can race for up to 20 seconds. The countdown is displayed; any opponent still on track at the timeout receives DNF. Every finishing human can add a run to the local record book.

All circuits are available in free play. Career locks apply within Career. Custom configuration records are kept separate and do not inflate career medal counts.

## Ghost Mode

Open **Ghost Mode** in the top navigation (or choose Time Trial in Explore Modes). Select a circuit and race your translucent personal-best ghost, or set your first time. A live gap compares your race time at your current track position with the ghost's first arrival there; negative/ahead is faster. Penalties are included in the gap and final score, while the replay follows the original driving timeline. Ghosts never collide with racers.

For online play, enter a public driver name and choose **Start Online Run**, or **Race Ghost** on the shared board. Every completed online run is uploaded, including slower runs. Unfinished races are not uploaded. Search by driver name or an exact run ID to challenge a friend; results show the fastest 100 matching runs. The result screen provides the run ID. Names are display names, not authenticated accounts, and community times are unverified.

Failed uploads remain in this browser's separate persistent queue. Use **Retry Pending Uploads** from Ghost Mode after reconnecting. If browser storage is full or blocked, keep the tab open until sharing succeeds. Ghost uploads support races up to two hours and 16 MB; the UI reports rejected uploads instead of claiming they were shared. Local record resets do not delete shared server runs or pending uploads.

### Shared server

`npm run dev` and `npm run preview` include the ghost API. Replays are stored in `ghost-data/` (ignored by Git), survive restarts, and are available to anyone using **the same server**. Back up this folder to preserve online runs. An environment variable, `GHOST_DATA_DIR`, can select another persistent storage directory.

For hosting, use `npm run build` then `npm start`. The Node server serves both `dist/` and `/api/ghosts` on port 5187 (`PORT` overrides it). Deploy this server with persistent disk to give remote friends a shared URL; localhost alone is only available on your computer. A static-only deployment supports personal ghosts but requires this backend for online sharing. No public deployment or account system is included. For an open public leaderboard, add authentication, abuse controls, and authoritative run verification before treating scores as trusted.

Validation: `npm test` covers replay timing, respawns, upload retries, API validation, search, and disk persistence. `npm run test:ghosts` exercises two independent browser players against an isolated test server.

## Vehicles

| Vehicle    | Character                  | Unlock                |
| ---------- | -------------------------- | --------------------- |
| Vanta R    | Balanced coupe             | Available immediately |
| Spectre GT | Fast long-tail tourer      | Available immediately |
| Kestrel S  | Acceleration and cornering | 2 circuit medals      |
| Nomad XR   | Stunts and air control     | 4 circuit medals      |
| Nova X     | High-speed track car       | 7 circuit medals      |

The Garage includes a rotating 3D preview, six stats, and vehicle selection. The selected machine is used by human players; each local player receives a distinct livery color.

## Circuits

| Circuit           | Environment                   | Cup       |
| ----------------- | ----------------------------- | --------- |
| Redline Canyon    | Desert canyon                 | Ignition  |
| Palmwave Sprint   | Tropical island               | Ignition  |
| Evergreen Run     | Forest valley                 | Ignition  |
| Pacific Overdrive | Coastal highway               | Velocity  |
| Frostbite Pass    | Snow mountains                | Velocity  |
| Ironworks Rush    | Industrial factory            | Velocity  |
| Neon District     | Neon city                     | Limitless |
| Emberfall Circuit | Volcanic island               | Limitless |
| Orbital Zero      | Space station / vertical loop | Limitless |
| Midnight Protocol | Cyberpunk night city          | Limitless |

Each circuit has elevation, curves, banking, ramps, boost pads, sequential checkpoints, a start/finish gantry, boundaries, themed scenery, a generated preview, and four medal targets. Advanced circuits add barriers to avoid. Orbital Zero uses a continuous oriented road frame for its full vertical loop.

## Records and settings

Progress is saved under `apex-shift-v1` in this browser’s LocalStorage. The Records screen shows best times, medals, attempts, vehicles, dates, ghosts, and each circuit’s ten fastest runs. Settings and key bindings persist too. Storage failures are handled without preventing play, with a notification if a record cannot be saved. Reset actions require an explicit confirmation in the menu.

Settings include graphics quality, resolution scaling, shadows, effects, camera, sensitivity, steering assist, screen shake, speed effects, AI catch-up, vibration, and independent engine/effects/music volume.

The game uses **Three.js WebGL 2** on desktop and mobile. On touch devices, on-screen controls support simultaneous steering, acceleration, brake, boost, and drift, with a reset-car button. Rendering uses a lower pixel-ratio cap and disables multisample antialiasing on touch devices to reduce GPU load. Landscape is recommended; the HUD also adapts to portrait and safe-area insets.

All races require pressing **Full Screen** before play. Leaving fullscreen pauses the race and requires re-entry before resuming. Browsers must expose the Fullscreen API for the document, in addition to WebGL 2; if fullscreen is unavailable or denied, the game explains the problem and remains blocked instead of silently starting windowed. Mobile browser support varies, so a browser without document fullscreen cannot play under this requirement. Automated mobile tests emulate Chromium touch devices; physical-device performance still needs device testing.

**Shadow Mode is always enabled in the main Race / Quick Race mode** and replays the best saved run for the matching circuit configuration. The first completed run creates the shadow; subsequent races automatically show it and the time gap. Time Trial / Ghost Mode retains personal and online challenges.

## Project structure

```text
index.html                  Browser entry point
public/icon.svg             Original brand icon
src/
  main.js                   Startup and WebGL failure screen
  config.js                 Defaults, controls, shared formatters, English text entry point
  data/
    tracks.js               Ten circuit definitions, cups, medal thresholds
    vehicles.js             Five vehicle configurations and unlocks
  core/
    game.js                 Central state manager and race lifecycle
    track.js                Spline road geometry, banked/loop frame sampling
    physics.js              Fixed-step arcade vehicle simulation
    ai.js                   Waypoint driving, racing lines, difficulty
    input.js                Keyboard remapping and gamepad support
    storage.js              Versioned LocalStorage records and achievements
    ghost.js                Replay capture and interpolation
    audio.js                Original Web Audio engine/effects/music synthesis
  render/
    world.js                WebGL rendering, road/scenery, weather, cameras, split-screen
    vehicle.js              Original procedural vehicle models
  ui/
    ui.js                   Menus, forms, HUD, results, notifications
    styles.css              Responsive visual design and animation
 tests/
   core.test.js             Physics, tracks, AI, saves, ghosts, medal tests
   browser-flows.mjs        Browser interaction and rendering regression checks
   browser-smoke.mjs        Basic first-drive smoke check
   balance.mjs              Automated lap-time comparison across difficulties
```

### Implementation notes

The simulation runs at 120 fixed steps per second, independently of rendering. Vehicles use distance along the circuit, lateral position, heading, and vertical jump state. This deliberately arcade model supports banked roads and magnetic loops without a heavyweight rigid-body dependency. Guardrails, obstacles, car-to-car contacts, landing, and off-track recovery are handled in the game’s simulation.

Track configuration is separate from generated geometry; edit `src/data/tracks.js` to change a circuit. `createVehicle(config, color, ghost)` is the replacement boundary for future authored models. Graphics use instanced scenery, shared materials, bounded particles/skid marks, capped pixel ratio, simplified environment reflections, and explicit GPU resource disposal when rebuilding tracks. Procedural geometry is intentionally stylized.

Shared text and mode labels have a central English entry point in `config.js`; only English copy is provided. Menu copy can be extracted into additional locale dictionaries without changing simulation or renderer code.

## Validation

```sh
npm test
npm run build
npm run format:check
```

With the development server running, this environment’s Microsoft Edge can run the browser checks:

```sh
npm run test:browser
```

The browser test uses Playwright’s `channel: 'msedge'`. Change that to a locally installed compatible channel if needed. Browser screenshots are written to `artifacts/` (ignored from source control). `node tests/balance.mjs` simulates complete AI laps on all ten tracks at all four difficulty levels.

The regression suite checks actual keyboard driving, brake/drift/boost inputs, pause timing, respawn, restart, a full physics-driven finish, record persistence after reload, ghost playback, menus, remapping, vehicle selection, four independent human inputs, all track environments, and a narrow viewport. Additional regression coverage checks custom options, remap cancellation, three-player layout, multi-lap completion, weather, and blocked browser storage.

Physical controller vibration and keyboard rollover require testing on the user’s hardware; their browser APIs are supported, but physical devices were not available during automated testing.

## Credits and licenses

Branding, circuit layouts, vehicle geometry, scenery, previews, interface artwork, and synthesized audio are original to this project. Three.js, Vite, Playwright, and Prettier are distributed under their respective MIT/Apache licenses; see their packages for license files. No Trackmania assets, layouts, audio, logos, or names are used in the game.
