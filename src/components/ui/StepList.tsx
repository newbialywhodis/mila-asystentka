import { useId } from "react";
import styles from "./StepList.module.css";

export function StepList({ title, steps }: { title: string; steps: readonly string[] }) {
  const titleId = useId();

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <p className={styles.title} id={titleId}>
        {title}
      </p>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
