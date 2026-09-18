// ============================================================
// gameplay/BossSystem.js
// Kaal-Vighna boss: a puzzle-like encounter in phases.
// ============================================================

import * as THREE from "three";
import { PARTICLE_PRESET } from "../effects/ParticleSystem.js";
import { VighnaSystem } from "./VighnaSystem.js";
import { assetManager } from "../core/AssetManager.js";

export const BOSS_PHASE = {
  DORMANT: "dormant",
  INTRO: "intro",
  PHASE_1: "phase_1",          // observe attacks
  PHASE_2: "phase_2",          // traverse arena
  PHASE_3: "phase_3",          // use environment (Mooshak tunnel)
  PHASE_4: "phase_4",          // activate mechanisms
  PHASE_5: "phase_5",          // trigger Vighna Break
  DEFEATED: "defeated",
};

export class BossSystem {
  constructor({ world, vighna, particles, vfx, audio, cameraManager, scene, memory, postProcess }) {
    this.world = world;
    this.vighna = vighna;
    this.particles = particles;
    this.vfx = vfx;
    this.audio = audio;
    this.camera = cameraManager;
    this.scene = scene;
    this.memory = memory;
    this.postProcess = postProcess;
    this.phase = BOSS_PHASE.DORMANT;
    this.boss = null;
    this.mechanismsActivated = 0;
    this.totalMechanisms = 3;
    this.bossDefeated = false;
    this.onDefeated = null;
    this._bossTime = 0;
  }

  /** Build the boss at the temple plaza — loads the Kaal-Vighna GLB. */
  async buildBoss() {
    if (this.boss) return;
    let glbScene = null;
    try {
      const gltf = await assetManager.loadGLB("villain/kaal_vighna.glb");
      glbScene = gltf.scene;
      console.log("[Boss] Kaal-Vighna GLB loaded");
    } catch (e) {
      console.warn("[Boss] GLB load failed, falling back to procedural:", e);
    }

    const grp = new THREE.Group();
    grp.position.set(0, 0, -38);

    if (glbScene) {
      // Use the GLB model.
      // Scale so the boss is ~6m tall.
      const box = new THREE.Box3().setFromObject(glbScene);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0.001) {
        const scale = 6.0 / size.y;
        glbScene.scale.setScalar(scale);
        glbScene.position.x -= (box.min.x + box.max.x) * 0.5 * scale;
        glbScene.position.z -= (box.min.z + box.max.z) * 0.5 * scale;
        glbScene.position.y -= box.min.y * scale;
      }
      glbScene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      grp.add(glbScene);
      this.bodyMat = null;  // GLB has its own materials.
      this.crackMat = null;
    } else {
      // Procedural fallback (the old buildBoss code).
      this._buildProceduralBoss(grp);
    }

