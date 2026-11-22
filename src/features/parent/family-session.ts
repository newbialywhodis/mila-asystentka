import { z } from "zod";
import { caseFactsSchema } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey } from "../../engine/parent-case";
import type { BenefitResult, DemoRate } from "../../engine/parent-benefit";
import type { compareParentalPlans, PlanOptions } from "../../engine/parent-plan";
import type { Profile, HospitalStay } from "../../types/profile";
import type { ProcedureResult } from "../../types/catalog";

export const personIdSchema = z.string().trim().min(1).brand<"PersonId">();
export const eventIdSchema = z.string().trim().min(1).brand<"EventId">();
export const titleIdSchema = z.string().trim().min(1).brand<"TitleId">();
export const assessmentIdSchema = z.string().trim().min(1).brand<"AssessmentId">();
export const documentIdSchema = z.string().trim().min(1).brand<"DocumentId">();
export const childIdSchema = z.string().trim().min(1).brand<"ChildId">();
export const isoDateSchema = caseFactsSchema.shape.birth.brand<"ISODate">();
export type PersonId = z.infer<typeof personIdSchema>;
export type EventId = z.infer<typeof eventIdSchema>;
export type TitleId = z.infer<typeof titleIdSchema>;
export type AssessmentId = z.infer<typeof assessmentIdSchema>;
export type DocumentId = z.infer<typeof documentIdSchema>;
export type ChildId = z.infer<typeof childIdSchema>;
export type ISODate = z.infer<typeof isoDateSchema>;

export const factSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("answer"), via: z.enum(["button", "parser", "confirmation"]) }),
  z.strictObject({
    kind: z.literal("pdf"),
    documentId: documentIdSchema,
    page: z.number().int().min(1),
  }),
  z.strictObject({ kind: z.literal("calculation"), calculationId: z.string().min(1) }),
  z.strictObject({ kind: z.literal("demo"), label: z.string().min(1) }),
]);
export type FactSource = z.infer<typeof factSourceSchema>;
export const validTimeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("day"), day: isoDateSchema }),
  z
    .strictObject({ kind: z.literal("period"), from: isoDateSchema, through: isoDateSchema })
    .refine(({ from, through }) => from <= through, "Odwrócony okres"),
  z.strictObject({ kind: z.literal("undated") }),
]);
export type ValidTime = z.infer<typeof validTimeSchema>;
export type Fact<T> =
  | {
      readonly state: "confirmed";
      readonly value: T;
      readonly revision: number;
      readonly source: FactSource;
      readonly validTime: ValidTime;
      readonly basis: "observed" | "assumed";
    }
  | { readonly state: "unknown" | "deferred"; readonly revision: number }
  | {
      readonly state: "stale";
      readonly previous: T;
      readonly revision: number;
      readonly source: FactSource;
      readonly validTime: ValidTime;
      readonly basis: "observed" | "assumed";
      readonly reason: string;
    };
export type FactFields<T> = { readonly [K in keyof T]?: Fact<NonNullable<T[K]>> };

export function confirmedValue<T>(fact: Fact<T> | undefined): T | undefined {
  return fact?.state === "confirmed" ? fact.value : undefined;
}

export function markStale<T>(
  fact: Fact<T> | undefined,
  revision: number,
  reason: string,
): Fact<T> | undefined {
  if (fact?.state !== "confirmed") return fact;
  const { value, ...metadata } = fact;
  return { ...metadata, state: "stale", previous: value, revision, reason };
}

export function timeContains(time: ValidTime, day: ISODate): boolean {
  return time.kind === "day"
    ? time.day === day
    : time.kind === "period" && time.from <= day && day <= time.through;
}

export function timesOverlap(a: ValidTime, b: ValidTime): boolean {
  // An undated correction has no narrower proven scope.
  if (a.kind === "undated" || b.kind === "undated") return true;
  const [aFrom, aTo] = a.kind === "day" ? [a.day, a.day] : [a.from, a.through];
  const [bFrom, bTo] = b.kind === "day" ? [b.day, b.day] : [b.from, b.through];
  return aFrom <= bTo && bFrom <= aTo;
}

