import { compareParentalPlans } from "../../engine/parent-plan";
import type { PlanOptions } from "../../engine/parent-plan";
import type { CaseFacts } from "../../engine/parent-case";
import { append, selectBenefit } from "./case-session";
import type { CaseSession } from "./case-session";
import { assessmentIdSchema, isValidTarget } from "./family-session";
import type { AssessmentTarget, Fact, FactFields } from "./family-session";
import { applyConfirmedFacts } from "./interview-session";
import { toCaseFacts } from "./interview-profile";
import { refreshSnapshots } from "./result-snapshots";

/** The comparison form is a draft until both people/titles are explicitly selected. */
export function confirmComparison(
  s: CaseSession,
  facts: CaseFacts,
  options: PlanOptions,
  first: AssessmentTarget,
  second: AssessmentTarget,
): CaseSession {
  if (
    !isValidTarget(s.data, first) ||
    !isValidTarget(s.data, second) ||
    first.subject.kind !== "person" ||
    second.subject.kind !== "person" ||
    first.subject.personId === second.subject.personId ||
    !first.subject.titleId ||
    !second.subject.titleId
  )
    return s;
  first = { ...first, relatedPersonId: second.subject.personId };
  second = {
    ...second,
    relatedPersonId: first.subject.kind === "person" ? first.subject.personId : undefined,
  };
  const preview = compareParentalPlans(facts, options, s.asOf, s.demoRate);
  if (!preview) return s;
  let next = s;
  const write = (target: AssessmentTarget, patch: CaseFacts) => {
    const selected = selectBenefit(
      {
        ...next,
        data: {
          ...next.data,
          navigation: { ...next.data.navigation, activeSubject: target.subject },
        },
        scopeTarget: target,
      },
      "parental",
    );
    const id = selected.activeAssessmentId;
    if (!id) return;
    const written = applyConfirmedFacts(selected.data, {
      kind: "caseFacts",
      baseRevision: selected.data.contextRevision,
      assessmentId: id,
      facts: patch,
    });
    if (!written.ok) return;
    next = { ...selected, data: written.session };
    return id;
  };
  const firstId = write(first, {
    ...facts,
    from: options.start,
    through: preview.adjusted.first.period?.through,
    employmentPercent: options.employmentPercent ?? facts.employmentPercent,
  });
  const secondStart = preview.adjusted.second.period?.from;
  if (!firstId || !secondStart)
    return append(s, {
      kind: "note",
      text: "Uzupełnij dane porównania. Nie zapisano niepełnego wariantu.",
    });
  const secondId = write(second, {
    birth: facts.birth,
    children: facts.children,
    careCertificate: facts.careCertificate,
    from: secondStart,
    through: preview.adjusted.second.period?.through,
    employment: options.otherEmployment,
    insured: options.otherInsured,
    basis: options.otherBasis,
    debt: options.otherDebt,
    standardRate: facts.standardRate,
    averagedRequest: facts.averagedRequest,
    parts: facts.parts,
    usedDays: facts.otherParentDays,
    otherParentDays: facts.usedDays,
  });
  if (!secondId) return s;
  const firstProjection = toCaseFacts(next.data, firstId);
  const secondProjection = toCaseFacts(next.data, secondId);
  const secondFacts = secondProjection.value;
  if (
    secondFacts.basis === undefined ||
    secondFacts.insured === undefined ||
    secondFacts.employment === undefined
  )
    return append(s, {
      kind: "note",
      text: "Potwierdź dane obu osób na dni rozpoczęcia ich części opieki.",
    });
  const canonicalOptions = {
    ...options,
    otherBasis: secondFacts.basis,
    otherInsured: secondFacts.insured,
    otherEmployment: secondFacts.employment,
  };
  const result = compareParentalPlans(firstProjection.value, canonicalOptions, s.asOf, s.demoRate);
  if (!result) return s;
  const id = assessmentIdSchema.parse(
    `${s.data.id}:assessment:${next.data.assessments.length + 1}`,
  );
  const revision = next.data.contextRevision;
  const optionFacts: FactFields<
    Pick<
      PlanOptions,
      | "start"
      | "weeks"
      | "otherWeeks"
      | "together"
      | "workPercent"
      | "employmentPercent"
      | "extensionWorkPercent"
      | "maternity"
    >
  > = {};
  for (const key of [
    "start",
    "weeks",
    "otherWeeks",
    "together",
    "workPercent",
    "employmentPercent",
    "extensionWorkPercent",
    "maternity",
  ] as const) {
    const value = options[key];
    if (value !== undefined) {
      const fact: Fact<typeof value> = {
        state: "confirmed",
        value,
        revision,
        source: { kind: "answer", via: "confirmation" },
        validTime: { kind: "undated" },
        basis: "observed",
      };
      Object.assign(optionFacts, { [key]: fact });
    }
  }
  const firstAssessment = next.data.assessments.find((a) => a.id === firstId);
  const secondAssessment = next.data.assessments.find((a) => a.id === secondId);
  if (!firstAssessment || !secondAssessment) return s;
  const saved = {
    ...next,
    data: refreshSnapshots({
      ...next.data,
      assessments: [
        ...next.data.assessments,
        {
          kind: "comparison" as const,
          id,
          target: firstAssessment.target,
          first: firstAssessment.target,
          second: secondAssessment.target,
          firstAssessmentId: firstId,
          secondAssessmentId: secondId,
          asOf: next.data.asOf,
          inputRevision: revision,
          goal: "calculation" as const,
          state: "draft" as const,
          options: optionFacts,
          result: {
            assessmentId: id,
            input: {
              facts: structuredClone(firstProjection.value),
              options: structuredClone(canonicalOptions),
            },
            result: structuredClone(result),
            dependencies: [],
            projectionDependencies: [
              ...firstProjection.dependencies,
              ...secondProjection.dependencies,
            ],
            asOf: next.data.asOf,
            assessedAt: new Date().toISOString(),
            engineVersion: "parent-plan:stage3-v1",
            state: "current" as const,
            explanation: "Wariant potwierdzony dla wskazanej pary osób i ich tytułów.",
          },
        },
      ],
    }),
  };
  return append(saved, {
    kind: "note",
    text: "Porównanie zapisane dla wskazanych osób. Zmiana danych zależnych oznaczy je jako nieaktualne.",
  });
}
