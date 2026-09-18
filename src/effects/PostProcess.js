// ============================================================
// effects/PostProcess.js
// Post-processing pipeline: bloom + color grading + vignette +
// film grain + time-freeze desaturation/chromatic aberration.
// This single file takes the game from "functional" to "cinematic AAA".
// ============================================================

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { performanceManager } from "../core/PerformanceManager.js";

// Custom color-grade + vignette + grain shader.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uExposure: { value: 1.05 },
    uContrast: { value: 1.08 },
    uSaturation: { value: 1.0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uTintMix: { value: 0.0 },          // 0 = no tint, 1 = full tint
    uVignetteIntensity: { value: 0.55 },
    uVignetteFalloff: { value: 0.45 },
    uGrainAmount: { value: 0.04 },
    uChromaticAberration: { value: 0.0 }, // 0..1
    uDesaturate: { value: 0.0 },           // 0..1 (time-freeze effect)
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uFlashIntensity: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uTint;
    uniform float uTintMix;
    uniform float uVignetteIntensity;
    uniform float uVignetteFalloff;
    uniform float uGrainAmount;
    uniform float uChromaticAberration;
    uniform float uDesaturate;
    uniform vec3 uFlashColor;
    uniform float uFlashIntensity;
    varying vec2 vUv;

    // Simple hash for grain.
    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centerOffset = uv - 0.5;

      // Chromatic aberration (radial).
      vec3 col;
      if (uChromaticAberration > 0.001) {
        float strength = uChromaticAberration * 0.012;
        float r2 = dot(centerOffset, centerOffset);
        vec2 dir = normalize(centerOffset + vec2(0.0001));
        vec2 offsetR = uv + dir * strength * (1.0 + r2 * 2.0);
        vec2 offsetB = uv - dir * strength * (1.0 + r2 * 2.0);
        col.r = texture2D(tDiffuse, offsetR).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, offsetB).b;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }

      // Exposure.
      col *= uExposure;

      // Contrast (around 0.5 mid-gray).
      col = (col - 0.5) * uContrast + 0.5;

      // Saturation (with desaturation overlay for time-freeze).
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      float sat = uSaturation * (1.0 - uDesaturate);
      col = mix(vec3(luma), col, sat);

      // Tint.
      col = mix(col, col * uTint, uTintMix);

      // Vignette (smooth radial darkening).
      float dist = length(centerOffset);
      float vignette = smoothstep(0.8, uVignetteFalloff, dist);
      col *= 1.0 - vignette * uVignetteIntensity;

      // Film grain (animated).
      if (uGrainAmount > 0.001) {
        float g = hash(uv * vec2(1920.0, 1080.0) + uTime * 60.0);
        col += (g - 0.5) * uGrainAmount;
      }

      // Flash (for Vighna breaks, ability triggers).
      col = mix(col, uFlashColor, uFlashIntensity);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export const COLOR_GRADES = {
  // Per-chapter color grades (tint, saturation, exposure, vignette, grain).
  // Note: grain is kept very low because higher values look like compression artifacts in screenshots.
  boot:      { tint: [1.0, 1.0, 1.0], tintMix: 0.0, sat: 1.0, exp: 1.0, vig: 0.4, vigFall: 0.55, grain: 0.012, chrom: 0.0, desat: 0.0 },
  menu:      { tint: [1.0, 0.92, 0.78], tintMix: 0.18, sat: 0.95, exp: 1.0, vig: 0.45, vigFall: 0.5, grain: 0.012, chrom: 0.0, desat: 0.0 },
  festival:  { tint: [1.05, 0.96, 0.85], tintMix: 0.10, sat: 1.05, exp: 1.12, vig: 0.35, vigFall: 0.6, grain: 0.012, chrom: 0.0, desat: 0.0 },
  time_freeze: { tint: [0.82, 0.88, 1.0], tintMix: 0.10, sat: 0.95, exp: 1.15, vig: 0.3, vigFall: 0.6, grain: 0.010, chrom: 0.05, desat: 0.15 },
  vighna_break: { tint: [1.15, 0.92, 0.78], tintMix: 0.15, sat: 1.1, exp: 1.20, vig: 0.30, vigFall: 0.6, grain: 0.012, chrom: 0.04, desat: 0.0 },
  boss:      { tint: [1.1, 0.78, 0.7], tintMix: 0.12, sat: 0.98, exp: 1.10, vig: 0.35, vigFall: 0.5, grain: 0.012, chrom: 0.03, desat: 0.05 },
  riverfront: { tint: [0.85, 0.92, 1.08], tintMix: 0.10, sat: 0.98, exp: 1.12, vig: 0.30, vigFall: 0.55, grain: 0.012, chrom: 0.0, desat: 0.0 },
  ending:    { tint: [1.1, 1.0, 0.9], tintMix: 0.15, sat: 1.0, exp: 1.12, vig: 0.30, vigFall: 0.55, grain: 0.012, chrom: 0.0, desat: 0.0 },
};

