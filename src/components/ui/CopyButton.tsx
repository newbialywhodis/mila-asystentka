import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { IconButton } from "./Button";
import styles from "./CopyButton.module.css";

export function CopyButton({
  label,
  text,
  children,
}: {
  label: string;
  text: string;
  children?: ReactNode;
}) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const copying = state === "copying";
  const icon = state === "copied" ? "check" : "copy";

  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    if (copying) return;
    setState("copying");
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className={styles.copy}>
      <IconButton icon={icon} label={label} size="icon-xs" aria-disabled={copying} onClick={copy} />
      {children}
      <output className={styles.status} data-state={state}>
        {state === "copied" ? "Skopiowano" : state === "failed" ? "Nie udało się skopiować" : null}
      </output>
    </div>
  );
}
