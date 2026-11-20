import { useMemo } from "react";
import { Icon } from "../../components/ui/Icon";
import { amounts, documents } from "../../data/references";
import { questions } from "../../data/questions";
import { sources } from "../../data/sources";
import { generatePlan } from "../../engine/plan";
import type { ProcedureResult } from "../../types/catalog";
import type { Profile } from "../../types/profile";
import { formatDate } from "./flow";
import type { Period } from "./flow";
import type { PlanSection } from "./PlanNavigation";
import styles from "./PlanDetails.module.css";

const statusLabels: Record<ProcedureResult["status"], string> = {
  relevant: "Pasuje do Twoich odpowiedzi",
  possible: "Do sprawdzenia",
  "missing-data": "Wymaga dodatkowych danych",
  "not-relevant": "Poza planem",
};

const pregnancyPreparation: Record<Period, string> = {
  early:
    "Na początku ciąży zachowaj dokumentację wizyt. Może być potrzebna później przy wniosku o becikowe.",
  middle: "W drugim trymestrze możesz sprawdzić, jakie dokumenty będą potrzebne po narodzinach.",
  late: "Przed porodem przygotuj dane do zgłoszenia urodzenia i sprawdź, gdzie złożyć najważniejsze wnioski.",
};

function timelineDeadlines(items: ProcedureResult[]) {
  return items
    .flatMap(({ procedure, deadlines }) =>
      deadlines.map((deadline) => ({ ...deadline, procedure })),
    )
    .sort((first, second) =>
      (first.date ?? "9999-12-31").localeCompare(second.date ?? "9999-12-31"),
    );
}

function Timeline({
  profile,
  period,
  items,
  asOf,
}: {
  profile: Profile;
  period?: Period;
  items: ProcedureResult[];
  asOf: string;
}) {
  const deadlines = timelineDeadlines(items);

  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Harmonogram</h2>
      {profile.stage === "pregnant" ? (
        <div className={styles.preparation}>
          <Icon name="calendar" />
          <div>
            <h3>
              {profile.dueDate ? (
                <time dateTime={profile.dueDate}>{formatDate(profile.dueDate)}</time>
              ) : (
                "Przed narodzinami"
              )}
            </h3>
            <p>
              {profile.dueDate
                ? "Podany przewidywany termin porodu. Terminy liczone od urodzenia zależą od faktycznej daty."
                : period
                  ? pregnancyPreparation[period]
                  : "Poznaj terminy formalności, które mogą Cię dotyczyć po narodzinach."}
            </p>
          </div>
        </div>
      ) : null}
      {deadlines.length ? (
        <ol className={styles.timeline}>
          {deadlines.map(
            ({
              procedure,
              id,
              title,
              date,
              opens,
              consequence,
              missingField,
              sources: sourceIds,
            }) => (
              <li key={`${procedure.id}-${id}`}>
                <p className={styles.meta}>{procedure.title}</p>
                <h3>{title}</h3>
                {date ? (
                  <p className={styles.date}>
                    {date < asOf ? "Termin minął · " : ""}
                    {opens ? (
                      <>
                        <time dateTime={opens}>{formatDate(opens)}</time> –{" "}
                      </>
                    ) : null}
                    <time dateTime={date}>{formatDate(date)}</time>
                  </p>
                ) : null}
                {missingField ? (
                  <p>
                    Do wyliczenia terminu potrzebna jest odpowiedź na pytanie „
                    {questions[missingField].label}”
                  </p>
                ) : null}
                <p>{consequence}</p>
                <a href={sources[sourceIds[0]].url} target="_blank" rel="noreferrer">
                  Źródło · {sources[sourceIds[0]].authority}
                </a>
              </li>
            ),
          )}
        </ol>
      ) : (
        <p className={styles.empty}>W planie nie ma terminów powiązanych z Twoimi odpowiedziami.</p>
      )}
    </section>
  );
}

