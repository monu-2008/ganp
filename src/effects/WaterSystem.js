// ============================================================
// effects/WaterSystem.js
// Mobile-friendly river: animated plane with vertex displacement and
// shader-based shimmer. Subtle fake reflections (no SSR cost).
// ============================================================

import * as THREE from "three";

export class WaterSystem {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.size = opts.size || 60;
    this.segments = opts.segments || 40;
    this.color = opts.color || 0x10243a;
    this.deepColor = opts.deepColor || 0x081420;
    this._build();
  }

  _build() {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);
    // Custom shader with multi-layer animated sine waves + shimmer + fake reflections.
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(this.color) },
        uDeepColor: { value: new THREE.Color(this.deepColor) },
        uShimmer: { value: 0.25 },
        uLampColor: { value: new THREE.Color(0xffa040) },
        uLampPos1: { value: new THREE.Vector3(-4, 0.5, 4) },
        uLampPos2: { value: new THREE.Vector3(3, 0.5, 6) },
        uLampPos3: { value: new THREE.Vector3(0, 0.5, -3) },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vPos;
        varying float vWave;
        varying vec3 vWorldPos;
        void main() {
          vec3 p = position;
          // Multiple wave layers for richer surface.
          float w1 = sin(p.x * 0.6 + uTime * 1.4) * 0.10;
          float w2 = sin(p.z * 0.8 + uTime * 1.1) * 0.07;
          float w3 = sin((p.x + p.z) * 0.5 + uTime * 0.7) * 0.05;
          float w4 = sin(p.x * 1.8 + uTime * 2.2) * 0.025;
          float wave = w1 + w2 + w3 + w4;
          p.y += wave;
          vWave = wave;
          vPos = p;
          vec4 worldPos = modelMatrix * vec4(p, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uDeepColor;
        uniform float uShimmer;
        uniform float uTime;
        uniform vec3 uLampColor;
        uniform vec3 uLampPos1;
        uniform vec3 uLampPos2;
        uniform vec3 uLampPos3;
        varying vec3 vPos;
        varying vec3 vWorldPos;
        varying float vWave;
        void main() {
          float t = smoothstep(-0.15, 0.15, vWave);
          vec3 col = mix(uDeepColor, uColor, t);
          // Shimmer streaks (long thin highlights).
          float shimmer = sin(vWorldPos.x * 4.0 + uTime * 2.0) * sin(vWorldPos.z * 3.5 + uTime * 1.7);
          shimmer = max(0.0, shimmer);
          col += vec3(uShimmer) * shimmer;
          // Fake lamp reflections — bright spots near lamp positions.
          for (int i = 0; i < 3; i++) {
            vec3 lp = (i == 0) ? uLampPos1 : (i == 1) ? uLampPos2 : uLampPos3;
            float d = distance(vWorldPos.xz, lp.xz);
            float reflection = smoothstep(3.0, 0.0, d);
            // Wobble the reflection vertically.
            float wobble = sin(uTime * 3.0 + d * 4.0) * 0.5 + 0.5;
            col += uLampColor * reflection * wobble * 0.6;
          }
          // Distance fade to dark.
          float d = length(vWorldPos.xz) / 30.0;
          col = mix(col, uDeepColor * 0.5, smoothstep(0.6, 1.0, d));
          gl_FragColor = vec4(col, 0.92);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.mat = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 1;
    this.scene.add(this.mesh);

    // Add floating diya lights along the water.
    this._addFloatingDiyas();
  }

  _addFloatingDiyas() {
    this.diyas = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 8 + (i % 3) * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      // Diya = small flattened sphere (orange/yellow emissive).
      const geo = new THREE.SphereGeometry(0.12, 10, 6);
      geo.scale(1.0, 0.4, 1.0);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
      const diya = new THREE.Mesh(geo, mat);
      diya.position.set(x, 0.1, z);
      this.mesh.add(diya);
      // Tiny point light (cheap, but only on Balanced+).
      const light = new THREE.PointLight(0xffa040, 0.5, 4.0, 2.0);
      light.position.copy(diya.position);
      this.mesh.add(light);
      this.diyas.push({ mesh: diya, light, baseX: x, baseZ: z, phase: i });
    }
  }

  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z);
  }

  update(dt) {
    this.mat.uniforms.uTime.value += dt;
    // Animate floating diyas in a slow circle.
    const t = performance.now() * 0.0003;
    for (const d of this.diyas) {
      const a = t + d.phase * 0.7;
      d.mesh.position.x = d.baseX + Math.sin(a) * 0.6;
      d.mesh.position.z = d.baseZ + Math.cos(a) * 0.6;
      d.mesh.position.y = 0.1 + Math.sin(t * 4 + d.phase) * 0.02;
      d.light.position.copy(d.mesh.position);
      // Flicker.
      d.light.intensity = 0.4 + Math.sin(t * 12 + d.phase * 3) * 0.1;
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

export default WaterSystem;
