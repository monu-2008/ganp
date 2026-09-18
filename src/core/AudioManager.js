// ============================================================
// core/AudioManager.js
// Web Audio synthesized rain, bells, ambience, ability SFX.
// No external audio files — everything is generated procedurally.
// ============================================================

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.masterVol = 0.6;
    this.musicVol = 0.5;
    this.sfxVol = 0.7;
    this._rainSource = null;
    this._ambienceSource = null;
    this._droneSource = null;
    this._templeBellTimer = null;
    this.initialized = false;
  }

  /** Audio context must be resumed from a user gesture (mobile browser policy). */
  init() {
    if (this.initialized) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVol;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVol;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.master);
      this.initialized = true;
    } catch (e) {
      console.warn("[AudioManager] init failed:", e);
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMasterVolume(v) { this.masterVol = v; if (this.master) this.master.gain.value = v; }
  setMusicVolume(v)  { this.musicVol  = v; if (this.musicGain) this.musicGain.gain.value = v; }
  setSfxVolume(v)    { this.sfxVol    = v; if (this.sfxGain) this.sfxGain.gain.value = v; }

  // ------------------------------------------------------------ rain
  /** Generate continuous rain noise (looping). */
  startRain(intensity = 0.6) {
    if (!this.enabled || !this.ctx) return;
    if (this._rainSource) this.stopRain();
    // White noise buffer (1 second, looped).
    const bufferSize = this.ctx.sampleRate * 1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // Filter: low-pass to soften the rain.
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800 + intensity * 1200;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 200;
    const gain = this.ctx.createGain();
    gain.gain.value = intensity * 0.25;
    src.connect(hp).connect(lp).connect(gain).connect(this.sfxGain);
    src.start();
    this._rainSource = { src, gain, lp, hp };
  }

  setRainIntensity(intensity) {
    if (!this._rainSource) return;
    const { gain, lp } = this._rainSource;
    gain.gain.linearRampToValueAtTime(intensity * 0.25, this.ctx.currentTime + 0.3);
    lp.frequency.linearRampToValueAtTime(1800 + intensity * 1200, this.ctx.currentTime + 0.3);
  }

  stopRain() {
    if (!this._rainSource) return;
    const { src, gain } = this._rainSource;
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
    setTimeout(() => {
      try { src.stop(); } catch (e) {}
    }, 500);
    this._rainSource = null;
  }

  // ------------------------------------------------------------ ambience drone
  /** A subtle low-frequency drone for festival ambience. */
  startAmbience() {
    if (!this.enabled || !this.ctx) return;
    if (this._droneSource) return;
    // Two slow-oscillating low tones for a temple feel.
    const osc1 = this.ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 110;       // A2
    const osc2 = this.ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 164.81;    // E3 (fifth)
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 1.5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800;
    osc1.connect(lp);
    osc2.connect(lp);
    lp.connect(gain).connect(this.musicGain);
    osc1.start();
    osc2.start();
    this._droneSource = { osc1, osc2, gain };
  }

  stopAmbience() {
    if (!this._droneSource) return;
    const { osc1, osc2, gain } = this._droneSource;
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    setTimeout(() => {
      try { osc1.stop(); osc2.stop(); } catch (e) {}
    }, 600);
    this._droneSource = null;
  }

  // ------------------------------------------------------------ temple bell
  /** Bell-like tone with inharmonic partials. */
  playBell(pitch = 220, when = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + when;
    // Three partials give the bell timbre.
    const partials = [
      { f: pitch,         gain: 0.5,  decay: 3.0 },
      { f: pitch * 2.78,  gain: 0.18, decay: 1.8 },
      { f: pitch * 5.40,  gain: 0.10, decay: 1.2 },
    ];
    for (const p of partials) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = p.f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(p.gain, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
      o.connect(g).connect(this.sfxGain);
      o.start(t);
      o.stop(t + p.decay + 0.05);
    }
  }

  /** A distant bell at randomized intervals (used in the intro). */
  startTempleBells(intervalMs = 9000) {
    if (this._templeBellTimer) clearInterval(this._templeBellTimer);
    const tick = () => {
      const pitches = [196, 220, 247, 261, 294];
      const p = pitches[Math.floor(Math.random() * pitches.length)];
      this.playBell(p, Math.random() * 0.4);
    };
    tick();
    this._templeBellTimer = setInterval(tick, intervalMs);
  }

  stopTempleBells() {
    if (this._templeBellTimer) {
      clearInterval(this._templeBellTimer);
      this._templeBellTimer = null;
    }
  }

  // ------------------------------------------------------------ one-shot SFX
  playFootstep() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const buffer = this._shortNoise(0.06);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 350;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(lp).connect(g).connect(this.sfxGain);
    src.start();
  }

  playJump() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.sfxGain);
    o.start();
    o.stop(t + 0.3);
  }

  playLand() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const buffer = this._shortNoise(0.15);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(lp).connect(g).connect(this.sfxGain);
    src.start();
  }

  playInteract() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(440, t);
    o.frequency.linearRampToValueAtTime(660, t + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.sfxGain);
    o.start();
    o.stop(t + 0.2);
  }

  playSwitch() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Quick shimmer down-up
    for (const [pitch, delay] of [[523, 0], [659, 0.04], [784, 0.08]]) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = pitch;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + delay);
      g.gain.linearRampToValueAtTime(0.12, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.2);
      o.connect(g).connect(this.sfxGain);
      o.start(t + delay);
      o.stop(t + delay + 0.22);
    }
  }

  playAbility() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Rising chime + sparkle
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 1.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3000;
    o.connect(lp).connect(g).connect(this.sfxGain);
    o.start();
    o.stop(t + 1.7);
    // High sparkle
    for (let i = 0; i < 6; i++) {
      const so = this.ctx.createOscillator();
      so.type = "sine";
      so.frequency.value = 1200 + Math.random() * 1800;
      const sg = this.ctx.createGain();
      sg.gain.setValueAtTime(0, t + 0.3 + i * 0.05);
      sg.gain.linearRampToValueAtTime(0.06, t + 0.32 + i * 0.05);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 + i * 0.05);
      so.connect(sg).connect(this.sfxGain);
      so.start(t + 0.3 + i * 0.05);
      so.stop(t + 0.6 + i * 0.05);
    }
  }

  playVighnaBreak() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Deep impact + shatter
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g).connect(this.sfxGain);
    o.start();
    o.stop(t + 1.0);
    // Shatter noise
    const buffer = this._shortNoise(0.4);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    bp.Q.value = 1.5;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.25, t + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(bp).connect(sg).connect(this.sfxGain);
    src.start(t + 0.05);
  }

  playBossRoar() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(60, t);
    o.frequency.linearRampToValueAtTime(45, t + 1.8);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 280;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    o.connect(lp).connect(g).connect(this.sfxGain);
    o.start();
    o.stop(t + 2.1);
  }

  _shortNoise(durationSec) {
    const len = Math.floor(this.ctx.sampleRate * durationSec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    return buf;
  }

  /** Stop everything and release context. */
  dispose() {
    this.stopRain();
    this.stopAmbience();
    this.stopTempleBells();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
    }
  }
}

export const audioManager = new AudioManager();
export default AudioManager;
