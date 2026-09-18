// ============================================================
// player/CharacterController.js
// Touch + keyboard controls → moves the active character (Ganesh or Mooshak).
// ============================================================

import * as THREE from "three";
import { HERO_CLIPS } from "./HeroCharacter.js";
import { clamp, damp, DEG2RAD } from "../utils/Helpers.js";

const GRAVITY = 22;
const JUMP_VELOCITY = 7.5;
const GROUND_Y = 0;
const WALK_SPEED = 3.2;
const RUN_SPEED = 6.5;
const MOOSHAK_SPEED = 5.5;

export class CharacterController {
  constructor({ hero, mooshak, camera, world, audioManager }) {
    this.hero = hero;
    this.mooshak = mooshak;
    this.camera = camera;
    this.world = world;
    this.audio = audioManager;

    this.active = "ganesh";        // "ganesh" | "mooshak"
    this.position = new THREE.Vector3(0, GROUND_Y, 0);
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.targetFacing = 0;
    this.isGrounded = true;
    this.isMoving = false;
    this.isRunning = false;
    this.inputVector = new THREE.Vector2();     // x: strafe, y: forward
    this.lastFootstepAt = 0;
    this.vaultCooldown = 0;
    this.canVaultAt = 0;
    this.enabled = false;
    this.jumpHeld = false;

    // Touch gesture state.
    this._touchStart = null;
    this._touchStartTime = 0;

    this._bindInputs();
  }

  setActive(which) {
    if (which === this.active) return;
    this.active = which;
    if (which === "ganesh") {
      this.mooshak.setVisible(false);
      // Sync position.
      this.mooshak.setPosition(this.position.x, GROUND_Y, this.position.z);
    } else {
      this.mooshak.setVisible(true);
      this.mooshak.setPosition(this.position.x, GROUND_Y, this.position.z);
    }
    if (this.audio && this.audio.playSwitch) {
      try { this.audio.playSwitch(); } catch (e) { /* audio not ready */ }
    }
  }

  toggleActive() {
    this.setActive(this.active === "ganesh" ? "mooshak" : "ganesh");
  }

  setEnabled(b) {
    this.enabled = b;
    if (!b) {
      this.inputVector.set(0, 0);
      this.isMoving = false;
    }
  }

