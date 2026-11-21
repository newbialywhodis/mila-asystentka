"use client";

import { useState } from "react";
import { ButtonLink } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { topicChatHref } from "../guide/startTopics";
import type { StartTopic } from "../guide/startTopics";
import { landingTopics, topicSelectionMessage } from "./topicOptions";
import { TopicCard } from "./TopicCard";
import sectionStyles from "./LandingSection.module.css";
import styles from "./LandingTopics.module.css";

export function LandingTopics() {
  const [selected, setSelected] = useState<StartTopic[]>([]);

  function toggle(id: StartTopic) {
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((topic) => topic !== id) : [...previous, id],
    );
  }

  return (
    <section
      id="tematy"
      className={`${sectionStyles.section} ${styles.section}`}
      aria-labelledby="topics-title"
    >
      <div className={sectionStyles.container}>
        <div className={sectionStyles.heading}>
          <h2 id="topics-title">Wszystko, co ważne. W jednym miejscu.</h2>
          <p>
            Wybierz, w czym potrzebujesz pomocy. Mila pomoże Ci odnaleźć się w formalnościach
            związanych z rodzicielstwem.
          </p>
        </div>
        <fieldset className={styles.topics}>
          <legend className={styles.legend}>Wybierz tematy rozmowy. Możesz zaznaczyć kilka.</legend>
          {landingTopics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              selected={selected.includes(topic.id)}
              onToggle={toggle}
            />
          ))}
        </fieldset>
        <output className={styles.message} aria-live="polite" aria-atomic="true">
          {topicSelectionMessage(selected.length)}
        </output>
        <div className={sectionStyles.action}>
          <ButtonLink href={topicChatHref(selected)} variant="brand" size="xl">
            Porozmawiaj z Milą <Icon name="arrow" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
