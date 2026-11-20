import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { IconButton } from "../../components/ui/Button";
import { CopyButton } from "../../components/ui/CopyButton";
import audioManifest from "./audioManifest.json";
import styles from "./ThreadMessage.module.css";

const typingInterval = 23;
const maxTypingSteps = 85;
const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter() : undefined;

const recordings = new Map<string, string>(Object.entries(audioManifest));
let stopActiveReading: (() => void) | null = null;

export function MilaMessageActions({
  text,
  speechText = text,
}: {
  text: string;
  speechText?: string;
}) {
  const stopReading = useRef<((updateState?: boolean) => void) | null>(null);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => stopReading.current?.(false), []);

  function toggleReading() {
    if (stopReading.current) {
      stopReading.current();
      return;
    }

    stopActiveReading?.();
    let cancelPlayback: (() => void) | undefined;
    stopReading.current = stopActiveReading = stop;
    setFailed(false);
    setReading(true);

    const recording = recordings.get(speechText);
    if (recording) {
      const audio = new Audio(`/audio/mila/${recording}`);
      cancelPlayback = stopAudio;
      audio.onended = () => finish();
      audio.onerror = fallBackToSpeech;
      void audio.play().catch(fallBackToSpeech);

      function stopAudio() {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }

      function fallBackToSpeech() {
        if (stopReading.current !== stop || cancelPlayback !== stopAudio) return;
        stopAudio();
        cancelPlayback = undefined;
        speak();
      }
    } else {
      speak();
    }

    function speak() {
      const speech = window.speechSynthesis;
      if (!speech || typeof SpeechSynthesisUtterance !== "function") {
        finish(true);
        return;
      }
      const message = new SpeechSynthesisUtterance(speechText);
      message.lang = "pl-PL";
      message.onend = () => finish();
      message.onerror = ({ error }) => finish(error !== "canceled" && error !== "interrupted");
      cancelPlayback = () => {
        message.onend = null;
        message.onerror = null;
        speech.cancel();
      };
      speech.speak(message);
    }

    function stop(updateState = true) {
      if (stopReading.current !== stop) return;
      stopReading.current = stopActiveReading = null;
      cancelPlayback?.();
      if (updateState) setReading(false);
    }

    function finish(playbackFailed = false) {
      if (stopReading.current !== stop) return;
      stop();
      setFailed(playbackFailed);
    }
  }

  return (
    <div className={styles.followUp}>
      <CopyButton label="Kopiuj wiadomość Mili" text={text}>
        <IconButton
          icon="speaker"
          label={reading ? "Zatrzymaj odczytywanie" : "Odczytaj wiadomość Mili"}
          size="icon-xs"
          onClick={toggleReading}
        />
        <output className={styles.speechStatus}>
          {failed ? "Nie udało się odczytać wiadomości" : null}
        </output>
      </CopyButton>
    </div>
  );
}

export function MilaMessage({
  children,
  copyText,
  speechText,
}: {
  children: ReactNode;
  copyText?: string;
  speechText?: string;
}) {
  return (
    <div className={styles.mila}>
      <span className={styles.author}>Mila</span>
      {children}
      {copyText ? (
        <MilaMessageActions key={speechText ?? copyText} text={copyText} speechText={speechText} />
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
