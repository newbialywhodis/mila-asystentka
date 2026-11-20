import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { CopyButton } from "../../components/ui/CopyButton";
import { Icon } from "../../components/ui/Icon";
import { parseDate } from "../../engine/dates";
import { MilaMessage, MilaMessageText } from "./ThreadMessage";
import { DateChoice, MultiChoice, SingleChoice } from "./QuestionControls";
import type { SubmitAnswer } from "./QuestionControls";
import { canSkipQuestion, getDateBounds, guideQuestions } from "./flow";
import type { Answer, QuestionId } from "./flow";
import styles from "./QuestionTurn.module.css";
import messageStyles from "./ThreadMessage.module.css";

export function QuestionTurn({
  id,
  text,
  previousAnswer,
  asOf,
  birthDate,
  onAnswer,
  onCancel,
}: {
  id: QuestionId;
  text: string;
  previousAnswer?: Answer;
  asOf: string;
  birthDate?: string;
  onAnswer?: SubmitAnswer;
  onCancel?: () => void;
}) {
  const messageId = useId();
  const message = useRef<HTMLParagraphElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const exit = useRef<Animation>(null);
  const timingChanged = useRef(false);
  const active = Boolean(onAnswer);
  const question = guideQuestions[id];
  const dateValue =
    typeof previousAnswer === "string" && parseDate(previousAnswer) ? previousAnswer : undefined;
  const [exactTiming, setExactTiming] = useState(Boolean(dateValue));
  const timing = question.input === "timing";
  const exact = timing && exactTiming;
  const canSkip = canSkipQuestion(id);
  const copyText = question.hint ? `${text}\n\n${question.hint}` : text;
  const binary =
    question.input === "choice" &&
    question.options.every(({ value }) => typeof value === "boolean");
  const controlsClass = binary
    ? styles.quickControls
    : question.input === "choice"
      ? styles.controls
      : styles.panel;

  useEffect(() => {
    if (!timingChanged.current) return;
    timingChanged.current = false;
    (exactTiming ? input.current : message.current)?.focus();
  }, [exactTiming]);

  useLayoutEffect(() => {
    return () => {
      exit.current?.cancel();
      exit.current = null;
    };
  }, [active]);

  function selectAnswer(value: Answer) {
    if (!onAnswer || exit.current) return;
    const panel = controls.current;
    if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onAnswer(value);
      return;
    }

    panel.inert = true;
    const animation = panel.animate(
      { opacity: 0, transform: "translateY(-4px)" },
      {
        duration: 130,
        easing: "ease-in",
        fill: "forwards",
      },
    );
    exit.current = animation;
    void animation.finished.then(
      () => onAnswer(value),
      () => undefined,
    );
  }

  return (
    <div className={styles.turn} data-chat-scroll>
      <MilaMessage>
        <p
          id={messageId}
          ref={message}
          tabIndex={-1}
          data-chat-focus={onAnswer ? "continue" : undefined}
        >
          <MilaMessageText key={text}>{text}</MilaMessageText>
        </p>
        {question.hint ? (
          <p className={`${styles.hint} ${messageStyles.followUp}`}>{question.hint}</p>
        ) : null}
      </MilaMessage>
      {onAnswer ? (
        <div ref={controls} className={`${controlsClass} ${messageStyles.followUp}`}>
          {question.input === "date" || exact ? (
            <DateChoice
              label={
                timing
                  ? "Przewidywany termin porodu"
                  : id === "birthDate"
                    ? "Data urodzenia"
                    : "Data sporządzenia karty"
              }
              value={dateValue}
              {...getDateBounds(id, asOf, birthDate)}
              inputRef={input}
              onAnswer={selectAnswer}
            />
          ) : question.input === "multi" ? (
            <MultiChoice
              options={question.options}
              labelledBy={messageId}
              selected={previousAnswer}
              onAnswer={selectAnswer}
            />
          ) : (
            <SingleChoice
              options={question.options}
              labelledBy={messageId}
              compact={binary}
              selected={previousAnswer}
              onAnswer={selectAnswer}
            />
          )}
          {timing || canSkip || onCancel ? (
            <div className={styles.actions}>
              {timing ? (
                <Button
                  variant="quiet"
                  onClick={() => {
                    timingChanged.current = true;
                    setExactTiming(!exactTiming);
                  }}
                >
                  <Icon name="calendar" size="sm" />
                  {exactTiming ? "Wybierz trymestr" : "Podaj termin porodu"}
                </Button>
              ) : null}
              {canSkip ? (
                <Button variant="quiet" onClick={() => selectAnswer(null)}>
                  Pomiń pytanie
                </Button>
              ) : null}
              {onCancel ? (
                <Button variant="quiet" onClick={onCancel}>
                  Anuluj zmianę
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={messageStyles.followUp}>
        <CopyButton label="Kopiuj wiadomość Mili" text={copyText} />
      </div>
    </div>
  );
}
