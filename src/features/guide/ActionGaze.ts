import { createContext } from "react";

export type ActionGaze = {
  hovered: HTMLElement | null;
  focused: HTMLElement | null;
};

export const SetActionGazeContext = createContext<
  | ((kind: keyof ActionGaze, target: HTMLElement | null, previous?: HTMLElement | null) => void)
  | null
>(null);
