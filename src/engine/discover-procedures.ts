import { calculatorTools, discoveryDefinitions, procedureIds } from "../data/discovery";
import type {
  DiscoveryAction,
  DiscoveryDefinition,
  ProcedureId,
  RoutingRequirement,
} from "../data/discovery";
import { procedures } from "../data/procedures";
import type { ProcedureResult } from "../types/catalog";
import type { Field, Profile } from "../types/profile";
// Stage 2's explicitly placed orchestrator consumes pure domain adapters and
// session types only. It has no dependency on React or feature UI/runtime code.
/* eslint-disable no-restricted-imports */
import { isoDateSchema, isValidTarget } from "../features/parent/family-session";
import type { AssessmentTarget, Person, Subject } from "../features/parent/family-session";
import { projectionRoute, toProcedureProfile } from "../features/parent/interview-profile";
import type { Projection, ProjectionDependency } from "../features/parent/interview-profile";
import type { InterviewSession } from "../features/parent/interview-session";
/* eslint-enable no-restricted-imports */
import { evaluateProcedure } from "./evaluateProcedure";
import type { Benefit } from "./parent-case";

export type PresentationFlag =
  | "future"
  | "needs-input"
  | "rule-review"
  | "unsupported-scope"
  | "stale";
export type DiscoveryItem = {
  readonly procedureId: ProcedureId;
  readonly target: AssessmentTarget;
  readonly projection: Projection<Profile>;
  /** Unmodified evaluateProcedure output; never a grant decision. */
  readonly evaluation: ProcedureResult;
  readonly presentation: {
    readonly kind: "engine-evaluation" | "preliminary-referral";
    readonly flags: readonly PresentationFlag[];
    readonly priority: 1 | 2 | 3 | 4 | 5;
    readonly nextDeadline?: string;
    readonly deadlineMissingFields: readonly Field[];
    readonly notes: readonly string[];
  };
  readonly action: {
    readonly destination: DiscoveryAction;
    readonly alternatives: readonly DiscoveryAction[];
    readonly fallback: DiscoveryAction;
    readonly missing: readonly RoutingRequirement[];
    readonly target: AssessmentTarget;
    readonly contextRevision: number;
  };
};
export type CalculatorReferral = {
  readonly kind: "preliminary-referral";
  readonly action: Extract<DiscoveryAction, { kind: "calculator" }>;
  readonly reason: string;
  readonly required: readonly RoutingRequirement[];
};

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function targetsFor(s: InterviewSession, id: ProcedureId, asOf: string): AssessmentTarget[] {
  const definition = discoveryDefinitions[id];
  const base = {
    eventId: s.family.event.id,
    childIds: s.family.children.map(({ id }) => id).sort(compare),
  };
  if (definition.subjectPolicy === "family") {
    // Family assessments may explicitly name an applicant/pair. Do not pick one
    // from the persons array or combine separate family declarations.
    const saved = s.assessments.filter(
      (a) =>
        a.kind === "procedure" &&
        a.procedureId === id &&
        a.asOf === asOf &&
        isValidTarget(s, a.target),
    );
    if (saved.length === 1) return [structuredClone(saved[0].target)];
    const childSpecific = [
      "CHILD_HEALTH_INSURANCE",
      "CHILD_800_PLUS",
      "ACTIVE_PARENT_WORK",
      "ACTIVE_PARENT_HOME",
      "ACTIVE_PARENT_NURSERY",
    ].includes(id);
    return childSpecific && base.childIds.length
      ? base.childIds.map((childId) => ({
          ...base,
          childIds: [childId],
          subject: { kind: "family" },
        }))
      : [{ ...base, subject: { kind: "family" } }];
  }
  const policy = definition.subjectPolicy;
  const candidates = s.persons.filter((p) =>
    policy === "parent" ? p.roles.length > 0 : p.roles.includes(policy),
  );
  if (!candidates.length) return [{ ...base, subject: { kind: "family" } }];
  return [...candidates]
    .sort((a, b) => compare(a.id, b.id))
    .flatMap((person) => {
      // Every named title is a separate perspective, including titles requiring
      // verification. No arbitrary "primary" employment or transfer across titles.
      const titles = [...person.titles].sort((a, b) => compare(a.id, b.id));
      const subjects: Subject[] = titles.length
        ? titles.map(({ id }) => ({ kind: "person", personId: person.id, titleId: id }))
        : [{ kind: "person", personId: person.id }];
      return subjects.map((subject) => {
        const saved = s.assessments.filter(
          (a) =>
            a.kind === "procedure" &&
            a.procedureId === id &&
            a.asOf === asOf &&
            a.target.subject.kind === "person" &&
            subject.kind === "person" &&
            a.target.subject.personId === subject.personId &&
            a.target.subject.titleId === subject.titleId &&
            isValidTarget(s, a.target),
        );
        return saved.length === 1 ? structuredClone(saved[0].target) : { ...base, subject };
      });
    });
}

