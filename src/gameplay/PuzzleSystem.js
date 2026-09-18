// ============================================================
// gameplay/PuzzleSystem.js
// Temple puzzle: light 4 diyas in correct order + ring bell + Mooshak tunnel.
// ============================================================

import * as THREE from "three";
import { VighnaSystem } from "./VighnaSystem.js";

export const PUZZLE_STATE = {
  UNSTARTED: "unstarted",
  OBSERVING: "observing",
  TUNNEL_OPEN: "tunnel_open",
  LIGHTING: "lighting",
  COMPLETE: "complete",
};

const CORRECT_ORDER = [1, 3, 2, 4]; // matches the symbol clue on the temple wall.

export class PuzzleSystem {
  constructor({ world, vighnaSystem, audioManager, memorySystem }) {
    this.world = world;
    this.vighna = vighnaSystem;
    this.audio = audioManager;
    this.memory = memorySystem;
    this.state = PUZZLE_STATE.UNSTARTED;
    this.litOrder = [];
    this.bellRung = false;
    this.tunnelOpen = false;
    this.onComplete = null;
  }

  /** Player interacts with a diya. Returns true if accepted. */
  interactDiya(diyaMesh) {
    if (this.state === PUZZLE_STATE.COMPLETE) return false;
    const isPuzzleDiya = diyaMesh.userData.isPuzzleDiya;
    const order = diyaMesh.userData.puzzleOrder;
    // Light the diya (visual).
    const lit = this.world.lightDiya(diyaMesh);
    if (!lit) return false;
    this.audio.playInteract();
    if (isPuzzleDiya) {
      this.litOrder.push(order);
      // Validate.
      const idx = this.litOrder.length - 1;
      if (this.litOrder[idx] !== CORRECT_ORDER[idx]) {
        // Wrong order — reset (but keep the diya lit visually; the puzzle fails).
        this._failPuzzle();
        return true;
      }
      // If all four lit in correct order.
      if (this.litOrder.length === CORRECT_ORDER.length) {
        this._onPuzzleSolved();
      }
    } else {
      // Decoration diya — also remembers for the world-memory system.
      if (diyaMesh.position.z < 0 && !this.memory.flags.diyaEarlyLit) {
        this.memory.setFlag("diyaEarlyLit", true);
        this.memory.setFlag("earlyDiyaPosition", diyaMesh.position.clone());
      }
    }
    return true;
  }

  /** Player interacts with a bell. */
  interactBell(bellMesh) {
    const struck = this.world.strikeBell(bellMesh);
    if (!struck) return false;
    this.audio.playBell(220);
    this.bellRung = true;
    // Memory: if this is the temple bell, remember for the boss.
    if (bellMesh.position.z > 10 && bellMesh.position.z < 14) {
      // Mandap bell — early ring helps later.
      if (!this.memory.flags.bellEarlyRung) {
        this.memory.setFlag("bellEarlyRung", true);
      }
    }
    // Check if puzzle can complete now (bell + correct diyas).
    this._maybeComplete();
    return true;
  }

  /** Player interacts with the Mooshak tunnel. */
  interactTunnel() {
    if (this.state === PUZZLE_STATE.COMPLETE) return false;
    this.state = PUZZLE_STATE.TUNNEL_OPEN;
    this.tunnelOpen = true;
    this.audio.playSwitch();
    // Open the puzzle by revealing the symbol (already there) — just hint.
    return true;
  }

  _failPuzzle() {
    this.audio.playBell(110);
    // Brief screen flash via VFX.
    // Reset the lit order.
    this.litOrder = [];
    // (Optionally un-light the puzzle diyas — we keep them lit for visual feedback.)
  }

  _onPuzzleSolved() {
    if (this.state === PUZZLE_STATE.COMPLETE) return;
    this.state = PUZZLE_STATE.LIGHTING;
    // Ring all temple bells.
    for (const b of this.world.bells) {
      this.world.strikeBell(b.mesh);
    }
    this.audio.playBell(440);
    setTimeout(() => this.audio.playBell(523), 200);
    setTimeout(() => this.audio.playBell(659), 400);
    // Open the temple door.
    this.world.openTempleDoor();
    // Trigger Vighna Break on the temple door crack.
    setTimeout(() => {
      this.vighna.triggerBreak("temple_main");
      this.state = PUZZLE_STATE.COMPLETE;
      this.onComplete?.();
    }, 800);
  }

  _maybeComplete() {
    if (this.state === PUZZLE_STATE.COMPLETE) return;
    if (this.litOrder.length === CORRECT_ORDER.length && this.bellRung) {
      this._onPuzzleSolved();
    }
  }

  reset() {
    this.state = PUZZLE_STATE.UNSTARTED;
    this.litOrder = [];
    this.bellRung = false;
    this.tunnelOpen = false;
  }

  update(dt) {}
}

export default PuzzleSystem;
