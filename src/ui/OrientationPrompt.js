// ============================================================
// ui/OrientationPrompt.js
// Detects portrait orientation and shows the "Rotate your device" overlay.
// ============================================================

import { isLandscape } from "../utils/Helpers.js";

export class OrientationPrompt {
  constructor() {
    this.el = document.getElementById("orientation-prompt");
    this._check();
    window.addEventListener("resize", () => this._check());
    window.addEventListener("orientationchange", () => setTimeout(() => this._check(), 100));
  }

  _check() {
    const landscape = isLandscape();
    // On desktop (large screens), landscape is always true so we never prompt.
    const isLargeScreen = window.innerWidth >= 1024;
    if (!landscape && !isLargeScreen) {
      this.el.classList.remove("hidden");
    } else {
      this.el.classList.add("hidden");
    }
  }
}

export default OrientationPrompt;
