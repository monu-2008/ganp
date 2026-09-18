// ============================================================
// scenes/BootScene.js
// Boot → Loading → Menu flow.
// ============================================================

import { waitFor } from "../utils/Helpers.js";

export class BootScene {
  constructor({ audioManager, assetManager }) {
    this.audio = audioManager;
    this.assets = assetManager;
    this.bootScreen = document.getElementById("boot-screen");
    this.loadingScreen = document.getElementById("loading-screen");
    this.loadingFill = document.getElementById("loading-progress-fill");
    this.loadingText = document.getElementById("loading-progress-text");
    this.loadingStatus = document.getElementById("loading-status");
  }

  showBoot() {
    this.bootScreen.classList.remove("hidden");
    this.loadingScreen.classList.add("hidden");
  }

  hideBoot() {
    this.bootScreen.classList.add("hidden");
  }

  showLoading() {
    this.bootScreen.classList.add("hidden");
    this.loadingScreen.classList.remove("hidden");
  }

  setProgress(ratio, status) {
    const pct = Math.round(ratio * 100);
    this.loadingFill.style.width = pct + "%";
    this.loadingText.textContent = pct + "%";
    if (status) this.loadingStatus.textContent = status;
  }

  async run(onReady) {
    this.showBoot();
    await waitFor(2200);            // Boot logo holds.
    this.showLoading();
    // Trigger asset preloading.
    await onReady((ratio, status) => this.setProgress(ratio, status));
    await waitFor(600);
    this.loadingScreen.classList.add("hidden");
  }
}

export default BootScene;
