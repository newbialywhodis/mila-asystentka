import { z } from "zod";
import { generalHelpTopics, maxHelpQuestionLength, maxHelpSources } from "./helpAnswers";
import { guideQuestions } from "./flow";
import type { QuestionId } from "./flow";
import { sources } from "../../data/sources";
import { procedureIdSchema } from "../../data/discovery";
import type { ProcedureId } from "../../data/discovery";

export const helpTopicIdSchema = z.enum(
  Object.keys(generalHelpTopics) as (keyof typeof generalHelpTopics)[],
);
export type HelpTopicId = z.infer<typeof helpTopicIdSchema>;
const questionRequest = z.strictObject({
  mode: z.literal("question"),
  question: z.string().trim().min(1).max(maxHelpQuestionLength),
  context: z
    .custom<QuestionId>((v) => typeof v === "string" && Object.hasOwn(guideQuestions, v))
    .optional(),
  previousSourceIds: z
    .array(z.enum(Object.keys(sources)))
    .max(maxHelpSources)
    .optional(),
  procedure: procedureIdSchema.optional(),
});
export const guideHelpRequestSchema = z.union([
  z.strictObject({ mode: z.literal("topic"), topicId: helpTopicIdSchema }),
  questionRequest,
  questionRequest.omit({ mode: true }), // Existing guide callers during migration.
]);
export function buildTopicHelpRequest(topicId: HelpTopicId) {
  return z
    .strictObject({ mode: z.literal("topic"), topicId: helpTopicIdSchema })
    .parse({ mode: "topic", topicId });
}
export function buildQuestionHelpRequest(
  privacy: "standard" | "localDocuments",
  question: string,
  procedure?: ProcedureId,
) {
  if (privacy !== "standard") throw new Error("Swobodne pytania AI są wyłączone po własnym PDF-ie");
  return questionRequest.parse({ mode: "question", question, ...(procedure ? { procedure } : {}) });
}

export { generalHelpTopics } from "./helpAnswers";
