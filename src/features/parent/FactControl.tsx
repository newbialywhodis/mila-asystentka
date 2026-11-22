import { useId, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { InputHelp } from "../../components/ui/InputHelp";
import { NumericInput } from "../../components/ui/NumericInput";
import { warsawToday } from "../../engine/dates";
import { caseFactsSchema } from "../../engine/parent-case";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import { SingleChoice } from "../guide/QuestionControls";
import { factValue, fields, readFact, validateFact } from "./case-fields";
import styles from "./FactControl.module.css";

type GuidedControl = {
  initialValue?: CaseFacts[FactKey];
  promptId: string;
  hintId?: string;
  submitLabel?: string;
  upcomingStart?: boolean;
};

const numberFormat = new Intl.NumberFormat("pl-PL");

export function FactControl({
  fact,
  label,
  onSave,
  today = warsawToday(),
  guided,
  childrenCount,
}: {
  fact: FactKey;
  label?: string;
  onSave: (facts: CaseFacts) => void;
  today?: string;
  guided?: GuidedControl;
  childrenCount?: number;
}) {
  const id = useId();
  const helpId = id + "-help";
  const numberInput = useRef<HTMLInputElement>(null);
  const field = fields[fact];
  const money = field.type === "money";
  const scale = money ? 100 : 1;
  const initialValue = guided?.initialValue;
  const [value, setValue] = useState(() =>
    typeof initialValue === "string" ? factValue(fact, initialValue) : "",
  );
  const [numericValue, setNumericValue] = useState(() =>
    typeof initialValue === "number" ? initialValue / scale : null,
  );
  const [error, setError] = useState("");
  const schema = caseFactsSchema.shape[fact];
  const numeric = money || field.type === "number";
  const min = "minValue" in schema && schema.minValue != null ? schema.minValue / scale : undefined;
  const max = "maxValue" in schema && schema.maxValue != null ? schema.maxValue / scale : undefined;
  const describedBy =
    [guided?.hintId, error && id + "-error"].filter(Boolean).join(" ") || undefined;

  function change(text: string) {
    setValue(text);
    setError("");
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (numeric && numericValue === null) {
      setError(money ? "Wpisz kwotę." : "Wpisz liczbę.");
      return;
    }
    const facts =
      numericValue !== null && numeric
        ? validateFact(fact, money ? Math.round(numericValue * scale) : numericValue)
        : readFact(fact, value, guided?.upcomingStart ? today : undefined);
    if (!facts) {
      if (numeric) {
        setError(
          min !== undefined && max !== undefined
            ? `Podaj ${money ? "kwotę" : "liczbę całkowitą"} od ${numberFormat.format(min)} do ${numberFormat.format(max)}${money ? " zł" : ""}.`
            : "Sprawdź wpisaną wartość.",
        );
        return;
      }
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
    if (!guided) {
      const input = numberInput.current;
      const restoreFocus = input && document.activeElement === input;
      // Commit the draft after an Enter submission so the cleared value is displayed.
      if (restoreFocus) input.blur();
      setValue("");
      setNumericValue(null);
      if (restoreFocus) input.focus({ preventScroll: true });
    }
  }

  if (fact === "careChildren") {
    const previous = Array.isArray(guided?.initialValue) ? guided.initialValue : [];
    const count = childrenCount ?? previous.length;
    if (count < 2) return <p>Najpierw podaj liczbę przyjętych dzieci.</p>;
    return (
      <form
        className={styles.children}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const children = Array.from({ length: count }, (_, index) => ({
            birth: form.get("birth" + index),
            schoolDeferral: form.has("deferral" + index),
          }));
          const facts = validateFact("careChildren", children);
          if (facts) onSave(facts);
        }}
      >
        {Array.from({ length: count }, (_, index) => (
          <fieldset key={index} className={styles.children}>
            <legend>Dziecko {index + 1}</legend>
            <label className={styles.field}>
              Data urodzenia
              <input
                className={styles.input}
                type="date"
                required
                max={today}
                name={"birth" + index}
                defaultValue={previous[index]?.birth}
              />
            </label>
            <label>
              <input
                type="checkbox"
                name={"deferral" + index}
                defaultChecked={previous[index]?.schoolDeferral}
              />{" "}
              Ma odroczony obowiązek szkolny
            </label>
          </fieldset>
        ))}
        <Button type="submit" variant="brand" size="sm">
          {guided?.submitLabel ?? "Potwierdź daty"}
        </Button>
      </form>
    );
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
          selected={
            typeof initialValue === "string" || typeof initialValue === "boolean"
              ? initialValue
              : undefined
          }
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
        <label htmlFor={id}>{label ?? field.label}</label>
        {field.type === "date" ? (
          <DatePicker
            id={id}
            value={value}
            min="1900-01-01"
            max={fact === "birth" ? today : `${Number(today.slice(0, 4)) + 10}-12-31`}
            today={today}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            help={field.help}
            onValueChange={change}
            required
          />
        ) : field.type === "number" || field.type === "money" ? (
          <NumericInput
            ref={numberInput}
            id={id}
            className={styles.numeric}
            decimal={money}
            min={min}
            max={max}
            placeholder={field.placeholder}
            help={field.help}
            value={numericValue}
            onValueChange={(next) => {
              setNumericValue(next);
              setError("");
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            required
          />
        ) : (
          <div className={styles.textControl}>
            <input
              id={id}
              className={styles.input}
              data-has-help={Boolean(field.help) || undefined}
              value={value}
              onChange={(event) => change(event.currentTarget.value)}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={
                field.help ? [describedBy, helpId].filter(Boolean).join(" ") : describedBy
              }
              required
            />
            {field.help ? (
              <InputHelp id={helpId} text={field.help} className={styles.help} />
            ) : null}
          </div>
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
