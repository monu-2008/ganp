// ============================================================
// core/SaveSystem.js
// localStorage-backed save/settings system.
// ============================================================

const KEY = "ganesh_vighna_save_v1";

const DEFAULTS = {
  quality: "balanced",
  volumes: { master: 0.6, music: 0.5, sfx: 0.7 },
  debug: false,
  progress: {
    chapter: 0,         // highest chapter reached (0 = none, 1+ = unlocked)
    diyaEarlyLit: false, // chapter 1 diya - world remembers
    bellEarlyRung: false,
    shortcutOpened: false,
    endingSeen: false,
  },
};

export class SaveSystem {
  constructor() {
    this.data = { ...DEFAULTS };
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.data = {
        ...DEFAULTS,
        ...parsed,
        progress: { ...DEFAULTS.progress, ...(parsed.progress || {}) },
        volumes: { ...DEFAULTS.volumes, ...(parsed.volumes || {}) },
      };
    } catch (e) {
      console.warn("[SaveSystem] load failed:", e);
    }
  }

  _save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("[SaveSystem] save failed:", e);
    }
  }

  get quality() { return this.data.quality; }
  setQuality(q) { this.data.quality = q; this._save(); }

  get volumes() { return this.data.volumes; }
  setVolumes(v) { this.data.volumes = { ...this.data.volumes, ...v }; this._save(); }

  get debug() { return this.data.debug; }
  setDebug(b) { this.data.debug = b; this._save(); }

  get progress() { return this.data.progress; }

  setProgress(patch) {
    this.data.progress = { ...this.data.progress, ...patch };
    this._save();
  }

  resetProgress() {
    this.data.progress = { ...DEFAULTS.progress };
    this._save();
  }

  hasProgress() {
    return this.data.progress.chapter > 0;
  }
}

export const saveSystem = new SaveSystem();
export default SaveSystem;
