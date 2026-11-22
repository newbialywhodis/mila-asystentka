import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { NumericInput } from "../../components/ui/NumericInput";
import { contributionBasis } from "../../engine/payroll-basis";
import styles from "./ParentCard.module.css";

export function ContributionBasisForm({
  allowsDeclared,
  onUse,
}: {
  allowsDeclared: boolean;
  onUse: (basis: number) => void;
}) {
  const id = useId();
  const [short, setShort] = useState(false);
  const [error, setError] = useState(false);
  return (
    <form
      className={styles.card}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const cents = (name: string) => Math.round(Number(data.get(name)) * 100);
        const basis = contributionBasis(
          cents("average"),
          short
            ? {
                minimum: cents("minimum"),
                currentMonths: Number(data.get("current")),
                priorMonths: Number(data.get("prior")),
              }
            : undefined,
        );
        setError(!basis);
        if (basis) onUse(basis);
      }}
    >
      <h3>Podstawa z danych o składkach</h3>
      <p>
        Uwzględnij pełne miesiące właściwego ubezpieczenia. Podaj średnie kwoty po odjęciu 13,71%.
      </p>
      <div className={styles.field}>
        <label htmlFor={id + "-average"}>Średni przychód do zasiłku po potrąceniu (zł)</label>
        <NumericInput
          id={id + "-average"}
          name="average"
          help="Wpisz średni miesięczny przychód przyjmowany do zasiłku po odjęciu 13,71%."
          min={0.01}
          max={1_000_000}
          decimal
          placeholder="np. 5 200,50"
          required
        />
      </div>
      {allowsDeclared ? (
        <label>
          <input
            type="checkbox"
            checked={short}
            onChange={(event) => setShort(event.currentTarget.checked)}
          />{" "}
          Zadeklarowana podstawa przy ubezpieczeniu krótszym niż 12 pełnych miesięcy
        </label>
      ) : null}
      {short ? (
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={id + "-minimum"}>Średnia najniższa podstawa po potrąceniu (zł)</label>
            <NumericInput
              id={id + "-minimum"}
              name="minimum"
              help="Wpisz średnią najniższą podstawę składek z uwzględnianych miesięcy po odjęciu 13,71%."
              min={0.01}
              max={1_000_000}
              decimal
              placeholder="np. 3 800,00"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={id + "-current"}>Pełne miesiące z aktualnego tytułu</label>
            <NumericInput
              id={id + "-current"}
              name="current"
              help="Policz pełne miesiące obecnego ubezpieczenia chorobowego, np. z prowadzonej teraz działalności."
              min={1}
              max={11}
              placeholder="np. 6"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={id + "-prior"}>
              Pełne miesiące z poprzedniego tytułu zaliczane przez ZUS
            </label>
            <NumericInput
              id={id + "-prior"}
              name="prior"
              help="Policz pełne miesiące wcześniejszego ubezpieczenia chorobowego, które zaliczył ZUS. Jeśli żadnego nie zaliczył, wpisz 0."
              min={0}
              max={11}
              defaultValue={0}
              placeholder="np. 0"
              required
            />
          </div>
        </div>
      ) : null}
      {error ? <p role="alert">Sprawdź podane kwoty i liczbę miesięcy.</p> : null}
      <Button type="submit" variant="brand" size="sm">
        Oblicz i użyj podstawy
      </Button>
    </form>
  );
}
