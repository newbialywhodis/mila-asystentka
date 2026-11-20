import { useContext, useId } from "react";
import { Button } from "../../components/ui/Button";
import type { Answers } from "./flow";
import { ReportPanelContext } from "./GuideLayout";
import { getPlanNotice } from "./planNotice";
import { MilaMessage, MilaMessageActions, MilaMessageText } from "./ThreadMessage";
import styles from "./PlanTurn.module.css";
import messageStyles from "./ThreadMessage.module.css";

export function PlanTurn({ stage, active }: { stage: Answers["stage"]; active: boolean }) {
  const noticeId = useId();
  const notice = getPlanNotice(stage);
  const panel = useContext(ReportPanelContext);

  return (
    <section className={styles.turn} aria-labelledby={noticeId} data-chat-scroll>
      <MilaMessage>
        <p id={noticeId} data-chat-focus={active ? "continue" : undefined} tabIndex={-1}>
          <MilaMessageText key={notice}>{notice}</MilaMessageText>
        </p>
      </MilaMessage>
      {active && panel ? (
        <div className={`${styles.actions} ${messageStyles.followUp}`}>
          <Button
            variant="outline"
            size="lg"
            onClick={(event) => panel.onOpen(event.currentTarget)}
            aria-controls={panel.id}
            aria-expanded={panel.open}
            icon="sidebarRight"
          >
            {panel.open ? "Przejdź do raportu" : "Otwórz raport"}
          </Button>
        </div>
      ) : null}
      <MilaMessageActions text={notice} />
    </section>
  );
}
