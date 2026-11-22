import { z } from "zod";
import sourceRecords from "./sources.json";
import { benefitSchema } from "../engine/parent-case";
import type { Benefit } from "../engine/parent-case";

export const procedureIds = [
  "EMPLOYMENT_PREGNANCY_PROTECTION",
  "SICKNESS_PREGNANCY",
  "BIRTH_REGISTRATION",
  "CHILD_HEALTH_INSURANCE",
  "MATERNITY_LEAVE",
  "MATERNITY_ALLOWANCE",
  "PARENTAL_LEAVE",
  "SUPPLEMENTARY_MATERNITY_LEAVE",
  "CHILD_800_PLUS",
  "PARENTAL_BENEFIT",
  "BIRTH_GRANT_BECIKOWE",
  "ACTIVE_PARENT_WORK",
  "ACTIVE_PARENT_NURSERY",
  "ACTIVE_PARENT_HOME",
  "PATERNITY_LEAVE",
  "CARE_ALLOWANCE",
  "CHILDCARE_LEAVE",
  "FAMILY_ALLOWANCE",
  "CHILD_TAX_RELIEF",
] as const;
export const procedureIdSchema = z.enum(procedureIds);
export type ProcedureId = z.infer<typeof procedureIdSchema>;
export type SourceId = keyof typeof sourceRecords;
const sourceIdSchema = z.custom<SourceId>(
  (value) => typeof value === "string" && Object.hasOwn(sourceRecords, value),
);
export const discoveryActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("calculator"), benefit: benefitSchema }),
  z.strictObject({ kind: z.literal("procedureQuestions"), procedureId: procedureIdSchema }),
  z.strictObject({ kind: z.literal("formalities"), procedureId: procedureIdSchema }),
  z.strictObject({ kind: z.literal("officialGuidance"), sourceId: sourceIdSchema }),
]);
export type DiscoveryAction = z.infer<typeof discoveryActionSchema>;
export type SubjectPolicy = "birthing" | "parent" | "otherParent" | "family";
export type RoutingRequirement = "person" | "title" | "child" | "relatedPerson" | "fatherRole";
export type DiscoveryDefinition = {
  readonly procedureId: ProcedureId;
  readonly subjectPolicy: SubjectPolicy;
  readonly cardKind: "leave" | "benefit" | "formality" | "guidance";
  readonly action: DiscoveryAction;
  readonly additionalActions: readonly DiscoveryAction[];
  readonly required: readonly RoutingRequirement[];
  readonly calculator?: Benefit;
  readonly fallback: Extract<DiscoveryAction, { kind: "officialGuidance" }>;
};

function definition(
  procedureId: ProcedureId,
  subjectPolicy: SubjectPolicy,
  cardKind: DiscoveryDefinition["cardKind"],
  sourceId: SourceId,
  required: readonly RoutingRequirement[],
  mode: "procedureQuestions" | "formalities" | Benefit = "procedureQuestions",
  calculator?: Benefit,
): DiscoveryDefinition {
  const action: DiscoveryAction =
    mode === "procedureQuestions" || mode === "formalities"
      ? { kind: mode, procedureId }
      : { kind: "calculator", benefit: mode };
  const linkedCalculator = action.kind === "calculator" ? action.benefit : calculator;
  return {
    procedureId,
    subjectPolicy,
    cardKind,
    required,
    action,
    calculator: linkedCalculator,
    additionalActions:
      linkedCalculator && action.kind !== "calculator"
        ? [{ kind: "calculator", benefit: linkedCalculator }]
        : [],
    fallback: { kind: "officialGuidance", sourceId },
  };
}

