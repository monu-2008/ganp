// ============================================================
// effects/ParticleSystem.js
// Generic GPU-friendly particle system for petals, sparks, energy,
// divine motes, Vighna particles. Single BufferGeometry + Points.
// ============================================================

import * as THREE from "three";
import { performanceManager } from "../core/PerformanceManager.js";

export const PARTICLE_PRESET = {
  PETALS: {
    color: 0xffc060, size: 0.10, gravity: -1.0, drift: 1.0, life: 6.0,
    blending: THREE.NormalBlending, texture: "petal",
  },
  DIVINE: {
    color: 0xffd080, size: 0.08, gravity: 0.4, drift: 0.4, life: 3.0,
    blending: THREE.AdditiveBlending, texture: "soft",
  },
  VIGHNA: {
    color: 0xc02020, size: 0.07, gravity: -0.4, drift: 0.7, life: 4.0,
    blending: THREE.AdditiveBlending, texture: "soft",
  },
  SPARKS: {
    color: 0xffaa50, size: 0.05, gravity: -8.0, drift: 0.2, life: 0.8,
    blending: THREE.AdditiveBlending, texture: "soft",
  },
  ENERGY: {
    color: 0xffe0a0, size: 0.06, gravity: 0.0, drift: 0.3, life: 2.0,
    blending: THREE.AdditiveBlending, texture: "soft",
  },
  MIST: {
    color: 0xa8a8b8, size: 0.6, gravity: 0.0, drift: 0.4, life: 8.0,
    blending: THREE.NormalBlending, texture: "soft",
  },
  PURIFY: {
    color: 0xfff0c0, size: 0.10, gravity: 1.2, drift: 0.2, life: 4.0,
    blending: THREE.AdditiveBlending, texture: "soft",
  },
};

// Build a circular sprite texture procedurally via canvas.
function makeSpriteTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makePetalTexture() {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffc060";
  ctx.beginPath();
  ctx.ellipse(16, 16, 8, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8030";
  ctx.beginPath();
  ctx.ellipse(16, 18, 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

export class ParticleSystem {
  constructor(scene, max = null) {
    this.scene = scene;
    this.max = max || performanceManager.maxParticles;
    this.systems = new Map();  // name -> { points, positions, velocities, life, ages, count, geo, mat }
    this._softTexture = makeSpriteTexture();
    this._petalTexture = makePetalTexture();
  }

  /** Spawn a burst of particles at a position. */
  spawn(name, preset, position, count = 20, opts = {}) {
    if (!this.systems.has(name)) {
      this._create(name, preset, Math.min(count * 4, this.max));
    }
    const sys = this.systems.get(name);
    const max = sys.max;
    for (let i = 0; i < count; i++) {
      const idx = sys.cursor % max;
      sys.cursor++;
      sys.positions[idx * 3 + 0] = position.x + (Math.random() - 0.5) * (opts.spread || 0.5);
      sys.positions[idx * 3 + 1] = position.y + (Math.random() - 0.5) * (opts.spreadY || 0.5);
      sys.positions[idx * 3 + 2] = position.z + (Math.random() - 0.5) * (opts.spread || 0.5);
      sys.velocities[idx * 3 + 0] = (Math.random() - 0.5) * preset.drift * 2 + (opts.vx || 0);
      sys.velocities[idx * 3 + 1] = (Math.random() - 0.5) * preset.drift + (opts.vy || 0);
      sys.velocities[idx * 3 + 2] = (Math.random() - 0.5) * preset.drift * 2 + (opts.vz || 0);
      sys.ages[idx] = 0;
      sys.alive[idx] = true;
    }
    sys.geo.attributes.position.needsUpdate = true;
    sys.points.visible = true;
  }

  /** Continuous emitter: spawn `count` particles per call (for ambient effects). */
  emit(name, preset, position, count = 4, opts = {}) {
    this.spawn(name, preset, position, count, opts);
  }

  _create(name, preset, capacity) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(capacity * 3);
    const velocities = new Float32Array(capacity * 3);
    const ages = new Float32Array(capacity);
    const alive = new Uint8Array(capacity);
    for (let i = 0; i < capacity; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = -1000;   // hidden
      positions[i * 3 + 2] = 0;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const tex = preset.texture === "petal" ? this._petalTexture : this._softTexture;
    const mat = new THREE.PointsMaterial({
      color: preset.color,
      size: preset.size,
      map: tex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: preset.blending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.systems.set(name, {
      points, geo, mat, positions, velocities, ages, alive,
      max: capacity, cursor: 0, preset,
    });
  }

  update(dt) {
    this.systems.forEach((sys) => {
      if (!sys.points.visible) return;
      const { positions, velocities, ages, alive, max, preset } = sys;
      let anyAlive = false;
      for (let i = 0; i < max; i++) {
        if (!alive[i]) continue;
        ages[i] += dt;
        if (ages[i] > preset.life) {
          alive[i] = false;
          positions[i * 3 + 1] = -1000;
          continue;
        }
        anyAlive = true;
        // Apply gravity + drift.
        velocities[i * 3 + 1] += preset.gravity * dt;
        positions[i * 3 + 0] += velocities[i * 3 + 0] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      }
      sys.geo.attributes.position.needsUpdate = true;
      if (!anyAlive) sys.points.visible = false;
    });
  }

  clear(name) {
    if (!this.systems.has(name)) return;
    const sys = this.systems.get(name);
    for (let i = 0; i < sys.max; i++) {
      sys.alive[i] = false;
      sys.positions[i * 3 + 1] = -1000;
    }
    sys.geo.attributes.position.needsUpdate = true;
    sys.points.visible = false;
  }

  clearAll() {
    this.systems.forEach((_, name) => this.clear(name));
  }

  dispose() {
    this.systems.forEach((sys) => {
      this.scene.remove(sys.points);
      sys.geo.dispose();
      sys.mat.dispose();
    });
    this.systems.clear();
    this._softTexture.dispose();
    this._petalTexture.dispose();
  }
}

export default ParticleSystem;
