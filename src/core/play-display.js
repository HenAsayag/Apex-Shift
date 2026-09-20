export class PlayDisplay {
  constructor(game) {
    this.game = game;
    this.windowed = false;
    document.addEventListener("fullscreenchange", () => {
      if (
        !this.ready &&
        ["racing", "countdown", "loading", "paused"].includes(game.state)
      ) {
        game.input.clear();
        game.pause();
        this.require(() =>
          game.state === "paused" ? game.resume() : game.startRace(),
        );
      }
    });
  }
  get ready() {
    return this.windowed || !!document.fullscreenElement;
  }
  require(continuePlaying) {
    if (this.ready) return true;
    this.pending = continuePlaying;
    if (this.dialog) return false;
    const dialog = (this.dialog = document.createElement("div"));
    dialog.className = "fullscreen-gate";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "fullscreen-title");
    dialog.innerHTML = `<section><div class="eyebrow">READY TO RACE</div><h1 id="fullscreen-title">GO FULL SCREEN.</h1><p>Choose Full Screen, or use the iPhone option to play in your browser. Turn your phone sideways for more room.</p><button class="button primary full" data-fullscreen>FULL SCREEN →</button><button class="button glass full" data-windowed>Using iPhone? Play without Full Screen</button><p class="fullscreen-error" role="status"></p><button class="button glass full" data-fullscreen-cancel>BACK TO MENU</button></section>`;
    document.body.append(dialog);
    const button = dialog.querySelector("[data-fullscreen]");
    button.focus();
    dialog.querySelector("[data-windowed]").onclick = () => {
      this.windowed = true;
      const next = this.pending;
      this.close();
      next?.();
    };
    button.onclick = async () => {
      button.disabled = true;
      try {
        if (
          !document.documentElement.requestFullscreen ||
          !document.fullscreenEnabled
        )
          throw new Error("unsupported");
        await document.documentElement.requestFullscreen();
        if (!document.fullscreenElement) throw new Error("declined");
        try {
          await screen.orientation?.lock?.("landscape");
        } catch {}
        const next = this.pending;
        this.close();
        next?.();
      } catch {
        dialog.querySelector(".fullscreen-error").textContent =
          "Full screen could not start. Select “Using iPhone? Play without Full Screen” to play in your browser, or try Full Screen again.";
      } finally {
        button.disabled = false;
      }
    };
    dialog.querySelector("[data-fullscreen-cancel]").onclick = () => {
      this.close();
      this.game.quit();
    };
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        this.game.quit();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const buttons = [...dialog.querySelectorAll("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement);
        buttons[
          (index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
        ].focus();
      }
    });
    return false;
  }
  close() {
    this.dialog?.remove();
    this.dialog = null;
    this.pending = null;
  }
}
