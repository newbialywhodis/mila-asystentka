import { StepList } from "../../components/ui/StepList";
import { sources } from "../../data/sources";
import { GuideSources } from "./GuideSources";
import { getHelpAnswerText } from "./helpAnswers";
import type { HelpAnswer } from "./helpAnswers";
import { helpGuides } from "./helpGuides";
import { MilaMessage, MilaMessageText } from "./ThreadMessage";
import styles from "./GuideHelp.module.css";

export function GuideHelpReply({ answer }: { answer: HelpAnswer }) {
  const guide = answer.guide ? helpGuides[answer.guide] : undefined;
  const text = getHelpAnswerText(answer);
  const body = guide ? answer.text : text;
  const citations = guide
    ? [guide.source]
    : (answer.sourceIds ?? [])
        .filter((id) => Object.hasOwn(sources, id))
        .map((id) => ({ id, ...sources[id] }));
  const copyText = citations.length
    ? `${text}\n\nŹródła\n${citations.map(({ authority, title, url }) => `${authority} · ${title}\n${url}`).join("\n")}`
    : text;

  return (
    <MilaMessage
      copyText={copyText}
      speechText={guide ? text : answer.text}
      speechToken={answer.speechToken}
      smartComponents={guide ? <StepList title={guide.title} steps={guide.steps} /> : null}
      leadingActions={citations.length ? <GuideSources citations={citations} /> : null}
    >
      <p className={styles.reply}>
        <MilaMessageText key={body}>{body}</MilaMessageText>
      </p>
    </MilaMessage>
  );
}
