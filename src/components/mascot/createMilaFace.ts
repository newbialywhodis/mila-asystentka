import { createMascot } from "mascotz";
import type { Mood } from "mascotz";

export function createMilaFace(id: string, mood: Mood) {
  const color = "#ffadd0";
  // Mascotz 1.3.0 emits these fill/defs markers. Keep this adaptation in one place
  // and verify it when upgrading Mascotz. IDs and moods come from application code.
  return createMascot({ seed: "Mila", id, body: "round", eyes: "dot", color, mood, label: false })
    .replace(`fill="${color}"`, `fill="url(#${id}-pink)"`)
    .replace(
      "<defs>",
      `<defs><linearGradient id="${id}-pink" x2=".28" y2="1"><stop stop-color="#ffdaec"/><stop offset="1" stop-color="#f891bc"/></linearGradient>`,
    );
}
