import { ScrollArea } from "../../components/ui/ScrollArea";
import { planInterests } from "./flow";
import type { Answer, PlanInterest } from "./flow";
import reportStyles from "./PlanReport.module.css";
import styles from "./PlanningPlan.module.css";
import { ReportSourceLink } from "./ReportSourceLink";

const steps: Record<PlanInterest, { title: string; text: string; source: string }> = {
  benefits: {
    title: "Sprawdź warunki becikowego",
    text: "Już na początku ciąży zachowuj dokumentację wizyt. Przy wniosku o becikowe co do zasady potrzebne jest zaświadczenie o opiece medycznej od najpóźniej 10. tygodnia ciąży do porodu.",
    source: "becikowe",
  },
  leave: {
    title: "Poznaj zasady urlopu macierzyńskiego",
    text: "Sprawdź, jak wymiar urlopu i zasady jego wykorzystania zależą od sytuacji zawodowej i liczby dzieci urodzonych przy jednym porodzie.",
    source: "maternity",
  },
  registration: {
    title: "Zapisz, jak zgłosić urodzenie",
    text: "Po porodzie zgłosisz urodzenie online lub w USC. Termin to 21 dni od sporządzenia karty urodzenia.",
    source: "birth",
  },
  support: {
    title: "Sprawdź, kto może zgłosić dziecko do ubezpieczenia",
    text: "Ustal, kto z rodziców może po narodzinach zgłosić dziecko jako członka rodziny do ubezpieczenia zdrowotnego.",
    source: "health",
  },
};

export function PlanningPlan({
  interests,
  checked,
  onToggle,
}: {
  interests: Answer | undefined;
  checked: string[];
  onToggle: (id: string) => void;
}) {
  const selected = typeof interests === "object" && interests !== null ? interests : undefined;
  return (
    <ScrollArea
      contentClassName={reportStyles.content}
      renderViewport={<section />}
      aria-label="Plan przygotowań"
    >
      <ul className={reportStyles.items} aria-label="Sprawy do sprawdzenia">
        {planInterests
          .filter(({ value }) => !selected || selected.includes(value))
          .map(({ value, label }) => {
            const { title, text, source } = steps[value];
            return (
              <li key={value} className={reportStyles.row}>
                <label className={reportStyles.check}>
                  <input
                    type="checkbox"
                    aria-labelledby={`planning-title-${value}`}
                    checked={checked.includes(value)}
                    onChange={() => onToggle(value)}
                  />
                  <span>
                    <strong id={`planning-title-${value}`} className={reportStyles.title}>
                      {title}
                    </strong>
                    <span className={reportStyles.meta}>{label}</span>
                  </span>
                </label>
                <p className={styles.detail}>
                  {text} <ReportSourceLink sourceId={source} />
                </p>
              </li>
            );
          })}
      </ul>
    </ScrollArea>
  );
}
