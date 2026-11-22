import { Tabs } from "@base-ui/react/tabs";
import { useMemo } from "react";
import { Icon } from "../../components/ui/Icon";
import { ScrollArea } from "../../components/ui/ScrollArea";
import { amounts, documents } from "../../data/references";
import { questions } from "../../data/questions";
import { assemblePlan, generatePlan } from "../../engine/plan";
import type { ProcedureResult } from "../../types/catalog";
import type { Profile } from "../../types/profile";
import { formatDate } from "./flow";
import type { Period } from "./flow";
import styles from "./PlanDetails.module.css";
import reportStyles from "./PlanReport.module.css";
import { ReportSourceLink } from "./ReportSourceLink";

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
    <>
      {profile.stage === "pregnant" ? (
        <div className={styles.preparation}>
          <Icon name="calendar" />
          <div>
            <h3 className={reportStyles.title}>
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
        <ol className={reportStyles.items}>
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
              <li key={`${procedure.id}-${id}`} className={styles.deadline}>
                {date ? (
                  <p className={styles.date} data-expired={date < asOf}>
                    {date < asOf ? "Termin minął · " : ""}
                    {opens ? (
                      <>
                        <time dateTime={opens}>{formatDate(opens)}</time> –{" "}
                      </>
                    ) : null}
                    <time dateTime={date}>{formatDate(date)}</time>
                  </p>
                ) : null}
                <h3 className={reportStyles.title}>{title}</h3>
                <p className={reportStyles.meta}>{procedure.title}</p>
                {missingField ? (
                  <p>
                    Do wyliczenia terminu potrzebna jest odpowiedź na pytanie „
                    {questions[missingField].label}”
                  </p>
                ) : null}
                <p>
                  {consequence} <ReportSourceLink sourceId={sourceIds[0]} />
                </p>
              </li>
            ),
          )}
        </ol>
      ) : (
        <p className={styles.empty}>W planie nie ma terminów powiązanych z Twoimi odpowiedziami.</p>
      )}
    </>
  );
}

function Benefits({ items, medicalCare }: { items: ProcedureResult[]; medicalCare?: boolean }) {
  const benefits = items.filter(
    ({ procedure }) => procedure.category !== "registration" && procedure.category !== "health",
  );
  if (!benefits.length) {
    return <p className={styles.empty}>Brakuje świadczeń dopasowanych do tych odpowiedzi.</p>;
  }

  return (
    <div className={reportStyles.items}>
      {benefits.map(
        ({ procedure, status, amounts: amountIds, duration, documents: needed, reasons }) => (
          <details key={procedure.id} className={styles.benefit}>
            <summary>
              <span>
                <strong className={reportStyles.title}>{procedure.title}</strong>
                <span className={reportStyles.meta}>
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
                        {documents[id].title}{" "}
                        <ReportSourceLink
                          sourceId={documents[id].source}
                          label={documents[id].title}
                        />
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
                    <ReportSourceLink sourceId={id} showTitle />
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ),
      )}
    </div>
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
  if (!tasks.length) {
    return <p className={styles.empty}>W tej chwili plan nie zawiera zadań do odhaczenia.</p>;
  }

  return (
    <ul className={reportStyles.items}>
      {tasks.map(({ procedure }) => (
        <li key={procedure.id}>
          <label className={`${reportStyles.row} ${reportStyles.check}`}>
            <input
              type="checkbox"
              aria-labelledby={`task-title-${procedure.id}`}
              checked={checked.includes(procedure.id)}
              onChange={() => onToggle(procedure.id)}
            />
            <span>
              <strong id={`task-title-${procedure.id}`} className={reportStyles.title}>
                {procedure.title}
              </strong>
              <span className={reportStyles.meta}>
                {profile.stage === "pregnant" &&
                procedure.phase === "birth" &&
                procedure.id !== "MATERNITY_LEAVE"
                  ? "Po narodzinach · "
                  : ""}
                {procedure.authority}
              </span>
              <span className={styles.taskStep}>{procedure.steps[0]}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function PlanDetails({
  profile,
  evaluatedResults,
  period,
  asOf,
  checked,
  onToggle,
}: {
  profile: Profile;
  evaluatedResults?: ProcedureResult[];
  period?: Period;
  asOf: string;
  checked: string[];
  onToggle: (id: string) => void;
}) {
  const { items } = useMemo(
    () =>
      evaluatedResults
        ? assemblePlan(evaluatedResults, profile, asOf)
        : generatePlan(profile, asOf),
    [evaluatedResults, profile, asOf],
  );
  const notice =
    profile.standardResidence === false ? (
      <p className={styles.notice}>
        Jeśli sprawa dotyczy też innego kraju, potwierdź zasady z instytucją przyjmującą wniosek.
      </p>
    ) : null;

  return (
    <>
      <Tabs.Panel value="timeline" render={<ScrollArea contentClassName={reportStyles.content} />}>
        {notice}
        <Timeline profile={profile} period={period} items={items} asOf={asOf} />
      </Tabs.Panel>
      <Tabs.Panel value="benefits" render={<ScrollArea contentClassName={reportStyles.content} />}>
        {notice}
        <Benefits items={items} medicalCare={profile.medicalCareWeek10} />
      </Tabs.Panel>
      <Tabs.Panel value="tasks" render={<ScrollArea contentClassName={reportStyles.content} />}>
        {notice}
        <Tasks profile={profile} items={items} checked={checked} onToggle={onToggle} />
      </Tabs.Panel>
    </>
  );
}
