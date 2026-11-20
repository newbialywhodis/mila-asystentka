import styles from "./PlanNavigation.module.css";

export type PlanSection = "timeline" | "benefits" | "tasks";

const sections = [
  { id: "timeline", title: "Terminy" },
  { id: "benefits", title: "Świadczenia" },
  { id: "tasks", title: "Zadania" },
] satisfies { id: PlanSection; title: string }[];

export function PlanNavigation({
  section,
  onChange,
}: {
  section: PlanSection;
  onChange: (section: PlanSection) => void;
}) {
  return (
    <nav aria-label="Części planu" className={styles.navigation}>
      {sections.map(({ id, title }) => (
        <button key={id} type="button" aria-pressed={section === id} onClick={() => onChange(id)}>
          {title}
        </button>
      ))}
    </nav>
  );
}
