// ============================================================
// player/HeroCharacter.js
// Abstracts loading, animating, and positioning the Ganesh hero.
// The rest of the game never assumes the exact filename.
// ============================================================

import * as THREE from "three";
import { assetManager } from "../core/AssetManager.js";
import { performanceManager } from "../core/PerformanceManager.js";

// THREE.LOD is exported from the core three module in r169+.
const LOD = THREE.LOD;

// Canonical clip names — the rest of the game talks to the hero via these.
export const HERO_CLIPS = {
  IDLE: "Idle",
  WALK: "Walk",
  RUN: "Run",
  JUMP: "Jump",
  LAND: "Land",
  INTERACTION: "Interaction",
  BLESSING: "Blessing",
  ABILITY: "DivineAbility",
  DAMAGE: "Damage",
  HERO_POSE: "HeroPose",
  LOOK_TURN: "LookTurn",
};

const FALLBACK_CLIP_MAP = {
  // If the GLB doesn't have these clips, use Idle instead.
  Idle: "Idle",
  Walk: "Idle",
  Run: "Idle",
  Jump: "Idle",
  Land: "Idle",
  Interaction: "Idle",
  Blessing: "Idle",
  DivineAbility: "Idle",
  Damage: "Idle",
  HeroPose: "Idle",
  LookTurn: "Idle",
};

export class HeroCharacter {
  constructor(opts = {}) {
    this.root = new THREE.Group();
    this.root.name = "GaneshHeroRoot";
    this.mixer = null;
    this.actions = new Map();      // clip name -> AnimationAction
    this.clips = [];
    this.currentAction = null;
    this.currentClip = null;
    this.previousClip = null;
    this.loaded = false;
    this.lod = null;
    this.lodDistances = performanceManager.lodDistances || [8, 18, 9999];
    this.useLOD = opts.useLOD !== false;
    this.facing = 0;                // yaw rotation in radians
    this.targetFacing = 0;
    this.camera = opts.camera || null;
    this._abilityPlaying = false;
    this._onAbilityEnd = null;
    this.glow = null;               // optional divine glow mesh
  }

  /** Asynchronously load the hero GLB. Falls back to legacy if needed. */
  async load() {
    let gltf = null;
    // Try the new hero first.
    try {
      gltf = await assetManager.loadGLB("ganesh/ganesh_hero.glb");
    } catch (e) {
      console.warn("[Hero] Hero GLB failed, falling back to legacy ganesha_fallback.glb");
      try {
        gltf = await assetManager.loadGLB("ganesh/ganesha_fallback.glb");
      } catch (e2) {
        console.error("[Hero] All hero GLB loads failed:", e2);
        throw e2;
      }
    }
    this.gltf = gltf;
    this.scene = gltf.scene;
    this.clips = gltf.animations || [];

    // Try to load LOD1 / LOD2 if available (optional, for distance swapping).
    let lod1 = null, lod2 = null;
    if (this.useLOD) {
      try {
        const g1 = await assetManager.loadGLB("ganesh/ganesh_hero_LOD1.glb");
        lod1 = g1.scene;
      } catch (e) { /* ignore — LOD1 is optional */ }
      try {
        const g2 = await assetManager.loadGLB("ganesh/ganesh_hero_LOD2.glb");
        lod2 = g2.scene;
      } catch (e) { /* ignore */ }
    }

    // If LODs available, wrap them in a THREE.LOD object.
    if (lod1 && lod2) {
      this.lod = new LOD();
      this.lod.addLevel(this.scene, 0);
      this.lod.addLevel(lod1, this.lodDistances[0]);
      this.lod.addLevel(lod2, this.lodDistances[1]);
      this.root.add(this.lod);
    } else {
      this.root.add(this.scene);
    }

    // Setup shadows on all meshes.
    this.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // Compute scale so the hero is ~2.1m tall (matches original art direction).
    const box = new THREE.Box3().setFromObject(this.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const desiredHeight = 2.1;
    if (size.y > 0.001) {
      const scale = desiredHeight / size.y;
      this.scene.scale.setScalar(scale);
      // Recenter on the ground.
      this.scene.position.x -= (box.min.x + box.max.x) * 0.5 * scale;
      this.scene.position.z -= (box.min.z + box.max.z) * 0.5 * scale;
      this.scene.position.y -= box.min.y * scale;
    }

    // Setup animation mixer on the main scene.
    if (this.clips.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.scene);
      for (const clip of this.clips) {
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        this.actions.set(clip.name, action);
      }
    } else {
      console.warn("[Hero] No animation clips in GLB — character will be static");
    }

    // Add a soft divine glow halo behind the character (visible during ability).
    this._setupGlow();

    this.loaded = true;
    return this;
  }

