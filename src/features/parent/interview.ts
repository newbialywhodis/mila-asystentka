import { z } from "zod";
import { questions } from "../../data/questions";
import { employmentTypes } from "../../engine/parent-case";
import { readCaseDate, readFact } from "./case-fields";
import { normalizeGuideText } from "../guide/textInput";
import { isoDateSchema, personIdSchema, titleIdSchema } from "./family-session";
import type { ChildId, EventId, PersonId, TitleId } from "./family-session";

export const subjectAnswerSchema = z.strictObject({
  speaker: z.enum(["self", "helper"]),
  subject: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("family") }),
    z.strictObject({
      kind: z.literal("person"),
      personId: personIdSchema,
      role: z.enum(["birthing", "otherParent", "guardian"]).optional(),
    }),
  ]),
});
export const stageAnswerSchema = z.enum([
  "planning",
  "pregnant",
  "born",
  "adoption",
  "foster",
  "loss",
]);
export const employmentAnswerSchema = z.strictObject({
  kind: z.enum([...employmentTypes, "notWorking", "other"]),
  titleId: titleIdSchema.optional(),
});
export const timingAnswerSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("date"), date: isoDateSchema }),
  z.strictObject({ kind: z.literal("period"), period: z.enum(["early", "middle", "late"]) }),
]);
export type InterviewAnswers = {
  subject: z.infer<typeof subjectAnswerSchema>;
  stage: z.infer<typeof stageAnswerSchema>;
  employment: z.infer<typeof employmentAnswerSchema>;
  timing: z.infer<typeof timingAnswerSchema>;
  need: boolean;
};
export type InterviewQuestionId = keyof InterviewAnswers;
export type QuestionTarget =
  | { readonly id: "subject"; readonly eventId: EventId }
  | { readonly id: "stage"; readonly eventId: EventId }
  | { readonly id: "timing"; readonly eventId: EventId; readonly field: "dueDate" }
  | {
      readonly id: "timing";
      readonly eventId: EventId;
      readonly field: "birth";
      readonly childId: ChildId;
    }
  | { readonly id: "employment"; readonly personId: PersonId; readonly titleId?: TitleId }
  | { readonly id: "need"; readonly personId: PersonId };
export type QuestionRef = QuestionTarget & { readonly promptRevision: number };

type Definition<T> = {
  readonly order: number;
  readonly scope: "navigation" | "family" | "person";
  readonly label: string;
  readonly why: string;
  readonly simple: string;
  readonly canDefer: true;
  readonly schema: z.ZodType<T>;
  readonly parse: (input: string) => T | undefined;
};

function textValue<T extends string>(
  input: string,
  options: readonly { label: string; value: T }[],
): T | undefined {
  const text = normalizeGuideText(input).replace(/[.!]$/, "");
  return options.find(({ label, value }) => text === normalizeGuideText(label) || text === value)
    ?.value;
}

const stages = [
  ...questions.stage.options,
  { label: "Planuję ciążę", value: "planning" },
  { label: "Adopcja", value: "adoption" },
  { label: "Piecza zastępcza", value: "foster" },
  { label: "Strata dziecka", value: "loss" },
] as const;

