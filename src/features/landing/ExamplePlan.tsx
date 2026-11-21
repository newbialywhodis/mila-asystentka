import { documents } from "../../data/references";
import { questions } from "../../data/questions";
import { sources } from "../../data/sources";
import type { ProcedureResult } from "../../types/catalog";
import { formatDate } from "../guide/flow";
import {
  exampleAllowance,
  exampleAnswers,
  exampleAsOf,
  exampleRegistration,
  exampleVersion,
} from "./exampleCase";
import styles from "./ExamplePlan.module.css";
import landingStyles from "./MilaLanding.module.css";

function ExampleItem({ result }: { result: ProcedureResult }) {
  const { procedure, missingFields, deadlines } = result;
  const source = sources[procedure.sources[procedure.sources.length - 1]];
  return (
    <article className={styles.item}>
      <p className={styles.status}>
        {missingFields.length ? "Wymaga dodatkowych danych" : "Pasuje do podanych odpowiedzi"}
      </p>
      <h3>{procedure.title}</h3>
      <p>{procedure.summary}</p>
      <dl>
        {missingFields.length ? (
          <div>
            <dt>Do potwierdzenia</dt>
            <dd>{missingFields.map((field) => questions[field].label).join(" ")}</dd>
          </div>
        ) : null}
        {deadlines.map(({ id, title, date, consequence }) => (
          <div key={id}>
            <dt>{title}</dt>
            <dd>
              {date ? (
                <strong>
                  Do <time dateTime={date}>{formatDate(date)}</time>.{" "}
                </strong>
              ) : null}
              {consequence}
            </dd>
          </div>
        ))}
        <div>
          <dt>Gdzie załatwisz sprawę</dt>
          <dd>{procedure.authority}</dd>
        </div>
        {result.documents.length && procedure.category === "registration" ? (
          <div>
            <dt>Dokument lub usługa</dt>
            <dd>{result.documents.map(({ id }) => documents[id].title).join(", ")}</dd>
          </div>
        ) : null}
        <div>
          <dt>Najbliższa czynność</dt>
          <dd>{procedure.steps[0]}</dd>
        </div>
      </dl>
      <a href={source.url}>
        {source.authority}: {source.title}
      </a>
    </article>
  );
}

export function ExamplePlan() {
  return (
    <section
      id="przykladowy-plan"
      tabIndex={-1}
      className={`${landingStyles.container} ${styles.example}`}
      aria-labelledby="example-title"
    >
      <div className={landingStyles.sectionHeading}>
        <div>
          <p className={styles.label}>Przykładowy plan · fikcyjne dane</p>
          <h2 id="example-title">Anna: pierwsze sprawy po porodzie</h2>
        </div>
        <p>
          Anna pracuje na etacie. Dziecko urodziło się{" "}
          <time dateTime={exampleAnswers.birthDate}>{formatDate(exampleAnswers.birthDate)}</time>.
          Urodzenie nie jest jeszcze zgłoszone, a kartę urodzenia sporządzono{" "}
          <time dateTime={exampleAnswers.birthCardDate}>
            {formatDate(exampleAnswers.birthCardDate)}
          </time>
          .
        </p>
      </div>
      <div className={styles.items}>
        <ExampleItem result={exampleRegistration} />
        <ExampleItem result={exampleAllowance} />
      </div>
      <p className={styles.note}>
        To dwa elementy planu z tego samego mechanizmu co w rozmowie, a nie decyzja o świadczeniu.
        Rozmowa nie pyta jeszcze o ubezpieczenie w dniu porodu — ten warunek trzeba potwierdzić.
        Prototyp nie oblicza indywidualnej kwoty wypłaty.
      </p>
      <p className={styles.audit}>
        Ocena przykładu na dzień <time dateTime={exampleAsOf}>{formatDate(exampleAsOf)}</time>.
        Wersja reguł: {exampleVersion}. Daty dotyczą wyłącznie tej fikcyjnej sytuacji.
      </p>
    </section>
  );
}
