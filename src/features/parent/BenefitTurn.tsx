import { getParentCase, assessmentTurnIsCurrent } from "./case-session";
import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { benefits, labels } from "../../engine/parent-case";
import type { FactKey } from "../../engine/parent-case";
import { SingleChoice } from "../guide/QuestionControls";
import { MilaMessage } from "../guide/ThreadMessage";
import { fields } from "./case-fields";
import type { AssessmentTurn, BenefitChoice, CaseQuestion } from "./case-session";
import { FactControl } from "./FactControl";
import { ContributionBasisForm } from "./ContributionBasisForm";
import { PayrollBasisForm } from "./PayrollBasisForm";
import { assessmentCopyText, NextSteps, ResultCard } from "./ParentResult";
import type { ParentWorkspace } from "./useParentWorkspace";
import styles from "./ParentCard.module.css";

const benefitOptions = benefits.map((benefit) => ({ value: benefit, label: labels[benefit] }));

export function BenefitSelection({
  turn,
  active,
  workspace,
}: {
  turn: BenefitChoice;
  active: boolean;
  workspace: ParentWorkspace;
}) {
  const promptId = useId();

  const smartComponents = active ? (
    <div className={styles.turnControls}>
      <SingleChoice
        className={styles.benefitOptions}
        options={benefitOptions}
        labelledBy={promptId}
        selected={workspace.session.benefit ?? undefined}
        onAnswer={(benefit) => workspace.begin(benefit, turn)}
      />
      {workspace.session.benefit ? (
        <Button size="sm" variant="ghost" onClick={workspace.resume}>
          Wróć do sprawy
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <MilaMessage copyText={turn.text} smartComponents={smartComponents}>
      <p id={promptId} tabIndex={-1} data-chat-focus>
        {turn.text}
      </p>
    </MilaMessage>
  );
}

export function BenefitAssessment({
  turn,
  active,
  workspace,
}: {
  turn: AssessmentTurn;
  active: boolean;
  workspace: ParentWorkspace;
}) {
  const promptId = useId();
  const { benefit, result, goal, question, deferred, text } = turn;
  const stale = !assessmentTurnIsCurrent(workspace.session, turn);
  const documents = !question && goal === "application" && result.documents.length > 0;
  const pending = question && !deferred;
  const { session } = workspace;
  const showResult = pending
    ? active && Boolean(result.period)
    : !deferred || Boolean(result.period);
  const hint = pending ? question.hint : undefined;
  const hintId = hint ? promptId + "-hint" : undefined;
  const speechText = hint ? text + "\n\n" + hint : text;
  const copyText =
    documents || showResult
      ? assessmentCopyText(speechText, benefit, result, documents)
      : speechText;

  const smartComponents =
    active || documents || showResult ? (
      <div className={styles.turnControls}>
        {documents ? (
          <div className={styles.card}>
            <NextSteps benefit={benefit} result={result} />
          </div>
        ) : showResult ? (
          <div className={styles.card}>
            <ResultCard
              benefit={benefit}
              result={result}
              insured={turn.insured}
              futureCoverage={Boolean(result.coverageDay && result.coverageDay > session.asOf)}
              showTopUp={!deferred}
              showReason={result.reason !== text}
            />
          </div>
        ) : null}
        {active && pending ? (
          <FactAnswer
            turn={turn}
            question={question}
            workspace={workspace}
            key={session.turns.indexOf(turn)}
            promptId={promptId}
            hintId={hintId}
          />
        ) : null}
        {active ? (
          <Button size="sm" variant="outline" onClick={workspace.showDiscovery}>
            Wróć do dopasowanych spraw
          </Button>
        ) : null}
        {active && !pending ? (
          <div className={styles.actions}>
            {deferred ? (
              <Button size="sm" variant="outline" onClick={workspace.resume}>
                Uzupełnij odpowiedź
              </Button>
            ) : null}
            {goal === "calculation" && result.documents.length > 0 ? (
              <Button size="sm" variant="brand" onClick={() => workspace.changeGoal("application")}>
                Zobacz dokumenty
              </Button>
            ) : null}
            {documents ? (
              <Button size="sm" variant="ghost" onClick={() => workspace.changeGoal("calculation")}>
                Wróć do wyniku
              </Button>
            ) : null}
            {!deferred && result.status === "eligible" && !result.projected ? (
              <Button size="sm" variant="outline" onClick={() => workspace.compareCare()}>
                Co zmieni powrót do pracy?
              </Button>
            ) : null}
            {!deferred && Object.keys(getParentCase(session).facts).length ? (
              <Button size="sm" variant="ghost" onClick={() => workspace.setExpanded("facts")}>
                Zmień dane
              </Button>
            ) : null}
            {!deferred ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => workspace.setExpanded("formalities")}
              >
                Inne formalności
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  if (stale)
    return (
      <MilaMessage
        copyText={
          result.period || documents
            ? "Wynik historyczny jest nieaktualny po zmianie danych."
            : text
        }
      >
        <p>
          {result.period || documents
            ? "Wynik historyczny jest nieaktualny po zmianie danych. Wróć do dopasowanych spraw, aby sprawdzić go ponownie."
            : text}
        </p>
      </MilaMessage>
    );
  return (
    <MilaMessage
      copyText={copyText}
      speechToken={null}
      speechText={speechText}
      smartComponents={smartComponents}
    >
      <p id={promptId} tabIndex={-1} data-chat-focus aria-describedby={hintId}>
        {text}
      </p>
      {hint ? (
        <p id={hintId} className={styles.muted}>
          {hint}
        </p>
      ) : null}
    </MilaMessage>
  );
}

function FactAnswer({
  turn,
  question,
  workspace,
  promptId,
  hintId,
}: {
  turn: AssessmentTurn;
  question: CaseQuestion;
  workspace: ParentWorkspace;
  promptId: string;
  hintId?: string;
}) {
  const { session } = workspace;
  const { facts } = getParentCase(session);
  const { key } = question;
  const alternate = alternateField(key, workspace);
  const activeAssessment = session.data.assessments.find(
    (a) => a.id === session.activeAssessmentId,
  );
  const relatedRequired =
    (
      [
        "otherParentDays",
        "motherInsured",
        "motherDaysAfterBirth",
        "motherDaysBeforeBirth",
        "motherJobPercent",
        "motherJobEnds",
      ] as FactKey[]
    ).includes(key) && !activeAssessment?.target.relatedPersonId;
  const [useAlternate, setUseAlternate] = useState(
    () => alternate && facts[alternate.key] !== undefined && facts[key] === undefined,
  );
  const [payroll, setPayroll] = useState(false);
  const canUsePayroll =
    key === "basis" && facts.employment === "employee" && session.benefit !== "rehabilitation";
  const canUseContributions =
    key === "basis" &&
    facts.employment !== undefined &&
    facts.employment !== "employee" &&
    session.benefit !== "rehabilitation";
  if (payroll && (canUsePayroll || canUseContributions)) {
    const onUse = (basis: number) => workspace.confirm(turn, { basis });
    return (
      <>
        {canUsePayroll ? (
          <PayrollBasisForm onUse={onUse} />
        ) : (
          <ContributionBasisForm allowsDeclared={facts.employment !== "contract"} onUse={onUse} />
        )}
        <Button size="sm" variant="ghost" onClick={() => setPayroll(false)}>
          Wróć do wpisania kwoty
        </Button>
      </>
    );
  }
  if (relatedRequired)
    return (
      <div className={styles.actions}>
        <p>
          Wskaż drugą osobę, zanim zapiszesz jej dane. Jeżeli nie ma jej jeszcze w rozmowie, dodaj
          ją w wywiadzie.
        </p>
        <Button
          variant="outline"
          onClick={() => workspace.destination({ kind: "calculator", benefit: turn.benefit })}
        >
          Wybierz powiązaną osobę
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            workspace.editInterview({ id: "subject", eventId: session.data.family.event.id })
          }
        >
          Dodaj osobę w wywiadzie
        </Button>
      </div>
    );
  const field = useAlternate && alternate ? alternate.key : key;
  const alternateId = field !== key ? promptId + "-alternate" : undefined;
  const simulateService =
    !turn.result.projected && (key === "insured" || key === "payer" || key === "debt");

  return (
    <>
      {alternateId ? <p id={alternateId}>{fields[field].question}</p> : null}
      <FactControl
        key={field}
        fact={field}
        childrenCount={facts.children}
        today={session.asOf}
        onSave={(facts) => workspace.confirm(turn, facts)}
        guided={{
          initialValue: facts[field],
          promptId: alternateId ?? promptId,
          hintId: alternateId ?? hintId,
          upcomingStart: key === "from" && facts.requestedDays !== undefined,
        }}
      />
      {key !== "birthStage" ? (
        <div className={styles.actions}>
          {canUsePayroll ? (
            <Button size="sm" variant="outline" onClick={() => setPayroll(true)}>
              Policz z listy płac
            </Button>
          ) : null}
          {canUseContributions ? (
            <Button size="sm" variant="outline" onClick={() => setPayroll(true)}>
              Policz z danych o składkach
            </Button>
          ) : null}
          {alternate ? (
            <Button size="sm" variant="outline" onClick={() => setUseAlternate(!useAlternate)}>
              {useAlternate ? alternate.returnLabel : alternate.label}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => workspace.defer(turn)}>
            Nie wiem
          </Button>
          <Button size="sm" variant="ghost" onClick={() => workspace.defer(turn, "Pomiń")}>
            Pomiń
          </Button>
          <details>
            <summary>Dlaczego o to pytasz?</summary>
            <p>
              {question.hint ??
                "Ta informacja jest potrzebna kalkulatorowi do sprawdzenia warunków, okresu lub kwoty. Możesz uzupełnić ją później."}
            </p>
          </details>
          {simulateService ? (
            <Button size="sm" variant="ghost" onClick={() => workspace.setExpanded("services")}>
              Wypróbuj dane z eZUS
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function alternateField(key: FactKey, { session }: ParentWorkspace) {
  if (key === "hospitalFrom" && session.benefit === "supplement")
    return {
      key: "hospitalRanges",
      label: "Podaj kilka okresów pobytu",
      returnLabel: "Podaj jeden okres",
    } as const;
  if (key === "qualifying")
    return {
      key: "qualifyingDays",
      label: "Podaj liczbę zaliczonych dni",
      returnLabel: "Potwierdź wyczekiwanie ręcznie",
    } as const;
  if (key === "basis" && session.benefit === "rehabilitation")
    return {
      key: "rehabSickBasis",
      label: "Policz waloryzację z podstawy chorobowego",
      returnLabel: "Podaj podstawę po waloryzacji",
    } as const;
  if (
    key === "basis" &&
    session.benefit !== "rehabilitation" &&
    getParentCase(session).facts.employment === "employee"
  ) {
    return {
      key: "fixedSalary",
      label: "Podaj stałe wynagrodzenie z 12 miesięcy",
      returnLabel: "Podaj ustaloną podstawę",
    } as const;
  }
  if (key === "payer")
    return {
      key: "insuredHeadcount",
      label: "Podaj liczbę zgłoszonych do chorobowego",
      returnLabel: "Wskaż płatnika",
    } as const;
  if (key === "standardRate")
    return {
      key: "averagedRequest",
      label: "Mam wniosek o stawkę 81,5%",
      returnLabel: "Wybierz stawkę podstawową",
    } as const;
}
