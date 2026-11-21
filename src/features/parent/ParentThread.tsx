import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import { GuideHelpReply } from "../guide/GuideHelp";
import { MilaMessage, UserMessage } from "../guide/ThreadMessage";
import { BenefitAssessment, BenefitSelection } from "./BenefitTurn";
import type { OpenPdfPreview } from "./AttachmentPreview";
import { factValue, fields } from "./case-fields";
import type { CaseAnswer, CaseTurn } from "./case-session";
import { DocumentTurn } from "./DocumentTurn";
import { FactControl } from "./FactControl";
import { SupportCard } from "./ParentExtras";
import { caseExamples } from "./parent-examples";
import type { CaseTool } from "./parent-intent";
import { isExpanded } from "./useParentWorkspace";
import type { ExpandedTool, ParentWorkspace } from "./useParentWorkspace";
import styles from "./ParentCard.module.css";

const toolLabels: Record<ExpandedTool, string> = {
  plan: "Porównaj warianty opieki",
  formalities: "Zobacz plan formalności",
  facts: "Zmień dane",
  services: "Symulacje usług",
  rules: "Panel administracyjny demo",
};

export function ParentThread({
  workspace,
  onChoosePdf,
  onPreview,
}: {
  workspace: ParentWorkspace;
  onChoosePdf: () => void;
  onPreview: OpenPdfPreview;
}) {
  const { session, thinking, benefitTurn } = workspace;
  const latest = session.turns.at(-1);
  const [edit, setEdit] = useState<{ answer: CaseAnswer; at: CaseTurn | undefined }>();
  const editTrigger = useRef<HTMLButtonElement>(null);
  const waiting = latest?.kind === "propose" || latest?.kind === "document";
  const activeBenefit = waiting ? undefined : benefitTurn;

  function cancelEdit() {
    setEdit(undefined);
    editTrigger.current?.focus();
  }

  return (
    <>
      {session.turns.map((turn, index) => {
        const current = turn === latest;
        const answer =
          turn.kind === "user" &&
          !thinking &&
          !waiting &&
          turn.answer &&
          session.answered.includes(turn.answer)
            ? turn.answer
            : undefined;
        const editing = Boolean(answer && edit && edit.at === latest && edit.answer === answer);
        return (
          <div
            key={turn.kind === "document" ? turn.preview : index}
            data-chat-scroll
            tabIndex={-1}
            data-chat-current={current}
          >
            {turn.kind === "user" ? (
              <>
                <UserMessage
                  question={answer?.question.text}
                  editing={answer ? editing : undefined}
                  onEdit={
                    answer
                      ? (trigger) => {
                          if (editing) cancelEdit();
                          else {
                            editTrigger.current = trigger;
                            setEdit({ answer, at: latest });
                          }
                        }
                      : undefined
                  }
                >
                  {turn.text}
                </UserMessage>
                {answer && editing ? (
                  <AnswerEdit
                    answer={answer}
                    value={session.family.facts[answer.field]}
                    today={session.asOf}
                    onCancel={cancelEdit}
                    onSave={(facts) => {
                      if (session.family.facts[answer.field] === facts[answer.field]) cancelEdit();
                      else {
                        setEdit(undefined);
                        workspace.correct(answer, facts);
                      }
                    }}
                  />
                ) : null}
              </>
            ) : turn.kind === "document" ? (
              <DocumentTurn
                document={turn}
                session={session}
                active={current}
                onPreview={onPreview}
                onContinue={(data) => workspace.finishDocument(turn, data)}
              />
            ) : (
              <Turn
                turn={turn}
                activeBenefit={turn === activeBenefit}
                controls={current && !thinking}
                workspace={workspace}
                onChoosePdf={onChoosePdf}
              />
            )}
          </div>
        );
      })}
      {thinking ? <output className={styles.thinking}>Mila odpowiada…</output> : null}
    </>
  );
}

