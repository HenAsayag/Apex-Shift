export const BRAND = "APEX//SHIFT";
export const COLORS = ["#ff7139", "#53d9f1", "#c7a4ff", "#d7f36b"];
export const MEDALS = ["Platinum", "Gold", "Silver", "Bronze"];
export const DEFAULT_SETTINGS = {
  graphics: "high",
  resolution: 1,
  shadows: true,
  effects: true,
  engine: 0.35,
  sfx: 0.55,
  music: 0.18,
  camera: "chase",
  difficulty: "normal",
  shake: true,
  motion: true,
  sensitivity: 1,
  assist: true,
  rubberBand: false,
  vibration: true,
};
export const DEFAULT_BINDINGS = [
  {
    accelerate: "KeyW",
    brake: "KeyS",
    left: "KeyA",
    right: "KeyD",
    boost: "Space",
    drift: "ShiftLeft",
  },
  {
    accelerate: "ArrowUp",
    brake: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    boost: "ShiftRight",
    drift: "Slash",
  },
  {
    accelerate: "KeyI",
    brake: "KeyK",
    left: "KeyJ",
    right: "KeyL",
    boost: "KeyU",
    drift: "KeyO",
  },
  {
    accelerate: "Numpad8",
    brake: "Numpad5",
    left: "Numpad4",
    right: "Numpad6",
    boost: "NumpadEnter",
    drift: "NumpadDecimal",
  },
];
export const DIFFICULTIES = {
  easy: 0.67,
  normal: 0.8,
  hard: 0.92,
  expert: 1.04,
};
export const formatTime = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds * 1000));
  return `${String(Math.floor(total / 60000)).padStart(2, "0")}:${String(Math.floor(total / 1000) % 60).padStart(2, "0")}.${String(total % 1000).padStart(3, "0")}`;
};
export const keyLabel = (code) =>
  code
    .replace("Key", "")
    .replace(
      "Arrow",
      "↑↓←→"[
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(code)
      ] || "",
    )
    .replace("Numpad", "Num ")
    .replace("ShiftLeft", "L Shift")
    .replace("ShiftRight", "R Shift");
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mod = (n, m) => ((n % m) + m) % m;
export const STRINGS = {
  en: {
    race: "Race",
    garage: "Garage",
    career: "Career",
    records: "Records",
    settings: "Settings",
    play: "Let’s race",
    back: "Back",
    resume: "Resume race",
    restart: "Restart race",
  },
};
export const t = (key, language = "en") =>
  STRINGS[language]?.[key] ?? STRINGS.en[key] ?? key;
