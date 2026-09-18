// ============================================================
// gameplay/MemorySystem.js
// "The World Remembers" — flags that persist across the chapter.
// ============================================================

export class MemorySystem {
  constructor(saveSystem) {
    this.save = saveSystem;
    this.flags = {
      diyaEarlyLit: saveSystem.progress.diyaEarlyLit || false,
      bellEarlyRung: saveSystem.progress.bellEarlyRung || false,
      shortcutOpened: saveSystem.progress.shortcutOpened || false,
      earlyDiyaPosition: null,  // runtime only
    };
    this.callbacks = {};
  }

  setFlag(name, value) {
    this.flags[name] = value;
    // Persist via the save system.
    this.save.setProgress({ [name]: value });
    // Fire callbacks.
    if (this.callbacks[name]) {
      for (const cb of this.callbacks[name]) cb(value);
    }
  }

  get(name) {
    return this.flags[name];
  }

  /** Register a callback fired when a flag becomes true. */
  onFlag(name, cb) {
    if (!this.callbacks[name]) this.callbacks[name] = [];
    this.callbacks[name].push(cb);
  }

  /** Convenience: check if a memory should unlock a benefit at the boss fight. */
  hasBossBonus() {
    return this.flags.bellEarlyRung;
  }
}

export default MemorySystem;