export const interviewQuestions = {
  subject: {
    order: 0,
    scope: "navigation",
    label: "Kogo dotyczy sprawdzanie?",
    why: "Dane i możliwości dotyczą konkretnej osoby albo rodziny. Pomagający nie musi podawać swoich danych.",
    simple:
      "Wskaż osobę rodzącą, drugiego rodzica, opiekuna albo całą rodzinę. Możesz pomagać komuś innemu.",
    canDefer: true,
    schema: subjectAnswerSchema,
    parse: (input: string) =>
      normalizeGuideText(input) === "cala rodzina"
        ? { speaker: "self" as const, subject: { kind: "family" as const } }
        : undefined,
  },
  stage: {
    order: 1,
    scope: "family",
    label: questions.stage.label,
    why: "Planowanie, ciąża, narodziny i przyjęcie dziecka wymagają innych przygotowań.",
    simple:
      "Czy planujecie ciążę, trwa ciąża, dziecko się urodziło, czy chodzi o adopcję, pieczę lub stratę?",
    canDefer: true,
    schema: stageAnswerSchema,
    parse: (input: string) => stageAnswerSchema.safeParse(textValue(input, stages)).data,
  },
  employment: {
    order: 2,
    scope: "person",
    label: questions.employment.label,
    why: "Forma pracy wskazanej osoby pomaga wybrać sprawy do sprawdzenia; nie przesądza prawa do zasiłku.",
    simple:
      "Wskaż etat, zlecenie, działalność, współpracę, brak pracy lub inną sytuację tej osoby.",
    canDefer: true,
    schema: employmentAnswerSchema,
    parse: (input: string) => {
      const parsed = readFact("employment", input)?.employment;
      if (parsed) return { kind: parsed };
      const text = normalizeGuideText(input);
      if (text === "nie pracuje" || text === "brak pracy") return { kind: "notWorking" as const };
      if (text === "inna sytuacja") return { kind: "other" as const };
      return undefined;
    },
  },
  timing: {
    order: 3,
    scope: "family",
    label: questions.dueDate.label,
    why: "Termin porodu jest orientacją. Rzeczywista data urodzenia jest osobnym faktem dotyczącym dziecka.",
    simple: "Podaj datę z rokiem albo sam trymestr ciąży. Możesz też odpowiedzieć później.",
    canDefer: true,
    schema: timingAnswerSchema,
    parse: (input: string) => {
      const date = readCaseDate(input);
      if (date) return { kind: "date" as const, date: isoDateSchema.parse(date) };
      const period = textValue(input, [
        { label: "I trymestr", value: "early" },
        { label: "II trymestr", value: "middle" },
        { label: "III trymestr", value: "late" },
      ] as const);
      return period ? { kind: "period" as const, period } : undefined;
    },
  },
  need: {
    order: 4,
    scope: "person",
    label: "Czy chcesz sprawdzić sprawy związane ze zwolnieniem w ciąży?",
    why: "To tylko wybór tematu dalszej pomocy, bez zbierania informacji medycznych.",
    simple: "Czy pokazać również możliwości związane ze zwolnieniem?",
    canDefer: true,
    schema: z.boolean(),
    parse: (input: string) => {
      const text = normalizeGuideText(input);
      return text === "tak" ? true : text === "nie" ? false : undefined;
    },
  },
} satisfies { [K in InterviewQuestionId]: Definition<InterviewAnswers[K]> };

export function interviewQuestionText(ref: QuestionRef): string {
  return ref.id === "timing" && ref.field === "birth"
    ? questions.birthDate.label
    : interviewQuestions[ref.id].label;
}

export function sameQuestion(a: QuestionTarget, b: QuestionTarget): boolean {
  if (a.id !== b.id) return false;
  if (a.id === "subject" || a.id === "stage") return b.id === a.id && a.eventId === b.eventId;
  if (a.id === "employment")
    return b.id === "employment" && a.personId === b.personId && a.titleId === b.titleId;
  if (a.id === "need") return b.id === "need" && a.personId === b.personId;
  return (
    b.id === "timing" &&
    a.eventId === b.eventId &&
    a.field === b.field &&
    (a.field !== "birth" || (b.field === "birth" && a.childId === b.childId))
  );
}

export type ParsedInterviewAnswer =
  | { readonly kind: "unknown" | "deferred" }
  | {
      [K in InterviewQuestionId]: {
        readonly kind: "answer";
        readonly id: K;
        readonly value: InterviewAnswers[K];
      };
    }[InterviewQuestionId];

export function readInterviewAnswer(
  ref: QuestionRef,
  input: string,
): ParsedInterviewAnswer | undefined {
  const text = normalizeGuideText(input);
  if (text === "nie wiem") return { kind: "unknown" };
  if (text === "pozniej" || text === "pomin") return { kind: "deferred" };
  // Explicit branches preserve the relation between question and value without casts.
  switch (ref.id) {
    case "subject": {
      const value = interviewQuestions.subject.parse(input);
      return value ? { kind: "answer", id: ref.id, value } : undefined;
    }
    case "stage": {
      const value = interviewQuestions.stage.parse(input);
      return value ? { kind: "answer", id: ref.id, value } : undefined;
    }
    case "employment": {
      const value = interviewQuestions.employment.parse(input);
      return value ? { kind: "answer", id: ref.id, value } : undefined;
    }
    case "timing": {
      const value = interviewQuestions.timing.parse(input);
      return value && (ref.field !== "birth" || value.kind === "date")
        ? { kind: "answer", id: ref.id, value }
        : undefined;
    }
    case "need": {
      const value = interviewQuestions.need.parse(input);
      return value !== undefined ? { kind: "answer", id: ref.id, value } : undefined;
    }
  }
}
