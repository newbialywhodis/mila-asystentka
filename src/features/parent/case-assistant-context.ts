import { fields } from "./case-fields";
import { replyChoiceLabels } from "./case-replies";
import { getBenefitTurn } from "./case-session";
import type { CaseSession, CaseTurn } from "./case-session";
import type { AssistantRequest } from "./parent-intent";

function toAssistantMessage(turn: CaseTurn): AssistantRequest["messages"][number] | undefined {
  switch (turn.kind) {
    case "user":
      return turn.local ? undefined : { role: "user", content: turn.text };
    case "help":
      return { role: "assistant", content: turn.answer.text };
    case "reply":
      return {
        role: "assistant",
        content: [turn.text, ...turn.choices.map((choice) => replyChoiceLabels[choice])].join("\n"),
      };
    case "assessment":
      return {
        role: "assistant",
        content: turn.question
          ? fields[turn.question.key].question
          : "Wynik kalkulatora jest gotowy.",
      };
    case "chooseBenefit":
    case "compareCare":
    case "pregnancyConcern":
    case "tool":
      return { role: "assistant", content: turn.text };
    case "propose":
      return { role: "assistant", content: "Poprosiłam o potwierdzenie danych do kalkulatora." };
    case "document":
    case "note":
      return undefined;
  }
}

export function buildAssistantRequest(session: CaseSession, text: string): AssistantRequest {
  const benefitTurn = getBenefitTurn(session);
  const pregnancyConcern = session.turns.at(-1)?.kind === "pregnancyConcern";
  return {
    messages: [
      ...session.turns.flatMap((turn) => {
        const message = toAssistantMessage(turn);
        return message ? [message] : [];
      }),
      { role: "user" as const, content: text },
    ].slice(-16),
    context: {
      benefit: benefitTurn?.kind === "chooseBenefit" ? null : session.benefit,
      goal: benefitTurn?.goal ?? session.goal,
      pending:
        benefitTurn?.kind === "assessment" && !pregnancyConcern
          ? (benefitTurn.question?.key ?? null)
          : null,
      confirmed: Object.keys(session.family.facts) as AssistantRequest["context"]["confirmed"],
    },
  };
}
