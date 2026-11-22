import { z } from "zod";
import { questions } from "../../data/questions";
import { procedureIdSchema } from "../../data/discovery";
import { benefitSchema, caseFactsSchema } from "../../engine/parent-case";
import type { FactKey } from "../../engine/parent-case";
import type { Field } from "../../types/profile";
import type { Question } from "../../types/catalog";
import { caseFactOwnership, profileOwnership, validTimeSchema } from "./family-session";
import { stageAnswerSchema } from "./interview";
import { normalizeGuideText } from "../guide/textInput";
import { fields, readCaseDate, readFact } from "./case-fields";

// Closed registries, shared by the provider adapter, client and confirmation boundary.
export const procedureFields = Object.keys(questions) as Field[];
export type IntentField = FactKey | "stage" | "pregnancyPeriod" | "need" | `procedure:${Field}`;
export const intentFieldSchema = z.enum([
  ...caseFactsSchema.keyof().options,
  "stage",
  "pregnancyPeriod",
  "need",
  ...procedureFields.map((f): `procedure:${Field}` => `procedure:${f}`),
]);
export const moneyFields: readonly IntentField[] = [
  "basis",
  "fixedSalary",
  "debt",
  "rehabSickBasis",
];
export const zlotyFields: readonly IntentField[] = [
  "procedure:nurseryFee",
  "procedure:familyIncomePerPerson",
];
export const personAliasSchema = z.enum(["subject", "related"]);
export const candidateWireSchema = z.strictObject({
  field: intentFieldSchema,
  value: z.union([z.string().max(180), z.number(), z.boolean()]),
  scope: z.enum(["family", "person", "assessment"]),
  person: personAliasSchema.nullable(),
  title: z.literal("selected").nullable(),
  validTime: validTimeSchema,
  certainty: z.enum(["stated", "tentative"]),
  unit: z.enum(["none", "grosz", "zloty"]),
  evidence: z.string().trim().min(1).max(180).optional(),
});
export type FactCandidate = z.infer<typeof candidateWireSchema>;
export function isRelatedAssessmentField(field: IntentField) {
  return (
    field.startsWith("procedure:other") ||
    [
      "otherParentDays",
      "motherInsured",
      "motherDaysAfterBirth",
      "motherDaysBeforeBirth",
      "motherJobPercent",
      "motherJobEnds",
    ].includes(field)
  );
}
export function requiresTitleSelection(field: IntentField) {
  if (isRelatedAssessmentField(field) || field.startsWith("procedure:") || field === "need")
    return false;
  if (["employment", "insured", "employmentEnded", "employmentPercent"].includes(field))
    return true;
  return (
    candidateScope(field) === "assessment" && caseFactOwnership[field as FactKey] === "calculation"
  );
}

export function candidateScope(field: IntentField): FactCandidate["scope"] {
  if (["stage", "pregnancyPeriod"].includes(field)) return "family";
  if (["need", "employment", "insured", "employmentEnded", "employmentPercent"].includes(field))
    return "person";
  if (
    [
      "hospitalFrom",
      "hospitalThrough",
      "hospitalRanges",
      "careCertificate",
      "careChildren",
    ].includes(field)
  )
    return "family";
  if (field.startsWith("procedure:")) {
    const owner = profileOwnership[field.slice(10) as Field];
    return owner === "family" || owner === "child"
      ? "family"
      : owner === "person" || owner === "title" || owner === "projection"
        ? "person"
        : "assessment";
  }
  const owner = caseFactOwnership[field as FactKey];
  return owner === "family" || owner === "child" ? "family" : "assessment";
}

export function validCandidateValue(field: IntentField, value: unknown): boolean {
  if (field === "stage") return stageAnswerSchema.safeParse(value).success;
  if (field === "pregnancyPeriod")
    return z.enum(["early", "middle", "late"]).safeParse(value).success;
  if (field === "need") return typeof value === "boolean";
  if (field === "employment" && (value === "notWorking" || value === "other")) return true;
  if (field.startsWith("procedure:")) {
    const q: Question = questions[field.slice(10) as Field];
    if (q.input === "choice") return Boolean(q.options?.some((o) => o.value === value));
    if (q.input === "date") return caseFactsSchema.shape.birth.safeParse(value).success;
    if (q.input === "number")
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (!q.integer || Number.isInteger(value)) &&
        (q.min === undefined || value >= q.min) &&
        (q.max === undefined || value <= q.max)
      );
    return false; // Structured hospital/child tables stay in their existing local controls.
  }
  return caseFactsSchema.shape[field as FactKey].safeParse(value).success;
}

