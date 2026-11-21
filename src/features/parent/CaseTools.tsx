import { useState } from "react";
import { Sheet } from "../../components/ui/Sheet";
import type { Profile } from "../../types/profile";
import type { CaseFacts } from "../../engine/parent-case";
import type { PlanSection } from "../guide/PlanNavigation";
import { PlanReport } from "../guide/PlanReport";
import { preferredPlanSection, suggestedPlanInterests } from "../guide/startTopics";
import type { StartTopic } from "../guide/startTopics";
import { AdminCard, FamilyPlanner, SimulationCard } from "./ParentExtras";
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
        title="Porównaj warianty opieki"
        open={active && expanded === "plan"}
        onOpenChange={close}
        wide
        keepMounted
      >
        <FamilyPlanner
          facts={session.family.facts}
          asOf={session.asOf}
          demoRate={session.demoRate}
          onFacts={workspace.save}
        />
      </Sheet>
      <Sheet
        title="Plan formalności"
        open={active && expanded === "formalities"}
        onOpenChange={close}
        wide
        keepMounted
      >
        <Formalities facts={session.family.facts} asOf={session.asOf} topics={topics} />
      </Sheet>
      {expanded === "facts" ? (
        <Sheet title="Zmień dane sprawy" open={active} onOpenChange={close}>
          <CaseFactsList
            facts={session.family.facts}
            sources={session.family.sources}
            onChange={workspace.save}
          />
        </Sheet>
      ) : null}
      {expanded === "services" ? (
        <Sheet
          title="Symulacje usług"
          description={
            Object.keys(session.family.facts).length
              ? "Po wybraniu przykładu fikcyjne dane zastąpią dane tej sprawy."
              : undefined
          }
          open={active}
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
        <Sheet title="Ustawienia symulacji" open={active} onOpenChange={close}>
          <AdminCard rate={session.demoRate} asOf={session.asOf} onChange={workspace.setDemoRate} />
        </Sheet>
      ) : null}
    </>
  );
}

function Formalities({
  facts,
  asOf,
  topics,
}: {
  facts: CaseFacts;
  asOf: string;
  topics: readonly StartTopic[];
}) {
  const [section, setSection] = useState<PlanSection>(() => preferredPlanSection(topics));
  const [checked, setChecked] = useState<string[]>([]);
  const interests = suggestedPlanInterests(topics);
  const profile: Profile = {
    stage: facts.birth ? "born" : facts.dueDate ? "pregnant" : undefined,
    dueDate: facts.dueDate,
    birthDate: facts.birth,
    childrenBorn: facts.children,
    employment: facts.employment === "collaborator" ? "other" : facts.employment,
    zaZyciemCertificate: facts.careCertificate,
    birthWeightGrams: facts.birthWeightGrams,
    gestationalWeeks: facts.gestationalWeeks,
    hospitalized: facts.hospitalFrom ? true : undefined,
    hospitalStays:
      facts.hospitalFrom && facts.hospitalThrough
        ? [{ from: facts.hospitalFrom, through: facts.hospitalThrough }]
        : undefined,
  };
  return (
    <div className={styles.formalities}>
      <PlanReport
        profile={profile}
        stage={profile.stage ?? "planning"}
        asOf={asOf}
        interests={interests.length ? interests : undefined}
        section={section}
        checked={checked}
        onSectionChange={setSection}
        onToggle={(id) =>
          setChecked((previous) =>
            previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
          )
        }
      />
    </div>
  );
}
