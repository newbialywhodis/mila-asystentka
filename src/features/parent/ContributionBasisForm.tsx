import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { contributionBasis } from "../../engine/payroll-basis";
import styles from "./ParentCard.module.css";

export function ContributionBasisForm({
  allowsDeclared,
  onUse,
}: {
  allowsDeclared: boolean;
  onUse: (basis: number) => void;
}) {
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
      <label className={styles.field}>
        Średni przychód do zasiłku po potrąceniu (zł)
        <input name="average" type="number" min=".01" max="1000000" step=".01" required />
      </label>
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
          <label className={styles.field}>
            Średnia najniższa podstawa po potrąceniu (zł)
            <input name="minimum" type="number" min=".01" max="1000000" step=".01" required />
          </label>
          <label className={styles.field}>
            Pełne miesiące z aktualnego tytułu
            <input name="current" type="number" min="1" max="11" step="1" required />
          </label>
          <label className={styles.field}>
            Pełne miesiące z poprzedniego tytułu zaliczane przez ZUS
            <input name="prior" type="number" min="0" max="11" step="1" defaultValue="0" required />
          </label>
        </div>
      ) : null}
      {error ? <p role="alert">Sprawdź podane kwoty i liczbę miesięcy.</p> : null}
      <Button type="submit" variant="brand" size="sm">
        Oblicz i użyj podstawy
      </Button>
    </form>
  );
}