export const factCandidateSchema = candidateWireSchema.superRefine((c, ctx) => {
  if (
    candidateScope(c.field) !== c.scope ||
    !validCandidateValue(c.field, c.value) ||
    c.unit !==
      (moneyFields.includes(c.field)
        ? "grosz"
        : zlotyFields.includes(c.field)
          ? "zloty"
          : "none") ||
    (c.scope === "family" && (c.person !== null || c.title !== null)) ||
    (c.title !== null && !requiresTitleSelection(c.field))
  )
    ctx.addIssue({ code: "custom", message: "Nieprawidłowa wartość, jednostka lub zakres pola" });
});

export const interpretationSchema = z.strictObject({
  kind: z.literal("interpret"),
  intent: z.enum([
    "answer",
    "correct",
    "switchSubject",
    "back",
    "pause",
    "resume",
    "showMatches",
    "changeGoal",
    "explainQuestion",
    "explainResult",
    "documents",
    "generalHelp",
  ]),
  candidates: z.array(factCandidateSchema).max(12),
});
export function readNavigationIntent(
  input: string,
): z.infer<typeof interpretationSchema>["intent"] | undefined {
  const text = normalizeGuideText(input).replace(/[.!?]+$/, "");
  if (
    /^(?:pokaz(?: mi)?(?: juz)? (?:mozliwe (?:sprawy|swiadczenia)|dopasowane sprawy|moje swiadczenia)|wroc do (?:dopasowanych spraw|moich swiadczen))$/.test(
      text,
    )
  )
    return "showMatches";
  if (["przerwij wywiad", "wstrzymaj wywiad", "zatrzymajmy sie"].includes(text)) return "pause";
  if (["wznow wywiad", "wrocmy do pytan", "kontynuuj wywiad"].includes(text)) return "resume";
  if (["wroc do poprzedniego kroku", "cofnij"].includes(text)) return "back";
}
export const assistantContextV2Schema = z.strictObject({
  mode: z.enum(["idle", "interview", "discovery", "assessment", "result", "scope"]),
  questionKind: z.enum(["interview", "calculator", "procedure"]).nullable(),
  activeQuestion: z
    .enum(["subject", "stage", "employment", "timing", "need", ...intentFieldSchema.options])
    .nullable(),
  allowedFields: z.array(intentFieldSchema).max(intentFieldSchema.options.length),
  subject: z.literal("subject").nullable(),
  related: z.literal("related").nullable(),
  speaker: personAliasSchema.nullable(),
  title: z.literal("selected").nullable(),
  benefit: benefitSchema.nullable(),
  procedure: procedureIdSchema.nullable(),
  goal: z.enum(["calculation", "application"]),
  pending: caseFactsSchema.keyof().nullable(),
  confirmed: z.array(intentFieldSchema).max(intentFieldSchema.options.length),
  missing: z.array(intentFieldSchema).max(intentFieldSchema.options.length),
});
export type AssistantContextV2 = z.infer<typeof assistantContextV2Schema>;

export function validateCandidates(
  candidates: readonly FactCandidate[],
  context: AssistantContextV2,
) {
  return z
    .array(factCandidateSchema)
    .max(12)
    .parse(
      candidates.map((candidate) => {
        if (
          !context.allowedFields.includes(candidate.field) ||
          (candidate.person === "subject" && !context.subject) ||
          (candidate.person === "related" && !context.related) ||
          (candidate.title === "selected" && (!context.title || candidate.person !== "subject"))
        )
          throw new Error("Niedozwolony alias lub pole");
        return candidate;
      }),
    );
}

export function isDateIntentField(field: IntentField) {
  return field.startsWith("procedure:")
    ? questions[field.slice(10) as Field].input === "date"
    : field in fields && fields[field as FactKey].type === "date";
}
export function explicitDates(text: string) {
  const normalized = normalizeGuideText(text);
  return new Set(
    [
      ...normalized.matchAll(
        /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{1,2}\s+[a-z]+\s+\d{4})\b/g,
      ),
    ].flatMap(([part]) => {
      const date = readCaseDate(part);
      return date ? [date] : [];
    }),
  );
}