    // Three "mechanisms" around the boss (pillars to activate).
    this.mechanisms = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const mech = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 2.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7, emissive: 0x000000 }),
      );
      mech.position.set(Math.cos(a) * 5, 1.0, -38 + Math.sin(a) * 5);
      mech.castShadow = true;
      mech.userData.isMechanism = true;
      mech.userData.activated = false;
      mech.userData.id = i;
      this.scene.add(mech);
      this.mechanisms.push(mech);
    }
    this.scene.add(grp);
    this.boss = grp;
  }

  /** Procedural fallback boss (only used if GLB fails). */
  _buildProceduralBoss(grp) {
    const bodyGeo = new THREE.CylinderGeometry(1.8, 2.2, 4.5, 12, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x181010, roughness: 0.95,
      emissive: 0x601020, emissiveIntensity: 0.4, metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 2.5;
    body.castShadow = true;
    grp.add(body);
    this.bodyMat = bodyMat;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 12),
      bodyMat,
    );
    head.position.y = 5.5;
    head.castShadow = true;
    grp.add(head);
    for (const sign of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.25, 1.5, 8),
        bodyMat,
      );
      horn.position.set(sign * 0.4, 6.5, 0);
      horn.rotation.z = sign * 0.4;
      grp.add(horn);
    }
    for (let i = 0; i < 6; i++) {
      const crackGeo = new THREE.BoxGeometry(0.05, 1.5, 0.05);
      const crackMat = new THREE.MeshBasicMaterial({ color: 0xff2030 });
      const crack = new THREE.Mesh(crackGeo, crackMat);
      const a = (i / 6) * Math.PI * 2;
      crack.position.set(Math.cos(a) * 1.6, 2.5 + Math.sin(i) * 0.5, Math.sin(a) * 1.6);
      crack.rotation.y = a;
      grp.add(crack);
    }
    for (const sign of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, 3.0, 8),
        bodyMat,
      );
      arm.position.set(sign * 2.4, 3.0, 0);
      arm.rotation.z = sign * 0.4;
      arm.castShadow = true;
      grp.add(arm);
    }
    for (const sign of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2030 }),
      );
      eye.position.set(sign * 0.3, 5.7, 0.85);
      grp.add(eye);
    }
    this.cracks = grp.children.filter(c => c.material && c.material.isMeshBasicMaterial);
    this.crackMat = this.cracks[0]?.material;
  }

  /** Begin the boss intro cinematic. */
  async startIntro() {
    if (this.phase !== BOSS_PHASE.DORMANT) return;
    this.phase = BOSS_PHASE.INTRO;
    this.postProcess?.setGrade("boss");
    this.audio.playBossRoar();
    this.camera.shake(0.4, 1.5);
    this.postProcess?.flash(0x801020, 0.6, 0.8);
    for (let i = 0; i < 5; i++) {
      this.particles.spawn("boss_vighna_" + i, PARTICLE_PRESET.VIGHNA,
        this.boss.position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4)),
        10, { spread: 1.5 });
    }
    await this._wait(2.0);
    this.phase = BOSS_PHASE.PHASE_1;
    this.onPhaseChange?.(this.phase);
  }

  /** Player activates a mechanism (by reaching it and pressing interact). */
  activateMechanism(mechMesh) {
    if (this.phase === BOSS_PHASE.DORMANT || this.phase === BOSS_PHASE.INTRO) return false;
    if (this.phase === BOSS_PHASE.DEFEATED) return false;
    if (mechMesh.userData.activated) return false;
    mechMesh.userData.activated = true;
    mechMesh.material.emissive.setHex(0xffc966);
    mechMesh.material.emissiveIntensity = 0.6;
    this.mechanismsActivated++;
    this.audio.playBell(330);
    this.vfx.spawnEnergyRing(mechMesh.position.clone().add(new THREE.Vector3(0, 1, 0)),
      { color: 0xffc966, maxRadius: 2.0, duration: 1.0 });
    this.postProcess?.flash(0xffc966, 0.4, 0.5);
    if (this.mechanismsActivated >= this.totalMechanisms) {
      this.phase = BOSS_PHASE.PHASE_5;
      this.onPhaseChange?.(this.phase);
      setTimeout(() => this._defeatBoss(), 800);
    } else if (this.mechanismsActivated === 1) {
      this.phase = BOSS_PHASE.PHASE_3;
      this.onPhaseChange?.(this.phase);
    } else if (this.mechanismsActivated === 2) {
      this.phase = BOSS_PHASE.PHASE_4;
      this.onPhaseChange?.(this.phase);
    }
    return true;
  }

  async _defeatBoss() {
    if (this.bossDefeated) return;
    this.phase = BOSS_PHASE.DEFEATED;
    this.bossDefeated = true;
    this.postProcess?.setGrade("vighna_break");
    this.audio.playVighnaBreak();
    this.camera.shake(0.6, 1.0);
    this.postProcess?.flash(0xffe080, 0.9, 0.8);
    this.vfx.spawnVighnaBreak(this.boss.position.clone().add(new THREE.Vector3(0, 2, 0)));
    if (this.memory.hasBossBonus()) {
      this.audio.playBell(660);
      this.postProcess?.flash(0xffd080, 0.5, 0.4);
    }
    await this._wait(0.5);
    this._bossDissolving = true;
    this._dissolveT = 0;
    setTimeout(() => {
      this.postProcess?.setGrade("festival");
    }, 2000);
    this.onDefeated?.();
  }

  _wait(s) {
    return new Promise((r) => setTimeout(r, s * 1000));
  }

  update(dt) {
    this._bossTime += dt;
    if (!this.boss) return;
    if (!this.bossDefeated) {
      this.boss.position.x = Math.sin(this._bossTime * 0.7) * 0.2;
      this.boss.position.y = Math.sin(this._bossTime * 1.2) * 0.05;
    }
    if (this.crackMat) {
      const pulse = 0.5 + Math.sin(this._bossTime * 4) * 0.4;
      this.crackMat.color.setRGB(1.0, 0.13 + pulse * 0.2, 0.2);
    }
    if (this._bossDissolving) {
      this._dissolveT += dt;
      const p = Math.min(1, this._dissolveT / 1.5);
      this.boss.scale.setScalar(1 + p * 0.4);
      if (this.bodyMat) {
        this.bodyMat.opacity = 1 - p;
        this.bodyMat.transparent = true;
      }
      if (Math.random() > 0.6) {
        this.particles.spawn("boss_dissolve", PARTICLE_PRESET.PURIFY,
          this.boss.position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 4, Math.random() * 5, (Math.random() - 0.5) * 4)),
          2, { spread: 0.5 });
      }
      if (p >= 1) {
        this.scene.remove(this.boss);
        this._bossDissolving = false;
      }
    }
  }

  dispose() {
    if (this.boss) {
      this.scene.remove(this.boss);
      this.boss.traverse((o) => {
        if (o.isMesh) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        }
      });
      this.boss = null;
    }
    if (this.mechanisms) {
      for (const m of this.mechanisms) {
        this.scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
      }
      this.mechanisms = [];
    }
  }
}

export default BossSystem;
