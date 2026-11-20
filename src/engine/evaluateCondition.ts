import { conditions, reviewOnFailure } from "../data/conditions";
import { amounts } from "../data/references";
import type { Fact, Outcome } from "../types/catalog";
import type { Field, Profile } from "../types/profile";
import { addMonths, isCurrent, monthDistance, parseDate } from "./dates";
import { calculateSupplement } from "./prematurity";

const yes: Outcome = { state: "yes" };
const no: Outcome = { state: "no" };
const matches = (value: boolean): Outcome => (value ? yes : no);
const unknown = (...fields: Field[]): Outcome => ({ state: "unknown", fields });
const review = (reason: string): Outcome => ({ state: "review", reason });

function evaluateActivity(profile: Profile): Outcome {
  const {
    singleParent,
    workActive,
    otherWorkActive,
    contributionPercent,
    otherContributionPercent,
    preferentialContributions,
    otherPreferentialContributions,
  } = profile;
  if (workActive === false || (singleParent === false && otherWorkActive === false)) return no;
  if (singleParent === undefined) return unknown("singleParent");
  if (workActive === undefined) return unknown("workActive");
  if (!singleParent && otherWorkActive === undefined) return unknown("otherWorkActive");
  if (
    contributionPercent === undefined ||
    !Number.isFinite(contributionPercent) ||
    contributionPercent < 0
  )
    return unknown("contributionPercent");
  if (singleParent) return matches(contributionPercent >= 100);

  if (
    otherContributionPercent === undefined ||
    !Number.isFinite(otherContributionPercent) ||
    otherContributionPercent < 0
  )
    return unknown("otherContributionPercent");
  if (
    contributionPercent < 30 ||
    otherContributionPercent < 30 ||
    contributionPercent + otherContributionPercent < 100
  )
    return no;
  if (contributionPercent < 50 && preferentialContributions === undefined)
    return unknown("preferentialContributions");
  if (otherContributionPercent < 50 && otherPreferentialContributions === undefined)
    return unknown("otherPreferentialContributions");
  return matches(
    contributionPercent >= (preferentialContributions ? 30 : 50) &&
      otherContributionPercent >= (otherPreferentialContributions ? 30 : 50),
  );
}

function evaluateFact(fact: Fact, profile: Profile, asOf: string): Outcome {
  switch (fact.kind) {
    case "answer": {
      const value = profile[fact.field];
      return value === undefined ? unknown(fact.field) : matches(value === fact.value);
    }
    case "number": {
      const value = profile[fact.field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
        return unknown(fact.field);
      return matches(
        (fact.min === undefined || value >= fact.min) &&
          (fact.max === undefined || value <= fact.max),
      );
    }
    case "age": {
      const birth = parseDate(profile.birthDate);
      const evaluation = parseDate(asOf);
      if (!birth || !evaluation || birth > evaluation) return unknown("birthDate");
      if (fact.unit === "cutoff") return matches(evaluation < addMonths(birth, fact.through));
      const month = monthDistance(birth, evaluation);
      return matches(month >= (fact.from ?? 0) && month <= fact.through);
    }
    case "activity":
      return evaluateActivity(profile);
    case "component":
      if (profile.activeComponent === undefined) return unknown("activeComponent");
      return matches(
        profile.activeComponent === "none" || profile.activeComponent === fact.component,
      );
    case "nursery-limit": {
      const limit = amounts.nurseryFee;
      if (!isCurrent(limit.validity, asOf))
        return review("Wymaga sprawdzenia limit opłaty za pobyt obowiązujący w ocenianym okresie.");
      const fee = profile.nurseryFee;
      if (fee === undefined || !Number.isFinite(fee) || fee < 0) return unknown("nurseryFee");
      if (fee === 0)
        return review("Przy braku opłaty za pobyt dofinansowanie nie przekroczy 0 zł.");
      return matches(fee <= limit.value);
    }
    case "household-income": {
      const { familyIncomePerPerson, familyChildDisability } = profile;
      if (
        familyIncomePerPerson === undefined ||
        !Number.isFinite(familyIncomePerPerson) ||
        familyIncomePerPerson < 0
      )
        return unknown("familyIncomePerPerson");
      if (
        familyIncomePerPerson > 674 &&
        familyIncomePerPerson <= 764 &&
        familyChildDisability === undefined
      )
        return unknown("familyChildDisability");
      if (familyIncomePerPerson <= (familyChildDisability ? 764 : 674)) return yes;
      return review(
        "Dochód przekracza podstawowy próg. Gmina sprawdzi kwotę świadczenia według zasady „złotówka za złotówkę”.",
      );
    }
    case "supplement": {
      const supplement = calculateSupplement(profile, asOf);
      return supplement.state === "calculated" ? matches(supplement.weeks > 0) : supplement;
    }
  }
}

export function evaluateCondition(id: string, profile: Profile, asOf: string): Outcome {
  const condition = conditions[id];
  const outcome = evaluateFact(condition.fact, profile, asOf);
  if (outcome.state === "no" && reviewOnFailure.has(id)) return review(condition.fail);
  return outcome;
}
