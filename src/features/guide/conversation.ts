import { answerLabel, getQuestionIds, saveAnswer } from "./flow";
import type { Answer, Answers, QuestionId } from "./flow";
import type { HelpAnswer } from "./helpAnswers";
import { getQuestionText } from "./questionText";

export type HelpExchange = {
  id: number;
  question: string;
  answer?: HelpAnswer;
};

type ConversationMessage =
  | {
      kind: "question";
      question: QuestionId;
      text: string;
      previousAnswer?: Answer;
      celebrate?: boolean;
    }
  | { kind: "answer"; question: QuestionId; text: string }
  | { kind: "help"; exchange: HelpExchange }
  | { kind: "plan"; stage: Answers["stage"] };

type Conversation = {
  answers: Answers;
  messages: ConversationMessage[];
  prompt: number;
  revision?: number;
};

export const initialConversation: Conversation = {
  answers: {},
  messages: [{ kind: "question", question: "stage", text: getQuestionText("stage", {}) }],
  prompt: 0,
};

export function submitAnswer(
  conversation: Conversation,
  index: number,
  value: Answer,
  text?: string,
): Conversation {
  const message = conversation.messages[index];
  if (index !== (conversation.revision ?? conversation.prompt) || message?.kind !== "question") {
    return conversation;
  }

  const answers = saveAnswer(conversation.answers, message.question, value);
  const next = getQuestionIds(answers).find((id) => answers[id] === undefined);
  const celebrate =
    message.question === "stage" &&
    answers.stage !== conversation.answers.stage &&
    (next === "pregnancyTiming" || next === "birthDate");
  return {
    answers,
    messages: [
      ...conversation.messages,
      {
        kind: "answer",
        question: message.question,
        text: text ?? answerLabel(message.question, value),
      },
      next
        ? {
            kind: "question",
            question: next,
            text: getQuestionText(next, answers, { celebrate }),
            celebrate,
          }
        : { kind: "plan", stage: answers.stage },
    ],
    prompt: conversation.messages.length + 1,
  };
}

export function cancelRevision(conversation: Conversation): Conversation {
  if (conversation.revision === undefined) return conversation;
  return {
    ...conversation,
    messages: conversation.messages.filter((_, index) => index !== conversation.revision),
    revision: undefined,
  };
}

export function reviseAnswer(conversation: Conversation, question: QuestionId): Conversation {
  const previousAnswer = conversation.answers[question];
  if (previousAnswer === undefined) return conversation;
  const base = cancelRevision(conversation);
  return {
    ...base,
    messages: [
      ...base.messages,
      {
        kind: "question",
        question,
        previousAnswer,
        text: getQuestionText(question, base.answers, { editing: true }),
      },
    ],
    revision: base.messages.length,
  };
}

export function appendHelp(conversation: Conversation, exchange: HelpExchange): Conversation {
  return { ...conversation, messages: [...conversation.messages, { kind: "help", exchange }] };
}

export function resolveHelp(
  conversation: Conversation,
  id: number,
  answer: HelpAnswer,
): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.kind === "help" && message.exchange.id === id
        ? { kind: "help", exchange: { ...message.exchange, answer } }
        : message,
    ),
  };
}

export function getEditableAnswers({ messages, answers }: Conversation) {
  const editable = new Map<QuestionId, number>();
  messages.forEach((message, index) => {
    if (message.kind === "answer" && answers[message.question] !== undefined) {
      editable.set(message.question, index);
    }
  });
  return editable;
}