export class PostProcess {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = performanceManager.settings.bloomEnabled !== false;
    this.composer = null;
    this.bloomPass = null;
    this.gradePass = null;
    this.outputPass = null;
    this.currentGrade = "festival";
    this.targetGrade = "festival";
    this.gradeBlend = 1.0;
    this.gradeLerpSpeed = 1.2;
    if (this.enabled) {
      this._build();
    }
  }

  _build() {
    this.composer = new EffectComposer(this.renderer);
    // RenderPass — renders the scene to a buffer.
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom — makes emissive materials (gold, gems, lamps, flames) glow.
    // Tuned for balance: visible glow without washing out the scene.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55,   // strength — moderate
      0.5,    // radius — medium falloff
      0.92    // threshold — only very bright pixels bloom (lamps, gems, eyes)
    );
    this.composer.addPass(this.bloomPass);

    // Custom grade pass — color grading + vignette + grain + chromatic aberration + flash.
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    // Output pass — handles color space conversion + tone mapping.
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    // Apply initial grade.
    this.setGrade("festival", true);
  }

  /** Set the current color grade. */
  setGrade(name, immediate = false) {
    if (!COLOR_GRADES[name]) return;
    this.targetGrade = name;
    if (immediate) {
      this.currentGrade = name;
      this.gradeBlend = 1.0;
      this._applyGrade(name, 1.0);
    }
  }

  _applyGrade(name, blend) {
    const g = COLOR_GRADES[name];
    if (!g || !this.gradePass) return;
    const u = this.gradePass.uniforms;
    u.uTint.value.setRGB(g.tint[0], g.tint[1], g.tint[2]);
    u.uTintMix.value = g.tintMix * blend;
    u.uSaturation.value = g.sat;
    u.uExposure.value = g.exp;
    u.uVignetteIntensity.value = g.vig;
    u.uVignetteFalloff.value = g.vigFall;
    u.uGrainAmount.value = g.grain;
    u.uChromaticAberration.value = g.chrom;
    u.uDesaturate.value = g.desat;
  }

  /** Trigger a screen flash (for Vighna breaks, ability triggers). */
  flash(color = 0xffe080, intensity = 0.6, duration = 0.4) {
    if (!this.gradePass) return;
    const u = this.gradePass.uniforms;
    u.uFlashColor.value.setHex(color);
    this._flashTarget = intensity;
    this._flashDecay = intensity / duration;
  }

  /** Update the post-processing pipeline. */
  update(dt) {
    if (!this.enabled || !this.composer) return;
    // Lerp grade toward target.
    if (this.currentGrade !== this.targetGrade) {
      this.gradeBlend = Math.min(1, this.gradeBlend + this.gradeLerpSpeed * dt);
      if (this.gradeBlend >= 1.0) {
        this.currentGrade = this.targetGrade;
        this.gradeBlend = 1.0;
      }
      this._applyGrade(this.targetGrade, this.gradeBlend);
    }
    // Update time uniform (for grain animation).
    if (this.gradePass) {
      this.gradePass.uniforms.uTime.value = performance.now() * 0.001;
      // Decay flash.
      if (this._flashTarget && this._flashTarget > 0) {
        this._flashTarget -= this._flashDecay * dt;
        if (this._flashTarget < 0) this._flashTarget = 0;
        this.gradePass.uniforms.uFlashIntensity.value = this._flashTarget;
      }
    }
  }

  /** Render via the composer (call instead of renderer.render). */
  render() {
    if (this.enabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /** Resize the composer. */
  setSize(width, height) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height);
    }
  }

  setBloomStrength(s) {
    if (this.bloomPass) this.bloomPass.strength = s;
  }

  dispose() {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
  }
}

export default PostProcess;
