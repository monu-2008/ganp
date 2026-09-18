// ============================================================
// ui/Menu.js
// Controls the main menu, settings, and credits screens.
// ============================================================

export class Menu {
  constructor() {
    this.menuScreen = document.getElementById("menu-screen");
    this.settingsScreen = document.getElementById("settings-screen");
    this.creditsScreen = document.getElementById("credits-screen");
    this.continueBtn = document.getElementById("menu-continue-btn");
    this.newBtn = document.getElementById("menu-new-btn");
    this.settingsBtn = document.getElementById("menu-settings-btn");
    this.creditsBtn = document.getElementById("menu-credits-btn");
    this.settingsBackBtn = document.getElementById("settings-back-btn");
    this.creditsBackBtn = document.getElementById("credits-back-btn");
    this.qualitySegmented = document.getElementById("quality-segmented");
    this.volMaster = document.getElementById("vol-master");
    this.volMusic = document.getElementById("vol-music");
    this.volSfx = document.getElementById("vol-sfx");
    this.debugToggle = document.getElementById("debug-toggle");
  }

  showMenu(hasProgress) {
    this.continueBtn.style.display = hasProgress ? "flex" : "none";
    this._show(this.menuScreen);
  }

  showSettings() {
    this._show(this.settingsScreen);
  }

  showCredits() {
    this._show(this.creditsScreen);
  }

  hide() {
    [this.menuScreen, this.settingsScreen, this.creditsScreen].forEach(s => s.classList.add("hidden"));
  }

  _show(screen) {
    [this.menuScreen, this.settingsScreen, this.creditsScreen].forEach(s => s.classList.add("hidden"));
    screen.classList.remove("hidden");
  }

  setQuality(q) {
    this.qualitySegmented.querySelectorAll("button").forEach(b => {
      b.classList.toggle("active", b.dataset.quality === q);
    });
  }

  setVolumes({ master, music, sfx }) {
    this.volMaster.value = Math.round(master * 100);
    this.volMusic.value = Math.round(music * 100);
    this.volSfx.value = Math.round(sfx * 100);
  }

  setDebug(b) {
    this.debugToggle.checked = b;
  }

  onContinue(cb) { this.continueBtn.onclick = cb; }
  onNew(cb)      { this.newBtn.onclick = cb; }
  onSettings(cb) { this.settingsBtn.onclick = cb; }
  onCredits(cb)  { this.creditsBtn.onclick = cb; }
  onSettingsBack(cb) { this.settingsBackBtn.onclick = cb; }
  onCreditsBack(cb)  { this.creditsBackBtn.onclick = cb; }
  onQualityChange(cb) {
    this.qualitySegmented.querySelectorAll("button").forEach(b => {
      b.onclick = () => cb(b.dataset.quality);
    });
  }
  onVolumeChange(cb) {
    this.volMaster.oninput = () => cb({ master: this.volMaster.value / 100 });
    this.volMusic.oninput = () => cb({ music: this.volMusic.value / 100 });
    this.volSfx.oninput = () => cb({ sfx: this.volSfx.value / 100 });
  }
  onDebugToggle(cb) { this.debugToggle.onchange = () => cb(this.debugToggle.checked); }
}

export default Menu;