export type WorkKind = NonNullable<CaseFacts["employment"]> | "notWorking" | "other";
export type PersonRole = "birthing" | "otherParent" | "guardian";
export type InsuranceTitle = {
  readonly id: TitleId;
  readonly employment?: Fact<NonNullable<CaseFacts["employment"]>>;
  readonly ended?: Fact<ISODate>;
  readonly employmentPercent?: Fact<number>;
  readonly sicknessCoverage: readonly { readonly id: string; readonly fact: Fact<boolean> }[];
};
export type Person = {
  readonly id: PersonId;
  readonly roles: readonly PersonRole[];
  readonly workSituation?: Fact<"notWorking" | "other">;
  readonly titles: readonly InsuranceTitle[];
  readonly procedureFacts: FactFields<Pick<Profile, "employedSixMonths" | "parentUsesTaxScale">>;
  // A preference for the interview, not a medical or eligibility fact.
  readonly sicknessCheck?: Fact<boolean>;
};
export type Family = {
  readonly event: { readonly id: EventId; readonly kind?: Fact<"birth" | "adoption" | "foster"> };
  readonly stage?: Fact<"planning" | "pregnant" | "born" | "receivingCare">;
  readonly loss?: Fact<boolean>;
  readonly dueDate?: Fact<ISODate>;
  readonly pregnancyPeriod?: Fact<"early" | "middle" | "late">;
  readonly childrenCount?: Fact<number>;
  readonly eventFacts: FactFields<
    Pick<
      CaseFacts,
      | "careKind"
      | "courtApplication"
      | "adoptionFinal"
      | "careAccepted"
      | "sameCareAgeLimit"
      | "survivingChildren"
    >
  >;
  readonly children: readonly {
    readonly id: ChildId;
    readonly birth?: Fact<ISODate>;
    readonly death?: Fact<ISODate>;
    readonly schoolDeferral?: Fact<boolean>;
    readonly gestationalWeeks?: Fact<number>;
    readonly birthWeightGrams?: Fact<number>;
    readonly hospitalStays?: Fact<readonly HospitalStay[]>;
    readonly facts: FactFields<
      Pick<
        Profile,
        | "hospitalized"
        | "healthRegistered"
        | "healthTitle"
        | "healthRegistrationTrigger"
        | "zaZyciemCertificate"
        | "activeDisabilityCertificate"
      >
    >;
  }[];
  readonly shared: FactFields<
    Pick<Profile, "livesInPoland" | "birthRegistered" | "birthCardDate" | "familyChildDisability">
  >;
};

// Exhaustive ownership, including projections. No second mutable Profile/CaseFacts.
export const profileOwnership = {
  stage: "family",
  dueDate: "family",
  birthDate: "child",
  childrenBorn: "family",
  employment: "title",
  otherParentEmployment: "projection",
  sicknessInsurance: "projection",
  sicknessQualifyingPeriod: "procedure",
  sicknessLeave: "procedure",
  pregnancyCertificate: "procedure",
  insuredAtBirth: "projection",
  zusPays: "procedure",
  livesInPoland: "family",
  standardResidence: "procedure",
  birthRegistered: "family",
  birthCardDate: "family",
  healthRegistered: "child",
  healthTitle: "child",
  healthRegistrationTrigger: "child",
  maternityEnd: "procedure",
  parentalStart: "procedure",
  paternityStart: "procedure",
  childcareLeaveStart: "procedure",
  employedSixMonths: "person",
  hospitalized: "child",
  gestationalWeeks: "child",
  birthWeightGrams: "child",
  hospitalStays: "child",
  receivesMaternity: "procedure",
  activeComponent: "procedure",
  legacyRko: "procedure",
  nursery: "procedure",
  nurseryRegistered: "procedure",
  nurseryFee: "procedure",
  nurseryStart: "procedure",
  singleParent: "procedure",
  workActive: "procedure",
  otherWorkActive: "procedure",
  contributionPercent: "procedure",
  otherContributionPercent: "procedure",
  preferentialContributions: "procedure",
  otherPreferentialContributions: "procedure",
  familyIncomePerPerson: "procedure",
  medicalCareWeek10: "procedure",
  familyChildDisability: "family",
  careNeeded: "procedure",
  parentUsesTaxScale: "person",
  activeDisabilityCertificate: "child",
  zaZyciemCertificate: "child",
} as const satisfies Record<
  keyof Profile,
  "family" | "child" | "title" | "person" | "procedure" | "projection"
