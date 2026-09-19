import { DEFAULT_BINDINGS, clamp } from "../config.js";
// Track lateral coordinates point left as seen from the chase camera.
export const driverSteering = (value) => -clamp(value, -1, 1);
export class Input {
  constructor(bindings = DEFAULT_BINDINGS) {
    this.bindings = structuredClone(bindings);
    this.keys = new Set();
    this.pressed = new Set();
    this.capturing = null;
    this.touch = new Map();
    this.touchDevice =
      navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
    this.touchDriving = this.touchDevice;
    document.documentElement.classList.toggle(
      "touch-device",
      navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches,
    );
    document.addEventListener("pointerdown", (e) => {
      const button = e.target.closest("[data-drive]");
      if (!button) return;
      this.touchDriving = true;
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      this.touch.set(e.pointerId, button.dataset.drive);
      button.classList.add("held");
    });
    // Keep the thumb down while sliding between left and right.
    document.addEventListener("pointermove", (e) => {
      if (!["left", "right", "neutral"].includes(this.touch.get(e.pointerId)))
        return;
      const zone = document.querySelector(".touch-steering");
      if (!zone) return;
      const box = zone.getBoundingClientRect(),
        center = box.x + box.width / 2;
      const action =
        e.clientX < center - 8
          ? "left"
          : e.clientX > center + 8
            ? "right"
            : "neutral";
      this.touch.set(e.pointerId, action);
      zone
        .querySelectorAll("[data-drive]")
        .forEach((button) =>
          button.classList.toggle(
            "held",
            Array.from(this.touch.values()).includes(button.dataset.drive),
          ),
        );
    });
    const release = (e) => {
      this.touch.delete(e.pointerId);
      const button = e.target.closest("[data-drive]");
      if (
        button &&
        !Array.from(this.touch.values()).includes(button.dataset.drive)
      )
        button.classList.remove("held");
      document
        .querySelectorAll("[data-drive]")
        .forEach((el) =>
          el.classList.toggle(
            "held",
            Array.from(this.touch.values()).includes(el.dataset.drive),
          ),
        );
    };
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
    document.addEventListener("lostpointercapture", release);
    window.addEventListener("keydown", (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (this.bindings.some((b) => Object.values(b).includes(e.code)))
        this.touchDriving = false;
      if (this.capturing) {
        e.preventDefault();
        const callback = this.capturing;
        this.capturing = null;
        callback(e.code);
        return;
      }
      if (
        this.bindings.some((b) => Object.values(b).includes(e.code)) ||
        ["Escape", "Backspace", "KeyR", "KeyC"].includes(e.code)
      )
        e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.clear());
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.touch.clear();
    document
      .querySelectorAll("[data-drive].held")
      .forEach((el) => el.classList.remove("held"));
    this.capturing = null;
  }
  consume(code) {
    const found = this.pressed.has(code);
    this.pressed.delete(code);
    return found;
  }
  read(index = 0) {
    const b = this.bindings[index],
      k = this.keys;
    const input = {
      throttle: k.has(b.accelerate) ? 1 : 0,
      brake: k.has(b.brake) ? 1 : 0,
      steer: (k.has(b.right) ? 1 : 0) - (k.has(b.left) ? 1 : 0),
      boost: k.has(b.boost),
      drift: k.has(b.drift),
    };
    if (index === 0) {
      const held = new Set(this.touch.values());
      input.throttle = Math.max(input.throttle, held.has("throttle") ? 1 : 0);
      input.brake = Math.max(input.brake, held.has("brake") ? 1 : 0);
      input.steer += (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
      input.boost ||= held.has("boost");
      input.drift ||= held.has("drift");
    }
    const pad = navigator.getGamepads?.()[index];
    if (index === 0 && this.touchDriving && !pad) {
      const braking = Array.from(this.touch.values()).includes("brake");
      input.throttle = braking ? 0 : 1;
      input.drift = braking && Math.abs(input.steer) > 0;
      input.brake = braking ? (input.drift ? 0.45 : 1) : 0;
      if (braking) input.boost = false;
    }
    if (pad) {
      const axis = pad.axes[0] || 0;
      input.steer += Math.abs(axis) > 0.12 ? axis : 0;
      input.throttle = Math.max(
        input.throttle,
        pad.buttons[7]?.value || (pad.buttons[0]?.pressed ? 1 : 0),
      );
      input.brake = Math.max(input.brake, pad.buttons[6]?.value || 0);
      input.boost ||= !!pad.buttons[1]?.pressed;
      input.drift ||= !!pad.buttons[2]?.pressed;
    }
    input.steer = driverSteering(input.steer);
    return input;
  }
  vibrate(index, strength = 0.2) {
    navigator
      .getGamepads?.()
      [index]?.vibrationActuator?.playEffect("dual-rumble", {
        duration: 120,
        strongMagnitude: strength,
        weakMagnitude: strength * 0.5,
      })
      ?.catch(() => {});
  }
}
