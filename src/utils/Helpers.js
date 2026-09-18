// ============================================================
// utils/Helpers.js — shared math & utility functions
// ============================================================

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const lerp = (a, b, t) => a + (b - a) * t;

export const damp = (a, b, lambda, dt) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

export const smoothstep = (t) => t * t * (3 - 2 * t);

export const easeInOut = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const easeInCubic = (t) => t * t * t;

export const TAU = Math.PI * 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

// Reusable temp vectors (avoid allocations in hot loops).
import * as THREE from "three";
export const _v1 = new THREE.Vector3();
export const _v2 = new THREE.Vector3();
export const _v3 = new THREE.Vector3();
export const _q1 = new THREE.Quaternion();
export const _q2 = new THREE.Quaternion();
export const _m1 = new THREE.Matrix4();
export const _e1 = new THREE.Euler();

export function distance2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function nowSeconds() {
  return performance.now() / 1000;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / 1024 / 1024).toFixed(2) + " MB";
}

export function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
}

export function isLandscape() {
  return window.innerWidth >= window.innerHeight;
}

export function waitFor(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
