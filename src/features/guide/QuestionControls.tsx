import { useId, useState } from "react";
import type { Ref, SubmitEvent } from "react";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { Icon } from "../../components/ui/Icon";
import { normalizeNumericDate, parseDate } from "../../engine/dates";
import { formatDate, isGuideDate } from "./flow";
import type { Answer, Option, PlanInterest } from "./flow";
import styles from "./QuestionControls.module.css";

export type SubmitAnswer = (answer: Answer) => void;

type ChoiceProps<T> = {
  options: readonly T[];
  labelledBy: string;
  selected?: Answer;
  onAnswer: SubmitAnswer;
};

export function SingleChoice<Value extends Option["value"]>({
  options,
  labelledBy,
  selected,
  onAnswer,
  className,
}: {
  options: readonly (Option & { value: Value })[];
  labelledBy: string;
  selected?: Answer;
  onAnswer: (value: Value) => void;
  className?: string;
}) {
  return (
    <ul
      className={[styles.choices, className].filter(Boolean).join(" ")}
      aria-labelledby={labelledBy}
    >
      {options.map(({ value, label, icon, detail }) => (
        <li key={String(value)}>
          <Button
            variant="outline"
            size="lg"
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
      <Button type="submit" size="lg" icon="arrow" disabled={!values.length}>
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
  today,
  inputRef,
  onAnswer,
}: {
  label: string;
  value?: string;
  min: string;
  max: string;
  today: string;
  inputRef: Ref<HTMLInputElement>;
  onAnswer: SubmitAnswer;
}) {
  const id = useId();
  const [error, setError] = useState("");

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get("date");
    const date = typeof text === "string" ? normalizeNumericDate(text) : undefined;
    if (date && isGuideDate(date, { min, max })) {
      onAnswer(date);
      return;
    }
    setError(
      parseDate(date)
        ? `Wybierz datę od ${formatDate(min)} do ${formatDate(max)}.`
        : "Wpisz poprawną datę w formacie DD.MM.RRRR.",
    );
  }

  return (
    <form className={styles.dateForm} onSubmit={submit} noValidate>
      <div className={styles.dateRow}>
        <DatePicker
          ref={inputRef}
          aria-label={label}
          name="date"
          defaultValue={value}
          min={min}
          max={max}
          today={today}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onValueChange={() => setError("")}
        />
        <Button type="submit" size="lg" icon="arrow">
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
