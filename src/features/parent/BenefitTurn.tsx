import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { benefits, labels } from "../../engine/parent-case";
import type { FactKey } from "../../engine/parent-case";
import { SingleChoice } from "../guide/QuestionControls";
import { MilaMessage } from "../guide/ThreadMessage";
import { fields } from "./case-fields";
import type { AssessmentTurn, BenefitChoice, CaseQuestion } from "./case-session";
import { FactControl } from "./FactControl";
import { NextSteps, ResultCard } from "./ParentResult";
import type { ParentWorkspace } from "./useParentWorkspace";
import styles from "./ParentCard.module.css";

const benefitOptions = benefits
  .filter((benefit) => benefit !== "lossMaternity")
  .map((benefit) => ({ value: benefit, label: labels[benefit] }));

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
  const documents = !question && goal === "application" && result.documents.length > 0;
  const pending = question && !deferred;
  const { session } = workspace;
  const showResult = pending
    ? active && Boolean(result.period)
    : !deferred || Boolean(result.period);
  const hint = pending ? question.hint : undefined;
  const hintId = hint ? promptId + "-hint" : undefined;

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
              <Button size="sm" variant="outline" onClick={() => workspace.setExpanded("plan")}>
                Porównaj warianty opieki
              </Button>
            ) : null}
            {!deferred && Object.keys(session.family.facts).length ? (
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

  return (
    <MilaMessage copyText={hint ? text + "\n\n" + hint : text} smartComponents={smartComponents}>
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
  const { facts } = session.family;
  const { key } = question;
  const alternate = alternateField(key, workspace);
  const [useAlternate, setUseAlternate] = useState(
    () => alternate && facts[alternate.key] !== undefined && facts[key] === undefined,
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
          {alternate ? (
            <Button size="sm" variant="outline" onClick={() => setUseAlternate(!useAlternate)}>
              {useAlternate ? alternate.returnLabel : alternate.label}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => workspace.defer(turn)}>
            Nie wiem
          </Button>
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
  if (
    key === "basis" &&
    session.benefit !== "rehabilitation" &&
    session.family.facts.employment === "employee"
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
