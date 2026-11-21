import { z } from "zod";
import { benefitSchema, caseFactsSchema, casePatchSchema } from "../../engine/parent-case";
import { maxHelpQuestionLength } from "../guide/helpAnswers";

export const caseToolSchema = z.enum([
  "documents",
  "plan",
  "facts",
  "examples",
  "support",
  "services",
  "rules",
  "formalities",
]);
export type CaseTool = z.infer<typeof caseToolSchema>;
export const goalSchema = z.enum(["calculation", "application"]);
export type CaseGoal = z.infer<typeof goalSchema>;
export const factKeySchema = caseFactsSchema.keyof();

export const caseActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("assess"),
    benefit: benefitSchema.nullable(),
    goal: goalSchema,
    facts: casePatchSchema,
  }),
  z.strictObject({ kind: z.literal("open"), tool: caseToolSchema }),
  z.strictObject({ kind: z.literal("unknownFact") }),
  z.strictObject({
    kind: z.literal("help"),
    question: z.string().trim().min(1).max(maxHelpQuestionLength),
  }),
  z.strictObject({ kind: z.literal("clarify"), text: z.string().trim().min(1).max(400) }),
]);
export type CaseAction = z.infer<typeof caseActionSchema>;

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
    pending: z.strictObject({ key: factKeySchema, question: z.string().max(400) }).nullable(),
    confirmed: z.array(factKeySchema).max(50),
  }),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

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