// These are destinations/contracts for stage 3. Questions use data/questions;
// formalities use the existing PlanReport. There are no invented calculators.
export const discoveryDefinitions = {
  EMPLOYMENT_PREGNANCY_PROTECTION: definition(
    "EMPLOYMENT_PREGNANCY_PROTECTION",
    "birthing",
    "guidance",
    "pregnancy",
    ["person", "title"],
    "formalities",
  ),
  SICKNESS_PREGNANCY: definition(
    "SICKNESS_PREGNANCY",
    "birthing",
    "benefit",
    "sickness",
    ["person", "title"],
    "sickness",
  ),
  BIRTH_REGISTRATION: definition(
    "BIRTH_REGISTRATION",
    "family",
    "formality",
    "birth",
    [],
    "procedureQuestions",
  ),
  CHILD_HEALTH_INSURANCE: definition("CHILD_HEALTH_INSURANCE", "family", "formality", "health", [
    "child",
    "person",
  ]),
  MATERNITY_LEAVE: definition(
    "MATERNITY_LEAVE",
    "birthing",
    "leave",
    "maternity",
    ["person", "title"],
    "formalities",
    "maternity",
  ),
  MATERNITY_ALLOWANCE: definition(
    "MATERNITY_ALLOWANCE",
    "birthing",
    "benefit",
    "maternityDocs",
    ["person", "title"],
    "maternity",
  ),
  PARENTAL_LEAVE: definition(
    "PARENTAL_LEAVE",
    "parent",
    "leave",
    "parental",
    ["person", "title"],
    "procedureQuestions",
    "parental",
  ),
  SUPPLEMENTARY_MATERNITY_LEAVE: definition(
    "SUPPLEMENTARY_MATERNITY_LEAVE",
    "parent",
    "leave",
    "supplement",
    ["person", "title", "child"],
    "supplement",
  ),
  CHILD_800_PLUS: definition("CHILD_800_PLUS", "family", "benefit", "child800", [
    "child",
    "person",
  ]),
  PARENTAL_BENEFIT: definition("PARENTAL_BENEFIT", "family", "benefit", "parentalBenefit", [
    "person",
  ]),
  BIRTH_GRANT_BECIKOWE: definition("BIRTH_GRANT_BECIKOWE", "family", "benefit", "becikowe", [
    "person",
  ]),
  ACTIVE_PARENT_WORK: definition("ACTIVE_PARENT_WORK", "family", "benefit", "work", [
    "child",
    "person",
    "relatedPerson",
  ]),
  ACTIVE_PARENT_NURSERY: definition("ACTIVE_PARENT_NURSERY", "family", "benefit", "nursery", [
    "child",
    "person",
  ]),
  ACTIVE_PARENT_HOME: definition("ACTIVE_PARENT_HOME", "family", "benefit", "home", [
    "child",
    "person",
  ]),
  PATERNITY_LEAVE: definition(
    "PATERNITY_LEAVE",
    "otherParent",
    "leave",
    "paternity",
    ["person", "title", "fatherRole"],
    "procedureQuestions",
    "paternity",
  ),
  CARE_ALLOWANCE: definition("CARE_ALLOWANCE", "parent", "benefit", "care", [
    "person",
    "title",
    "child",
  ]),
  CHILDCARE_LEAVE: definition("CHILDCARE_LEAVE", "parent", "leave", "childcare", [
    "person",
    "title",
  ]),
  FAMILY_ALLOWANCE: definition("FAMILY_ALLOWANCE", "family", "benefit", "family", ["person"]),
  CHILD_TAX_RELIEF: definition("CHILD_TAX_RELIEF", "parent", "guidance", "tax", ["person"]),
} as const satisfies Record<ProcedureId, DiscoveryDefinition>;

// Separate from the legal procedure catalogue, including benefit counterparts
// of employee leave. A catalogue refusal must not remove these tools.
export const calculatorTools = {
  maternity: { routes: ["standard"] },
  paternity: { routes: ["standard"] },
  parental: { routes: ["standard"] },
  supplement: { routes: ["standard", "adoption", "foster"] },
  sickness: { routes: ["standard"] },
  rehabilitation: { routes: ["standard"] },
  pregnancyAfterEmployment: { routes: ["standard"] },
  maternityTransfer: { routes: ["standard"] },
  adoptivePaternity: { routes: ["adoption"] },
  careMaternity: { routes: ["adoption", "foster"] },
  careParental: { routes: ["adoption", "foster"] },
  lossMaternity: { routes: ["loss"] },
} as const satisfies Record<Benefit, { readonly routes: readonly string[] }>;
