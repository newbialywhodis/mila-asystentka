import { Icon } from "../../components/ui/Icon";
import { createMilaFace } from "../../components/mascot/createMilaFace";
import { formatDate } from "../guide/flow";
import { exampleRegistration } from "./exampleCase";
import styles from "./PlanPreview.module.css";

export function PlanPreview() {
  const { procedure, deadlines } = exampleRegistration;
  const deadline = deadlines[0];
  return (
    <figure className={styles.preview} aria-labelledby="preview-caption">
      <div className={styles.greeting}>
        <span
          className={styles.mascot}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: createMilaFace("landing-mila", "happy") }}
        />
        <p className={styles.bubble}>
          Cześć, jestem Mila.
          <br />
          Poukładamy to razem?
        </p>
      </div>
      <div className={styles.plan}>
        <div className={styles.planHeading}>
          <div>
            <p className={styles.planLabel}>Przykład · fikcyjne dane</p>
            <h2>Plan Anny po narodzinach</h2>
          </div>
          <span className={styles.planIcon}>
            <Icon name="contract" />
          </span>
        </div>
        {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics with list-style: none. */}
        <ul className={styles.items} role="list">
          <li>
            <span className={styles.itemIcon}>
              <Icon name="calendar" />
            </span>
            <div>
              <h3>{procedure.title}</h3>
              <p>{deadline.title}</p>
              <p>
                {deadline.date ? (
                  <time dateTime={deadline.date}>Do {formatDate(deadline.date)}</time>
                ) : null}
              </p>
            </div>
          </li>
          <li>
            <span className={styles.itemIcon}>
              <Icon name="tasks" />
            </span>
            <div>
              <h3>Najbliższa czynność</h3>
              <p>{procedure.steps[0]}</p>
            </div>
          </li>
        </ul>
        <p className={styles.planNote}>
          <Icon name="shield" size="sm" /> Z odnośnikami do oficjalnych źródeł
        </p>
      </div>
      <figcaption id="preview-caption">
        Fragment planu. <a href="#przykladowy-plan">Zobacz sytuację Anny i szczegóły</a>.
      </figcaption>
    </figure>
  );
}
