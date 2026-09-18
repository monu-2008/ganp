// ============================================================
// core/Game.js
// Main game class: state machine, scene management, render loop.
// ============================================================

import * as THREE from "three";
import { performanceManager, QUALITY } from "./PerformanceManager.js";
import { assetManager } from "./AssetManager.js";
import { audioManager } from "./AudioManager.js";
import { saveSystem } from "./SaveSystem.js";
import { CameraManager, CAMERA_MODE } from "../camera/CameraManager.js";
import { HeroCharacter } from "../player/HeroCharacter.js";
import { MooshakCharacter } from "../player/MooshakCharacter.js";
import { FestivalCity } from "../world/FestivalCity.js";
import { RainSystem } from "../effects/RainSystem.js";
import { ParticleSystem } from "../effects/ParticleSystem.js";
import { VFXManager } from "../effects/VFXManager.js";
import { WaterSystem } from "../effects/WaterSystem.js";
import { PostProcess, COLOR_GRADES } from "../effects/PostProcess.js";
import { PARTICLE_PRESET } from "../effects/ParticleSystem.js";
import { HUD } from "../ui/HUD.js";
import { TouchControls } from "../ui/TouchControls.js";
import { Menu } from "../ui/Menu.js";
import { OrientationPrompt } from "../ui/OrientationPrompt.js";
import { QuestSystem, CHAPTER } from "../gameplay/QuestSystem.js";
import { MemorySystem } from "../gameplay/MemorySystem.js";
import { BootScene } from "../scenes/BootScene.js";
import { IntroScene } from "../scenes/IntroScene.js";
import { FestivalScene } from "../scenes/FestivalScene.js";
import { EndingScene } from "../scenes/EndingScene.js";

export const GAME_STATE = {
  BOOT: "boot",
  LOADING: "loading",
  MENU: "menu",
  INTRO: "intro",
  PLAYING: "playing",
  PAUSED: "paused",
  ENDING: "ending",
};

export class Game {
  constructor() {
    this.state = GAME_STATE.BOOT;
    this.canvas = document.getElementById("game-canvas");
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = new THREE.Clock();
    this.debug = saveSystem.debug;
    this._initRenderer();
    this._initScene();
    this._initSystems();
    this._initUI();
    this._bindResize();
  }

  _initRenderer() {
    performanceManager.detectInitialQuality();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: performanceManager.settings.antialias,
      powerPreference: performanceManager.settings.powerPreference,
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, performanceManager.settings.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = performanceManager.shadowEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = performanceManager.settings.toneMappingExposure;
    performanceManager.attachRenderer(this.renderer);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07050a);
    this.scene.fog = new THREE.FogExp2(0x0a0810, 0.025);

