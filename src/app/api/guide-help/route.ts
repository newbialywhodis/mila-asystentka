import {
  explanationPrompt,
  findHelpAnswer,
  helpTopics,
  maxHelpQuestionLength,
  missingHelpAnswer,
} from "../../../features/guide/helpAnswers";
import type { HelpAnswer } from "../../../features/guide/helpAnswers";
import { guideQuestions } from "../../../features/guide/flow";
import type { QuestionId } from "../../../features/guide/flow";

async function matchWithAI(
  question: string,
  context?: QuestionId,
): Promise<HelpAnswer | undefined> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  const clarification = context ? findHelpAnswer(explanationPrompt, context) : undefined;
  const candidates = clarification ? [...helpTopics, clarification] : helpTopics;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      model: process.env.OPENAI_HELP_MODEL ?? "gpt-4.1-mini",
      store: false,
      max_output_tokens: 32,
      instructions:
        "Dopasuj pytanie o polskie formalności rodzicielskie do najlepiej pasującej odpowiedzi z listy. Zwróć wyłącznie numer odpowiedzi. Jeśli żadna odpowiedź nie rozwiązuje pytania lub pytanie jest osobiste, medyczne albo niezwiązane z tematem, zwróć 0.",
      input: JSON.stringify({
        question,
        guideQuestion: context ? guideQuestions[context].label : undefined,
        answers: candidates.map(({ text }, index) => ({ id: index + 1, text })),
      }),
    }),
  });
  if (!response.ok) return;

  const result: { output?: { type: string; content?: { type: string; text?: string }[] }[] } =
    await response.json();
  const choice = result.output
    ?.find(({ type }) => type === "message")
    ?.content?.find(({ type }) => type === "output_text")
    ?.text?.trim();
  return choice && /^\d+$/.test(choice) ? candidates[Number(choice) - 1] : undefined;
}

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("question" in payload) ||
    typeof payload.question !== "string"
  ) {
    return Response.json({ error: "Podaj pytanie." }, { status: 400 });
  }
  const question = payload.question.trim();
  if (!question || question.length > maxHelpQuestionLength) {
    return Response.json(
      { error: `Podaj pytanie do ${maxHelpQuestionLength.toLocaleString("pl-PL")} znaków.` },
      { status: 400 },
    );
  }
  const context =
    "context" in payload &&
    typeof payload.context === "string" &&
    Object.hasOwn(guideQuestions, payload.context)
      ? (payload.context as QuestionId)
      : undefined;
  const answer =
    findHelpAnswer(question, context) ??
    (await matchWithAI(question, context).catch(() => undefined)) ??
    missingHelpAnswer;
  return Response.json({ text: answer.text, source: answer.source });
}