  _bindInputs() {
    // Keyboard fallback.
    window.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup")    this.inputVector.y = 1;
      if (k === "s" || k === "arrowdown")  this.inputVector.y = -1;
      if (k === "a" || k === "arrowleft")  this.inputVector.x = -1;
      if (k === "d" || k === "arrowright") this.inputVector.x = 1;
      if (k === " " && this.isGrounded) this._jump();
      if (k === "shift") this.isRunning = true;
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup")    this.inputVector.y = 0;
      if (k === "s" || k === "arrowdown")  this.inputVector.y = 0;
      if (k === "a" || k === "arrowleft")  this.inputVector.x = 0;
      if (k === "d" || k === "arrowright") this.inputVector.x = 0;
      if (k === "shift") this.isRunning = false;
    });

    // Touch gestures on the canvas (not on UI buttons).
    const canvas = document.getElementById("game-canvas");
    canvas.addEventListener("touchstart", (e) => {
      if (!this.enabled) return;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        this._touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
      }
    }, { passive: true });

    canvas.addEventListener("touchend", (e) => {
      if (!this.enabled || !this._touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this._touchStart.x;
      const dy = t.clientY - this._touchStart.y;
      const dur = performance.now() - this._touchStart.time;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const threshold = 30;
      // Treat as tap if movement < threshold and quick.
      if (absX < threshold && absY < threshold && dur < 250) {
        // Tap = interact handled elsewhere via interact callback.
        this._onTap?.();
      } else if (absX > absY) {
        // Horizontal swipe.
        if (dx > threshold) this._swipe("right");
        else if (dx < -threshold) this._swipe("left");
      } else {
        // Vertical swipe.
        if (dy < -threshold) this._swipe("up");
        else if (dy > threshold) this._swipe("down");
      }
      this._touchStart = null;
    }, { passive: true });
  }

  _swipe(dir) {
    switch (dir) {
      case "up":    this._jump(); break;
      case "down":  this._dash(); break;
      case "left":  this._dodge(-1); break;
      case "right": this._dodge(1); break;
    }
  }

  _jump() {
    if (!this.isGrounded) return;
    this.velocity.y = JUMP_VELOCITY;
    this.isGrounded = false;
    this.audio?.playJump();
    if (this.active === "ganesh") this.hero.play(HERO_CLIPS.JUMP, { fade: 0.1, loop: false, clampWhenFinished: true });
  }

  _dash() {
    // Forward dash (slight speed burst).
    this.velocity.z -= 4;
  }

  _dodge(dir) {
    // Quick strafe.
    this.velocity.x += dir * 4;
  }

  /** External callers (TouchControls) feed the analog stick. */
  setAnalogInput(x, y) {
    this.inputVector.x = x;
    this.inputVector.y = y;
  }

  /** External interact trigger (from Tap). */
  setInteractCallback(fn) {
    this._onTap = fn;
  }

  triggerJump() { this._jump(); }

  update(dt) {
    if (!this.enabled) {
      // Still update visual smoothing.
      if (this.active === "ganesh") {
        this.hero.update(dt, this.camera);
        this.hero.root.position.copy(this.position);
      } else {
        this.mooshak.update(dt, false);
        this.mooshak.setPosition(this.position.x, GROUND_Y, this.position.z);
      }
      return;
    }

    // Determine active character.
    const speed = this.active === "mooshak" ? MOOSHAK_SPEED
                  : (this.isRunning ? RUN_SPEED : WALK_SPEED);

    // Movement vector relative to camera yaw (camera-relative controls).
    const camYaw = this._getCameraYaw();
    // Forward direction is the camera's forward projected on XZ.
    const forward = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const right   = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const move = new THREE.Vector3();
    move.addScaledVector(forward, -this.inputVector.y);
    move.addScaledVector(right,   this.inputVector.x);
    if (move.lengthSq() > 0.001) {
      move.normalize().multiplyScalar(speed);
      this.isMoving = true;
      // Face toward the movement direction.
      this.targetFacing = Math.atan2(move.x, move.z);
    } else {
      this.isMoving = false;
    }

    // Apply horizontal velocity (with damping for grounded feel).
    this.velocity.x = damp(this.velocity.x, move.x, 10, dt);
    this.velocity.z = damp(this.velocity.z, move.z, 10, dt);

    // Apply gravity.
    if (!this.isGrounded) {
      this.velocity.y -= GRAVITY * dt;
    }

    // Integrate.
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Ground collision (basic; the world supplies a custom floor if needed).
    const floorY = this.world ? this.world.getFloorY(this.position.x, this.position.z) : GROUND_Y;
    if (this.position.y <= floorY) {
      this.position.y = floorY;
      this.velocity.y = 0;
      if (!this.isGrounded) {
        this.isGrounded = true;
        this.audio?.playLand();
        if (this.active === "ganesh") {
          this.hero.play(HERO_CLIPS.LAND, { fade: 0.08, loop: false, clampWhenFinished: true });
          // After landing clip, go back to idle/walk.
          setTimeout(() => {
            if (this.isGrounded) {
              this.hero.play(this.isMoving ? HERO_CLIPS.WALK : HERO_CLIPS.IDLE, { fade: 0.2 });
            }
          }, 400);
        }
      }
    }

    // World bounds (clamp).
    if (this.world && this.world.bounds) {
      const b = this.world.bounds;
      this.position.x = clamp(this.position.x, b.minX, b.maxX);
      this.position.z = clamp(this.position.z, b.minZ, b.maxZ);
    }

    // Smooth rotation toward target facing.
    let diff = this.targetFacing - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += diff * (1 - Math.exp(-10 * dt));

    // Drive the visual character.
    if (this.active === "ganesh") {
      this.hero.root.position.copy(this.position);
      this.hero.root.rotation.y = this.facing;
      this.hero.update(dt, this.camera);
      // Animation selection when grounded.
      if (this.isGrounded) {
        const moving = this.isMoving;
        const targetClip = moving ? (this.isRunning ? HERO_CLIPS.RUN : HERO_CLIPS.WALK) : HERO_CLIPS.IDLE;
        // Only switch if it changed (avoid spamming).
        if (this.hero.currentClip !== targetClip && !this.hero.isAbilityPlaying()) {
          this.hero.play(targetClip, { fade: 0.15 });
        }
      }
      // Footstep audio.
      if (this.isMoving && this.isGrounded) {
        const now = performance.now();
        const interval = this.isRunning ? 320 : 480;
        if (now - this.lastFootstepAt > interval) {
          this.audio?.playFootstep();
          this.lastFootstepAt = now;
        }
      }
    } else {
      this.mooshak.setPosition(this.position.x, GROUND_Y, this.position.z);
      this.mooshak.setRotation(this.facing);
      this.mooshak.update(dt, this.isMoving);
    }
  }

  _getCameraYaw() {
    if (!this.camera) return 0;
    // Yaw = atan2(dirX, dirZ) of the camera's forward vector.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return Math.atan2(dir.x, dir.z);
  }
}

export default CharacterController;
