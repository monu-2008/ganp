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
    // Show cinematic letterbox.
    this.letterTop.classList.remove("hidden");
    this.letterBottom.classList.remove("hidden");

    // Festival color grade (warm).
    this.postProcess?.setGrade("festival", true);

    // Start rain + ambience.
    this.audio.startRain(0.6);
    this.audio.startAmbience();
    this.audio.startTempleBells(12000);
    this.rain.setIntensity(0.7);

    // Hide hero until reveal.
    this.hero.root.visible = false;

    // Cinematic camera flight through the festival.
    this.camera.playCinematic([
      { time: 0,   pos: [-12, 6, 18],   look: [0, 2, 12],  fov: 50 },
      { time: 3.0, pos: [-6, 4, 12],    look: [0, 2, 10],  fov: 45 },
      { time: 6.0, pos: [3, 3.5, 6],    look: [0, 1.5, 8], fov: 42 },
      { time: 9.0, pos: [0, 4.5, 0],    look: [0, 2, 12],  fov: 50 },
    ]);

    // Subtitles.
    await this._showSubtitle("The night of Ganesh Chaturthi…", 2500);
    await waitFor(800);
    await this._showSubtitle("Rain washes the streets. Bells ring in the distance.", 3000);
    await waitFor(800);
    await this._showSubtitle("And then — something is wrong.", 2500);

    // ===== TIME FREEZE =====
    // Switch to cold desaturated grade with chromatic aberration.
    this.postProcess?.setGrade("time_freeze");
    this.audio.setRainIntensity(0.1);
    this.audio.stopTempleBells();
    await waitFor(400);
    // Freeze rain.
    this.rain.freeze();
    // Screen flash + chromatic aberration pulse on the freeze moment.
    this.postProcess?.flash(0xffe080, 0.5, 0.6);
    await waitFor(500);
    await this._showSubtitle("The rain… stops.", 2000);
    // Manifest Vighna cracks (visual + audio).
    for (const crack of this.world.vighnaCracks) {
      const id = crack.mesh.userData.crackId;
      this.world.activateVighnaCrack(id);
      this.particles.spawn("intro_vighna_" + id, { color: 0xc02020, size: 0.07, gravity: -0.4, drift: 0.7, life: 4.0, blending: THREE.AdditiveBlending, texture: "soft" },
        crack.mesh.position, 16, { spread: 1.0, vy: 0.5 });
      this.audio.playBell(196);
      // Each crack causes a small chromatic aberration pulse.
      this.postProcess?.flash(0x602020, 0.25, 0.3);
      await waitFor(400);
    }
    await waitFor(500);
    await this._showSubtitle("A Vighna — an obstacle — splits the world.", 2800);

    // ===== GANESH REVEAL =====
    // Move the hero to the mandap seat.
    this.hero.root.visible = true;
    this.hero.setPosition(0, 0, 12);
    this.hero.setRotation(0);
    this.hero.play("HeroPose", { fade: 0.2, loop: true });
    // Spawn petals and divine particles.
    this.particles.spawn("reveal_petals", { color: 0xffc060, size: 0.10, gravity: -1.0, drift: 1.0, life: 6.0, blending: THREE.NormalBlending, texture: "petal" },
      new THREE.Vector3(0, 5, 12), 60, { spread: 4.0, vy: -0.5 });
    this.particles.spawn("reveal_divine", { color: 0xffd080, size: 0.08, gravity: 0.4, drift: 0.4, life: 3.0, blending: THREE.AdditiveBlending, texture: "soft" },
      new THREE.Vector3(0, 2, 12), 80, { spread: 2.0, vy: 1.0 });
    this.vfx.spawnGodRay(new THREE.Vector3(0, 0, 12), 3.0);
    this.audio.playAbility();
    this.audio.playBell(220);
    // Big bloom flash for the reveal.
    this.postProcess?.flash(0xffe080, 0.7, 0.8);
    // Switch back to warm grade.
    this.postProcess?.setGrade("festival");
    await waitFor(800);
    await this._showSubtitle("Vighnaharta — the remover of obstacles — appears.", 3000);

    // Slow cinematic push toward the hero.
    this.camera.playCinematic([
      { time: 0,   pos: [3, 5, 16],  look: [0, 1.5, 12], fov: 45 },
      { time: 2.5, pos: [2, 2.6, 14], look: [0, 1.4, 12], fov: 38 },
      { time: 4.0, pos: [0, 2.4, 13],look: [0, 1.5, 12], fov: 36 },
    ]);
    await waitFor(4200);

    // Hide letterbox + give control back to the player.
    this.letterTop.classList.add("hidden");
    this.letterBottom.classList.add("hidden");
    this._hideSubtitle();
    this.camera.stopCinematic();
    this.camera.setMode(CAMERA_MODE.GAMEPLAY);
    this.camera.setTarget(0, 1.2, 12);
    // Unfreeze rain.
    this.rain.unfreeze();
    this.audio.setRainIntensity(0.5);

    this.playing = false;
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
}

export default IntroScene;
