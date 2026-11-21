import { Icon } from "../../components/ui/Icon";
import { createMilaFace } from "../guide/createMilaFace";
import styles from "./PlanPreview.module.css";

const previewItems = [
  { icon: "layers", title: "Świadczenia", description: "Możliwości wsparcia dla Twojej rodziny" },
  { icon: "calendar", title: "Terminy", description: "Ważne daty zebrane w jednym miejscu" },
  { icon: "tasks", title: "Formalności", description: "Lista spraw do załatwienia, krok po kroku" },
] as const;

export function PlanPreview() {
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
            <p className={styles.planLabel}>Po naszej rozmowie</p>
            <h2>Twój osobisty plan</h2>
          </div>
          <span className={styles.planIcon}>
            <Icon name="contract" />
          </span>
        </div>
        {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics with list-style: none. */}
        <ul className={styles.items} role="list">
          {previewItems.map((item) => (
            <li key={item.title}>
              <span className={styles.itemIcon}>
                <Icon name={item.icon} />
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className={styles.planNote}>
          <Icon name="shield" size="sm" /> Z odnośnikami do oficjalnych źródeł
        </p>
      </div>
      <figcaption id="preview-caption">
        Przykładowy widok planu. Twój dopasujemy do Ciebie.
      </figcaption>
    </figure>
  );
}
