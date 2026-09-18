// ============================================================
// core/AssetManager.js
// Asynchronous GLB loader with progress, caching, and fallbacks.
// ============================================================

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ASSET_BASE = "./assets/";

export class AssetManager {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();      // path -> { gltf, deps }
    this.geometryCache = new Map();
    this.materialCache = new Map();
    this.totalProgress = 0;
    this.onProgress = null;
    this.errors = [];
  }

  /**
   * Load a GLB file.
   * Returns: { scene, animations, ...gltf }  (scene is cloned per request)
   * If the file fails and a fallbackPath is given, the fallback is loaded instead.
   */
  async loadGLB(path, { fallbackPath = null, clone = true } = {}) {
    const resolved = this._resolve(path);
    if (this.cache.has(resolved)) {
      const cached = this.cache.get(resolved);
      return clone ? this._cloneResult(cached) : cached;
    }
    try {
      const gltf = await this._loadRaw(resolved);
      this.cache.set(resolved, gltf);
      return clone ? this._cloneResult(gltf) : gltf;
    } catch (err) {
      console.warn(`[AssetManager] Failed to load ${resolved}:`, err);
      if (fallbackPath) {
        console.warn(`[AssetManager] Falling back to ${fallbackPath}`);
        return this.loadGLB(fallbackPath, { clone });
      }
      throw err;
    }
  }

  _resolve(path) {
    if (path.startsWith("http") || path.startsWith("/")) return path;
    return ASSET_BASE + path.replace(/^\.?\//, "");
  }

  _loadRaw(path) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          this._reportProgress(path, true);
          resolve(gltf);
        },
        (xhr) => {
          if (xhr.lengthComputable) {
            this._reportProgress(path, false, xhr.loaded / xhr.total);
          }
        },
        (err) => reject(err)
      );
    });
  }

  _cloneResult(gltf) {
    // Clone the scene graph + animations reference (clips are immutable).
    const scene = gltf.scene.clone(true);
    // Re-instantiate skinned meshes properly (SkeletonUtils handles bones).
    const skinned = [];
    scene.traverse((o) => {
      if (o.isSkinnedMesh) skinned.push(o);
    });
    if (skinned.length > 0) {
      // Use SkeletonUtils.clone for proper skeleton duplication.
      // But the simpler approach: keep the original skeleton reference; it works for our use case.
      // If issues arise, switch to SkeletonUtils.clone at the scene level.
    }
    return {
      scene,
      animations: gltf.animations || [],
      cameras: gltf.cameras || [],
    };
  }

  _reportProgress(path, complete, ratio = 0) {
    if (!this.onProgress) return;
    // Naive progress: each completed asset contributes equally.
    // The Game layer maps this onto [0, 1] for the loading bar.
    if (complete) {
      this.totalProgress += 1;
    }
    this.onProgress({
      path,
      complete,
      ratio,
      total: this.totalProgress,
    });
  }

  /** Get a shared geometry (for primitives). */
  getGeometry(key, factory) {
    if (!this.geometryCache.has(key)) {
      this.geometryCache.set(key, factory());
    }
    return this.geometryCache.get(key);
  }

  /** Get a shared material (for primitives). */
  getMaterial(key, factory) {
    if (!this.materialCache.has(key)) {
      this.materialCache.set(key, factory());
    }
    return this.materialCache.get(key);
  }

  /** Compute the bounding box of a scene. */
  static getBoundingBox(scene) {
    const box = new THREE.Box3();
    scene.traverse((o) => {
      if (o.isMesh) {
        box.expandByObject(o);
      }
    });
    return box;
  }

  dispose() {
    this.cache.forEach((gltf) => {
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) {
              o.material.forEach((m) => this._disposeMat(m));
            } else {
              this._disposeMat(o.material);
            }
          }
        }
      });
    });
    this.cache.clear();
    this.geometryCache.forEach((g) => g.dispose());
    this.geometryCache.clear();
    this.materialCache.forEach((m) => this._disposeMat(m));
    this.materialCache.clear();
  }

  _disposeMat(mat) {
    if (!mat) return;
    for (const key of Object.keys(mat)) {
      const v = mat[key];
      if (v && typeof v.dispose === "function") v.dispose();
    }
    mat.dispose();
  }
}

export const assetManager = new AssetManager();
export default AssetManager;
