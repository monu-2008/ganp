// ============================================================
// effects/RainSystem.js
// GPU-friendly rain using a single BufferGeometry of points that
// recycles itself around the camera. Supports time-freeze.
// ============================================================

import * as THREE from "three";
import { performanceManager } from "../core/PerformanceManager.js";

export class RainSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.drops = null;
    this.frozen = false;
    this.intensity = 0.7;
    this.maxDrops = performanceManager.maxRainDrops;
    this._build();
  }

  _build() {
    const count = this.maxDrops;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const area = 24;
    this.area = area;
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * area;
      positions[i * 3 + 1] = Math.random() * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * area;
      velocities[i] = 18 + Math.random() * 12;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.velocities = velocities;
    this.geo = geo;
    // Stretched line material (vertical streaks).
    const mat = new THREE.LineBasicMaterial({
      color: 0xa8c0d8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    // Build line segments: each drop is a short vertical line.
    // We store pairs (top, bottom) of vertices.
    const segPositions = new Float32Array(count * 6);
    geo.setAttribute("position", new THREE.BufferAttribute(segPositions, 3));
    this.segPositions = segPositions;
    this.drops = new THREE.LineSegments(geo, mat);
    this.drops.frustumCulled = false;  // we recycle around camera
    this.drops.renderOrder = 5;
    this.scene.add(this.drops);
  }

  setIntensity(v) {
    this.intensity = v;
    if (this.drops) {
      this.drops.material.opacity = 0.2 + v * 0.4;
    }
  }

  freeze() {
    this.frozen = true;
  }

  unfreeze() {
    this.frozen = false;
  }

  update(dt) {
    if (!this.drops) return;
    const positions = this.segPositions;
    const cam = this.camera.position;
    const area = this.area;
    const halfArea = area * 0.5;
    const dropLen = 0.35;
    const visibleCount = Math.floor(this.maxDrops * this.intensity);

    if (!this.frozen) {
      for (let i = 0; i < this.maxDrops; i++) {
        let x = positions[i * 6 + 0];
        let y = positions[i * 6 + 1];
        let z = positions[i * 6 + 2];
        if (x === 0 && y === 0 && z === 0) {
          // Initialize from the original positions array (lazy).
          x = (Math.random() - 0.5) * area;
          y = Math.random() * 18;
          z = (Math.random() - 0.5) * area;
        }
        const v = this.velocities[i] || 20;
        y -= v * dt;
        // Recycle when below ground.
        if (y < 0) {
          // Spawn a splash particle occasionally.
          if (Math.random() > 0.85 && this.onSplash) {
            this.onSplash(x, 0, z);
          }
          y = 14 + Math.random() * 4;
          x = (Math.random() - 0.5) * area;
          z = (Math.random() - 0.5) * area;
        }
        // Recenter around camera (only when far away).
        const dx = x - (cam.x - halfArea + area * 0.5);
        if (dx > halfArea) x -= area;
        else if (dx < -halfArea) x += area;
        const dz = z - (cam.z - halfArea + area * 0.5);
        if (dz > halfArea) z -= area;
        else if (dz < -halfArea) z += area;
        // Write top and bottom vertices.
        const opacityFactor = i < visibleCount ? 1 : 0;
        if (opacityFactor > 0) {
          positions[i * 6 + 0] = x;
          positions[i * 6 + 1] = y;
          positions[i * 6 + 2] = z;
          positions[i * 6 + 3] = x;
          positions[i * 6 + 4] = y - dropLen;
          positions[i * 6 + 5] = z;
        } else {
          // Hide by collapsing to a single point offscreen.
          positions[i * 6 + 0] = 0;
          positions[i * 6 + 1] = -100;
          positions[i * 6 + 2] = 0;
          positions[i * 6 + 3] = 0;
          positions[i * 6 + 4] = -100;
          positions[i * 6 + 5] = 0;
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  dispose() {
    if (this.drops) {
      this.scene.remove(this.drops);
      this.geo.dispose();
      this.drops.material.dispose();
      this.drops = null;
    }
  }
}

export default RainSystem;
