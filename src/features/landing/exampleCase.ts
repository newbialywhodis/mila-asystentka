import { generatePlan } from "../../engine/plan";
import { initialConversation, submitAnswer } from "../guide/conversation";
import { getProfile } from "../guide/flow";
import type { Answers } from "../guide/flow";

// A fixed, fictional case that can be entered through the existing conversation.
export const exampleAnswers = {
  stage: "born",
  birthDate: "2026-11-18",
  employment: "employee",
  birthRegistered: false,
  birthCardDate: "2026-11-19",
} satisfies Answers;

// The actual opening exchange, using the same answer as the report below.
export const exampleOpening = submitAnswer(
  initialConversation,
  initialConversation.prompt,
  exampleAnswers.stage,
).messages;

export const exampleAsOf = "2026-11-21";
const { items } = generatePlan(getProfile(exampleAnswers), exampleAsOf);

function exampleResult(id: string) {
  const result = items.find(({ procedure }) => procedure.id === id);
  if (!result) throw new Error(`Missing landing example procedure: ${id}`);
  return result;
}

export const exampleRegistration = exampleResult("BIRTH_REGISTRATION");
export const exampleAllowance = exampleResult("MATERNITY_ALLOWANCE");