function AnswerEdit({
  answer,
  value,
  today,
  onSave,
  onCancel,
}: {
  answer: CaseAnswer;
  value: CaseFacts[FactKey];
  today: string;
  onSave: (facts: CaseFacts) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const prompt = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => prompt.current?.focus(), []);

  return (
    <section className={`${styles.card} ${styles.answerEdit}`} aria-label="Edycja odpowiedzi">
      <p id={id} ref={prompt} tabIndex={-1}>
        {answer.question.text}
      </p>
      <FactControl
        fact={answer.field}
        today={today}
        onSave={onSave}
        guided={{ promptId: id, initialValue: value, submitLabel: "Zapisz odpowiedź" }}
      />
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Anuluj
      </Button>
    </section>
  );
}

function Turn({
  turn,
  activeBenefit,
  controls,
  workspace,
  onChoosePdf,
}: {
  turn: Exclude<CaseTurn, { kind: "user" | "document" }>;
  activeBenefit: boolean;
  controls: boolean;
  workspace: ParentWorkspace;
  onChoosePdf: () => void;
}) {
  if (turn.kind === "help") return <GuideHelpReply answer={turn.answer} />;
  if (turn.kind === "chooseBenefit")
    return <BenefitSelection turn={turn} active={activeBenefit} workspace={workspace} />;
  if (turn.kind === "assessment")
    return <BenefitAssessment turn={turn} active={activeBenefit} workspace={workspace} />;

  const smartComponents =
    turn.kind === "propose" ? (
      <div className={styles.turnControls}>
        <div className={styles.card}>
          <dl className={styles.values}>
            {Object.entries(turn.facts).map(([name, value]) => {
              const key = name as FactKey;
              return (
                <div key={key}>
                  <dt>{fields[key].label}</dt>
                  <dd>{factValue(key, value)}</dd>
                </div>
              );
            })}
          </dl>
          {controls ? (
            <div className={styles.actions}>
              <Button
                size="sm"
                variant="brand"
                onClick={() => workspace.resolveProposal(turn, true)}
              >
                Potwierdź dane
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => workspace.resolveProposal(turn, false)}
              >
                Podaj dane po kolei
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    ) : turn.kind === "tool" && (controls || isExpanded(turn.tool)) ? (
      <div className={styles.turnControls}>
        <CaseToolContent tool={turn.tool} workspace={workspace} onChoosePdf={onChoosePdf} />
      </div>
    ) : null;

  return (
    <MilaMessage copyText={turn.text} smartComponents={smartComponents}>
      <p tabIndex={-1} data-chat-focus>
        {turn.text}
      </p>
    </MilaMessage>
  );
}

function CaseToolContent({
  tool,
  workspace,
  onChoosePdf,
}: {
  tool: CaseTool;
  workspace: ParentWorkspace;
  onChoosePdf: () => void;
}) {
  if (tool === "documents") {
    return (
      <Button size="sm" variant="outline" onClick={onChoosePdf}>
        <Icon name="paperclip" /> Dodaj PDF
      </Button>
    );
  }
  if (isExpanded(tool)) {
    return (
      <Button size="sm" variant="outline" onClick={() => workspace.setExpanded(tool)}>
        {toolLabels[tool]}
      </Button>
    );
  }
  if (tool === "support") {
    return <SupportCard onStillbirth={() => workspace.begin("lossMaternity")} />;
  }
  return (
    <>
      {Object.keys(workspace.session.family.facts).length ? (
        <p>Wybranie przykładu zastąpi dane bieżącej sprawy.</p>
      ) : null}
      <div className={styles.actions}>
        {caseExamples.map(({ benefit, facts, label }) => (
          <Button
            key={label}
            size="sm"
            variant="outline"
            onClick={() => workspace.load(benefit, facts, label)}
          >
            {label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => workspace.setExpanded("services")}>
          Symulacje usług
        </Button>
      </div>
    </>
  );
}
