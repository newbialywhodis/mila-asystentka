import { z } from "zod";
import { benefitSchema, caseFactsSchema } from "../../engine/parent-case";
import { maxHelpQuestionLength } from "../guide/helpAnswers";
import {
  assistantContextV2Schema,
  candidateScope,
  factCandidateSchema,
  intentFieldSchema,
  interpretationSchema,
  validateCandidates,
  guardModelCandidates,
  isDateIntentField,
  explicitDates,
  readNavigationIntent,
  requiresTitleSelection,
} from "./intent-contract";
import { normalizeGuideText } from "../guide/textInput";
import type { AssistantContextV2 } from "./intent-contract";

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

const selectActionSchema = z.strictObject({
  kind: z.literal("selectBenefit"),
  benefit: benefitSchema,
  goal: goalSchema,
});

const safeConversationalText = (text: string) =>
  !/\d[\d .,]*\s*(?:zl|pln|%|procent)|przysluguje (?:ci|pani)|masz prawo do|dostaniesz|otrzymasz|nalezy ci sie|jestes uprawnion|spelniasz warunk|zus wyplaci|https?:\/\//.test(
    normalizeGuideText(text),
  );
const replyActionSchema = z.strictObject({
  kind: z.enum(["reply"]),
  text: replyTextSchema.refine(
    safeConversationalText,
    "Odpowiedź rozmowna nie może ustalać prawa, kwot ani źródeł",
  ),
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
        .refine(safeConversationalText)
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
    intro: z.string().trim().max(180).refine(safeConversationalText),
  }),
] as const;

export const caseActionSchema = z.discriminatedUnion("kind", [
  selectActionSchema,
  interpretationSchema,
  z.strictObject({ kind: z.literal("startInterview") }),
  replyActionSchema.extend({ choices: replyActionSchema.shape.choices.max(2) }),
  ...conversationActions,
]);
export type CaseAction = z.infer<typeof caseActionSchema>;
export type CaseReply = Extract<CaseAction, { kind: "reply" }>;

// Bounded arrays make the provider's JSON grammar more complex. Limit choices
// and proposed facts when converting the model response to a chat action.
const candidateWireBase = z.strictObject({
  value: z.string(),
  evidence: z.string(),
  validTime: z.strictObject({
    kind: z.enum(["day", "period", "undated"]),
    from: z.string().nullable(),
    through: z.string().nullable(),
  }),
  certainty: z.enum(["stated", "tentative"]),
  unit: z.enum(["none", "grosz", "zloty"]),
});
export function modelIntentSchemaForContext(context?: AssistantContextV2) {
  const person = context
    ? context.subject && context.related
      ? z.enum(["subject", "related"]).nullable()
      : context.subject
        ? z.literal("subject").nullable()
        : context.related
          ? z.literal("related").nullable()
          : z.null()
    : z.enum(["subject", "related"]).nullable();
  const title = !context || context.title ? z.literal("selected").nullable() : z.null();
  const modelCandidateSchema = candidateWireBase.extend({
    field: context?.allowedFields.length ? z.enum(context.allowedFields) : intentFieldSchema,
    person,
    title,
  });
  return z.strictObject({
    action: z.union([
      interpretationSchema
        .omit({ candidates: true })
        .extend({ candidates: z.array(modelCandidateSchema) }),
      z.strictObject({ kind: z.literal("startInterview") }),
      selectActionSchema,
      replyActionSchema,
      ...conversationActions,
    ]),
  });
}
export const modelIntentSchema = modelIntentSchemaForContext();

const messagesSchema = z
  .array(
    z.strictObject({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(maxHelpQuestionLength),
    }),
  )
  .min(1)
  .max(16)
  .refine((messages) => messages.at(-1)?.role === "user");
const legacyRequestSchema = z.strictObject({
  messages: messagesSchema,
  context: z.strictObject({
    benefit: benefitSchema.nullable(),
    goal: goalSchema,
    pending: factKeySchema.nullable(),
    confirmed: z.array(factKeySchema).max(factKeySchema.options.length),
  }),
});
export const assistantRequestV2Schema = z.strictObject({
  version: z.literal(2),
  messages: messagesSchema,
  context: assistantContextV2Schema,
});
export type AssistantRequest = z.infer<typeof assistantRequestV2Schema>;
export const assistantRequestSchema = z.union([assistantRequestV2Schema, legacyRequestSchema]);

