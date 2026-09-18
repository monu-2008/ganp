// ============================================================
// effects/VFXManager.js
// One-shots, world-space effects (energy pulse, vighna crack dissolve, etc.)
// ============================================================

import * as THREE from "three";
import { ParticleSystem, PARTICLE_PRESET } from "./ParticleSystem.js";
import { clamp, easeOutCubic, easeInOut } from "../utils/Helpers.js";

export class VFXManager {
  constructor(scene, particleSystem) {
    this.scene = scene;
    this.particles = particleSystem;
    this.activeEffects = [];  // { update, dispose }
  }

  /** Spawn a divine energy ring expanding outward. */
  spawnEnergyRing(position, opts = {}) {
    const color = opts.color ?? 0xffc966;
    const maxRadius = opts.maxRadius ?? 3.0;
    const duration = opts.duration ?? 1.4;
    const geo = new THREE.RingGeometry(0.05, 0.18, 64);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y += 0.1;
    this.scene.add(ring);
    let t = 0;
    this.activeEffects.push({
      update: (dt) => {
        t += dt;
        const p = clamp(t / duration, 0, 1);
        const r = 0.2 + easeOutCubic(p) * (maxRadius - 0.2);
        ring.scale.setScalar(r);
        mat.opacity = 0.8 * (1 - p);
        if (p >= 1) return true;  // done
        return false;
      },
      dispose: () => {
        this.scene.remove(ring);
        geo.dispose();
        mat.dispose();
      },
    });
    // Particle burst too.
    this.particles.spawn("energy_burst", PARTICLE_PRESET.ENERGY, position, 24, {
      spread: 0.6, vy: 1.0,
    });
  }

  /** Crack dissolving effect (used in Vighna Break). */
  spawnVighnaBreak(position) {
    // Three concentric rings of different colors.
    this.spawnEnergyRing(position, { color: 0xffe080, maxRadius: 2.0, duration: 1.0 });
    setTimeout(() => this.spawnEnergyRing(position, { color: 0xff9050, maxRadius: 3.5, duration: 1.2 }), 100);
    setTimeout(() => this.spawnEnergyRing(position, { color: 0xffc060, maxRadius: 5.0, duration: 1.6 }), 250);
    // Vighna particles flying outward.
    this.particles.spawn("vighna_break", PARTICLE_PRESET.VIGHNA, position, 40, {
      spread: 1.2, vy: 0.5,
    });
    this.particles.spawn("purify", PARTICLE_PRESET.PURIFY, position, 30, {
      spread: 0.8, vy: 1.5,
    });
  }

  /** God-ray approximation: a soft cone of light. */
  spawnGodRay(position, duration = 2.0) {
    const geo = new THREE.ConeGeometry(2.0, 8.0, 24, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe080,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.copy(position);
    cone.position.y += 4.0;
    cone.rotation.x = Math.PI;
    this.scene.add(cone);
    let t = 0;
    this.activeEffects.push({
      update: (dt) => {
        t += dt;
        const p = clamp(t / duration, 0, 1);
        // Fade in then out.
        const phase = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
        mat.opacity = phase * 0.4;
        return p >= 1;
      },
      dispose: () => {
        this.scene.remove(cone);
        geo.dispose();
        mat.dispose();
      },
    });
    // Continuous petals.
    let petalT = 0;
    this.activeEffects.push({
      update: (dt) => {
        petalT += dt;
        if (petalT > 0.15) {
          this.particles.emit("petals_godray", PARTICLE_PRESET.PETALS,
            position.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 2, 4, (Math.random() - 0.5) * 2)),
            3, { vy: -0.5, spread: 0.4 });
          petalT = 0;
        }
        return t >= duration + 4;  // keep petals falling for a few seconds
      },
      dispose: () => {},
    });
  }

  /** A simple bright flash on screen (not really a world object, but visual). */
  flashScreen(color = 0xffe080, duration = 0.4) {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.7,
      depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.frustumCulled = false;
    // Render at the camera position so it covers the screen.
    plane.position.set(0, 0, -0.5);
    const cameraGroup = new THREE.Group();
    cameraGroup.add(plane);
    // Attach to the camera (in world space approximation).
    this.scene.add(cameraGroup);
    let t = 0;
    this.activeEffects.push({
      update: (dt) => {
        t += dt;
        mat.opacity = 0.7 * (1 - t / duration);
        return t >= duration;
      },
      dispose: () => {
        this.scene.remove(cameraGroup);
        geo.dispose();
        mat.dispose();
      },
    });
  }

  update(dt) {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const fx = this.activeEffects[i];
      const done = fx.update(dt);
      if (done) {
        fx.dispose?.();
        this.activeEffects.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const fx of this.activeEffects) fx.dispose?.();
    this.activeEffects = [];
  }
}

export default VFXManager;
