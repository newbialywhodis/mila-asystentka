import { z } from "zod";
import { benefitSchema, caseFactsSchema, casePatchSchema } from "../../engine/parent-case";
import { maxHelpQuestionLength } from "../guide/helpAnswers";

const caseToolSchema = z.enum([
  "documents",
  "facts",
  "examples",
  "support",
  "services",
  "rules",
  "formalities",
]);
export type CaseTool = z.infer<typeof caseToolSchema>;
const goalSchema = z.enum(["calculation", "application"]);
export type CaseGoal = z.infer<typeof goalSchema>;
const factKeySchema = caseFactsSchema.keyof();
const firstStepsTimingSchema = z.enum(["beforeBirth", "afterBirth"]);
export type FirstStepsTiming = z.infer<typeof firstStepsTimingSchema>;
const replyChoiceSchema = z.enum([...firstStepsTimingSchema.options, "benefit"]);
export type ReplyChoice = z.infer<typeof replyChoiceSchema>;
const replyTextSchema = z.string().trim().min(1).max(400);

const assessmentSchema = z.strictObject({
  kind: z.enum(["assess"]),
  benefit: benefitSchema.nullable(),
  goal: goalSchema,
});

const replyActionSchema = z.strictObject({
  kind: z.enum(["reply"]),
  text: replyTextSchema,
  choices: z.array(replyChoiceSchema),
});

const conversationActions = [
  z.strictObject({ kind: z.enum(["outOfScope"]) }),
  z.strictObject({ kind: z.enum(["chooseBenefit"]), goal: goalSchema }),
  z.strictObject({ kind: z.enum(["open"]), tool: caseToolSchema }),
  z.strictObject({ kind: z.enum(["compareCare"]), workPercent: z.literal([0, 25, 50]).nullable() }),
  z.strictObject({ kind: z.enum(["unknownFact"]) }),
  z
    .strictObject({
      kind: z.enum(["urgentPregnancyCare"]),
      text: replyTextSchema
        .max(180)
        .describe("Jedno krótkie zdanie w odpowiedzi na zgłoszenie. Bez instrukcji i numerów."),
    })
    .describe("Tylko pilna pomoc wynikająca z najnowszej wiadomości rozmówcy."),
  z.strictObject({
    kind: z.enum(["help"]),
    question: z.string().trim().min(1).max(maxHelpQuestionLength),
  }),
  z.strictObject({
    kind: z.enum(["firstSteps"]),
    timing: firstStepsTimingSchema,
    intro: z.string().trim().max(180),
  }),
] as const;

export const caseActionSchema = z.discriminatedUnion("kind", [
  assessmentSchema.extend({ facts: casePatchSchema }),
  replyActionSchema.extend({ choices: replyActionSchema.shape.choices.max(2) }),
  ...conversationActions,
]);
export type CaseAction = z.infer<typeof caseActionSchema>;
export type CaseReply = Extract<CaseAction, { kind: "reply" }>;

// Bounded arrays make the provider's JSON grammar more complex. Limit choices
// and proposed facts when converting the model response to a chat action.
export const modelIntentSchema = z.strictObject({
  action: z.union([
    assessmentSchema.extend({
      facts: z.array(z.strictObject({ key: factKeySchema, value: z.string() })),
    }),
    replyActionSchema,
    ...conversationActions,
  ]),
});

export const assistantRequestSchema = z.strictObject({
  messages: z
    .array(
      z.strictObject({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(maxHelpQuestionLength),
      }),
    )
    .min(1)
    .max(16)
    .refine((messages) => messages.at(-1)?.role === "user"),
  context: z.strictObject({
    benefit: benefitSchema.nullable(),
    goal: goalSchema,
    pending: factKeySchema.nullable(),
    confirmed: z.array(factKeySchema).max(factKeySchema.options.length),
  }),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export function caseActionFromIntent(
  { action }: z.infer<typeof modelIntentSchema>,
  context: AssistantRequest["context"],
): CaseAction {
  if (action.kind === "reply") {
    return { ...action, choices: [...new Set(action.choices)].slice(0, 2) };
  }
  if (action.kind !== "assess") return action;
  const sameBenefit = action.benefit === null || action.benefit === context.benefit;
  return {
    ...action,
    goal: action.goal === "calculation" && sameBenefit ? context.goal : action.goal,
    facts: proposedFacts(action.facts),
  };
}

export function proposedFacts(entries: { key: z.infer<typeof factKeySchema>; value: string }[]) {
  const facts = {};
  const seen = new Set<string>();
  for (const { key, value } of entries.slice(0, 12)) {
    if (seen.has(key)) continue;
    seen.add(key);
    const primitive =
      value === "true"
        ? true
        : value === "false"
          ? false
          : /^\d{1,10}$/.test(value)
            ? Number(value)
            : value;
    const parsed = caseFactsSchema.shape[key].safeParse(primitive);
    if (parsed.success) Object.assign(facts, { [key]: parsed.data });
  }
  return casePatchSchema.parse(facts);
}
