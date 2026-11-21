import { createMascot } from "mascotz";
import type { Mood } from "mascotz";

export function createMilaFace(id: string, mood: Mood) {
  const color = "#ffadd0";
  return createMascot({ seed: "Mila", id, body: "round", eyes: "dot", color, mood, label: false })
    .replace(`fill="${color}"`, `fill="url(#${id}-pink)"`)
    .replace(
      "<defs>",
      `<defs><linearGradient id="${id}-pink" x2=".28" y2="1"><stop stop-color="#ffdaec"/><stop offset="1" stop-color="#f891bc"/></linearGradient>`,
    );
}
