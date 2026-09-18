// ============================================================
// camera/CameraManager.js
// Multiple camera modes with smooth damping and cinematic framing.
// ============================================================

import * as THREE from "three";
import { damp, clamp, _v1, _v2 } from "../utils/Helpers.js";

export const CAMERA_MODE = {
  GAMEPLAY: "gameplay",
  INTRO: "intro",
  EXPLORATION: "exploration",
  INTERACTION: "interaction",
  BOSS_INTRO: "boss_intro",
  BOSS_FIGHT: "boss_fight",
  VIGHNA_BREAK: "vighna_break",
  ENDING: "ending",
  CINEMATIC: "cinematic",
};

export class CameraManager {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.mode = CAMERA_MODE.GAMEPLAY;
    this.target = new THREE.Vector3();
    this.desiredPos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.shakeMag = 0;
    this.shakeTimer = 0;
    this.fovCurrent = 45;
    this.fovTarget = 45;
    this.transitionTime = 0;
    this.cinematicSequence = null; // { steps: [...], t: 0 }
    // Per-mode tuning: each entry is { offset, look, fov, lambda }.
    this.presets = {
      [CAMERA_MODE.GAMEPLAY]: {
        offset: new THREE.Vector3(0, 3.2, 5.4),
        look: new THREE.Vector3(0, 1.5, 0),
        fov: 45,
        lambda: 4,
      },
      [CAMERA_MODE.EXPLORATION]: {
        offset: new THREE.Vector3(0, 4.0, 7.0),
        look: new THREE.Vector3(0, 1.4, 0),
        fov: 50,
        lambda: 2.5,
      },
      [CAMERA_MODE.INTRO]: {
        offset: new THREE.Vector3(2, 5.5, 9.5),
        look: new THREE.Vector3(0, 2, 0),
        fov: 40,
        lambda: 1.2,
      },
      [CAMERA_MODE.INTERACTION]: {
        offset: new THREE.Vector3(1.5, 2.0, 2.6),
        look: new THREE.Vector3(0, 1.4, 0),
        fov: 38,
        lambda: 5,
      },
      [CAMERA_MODE.BOSS_INTRO]: {
        offset: new THREE.Vector3(4, 7, 12),
        look: new THREE.Vector3(0, 4, 0),
        fov: 35,
        lambda: 1.0,
      },
      [CAMERA_MODE.BOSS_FIGHT]: {
        offset: new THREE.Vector3(0, 5.5, 9),
        look: new THREE.Vector3(0, 2.5, 0),
        fov: 50,
        lambda: 3.5,
      },
      [CAMERA_MODE.VIGHNA_BREAK]: {
        offset: new THREE.Vector3(0, 3.5, 7),
        look: new THREE.Vector3(0, 1.6, 0),
        fov: 38,
        lambda: 1.8,
      },
      [CAMERA_MODE.ENDING]: {
        offset: new THREE.Vector3(0, 4, 8),
        look: new THREE.Vector3(0, 1.8, 0),
        fov: 40,
        lambda: 1.0,
      },
      [CAMERA_MODE.CINEMATIC]: {
        offset: new THREE.Vector3(0, 3, 6),
        look: new THREE.Vector3(0, 1.4, 0),
        fov: 45,
        lambda: 2.5,
      },
    };
    this._initFov();
  }

  _initFov() {
    if (this.camera.isPerspectiveCamera) {
      this.camera.fov = this.fovCurrent;
      this.camera.updateProjectionMatrix();
    }
  }

  setMode(mode, immediate = false) {
    if (!this.presets[mode]) return;
    this.mode = mode;
    if (immediate) {
      const p = this.presets[mode];
      this.camera.position.copy(this.target).add(p.offset);
      this.camera.lookAt(this.target.clone().add(p.look));
      this.fovCurrent = p.fov;
      this.camera.fov = p.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Set the orbit-style target the camera damps toward (usually the player). */
  setTarget(x, y, z) {
    this.target.set(x, y, z);
  }

  /** Add a brief shake. */
  shake(magnitude = 0.25, duration = 0.4) {
    this.shakeMag = Math.max(this.shakeMag, magnitude);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  /** Run a custom cinematic sequence: list of { time, pos, look, fov } keyframes. */
  playCinematic(steps) {
    this.cinematicSequence = { steps, t: 0, total: steps[steps.length - 1].time };
  }

  stopCinematic() {
    this.cinematicSequence = null;
  }

  update(dt) {
    if (this.cinematicSequence) {
      this._updateCinematic(dt);
      return;
    }
    const p = this.presets[this.mode];
    if (!p) return;

    // Desired position relative to target.
    this.desiredPos.copy(this.target).add(p.offset);
    // Damped follow.
    const lerpFactor = 1 - Math.exp(-p.lambda * dt);
    this.camera.position.lerp(this.desiredPos, lerpFactor);

    // LookAt damped.
    const lookTarget = _v1.copy(this.target).add(p.look);
    // Manually damp the look direction (so we don't get instant snapping).
    if (!this._currentLook) this._currentLook = lookTarget.clone();
    this._currentLook.lerp(lookTarget, lerpFactor);
    this.camera.lookAt(this._currentLook);

    // FOV damp.
    this.fovTarget = p.fov;
    this.fovCurrent = damp(this.fovCurrent, this.fovTarget, 3, dt);
    this.camera.fov = this.fovCurrent;
    this.camera.updateProjectionMatrix();

    // Camera shake.
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const t = Math.max(0, this.shakeTimer);
      const mag = this.shakeMag * (t / 0.4);
      this.camera.position.x += (Math.random() - 0.5) * mag;
      this.camera.position.y += (Math.random() - 0.5) * mag;
      this.camera.position.z += (Math.random() - 0.5) * mag;
      if (t <= 0) this.shakeMag = 0;
    }
  }

  _updateCinematic(dt) {
    const seq = this.cinematicSequence;
    seq.t += dt;
    const steps = seq.steps;
    let a = steps[0];
    let b = steps[steps.length - 1];
    for (let i = 0; i < steps.length - 1; i++) {
      if (seq.t >= steps[i].time && seq.t < steps[i + 1].time) {
        a = steps[i];
        b = steps[i + 1];
        break;
      }
    }
    const segT = clamp((seq.t - a.time) / Math.max(0.001, b.time - a.time), 0, 1);
    const ease = segT * segT * (3 - 2 * segT);
    _v1.set(...a.pos).lerp(_v2.set(...b.pos), ease);
    this.camera.position.copy(_v1);
    const lookA = new THREE.Vector3(...a.look);
    const lookB = new THREE.Vector3(...b.look);
    const lookNow = lookA.lerp(lookB, ease);
    this.camera.lookAt(lookNow);
    if (a.fov !== undefined || b.fov !== undefined) {
      const fa = a.fov ?? this.fovCurrent;
      const fb = b.fov ?? fa;
      const fov = fa + (fb - fa) * ease;
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (seq.t >= seq.total) {
      this.cinematicSequence = null;
    }
  }
}

export default CameraManager;
