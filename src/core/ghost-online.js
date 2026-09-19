const QUEUE_KEY = "apex-ghost-uploads-v1";

export function runId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
}

export class GhostOnline {
  constructor(notify, storage, request = globalThis.fetch.bind(globalThis)) {
    this.notify = notify;
    this.storage = storage;
    this.request = request;
    this.pending = [];
    try {
      const saved = JSON.parse(storage.getItem(QUEUE_KEY) || "[]");
      if (Array.isArray(saved)) this.pending = saved;
    } catch {}
  }
  persist() {
    try {
      this.storage.setItem(QUEUE_KEY, JSON.stringify(this.pending));
      return true;
    } catch {
      this.notify(
        "Upload queue could not be saved",
        "Keep this tab open and retry sharing before leaving.",
      );
      return false;
    }
  }
  async api(path = "", options = {}) {
    const response = await this.request("/api/ghosts" + path, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error || "Ghost service unavailable.");
    return body;
  }
  list(track, query = "") {
    return this.api("?" + new URLSearchParams({ track, q: query }));
  }
  get(id) {
    return this.api("/" + encodeURIComponent(id));
  }
  enqueue(run) {
    this.pending.push(run);
    this.persist();
    return this.flush();
  }
  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.pending.length) {
        const run = this.pending[0];
        await this.api("", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(run),
        });
        this.pending = this.pending.filter((r) => r.id !== run.id);
        this.persist();
        this.notify(
          "Ghost shared",
          run.name + " · Your run is ready to challenge.",
        );
      }
    } catch (error) {
      this.notify(
        "Ghost upload pending",
        error.message + " Retry from Ghost Mode.",
      );
    } finally {
      this.flushing = false;
    }
  }
}
