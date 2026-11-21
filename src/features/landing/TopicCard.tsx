import { Icon } from "../../components/ui/Icon";
import Image from "next/image";
import type { StartTopic } from "../guide/startTopics";
import styles from "./TopicCard.module.css";

export function TopicCard({
  topic,
  selected,
  onToggle,
}: {
  topic: { id: StartTopic; label: string; description: string; illustration: string };
  selected: boolean;
  onToggle: (id: StartTopic) => void;
}) {
  return (
    <label className={styles.card} data-selected={selected}>
      <input
        type="checkbox"
        name="topics"
        value={topic.id}
        checked={selected}
        onChange={() => onToggle(topic.id)}
        aria-labelledby={`topic-${topic.id}`}
        aria-describedby={`topic-${topic.id}-description`}
      />
      <span className={styles.check} aria-hidden="true">
        <Icon name="check" size="sm" />
      </span>
      <Image
        className={styles.illustration}
        src={`/illustrations/topics/${topic.illustration}.svg`}
        width="240"
        height="200"
        alt=""
        loading="lazy"
      />
      <strong id={`topic-${topic.id}`} className={styles.title}>
        {topic.label}
      </strong>
      <span id={`topic-${topic.id}-description`} className={styles.description}>
        {topic.description}
      </span>
    </label>
  );
}
