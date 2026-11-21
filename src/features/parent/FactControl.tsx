import { useId, useState } from "react";
import type { SubmitEvent } from "react";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { warsawToday } from "../../engine/dates";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import { SingleChoice } from "../guide/QuestionControls";
import { factInputValue, fields, readFact, validateFact } from "./case-fields";
import styles from "./FactControl.module.css";

type GuidedControl = {
  initialValue?: CaseFacts[FactKey];
  promptId: string;
  hintId?: string;
  submitLabel?: string;
  upcomingStart?: boolean;
};

export function FactControl({
  fact,
  onSave,
  today = warsawToday(),
  guided,
}: {
  fact: FactKey;
  onSave: (facts: CaseFacts) => void;
  today?: string;
  guided?: GuidedControl;
}) {
  const id = useId();
  const [value, setValue] = useState(() => factInputValue(fact, guided?.initialValue));
  const [error, setError] = useState("");
  const field = fields[fact];
  const describedBy =
    [guided?.hintId, error && id + "-error"].filter(Boolean).join(" ") || undefined;

  function change(text: string) {
    setValue(text);
    setError("");
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const facts = readFact(fact, value, guided?.upcomingStart ? today : undefined);
    if (!facts) {
      setError(
        field.type === "date"
          ? guided?.upcomingStart
            ? "Wpisz poprawną datę, np. 7 grudnia lub 07.12.2026."
            : "Wpisz poprawną datę w formacie DD.MM.RRRR."
          : "Sprawdź wpisaną wartość.",
      );
      return;
    }
    if (facts.birth && facts.birth > today) {
      setError("Data urodzenia może przypadać najpóźniej dzisiaj.");
      return;
    }
    onSave(facts);
    setError("");
    if (!guided) setValue("");
  }

  if (field.options) {
    function choose(value: string | boolean) {
      const facts = validateFact(fact, value);
      if (facts) onSave(facts);
    }
    if (guided) {
      const { initialValue } = guided;
      return (
        <SingleChoice
          options={field.options}
          labelledBy={guided.promptId}
          selected={typeof initialValue === "number" ? undefined : initialValue}
          onAnswer={choose}
        />
      );
    }
    return (
      <div className={styles.buttons}>
        {field.options.map((option) => (
          <Button
            key={option.label}
            variant="outline"
            size="sm"
            onClick={() => choose(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={styles.inline} noValidate>
      <div className={styles.field}>
        <label htmlFor={id}>{field.label}</label>
        {field.type === "date" ? (
          <DatePicker
            id={id}
            value={value}
            min="1900-01-01"
            max={fact === "birth" ? today : `${Number(today.slice(0, 4)) + 10}-12-31`}
            today={today}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            onValueChange={change}
            required
          />
        ) : (
          <input
            id={id}
            className={styles.input}
            inputMode={field.type === "money" ? "decimal" : "numeric"}
            value={value}
            onChange={(event) => change(event.currentTarget.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            required
          />
        )}
      </div>
      {error ? (
        <p id={id + "-error"} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="brand"
        size={guided ? "lg" : "sm"}
        icon={guided ? "arrow" : undefined}
      >
        {guided?.submitLabel ??
          (guided ? (field.type === "date" ? "Wyślij datę" : "Wyślij odpowiedź") : "Potwierdź")}
      </Button>
    </form>
  );
}
