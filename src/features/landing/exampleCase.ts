import version from "../../data/version.json";
import { generatePlan } from "../../engine/plan";
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

export const exampleAsOf = "2026-11-21";
const { items } = generatePlan(getProfile(exampleAnswers), exampleAsOf);

function exampleResult(id: string) {
  const result = items.find(({ procedure }) => procedure.id === id);
  if (!result) throw new Error(`Missing landing example procedure: ${id}`);
  return result;
}

export const exampleRegistration = exampleResult("BIRTH_REGISTRATION");
export const exampleAllowance = exampleResult("MATERNITY_ALLOWANCE");
export const exampleVersion = version.rulesetVersion;
