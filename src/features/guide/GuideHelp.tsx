import { Button } from "../../components/ui/Button";
import { sources } from "../../data/sources";
import type { HelpExchange } from "./conversation";
import { MilaMessage, MilaMessageText, UserMessage } from "./ThreadMessage";
import styles from "./GuideHelp.module.css";
import messageStyles from "./ThreadMessage.module.css";

export function GuideHelpReply({
  exchange,
  onContinue,
}: {
  exchange: HelpExchange;
  onContinue?: () => void;
}) {
  const { answer } = exchange;
  const source = answer?.source ? sources[answer.source] : undefined;
  const copyText =
    answer && source
      ? `${answer.text}\n\nŹródło · ${source.authority} · ${source.title}\n${source.url}`
      : answer?.text;

  return (
    <div className={styles.exchange} data-chat-scroll>
      <UserMessage>{exchange.question}</UserMessage>
      <div>
        <MilaMessage copyText={copyText} speechText={answer?.text}>
          <output className={styles.reply} tabIndex={-1} data-chat-focus={`help-${exchange.id}`}>
            {answer ? (
              <MilaMessageText key={answer.text}>{answer.text}</MilaMessageText>
            ) : (
              "Szukam odpowiedzi…"
            )}
          </output>
          {source ? (
            <a
              className={`${styles.source} ${messageStyles.followUp}`}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.authority} · {source.title}
            </a>
          ) : null}
        </MilaMessage>
        {answer && onContinue ? (
          <Button
            className={`${styles.resume} ${messageStyles.followUp}`}
            variant="quiet"
            icon="arrow"
            onClick={onContinue}
          >
            Wróć do pytania
          </Button>
        ) : null}
      </div>
    </div>
  );
}