/** Conservative linguistic checks supplement JSON validation; they never establish facts. */
export function guardModelCandidates(
  candidates: readonly FactCandidate[],
  text: string,
  context: AssistantContextV2,
): FactCandidate[] {
  const message = normalizeGuideText(text);
  const partner = /\b(?:maz|meza|partner|partnera|zona|zony|partnerka|partnerki)\b/.test(message);
  const dates = explicitDates(text);
  const result: FactCandidate[] = [];
  for (const c of candidates) {
    if (!c.evidence || !message.includes(normalizeGuideText(c.evidence)))
      throw new Error("Brak potwierdzenia w wypowiedzi");
    if (isDateIntentField(c.field) && !dates.has(String(c.value)))
      throw new Error("unprovided-date");
    if (
      (c.validTime.kind === "day" && !dates.has(c.validTime.day)) ||
      (c.validTime.kind === "period" &&
        (!dates.has(c.validTime.from) || !dates.has(c.validTime.through)))
    )
      throw new Error("Okres nie został podany w wypowiedzi");
    if (
      (c.field === "birth" &&
        /\b(?:termin porodu|urodzi sie|rodze)\b/.test(message) &&
        !/\b(?:urodzilo sie|urodzilam)\b/.test(message)) ||
      (c.field === "dueDate" && /\b(?:urodzilo sie|urodzilam)\b/.test(message))
    )
      throw new Error("Niezgodny rodzaj daty");
    const excerpt = normalizeGuideText(c.evidence);
    if (c.field === "employment") {
      const supported =
        c.value === "notWorking"
          ? /\b(?:nie pracuje|nie mam pracy|brak pracy|bezrobot)/
          : c.value === "employee"
            ? /\b(?:eta[tc]|umow\w* o prac)/
            : c.value === "contract"
              ? /\bzlecen/
              : c.value === "business"
                ? /\b(?:dzialaln|firm|b2b|samozatrud)/
                : c.value === "collaborator"
                  ? /\bwspolprac/
                  : /\binna sytuacja/;
      if (!supported.test(excerpt)) throw new Error("Forma pracy nie wynika z fragmentu");
    }
    if (moneyFields.includes(c.field) || zlotyFields.includes(c.field)) {
      if (
        /\d\s*(?:kg|g|eur|usd|%)\b/.test(excerpt) ||
        ![...excerpt.matchAll(/\d[\d ]*(?:[.,]\d{1,2})?/g)].some(
          ([amount]) =>
            (zlotyFields.includes(c.field)
              ? Number(amount.replaceAll(" ", "").replace(",", "."))
              : readFact(c.field as FactKey, amount)?.[c.field as FactKey]) === c.value,
        )
      )
        throw new Error("Kwota nie wynika z wypowiedzi");
    }
    if (
      (c.field === "basis" || c.field === "rehabSickBasis") &&
      ((context.pending !== "basis" && !/podstaw/.test(excerpt)) ||
        /podstaw\w* sklad/.test(excerpt))
    )
      throw new Error("Pensja lub podstawa składek nie jest ustaloną podstawą zasiłku");
    if (c.field === "fixedSalary" && !/\b12 (?:pelnych )?miesi/.test(message))
      throw new Error("Brak potwierdzenia dwunastu pełnych miesięcy");
    const namedPartner = /\b(?:maz|meza|partner|partnera|zona|zony|partnerka|partnerki)\b/.test(
      excerpt,
    );
    const firstPerson =
      !namedPartner &&
      (/\b(?:ja|mam|prowadze|jestem|oplacam)\b/.test(excerpt) ||
        /pracuję/i.test(c.evidence) ||
        (!partner && /\bpracuje\b/.test(excerpt))) &&
      !/\bnie ja\b/.test(excerpt);
    const unresolved = c.scope !== "family" && partner && !firstPerson;
    const person =
      c.scope === "family" ? null : unresolved ? null : firstPerson ? context.speaker : c.person;
    const tentative =
      /\b(?:chyba|raczej|wydaje mi sie|nie jestem pewn)\b/.test(excerpt) ||
      (c.field === "insured" && /\b(?:chyba|raczej|wydaje mi sie)\b/.test(message));
    const next = {
      ...c,
      person,
      title: person === c.person && !unresolved ? c.title : null,
      certainty: tentative ? ("tentative" as const) : c.certainty,
    };
    if (
      (next.field === "employment" && next.title === null) ||
      !result.some(
        (previous) =>
          previous.field === next.field &&
          previous.value === next.value &&
          previous.person === next.person &&
          previous.title === next.title &&
          JSON.stringify(previous.validTime) === JSON.stringify(next.validTime),
      )
    )
      result.push(next);
  }
  return result;
}
