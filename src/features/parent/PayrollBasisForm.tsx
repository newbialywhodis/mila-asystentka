import { useId, useState } from "react";
import type { SubmitEvent } from "react";
import { Button } from "../../components/ui/Button";
import { NumericInput } from "../../components/ui/NumericInput";
import { payrollBasis } from "../../engine/payroll-basis";
import styles from "./ParentCard.module.css";

const columns = [
  {
    key: "basePay",
    label: "Stałe po składkach (zł)",
    money: true,
    placeholder: "np. 5 200,50",
    help: "Wpisz pełną miesięczną kwotę stałej pensji po odjęciu składek społecznych pracownika.",
  },
  {
    key: "regularVariable",
    label: "Zmienne do uzupełnienia po składkach (zł)",
    money: true,
    placeholder: "np. 450,00",
    help: "Wpisz zmienne składniki, które kadry przeliczają do pełnego miesiąca. Użyj kwoty z listy płac po składkach.",
  },
  {
    key: "actualVariable",
    label: "Zmienne w kwocie faktycznej po składkach (zł)",
    money: true,
    placeholder: "np. 300,00",
    help: "Wpisz wypłaconą kwotę po składkach tych zmiennych składników, które kadry uwzględniają w faktycznej wysokości.",
  },
  {
    key: "workDays",
    label: "Dni przepracowane",
    money: false,
    placeholder: "np. 18",
    help: "Podaj liczbę dni, które faktycznie przepracowałaś w tym miesiącu.",
  },
  {
    key: "requiredDays",
    label: "Dni do przepracowania",
    money: false,
    placeholder: "np. 21",
    help: "Podaj liczbę dni pracy zaplanowanych w tym miesiącu według Twojego grafiku.",
  },
] as const;

export function PayrollBasisForm({ onUse }: { onUse: (basis: number) => void }) {
  const [count, setCount] = useState(1);
  const [error, setError] = useState(false);
  const id = useId();
  const errorId = id + "-error";

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const read = (name: string) => Number(form.get(name));
    const cents = (name: string) => Math.round(read(name) * 100);
    const months = Array.from({ length: count }, (_, index) => ({
      basePay: cents("basePay" + index),
      regularVariable: cents("regularVariable" + index),
      actualVariable: cents("actualVariable" + index),
      workDays: read("workDays" + index),
      requiredDays: read("requiredDays" + index),
    }));
    const basis = payrollBasis(months, cents("quarterly"), cents("annual"));
    setError(!basis);
    if (basis) onUse(basis);
  }

  return (
    <form className={styles.card} onSubmit={submit} aria-describedby={error ? errorId : undefined}>
      <h3>Podstawa pracownika z listy płac</h3>
      <p>
        Wpisz do 12 pełnych miesięcy właściwego okresu zatrudnienia i etatu. Użyj kwot po potrąceniu
        składek społecznych pracownika. Dla stałego wynagrodzenia wpisz pełną stawkę, także przy
        usprawiedliwionej nieobecności.
      </p>
      <p>
        Uwzględnij składniki pomniejszane za okres pobierania zasiłku. Jeśli obowiązuje poprzednia
        podstawa lub potrzebna jest korekta do ustawowego minimum, użyj kwoty potwierdzonej przez
        płatnika.
      </p>
      <label className={styles.field}>
        Liczba miesięcy
        <select value={count} onChange={(event) => setCount(Number(event.currentTarget.value))}>
          {Array.from({ length: 12 }, (_, index) => (
            <option key={index} value={index + 1}>
              {index + 1}
            </option>
          ))}
        </select>
      </label>
      {Array.from({ length: count }, (_, index) => (
        <fieldset key={index} className={styles.row}>
          <legend>Miesiąc {index + 1}</legend>
          {columns.map(({ key, label, money, placeholder, help }) => (
            <div className={styles.field} key={key}>
              <label htmlFor={`${id}-${key}-${index}`}>{label}</label>
              <NumericInput
                id={`${id}-${key}-${index}`}
                name={key + index}
                required
                min={0}
                max={money ? 1_000_000 : 31}
                decimal={money}
                defaultValue={money ? 0 : undefined}
                placeholder={placeholder}
                help={help}
              />
            </div>
          ))}
        </fieldset>
      ))}
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={id + "-quarterly"}>
            Suma uwzględnianych składników z czterech kwartałów po składkach (zł)
          </label>
          <NumericInput
            id={id + "-quarterly"}
            name="quarterly"
            help="Zsumuj składniki kwartalne uwzględniane w podstawie z czterech kwartałów. Podaj kwotę po składkach społecznych."
            min={0}
            max={1_000_000}
            decimal
            defaultValue={0}
            placeholder="np. 2 400,00"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={id + "-annual"}>Uwzględniana kwota roczna po składkach (zł)</label>
          <NumericInput
            id={id + "-annual"}
            name="annual"
            help="Wpisz roczne składniki uwzględniane w podstawie, np. premię roczną, w kwocie po składkach społecznych."
            min={0}
            max={1_000_000}
            decimal
            defaultValue={0}
            placeholder="np. 3 000,00"
          />
        </div>
      </div>
      {error ? (
        <p id={errorId} role="alert">
          Sprawdź kwoty i dni. Gdy brak przepracowanych dni we wszystkich miesiącach, podaj podstawę
          ustaloną przez płatnika.
        </p>
      ) : null}
      <Button type="submit" variant="brand" size="sm">
        Oblicz i użyj podstawy
      </Button>
    </form>
  );
}