function routingMissing(
  definition: DiscoveryDefinition,
  target: AssessmentTarget,
): RoutingRequirement[] {
  return definition.required.filter((required) => {
    switch (required) {
      case "person":
        return target.subject.kind !== "person";
      case "title":
        return target.subject.kind !== "person" || !target.subject.titleId;
      case "child":
        return !target.childIds.length;
      case "relatedPerson":
        return !target.relatedPersonId;
      case "fatherRole":
        // Stage 1's otherParent cannot establish fatherhood.
        return true;
    }
  });
}

function present(
  evaluation: ProcedureResult,
  projection: Projection<Profile>,
  asOf: string,
  missingRouting: readonly RoutingRequirement[],
): DiscoveryItem["presentation"] {
  const profile = projection.value;
  const future = evaluation.reasons.some(({ id }) => id === "future");
  const unsupported = projection.omitted.some(({ reason }) =>
    [
      "invalid-target",
      "subject",
      "unsupported-scope",
      "unsupported-employment",
      "conflict",
    ].includes(reason),
  );
  const review =
    Boolean(evaluation.procedure.review) ||
    evaluation.reasons.some(({ id }) => id === "validity") ||
    (evaluation.status === "possible" && !future);
  const deadlineMissingFields = [
    ...new Set(
      evaluation.deadlines.flatMap(({ missingField }) => (missingField ? [missingField] : [])),
    ),
  ];
  const flags: PresentationFlag[] = [];
  if (future) flags.push("future");
  if (evaluation.missingFields.length || deadlineMissingFields.length || missingRouting.length)
    flags.push("needs-input");
  if (review) flags.push("rule-review");
  if (unsupported) flags.push("unsupported-scope");
  if (projection.omitted.some(({ reason }) => reason === "stale")) flags.push("stale");
  const dates = evaluation.deadlines
    .flatMap(({ date, opens }) => (date && (!opens || opens <= asOf) ? [date] : []))
    .sort(compare);
  const nextDeadline = dates.find((date) => date >= asOf);
  const validRules = !evaluation.reasons.some(({ id }) => id === "validity");
  const openFormality =
    profile.stage === "born" &&
    ((evaluation.procedure.id === "BIRTH_REGISTRATION" && profile.birthRegistered === false) ||
      (evaluation.procedure.id === "CHILD_HEALTH_INSURANCE" && profile.healthRegistered === false));
  const hasOverdueInstruction =
    dates.some((date) => date <= asOf) && evaluation.missingFields.length === 0;
  const applicable = evaluation.status !== "not-relevant" && validRules && !future;
  const situation =
    profile.stage === "pregnant"
      ? evaluation.procedure.phase === "pregnancy"
      : profile.stage === "born" &&
        (evaluation.procedure.phase === "birth" || evaluation.matchedConditions.length > 0);
  const priority =
    applicable && (openFormality || hasOverdueInstruction)
      ? 1
      : applicable && nextDeadline
        ? 2
        : applicable && situation
          ? 3
          : future
            ? 4
            : 5;
  const notes: string[] = [];
  if (missingRouting.length)
    notes.push(
      "Przed skierowaniem ustal wskazaną osobę, tytuł lub zakres dziecka. Instrukcja pozostaje dostępna.",
    );
  if (unsupported)
    notes.push(
      "Zakres danych lub katalogu wymaga sprawdzenia; wynik nie potwierdza indywidualnego prawa.",
    );
  if (evaluation.procedure.id === "PATERNITY_LEAVE")
    notes.push(
      "Rola drugiego rodzica nie potwierdza ojcostwa. Ustal właściwy podmiot przed indywidualnym sprawdzeniem urlopu ojcowskiego.",
    );
  if (evaluation.procedure.id === "SUPPLEMENTARY_MATERNITY_LEAVE")
    notes.push(
      "Ustal osobę korzystającą z uzupełniającego okresu. Katalog nie rozstrzyga przejęcia macierzyńskiego; służy do tego osobny kalkulator.",
    );
  if (review) notes.push("Reguły lub wyjątki wymagają weryfikacji we wskazanych źródłach.");
  return {
    kind: unsupported || missingRouting.length ? "preliminary-referral" : "engine-evaluation",
    flags,
    priority,
    nextDeadline,
    deadlineMissingFields,
    notes,
  };
}

function itemKey(item: DiscoveryItem) {
  const subject = item.target.subject;
  return JSON.stringify([
    subject.kind === "person" ? subject.personId : "",
    subject.kind === "person" ? (subject.titleId ?? "") : "",
    [...item.target.childIds].sort(compare),
  ]);
}

