import { z } from "zod";
import { parseDate } from "../../engine/dates";
import { benefitSchema, caseFactsSchema } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey, ParentCase } from "../../engine/parent-case";
import { documentIdSchema, personIdSchema, titleIdSchema, validTimeSchema } from "./family-session";
import type { AssessmentTarget } from "./family-session";

export const pdfUploadLimit = 3_500_000;

const page = z.number().int().min(1).max(1000);
const date = z.iso.date().refine((value) => parseDate(value) !== undefined);
const evidenceKeys = [
  "birth",
  "dueDate",
  "from",
  "through",
  "employment",
  "employmentPercent",
  "insured",
  "children",
  "basis",
  "payer",
  "debt",
  "debtPaid",
  "otherParentDays",
  "usedDays",
  "parts",
  "workPercent",
  "qualifying",
  "pregnancyProof",
  "sickDaysUsed",
  "employerSickPayEnded",
  "gestationalWeeks",
  "birthWeightGrams",
  "hospitalFrom",
  "hospitalThrough",
  "documentDate",
  "averagedRequest",
  "careCertificate",
  "paternityUsed",
  "careKind",
  "schoolDeferral",
  "courtApplication",
  "previousCareBenefit",
  "rehabMedical",
  "rehabUsed",
] as const;
const candidate = z.strictObject({
  key: z.enum(evidenceKeys),
  value: z.union([z.string().max(45), z.number(), z.boolean()]),
  page,
  coverage: z.object({ day: date, employment: caseFactsSchema.shape.employment }).optional(),
  personId: personIdSchema.optional(),
  titleId: titleIdSchema.optional(),
  validTime: validTimeSchema.optional(),
  documentId: documentIdSchema.optional(),
});
const documentKind = z.enum([
  "application",
  "payerCertificate",
  "birthRecord",
  "medicalCertificate",
  "decision",
  "other",
]);
export const documentReadSchema = z.strictObject({
  kind: documentKind.default("other"),
  requestedBenefit: benefitSchema.nullable(),
  candidates: z.array(candidate).max(48),
  decisions: z
    .array(
      z.strictObject({
        status: z.enum(["granted", "refused", "paid"]),
        page,
        from: date.nullable(),
        through: date.nullable(),
      }),
    )
    .max(12),
});

export type DocumentRead = z.infer<typeof documentReadSchema>;
export type DocumentCandidate = DocumentRead["candidates"][number];
export type DocumentApplication = { page: number; read: DocumentRead };
import type { AssessmentId } from "./family-session";

export type DocumentData = {
  target?: AssessmentTarget;
  baseRevision?: number;
  assessmentId?: AssessmentId;
  benefit: Benefit | null;
  facts: CaseFacts;
  sources: ParentCase["sources"];
};

// Keep the provider's grammar small. The application schema below is the trust boundary.
export const documentWireSchema = z.object({
  kind: z.string(),
  requestedBenefit: z.string().nullable(),
  candidates: z.array(z.object({ key: z.string(), value: z.string(), page: z.number() })),
  decisions: z.array(
    z.object({
      status: z.string(),
      page: z.number(),
      from: z.string().nullable(),
      through: z.string().nullable(),
    }),
  ),
});

export function normalizeDocumentWire(input: z.infer<typeof documentWireSchema>) {
  const kind = documentKind.safeParse(input.kind);
  const requestedBenefit = benefitSchema.safeParse(input.requestedBenefit);
  const candidates = input.candidates.slice(0, 48).flatMap(({ key, value, page: number }) => {
    const text = value.trim();
    const integer = /^\d{1,10}$/.test(text) ? Number(text) : undefined;
    const boolean = text === "true" ? true : text === "false" ? false : undefined;
    return [text, integer, boolean].flatMap((candidateValue) => {
      if (candidateValue === undefined) return [];
      const parsed = candidate.safeParse({ key, value: candidateValue, page: number });
      if (!parsed.success) return [];
      return caseFactsSchema.shape[parsed.data.key].safeParse(candidateValue).success
        ? [parsed.data]
        : [];
    });
  });
  const decisions = input.decisions.slice(0, 12).flatMap((item) => {
    const parsed = documentReadSchema.shape.decisions.element.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  return validateDocumentRead({
    kind: kind.success ? kind.data : "other",
    requestedBenefit: requestedBenefit.success ? requestedBenefit.data : null,
    candidates,
    decisions,
  });
}

export function validateDocumentRead(input: unknown): DocumentRead | undefined {
  const parsed = documentReadSchema.safeParse(input);
  if (!parsed.success) return;
  return {
    ...parsed.data,
    requestedBenefit: parsed.data.kind === "application" ? parsed.data.requestedBenefit : null,
    candidates:
      parsed.data.kind === "decision"
        ? []
        : parsed.data.candidates.filter(
            ({ key, value }) => caseFactsSchema.shape[key].safeParse(value).success,
          ),
    decisions: parsed.data.decisions.filter(
      ({ from, through }) => !from || !through || from <= through,
    ),
  };
}

export function documentSuggestions(read: DocumentRead, facts: CaseFacts, today: string) {
  const birth =
    facts.birth ||
    read.candidates.some(
      (entry) => entry.key === "birth" && typeof entry.value === "string" && entry.value <= today,
    );
  const groups = new Map<FactKey, DocumentCandidate[]>();
  for (const entry of read.candidates) {
    if (entry.key === "birth" && typeof entry.value === "string" && entry.value > today) continue;
    if (entry.key === "dueDate" && birth) continue;
    const group = groups.get(entry.key) ?? [];
    if (
      !group.some(
        (other) =>
          other.value === entry.value &&
          other.page === entry.page &&
          other.personId === entry.personId &&
          other.titleId === entry.titleId &&
          JSON.stringify(other.validTime) === JSON.stringify(entry.validTime) &&
          JSON.stringify(other.coverage) === JSON.stringify(entry.coverage),
      )
    )
      group.push(entry);
    groups.set(entry.key, group);
  }
  // Equal values without proven ownership/time are still proposals, not corroboration.
  return [...groups.values()];
}

export function acceptedDocumentFact(
  key: FactKey,
  value: NonNullable<CaseFacts[FactKey]>,
  page: number,
  documentNumber?: number,
) {
  const label = documentNumber ? `Potwierdzone z PDF-u ${documentNumber}` : "Potwierdzone z PDF";
  const source: ParentCase["sources"] = { [key]: { label, page } };
  return { facts: { [key]: value }, source };
}

export function matchesDocumentCoverage(
  candidate: DocumentCandidate,
  benefit: Benefit | null,
  facts: CaseFacts,
) {
  if (!candidate.coverage) return true;
  const day = benefit === "maternity" || benefit === "lossMaternity" ? facts.birth : facts.from;
  return day === candidate.coverage.day && facts.employment === candidate.coverage.employment;
}

export function matchesDocumentTarget(
  candidate: DocumentCandidate,
  target: AssessmentTarget | undefined,
  documentId?: string,
) {
  if (!target) return false;
  const personId = target.subject.kind === "person" ? target.subject.personId : target.applicantId;
  const titleId =
    target.subject.kind === "person" ? target.subject.titleId : target.applicantTitleId;
  return (
    (!candidate.personId || candidate.personId === personId) &&
    (!candidate.titleId || candidate.titleId === titleId) &&
    (!candidate.documentId || candidate.documentId === documentId) &&
    (!candidate.validTime ||
      candidate.validTime.kind === "undated" ||
      (candidate.validTime.kind === "day" && candidate.validTime.day === candidate.coverage?.day))
  );
}
