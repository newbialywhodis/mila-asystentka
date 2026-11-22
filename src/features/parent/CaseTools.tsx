import { getParentCase } from "./case-session";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { discoverProcedures } from "../../engine/discover-procedures";
import { confirmedValue } from "./family-session";
import { personLabel } from "./workspace-session";
import type { PlanSection } from "../guide/PlanNavigation";
import { PlanReport } from "../guide/PlanReport";
import { preferredPlanSection, suggestedPlanInterests } from "../guide/startTopics";
import type { StartTopic } from "../guide/startTopics";
import { AdminCard, SimulationCard } from "./ParentExtras";
import { CaseFactsList } from "./ParentResult";
import type { ParentWorkspace } from "./useParentWorkspace";
import styles from "./ParentCard.module.css";

export function CaseTools({
  workspace,
  active,
  topics = [],
}: {
  workspace: ParentWorkspace;
  active: boolean;
  topics?: readonly StartTopic[];
}) {
  const { expanded, setExpanded, session } = workspace;
  const close = (open: boolean) => {
    if (!open) setExpanded(null);
  };

  return (
    <>
      <Sheet
        title="Plan formalności"
        open={active && expanded === "formalities"}
        finalFocus={workspace.finalToolFocus}
        onOpenChange={close}
        wide
        keepMounted
      >
        <Formalities workspace={workspace} topics={topics} />
      </Sheet>
      {expanded === "facts" ? (
        <Sheet
          title="Zmień dane sprawy"
          open={active}
          finalFocus={workspace.finalToolFocus}
          onOpenChange={close}
        >
          <CaseFactsList
            facts={getParentCase(session).facts}
            sources={getParentCase(session).sources}
            onChange={workspace.save}
          />
        </Sheet>
      ) : null}
      {expanded === "services" ? (
        <Sheet
          title="Symulacje usług"
          description={
            Object.keys(getParentCase(session).facts).length
              ? "Po wybraniu przykładu fikcyjne dane zastąpią dane tej sprawy."
              : undefined
          }
          open={active}
          finalFocus={workspace.finalToolFocus}
          onOpenChange={close}
        >
          <SimulationCard
            onLoad={(benefit, facts) =>
              workspace.load(benefit, facts, "Użyj fikcyjnych danych", "Symulacja usługi")
            }
            onAdmin={() => workspace.setExpanded("rules")}
          />
        </Sheet>
      ) : null}
      {expanded === "rules" ? (
        <Sheet
          title="Ustawienia symulacji"
          open={active}
          finalFocus={workspace.finalToolFocus}
          onOpenChange={close}
        >
          <AdminCard rate={session.demoRate} asOf={session.asOf} onChange={workspace.setDemoRate} />
        </Sheet>
      ) : null}
    </>
  );
}

function Formalities({
  workspace,
  topics,
}: {
  workspace: ParentWorkspace;
  topics: readonly StartTopic[];
}) {
  const [section, setSection] = useState<PlanSection>(() => preferredPlanSection(topics));
  const [perspective, setPerspective] = useState("");
  const { session } = workspace;
  const discovery = discoverProcedures(session.data);
  const interests = suggestedPlanInterests(topics);
  const targets = [
    ...new Map(
      discovery.results.map((item) => [JSON.stringify(item.target), item.target]),
    ).entries(),
  ];
  const selected = targets.find(([key]) => key === perspective) ?? targets[0];
  const items = selected
    ? discovery.results.filter((item) => JSON.stringify(item.target) === selected[0])
    : [];
  const profile = items[0]?.projection.value ?? {};
  const planning = confirmedValue(session.data.family.stage) === "planning";
  if (!planning && discovery.route !== "standard")
    return (
      <div className={styles.formalities}>
        <p>
          Ustal sytuację rodziny, aby otrzymać właściwy plan. Nieznany etap nie oznacza planowania.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            workspace.setExpanded(null);
            workspace.resumeInterview();
          }}
        >
          Uzupełnij wywiad
        </Button>
      </div>
    );
  return (
    <div className={styles.formalities}>
      {targets.length > 1 ? (
        <label>
          Zakres planu{" "}
          <select value={selected?.[0]} onChange={(e) => setPerspective(e.currentTarget.value)}>
            {targets.map(([key, target]) => (
              <option key={key} value={key}>
                {personLabel(
                  session,
                  target.subject.kind === "person" ? target.subject.personId : undefined,
                )}
                {target.subject.kind === "person" && target.subject.titleId
                  ? ` · tytuł ${(session.data.persons.find((p) => target.subject.kind === "person" && p.id === target.subject.personId)?.titles.findIndex((t) => target.subject.kind === "person" && t.id === target.subject.titleId) ?? 0) + 1}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <PlanReport
        profile={profile}
        stage={planning ? "planning" : profile.stage}
        evaluatedResults={items.map((item) => item.evaluation)}
        asOf={session.asOf || session.data.asOf}
        interests={interests.length ? interests : undefined}
        section={section}
        checked={session.tasks
          .filter((id) =>
            id.startsWith(`${session.data.family.event.id}:${selected?.[0] ?? "planning"}:`),
          )
          .map((id) =>
            id.slice(`${session.data.family.event.id}:${selected?.[0] ?? "planning"}:`.length),
          )}
        onSectionChange={setSection}
        onToggle={(id) =>
          workspace.toggleTask(
            `${session.data.family.event.id}:${selected?.[0] ?? "planning"}:${id}`,
          )
        }
      />
    </div>
  );
}
