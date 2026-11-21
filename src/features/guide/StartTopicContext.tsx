import { startTopics } from "./startTopics";
import type { StartTopic } from "./startTopics";
import styles from "./StartTopicContext.module.css";

export function StartTopicContext({ topics }: { topics: readonly StartTopic[] }) {
  if (!topics.length) return null;
  return (
    <aside className={styles.context} aria-label="Tematy wybrane na początek">
      <p>
        <strong>Na początek:</strong>{" "}
        {startTopics
          .filter(({ id }) => topics.includes(id))
          .map(({ label }) => label)
          .join(", ")}
        .
      </p>
      <p>
        Zacznijmy od Twojej sytuacji. Plan uwzględni odpowiedzi, a wybrane tematy pomogą wskazać, od
        czego zacząć jego przeglądanie.
      </p>
    </aside>
  );
}
