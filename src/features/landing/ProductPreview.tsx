import { createMilaFace } from "../../components/mascot/createMilaFace";
import { Icon } from "../../components/ui/Icon";
import { questions } from "../../data/questions";
import { formatDate } from "../guide/flow";
import { planSections } from "../guide/PlanNavigation";
import messageStyles from "../guide/ThreadMessage.module.css";
import reportStyles from "../guide/PlanReport.module.css";
import { exampleAllowance, exampleRegistration } from "./exampleCase";
import styles from "./ProductPreview.module.css";

function ConversationPreview() {
  return (
    <div className={`${styles.window} ${styles.chat}`}>
      <div className={styles.windowHeader}>
        <span
          className={styles.avatar}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: createMilaFace("product-preview-mila", "idle") }}
        />
        <span>Mila</span>
        <span className={styles.windowLabel}>Rozmowa</span>
      </div>
      <div className={styles.conversation}>
        <div className={messageStyles.mila}>
          <span className={styles.author}>Mila</span>
          <p>Na jakim etapie ciąży jesteś?</p>
        </div>
        <div className={styles.reply}>
          <span className={messageStyles.author}>Twoja odpowiedź</span>
          <p className={messageStyles.bubble}>Moje dziecko już się urodziło.</p>
        </div>
        <div className={messageStyles.mila}>
          <span className={styles.author}>Mila</span>
          <p>
            Ojej, gratulacje!!! ❤️
            <br />
            Powiedz mi proszę, kiedy urodziło się dziecko?
          </p>
        </div>
      </div>
      <div className={styles.composer} aria-hidden="true">
        <span>Odpowiedz lub zapytaj Milę…</span>
        <Icon name="send" size="sm" />
      </div>
    </div>
  );
}

function PlanResultPreview() {
  const { procedure, deadlines } = exampleRegistration;
  const deadline = deadlines[0];
  const missing = exampleAllowance.missingFields[0];
  return (
    <div className={`${styles.window} ${styles.plan}`}>
      <div className={styles.planHeading}>
        <span className={styles.author}>Przykładowy rezultat</span>
        <h3>Plan Anny po narodzinach</h3>
      </div>
      <div className={styles.planNavigation} aria-hidden="true">
        {planSections.map(({ id, title }) => (
          <span key={id}>{title}</span>
        ))}
      </div>
      <div className={styles.planContent}>
        <div className={styles.deadline}>
          <Icon name="calendar" size="sm" />
          <div>
            {deadline.date ? (
              <time dateTime={deadline.date}>Do {formatDate(deadline.date)}</time>
            ) : null}
            <p className={reportStyles.title}>{procedure.title}</p>
            <p className={reportStyles.meta}>{deadline.title}</p>
          </div>
        </div>
        <div className={styles.benefit}>
          <p className={reportStyles.title}>{exampleAllowance.procedure.title}</p>
          <p className={styles.status}>Wymaga dodatkowych danych</p>
          {missing ? <p className={styles.condition}>{questions[missing].label}</p> : null}
        </div>
        <div className={styles.nextStep}>
          <span className={styles.emptyCheck} aria-hidden="true" />
          <div>
            <p className={styles.author}>Kolejna czynność</p>
            <p>{procedure.steps[0]}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Annotation({ kind }: { kind: "questions" | "plan" }) {
  const first = kind === "questions";
  return (
    <div className={first ? styles.questionNote : styles.planNote}>
      <p>{first ? "Kilka prostych pytań" : "Twój plan działania"}</p>
      <span>{first ? "Mila poznaje Twoją sytuację." : "Sprawy i terminy do sprawdzenia."}</span>
      <svg viewBox="0 0 90 64" fill="none" aria-hidden="true">
        <path d="M13 8c-7 30 13 42 53 35m-13-8 15 8-10 12" />
      </svg>
    </div>
  );
}

export function ProductPreview() {
  return (
    <div className={styles.stage}>
      <Annotation kind="questions" />
      <ConversationPreview />
      <Annotation kind="plan" />
      <PlanResultPreview />
    </div>
  );
}
