// ============================================================
// world/FestivalCity.js
// The connected festival district: street → mandap → temple → rooftops → riverfront.
// ============================================================

import * as THREE from "three";
import { performanceManager } from "../core/PerformanceManager.js";

// Reusable materials (created once per world instance).
function buildMaterials() {
  return {
    ground: new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.9 }),
    wetStreet: new THREE.MeshStandardMaterial({
      color: 0x141018, roughness: 0.25, metalness: 0.4,
      // Subtle wetness look — partial reflectivity.
    }),
    buildingWall: new THREE.MeshStandardMaterial({ color: 0xb88458, roughness: 0.85 }),
    buildingWall2: new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.88 }),
    buildingWall3: new THREE.MeshStandardMaterial({ color: 0xa87040, roughness: 0.82 }),
    buildingWall4: new THREE.MeshStandardMaterial({ color: 0xc89868, roughness: 0.85 }),
    buildingRoof: new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.9 }),
    templeStone: new THREE.MeshStandardMaterial({ color: 0xd8c89a, roughness: 0.7 }),
    templeStoneDark: new THREE.MeshStandardMaterial({ color: 0xa89870, roughness: 0.8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffc966, metalness: 1.0, roughness: 0.25 }),
    saffron: new THREE.MeshStandardMaterial({ color: 0xff8a3a, roughness: 0.7 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb8341c, roughness: 0.7 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xf5ecd9, roughness: 0.85 }),
    marigold: new THREE.MeshStandardMaterial({ color: 0xffa030, roughness: 0.7, emissive: 0xff6010, emissiveIntensity: 0.05 }),
    flag: new THREE.MeshStandardMaterial({ color: 0xff8a3a, roughness: 0.75, side: THREE.DoubleSide }),
    flag2: new THREE.MeshStandardMaterial({ color: 0xb8341c, roughness: 0.75, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.85 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.8 }),
    diya: new THREE.MeshStandardMaterial({ color: 0x6a4218, roughness: 0.7 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffa040 }),
    lampPost: new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.6, metalness: 0.4 }),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xffd080 }),
    banner: new THREE.MeshStandardMaterial({ color: 0xb8341c, roughness: 0.75, side: THREE.DoubleSide, emissive: 0x401008, emissiveIntensity: 0.1 }),
    banner2: new THREE.MeshStandardMaterial({ color: 0xff8a3a, roughness: 0.75, side: THREE.DoubleSide, emissive: 0x401810, emissiveIntensity: 0.1 }),
    pillar: new THREE.MeshStandardMaterial({ color: 0xc8a868, roughness: 0.75 }),
    vighnaRock: new THREE.MeshStandardMaterial({ color: 0x1a0808, roughness: 0.85, emissive: 0x601010, emissiveIntensity: 0.3 }),
    bossStone: new THREE.MeshStandardMaterial({ color: 0x181010, roughness: 0.9, emissive: 0x801020, emissiveIntensity: 0.4, metalness: 0.1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x102030, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85 }),
    rooftop: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.85 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 0.9 }),
    windowEmissive: new THREE.MeshBasicMaterial({ color: 0xffd070 }),
    windowEmissiveWarm: new THREE.MeshBasicMaterial({ color: 0xffa050 }),
    windowEmissiveCool: new THREE.MeshBasicMaterial({ color: 0xa0d0ff }),
  };
}

