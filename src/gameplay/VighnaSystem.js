// ============================================================
// gameplay/VighnaSystem.js
// Manages supernatural Vighna cracks, time-freeze event, and the
// Vighna Break cinematic sequence.
// ============================================================

import * as THREE from "three";
import { VFXManager } from "../effects/VFXManager.js";
import { PARTICLE_PRESET } from "../effects/ParticleSystem.js";

export const VIGHNA_STATE = {
  DORMANT: "dormant",       // not yet triggered
  MANIFESTING: "manifesting", // cracks appearing, world freezing
  ACTIVE: "active",          // fully manifested
  BREAKING: "breaking",      // Vighna Break cinematic in progress
  PURIFIED: "purified",      // broken; world restored
};

export class VighnaSystem {
  constructor({ world, particles, vfx, audioManager, cameraManager, scene, postProcess }) {
    this.world = world;
    this.particles = particles;
    this.vfx = vfx;
    this.audio = audioManager;
    this.camera = cameraManager;
    this.scene = scene;
    this.postProcess = postProcess;
    this.state = VIGHNA_STATE.DORMANT;
    this.cracksManifested = [];
    this.timeFrozen = false;
    this.breakProgress = 0;
    this.onManifest = null;
    this.onBreakComplete = null;
  }

  /** Trigger the initial time-freeze + Vighna manifestation. */
  async triggerManifestation() {
    if (this.state !== VIGHNA_STATE.DORMANT) return;
    this.state = VIGHNA_STATE.MANIFESTING;
    this.onManifest?.();

    // 1. Lights flicker out (handled by world.freezeWorld after a delay).
    await this._wait(0.5);
    this.audio.setRainIntensity(0.15);
    // Switch to cold desaturated grade with chromatic aberration.
    this.postProcess?.setGrade("time_freeze");
    await this._wait(1.0);

    // 2. Freeze rain.
    this.timeFrozen = true;
    // Tell the RainSystem to freeze (via callback set by Game).
    this.onTimeFreeze?.(true);

    // 3. Freeze the world (NPCs, lamps).
    this.world.freezeWorld();

    // 4. Manifest cracks one by one.
    for (const crack of this.world.vighnaCracks) {
      const id = crack.mesh.userData.crackId;
      this.world.activateVighnaCrack(id);
      this.cracksManifested.push(id);
      // Spawn Vighna particles at the crack.
      this.particles.spawn("vighna_manifest_" + id, PARTICLE_PRESET.VIGHNA,
        crack.mesh.position, 16, { spread: 1.0, vy: 0.5 });
      this.audio.playBell(196);
      // Small red flash on each crack.
      this.postProcess?.flash(0x601818, 0.3, 0.4);
      await this._wait(0.4);
    }

    this.state = VIGHNA_STATE.ACTIVE;
    // Spawn the big central crack at the mandap.
    this.world.activateVighnaCrack("crack_1");
  }

  /** Begin the Vighna Break sequence at a given crack. */
  async triggerBreak(crackId) {
    if (this.state === VIGHNA_STATE.BREAKING || this.state === VIGHNA_STATE.PURIFIED) return;
    this.state = VIGHNA_STATE.BREAKING;
    this.breakProgress = 0;

    // Switch to warm Vighna Break grade (saturated, bright).
    this.postProcess?.setGrade("vighna_break");

    // Camera shake + audio sting.
    this.camera.shake(0.5, 0.6);
    this.audio.playVighnaBreak();
    // Big white-gold flash.
    this.postProcess?.flash(0xffe080, 0.8, 0.6);

    // VFX at the crack position.
    const crack = this.world.vighnaCracks.find(c => c.mesh.userData.crackId === crackId);
    if (crack) {
      this.vfx.spawnVighnaBreak(crack.mesh.position);
      // Brief pause for emphasis.
      await this._wait(0.4);
      // Break the crack.
      this.world.breakVighnaCrack(crackId);
      // Second flash on break.
      this.postProcess?.flash(0xffd060, 0.6, 0.4);
    }

    this.state = VIGHNA_STATE.PURIFIED;
    // Restore the world.
    this.world.unfreezeWorld();
    this.timeFrozen = false;
    this.onTimeFreeze?.(false);
    this.audio.setRainIntensity(0.5);
    // Restore festival grade.
    this.postProcess?.setGrade("festival");
    this.onBreakComplete?.();
  }

  /** Check if all cracks have been purified. */
  isFullyPurified() {
    return this.world.vighnaCracks.every(c => c.broken);
  }

  _wait(seconds) {
    return new Promise((r) => setTimeout(r, seconds * 1000));
  }

  update(dt) {
    // Could update crack pulse intensities here if needed.
  }
}

export default VighnaSystem;