>;

export const caseFactOwnership = {
  birthStage: "calculation",
  birth: "child",
  dueDate: "family",
  certifiedDueDate: "calculation",
  from: "calculation",
  through: "calculation",
  requestedDays: "calculation",
  employment: "title",
  insured: "projection",
  exception: "calculation",
  termination: "calculation",
  employmentEnded: "title",
  alternativeEmployment: "calculation",
  transferReason: "calculation",
  motherDaysAfterBirth: "calculation",
  motherDaysBeforeBirth: "calculation",
  motherInsured: "calculation",
  transferEvent: "calculation",
  transferThrough: "calculation",
  motherJobPercent: "calculation",
  motherJobEnds: "calculation",
  personalCare: "calculation",
  children: "family",
  careKind: "family",
  courtApplication: "family",
  adoptionFinal: "family",
  careAccepted: "family",
  sameCareAgeLimit: "family",
  careChildren: "projection",
  previousCareDays: "calculation",
  maternityEnd: "calculation",
  supplementCare: "calculation",
  childDeath: "child",
  survivingChildren: "family",
  schoolDeferral: "child",
  previousCareBenefit: "calculation",
  basis: "calculation",
  fixedSalary: "calculation",
  payer: "calculation",
  insuredHeadcount: "calculation",
  debt: "calculation",
  debtPaid: "calculation",
  otherParentDays: "projection",
  usedDays: "usage",
  parts: "usage",
  careCertificate: "projection",
  soleParent: "calculation",
  reserved: "calculation",
  averagedRequest: "calculation",
  parentalInFirstYear: "calculation",
  standardRate: "calculation",
  paternityUsed: "usage",
  workPercent: "calculation",
  extensionWorkPercent: "calculation",
  employmentPercent: "title",
  qualifying: "calculation",
  qualifyingDays: "calculation",
  waitingException: "calculation",
  illnessStart: "calculation",
  postInsuranceExcluded: "calculation",
  lateOnsetCode: "calculation",
  sickPayDaysRemaining: "calculation",
  pregnancyProof: "calculation",
  sickDaysUsed: "calculation",
  sickPeriodExhausted: "calculation",
  rehabMedical: "calculation",
  rehabExcluded: "calculation",
  rehabUsed: "calculation",
  rehabSickBasis: "calculation",
  rehabStart: "calculation",
  employerSickPayEnded: "calculation",
  gestationalWeeks: "child",
  birthWeightGrams: "child",
  hospitalFrom: "projection",
  hospitalThrough: "projection",
  hospitalRanges: "projection",
  combinedHospitalEvidence: "calculation",
  documentDate: "calculation",
} as const satisfies Record<
  FactKey,
  "family" | "child" | "title" | "calculation" | "projection" | "usage"
>;

type OwnedKeys<R, Owner> = { [K in keyof R]: R[K] extends Owner ? K : never }[keyof R];
export type CalculationDetailKey = OwnedKeys<typeof caseFactOwnership, "calculation">;
export type ProcedureDetailKey = OwnedKeys<typeof profileOwnership, "procedure">;
export type Subject =
  | { readonly kind: "family" }
  | { readonly kind: "person"; readonly personId: PersonId; readonly titleId?: TitleId };
export type AssessmentTarget = {
  readonly eventId: EventId;
  readonly subject: Subject;
  readonly relatedPersonId?: PersonId;
  readonly childIds: readonly ChildId[];
};
export type FactRef =
  | {
      readonly kind: "family";
      readonly eventId: EventId;
      readonly field: "stage" | "dueDate" | "childrenCount" | "loss" | "timing";
    }
  | {
      readonly kind: "person";
      readonly personId: PersonId;
      readonly field: "workSituation" | "sicknessCheck" | "roles";
    }
  | {
      readonly kind: "title";
      readonly personId: PersonId;
      readonly titleId: TitleId;
      readonly field: "employment" | "coverage";
      readonly validTime: ValidTime;
    };
