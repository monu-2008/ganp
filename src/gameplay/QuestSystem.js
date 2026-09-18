// ============================================================
// gameplay/QuestSystem.js
// Tracks the current objective/chapter, advances through the flow.
// ============================================================

export const CHAPTER = {
  BOOT: "boot",
  LOADING: "loading",
  INTRO: "intro",
  FESTIVAL: "festival",          // explore the city
  TIME_FREEZE: "time_freeze",
  GANESH_REVEAL: "ganesh_reveal",
  FIRST_OBJECTIVE: "first_objective",
  PUZZLE: "puzzle",
  MOOSHAK_INTRO: "mooshak_intro",
  PARKOUR: "parkour",
  FIRST_VIGHNA: "first_vighna",
  MAJOR_VIGHNA: "major_vighna",
  BOSS: "boss",
  VIGHNA_BREAK: "vighna_break",
  RIVERFRONT: "riverfront",
  ENDING: "ending",
  END_CARD: "end_card",
};

export const OBJECTIVES = {
  [CHAPTER.FESTIVAL]: "Explore the festival city",
  [CHAPTER.TIME_FREEZE]: "Witness the time-freeze",
  [CHAPTER.GANESH_REVEAL]: "Step into the divine form",
  [CHAPTER.FIRST_OBJECTIVE]: "Reach the Ganpati mandap",
  [CHAPTER.PUZZLE]: "Enter the temple and solve the diya puzzle",
  [CHAPTER.MOOSHAK_INTRO]: "Switch to Mooshak — find the hidden tunnel",
  [CHAPTER.PARKOUR]: "Cross the rooftops",
  [CHAPTER.FIRST_VIGHNA]: "Break the first Vighna",
  [CHAPTER.MAJOR_VIGHNA]: "Approach the source of the Vighna",
  [CHAPTER.BOSS]: "Defeat Kaal-Vighna by activating the mechanisms",
  [CHAPTER.VIGHNA_BREAK]: "Purify the world",
  [CHAPTER.RIVERFRONT]: "Walk to the riverfront",
  [CHAPTER.ENDING]: "End the journey",
  [CHAPTER.END_CARD]: "—",
};

export class QuestSystem {
  constructor(saveSystem) {
    this.save = saveSystem;
    this.chapter = CHAPTER.BOOT;
    this.onChapterChange = null;
    this.history = [];
  }

  setChapter(chapter) {
    if (this.chapter === chapter) return;
    this.history.push(this.chapter);
    this.chapter = chapter;
    // Persist progress if a milestone.
    if (chapter === CHAPTER.PUZZLE) this.save.setProgress({ chapter: 1 });
    if (chapter === CHAPTER.BOSS) this.save.setProgress({ chapter: 2 });
    if (chapter === CHAPTER.ENDING) this.save.setProgress({ chapter: 3, endingSeen: true });
    this.onChapterChange?.(chapter, this.getObjective());
  }

  getObjective() {
    return OBJECTIVES[this.chapter] || "";
  }

  /** Returns true if the player has reached this chapter or beyond. */
  hasReached(chapter) {
    const order = Object.values(CHAPTER);
    return order.indexOf(this.chapter) >= order.indexOf(chapter);
  }

  /** Advance to the next chapter based on the canonical flow. */
  advance() {
    const order = Object.values(CHAPTER);
    const idx = order.indexOf(this.chapter);
    if (idx < order.length - 1) {
      this.setChapter(order[idx + 1]);
    }
  }
}

export default QuestSystem;