  _setupGlow() {
    // A faint vertical glow ring used during abilities.
    const geo = new THREE.RingGeometry(0.7, 1.4, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffc966,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.glow = new THREE.Mesh(geo, mat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.05;
    this.glow.visible = false;
    this.root.add(this.glow);
  }

  /** Play a named clip with smooth crossfade. */
  play(name, { fade = 0.2, loop = true, clampWhenFinished = false, timeScale = 1 } = {}) {
    if (!this.loaded) return;
    let action = this.actions.get(name);
    if (!action) {
      // Fall back to a similar clip.
      const fallback = FALLBACK_CLIP_MAP[name] || HERO_CLIPS.IDLE;
      action = this.actions.get(fallback);
      if (!action) return;
    }
    // Stop other actions with fade.
    for (const [n, a] of this.actions) {
      if (n !== name && a.isRunning()) a.fadeOut(fade);
    }
    const loopMode = loop ? THREE.LoopRepeat : THREE.LoopOnce;
    action.setLoop(loopMode, loop ? Infinity : 1);
    action.clampWhenFinished = clampWhenFinished;
    action.setEffectiveTimeScale(timeScale);
    action.reset().fadeIn(fade).play();
    this.previousClip = this.currentClip;
    this.currentClip = name;
    this.currentAction = action;
  }

  /** Trigger the Divine Ability animation; returns to previous clip when done. */
  triggerAbility(onComplete) {
    if (!this.loaded || this._abilityPlaying) return;
    this._abilityPlaying = true;
    this._previousClip = this.currentClip || HERO_CLIPS.IDLE;
    const action = this.actions.get(HERO_CLIPS.ABILITY) ||
                   this.actions.get(HERO_CLIPS.IDLE);
    if (!action) return;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().fadeIn(0.2).play();
    // Show glow during the ability.
    if (this.glow) {
      this.glow.visible = true;
      this.glow.material.opacity = 0.6;
    }
    const dur = action.getClip().duration;
    this._onAbilityEnd = onComplete;
    setTimeout(() => {
      this._abilityPlaying = false;
      if (this.glow) this.glow.material.opacity = 0;
      this.play(this._previousClip || HERO_CLIPS.IDLE, { fade: 0.4 });
      if (this._onAbilityEnd) this._onAbilityEnd();
      this._onAbilityEnd = null;
    }, dur * 1000);
  }

  setPosition(x, y, z) { this.root.position.set(x, y, z); }
  setRotation(yaw) { this.facing = yaw; this.targetFacing = yaw; this.root.rotation.y = yaw; }

  faceToward(yaw, dt, speed = 6) {
    this.targetFacing = yaw;
    // Shortest-angle interpolation.
    let diff = this.targetFacing - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += diff * (1 - Math.exp(-speed * dt));
    this.root.rotation.y = this.facing;
  }

  update(dt, camera) {
    if (this.mixer) this.mixer.update(dt);
    // LOD update.
    if (this.lod && camera) this.lod.update(camera);
    // Glow pulse during ability.
    if (this.glow && this.glow.visible) {
      this.glow.rotation.z += dt * 0.8;
      this.glow.scale.setScalar(1 + 0.2 * Math.sin(performance.now() * 0.005));
    }
  }

  getClips() { return this.clips.map(c => c.name); }
  isAbilityPlaying() { return this._abilityPlaying; }

  dispose() {
    if (this.mixer) this.mixer.stopAllAction();
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.isMesh) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
            else o.material.dispose();
          }
        }
      });
    }
    if (this.glow) {
      this.glow.geometry.dispose();
      this.glow.material.dispose();
    }
  }
}

export default HeroCharacter;
