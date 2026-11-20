import { conditions } from "../data/conditions";
import { amounts, documents } from "../data/references";
import version from "../data/version.json";
import type { EvaluationStatus, Procedure, ProcedureResult } from "../types/catalog";
import type { Field, Profile } from "../types/profile";
import { isCurrent, parseDate } from "./dates";
import { evaluateDeadline } from "./deadlines";
import { evaluateCondition } from "./evaluateCondition";
import { calculateSupplement } from "./prematurity";

function durationFor(
  procedure: Procedure,
  profile: Profile,
  asOf: string,
): ProcedureResult["duration"] {
  const count = profile.childrenBorn ?? 0;
  if (procedure.id === "MATERNITY_LEAVE") {
    const weeks = [20, 31, 33, 35, 37][Math.min(5, count) - 1];
    if (weeks) return { weeks, note: "Podstawowy wymiar urlopu macierzyńskiego" };
  }
  if (procedure.id === "PARENTAL_LEAVE" && count) {
    const weeks = (count === 1 ? 41 : 43) + (profile.zaZyciemCertificate ? 24 : 0);
    return {
      weeks,
      note: profile.zaZyciemCertificate
        ? "Łączny wymiar po uwzględnieniu zaświadczenia „Za życiem”"
        : "Łączny wymiar podstawowy",
    };
  }
  if (procedure.id === "PARENTAL_BENEFIT") {
    const weeks = [52, 65, 67, 69, 71][Math.min(5, count) - 1];
    if (weeks) {
      const supplement = calculateSupplement(profile, asOf);
      const additional = supplement.state === "calculated" ? supplement.weeks : 0;
      if (additional > 0)
        return {
          weeks: weeks + additional,
          note: `Podstawowe ${weeks} tyg. + ${additional} tyg. po weryfikacji hospitalizacji przez gminę`,
        };
      return { weeks, note: "Podstawowy okres wypłaty świadczenia" };
    }
  }
  if (procedure.id === "SUPPLEMENTARY_MATERNITY_LEAVE") {
    const result = calculateSupplement(profile, asOf);
    if (result.state === "calculated" && result.weeks > 0)
      return { weeks: result.weeks, note: "Wymiar na podstawie podanych okresów pobytu" };
  }
}

export function evaluateProcedure(
  profile: Profile,
  procedure: Procedure,
  asOf: string,
): ProcedureResult {
  if (!parseDate(asOf)) throw new RangeError("Data oceny musi mieć format RRRR-MM-DD.");
  const result: ProcedureResult = {
    procedure,
    status: "possible",
    missingFields: [],
    matchedConditions: [],
    reasons: [],
    documents: [],
    deadlines: [],
    amounts: [],
    audit: { evaluatedAt: asOf, rulesetVersion: version.rulesetVersion },
  };

  if (!isCurrent(procedure.validity, asOf) || asOf < version.verifiedAt) {
    result.reasons.push({
      id: "validity",
      text: "Wymaga sprawdzenia przepisów dla wybranej daty. Ten katalog ocenia sytuacje od 17 listopada 2026 r.",
      sources: procedure.sources,
    });
    return result;
  }
  if (!profile.stage) return { ...result, status: "missing-data", missingFields: ["stage"] };
  if (profile.stage === "born" && procedure.phase === "pregnancy")
    return { ...result, status: "not-relevant" };

  const future = profile.stage === "pregnant" && procedure.phase !== "pregnancy";
  const missing = new Set<Field>();
  let failed = false;
  let needsReview = Boolean(procedure.review);
  const outcomeFor = (id: string) => evaluateCondition(id, profile, asOf);

  if (!future && profile.stage === "born") {
    const birth = parseDate(profile.birthDate);
    if (!birth || profile.birthDate! > asOf) missing.add("birthDate");
  }
  for (const id of procedure.conditions) {
    if (future && id !== "employee") continue;
    const condition = conditions[id];
    const outcome = outcomeFor(id);
    if (outcome.state === "unknown") {
      outcome.fields.forEach((field) => missing.add(field));
      continue;
    }
    if (outcome.state === "yes") result.matchedConditions.push(id);
    if (outcome.state === "no") failed = true;
    if (outcome.state === "review") needsReview = true;
    result.reasons.push({
      id,
      sources: condition.sources,
      text:
        outcome.state === "review"
          ? outcome.reason
          : outcome.state === "yes"
            ? condition.pass
            : condition.fail,
    });
  }

  const status: EvaluationStatus = failed
    ? "not-relevant"
    : future
      ? "possible"
      : missing.size
        ? "missing-data"
        : needsReview
          ? "possible"
          : "relevant";
  result.status = status;
  result.missingFields = [...missing];

  if (future)
    result.reasons.push({
      id: "future",
      text: "To element planu na okres po narodzinach lub do omówienia przed porodem. Warunki zostaną ocenione po podaniu danych o urodzeniu.",
      sources: procedure.sources,
    });
  if (procedure.review && !failed && !future)
    result.reasons.push({ id: "review", text: procedure.review, sources: procedure.sources });

  result.documents = procedure.documents.flatMap(({ id, when, note }) => {
    if (!isCurrent(documents[id].validity, asOf)) return [];
    const states = (when ?? []).map((condition) =>
      future ? "unknown" : outcomeFor(condition).state,
    );
    if (states.includes("no")) return [];
    return [
      {
        id,
        note,
        state: states.every((state) => state === "yes") && !future ? "applicable" : "conditional",
      },
    ];
  });

  result.deadlines = future
    ? procedure.deadlines
    : procedure.deadlines.map((deadline) => evaluateDeadline(deadline, profile, asOf));
  result.amounts = (procedure.amounts ?? []).filter((id) => {
    const amount = amounts[id];
    return (
      isCurrent(amount.validity, asOf) &&
      (future || !amount.when?.some((condition) => outcomeFor(condition).state === "no"))
    );
  });
  if (!failed && !future) result.duration = durationFor(procedure, profile, asOf);
  return result;
}

export function explainResult(result: ProcedureResult) {
  return {
    reasons: result.reasons,
    sourceIds: [
      ...new Set([
        ...result.procedure.sources,
        ...result.reasons.flatMap((reason) => reason.sources),
      ]),
    ],
  };
}