/** Presentation sorting only: legal statuses and engine results are never changed. */
export function rankDiscoveredProcedures(items: readonly DiscoveryItem[]): DiscoveryItem[] {
  return [...items].sort(
    (a, b) =>
      a.presentation.priority - b.presentation.priority ||
      compare(
        a.presentation.nextDeadline ?? "9999-12-31",
        b.presentation.nextDeadline ?? "9999-12-31",
      ) ||
      procedureIds.indexOf(a.procedureId) - procedureIds.indexOf(b.procedureId) ||
      compare(itemKey(a), itemKey(b)),
  );
}

function referralsFor(route: ReturnType<typeof projectionRoute>): CalculatorReferral[] {
  return (Object.keys(calculatorTools) as Benefit[])
    .filter((benefit) => {
      const routes: readonly string[] = calculatorTools[benefit].routes;
      return routes.includes(route);
    })
    .map((benefit) => ({
      kind: "preliminary-referral",
      action: { kind: "calculator", benefit },
      required: ["person", "title"],
      reason:
        route === "standard"
          ? "Odrębne sprawdzenie w istniejącym kalkulatorze; wynik urlopu pracowniczego nie przesądza prawa do zasiłku."
          : "Katalog standardowego porodu nie ocenia tej ścieżki. Istniejący kalkulator sprawdzi dane i ograniczenia, w tym rodzaj pieczy.",
    }));
}

export function discoverProcedures(s: InterviewSession, asOf: string = s.asOf) {
  isoDateSchema.parse(asOf);
  const route = projectionRoute(s);
  const results: DiscoveryItem[] = [];
  const dependencies: ProjectionDependency[] = [];
  // Even routes without catalogue evaluations expose the facts selecting them.
  const routeProjection = toProcedureProfile(
    s,
    "BIRTH_REGISTRATION",
    {
      eventId: s.family.event.id,
      subject: { kind: "family" },
      childIds: [],
    },
    asOf,
  );
  dependencies.push(...routeProjection.dependencies);
  if (route === "standard" || route === "undetermined") {
    for (const person of s.persons) {
      dependencies.push({
        ref: { kind: "person", personId: person.id, field: "roles" },
        revision: null,
        selection: JSON.stringify(person.roles),
      });
      dependencies.push({
        ref: { kind: "person", personId: person.id, field: "titles" },
        revision: null,
        selection: JSON.stringify(person.titles.map(({ id }) => id).sort(compare)),
      });
    }
    for (const procedureId of procedureIds) {
      const procedure = procedures.find(({ id }) => id === procedureId);
      if (!procedure) throw new Error(`Brak procedury w katalogu: ${procedureId}`);
      for (const target of targetsFor(s, procedureId, asOf)) {
        const projection = toProcedureProfile(s, procedureId, target, asOf);
        const evaluation = evaluateProcedure(projection.value, procedure, asOf);
        const definition = discoveryDefinitions[procedureId];
        const missing = routingMissing(definition, target);
        const presentation = present(evaluation, projection, asOf, missing);
        results.push({
          procedureId,
          target,
          projection,
          evaluation,
          presentation,
          action: {
            destination: definition.action,
            alternatives: definition.additionalActions,
            fallback: definition.fallback,
            missing,
            target,
            contextRevision: s.contextRevision,
          },
        });
        dependencies.push(...projection.dependencies);
      }
    }
  }
  const ranked = rankDiscoveredProcedures(
    results.filter(({ evaluation }) => evaluation.status !== "not-relevant"),
  );
  // Unknown context gets one context prompt/category summary, not nineteen empty cards.
  const visible =
    route === "standard"
      ? ranked.filter((item, index) => index < 4 || item.presentation.priority === 1)
      : [];
  const remaining = ranked.filter((item) => !visible.includes(item));
  return {
    route,
    asOf,
    contextRevision: s.contextRevision,
    results,
    items: visible,
    remaining,
    excluded: results.filter(({ evaluation }) => evaluation.status === "not-relevant"),
    contextRequired:
      route === "undetermined" ||
      (route === "standard" && !s.persons.some((p: Person) => p.roles.length)),
    categories:
      route === "undetermined" ? ["sytuacja rodziny", "urlopy i zasiłki", "formalności"] : [],
    planning:
      route === "planning"
        ? { kind: "planning" as const, destination: "PlanningPlan" as const }
        : undefined,
    referrals: referralsFor(route),
    // Always available separately, even without a known route. No fake procedure IDs.
    availableCalculators: (Object.keys(calculatorTools) as Benefit[]).map((benefit) => ({
      kind: "calculator" as const,
      benefit,
    })),
    dependencies,
  };
}
