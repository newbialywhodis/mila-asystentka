import { Tabs } from "@base-ui/react/tabs";
import dynamic from "next/dynamic";
import { LoadingIndicator } from "../../components/ui/LoadingIndicator";
import type { Profile } from "../../types/profile";
import type { Answers, Period } from "./flow";
import { PlanNavigation, planSections } from "./PlanNavigation";
import type { PlanSection } from "./PlanNavigation";
import { PlanningPlan } from "./PlanningPlan";
import styles from "./PlanReport.module.css";

const PlanDetails = dynamic(() => import("./PlanDetails").then((module) => module.PlanDetails), {
  loading: () => (
    <output className={styles.content}>
      <LoadingIndicator>Wczytywanie szczegółów planu…</LoadingIndicator>
    </output>
  ),
});

export function PlanReport({
  stage,
  profile,
  period,
  asOf,
  interests,
  section,
  checked,
  onSectionChange,
  onToggle,
}: {
  stage: Answers["stage"];
  profile: Profile;
  period?: Period;
  asOf: string;
  interests?: Answers["planInterests"];
  section: PlanSection;
  checked: string[];
  onSectionChange: (section: PlanSection) => void;
  onToggle: (id: string) => void;
}) {
  if (stage === "planning") {
    return <PlanningPlan interests={interests} checked={checked} onToggle={onToggle} />;
  }

  return (
    <Tabs.Root
      className={styles.report}
      value={section}
      onValueChange={(value) => {
        const next = planSections.find(({ id }) => id === value);
        if (next) onSectionChange(next.id);
      }}
    >
      <PlanNavigation />
      <PlanDetails
        profile={profile}
        period={period}
        asOf={asOf}
        checked={checked}
        onToggle={onToggle}
      />
    </Tabs.Root>
  );
}