// Input migration only: every request uses the same interpreter and scoped output.
export function normalizeAssistantRequest(
  input: z.infer<typeof assistantRequestSchema>,
): AssistantRequest {
  if ("version" in input) return input;
  return {
    version: 2,
    messages: input.messages,
    context: {
      ...input.context,
      mode: input.context.benefit ? "assessment" : "idle",
      activeQuestion: input.context.pending,
      questionKind: input.context.pending ? "calculator" : null,
      allowedFields: intentFieldSchema.options.filter((f) => !f.startsWith("procedure:")),
      subject: null,
      related: null,
      speaker: null,
      title: null,
      procedure: null,
      missing: input.context.pending ? [input.context.pending] : [],
    },
  };
}

// HTTP responses may never enter the legacy flat patch path.
export const assistantActionSchema = caseActionSchema;

export function caseActionFromIntent(
  { action }: z.infer<typeof modelIntentSchema>,
  context: AssistantContextV2,
  latestText?: string,
): CaseAction {
  const navigation = latestText && readNavigationIntent(latestText);
  if (navigation) return { kind: "interpret", intent: navigation, candidates: [] };
  if (action.kind === "reply") {
    return { ...action, choices: [...new Set(action.choices)].slice(0, 2) };
  }
  if (action.kind === "interpret") {
    if (
      action.candidates.length > 12 ||
      (action.candidates.length && action.intent !== "answer" && action.intent !== "correct")
    )
      throw new Error("Niedozwolona propozycja");
    if (
      action.candidates.some(
        (c) =>
          isDateIntentField(c.field) &&
          /^\d{4}-\d{2}-\d{2}$/.test(c.value) &&
          !caseFactsSchema.shape.birth.safeParse(c.value).success,
      )
    )
      throw new Error("Nieprawidłowa data");
    if (
      latestText &&
      action.candidates.some(
        (c) => isDateIntentField(c.field) && !explicitDates(latestText).has(c.value),
      )
    )
      return {
        kind: "reply",
        text: "Sprawdź pełną datę wraz z rokiem. Sam dzień i miesiąc nie wystarczą do obliczeń.",
        choices: [],
      };
    const candidates = action.candidates.map((c) => {
      const { kind, from, through } = c.validTime;
      if (
        (kind === "undated" && (from !== null || through !== null)) ||
        (kind === "day" && through !== null)
      )
        throw new Error("Nieprawidłowy czas");
      const scope = candidateScope(c.field);
      return {
        ...c,
        scope,
        person: scope === "family" ? null : c.person,
        title: scope === "family" || !requiresTitleSelection(c.field) ? null : c.title,
        value: intentPrimitive(c.value),
        validTime:
          kind === "undated"
            ? { kind }
            : kind === "day"
              ? { kind, day: from }
              : { kind, from, through },
      };
    });
    const parsed = z.array(factCandidateSchema).parse(candidates);
    try {
      return {
        ...action,
        candidates: validateCandidates(
          latestText ? guardModelCandidates(parsed, latestText, context) : parsed,
          context,
        ),
      };
    } catch (error) {
      // A rejected interpretation of an explicit ownership correction can only
      // open the local subject selector, never invent a replacement fact.
      if (
        latestText &&
        /\b(?:maz|meza|partner|partnera|zona|zony)\b/.test(normalizeGuideText(latestText)) &&
        /\bnie ja\b/.test(normalizeGuideText(latestText))
      )
        return { kind: "interpret", intent: "switchSubject", candidates: [] };
      throw error;
    }
  }
  return action;
}

function intentPrimitive(value: string) {
  return value === "true"
    ? true
    : value === "false"
      ? false
      : /^\d{1,10}(?:\.\d{1,2})?$/.test(value)
        ? Number(value)
        : value;
}
