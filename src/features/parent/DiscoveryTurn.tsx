import { Button } from "../../components/ui/Button";
import { labels } from "../../engine/parent-case";
import { discoverProcedures } from "../../engine/discover-procedures";
import type { DiscoveryItem } from "../../engine/discover-procedures";
import { questions } from "../../data/questions";
import { PlanningPlan } from "../guide/PlanningPlan";
import { ReportSourceLink } from "../guide/ReportSourceLink";
import { MilaMessage } from "../guide/ThreadMessage";
import type { ParentWorkspace } from "./useParentWorkspace";
import { personLabel, revisableInterviewAnswers } from "./workspace-session";
import styles from "./InterviewTurn.module.css";

const statusLabels = {
  relevant: "Pasuje do odpowiedzi — sprawdź szczegóły",
  possible: "Do sprawdzenia",
  "missing-data": "Potrzebne dodatkowe dane",
  "not-relevant": "Poza dopasowaniem",
};
const flagLabels = {
  future: "Przyszła możliwość",
  "needs-input": "Do uzupełnienia",
  "rule-review": "Wymaga weryfikacji",
  "unsupported-scope": "Ograniczony zakres",
  stale: "Dane wymagają odświeżenia",
};
export function DiscoveryTurn({ workspace }: { workspace: ParentWorkspace }) {
  const s = workspace.session;
  const discovery = discoverProcedures(s.data);
  const text =
    discovery.route === "loss"
      ? "Możesz wybrać wsparcie lub spokojnie sprawdzić zasiłek po stracie."
      : discovery.route === "planning"
        ? "Na etapie planowania możesz przygotować się do przyszłych formalności."
        : discovery.contextRequired
          ? "Ustalmy osobę i sytuację rodziny. Dzięki temu pokażę trafniejsze sprawy."
          : "Oto dopasowane sprawy. To wstępne wskazówki; szczegółowe sprawdzenie ustala warunki i ewentualną kwotę.";
  return (
    <MilaMessage
      copyText={text}
      smartComponents={
        <div className={styles.controls}>
          {discovery.planning ? (
            <PlanningPlan
              interests={undefined}
              checked={s.tasks
                .filter((id) => id.startsWith(`${s.data.family.event.id}:planning:`))
                .map((id) => id.slice(`${s.data.family.event.id}:planning:`.length))}
              onToggle={(id) => workspace.toggleTask(`${s.data.family.event.id}:planning:${id}`)}
            />
          ) : null}
          {discovery.contextRequired ? (
            <Button variant="brand" onClick={workspace.resumeInterview}>
              Ustal osobę i sytuację
            </Button>
          ) : (
            <>
              <ul className={styles.cards}>
                {discovery.items.map((item, i) => (
                  <DiscoveryCard key={i} item={item} workspace={workspace} />
                ))}
              </ul>
              {discovery.remaining.length ? (
                <details className={styles.details}>
                  <summary>Pozostałe sprawy ({discovery.remaining.length})</summary>
                  <ul className={styles.cards}>
                    {discovery.remaining.map((item, i) => (
                      <DiscoveryCard key={i} item={item} workspace={workspace} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
          {discovery.excluded.length ? (
            <details className={styles.details}>
              <summary>Dlaczego poza listą ({discovery.excluded.length})</summary>
              <ul>
                {discovery.excluded.map((item, i) => (
                  <li key={i}>
                    <strong>{item.evaluation.procedure.title}</strong> ·{" "}
                    {personLabel(
                      s,
                      item.target.subject.kind === "person"
                        ? item.target.subject.personId
                        : undefined,
                    )}
                    <p>{item.evaluation.reasons.map((r) => r.text).join(" ")}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {discovery.referrals.length ? (
            <details className={styles.details} open={discovery.route !== "standard"}>
              <summary>Sprawdź zasiłek w kalkulatorze ({discovery.referrals.length})</summary>
              <div className={styles.cards}>
                {discovery.referrals.map((r) => (
                  <div key={r.action.benefit} className={styles.card}>
                    <strong>{labels[r.action.benefit]}</strong>
                    <p className={styles.meta}>{r.reason}</p>
                    <Button variant="outline" onClick={() => workspace.destination(r.action)}>
                      Sprawdź: {labels[r.action.benefit]}
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          <div className={styles.actions}>
            <Button variant="outline" onClick={workspace.resumeInterview}>
              Uzupełnij wywiad lub dodaj drugą osobę
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const ref = { id: "subject" as const, eventId: s.data.family.event.id };
                workspace.editInterview(ref);
              }}
            >
              Zmień osobę
            </Button>
            <Button variant="ghost" onClick={workspace.requestBenefit}>
              Wiem, jakie świadczenie sprawdzić
            </Button>
            <Button variant="ghost" onClick={() => workspace.open("formalities")}>
              Plan formalności
            </Button>
            {discovery.route === "loss" ? (
              <Button variant="ghost" onClick={() => workspace.open("support")}>
                Potrzebuję wsparcia
              </Button>
            ) : null}
          </div>
          {s.data.interview.visited.length ? (
            <details className={styles.details}>
              <summary>Popraw odpowiedzi wywiadu</summary>
              <div className={styles.actions}>
                {revisableInterviewAnswers(s).map((ref, i) => (
                  <Button
                    size="sm"
                    variant="outline"
                    key={i}
                    onClick={() => workspace.editInterview(ref)}
                  >
                    Popraw:{" "}
                    {ref.id === "stage"
                      ? "etap"
                      : ref.id === "subject"
                        ? "osobę"
                        : ref.id === "employment"
                          ? "zatrudnienie"
                          : ref.id === "timing"
                            ? "datę"
                            : "temat"}
                  </Button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      }
    >
      <p data-chat-focus tabIndex={-1}>
        {text}
      </p>
    </MilaMessage>
  );
}
function DiscoveryCard({ item, workspace }: { item: DiscoveryItem; workspace: ParentWorkspace }) {
  const s = workspace.session;
  const { evaluation, presentation } = item;
  const missing = evaluation.missingFields[0] ?? presentation.deadlineMissingFields[0];
  const subject = item.target.subject;
  const checked = s.data.assessments.find(
    (a) =>
      (a.kind === "calculator" &&
        item.action.destination.kind === "calculator" &&
        a.benefit === item.action.destination.benefit &&
        a.target.subject.kind === "person" &&
        subject.kind === "person" &&
        a.target.subject.personId === subject.personId &&
        a.target.subject.titleId === subject.titleId) ||
      (a.kind === "procedure" &&
        a.procedureId === item.procedureId &&
        JSON.stringify(a.target) === JSON.stringify(item.target)),
  );
  const action = item.action.destination;
  return (
    <li className={styles.card}>
      <h3>{evaluation.procedure.title}</h3>
      <p className={styles.meta}>
        {personLabel(s, subject.kind === "person" ? subject.personId : item.target.applicantId)}
        {subject.kind === "person" && subject.titleId
          ? ` · tytuł ${(s.data.persons.find((p) => p.id === subject.personId)?.titles.findIndex((t) => t.id === subject.titleId) ?? 0) + 1}`
          : ""}
      </p>
      <p>{evaluation.reasons[0]?.text ?? evaluation.procedure.summary}</p>
      <p className={styles.meta}>
        {checked?.result
          ? checked.result.state === "stale"
            ? "Poprzedni wynik jest nieaktualny"
            : "Sprawdzono dla zapisanych danych"
          : presentation.kind === "preliminary-referral"
            ? "Wstępne skierowanie — zakres wymaga ustalenia"
            : statusLabels[evaluation.status]}
        {presentation.flags.length
          ? ` · ${presentation.flags.map((f) => flagLabels[f]).join(" · ")}`
          : ""}
      </p>
      {missing ? (
        <p className={styles.meta}>Do ustalenia: {questions[missing].label}</p>
      ) : item.action.missing.length ? (
        <p className={styles.meta}>Najpierw ustalimy właściwą osobę, tytuł i zakres sprawy.</p>
      ) : null}
      {action.kind === "officialGuidance" ? (
        <ReportSourceLink sourceId={action.sourceId} />
      ) : (
        <Button variant="outline" onClick={() => workspace.destination(action, item)}>
          {action.kind === "calculator" ? "Sprawdź szczegółowo" : "Sprawdź formalność"}
        </Button>
      )}
    </li>
  );
}
