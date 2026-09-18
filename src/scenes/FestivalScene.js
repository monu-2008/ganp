// ============================================================
// scenes/FestivalScene.js
// The main playable festival exploration. Owns the player controller,
// HUD updates, contextual interaction, quest progression.
// ============================================================

import * as THREE from "three";
import { CAMERA_MODE } from "../camera/CameraManager.js";
import { CharacterController } from "../player/CharacterController.js";
import { HERO_CLIPS } from "../player/HeroCharacter.js";
import { PuzzleSystem } from "../gameplay/PuzzleSystem.js";
import { VighnaSystem } from "../gameplay/VighnaSystem.js";
import { BossSystem } from "../gameplay/BossSystem.js";
import { waitFor } from "../utils/Helpers.js";

export class FestivalScene {
  constructor(game) {
    this.game = game;
    this.hero = game.hero;
    this.mooshak = game.mooshak;
    this.world = game.world;
    this.camera = game.cameraManager;
    this.audio = game.audioManager;
    this.hud = game.hud;
    this.touch = game.touch;
    this.particles = game.particles;
    this.vfx = game.vfx;
    this.memory = game.memory;
    this.quest = game.quest;
    this.rain = game.rain;
    this.postProcess = game.postProcess;
    this.vighna = new VighnaSystem({
      world: this.world,
      particles: this.particles,
      vfx: this.vfx,
      audioManager: this.audio,
      cameraManager: this.camera,
      scene: this.game.scene,
      postProcess: this.postProcess,
    });
    this.vighna.onTimeFreeze = (frozen) => {
      if (frozen) this.rain.freeze();
      else this.rain.unfreeze();
    };
    this.puzzle = new PuzzleSystem({
      world: this.world,
      vighnaSystem: this.vighna,
      audioManager: this.audio,
      memorySystem: this.memory,
    });
    this.boss = new BossSystem({
      world: this.world,
      vighna: this.vighna,
      particles: this.particles,
      vfx: this.vfx,
      audio: this.audio,
      cameraManager: this.camera,
      scene: this.game.scene,
      memory: this.memory,
      postProcess: this.postProcess,
    });
    this.controller = new CharacterController({
      hero: this.hero,
      mooshak: this.mooshak,
      camera: this.camera.camera,
      world: this.world,
      audioManager: this.audio,
    });
    this.hero.root.add(this.mooshak.root); // attach mooshak to hero root so they move together
    this.mooshak.setPosition(0, 0, 0);
    this.mooshak.setVisible(false);
    this._initialized = false;
  }

  enter() {
    this.game.scene.add(this.hero.root);
    this.hero.setPosition(0, 0, 12);
    this.hero.setRotation(0);
    this.hero.play(HERO_CLIPS.IDLE, { fade: 0.2 });
    this.controller.setEnabled(true);
    this.camera.setMode(CAMERA_MODE.GAMEPLAY);
    this.camera.setTarget(0, 1.2, 12);
    this.hud.show();
    this.hud.setObjective(this.quest.getObjective());
    this.hud.setCharacter("Ganesh");
    this._bindCallbacks();
    this._initialized = true;

    // If the player has reached the puzzle chapter already, show that objective.
    if (this.quest.hasReached("puzzle")) {
      this.quest.setChapter("first_objective");
    } else {
      this.quest.setChapter("festival");
    }
  }

  _bindCallbacks() {
    if (this._initialized) return;
    // HUD button handlers.
    this.hud.onAbility(() => this._onAbility());
    this.hud.onSwitch(() => this._onSwitch());
    this.hud.onPause(() => this.game.pause());

    // Wire the controller's interact callback.
    this.controller.setInteractCallback(() => this._onInteract());

    // World callbacks.
    this.world.opts.onMandapEnter = () => {
      if (this.quest.chapter === "festival") {
        this.quest.setChapter("first_objective");
        this.hud.setObjective("Reach the temple");
      }
    };
    this.world.opts.onTempleApproach = () => {
      if (this.quest.chapter === "first_objective") {
        this.quest.setChapter("puzzle");
        this.hud.setObjective("Light the diyas in the correct order");
      }
    };
    this.world.opts.onRooftopEnter = () => {
      if (!this.memory.flags.shortcutOpened) {
        this.memory.setFlag("shortcutOpened", true);
        this.hud.showContextual("Shortcut opened", "✓");
        setTimeout(() => this.hud.hideContextual(), 2000);
      }
    };
    this.world.opts.onBossArenaEnter = () => {
      if (this.quest.chapter !== "boss" && this.quest.chapter !== "vighna_break") {
        this.startBossEncounter();
      }
    };
    this.world.opts.onRiverfrontEnter = () => {
      if (this.quest.chapter === "vighna_break") {
        this.quest.setChapter("riverfront");
        this.hud.setObjective("Walk to the riverfront");
      }
      if (this.quest.chapter === "riverfront") {
        this.startEnding();
      }
    };

    // Puzzle completion.
    this.puzzle.onComplete = () => {
      this.quest.setChapter("mooshak_intro");
      this.hud.setObjective("Switch to Mooshak — find the hidden tunnel");
      this.hud.showContextual("Puzzle solved!", "✓");
      setTimeout(() => this.hud.hideContextual(), 2500);
    };
  }

