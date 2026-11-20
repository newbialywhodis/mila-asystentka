import { Tabs } from "@base-ui/react/tabs";
import styles from "./PlanNavigation.module.css";

export const planSections = [
  { id: "timeline", title: "Terminy" },
  { id: "benefits", title: "Świadczenia" },
  { id: "tasks", title: "Zadania" },
] as const;

export type PlanSection = (typeof planSections)[number]["id"];

export function PlanNavigation() {
  return (
    <Tabs.List aria-label="Części raportu" className={styles.navigation} activateOnFocus>
      {planSections.map(({ id, title }) => (
        <Tabs.Tab key={id} value={id}>
          {title}
        </Tabs.Tab>
      ))}
    </Tabs.List>
  );
}
