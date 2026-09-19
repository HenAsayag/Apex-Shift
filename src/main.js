import "./ui/styles.css";
import "./ui/ghost.css";
import "./ui/mobile.css";
import { Game } from "./core/game.js";
try {
  const game = new Game();
  if (import.meta.env.DEV) window.__game = game;
} catch (error) {
  console.error(error);
  document.querySelector("#app").innerHTML =
    `<div class="error-screen"><h1>LET’S GET YOU ON TRACK.</h1><p>The 3D engine could not start. Enable hardware acceleration in your browser, then reload. A current desktop browser with WebGL 2 support is required.</p><button class="button primary" onclick="location.reload()">RETRY →</button></div>`;
}
