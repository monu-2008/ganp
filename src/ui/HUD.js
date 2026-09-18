// ============================================================
// ui/HUD.js
// In-game HUD: objective, contextual interact prompt, character badge.
// ============================================================

export class HUD {
  constructor() {
    this.el = document.getElementById("hud");
    this.objectiveText = document.getElementById("hud-objective-text");
    this.contextual = document.getElementById("hud-contextual-inner");
    this.contextualText = document.getElementById("hud-contextual-text");
    this.contextualIcon = document.getElementById("hud-contextual-icon");
    this.characterName = document.getElementById("hud-character-name");
    this.switchLabel = document.getElementById("switch-label");
    this.abilityBtn = document.getElementById("ability-btn");
    this.switchBtn = document.getElementById("switch-btn");
    this.pauseBtn = document.getElementById("pause-btn");
  }

  show() {
    this.el.classList.remove("hidden");
  }

  hide() {
    this.el.classList.add("hidden");
  }

  setObjective(text) {
    this.objectiveText.textContent = text;
  }

  setCharacter(name) {
    this.characterName.textContent = name;
    this.switchLabel.textContent = name === "Ganesh" ? "Mooshak" : "Ganesh";
  }

  showContextual(text, icon = "✦") {
    this.contextualText.textContent = text;
    this.contextualIcon.textContent = icon;
    this.contextual.classList.remove("hidden");
  }

  hideContextual() {
    this.contextual.classList.add("hidden");
  }

  setAbilityEnabled(b) {
    this.abilityBtn.disabled = !b;
    this.abilityBtn.style.opacity = b ? "1" : "0.4";
  }

  onAbility(cb) { this.abilityBtn.onclick = cb; }
  onSwitch(cb)  { this.switchBtn.onclick = cb; }
  onPause(cb)   { this.pauseBtn.onclick = cb; }
}

export default HUD;
