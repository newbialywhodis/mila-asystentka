import { useId, useState } from "react";
import type { Ref, SubmitEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { isGuideDate } from "./flow";
import type { Answer, Option, PlanInterest } from "./flow";
import styles from "./QuestionControls.module.css";

export type SubmitAnswer = (answer: Answer) => void;

type ChoiceProps<T> = {
  options: readonly T[];
  labelledBy: string;
  selected?: Answer;
  onAnswer: SubmitAnswer;
};

export function SingleChoice({
  options,
  labelledBy,
  selected,
  onAnswer,
  compact,
}: ChoiceProps<Option> & { compact: boolean }) {
  return (
    <ul className={compact ? styles.quickReplies : styles.choices} aria-labelledby={labelledBy}>
      {options.map(({ value, label, icon, detail }) => (
        <li key={String(value)}>
          <Button
            variant="secondary"
            aria-pressed={selected === undefined ? undefined : value === selected}
            onClick={() => onAnswer(value)}
          >
            {icon ? <Icon name={icon} size="sm" /> : null}
            <span className={styles.optionText}>
              {label}
              {detail ? <span>{detail}</span> : null}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function MultiChoice({
  options,
  labelledBy,
  selected,
  onAnswer,
}: ChoiceProps<{ value: PlanInterest; label: string }>) {
  const [values, setValues] = useState<readonly PlanInterest[]>(
    typeof selected === "object" && selected !== null ? selected : [],
  );

  return (
    <form
      className={styles.multiForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (values.length) onAnswer(values);
      }}
    >
      <fieldset aria-labelledby={labelledBy} className={styles.multi}>
        {options.map(({ value, label }) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={values.includes(value)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setValues((previous) =>
                  checked ? [...previous, value] : previous.filter((item) => item !== value),
                );
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <Button type="submit" icon="arrow" disabled={!values.length}>
        Zapisz wybór
      </Button>
    </form>
  );
}

export function DateChoice({
  label,
  value,
  min,
  max,
  inputRef,
  onAnswer,
}: {
  label: string;
  value?: string;
  min: string;
  max: string;
  inputRef: Ref<HTMLInputElement>;
  onAnswer: (answer: Answer) => void;
}) {
  const id = useId();
  const [error, setError] = useState("");

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new FormData(event.currentTarget).get("date");
    if (typeof date === "string" && isGuideDate(date, { min, max })) {
      onAnswer(date);
      return;
    }
    setError("Wpisz poprawną datę z podanego zakresu.");
  }

  return (
    <form className={styles.dateForm} onSubmit={submit}>
      <div className={styles.dateRow}>
        <input
          ref={inputRef}
          aria-label={label}
          type="date"
          name="date"
          defaultValue={value}
          min={min}
          max={max}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={() => setError("")}
        />
        <Button type="submit" icon="arrow">
          Wyślij datę
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
