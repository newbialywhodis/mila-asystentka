import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { IconButton } from "../../components/ui/Button";
import { CopyButton } from "../../components/ui/CopyButton";
import styles from "./ThreadMessage.module.css";

const typingInterval = 23;
const maxTypingSteps = 85;
const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter() : undefined;

export function MilaMessage({ children, copyText }: { children: ReactNode; copyText?: string }) {
  return (
    <div className={styles.mila}>
      <span className={styles.author}>Mila</span>
      {children}
      {copyText ? (
        <div className={styles.followUp}>
          <CopyButton label="Kopiuj wiadomość Mili" text={copyText} />
        </div>
      ) : null}
    </div>
  );
}

export function MilaMessageText({ children }: { children: string }) {
  const characters = useMemo(
    () =>
      segmenter
        ? Array.from(segmenter.segment(children), ({ segment }) => segment)
        : Array.from(children),
    [children],
  );
  const total = characters.length;
  const [visibleCount, setVisibleCount] = useState(0);
  const typing = visibleCount < total;

  useEffect(() => {
    if (total === 0) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      const frame = window.requestAnimationFrame(() => setVisibleCount(total));
      return () => window.cancelAnimationFrame(frame);
    }

    const step = Math.ceil(total / maxTypingSteps);
    let count = 0;
    const timer = window.setInterval(() => {
      count = Math.min(count + step, total);
      setVisibleCount(count);
      if (count === total) stopTyping();
    }, typingInterval);

    function stopTyping() {
      window.clearInterval(timer);
      motion.removeEventListener("change", finishIfReduced);
    }

    function finishIfReduced() {
      if (!motion.matches) return;
      stopTyping();
      setVisibleCount(total);
    }

    motion.addEventListener("change", finishIfReduced);
    return stopTyping;
  }, [total]);

  return (
    <>
      <span className={typing ? styles.fullText : undefined}>{children}</span>
      {typing ? (
        <span className={styles.preview} aria-hidden="true">
          {characters.slice(0, visibleCount).join("")}
          <span className={styles.pending}>{characters.slice(visibleCount).join("")}</span>
        </span>
      ) : null}
    </>
  );
}

export function UserMessage({
  children,
  onEdit,
  question,
}: {
  children: string;
  onEdit?: () => void;
  question?: string;
}) {
  return (
    <div className={styles.user} tabIndex={onEdit ? -1 : undefined}>
      <span className={styles.author}>Twoja wiadomość</span>
      <p className={styles.bubble}>{children}</p>
      {onEdit ? (
        <IconButton
          icon="pencil"
          className={styles.edit}
          label={`Zmień odpowiedź „${children}” na pytanie „${question}”`}
          tooltip="Zmień odpowiedź"
          onClick={onEdit}
        />
      ) : null}
    </div>
  );
}