  _onAbility() {
    this.hero.triggerAbility(() => {
      // After ability, if there's a Vighna crack nearby, break it.
      const pos = this.hero.root.position;
      const nearby = this.world.vighnaCracks.find(c =>
        !c.broken && c.mesh.position.distanceTo(pos) < 3.5
      );
      if (nearby) {
        const id = nearby.mesh.userData.crackId;
        this.vighna.triggerBreak(id);
        if (this.quest.chapter === "first_objective") {
          this.quest.setChapter("first_vighna");
          this.hud.setObjective("Approach the source of the Vighna");
        }
        if (this.vighna.isFullyPurified()) {
          this.quest.setChapter("vighna_break");
          this.hud.setObjective("Walk to the riverfront");
        }
      }
    });
    this.audio.playAbility();
    // Divine ability flash (warm gold).
    this.postProcess?.flash(0xffe080, 0.5, 0.5);
    this.camera.shake(0.2, 0.3);
  }

  _onSwitch() {
    this.controller.toggleActive();
    const active = this.controller.active;
    this.hud.setCharacter(active === "ganesh" ? "Ganesh" : "Mooshak");
  }

  _onInteract() {
    if (!this.controller.enabled) return;
    const playerPos = this.hero.root.position.clone();
    const inter = this.world.getNearestInteractable(playerPos, 2.5);
    if (!inter) return;
    if (inter.type === "diya") {
      this.puzzle.interactDiya(inter.object);
    } else if (inter.type === "bell") {
      this.puzzle.interactBell(inter.object);
    } else if (inter.type === "shortcut") {
      // Already handled by trigger.
    }
    // Boss mechanism interaction.
    if (this.boss.boss && this.boss.phase !== "dormant" && this.boss.phase !== "defeated") {
      for (const mech of this.boss.mechanisms) {
        if (mech.position.distanceTo(playerPos) < 2.5 && !mech.userData.activated) {
          this.boss.activateMechanism(mech);
          break;
        }
      }
    }
  }

  async startBossEncounter() {
    if (this.boss.boss) return;
    this.boss.buildBoss();
    this.quest.setChapter("boss");
    this.hud.setObjective("Activate the three mechanisms");
    this.controller.setEnabled(false);
    this.hero.play(HERO_CLIPS.IDLE, { fade: 0.3 });
    this.camera.setMode(CAMERA_MODE.BOSS_INTRO);
    await this.boss.startIntro();
    this.camera.setMode(CAMERA_MODE.BOSS_FIGHT);
    this.controller.setEnabled(true);
    this.boss.onDefeated = () => {
      this.quest.setChapter("vighna_break");
      this.hud.setObjective("Walk to the riverfront");
    };
  }

  async startEnding() {
    this.controller.setEnabled(false);
    this.quest.setChapter("ending");
    this.audio.setRainIntensity(0.4);
    this.camera.setMode(CAMERA_MODE.ENDING);
    // Make the hero walk toward the riverfront (cinematic).
    this.hero.play(HERO_CLIPS.WALK, { fade: 0.3 });
    const targetZ = 38;
    const startZ = this.hero.root.position.z;
    const startTime = performance.now();
    const walkDuration = 6000;
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / walkDuration);
      this.hero.root.position.z = startZ + (targetZ - startZ) * t;
      if (t < 1) requestAnimationFrame(animate);
      else {
        this.hero.play(HERO_CLIPS.IDLE, { fade: 0.5 });
        this.game.endGame();
      }
    };
    animate();
  }

  update(dt) {
    if (!this._initialized) return;
    // Feed touch input to the controller.
    const vec = this.touch.getVector();
    this.controller.setAnalogInput(vec.x, -vec.y);  // y inverted (screen down = back)
    // Update controller (drives character + animations).
    this.controller.update(dt);
    // Update world (NPCs, lamps, etc.).
    this.world.update(dt, this.hero.root.position);
    // Update boss.
    if (this.boss.boss) this.boss.update(dt);
    // Update vighna.
    this.vighna.update(dt);
    // Update camera target to follow the active character.
    const pos = this.hero.root.position;
    this.camera.setTarget(pos.x, pos.y + 1.2, pos.z);
    // Contextual interact prompt.
    const inter = this.world.getNearestInteractable(pos, 2.5);
    if (inter) {
      const labels = {
        diya: "Light Diya",
        bell: "Ring Bell",
        shortcut: "Open Shortcut",
      };
      this.hud.showContextual(labels[inter.type] || "Interact", "✦");
    } else {
      // Check boss mechanism proximity.
      let nearMech = false;
      if (this.boss.boss && this.boss.phase !== "dormant" && this.boss.phase !== "defeated") {
        for (const mech of this.boss.mechanisms) {
          if (!mech.userData.activated && mech.position.distanceTo(pos) < 2.5) {
            nearMech = true;
            break;
          }
        }
      }
      if (nearMech) this.hud.showContextual("Activate Mechanism", "✦");
      else this.hud.hideContextual();
    }
  }

  exit() {
    this.controller.setEnabled(false);
    this.hud.hide();
  }
}

export default FestivalScene;
