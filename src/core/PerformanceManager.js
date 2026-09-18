// ============================================================
// core/PerformanceManager.js
// Quality tiers (Performance / Balanced / Ultra) with auto-detection.
// ============================================================

import * as THREE from "three";
import { isMobile } from "../utils/Helpers.js";

export const QUALITY = {
  PERFORMANCE: "performance",
  BALANCED: "balanced",
  ULTRA: "ultra",
};

const SETTINGS = {
  [QUALITY.PERFORMANCE]: {
    pixelRatioCap: 1.0,
    shadowMapSize: 1024,
    shadowEnabled: false,
    maxParticles: 200,
    maxRainDrops: 400,
    fogEnabled: true,
    antialias: false,
    toneMappingExposure: 1.1,
    lodDistances: [4, 10, 9999], // aggressive LOD
    npcLodEnabled: true,
    npcCountCap: 12,
    bloomEnabled: true,  // Keep bloom on for visual quality (low cost on modern GPUs).
    envMapIntensity: 0.4,
    powerPreference: "low-power",
  },
  [QUALITY.BALANCED]: {
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    shadowEnabled: true,
    maxParticles: 500,
    maxRainDrops: 900,
    fogEnabled: true,
    antialias: true,
    toneMappingExposure: 1.05,
    lodDistances: [8, 18, 9999],
    npcLodEnabled: true,
    npcCountCap: 20,
    bloomEnabled: true,
    envMapIntensity: 0.7,
    powerPreference: "high-performance",
  },
  [QUALITY.ULTRA]: {
    pixelRatioCap: 2.0,
    shadowMapSize: 2048,
    shadowEnabled: true,
    maxParticles: 1000,
    maxRainDrops: 1800,
    fogEnabled: true,
    antialias: true,
    toneMappingExposure: 1.0,
    lodDistances: [12, 24, 9999],
    npcLodEnabled: true,
    npcCountCap: 30,
    bloomEnabled: true,
    envMapIntensity: 1.0,
    powerPreference: "high-performance",
  },
};

const STORAGE_KEY = "ganesh_vighna_quality";

export class PerformanceManager {
  constructor() {
    this.quality = QUALITY.BALANCED;
    this.settings = SETTINGS[this.quality];
    this.renderer = null;
    this.fpsHistory = [];
    this.lastAutoAdjust = 0;
  }

  /** Auto-detect initial quality based on device. */
  detectInitialQuality() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SETTINGS[stored]) {
      this.quality = stored;
      this.settings = SETTINGS[stored];
      return;
    }
    if (isMobile()) {
      // Mobile defaults to balanced; performance mode if very low-end.
      const cores = navigator.hardwareConcurrency || 4;
      if (cores <= 4) this.quality = QUALITY.PERFORMANCE;
      else this.quality = QUALITY.BALANCED;
    } else {
      this.quality = QUALITY.BALANCED;
    }
    this.settings = SETTINGS[this.quality];
  }

  setQuality(q) {
    if (!SETTINGS[q]) return;
    this.quality = q;
    this.settings = SETTINGS[q];
    localStorage.setItem(STORAGE_KEY, q);
    this.applyToRenderer();
  }

  attachRenderer(renderer) {
    this.renderer = renderer;
    this.applyToRenderer();
  }

  applyToRenderer() {
    if (!this.renderer) return;
    const s = this.settings;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, s.pixelRatioCap));
    this.renderer.shadowMap.enabled = s.shadowEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = s.toneMappingExposure;
    this.renderer.antialias = s.antialias;
  }

  /** Track FPS for adaptive degradation. Call every frame. */
  trackFrame(dt) {
    if (dt <= 0) return;
    const fps = 1 / dt;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) this.fpsHistory.shift();
  }

  getAverageFPS() {
    if (this.fpsHistory.length === 0) return 60;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return sum / this.fpsHistory.length;
  }

  /** Periodically check if we should drop quality (call every 5s). */
  maybeAutoAdjust(now) {
    if (now - this.lastAutoAdjust < 5000) return;
    this.lastAutoAdjust = now;
    const fps = this.getAverageFPS();
    if (this.quality === QUALITY.ULTRA && fps < 35) {
      this.setQuality(QUALITY.BALANCED);
      console.log("[Perf] Dropped to Balanced (avg fps:", fps.toFixed(1) + ")");
    } else if (this.quality === QUALITY.BALANCED && fps < 25 && isMobile()) {
      this.setQuality(QUALITY.PERFORMANCE);
      console.log("[Perf] Dropped to Performance (avg fps:", fps.toFixed(1) + ")");
    }
  }

  get maxParticles() { return this.settings.maxParticles; }
  get maxRainDrops() { return this.settings.maxRainDrops; }
  get lodDistances() { return this.settings.lodDistances; }
  get npcCountCap() { return this.settings.npcCountCap; }
  get shadowMapSize() { return this.settings.shadowMapSize; }
  get shadowEnabled() { return this.settings.shadowEnabled; }
  get fogEnabled() { return this.settings.fogEnabled; }
  get bloomEnabled() { return this.settings.bloomEnabled; }
  get envMapIntensity() { return this.settings.envMapIntensity; }
}

export const performanceManager = new PerformanceManager();
export default PerformanceManager;
