// ============================================================
// main.js — Entry point for GANPATI: VIGHNA
// Boots the Game on DOMContentLoaded.
// ============================================================

import { Game } from "./core/Game.js";

window.addEventListener("DOMContentLoaded", () => {
  const game = new Game();
  window.__game = game;  // exposed for debugging
  game.start().catch((err) => {
    console.error("[Ganpati:Vighna] Fatal error during startup:", err);
    // Show a user-friendly error message.
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      const status = document.getElementById("loading-status");
      if (status) {
        status.textContent = "Failed to start. Check console (F12).";
        status.style.color = "#ff6060";
      }
    }
  });
});

// Resume audio on first user gesture (mobile browser policy).
const _resumeAudio = () => {
  if (window.__game && window.__game.audio) {
    window.__game.audio.resume();
  }
  window.removeEventListener("touchstart", _resumeAudio);
  window.removeEventListener("mousedown", _resumeAudio);
  window.removeEventListener("keydown", _resumeAudio);
};
window.addEventListener("touchstart", _resumeAudio);
window.addEventListener("mousedown", _resumeAudio);
window.addEventListener("keydown", _resumeAudio);
