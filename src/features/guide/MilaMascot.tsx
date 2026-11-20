import { animateMascot, createMascot } from "mascotz";
import type { MascotController, Mood } from "mascotz";
import { useEffect, useId, useMemo, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import styles from "./MilaMascot.module.css";

export type MascotReaction = { kind: "nod" | "blink" | "smile" };

const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeMotion(notify: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

function drawFace(id: string, mood: Mood) {
  const color = "#ffadd0";
  return createMascot({ seed: "Mila", id, body: "round", eyes: "dot", color, mood, label: false })
    .replace(`fill="${color}"`, `fill="url(#${id}-pink)"`)
    .replace(
      "<defs>",
      `<defs><linearGradient id="${id}-pink" x2=".28" y2="1"><stop stop-color="#ffdaec"/><stop offset="1" stop-color="#f891bc"/></linearGradient>`,
    );
}

export function MilaMascot({
  reaction,
  thinking,
  composerInput,
}: {
  reaction?: MascotReaction;
  thinking: boolean;
  composerInput: RefObject<HTMLTextAreaElement | null>;
}) {
  const id = `mila-${useId()}`;
  const face = useRef<HTMLSpanElement>(null);
  const controller = useRef<MascotController>(null);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => true,
  );
  const mood = reaction?.kind === "smile" ? "happy" : thinking ? "thinking" : "idle";
  const markup = useMemo(() => ({ __html: drawFace(id, mood) }), [id, mood]);

  useEffect(() => {
    if (reduced || !face.current) return;
    const mascot = animateMascot(face.current, {
      seed: "Mila",
      lookAt: () =>
        document.activeElement === composerInput.current ? composerInput.current : null,
    });
    controller.current = mascot;
    return () => {
      mascot.destroy();
      controller.current = null;
    };
  }, [composerInput, reduced]);

  useEffect(() => {
    if (reduced || !reaction) return;
    if (reaction.kind === "blink") controller.current?.blink();
    if (reaction.kind === "nod") {
      const nod = face.current?.animate(
        [
          { transform: "none" },
          { transform: "translateY(3px) scaleY(.95)", offset: 0.45 },
          { transform: "none" },
        ],
        { duration: 320, easing: "ease-in-out" },
      );
      return () => nod?.cancel();
    }
  }, [reaction, reduced]);

  return (
    <span className={styles.mascot} aria-hidden="true">
      <span
        key={String(reduced)}
        ref={face}
        className={styles.face}
        dangerouslySetInnerHTML={markup}
      />
    </span>
  );
}
