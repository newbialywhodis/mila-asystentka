import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { IconButton } from "../../components/ui/Button";
import { CopyButton } from "../../components/ui/CopyButton";
import { SetActionGazeContext } from "./ActionGaze";
import audioManifest from "./audioManifest.json";
import styles from "./ThreadMessage.module.css";

const typingInterval = 23;
const maxTypingSteps = 85;
const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter() : undefined;

export const LocalOnlyMessages = createContext(false);

const recordings = new Map<string, string>(Object.entries(audioManifest));
let stopActiveReading: (() => void) | null = null;

export function stopMilaReading() {
  stopActiveReading?.();
}

async function fetchGeneratedAudio(text: string, token: string, signal: AbortSignal) {
  const response = await fetch("/api/guide-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, token }),
    signal,
  });
  if (!response.ok) throw new Error("Mila audio is unavailable");
  return response.arrayBuffer();
}

function MilaMessageActions({
  text,
  speechText = text,
  speechToken,
  leadingActions,
}: {
  text: string;
  speechText?: string;
  speechToken?: string | null;
  leadingActions?: ReactNode;
}) {
  const localOnly = useContext(LocalOnlyMessages);
  const stopReading = useRef<((updateState?: boolean) => void) | null>(null);
  const generatedAudio = useRef<ArrayBuffer>(null);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => stopReading.current?.(false), []);
  useEffect(() => {
    if (localOnly) stopReading.current?.();
  }, [localOnly]);

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
    if (speechToken) {
      void playGeneratedAudio(speechToken);
    } else if (recording) {
      const audio = new Audio(`/audio/mila/${recording}`);
      cancelPlayback = stopAudio;
      audio.onended = () => finish();
      audio.onerror = handleRecordingError;
      void audio.play().catch(handleRecordingError);

      function stopAudio() {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }

      function handleRecordingError() {
        if (stopReading.current !== stop || cancelPlayback !== stopAudio) return;
        stopAudio();
        cancelPlayback = undefined;
        readWithoutRecording();
      }
    } else {
      readWithoutRecording();
    }

    function readWithoutRecording() {
      if (speechToken === undefined) speak();
      else finish(true);
    }

    async function playGeneratedAudio(token: string) {
      try {
        const context = new AudioContext();
        const controller = new AbortController();
        cancelPlayback = () => {
          controller.abort();
          void context.close().catch(() => undefined);
        };

        // Resume within the button gesture, before waiting for the MP3.
        const resumed = context.resume();
        const [audio] = await Promise.all([
          generatedAudio.current ?? fetchGeneratedAudio(speechText, token, controller.signal),
          resumed,
        ]);
        if (stopReading.current !== stop) return;
        const decoded = await context.decodeAudioData(audio.slice(0));
        if (stopReading.current !== stop) return;
        generatedAudio.current = audio;

        const playback = context.createBufferSource();
        playback.buffer = decoded;
        playback.connect(context.destination);
        playback.onended = () => finish();
        playback.start();
      } catch {
        finish(true);
      }
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
    <div className={`${styles.followUp} ${styles.messageActions}`}>
      {leadingActions}
      <CopyButton label="Kopiuj wiadomość Mili" text={text} className={styles.messageCopy}>
        {!localOnly ? (
          <IconButton
            icon="speaker"
            label={reading ? "Zatrzymaj odczytywanie" : "Odczytaj wiadomość Mili"}
            size="icon-xs"
            onClick={toggleReading}
          />
        ) : null}
        <output className={styles.speechStatus}>
          {failed ? "Nie udało się odczytać wiadomości" : null}
        </output>
      </CopyButton>
    </div>
  );
}

function gazeAction(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>("button, a[data-button-link][href]")
    : null;
}

export function MilaMessage({
  children,
  smartComponents,
  copyText,
  speechText,
  speechToken,
  leadingActions,
}: {
  children: ReactNode;
  smartComponents?: ReactNode;
  copyText: string;
  speechText?: string;
  speechToken?: string | null;
  leadingActions?: ReactNode;
}) {
  const setActionGaze = useContext(SetActionGazeContext);

  return (
    <div className={styles.mila}>
      <span className={styles.author}>Mila</span>
      <div className={styles.messageBody}>{children}</div>
      {smartComponents ? (
        <div
          className={`${styles.smartComponents} ${styles.followUp}`}
          onPointerOverCapture={(event) => {
            if (event.pointerType !== "touch") {
              setActionGaze?.("hovered", gazeAction(event.target));
            }
          }}
          onPointerOutCapture={(event) => {
            if (event.pointerType === "touch") return;
            const action = gazeAction(event.target);
            if (action && action !== gazeAction(event.relatedTarget)) {
              setActionGaze?.("hovered", null, action);
            }
          }}
          onFocusCapture={(event) => {
            setActionGaze?.("focused", gazeAction(event.target));
          }}
          onBlurCapture={(event) => {
            setActionGaze?.("focused", null, gazeAction(event.target));
          }}
        >
          {smartComponents}
        </div>
      ) : null}
      {copyText ? (
        <MilaMessageActions
          key={speechText ?? copyText}
          text={copyText}
          speechText={speechText}
          speechToken={speechToken}
          leadingActions={leadingActions}
        />
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
  editing,
}: {
  children: string;
  onEdit?: (trigger: HTMLButtonElement) => void;
  question?: string;
  editing?: boolean;
}) {
  return (
    <div className={styles.user} tabIndex={onEdit ? -1 : undefined}>
      <span className={styles.author}>Twoja wiadomość</span>
      <p className={styles.bubble}>{children}</p>
      <CopyButton label="Kopiuj swoją wiadomość" text={children} className={styles.userActions}>
        {onEdit ? (
          <IconButton
            icon="pencil"
            size="icon-xs"
            label={`Zmień odpowiedź „${children}” na pytanie „${question}”`}
            tooltip="Zmień odpowiedź"
            aria-expanded={editing}
            onClick={(event) => onEdit(event.currentTarget)}
          />
        ) : null}
      </CopyButton>
    </div>
  );
}
