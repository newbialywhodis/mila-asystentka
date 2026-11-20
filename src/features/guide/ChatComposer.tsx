import { useEffect, useId, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { Button, IconButton } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { MilaMascot } from "./MilaMascot";
import type { MascotReaction } from "./MilaMascot";
import { maxHelpQuestionLength } from "./helpAnswers";
import styles from "./ChatComposer.module.css";
import messageStyles from "./ThreadMessage.module.css";

export function ChatComposer({
  reaction,
  thinking,
  onSend,
  awaitingAnswer,
  onOpenPlan,
}: {
  reaction?: MascotReaction;
  thinking: boolean;
  onSend: (text: string) => void;
  awaitingAnswer: boolean;
  onOpenPlan?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const compactMeasure = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  const placeholder = awaitingAnswer ? "Odpowiedz lub zapytaj Milę…" : "Zapytaj Milę…";

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
    if (!text) return;
    onSend(text);
    setQuery("");
    input.current?.focus({ preventScroll: true });
  }

  return (
    <div className={styles.composer}>
      {onOpenPlan ? (
        <Button
          variant="outline"
          className={`${styles.plan} ${messageStyles.followUp} ${messageStyles.planShortcut}`}
          onClick={onOpenPlan}
        >
          <Icon name="calendar" size="sm" />
          Twój plan
        </Button>
      ) : null}
      <form
        onSubmit={submit}
        className={styles.form}
        data-expanded={expanded}
        aria-label="Napisz do Mili"
      >
        <div className={styles.mascot}>
          <MilaMascot thinking={thinking} reaction={reaction} composerInput={input} />
        </div>
        <div className={styles.inputWrap}>
          <textarea
            ref={input}
            aria-label="Wiadomość do Mili"
            aria-describedby={noteId}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={placeholder}
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
        <IconButton
          type="submit"
          icon="send"
          label="Wyślij wiadomość"
          size="icon-sm"
          variant="primary"
          className={styles.send}
          disabled={!query.trim()}
        />
      </form>
      <p className={styles.note} id={noteId}>
        Niektóre pytania może obsługiwać AI.
      </p>
    </div>
  );
}