    this.camera = new THREE.PerspectiveCamera(
      45, window.innerWidth / window.innerHeight, 0.1, 200
    );
    this.camera.position.set(0, 5, 14);
    this.camera.lookAt(0, 1.5, 0);
    this.cameraManager = new CameraManager(this.camera);
  }

  _initSystems() {
    this.audio = audioManager;
    this.assets = assetManager;
    this.save = saveSystem;
    this.rain = null;
    this.particles = null;
    this.vfx = null;
    this.water = null;
    this.hero = null;
    this.mooshak = null;
    this.world = null;
    this.quest = new QuestSystem(this.save);
    this.memory = new MemorySystem(this.save);
    this.touch = new TouchControls();
    this.orientation = new OrientationPrompt();
  }

  _initUI() {
    this.hud = new HUD();
    this.menu = new Menu();
    this.bootScene = new BootScene({ audioManager: this.audio, assetManager: this.assets });

    // Wire up menu callbacks.
    this.menu.setQuality(this.save.quality);
    this.menu.setVolumes(this.save.volumes);
    this.menu.setDebug(this.save.debug);
    this.menu.onContinue(() => this.startGame({ continue: true }));
    this.menu.onNew(() => this.startGame({ continue: false }));
    this.menu.onSettings(() => this.menu.showSettings());
    this.menu.onCredits(() => this.menu.showCredits());
    this.menu.onSettingsBack(() => this.menu.showMenu(this.save.hasProgress()));
    this.menu.onCreditsBack(() => this.menu.showMenu(this.save.hasProgress()));
    this.menu.onQualityChange((q) => {
      this.save.setQuality(q);
      performanceManager.setQuality(q);
      this.menu.setQuality(q);
    });
    this.menu.onVolumeChange((v) => {
      const all = this.save.volumes;
      const newVols = { ...all, ...v };
      this.save.setVolumes(newVols);
      if (v.master !== undefined) this.audio.setMasterVolume(v.master);
      if (v.music !== undefined) this.audio.setMusicVolume(v.music);
      if (v.sfx !== undefined) this.audio.setSfxVolume(v.sfx);
    });
    this.menu.onDebugToggle((b) => {
      this.save.setDebug(b);
      this.debug = b;
      document.getElementById("debug-overlay").classList.toggle("hidden", !b);
    });

    // Pause overlay buttons.
    document.getElementById("pause-resume-btn").onclick = () => this.resume();
    document.getElementById("pause-restart-btn").onclick = () => this.restart();
    document.getElementById("pause-quit-btn").onclick = () => this.quitToMenu();
    document.getElementById("pause-settings-btn").onclick = () => this.menu.showSettings();
    document.getElementById("end-card-menu-btn").onclick = () => this.quitToMenu();
    document.getElementById("end-card-replay-btn").onclick = () => this.restart();
  }

  _bindResize() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.postProcess) this.postProcess.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /** Boot → Loading → Menu flow. */
  async start() {
    this.state = GAME_STATE.BOOT;
    await this.bootScene.run(async (progress) => {
      // Preload hero GLB + world assets (asynchronously with progress).
      const steps = [
        { label: "Preparing the Festival…", fn: async () => { await this._loadWorldAssets(); } },
        { label: "Awakening the Vighnaharta…", fn: async () => { await this._loadHero(); } },
        { label: "Opening the Ancient City…", fn: async () => { await this._setupLighting(); } },
        { label: "Summoning the Vighna…", fn: async () => { await this._setupAtmosphere(); } },
      ];
      for (let i = 0; i < steps.length; i++) {
        progress(i / steps.length, steps[i].label);
        await steps[i].fn();
        progress((i + 1) / steps.length, steps[i].label);
      }
    });
    // After loading, the world is built and the menu can show the festival in the background.
    // Apply menu color grade.
    if (this.postProcess) this.postProcess.setGrade("menu", true);
    // Add the hero to the scene at the mandap for the menu shot (visual ambiance).
    if (this.hero) {
      this.scene.add(this.hero.root);
      this.hero.setPosition(0, 0, 12);
      this.hero.setRotation(0);
      this.hero.play("Idle", { fade: 0.2 });
    }
    // Start rain + ambience for menu atmosphere.
    this.audio.startRain(0.4);
    this.audio.startAmbience();
    this.audio.startTempleBells(15000);
    if (this.rain) this.rain.setIntensity(0.5);
    this.state = GAME_STATE.MENU;
    this.menu.showMenu(this.save.hasProgress());
    this._startRenderLoop();
    this.audio.init();  // Initialize audio context (will be resumed on first user gesture).
  }

  async _loadHero() {
    this.hero = new HeroCharacter({ camera: this.camera });
    await this.hero.load();
    this.mooshak = new MooshakCharacter();
    this.scene.add(this.hero.root);
  }

  async _loadWorldAssets() {
    // Pre-cache villain GLB (for boss) and modak (decoration).
    try {
      await this.assets.loadGLB("villain/kaal_vighna.glb");
    } catch (e) { /* optional */ }
    try {
      await this.assets.loadGLB("modak/modak.glb");
    } catch (e) { /* optional */ }
    // Build the world.
    this.world = new FestivalCity(this.scene, {
      onMandapEnter: () => {},
      onTempleApproach: () => {},
      onRooftopEnter: () => {},
      onBossArenaEnter: () => {},
      onRiverfrontEnter: () => {},
    });
  }

  _setupLighting() {
    // Ambient + hemisphere for soft base light (boosted for visibility).
    const hemi = new THREE.HemisphereLight(0xffdca8, 0x302030, 0.85);
    this.scene.add(hemi);
    // Key warm directional light (the "festival" key light).
    const key = new THREE.DirectionalLight(0xffe2b0, 2.2);
    key.position.set(8, 14, 6);
    key.castShadow = performanceManager.shadowEnabled;
    if (performanceManager.shadowEnabled) {
      key.shadow.mapSize.set(performanceManager.shadowMapSize, performanceManager.shadowMapSize);
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = 60;
      key.shadow.camera.left = -30;
      key.shadow.camera.right = 30;
      key.shadow.camera.top = 30;
      key.shadow.camera.bottom = -30;
      key.shadow.bias = -0.0005;
    }
    this.scene.add(key);
    this.keyLight = key;
    // Cool rim light from the opposite side (boosted).
    const rim = new THREE.DirectionalLight(0x88b4ff, 1.2);
    rim.position.set(-6, 8, -6);
    this.scene.add(rim);
    this.rimLight = rim;
    // Backlight (warm).
    const back = new THREE.DirectionalLight(0xffa040, 0.7);
    back.position.set(0, 6, -10);
    this.scene.add(back);
    this.backLight = back;
    // Spotlight on the mandap (the central focal point — creates a dramatic
    // "stage" feel and lights up the Ganesh reveal).
    this.mandapSpot = new THREE.SpotLight(0xffd080, 3.0, 18, Math.PI / 5, 0.4, 1.5);
    this.mandapSpot.position.set(0, 12, 12);
    this.mandapSpot.target.position.set(0, 1, 12);
    this.mandapSpot.castShadow = false;
    this.scene.add(this.mandapSpot);
    this.scene.add(this.mandapSpot.target);
    // Subtle warm fill light at street level (festival vibe).
    this.festivalFill = new THREE.PointLight(0xffa040, 1.2, 14, 2.0);
    this.festivalFill.position.set(0, 3, 0);
    this.scene.add(this.festivalFill);
    // Additional ambient point lights along the street for visibility.
    this.streetLights = [];
    for (let i = 0; i < 4; i++) {
      const z = -30 + i * 15;
      const pl = new THREE.PointLight(0xffa040, 0.8, 8, 2.0);
      pl.position.set(0, 4, z);
      this.scene.add(pl);
      this.streetLights.push(pl);
    }
  }

  _setupAtmosphere() {
    // Particles (must be created before rain so splashes can hook into them).
    this.particles = new ParticleSystem(this.scene);
    // Rain.
    this.rain = new RainSystem(this.scene, this.camera);
    // Hook rain splashes to the particle system (rain hitting the ground).
    this.rain.onSplash = (x, y, z) => {
      this.particles.emit("rain_splash", PARTICLE_PRESET.SPARKS,
        { x, y: 0.05, z }, 1, { spread: 0.1, vy: 0.5 });
    };
    // VFX.
    this.vfx = new VFXManager(this.scene, this.particles);
    // Post-processing (bloom + color grading + vignette + grain).
    this.postProcess = new PostProcess(this.renderer, this.scene, this.camera);
    // Water (at the riverfront).
    this.water = new WaterSystem(this.scene, { size: 40, segments: 30 });
    this.water.setPosition(0, -1.5, 46);
    // Add a low fog plane (just visual).
    const fogPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 100),
      new THREE.MeshBasicMaterial({
        color: 0x0a0810, transparent: true, opacity: 0.0, depthWrite: false,
      })
    );
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.y = 0.5;
    this.scene.add(fogPlane);
  }

  /** Start a new game (or continue from save). */
  async startGame({ continue: continueGame }) {
    this.audio.resume();
    if (!continueGame) {
      this.save.resetProgress();
      this.memory = new MemorySystem(this.save);
      this.quest = new QuestSystem(this.save);
    } else {
      this.memory = new MemorySystem(this.save);
      this.quest = new QuestSystem(this.save);
    }
    // Reset the world (unfreeze + reset triggers).
    if (this.world) {
      this.world.unfreezeWorld();
      for (const t of this.world.triggers) t.fired = false;
      // Reset puzzle diyas (visual only — keep lit state for memory).
      // Reset boss if any.
      if (this.boss) this.boss = null;
    }
    this.menu.hide();
    this.state = GAME_STATE.INTRO;
    this.festivalScene = new FestivalScene(this);
    this.festivalScene.enter();
    // Play the intro cinematic.
    this.introScene = new IntroScene({
      cameraManager: this.cameraManager,
      audio: this.audio,
      rain: this.rain,
      particles: this.particles,
      hud: this.hud,
      vfx: this.vfx,
      questSystem: this.quest,
      hero: this.hero,
      world: this.world,
      postProcess: this.postProcess,
    });
    this.state = GAME_STATE.PLAYING;
    await this.introScene.play(() => {
      // After intro, give control to the player.
      this.quest.setChapter("festival");
      this.hud.setObjective(this.quest.getObjective());
    });
  }

  pause() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.state = GAME_STATE.PAUSED;
    document.getElementById("pause-overlay").classList.remove("hidden");
  }

  resume() {
    if (this.state !== GAME_STATE.PAUSED) return;
    this.state = GAME_STATE.PLAYING;
    document.getElementById("pause-overlay").classList.add("hidden");
  }

  restart() {
    document.getElementById("pause-overlay").classList.add("hidden");
    document.getElementById("end-card").classList.add("hidden");
    // Clean up the existing scene.
    this._cleanupGameplay();
    this.startGame({ continue: false });
  }

  quitToMenu() {
    document.getElementById("pause-overlay").classList.add("hidden");
    document.getElementById("end-card").classList.add("hidden");
    this._cleanupGameplay();
    this.state = GAME_STATE.MENU;
    this.menu.showMenu(this.save.hasProgress());
  }

  _cleanupGameplay() {
    // Reset quest and memory, but keep the world + hero in the scene
    // (the menu shows them in the background).
    this.quest = new QuestSystem(this.save);
    this.memory = new MemorySystem(this.save);
    // Reset the hero to the mandap pose.
    if (this.hero) {
      this.hero.setPosition(0, 0, 12);
      this.hero.setRotation(0);
      this.hero.play("Idle", { fade: 0.3 });
    }
    // Reset the world (unfreeze NPCs/lamps if needed).
    if (this.world) {
      // Unfreeze in case we left during a time-freeze.
      this.world.unfreezeWorld();
      // Reset triggers.
      for (const t of this.world.triggers) t.fired = false;
    }
    // Stop the rain ambience (will restart for menu).
    this.audio.stopTempleBells();
    this.audio.setRainIntensity(0.4);
    if (this.rain) this.rain.unfreeze();
    if (this.rain) this.rain.setIntensity(0.5);
    // Switch back to menu grade.
    if (this.postProcess) this.postProcess.setGrade("menu");
  }

  endGame() {
    this.state = GAME_STATE.ENDING;
    this.endingScene = new EndingScene(this);
    this.endingScene.play();
  }

  _startRenderLoop() {
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this._update(dt);
      this._render();
      this._updateDebug(dt);
    };
    tick();
  }

  _update(dt) {
    // Always update camera (so menu has a slow orbit if needed).
    if (this.state === GAME_STATE.MENU) {
      // Slowly orbit camera around the mandap at a cinematic angle.
      const t = performance.now() * 0.00012;
      this.camera.position.x = Math.sin(t) * 8;
      this.camera.position.z = Math.cos(t) * 8 + 12;
      this.camera.position.y = 3.5;
      this.camera.lookAt(0, 1.5, 12);
      if (this.postProcess) this.postProcess.setGrade("menu");
      // Update hero (idle animation).
      if (this.hero) this.hero.update(dt, this.camera);
    } else {
      this.cameraManager.update(dt);
    }
    // Rain.
    if (this.rain) this.rain.update(dt);
    // Particles.
    if (this.particles) this.particles.update(dt);
    // VFX.
    if (this.vfx) this.vfx.update(dt);
    // Water.
    if (this.water) this.water.update(dt);
    // Post-processing.
    if (this.postProcess) this.postProcess.update(dt);
    // Festival scene.
    if (this.state === GAME_STATE.PLAYING && this.festivalScene) {
      this.festivalScene.update(dt);
    }
    // Performance tracking.
    performanceManager.trackFrame(dt);
    performanceManager.maybeAutoAdjust(performance.now() / 1000);
  }

  _render() {
    // Render via post-processing pipeline if available, otherwise direct.
    if (this.postProcess) {
      this.postProcess.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _updateDebug(dt) {
    if (!this.debug) return;
    const fps = 1 / dt;
    document.getElementById("debug-fps").textContent = fps.toFixed(0);
    document.getElementById("debug-calls").textContent = this.renderer.info.render.calls;
    document.getElementById("debug-tris").textContent = this.renderer.info.render.triangles.toLocaleString();
    document.getElementById("debug-state").textContent = this.state;
    document.getElementById("debug-quality").textContent = performanceManager.quality;
  }
}

export default Game;
