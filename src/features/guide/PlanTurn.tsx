import dynamic from "next/dynamic";
import { useId } from "react";
import { Button, IconButton } from "../../components/ui/Button";
import type { Profile } from "../../types/profile";
import type { Answer, Period } from "./flow";
import { PlanNavigation } from "./PlanNavigation";
import type { PlanSection } from "./PlanNavigation";
import { PlanningPlan } from "./PlanningPlan";
import { MilaMessage, MilaMessageText } from "./ThreadMessage";
import { getPlanNotice } from "./planNotice";
import styles from "./PlanTurn.module.css";
import messageStyles from "./ThreadMessage.module.css";

const PlanDetails = dynamic(() => import("./PlanDetails").then((module) => module.PlanDetails), {
  loading: () => <output>Wczytuję szczegóły planu…</output>,
});
const PlanPreview = dynamic(() => import("./PlanDetails").then((module) => module.PlanPreview), {
  loading: () => <output>Układam Twój plan…</output>,
});

type PlanControls = {
  section?: PlanSection;
  checked: string[];
  onOpen: () => void;
  onClose: () => void;
  onSectionChange: (section: PlanSection) => void;
  onToggle: (id: string) => void;
};

export function PlanTurn({
  stage,
  profile,
  period,
  asOf,
  interests,
  controls,
}: {
  stage?: Answer;
  profile: Profile;
  period?: Period;
  asOf: string;
  interests?: Answer;
  controls?: PlanControls;
}) {
  const noticeId = useId();
  const panelId = useId();
  const panelHeadingId = useId();
  const planning = stage === "planning";
  const section = controls?.section;
  const notice = getPlanNotice(stage);
  return (
    <section
      className={styles.turn}
      aria-labelledby={noticeId}
      data-chat-scroll
      data-chat-plan={controls ? "" : undefined}
    >
      <MilaMessage copyText={notice}>
        <p id={noticeId} data-chat-focus={controls ? "continue" : undefined} tabIndex={-1}>
          <MilaMessageText key={notice}>{notice}</MilaMessageText>
        </p>
      </MilaMessage>
      {controls ? (
        <>
          <div className={messageStyles.followUp}>
            <Button
              variant="outline"
              className={styles.open}
              onClick={controls.onOpen}
              data-chat-focus="plan-trigger"
              aria-controls={panelId}
              aria-expanded={Boolean(section)}
              icon="arrow"
            >
              {section ? "Przejdź do planu" : "Otwórz mój plan"}
            </Button>
            {!section && !planning ? (
              <PlanPreview profile={profile} period={period} asOf={asOf} />
            ) : null}
          </div>
          <section
            id={panelId}
            className={styles.panel}
            aria-labelledby={panelHeadingId}
            hidden={!section}
          >
            {section ? (
              <>
                <div className={styles.panelHeading}>
                  <h3 id={panelHeadingId} tabIndex={-1} data-chat-focus="plan">
                    Twój plan
                  </h3>
                  <IconButton icon="close" label="Zwiń plan" onClick={controls.onClose} />
                </div>
                {planning ? (
                  <PlanningPlan
                    interests={interests}
                    checked={controls.checked}
                    onToggle={controls.onToggle}
                  />
                ) : (
                  <>
                    <PlanNavigation section={section} onChange={controls.onSectionChange} />
                    <PlanDetails
                      profile={profile}
                      period={period}
                      asOf={asOf}
                      section={section}
                      checked={controls.checked}
                      onToggle={controls.onToggle}
                    />
                  </>
                )}
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}