export type ResultSnapshot<Input, Result> = {
  readonly input: Readonly<Input>;
  readonly result: Readonly<Result>;
  readonly dependencies: readonly { readonly ref: FactRef; readonly revision: number | null }[];
  readonly asOf: ISODate;
  readonly engineVersion: string;
  readonly demoRate?: DemoRate;
  readonly state: "current" | "stale";
  readonly explanation: string;
};
type AssessmentBase = {
  readonly id: AssessmentId;
  readonly target: AssessmentTarget;
  readonly asOf: ISODate;
  readonly inputRevision: number;
  readonly goal: "calculation" | "application";
  readonly state: "draft" | "stale";
};
// Stage 1 represents checks; their creation, projection and execution belong to later stages.
export type Assessment = AssessmentBase &
  (
    | {
        readonly kind: "calculator";
        readonly benefit: Benefit;
        readonly details: FactFields<Pick<CaseFacts, CalculationDetailKey>>;
        readonly result?: ResultSnapshot<CaseFacts, BenefitResult>;
      }
    | {
        readonly kind: "procedure";
        readonly procedureId: ProcedureResult["procedure"]["id"];
        readonly details: FactFields<Pick<Profile, ProcedureDetailKey>>;
        readonly result?: ResultSnapshot<Profile, ProcedureResult>;
      }
    | {
        readonly kind: "comparison";
        readonly first: AssessmentTarget;
        readonly second: AssessmentTarget;
        // Financial and insurance facts belong to the selected persons/titles/checks.
        readonly options: FactFields<
          Pick<
            PlanOptions,
            | "start"
            | "weeks"
            | "otherWeeks"
            | "together"
            | "workPercent"
            | "employmentPercent"
            | "extensionWorkPercent"
          >
        >;
        readonly result?: ResultSnapshot<
          { facts: CaseFacts; options: PlanOptions },
          NonNullable<ReturnType<typeof compareParentalPlans>>
        >;
      }
  );
export type Usage = {
  readonly personId: PersonId;
  readonly eventId: EventId;
} & (
  | { readonly period: "parental"; readonly usedDays?: Fact<NonNullable<CaseFacts["usedDays"]>> }
  | {
      readonly period: "paternity";
      readonly paternityUsed?: Fact<NonNullable<CaseFacts["paternityUsed"]>>;
    }
);
export type FamilyData = {
  readonly family: Family;
  readonly persons: readonly Person[];
  readonly assessments: readonly Assessment[];
  readonly usage: readonly Usage[];
  readonly parentalParts?: Fact<NonNullable<CaseFacts["parts"]>>;
};

export function isValidTarget(data: FamilyData, target: AssessmentTarget): boolean {
  if (target.eventId !== data.family.event.id) return false;
  const subject = target.subject;
  const person =
    subject.kind === "person" && data.persons.find(({ id }) => id === subject.personId);
  return (
    (subject.kind === "family" ||
      Boolean(
        person && (!subject.titleId || person.titles.some(({ id }) => id === subject.titleId)),
      )) &&
    (!target.relatedPersonId ||
      (data.persons.some(({ id }) => id === target.relatedPersonId) &&
        (subject.kind !== "person" || target.relatedPersonId !== subject.personId))) &&
    new Set(target.childIds).size === target.childIds.length &&
    target.childIds.every((id) => data.family.children.some((child) => child.id === id))
  );
}

export function coverageOnDay(
  person: Person,
  titleId: TitleId,
  day: ISODate,
  basis: "observed" | "assumed" = "observed",
): boolean | undefined {
  const coverage = person.titles
    .find(({ id }) => id === titleId)
    ?.sicknessCoverage.flatMap(({ fact }) =>
      fact.state === "confirmed" && fact.basis === basis && timeContains(fact.validTime, day)
        ? [fact.value]
        : [],
    );
  // Conflicting declarations never silently resolve by array order.
  return coverage?.length && coverage.every((value) => value === coverage[0])
    ? coverage[0]
    : undefined;
}
