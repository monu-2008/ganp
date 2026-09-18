// ============================================================
// scenes/EndingScene.js
// Riverfront ending cinematic + AQX end card.
// ============================================================

import { waitFor } from "../utils/Helpers.js";

export class EndingScene {
  constructor(game) {
    this.game = game;
    this.endCard = document.getElementById("end-card");
    this.audio = game.audioManager;
    this.camera = game.cameraManager;
    this.particles = game.particles;
    this.vfx = game.vfx;
    this.world = game.world;
    this.hero = game.hero;
    this.postProcess = game.postProcess;
    this.subtitleEl = document.getElementById("subtitle-bar");
    this.letterTop = document.getElementById("cinematic-letterbox-top");
    this.letterBottom = document.getElementById("cinematic-letterbox-bottom");
  }

  async play(onComplete) {
    // Cinematic letterbox.
    this.letterTop.classList.remove("hidden");
    this.letterBottom.classList.remove("hidden");

    // Switch to riverfront grade (deep blue + warm lamp light).
    this.postProcess?.setGrade("riverfront");

    // Restore rain + lamps.
    this.audio.setRainIntensity(0.5);

    // Subtitles.
    await this._showSubtitle("The world returns.", 2500);
    await waitFor(500);
    await this._showSubtitle("Lamps relight. Bells ring. The river welcomes the diyas home.", 3500);
    await waitFor(500);
    await this._showSubtitle("Vighnaharta — remover of obstacles —", 2500);
    await this._showSubtitle("…the river flows on.", 2000);

    // Spawn lots of petals + divine particles.
    const pos = this.hero.root.position;
    for (let i = 0; i < 6; i++) {
      this.particles.spawn("ending_petals_" + i, { color: 0xffc060, size: 0.10, gravity: -1.0, drift: 1.0, life: 6.0, blending: 1, texture: "petal" },
        pos.clone().add({ x: (Math.random() - 0.5) * 6, y: 4 + Math.random() * 3, z: (Math.random() - 0.5) * 6 }),
        12, { spread: 1.0, vy: -0.5 });
      await waitFor(300);
    }
    this.vfx.spawnGodRay(pos, 4.0);
    // Soft golden flash for the ending.
    this.postProcess?.flash(0xffe080, 0.4, 1.0);
    await waitFor(1500);

    // Switch to ending grade (warm cream).
    this.postProcess?.setGrade("ending");
    // Hide letterbox.
    this.letterTop.classList.add("hidden");
    this.letterBottom.classList.add("hidden");
    this._hideSubtitle();

    // Show the end card.
    this.endCard.classList.remove("hidden");
    this.audio.playBell(330);
    setTimeout(() => this.audio.playBell(440), 600);
    setTimeout(() => this.audio.playBell(523), 1200);
    // Final flash for the end card.
    this.postProcess?.flash(0xffe080, 0.6, 0.8);

    onComplete?.();
  }

  async _showSubtitle(text, duration) {
    this.subtitleEl.textContent = text;
    this.subtitleEl.classList.remove("hidden");
    await waitFor(duration);
    this._hideSubtitle();
  }

  _hideSubtitle() {
    this.subtitleEl.classList.add("hidden");
  }

  hide() {
    this.endCard.classList.add("hidden");
  }
}

export default EndingScene;
