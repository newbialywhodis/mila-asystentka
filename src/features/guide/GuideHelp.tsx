import { sources } from "../../data/sources";
import { GuideSources } from "./GuideSources";
import type { HelpAnswer } from "./helpAnswers";
import { MilaMessage, MilaMessageText } from "./ThreadMessage";
import styles from "./GuideHelp.module.css";

export function GuideHelpReply({ answer }: { answer: HelpAnswer }) {
  const citations = (answer.sourceIds ?? [])
    .filter((id) => Object.hasOwn(sources, id))
    .map((id) => ({ id, ...sources[id] }));
  const copyText = citations.length
    ? `${answer.text}\n\nŹródła\n${citations.map(({ authority, title, url }) => `${authority} · ${title}\n${url}`).join("\n")}`
    : answer.text;

  return (
    <MilaMessage
      copyText={copyText}
      speechText={answer.text}
      speechToken={answer.speechToken}
      leadingActions={citations.length ? <GuideSources citations={citations} /> : null}
    >
      <p className={styles.reply}>
        <MilaMessageText key={answer.text}>{answer.text}</MilaMessageText>
      </p>
    </MilaMessage>
  );
}
