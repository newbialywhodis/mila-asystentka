import { sources } from "../../data/sources";
import type { HelpExchange } from "./conversation";
import { GuideSources } from "./GuideSources";
import { MilaMessage, MilaMessageText, UserMessage } from "./ThreadMessage";
import styles from "./GuideHelp.module.css";

export function GuideHelpReply({ exchange }: { exchange: HelpExchange }) {
  const { answer } = exchange;
  const citations = (answer?.sourceIds ?? []).map((id) => ({ id, ...sources[id] }));
  const copyText =
    answer && citations.length
      ? `${answer.text}\n\nŹródła\n${citations.map(({ authority, title, url }) => `${authority} · ${title}\n${url}`).join("\n")}`
      : answer?.text;

  return (
    <div className={styles.exchange} data-chat-scroll>
      <UserMessage>{exchange.question}</UserMessage>
      <MilaMessage
        copyText={copyText}
        speechText={answer?.text}
        leadingActions={citations.length ? <GuideSources citations={citations} /> : null}
      >
        <output className={styles.reply} tabIndex={-1} data-chat-focus={`help-${exchange.id}`}>
          {answer ? (
            <MilaMessageText key={answer.text}>{answer.text}</MilaMessageText>
          ) : (
            <span className={styles.thinking}>
              <span className={styles.spinner} aria-hidden="true" />
              Myślenie
            </span>
          )}
        </output>
      </MilaMessage>
    </div>
  );
}
