// ============================================================
// player/MooshakCharacter.js
// Mooshak (the divine mouse vāhana) — tiny traversal mode.
// Built procedurally from primitives for guaranteed availability.
// ============================================================

import * as THREE from "three";

export class MooshakCharacter {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = "MooshakRoot";
    this.root.visible = false;
    this.speed = 5.5;            // m/s, faster than Ganesh walk
    this.facing = 0;
    this.targetFacing = 0;
    this._build();
  }

  _build() {
    // Body (small egg-shape, warm brown).
    const bodyGeo = new THREE.SphereGeometry(0.18, 16, 12);
    bodyGeo.scale(1.3, 0.9, 1.0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8a5a3a,
      roughness: 0.7,
      metalness: 0.0,
    });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.castShadow = true;
    this.body.position.y = 0.18;
    this.root.add(this.body);

    // Head (sphere with snout).
    const headGeo = new THREE.SphereGeometry(0.13, 16, 12);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.castShadow = true;
    head.position.set(0.22, 0.24, 0);
    this.head = head;
    this.root.add(head);

    // Snout.
    const snoutGeo = new THREE.ConeGeometry(0.05, 0.14, 8);
    const snout = new THREE.Mesh(snoutGeo, new THREE.MeshStandardMaterial({
      color: 0xe8c9a0, roughness: 0.6,
    }));
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.34, 0.22, 0);
    head.add(snout);
    snout.position.set(0.12, -0.02, 0);

    // Ears (two flattened spheres).
    const earGeo = new THREE.SphereGeometry(0.06, 12, 8);
    earGeo.scale(1, 1, 0.2);
    const earMat = new THREE.MeshStandardMaterial({ color: 0xc77b4a, roughness: 0.7 });
    const earL = new THREE.Mesh(earGeo, earMat);
    earL.position.set(-0.02, 0.10, 0.06);
    earL.rotation.y = Math.PI / 2;
    head.add(earL);
    const earR = earL.clone();
    earR.position.z = -0.06;
    head.add(earR);

    // Eyes (tiny dark spheres).
    const eyeGeo = new THREE.SphereGeometry(0.018, 8, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x140808, roughness: 0.2 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(0.09, 0.04, 0.05);
    head.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.z = -0.05;
    head.add(eyeR);

    // Tail (thin tapered cylinder).
    const tailGeo = new THREE.CylinderGeometry(0.012, 0.002, 0.22, 6);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.set(-0.24, 0.18, 0);
    tail.rotation.z = Math.PI / 3;
    this.root.add(tail);
    this.tail = tail;

    // Four small legs.
    const legGeo = new THREE.CylinderGeometry(0.025, 0.02, 0.10, 6);
    this.legs = [];
    const legPositions = [
      [ 0.12, 0.05,  0.07],
      [ 0.12, 0.05, -0.07],
      [-0.10, 0.05,  0.07],
      [-0.10, 0.05, -0.07],
    ];
    for (const p of legPositions) {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(...p);
      leg.castShadow = true;
      this.body.add(leg);
      this.legs.push(leg);
    }

    // Small golden collar to denote divinity.
    const collarGeo = new THREE.TorusGeometry(0.085, 0.012, 8, 16);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xffc966, metalness: 1.0, roughness: 0.2,
    });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.set(0.18, 0.22, 0);
    collar.rotation.y = Math.PI / 2;
    head.add(collar);

    this._walkPhase = 0;
  }

  setVisible(v) {
    this.root.visible = v;
  }

  setPosition(x, y, z) {
    this.root.position.set(x, y, z);
  }

  setRotation(yaw) {
    this.facing = yaw;
    this.root.rotation.y = yaw;
  }

  faceToward(yaw, dt, speed = 8) {
    this.targetFacing = yaw;
    let diff = this.targetFacing - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += diff * (1 - Math.exp(-speed * dt));
    this.root.rotation.y = this.facing;
  }

  /** Update walk animation when moving. */
  update(dt, isMoving) {
    if (isMoving) {
      this._walkPhase += dt * 12;
      // Bob the body up and down.
      this.body.position.y = 0.18 + Math.abs(Math.sin(this._walkPhase)) * 0.02;
      // Swing the legs.
      for (let i = 0; i < this.legs.length; i++) {
        const phase = this._walkPhase + (i % 2) * Math.PI;
        this.legs[i].rotation.x = Math.sin(phase) * 0.4;
      }
      // Slight head bob.
      this.head.position.y = 0.24 + Math.sin(this._walkPhase * 0.5) * 0.01;
      // Tail swish.
      this.tail.rotation.y = Math.sin(this._walkPhase * 0.7) * 0.3;
    } else {
      // Idle: gentle breathing.
      const t = performance.now() * 0.002;
      this.body.position.y = 0.18 + Math.sin(t) * 0.005;
      this.tail.rotation.y = Math.sin(t * 0.7) * 0.15;
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      }
    });
  }
}

export default MooshakCharacter;