function Benefits({ items, medicalCare }: { items: ProcedureResult[]; medicalCare?: boolean }) {
  const benefits = items.filter(
    ({ procedure }) => procedure.category !== "registration" && procedure.category !== "health",
  );
  return (
    <section aria-labelledby="benefits-heading">
      <h2 id="benefits-heading">Świadczenia i uprawnienia</h2>
      {benefits.length ? (
        benefits.map(
          ({ procedure, status, amounts: amountIds, duration, documents: needed, reasons }) => (
            <details key={procedure.id} className={styles.benefit}>
              <summary>
                <span>
                  <strong>{procedure.title}</strong>
                  <span className={styles.meta}>
                    {statusLabels[status]} · {procedure.authority}
                  </span>
                </span>
                <Icon name="chevron" size="sm" />
              </summary>
              <div className={styles.detail}>
                <p>{procedure.summary}</p>
                {procedure.id === "BIRTH_GRANT_BECIKOWE" && medicalCare !== undefined ? (
                  <p>
                    {medicalCare
                      ? "Zachowaj dokumentację wizyt. Po porodzie może być potrzebne zaświadczenie o opiece medycznej."
                      : "Jeśli opieka zaczęła się po 10. tygodniu ciąży, zapytaj w gminie, jak wpływa to na możliwość otrzymania becikowego."}
                  </p>
                ) : null}
                {reasons
                  .filter(({ id }) => id === "review" || id === "future" || id === "validity")
                  .map(({ id, text }) => (
                    <p key={id}>{text}</p>
                  ))}
                {amountIds.length ? (
                  <ul>
                    {amountIds.map((id) => (
                      <li key={id}>
                        {amounts[id].label}
                        {status !== "relevant" ? " · zależnie od warunków" : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {duration ? (
                  <p>
                    {duration.note} · {duration.weeks} tyg.
                  </p>
                ) : null}
                <h3>Co możesz zrobić</h3>
                <ol>
                  {procedure.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {needed.length ? (
                  <>
                    <h3>Dokumenty</h3>
                    <ul>
                      {needed.map(({ id, note, state }) => (
                        <li key={id}>
                          <a
                            href={sources[documents[id].source].url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {documents[id].title}
                          </a>
                          {state === "conditional" ? " · zależnie od sytuacji" : ""}
                          {note ? <p>{note}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <h3>Źródła</h3>
                <ul>
                  {procedure.sources.map((id) => (
                    <li key={id}>
                      <a href={sources[id].url} target="_blank" rel="noreferrer">
                        {sources[id].authority} — {sources[id].title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ),
        )
      ) : (
        <p className={styles.empty}>Brakuje świadczeń dopasowanych do tych odpowiedzi.</p>
      )}
    </section>
  );
}

const taskProcedures = new Set([
  "EMPLOYMENT_PREGNANCY_PROTECTION",
  "SICKNESS_PREGNANCY",
  "BIRTH_REGISTRATION",
  "CHILD_HEALTH_INSURANCE",
  "MATERNITY_LEAVE",
  "CHILD_800_PLUS",
]);

export function PlanPreview({
  profile,
  period,
  asOf,
}: {
  profile: Profile;
  period?: Period;
  asOf: string;
}) {
  const { items } = useMemo(() => generatePlan(profile, asOf), [profile, asOf]);
  const deadlines = timelineDeadlines(items.filter(({ status }) => status === "relevant"))
    .flatMap(({ id, procedure, title, date }) =>
      date && date >= asOf ? [{ id, procedure, title, date }] : [],
    )
    .slice(0, 2);
  const tasks = items.filter(({ procedure }) => taskProcedures.has(procedure.id)).slice(0, 2);

  return (
    <div className={styles.preview}>
      {profile.stage === "pregnant" && period ? <p>{pregnancyPreparation[period]}</p> : null}
      {deadlines.length > 0 ? (
        <>
          <h3>Najbliższe terminy</h3>
          <ul>
            {deadlines.map(({ id, procedure, title, date }) => (
              <li key={`${procedure.id}-${id}`}>
                <strong>{title}</strong>
                <time dateTime={date}>{formatDate(date)}</time>
              </li>
            ))}
          </ul>
        </>
      ) : tasks.length > 0 ? (
        <>
          <h3>Sprawy do sprawdzenia</h3>
          <ul>
            {tasks.map(({ procedure }) => (
              <li key={procedure.id}>{procedure.title}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function Tasks({
  profile,
  items,
  checked,
  onToggle,
}: {
  profile: Profile;
  items: ProcedureResult[];
  checked: string[];
  onToggle: (id: string) => void;
}) {
  const tasks = items.filter(({ procedure }) => taskProcedures.has(procedure.id));
  return (
    <section aria-labelledby="tasks-heading">
      <h2 id="tasks-heading">Lista zadań</h2>
      {tasks.length ? (
        <ul className={styles.tasks}>
          {tasks.map(({ procedure }) => (
            <li key={procedure.id}>
              <label
                htmlFor={`task-${procedure.id}`}
                aria-labelledby={`task-title-${procedure.id}`}
              >
                <input
                  id={`task-${procedure.id}`}
                  type="checkbox"
                  aria-labelledby={`task-title-${procedure.id}`}
                  checked={checked.includes(procedure.id)}
                  onChange={() => onToggle(procedure.id)}
                />
                <span>
                  <strong id={`task-title-${procedure.id}`}>{procedure.title}</strong>
                  <span className={styles.meta}>
                    {profile.stage === "pregnant" &&
                    procedure.phase === "birth" &&
                    procedure.id !== "MATERNITY_LEAVE"
                      ? "Po narodzinach · "
                      : ""}
                    {procedure.authority}
                  </span>
                  <span>{procedure.steps[0]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>W tej chwili plan nie zawiera zadań do odhaczenia.</p>
      )}
    </section>
  );
}

export function PlanDetails({
  profile,
  period,
  section,
  asOf,
  checked,
  onToggle,
}: {
  profile: Profile;
  period?: Period;
  section: PlanSection;
  asOf: string;
  checked: string[];
  onToggle: (id: string) => void;
}) {
  const { items } = useMemo(() => generatePlan(profile, asOf), [profile, asOf]);
  return (
    <div className={styles.details}>
      {profile.standardResidence === false ? (
        <p className={styles.notice}>
          Jeśli sprawa dotyczy też innego kraju, potwierdź zasady z instytucją przyjmującą wniosek.
        </p>
      ) : null}
      {section === "timeline" ? (
        <Timeline profile={profile} period={period} items={items} asOf={asOf} />
      ) : null}
      {section === "benefits" ? (
        <Benefits items={items} medicalCare={profile.medicalCareWeek10} />
      ) : null}
      {section === "tasks" ? (
        <Tasks profile={profile} items={items} checked={checked} onToggle={onToggle} />
      ) : null}
    </div>
  );
}
