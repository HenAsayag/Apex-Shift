export class PlayDisplay {
  constructor(game) {
    this.game = game;
    document.addEventListener("fullscreenchange", () => {
      if (
        !document.fullscreenElement &&
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
  require(continuePlaying) {
    if (document.fullscreenElement) return true;
    this.pending = continuePlaying;
    if (this.dialog) return false;
    const dialog = (this.dialog = document.createElement("div"));
    dialog.className = "fullscreen-gate";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "fullscreen-title");
    dialog.innerHTML = `<section><div class="eyebrow">READY TO RACE</div><h1 id="fullscreen-title">GO FULL SCREEN.</h1><p>Press Full Screen to play. On mobile, turn your device sideways for more room.</p><button class="button primary full" data-fullscreen>FULL SCREEN →</button><p class="fullscreen-error" role="status"></p><button class="button glass full" data-fullscreen-cancel>BACK TO MENU</button></section>`;
    document.body.append(dialog);
    const button = dialog.querySelector("[data-fullscreen]");
    button.focus();
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
          "Full screen could not start. Use a browser that supports full-screen web games and allow full screen, then try again.";
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
        (document.activeElement === button
          ? dialog.querySelector("[data-fullscreen-cancel]")
          : button
        ).focus();
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
