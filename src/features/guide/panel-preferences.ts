const storageKey = "mila.case-sidebar";
const changeEvent = "mila:case-sidebar";

type PanelPreferences = { open: boolean; width?: number; attachmentWidth?: number };
let fallback: string | null = null;

export function readPanelSnapshot() {
  try {
    return fallback ?? localStorage.getItem(storageKey);
  } catch {
    return fallback;
  }
}

export function subscribeToPanelPreferences(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readPanelPreferences(snapshot: string | null): PanelPreferences | undefined {
  try {
    if (!snapshot) return;
    const value: unknown = JSON.parse(snapshot);
    if (
      !value ||
      typeof value !== "object" ||
      !("open" in value) ||
      typeof value.open !== "boolean"
    )
      return;
    const { width, attachmentWidth } = value as {
      width?: unknown;
      attachmentWidth?: unknown;
    };
    return {
      open: value.open,
      width: typeof width === "number" && Number.isFinite(width) ? width : undefined,
      attachmentWidth:
        typeof attachmentWidth === "number" && Number.isFinite(attachmentWidth)
          ? attachmentWidth
          : undefined,
    };
  } catch {
    return;
  }
}

export function updatePanelPreferences(change: Partial<PanelPreferences>) {
  const previous = readPanelPreferences(readPanelSnapshot()) ?? { open: false };
  const snapshot = JSON.stringify({ ...previous, ...change });
  try {
    localStorage.setItem(storageKey, snapshot);
    fallback = null;
  } catch {
    fallback = snapshot;
  }
  window.dispatchEvent(new Event(changeEvent));
}