export class FestivalCity {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.root = new THREE.Group();
    this.root.name = "FestivalCityRoot";
    this.bounds = { minX: -30, maxX: 30, minZ: -45, maxZ: 50 };
    this.interactables = [];     // { object3D, type, position, action }
    this.vighnaCracks = [];      // active crack meshes
    this.diyas = [];             // { mesh, flame, lit, litTime }
    this.bells = [];             // { mesh, swaying, phase, struck }
    this.lamps = [];             // { mesh, light, on }
    this.npcs = [];
    this.doors = [];
    this.triggers = [];          // { position, radius, onEnter, fired }
    this.mats = buildMaterials();
    this._build();
    this.scene.add(this.root);
  }

  /** Returns Y of the floor at (x,z) — useful for character controller. */
  getFloorY(x, z) {
    // Default flat ground at y=0. Rooftop sections raise the floor.
    if (z > 18 && z < 26 && Math.abs(x) < 4) return 4.5; // rooftop section
    return 0;
  }

  _build() {
    this._buildGround();
    this._buildStreet();
    this._buildMandap();
    this._buildTemple();
    this._buildRooftops();
    this._buildRiverfront();
    this._buildNPCs();
    this._buildLampPosts();
    this._buildVighnaCracks();
    this._buildTriggers();
  }

  _buildGround() {
    // Ground with procedural noise texture to break up tiling.
    const noiseTex = this._makeGroundNoiseTexture();
    const geo = new THREE.PlaneGeometry(80, 100, 32, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a1208,
      roughness: 0.9,
      map: noiseTex,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.root.add(ground);
    // Side strips of grass on each side of the street.
    for (const x of [-6, 6]) {
      const grassGeo = new THREE.PlaneGeometry(4, 100);
      grassGeo.rotateX(-Math.PI / 2);
      const grass = new THREE.Mesh(grassGeo, this.mats.grass);
      grass.position.set(x, 0.005, 0);
      grass.receiveShadow = true;
      this.root.add(grass);
    }
  }

  _makeGroundNoiseTexture() {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const ctx = c.getContext("2d");
    // Base dark color.
    ctx.fillStyle = "#1a1208";
    ctx.fillRect(0, 0, 256, 256);
    // Random darker speckles for asphalt/earth texture.
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.random() * 2 + 0.5;
      const v = Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${20 + v}, ${14 + v}, ${8 + v})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // A few lighter highlights (small stones).
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.random() * 1.5 + 0.5;
      ctx.fillStyle = `rgba(80, 70, 50, 0.5)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 10);
    tex.needsUpdate = true;
    return tex;
  }

  _buildStreet() {
    // Long street running along the Z axis — with procedural noise texture for wet asphalt look.
    const streetNoiseTex = this._makeStreetNoiseTexture();
    const geo = new THREE.PlaneGeometry(8, 100);
    geo.rotateX(-Math.PI / 2);
    const streetMat = new THREE.MeshStandardMaterial({
      color: 0x141018, roughness: 0.25, metalness: 0.4,
      map: streetNoiseTex,
    });
    const street = new THREE.Mesh(geo, streetMat);
    street.position.set(0, 0.01, 0);
    street.receiveShadow = true;
    this.root.add(street);
    // Puddles — actual reflective surfaces (cheap fake reflections via color + metalness).
    for (let i = 0; i < 8; i++) {
      const z = -40 + i * 11 + Math.random() * 4;
      const r = 0.8 + Math.random() * 0.6;
      const puddleGeo = new THREE.CircleGeometry(r, 24);
      puddleGeo.rotateX(-Math.PI / 2);
      const puddleMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a18,
        roughness: 0.05,
        metalness: 0.9,
        transparent: true,
        opacity: 0.85,
      });
      const puddle = new THREE.Mesh(puddleGeo, puddleMat);
      puddle.position.set((Math.random() - 0.5) * 6, 0.025, z);
      puddle.receiveShadow = false;
      this.root.add(puddle);
    }
    // Buildings on both sides of the street.
    this._buildStreetBuildings();
    // Festival flags and decorations.
    this._buildFlags();
    // Marigold garlands (rows of orange spheres).
    this._buildMarigoldGarlands();
    // Street debris — crates, pots, small details for visual richness.
    this._buildStreetProps();
  }

  _makeStreetNoiseTexture() {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#141018";
    ctx.fillRect(0, 0, 128, 256);
    // Speckles for wet asphalt texture.
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 256;
      const v = Math.floor(Math.random() * 25);
      ctx.fillStyle = `rgb(${20 + v}, ${16 + v}, ${24 + v})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // A few subtle wet streaks.
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 256;
      ctx.fillStyle = `rgba(60, 60, 80, 0.3)`;
      ctx.fillRect(x, y, 1, 8 + Math.random() * 6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 6);
    tex.needsUpdate = true;
    return tex;
  }

  _buildStreetProps() {
    // Small details along the street: wooden crates, clay pots, baskets.
    const propPositions = [
      [-3.5, -10], [3.4, -8], [-3.6, -22], [3.5, -28],
      [-3.3, -15], [3.3, -33], [-3.5, 5], [3.4, 8],
    ];
    for (let i = 0; i < propPositions.length; i++) {
      const [x, z] = propPositions[i];
      const type = i % 3;
      if (type === 0) {
        // Wooden crate.
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.6, 0.6),
          this.mats.wood,
        );
        crate.position.set(x, 0.3, z);
        crate.rotation.y = Math.random() * 0.5;
        crate.castShadow = true;
        crate.receiveShadow = true;
        this.root.add(crate);
      } else if (type === 1) {
        // Clay pot.
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.3, 0.5, 12),
          new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.85 }),
        );
        pot.position.set(x, 0.25, z);
        pot.castShadow = true;
        pot.receiveShadow = true;
        this.root.add(pot);
      } else {
        // Basket of marigolds.
        const basket = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.25, 0.3, 12),
          this.mats.woodLight,
        );
        basket.position.set(x, 0.15, z);
        basket.castShadow = true;
        this.root.add(basket);
        // Marigolds on top.
        for (let j = 0; j < 5; j++) {
          const flower = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 6),
            this.mats.marigold,
          );
          flower.position.set(
            x + (Math.random() - 0.5) * 0.4,
            0.32,
            z + (Math.random() - 0.5) * 0.4,
          );
          this.root.add(flower);
        }
      }
    }
  }

  _buildStreetBuildings() {
    // Left and right building rows.
    const sides = [
      { x: -10, sign: -1 },
      { x:  10, sign:  1 },
    ];
    for (const side of sides) {
      for (let i = 0; i < 10; i++) {
        const z = -42 + i * 9;
        this._buildHouse(side.x, z, side.sign);
      }
    }
  }

  _buildHouse(x, z, facing) {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    grp.rotation.y = facing < 0 ? Math.PI / 2 : -Math.PI / 2;
    // Vary the building proportions and palette.
    const w = 4 + Math.random() * 1.5;
    const h = 3 + Math.random() * 2.5;
    const d = 5 + Math.random() * 1.5;
    // Choose one of 4 wall materials for variety.
    const wallMats = [this.mats.buildingWall, this.mats.buildingWall2, this.mats.buildingWall3, this.mats.buildingWall4];
    const wallMat = wallMats[Math.floor(Math.random() * wallMats.length)];
    // Body.
    const bodyGeo = new THREE.BoxGeometry(w, h, d);
    const body = new THREE.Mesh(bodyGeo, wallMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    grp.add(body);
    // Cornice below the roof (decorative band).
    const corniceGeo = new THREE.BoxGeometry(w + 0.3, 0.25, d + 0.3);
    const cornice = new THREE.Mesh(corniceGeo, this.mats.buildingRoof);
    cornice.position.y = h - 0.2;
    cornice.castShadow = true;
    grp.add(cornice);
    // Roof slab.
    const roofGeo = new THREE.BoxGeometry(w + 0.4, 0.2, d + 0.4);
    const roof = new THREE.Mesh(roofGeo, this.mats.buildingRoof);
    roof.position.y = h + 0.1;
    roof.castShadow = true;
    grp.add(roof);
    // Parapet on the roof (low wall).
    const parapetMat = this.mats.buildingWall2;
    const parapetFront = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, 0.1), parapetMat);
    parapetFront.position.set(0, h + 0.4, d / 2 + 0.15);
    parapetFront.castShadow = true;
    grp.add(parapetFront);
    const parapetBack = parapetFront.clone();
    parapetBack.position.z = -(d / 2 + 0.15);
    grp.add(parapetBack);
    const parapetLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, d + 0.4), parapetMat);
    parapetLeft.position.set(-(w / 2 + 0.15), h + 0.4, 0);
    grp.add(parapetLeft);
    const parapetRight = parapetLeft.clone();
    parapetRight.position.x = w / 2 + 0.15;
    grp.add(parapetRight);

    // Upper floor (sometimes).
    if (Math.random() > 0.4) {
      const upperW = w * 0.7;
      const upperH = 1.8;
      const upperD = d * 0.7;
      const upperGeo = new THREE.BoxGeometry(upperW, upperH, upperD);
      const upper = new THREE.Mesh(upperGeo, wallMat);
      upper.position.y = h + 0.8 + upperH / 2;
      upper.castShadow = true;
      grp.add(upper);
      // Upper cornice.
      const upperCornice = new THREE.Mesh(
        new THREE.BoxGeometry(upperW + 0.25, 0.2, upperD + 0.25),
        this.mats.buildingRoof,
      );
      upperCornice.position.y = h + 0.8 + upperH;
      grp.add(upperCornice);
    }

    // Windows with depth (frames + emissive panes).
    const winColorChoice = Math.random();
    const winMat = winColorChoice < 0.6 ? this.mats.windowEmissive
                  : winColorChoice < 0.85 ? this.mats.windowEmissiveWarm
                  : this.mats.windowEmissiveCool;
    const winFrameMat = this.mats.wood;
    const winCount = 3;
    for (let i = 0; i < winCount; i++) {
      // Window frame.
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.7, 0.08),
        winFrameMat,
      );
      frame.position.set(-w / 2 + 0.7 + i * 1.1, h * 0.55, d / 2 + 0.04);
      grp.add(frame);
      // Emissive pane.
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.6),
        winMat,
      );
      pane.position.set(-w / 2 + 0.7 + i * 1.1, h * 0.55, d / 2 + 0.09);
      grp.add(pane);
      // Small balcony under some windows.
      if (Math.random() > 0.6) {
        const balcony = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.08, 0.25),
          this.mats.woodLight,
        );
        balcony.position.set(-w / 2 + 0.7 + i * 1.1, h * 0.4, d / 2 + 0.12);
        balcony.castShadow = true;
        grp.add(balcony);
      }
    }

    // Door (recessed).
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 1.55, 0.08),
      this.mats.wood,
    );
    doorFrame.position.set(0, 0.78, d / 2 + 0.04);
    grp.add(doorFrame);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.85 }),
    );
    door.position.set(0, 0.75, d / 2 + 0.09);
    grp.add(door);
    // Diya/lamp beside the door.
    const doorLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      this.mats.lampGlow,
    );
    doorLamp.position.set(0.6, 1.3, d / 2 + 0.08);
    grp.add(doorLamp);
    const doorLight = new THREE.PointLight(0xffd080, 0.4, 3.0, 2.0);
    doorLight.position.copy(doorLamp.position);
    grp.add(doorLight);

    // A small festival flag on the roof.
    if (Math.random() > 0.4) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6),
        this.mats.wood,
      );
      pole.position.y = h + 1.0;
      grp.add(pole);
      const flagGeo = new THREE.PlaneGeometry(0.6, 0.4);
      const flag = new THREE.Mesh(flagGeo, Math.random() > 0.5 ? this.mats.flag : this.mats.flag2);
      flag.position.set(0.32, h + 1.3, 0);
      grp.add(flag);
    }
    // Marigold string over the door.
    const garland = new THREE.Group();
    const garlandCount = 6;
    for (let i = 0; i < garlandCount; i++) {
      const t = i / (garlandCount - 1);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        this.mats.marigold,
      );
      sphere.position.set(-0.5 + t * 1.0, 1.7 - Math.sin(t * Math.PI) * 0.15, d / 2 + 0.1);
      garland.add(sphere);
    }
    grp.add(garland);
    this.root.add(grp);
  }

  _buildFlags() {
    // Arch of festival flags spanning the street at intervals.
    for (let i = 0; i < 6; i++) {
      const z = -36 + i * 14;
      // Two posts.
      for (const x of [-4, 4]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.1, 4.5, 6),
          this.mats.wood,
        );
        post.position.set(x, 2.25, z);
        post.castShadow = true;
        this.root.add(post);
      }
      // Banner between posts.
      const bannerGeo = new THREE.PlaneGeometry(8, 0.6);
      const banner = new THREE.Mesh(bannerGeo, i % 2 === 0 ? this.mats.banner : this.mats.banner2);
      banner.position.set(0, 4.3, z);
      this.root.add(banner);
      // Hanging mini-flags.
      for (let j = 0; j < 6; j++) {
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, 0.4),
          j % 2 === 0 ? this.mats.flag : this.mats.flag2,
        );
        flag.position.set(-3.5 + j * 1.4, 3.6, z);
        this.root.add(flag);
      }
    }
  }

  _buildMarigoldGarlands() {
    // Two garlands crossing the street.
    for (let i = 0; i < 4; i++) {
      const z = -30 + i * 16;
      const grp = new THREE.Group();
      const count = 14;
      for (let j = 0; j < count; j++) {
        const t = j / (count - 1);
        const x = -4 + t * 8;
        // Catenary dip.
        const y = 4.0 - Math.sin(t * Math.PI) * 0.7;
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 6),
          this.mats.marigold,
        );
        sphere.position.set(x, y, z);
        grp.add(sphere);
      }
      this.root.add(grp);
    }
  }

  _buildMandap() {
    // Large ceremonial mandap at z=12, centered.
    const grp = new THREE.Group();
    grp.position.set(0, 0, 12);
    // Stage platform.
    const stageGeo = new THREE.BoxGeometry(10, 0.5, 8);
    const stage = new THREE.Mesh(stageGeo, this.mats.woodLight);
    stage.position.y = 0.25;
    stage.castShadow = true;
    stage.receiveShadow = true;
    grp.add(stage);
    // Four pillars.
    const pillarPositions = [[-4, 0, -3], [4, 0, -3], [-4, 0, 3], [4, 0, 3]];
    for (const p of pillarPositions) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.3, 5, 16),
        this.mats.pillar,
      );
      pillar.position.set(p[0], 2.75, p[2]);
      pillar.castShadow = true;
      grp.add(pillar);
      // Capital.
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.3, 0.7),
        this.mats.gold,
      );
      cap.position.set(p[0], 5.4, p[2]);
      grp.add(cap);
      // Decorative bells on each pillar.
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 8),
        this.mats.gold,
      );
      bell.position.set(p[0], 5.8, p[2]);
      grp.add(bell);
      this.bells.push({ mesh: bell, phase: Math.random() * Math.PI * 2, struck: false, swaying: 0 });
    }
    // Canopy roof.
    const roofGeo = new THREE.ConeGeometry(7, 2.5, 4);
    const roof = new THREE.Mesh(roofGeo, this.mats.red);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 6.7;
    roof.castShadow = true;
    grp.add(roof);
    // Top spire.
    const spireGeo = new THREE.ConeGeometry(0.3, 1.5, 8);
    const spire = new THREE.Mesh(spireGeo, this.mats.gold);
    spire.position.y = 8.5;
    grp.add(spire);
    // The main Ganesh seat (empty - the hero will appear here).
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.4, 1.8),
      this.mats.gold,
    );
    seat.position.set(0, 0.7, 0);
    grp.add(seat);
    // Decorative diyas around the seat.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * 1.5;
      const z = Math.sin(a) * 1.2;
      const diya = this._makeDiya();
      diya.position.set(x, 0.5, z);
      grp.add(diya);
    }
    this.root.add(grp);
    this.mandap = grp;
    // Trigger for the cinematic reveal.
    this.triggers.push({
      position: new THREE.Vector3(0, 0, 8),
      radius: 3.5,
      onEnter: () => this.opts.onMandapEnter?.(),
      fired: false,
      name: "mandap_reveal",
    });
  }

  _makeDiya() {
    const grp = new THREE.Group();
    // Bowl.
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      this.mats.diya,
    );
    bowl.scale.y = 0.5;
    grp.add(bowl);
    // Flame (small cone).
    const flameGeo = new THREE.ConeGeometry(0.05, 0.15, 6);
    const flame = new THREE.Mesh(flameGeo, this.mats.flame);
    flame.position.y = 0.1;
    flame.visible = false;
    grp.add(flame);
    // Track this diya for puzzle state.
    const diyaData = { mesh: grp, flame, lit: false, litTime: 0 };
    this.diyas.push(diyaData);
    return grp;
  }

  _buildTemple() {
    // Old temple at the far end (z=-30), behind the street.
    const grp = new THREE.Group();
    grp.position.set(0, 0, -30);
    // Temple base.
    const baseGeo = new THREE.BoxGeometry(14, 0.8, 12);
    const base = new THREE.Mesh(baseGeo, this.mats.templeStoneDark);
    base.position.y = 0.4;
    base.receiveShadow = true;
    base.castShadow = true;
    grp.add(base);
    // Temple body.
    const bodyGeo = new THREE.BoxGeometry(12, 6, 10);
    const body = new THREE.Mesh(bodyGeo, this.mats.templeStone);
    body.position.y = 3.8;
    body.castShadow = true;
    body.receiveShadow = true;
    grp.add(body);
    // Temple roof (stepped pyramid).
    for (let i = 0; i < 3; i++) {
      const w = 11 - i * 1.5;
      const h = 0.8;
      const d = 9 - i * 1.5;
      const tier = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mats.templeStone);
      tier.position.y = 7 + i * h;
      tier.castShadow = true;
      grp.add(tier);
    }
    // Spire on top.
    const spireGeo = new THREE.ConeGeometry(0.8, 2.5, 8);
    const spire = new THREE.Mesh(spireGeo, this.mats.gold);
    spire.position.y = 9.7;
    grp.add(spire);
    // Main door (blocked initially by Vighna).
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(3, 4, 0.4),
      this.mats.templeStoneDark,
    );
    doorFrame.position.set(0, 2.4, 5.2);
    grp.add(doorFrame);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.6, 0.1),
      this.mats.vighnaRock,
    );
    door.position.set(0, 2.2, 5.4);
    door.name = "temple_door";
    door.userData.isVighna = true;
    door.userData.crackId = "temple_main";
    grp.add(door);
    this.doors.push({ mesh: door, open: false, opening: 0 });
    // Four temple pillars flanking the door.
    for (const x of [-3, 3]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.45, 5, 16),
        this.mats.templeStone,
      );
      pillar.position.set(x, 2.5, 5);
      pillar.castShadow = true;
      grp.add(pillar);
    }
    // Four puzzle diyas inside the temple.
    const diyaColors = [0xffa040, 0xff8030, 0xffe080, 0xff6020];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const x = Math.cos(angle) * 2.5;
      const z = Math.sin(angle) * 2.5;
      const diya = this._makeDiya();
      diya.position.set(x, 0.8, z);
      diya.userData.puzzleOrder = i + 1;
      diya.userData.isPuzzleDiya = true;
      grp.add(diya);
    }
    // A faded symbol on the wall (clue).
    const symbolGeo = new THREE.CircleGeometry(0.6, 32);
    const symbolCanvas = this._makeSymbolTexture();
    const symbolMat = new THREE.MeshBasicMaterial({
      map: symbolCanvas, transparent: true, opacity: 0.35,
    });
    const symbol = new THREE.Mesh(symbolGeo, symbolMat);
    symbol.position.set(0, 4.5, 5.05);
    grp.add(symbol);
    this.templeSymbol = symbol;
    // Mooshak tunnel entrance (small hole near the temple base).
    const tunnelGeo = new THREE.CircleGeometry(0.5, 16);
    const tunnelMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnel.position.set(4, 0.5, 4);
    tunnel.rotation.y = -Math.PI / 4;
    grp.add(tunnel);
    this.mooshakTunnel = tunnel;
    this.root.add(grp);
    this.temple = grp;
  }

  _makeSymbolTexture() {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#ffc966";
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Lotus-like symbol.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = 64 + Math.cos(a) * 40;
      const y = 64 + Math.sin(a) * 40;
      ctx.moveTo(64, 64);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(64, 64, 18, 0, Math.PI * 2);
    ctx.stroke();
    // Numbers around the petals (1-4 for the diya puzzle order).
    ctx.fillStyle = "#ffc966";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labels = ["1", "3", "2", "4"]; // intentional scramble = the puzzle order
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(labels[i], 64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  _buildRooftops() {
    // A connected rooftop area accessible via ladder at z=22.
    const grp = new THREE.Group();
    grp.position.set(0, 4.5, 22);
    // Main platform.
    const plat = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.3, 8),
      this.mats.rooftop,
    );
    plat.position.y = 0;
    plat.receiveShadow = true;
    grp.add(plat);
    // Railing (low walls).
    for (const [x, z, w, d] of [
      [-4, 0, 0.3, 8], [4, 0, 0.3, 8], [0, -4, 8, 0.3],
    ]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(w, 1.0, d),
        this.mats.woodLight,
      );
      rail.position.set(x, 0.65, z);
      rail.castShadow = true;
      grp.add(rail);
    }
    // Path to next rooftop (a narrow bridge).
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.2, 4),
      this.mats.wood,
    );
    bridge.position.set(0, 0, 6);
    grp.add(bridge);
    // Second platform.
    const plat2 = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.3, 6),
      this.mats.rooftop,
    );
    plat2.position.set(0, 0, 10);
    plat2.receiveShadow = true;
    grp.add(plat2);
    // A flag on the second platform.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3, 6),
      this.mats.wood,
    );
    pole.position.set(0, 1.5, 10);
    grp.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.5),
      this.mats.flag,
    );
    flag.position.set(0.4, 2.6, 10);
    grp.add(flag);
    // Ladder to access (visual; gameplay uses interaction prompt).
    const ladder = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 4.5, 0.1),
      this.mats.wood,
    );
    ladder.position.set(0, 2.25, -4);
    grp.add(ladder);
    this.root.add(grp);
    this.rooftops = grp;
    // Shortcut (memory system): opening this path will be remembered.
    this.triggers.push({
      position: new THREE.Vector3(0, 0, 22),
      radius: 3.0,
      onEnter: () => this.opts.onRooftopEnter?.(),
      fired: false,
      name: "rooftop_shortcut",
    });
  }

  _buildRiverfront() {
    // Ghat area at the far end (z=40).
    const grp = new THREE.Group();
    grp.position.set(0, 0, 38);
    // Steps down to the water.
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.5, 1.5),
        this.mats.templeStone,
      );
      step.position.set(0, 0.25 - i * 0.4, -3 + i * 1.5);
      step.receiveShadow = true;
      grp.add(step);
    }
    // Riverbed water plane.
    const waterGeo = new THREE.PlaneGeometry(40, 30);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.mats.water);
    water.position.set(0, -1.5, 8);
    water.receiveShadow = false;
    grp.add(water);
    // Floating diyas.
    for (let i = 0; i < 12; i++) {
      const diya = this._makeDiya();
      const a = (i / 12) * Math.PI * 2;
      const r = 3 + Math.random() * 4;
      diya.position.set(Math.cos(a) * r, -1.35, 8 + Math.sin(a) * r * 0.4);
      grp.add(diya);
    }
    // Mist (low-opacity large spheres).
    for (let i = 0; i < 5; i++) {
      const mist = new THREE.Mesh(
        new THREE.SphereGeometry(2 + Math.random(), 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xa0a0c0, transparent: true, opacity: 0.15, depthWrite: false }),
      );
      mist.position.set((Math.random() - 0.5) * 12, 0, 8 + (Math.random() - 0.5) * 8);
      mist.scale.y = 0.4;
      grp.add(mist);
    }
    // Distant temple silhouette (background).
    const distant = new THREE.Mesh(
      new THREE.ConeGeometry(3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x0a0608 }),
    );
    distant.position.set(-15, 4, 22);
    grp.add(distant);
    const distant2 = new THREE.Mesh(
      new THREE.ConeGeometry(2, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x0a0608 }),
    );
    distant2.position.set(15, 3, 22);
    grp.add(distant2);
    this.root.add(grp);
    this.riverfront = grp;
  }

  _buildNPCs() {
    // Stylized low-poly NPCs placed along the street.
    const colors = [0xff8a3a, 0xb8341c, 0xffc966, 0xf5ecd9, 0x4a7a3a, 0x8a5a3a];
    const cap = performanceManager.npcCountCap;
    const positions = [];
    for (let i = 0; i < cap; i++) {
      // Distribute along the street and around the mandap.
      const z = -38 + (i % 6) * 8 + Math.random() * 3;
      const x = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 2);
      positions.push([x, 0, z]);
    }
    // A few NPCs near the mandap.
    positions.push([2.5, 0, 14], [-2.5, 0, 14], [3, 0, 9], [-3, 0, 9]);
    // A few near the temple.
    positions.push([2.5, 0, -25], [-2.5, 0, -25]);
    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      const color = colors[i % colors.length];
      const npc = this._makeNPC(color, i);
      npc.position.set(x, y, z);
      npc.rotation.y = Math.random() * Math.PI * 2;
      this.root.add(npc);
      this.npcs.push({
        mesh: npc,
        baseY: y,
        basePos: new THREE.Vector3(x, y, z),
        phase: Math.random() * Math.PI * 2,
        frozen: false,
        activity: i % 4,  // 0=walking, 1=talking, 2=diya, 3=flower
        speed: 0.3 + Math.random() * 0.3,
      });
    }
  }

  _makeNPC(color, idx) {
    const grp = new THREE.Group();
    // Torso (tapered cylinder).
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.30, 1.0, 10),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    body.position.y = 1.05;
    body.castShadow = true;
    grp.add(body);
    // Lower garment (dhoti-style — slightly wider cylinder).
    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.32, 0.7, 10),
      new THREE.MeshStandardMaterial({ color: 0xf5ecd9, roughness: 0.85 }),
    );
    lower.position.y = 0.4;
    lower.castShadow = true;
    grp.add(lower);
    // Head (sphere with neck).
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.10, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xc89060, roughness: 0.7 }),
    );
    neck.position.y = 1.62;
    grp.add(neck);
    const headColor = [0xc89060, 0x8a5a3a, 0xa87040, 0x604020][idx % 4];
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 16, 12),
      new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.7 }),
    );
    head.position.y = 1.78;
    head.castShadow = true;
    grp.add(head);
    // Optional accessory: turban.
    if (idx % 3 === 0) {
      const turban = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xff8a3a, roughness: 0.75 }),
      );
      turban.position.y = 1.86;
      grp.add(turban);
    } else if (idx % 3 === 1) {
      // Hair (smaller dome).
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.5),
        new THREE.MeshStandardMaterial({ color: 0x1a0808, roughness: 0.9 }),
      );
      hair.position.y = 1.84;
      grp.add(hair);
    }
    // Holding item: diya, flower garland, or nothing.
    if (idx % 4 === 2) {
      // Diya.
      const diya = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        this.mats.diya,
      );
      diya.scale.y = 0.5;
      diya.position.set(0.25, 1.15, 0.1);
      grp.add(diya);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.12, 6),
        this.mats.flame,
      );
      flame.position.set(0.25, 1.24, 0.1);
      grp.add(flame);
    } else if (idx % 4 === 3) {
      // Flower garland.
      for (let g = 0; g < 4; g++) {
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 6),
          this.mats.marigold,
        );
        flower.position.set(0.22 + g * 0.06, 1.2, 0.1);
        grp.add(flower);
      }
    }
    // Arms (two cylinders) — slight outward angle.
    for (const sign of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.8 }),
      );
      arm.position.set(sign * 0.28, 1.0, 0);
      arm.rotation.z = sign * 0.15;
      grp.add(arm);
    }
    // Legs (two cylinders) — separate so they can animate.
    for (const sign of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.06, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.85 }),
      );
      leg.position.set(sign * 0.10, 0.15, 0);
      leg.name = `leg_${sign > 0 ? "R" : "L"}`;
      grp.add(leg);
    }
    return grp;
  }

  _buildLampPosts() {
    // Tall lamp posts along the street.
    for (let i = 0; i < 8; i++) {
      const z = -38 + i * 11;
      for (const x of [-6, 6]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.12, 4, 8),
          this.mats.lampPost,
        );
        post.position.set(x, 2, z);
        post.castShadow = true;
        this.root.add(post);
        // Lamp head.
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 12, 8),
          this.mats.lampGlow,
        );
        head.position.set(x, 4.1, z);
        this.root.add(head);
        // Point light (capped).
        const light = new THREE.PointLight(0xffd080, 1.0, 8, 2.0);
        light.position.set(x, 4.0, z);
        this.root.add(light);
        this.lamps.push({ head, light, on: true });
      }
    }
  }

  _buildVighnaCracks() {
    // Several supernatural dark cracks scattered around the world.
    const positions = [
      [0, 0.02, -10],   // on the street
      [3, 0.02, 5],     // near the mandap
      [-3, 0.02, 0],
      [0, 0.02, -20],   // near the temple approach
    ];
    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      const geo = this._makeCrackGeometry();
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff2030,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const crack = new THREE.Mesh(geo, mat);
      crack.rotation.x = -Math.PI / 2;
      crack.position.set(x, y, z);
      crack.userData.crackId = "crack_" + i;
      crack.userData.isVighna = true;
      this.root.add(crack);
      this.vighnaCracks.push({ mesh: crack, broken: false, intensity: 0 });
    }
  }

  _makeCrackGeometry() {
    // A jagged shape made from a star polygon.
    const shape = new THREE.Shape();
    const points = 12;
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = (i % 2 === 0 ? 1.0 : 0.3) * (0.6 + Math.random() * 0.4);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    return new THREE.ShapeGeometry(shape, 1);
  }

  _buildTriggers() {
    // Already added per-area triggers above.
    // Add a temple puzzle trigger.
    this.triggers.push({
      position: new THREE.Vector3(0, 0, -25),
      radius: 4.0,
      onEnter: () => this.opts.onTempleApproach?.(),
      fired: false,
      name: "temple_approach",
    });
    // Boss arena trigger.
    this.triggers.push({
      position: new THREE.Vector3(0, 0, -38),
      radius: 3.0,
      onEnter: () => this.opts.onBossArenaEnter?.(),
      fired: false,
      name: "boss_arena",
    });
    // Riverfront trigger.
    this.triggers.push({
      position: new THREE.Vector3(0, 0, 32),
      radius: 4.0,
      onEnter: () => this.opts.onRiverfrontEnter?.(),
      fired: false,
      name: "riverfront",
    });
  }

  /** Light a diya (puzzle + decoration). Returns true if newly lit. */
  lightDiya(diyaMesh) {
    const diya = this.diyas.find(d => d.mesh === diyaMesh);
    if (!diya || diya.lit) return false;
    diya.lit = true;
    diya.flame.visible = true;
    diya.litTime = performance.now();
    return true;
  }

  /** Strike a bell — used in temple puzzle. */
  strikeBell(bellMesh) {
    const bell = this.bells.find(b => b.mesh === bellMesh);
    if (!bell) return false;
    bell.swaying = 1.0;
    bell.struck = true;
    return true;
  }

  /** Get the temple door (for opening during puzzle). */
  getTempleDoor() {
    return this.doors.find(d => d.mesh.name === "temple_door");
  }

  /** Open the temple door. */
  openTempleDoor() {
    const door = this.getTempleDoor();
    if (!door) return;
    door.open = true;
  }

  /** Trigger a Vighna crack visual. */
  activateVighnaCrack(crackId) {
    const crack = this.vighnaCracks.find(c => c.mesh.userData.crackId === crackId);
    if (!crack || crack.broken) return;
    crack.mesh.material.opacity = 0.9;
    crack.intensity = 1.0;
  }

  /** Break a Vighna crack. */
  breakVighnaCrack(crackId) {
    const crack = this.vighnaCracks.find(c => c.mesh.userData.crackId === crackId);
    if (!crack || crack.broken) return;
    crack.broken = true;
    crack.mesh.material.opacity = 0;
    crack.intensity = 0;
  }

  /** Time-freeze all NPCs and lamps. */
  freezeWorld() {
    for (const npc of this.npcs) npc.frozen = true;
    for (const lamp of this.lamps) {
      if (lamp.on) {
        lamp.on = false;
        lamp.head.material = this.mats.lampPost;
        lamp.light.intensity = 0;
      }
    }
  }

  unfreezeWorld() {
    for (const npc of this.npcs) npc.frozen = false;
    for (const lamp of this.lamps) {
      if (!lamp.on) {
        lamp.on = true;
        lamp.head.material = this.mats.lampGlow;
        lamp.light.intensity = 1.0;
      }
    }
  }

  /** Update the world: NPCs, lamps, bells, doors, triggers. */
  update(dt, playerPos) {
    // NPC animation.
    const t = performance.now() * 0.001;
    for (const npc of this.npcs) {
      if (!npc.frozen) {
        // Subtle bob + sway based on activity.
        npc.mesh.position.y = npc.baseY + Math.sin(t * 1.4 + npc.phase) * 0.04;
        if (npc.activity === 0) {
          // Walking: drift slowly along the street.
          const speed = npc.speed;
          npc.mesh.position.z += Math.sin(t * 0.5 + npc.phase) * speed * dt;
          // Constrain.
          if (npc.mesh.position.z > 18) npc.mesh.position.z = -38;
          if (npc.mesh.position.z < -38) npc.mesh.position.z = 18;
          // Animate legs swinging.
          const legL = npc.mesh.getObjectByName("leg_L");
          const legR = npc.mesh.getObjectByName("leg_R");
          if (legL && legR) {
            const swing = Math.sin(t * 6 + npc.phase) * 0.4;
            legL.rotation.x = swing;
            legR.rotation.x = -swing;
          }
        }
      }
    }
    // Lamps: flicker.
    for (const lamp of this.lamps) {
      if (lamp.on) {
        lamp.light.intensity = 0.9 + Math.sin(t * 8 + lamp.light.position.x) * 0.08;
      }
    }
    // Bells sway if struck.
    for (const bell of this.bells) {
      if (bell.swaying > 0) {
        bell.swaying -= dt * 1.5;
        const phase = t * 8;
        bell.mesh.rotation.z = Math.sin(phase) * bell.swaying * 0.2;
        if (bell.swaying <= 0) {
          bell.swaying = 0;
          bell.mesh.rotation.z = 0;
        }
      }
    }
    // Doors open.
    for (const door of this.doors) {
      if (door.open && door.opening < 1) {
        door.opening += dt * 0.6;
        door.opening = Math.min(1, door.opening);
        door.mesh.position.y = 2.2 - door.opening * 3.6;
        door.mesh.material.opacity = 1 - door.opening;
        door.mesh.material.transparent = true;
      }
    }
    // Vighna crack pulse.
    for (const crack of this.vighnaCracks) {
      if (!crack.broken && crack.intensity > 0) {
        const pulse = 0.5 + Math.sin(t * 4) * 0.3;
        crack.mesh.material.opacity = pulse * crack.intensity;
      }
    }
    // Triggers.
    if (playerPos) {
      for (const trig of this.triggers) {
        if (trig.fired) continue;
        const d = trig.position.distanceTo(playerPos);
        if (d < trig.radius) {
          trig.fired = true;
          trig.onEnter?.();
        }
      }
    }
  }

  /** Get the nearest interactable to a position within range. */
  getNearestInteractable(pos, maxDist = 2.5) {
    let best = null;
    let bestDist = maxDist;
    for (const d of this.diyas) {
      const dist = d.mesh.position.distanceTo(pos);
      if (dist < bestDist) {
        bestDist = dist;
        best = { type: "diya", object: d.mesh, position: d.mesh.position.clone() };
      }
    }
    for (const b of this.bells) {
      const dist = b.mesh.position.distanceTo(pos);
      if (dist < bestDist + 1) {
        bestDist = dist;
        best = { type: "bell", object: b.mesh, position: b.mesh.position.clone() };
      }
    }
    for (const t of this.triggers) {
      if (t.name === "rooftop_shortcut") {
        const dist = t.position.distanceTo(pos);
        if (dist < bestDist + 1) {
          bestDist = dist;
          best = { type: "shortcut", object: null, position: t.position.clone() };
        }
      }
    }
    return best;
  }

  dispose() {
    this.scene.remove(this.root);
    // Dispose all materials and geometries.
    this.root.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      }
    });
    Object.values(this.mats).forEach(m => m.dispose());
  }
}

export default FestivalCity;
