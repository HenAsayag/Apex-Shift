import { DEFAULT_SETTINGS, DEFAULT_BINDINGS } from "../config.js";
const KEY = "apex-shift-v1";
export class SaveData {
  constructor(storage) {
    this.storage = storage;
    this.available = true;
    let data = {};
    try {
      this.storage = storage ?? globalThis.localStorage;
      data = JSON.parse(this.storage.getItem(KEY) || "{}");
      if (!data || typeof data !== "object") data = {};
    } catch {
      this.available = false;
    }
    this.data = {
      version: 1,
      ghostName:
        typeof data.ghostName === "string"
          ? data.ghostName.slice(0, 32)
          : "You",
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
      bindings:
        Array.isArray(data.bindings) && data.bindings.length === 4
          ? data.bindings
          : structuredClone(DEFAULT_BINDINGS),
      records:
        data.records && typeof data.records === "object" ? data.records : {},
      achievements: Array.isArray(data.achievements) ? data.achievements : [],
      selectedVehicle: data.selectedVehicle || "vanta",
      races: Number(data.races) || 0,
    };
  }
  persist() {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
      this.available = true;
    } catch {
      this.available = false;
    }
    return this.available;
  }
  get medals() {
    return Object.entries(this.data.records).filter(
      ([key, r]) => !key.includes(":") && r.medal,
    ).length;
  }
  recordKey(trackId, laps = 1, weather = "clear", time = "track") {
    return laps === 1 && weather === "clear" && time === "track"
      ? trackId
      : `${trackId}:${laps}:${weather}:${time}`;
  }
  attempt(key) {
    const r = this.data.records[key] || { attempts: 0, runs: [] };
    r.attempts++;
    this.data.records[key] = r;
    this.persist();
  }
  finish(key, run, ghost) {
    const record = this.data.records[key] || { attempts: 1, runs: [] };
    const best = !record.best || run.time < record.best;
    record.runs = [...(record.runs || []), run]
      .sort((a, b) => a.time - b.time)
      .slice(0, 10);
    if (best) {
      record.best = run.time;
      record.medal = run.medal;
      record.vehicle = run.vehicle;
      record.date = run.date;
      record.ghost = ghost;
    }
    this.data.records[key] = record;
    this.data.races++;
    this.persist();
    return best;
  }
  unlock(id) {
    if (this.data.achievements.includes(id)) return false;
    this.data.achievements.push(id);
    this.persist();
    return true;
  }
  resetRecords() {
    this.data.records = {};
    this.persist();
  }
  reset() {
    this.data.records = {};
    this.data.achievements = [];
    this.data.races = 0;
    this.data.selectedVehicle = "vanta";
    this.persist();
  }
}
export const ACHIEVEMENTS = [
  {
    id: "first",
    name: "First across the line",
    description: "Finish your first race.",
    icon: "⚑",
  },
  {
    id: "gold",
    name: "Golden hour",
    description: "Earn a Gold or Platinum medal.",
    icon: "◇",
  },
  {
    id: "air",
    name: "Frequent flyer",
    description: "Spend 3 seconds in the air in one race.",
    icon: "↗",
  },
  {
    id: "drift",
    name: "Sideways thinking",
    description: "Drift for 5 seconds in one race.",
    icon: "〰",
  },
  {
    id: "boost",
    name: "All the way up",
    description: "Boost for 10 seconds in one race.",
    icon: "ϟ",
  },
  {
    id: "clean",
    name: "Untouchable",
    description: "Finish a race with no wall hits or respawns.",
    icon: "◎",
  },
  {
    id: "tour",
    name: "World tour",
    description: "Earn medals on all 10 circuits.",
    icon: "◈",
  },
];
