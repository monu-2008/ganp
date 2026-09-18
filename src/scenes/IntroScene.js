// ============================================================
// scenes/IntroScene.js
// Cinematic intro: rain, distant bell, city reveal, time-freeze, Ganesh reveal.
// Drives the CameraManager + AudioManager + RainSystem.
// ============================================================

import * as THREE from "three";
import { CAMERA_MODE } from "../camera/CameraManager.js";
import { waitFor, easeInOut, easeOutCubic } from "../utils/Helpers.js";

export class IntroScene {
  constructor({ cameraManager, audio, rain, particles, hud, vfx, questSystem, hero, world, postProcess }) {
    this.camera = cameraManager;
    this.audio = audio;
    this.rain = rain;
    this.particles = particles;
    this.hud = hud;
    this.vfx = vfx;
    this.quest = questSystem;
    this.hero = hero;
    this.world = world;
    this.postProcess = postProcess;
    this.playing = false;
    this.subtitleEl = document.getElementById("subtitle-bar");
    this.letterTop = document.getElementById("cinematic-letterbox-top");
    this.letterBottom = document.getElementById("cinematic-letterbox-bottom");
  }

  async play(onComplete) {
    if (this.playing) return;
    this.playing = true;
    console.log("[Intro] Starting intro cinematic");

    // Show cinematic letterbox.
    this.letterTop.classList.remove("hidden");
    this.letterBottom.classList.remove("hidden");
    this.postProcess?.setGrade("festival", true);

    // Start rain + ambience.
    try { this.audio.startRain(0.6); } catch (e) {}
    try { this.audio.startAmbience(); } catch (e) {}
    try { this.audio.startTempleBells(12000); } catch (e) {}
    this.rain.setIntensity(0.7);

    // Hide hero until reveal.
    this.hero.root.visible = false;

    // Cinematic camera flight through the festival (shortened).
    this.camera.playCinematic([
      { time: 0,   pos: [-8, 5, 16],   look: [0, 2, 12],  fov: 50 },
      { time: 4.0, pos: [3, 3.5, 6],    look: [0, 1.5, 8], fov: 42 },
    ]);

    // Brief subtitle.
    await this._showSubtitle("The night of Ganesh Chaturthi…", 2000);
    console.log("[Intro] Subtitle 1 done");

    // ===== TIME FREEZE =====
    try { this.postProcess?.setGrade("time_freeze"); } catch (e) {}
    try { this.audio.setRainIntensity(0.1); } catch (e) {}
    try { this.audio.stopTempleBells(); } catch (e) {}
    await waitFor(300);
    this.rain.freeze();
    try { this.postProcess?.flash(0xffe080, 0.3, 0.4); } catch (e) {}
    await this._showSubtitle("The rain… stops.", 1500);
    console.log("[Intro] Time-freeze done, manifesting cracks");

    // Manifest Vighna cracks.
    for (const crack of this.world.vighnaCracks) {
      const id = crack.mesh.userData.crackId;
      this.world.activateVighnaCrack(id);
      this.particles.spawn("intro_vighna_" + id, { color: 0xc02020, size: 0.07, gravity: -0.4, drift: 0.7, life: 4.0, blending: THREE.AdditiveBlending, texture: "soft" },
        crack.mesh.position, 12, { spread: 1.0, vy: 0.5 });
      try { this.audio.playBell(196); } catch (e) {}
      await waitFor(200);
    }
    console.log("[Intro] Cracks manifested, revealing Ganesh");

    // ===== GANESH REVEAL =====
    this.hero.root.visible = true;
    this.hero.setPosition(0, 0, 12);
    this.hero.setRotation(0);
    this.hero.play("HeroPose", { fade: 0.2, loop: true });
    this.particles.spawn("reveal_petals", { color: 0xffc060, size: 0.10, gravity: -1.0, drift: 1.0, life: 6.0, blending: THREE.NormalBlending, texture: "petal" },
      new THREE.Vector3(0, 5, 12), 20, { spread: 4.0, vy: -0.5 });
    this.vfx.spawnGodRay(new THREE.Vector3(0, 0, 12), 2.0);
    try { this.audio.playAbility(); } catch (e) {}
    try { this.audio.playBell(220); } catch (e) {}
    try { this.postProcess?.flash(0xffe080, 0.3, 0.5); } catch (e) {}
    try { this.postProcess?.setGrade("festival"); } catch (e) {}
    await this._showSubtitle("Vighnaharta — the remover of obstacles — appears.", 2500);
    console.log("[Intro] Reveal done");

    // Hide letterbox + give control back to the player.
    this.letterTop.classList.add("hidden");
    this.letterBottom.classList.add("hidden");
    this._hideSubtitle();
    this.camera.stopCinematic();
    this.camera.setMode(CAMERA_MODE.GAMEPLAY);
    this.camera.setTarget(0, 1.2, 12);
    this.rain.unfreeze();
    try { this.audio.setRainIntensity(0.5); } catch (e) {}

    this.playing = false;
    console.log("[Intro] Intro complete");
    onComplete?.();
  }

  async _showSubtitle(text, duration) {
    return new Promise((resolve) => {
      try {
        if (this.subtitleEl) {
          this.subtitleEl.textContent = text;
          this.subtitleEl.classList.remove("hidden");
        }
      } catch (e) {}
      setTimeout(() => {
        try { this._hideSubtitle(); } catch (e) {}
        resolve();
      }, duration);
    });
  }

  _hideSubtitle() {
    if (this.subtitleEl) {
      this.subtitleEl.classList.add("hidden");
    }
  }
}

export default IntroScene;
