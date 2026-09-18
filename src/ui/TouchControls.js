// ============================================================
// ui/TouchControls.js
// A simple virtual joystick on the bottom-left of the screen for
// analog movement. Also exposes the swipe-gesture handlers via the
// CharacterController.
// ============================================================

export class TouchControls {
  constructor() {
    this.joystickActive = false;
    this.joystickId = null;
    this.joyStart = null;
    this.joyVec = { x: 0, y: 0 };
    this._buildJoystick();
  }

  _buildJoystick() {
    // A floating joystick: appears wherever the player first touches the
    // bottom-left quadrant of the screen.
    this.joyEl = document.createElement("div");
    this.joyEl.className = "virtual-joystick";
    this.joyEl.style.cssText = `
      position: absolute;
      width: 110px; height: 110px;
      border-radius: 50%;
      background: rgba(7, 5, 10, 0.45);
      border: 1px solid rgba(255, 201, 102, 0.25);
      pointer-events: none;
      display: none;
      z-index: 26;
      backdrop-filter: blur(4px);
    `;
    document.body.appendChild(this.joyEl);
    this.joyKnob = document.createElement("div");
    this.joyKnob.style.cssText = `
      position: absolute;
      width: 48px; height: 48px;
      left: 31px; top: 31px;
      border-radius: 50%;
      background: rgba(255, 201, 102, 0.35);
      border: 1px solid rgba(255, 201, 102, 0.6);
      pointer-events: none;
    `;
    this.joyEl.appendChild(this.joyKnob);

    // Listen on the canvas (not UI buttons).
    const canvas = document.getElementById("game-canvas");
    canvas.addEventListener("touchstart", (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener("touchmove", (e) => this._onTouchMove(e), { passive: false });
    canvas.addEventListener("touchend", (e) => this._onTouchEnd(e), { passive: false });
  }

  _onTouchStart(e) {
    if (this.joystickActive) return;
    if (e.touches.length === 0) return;
    // Only use the left half of the screen for the joystick.
    const t = e.touches[0];
    if (t.clientX > window.innerWidth * 0.5) return;
    e.preventDefault();
    this.joystickActive = true;
    this.joystickId = t.identifier;
    this.joyStart = { x: t.clientX, y: t.clientY };
    this.joyEl.style.left = (t.clientX - 55) + "px";
    this.joyEl.style.top = (t.clientY - 55) + "px";
    this.joyEl.style.display = "block";
  }

  _onTouchMove(e) {
    if (!this.joystickActive) return;
    // Find the matching touch by identifier.
    let t = null;
    for (const touch of e.touches) {
      if (touch.identifier === this.joystickId) {
        t = touch;
        break;
      }
    }
    if (!t) return;
    e.preventDefault();
    const dx = t.clientX - this.joyStart.x;
    const dy = t.clientY - this.joyStart.y;
    const maxR = 35;
    const mag = Math.sqrt(dx * dx + dy * dy);
    const clampedMag = Math.min(mag, maxR);
    const ang = Math.atan2(dy, dx);
    const cx = Math.cos(ang) * clampedMag;
    const cy = Math.sin(ang) * clampedMag;
    this.joyKnob.style.left = (31 + cx) + "px";
    this.joyKnob.style.top = (31 + cy) + "px";
    // Normalize to [-1, 1].
    this.joyVec.x = cx / maxR;
    this.joyVec.y = cy / maxR;
  }

  _onTouchEnd(e) {
    if (!this.joystickActive) return;
    let still = false;
    for (const touch of e.touches) {
      if (touch.identifier === this.joystickId) {
        still = true;
        break;
      }
    }
    if (still) return;
    this.joystickActive = false;
    this.joyEl.style.display = "none";
    this.joyKnob.style.left = "31px";
    this.joyKnob.style.top = "31px";
    this.joyVec.x = 0;
    this.joyVec.y = 0;
  }

  /** Returns current analog vector {x, y} in range [-1, 1]. */
  getVector() {
    return { x: this.joyVec.x, y: this.joyVec.y };
  }
}

export default TouchControls;
