import { useEffect, useRef, useState } from "react";
import type { RefObject, SubmitEvent } from "react";
import { IconButton } from "../../components/ui/Button";
import { MilaMascot } from "./MilaMascot";
import type { ActionGaze } from "./ActionGaze";
import type { MascotReaction } from "./MilaMascot";
import { maxHelpQuestionLength } from "./helpAnswers";
import styles from "./ChatComposer.module.css";

export function ChatComposer({
  reaction,
  thinking,
  onSend,
  onAttach,
  query,
  onQueryChange,
  input,
  actionGaze,
}: {
  reaction?: MascotReaction;
  thinking: boolean;
  onSend: (text: string) => void;
  onAttach: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  input: RefObject<HTMLTextAreaElement | null>;
  actionGaze: RefObject<ActionGaze>;
}) {
  const [expanded, setExpanded] = useState(false);
  const compactMeasure = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = compactMeasure.current;
    if (!field) return;

    const observer = new ResizeObserver(([entry]) => {
      const lineHeight = Number.parseFloat(getComputedStyle(field).lineHeight);
      setExpanded(entry.contentRect.height > lineHeight + 1);
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim();
    if (!text || thinking) return;
    onSend(text);
    input.current?.focus({ preventScroll: true });
  }

  return (
    <form
      onSubmit={submit}
      className={styles.form}
      data-expanded={expanded}
      aria-label="Napisz do Mili"
    >
      <div className={styles.mascot}>
        <MilaMascot
          thinking={thinking}
          reaction={reaction}
          composerInput={input}
          actionGaze={actionGaze}
        />
      </div>
      <div className={styles.inputWrap}>
        <textarea
          ref={input}
          aria-label="Wiadomość do Mili"
          autoComplete="off"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Zapytaj Milę…"
          maxLength={maxHelpQuestionLength}
          enterKeyHint="send"
          rows={1}
          required
        />
      </div>
      <textarea
        ref={compactMeasure}
        className={styles.compactMeasure}
        aria-hidden="true"
        tabIndex={-1}
        value={query}
        rows={1}
        readOnly
      />
      <div className={styles.actions}>
        <IconButton
          icon="paperclip"
          label="Dodaj PDF do rozmowy"
          tooltip="Dodaj PDF"
          onClick={onAttach}
          rounded
        />
        <IconButton
          type="submit"
          icon="send"
          label="Wyślij wiadomość"
          size="icon-sm"
          variant="brand"
          rounded
          disabled={!query.trim() || thinking}
        />
      </div>
    </form>
  );
}
