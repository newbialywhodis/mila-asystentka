import { useId, useState } from "react";
import type { SubmitEvent } from "react";
import { Button } from "../../components/ui/Button";
import { payrollBasis } from "../../engine/payroll-basis";
import styles from "./ParentCard.module.css";

const columns = [
  { key: "basePay", label: "Stałe po składkach (zł)", money: true },
  { key: "regularVariable", label: "Zmienne do uzupełnienia po składkach (zł)", money: true },
  { key: "actualVariable", label: "Zmienne w kwocie faktycznej po składkach (zł)", money: true },
  { key: "workDays", label: "Dni przepracowane", money: false },
  { key: "requiredDays", label: "Dni do przepracowania", money: false },
] as const;

export function PayrollBasisForm({ onUse }: { onUse: (basis: number) => void }) {
  const [count, setCount] = useState(1);
  const [error, setError] = useState(false);
  const errorId = useId();

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
          {columns.map(({ key, label, money }) => (
            <label className={styles.field} key={key}>
              {label}
              <input
                name={key + index}
                type="number"
                required
                min={0}
                max={money ? 1_000_000 : 31}
                step={money ? ".01" : "1"}
                defaultValue={money ? 0 : undefined}
              />
            </label>
          ))}
        </fieldset>
      ))}
      <div className={styles.row}>
        <label className={styles.field}>
          Suma uwzględnianych składników z czterech kwartałów po składkach (zł)
          <input name="quarterly" type="number" min="0" max="1000000" step=".01" defaultValue="0" />
        </label>
        <label className={styles.field}>
          Uwzględniana kwota roczna po składkach (zł)
          <input name="annual" type="number" min="0" max="1000000" step=".01" defaultValue="0" />
        </label>
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
