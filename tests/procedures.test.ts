import assert from "node:assert/strict";
import test from "node:test";
import { procedures } from "../src/data/procedures";
import { evaluateProcedure, explainResult } from "../src/engine/evaluateProcedure";
import { generatePlan } from "../src/engine/plan";
import type { EvaluationStatus } from "../src/types/catalog";
import type { Profile } from "../src/types/profile";

const asOf = "2026-11-17";
const baby = {
  stage: "born",
  birthDate: "2026-11-07",
  childrenBorn: 1,
  livesInPoland: true,
  standardResidence: true,
} satisfies Profile;
const toddler = {
  ...baby,
  birthDate: "2025-05-28",
  workActive: true,
  otherWorkActive: true,
  singleParent: false,
  nursery: false,
  activeComponent: "none",
} satisfies Profile;
const employee = { employment: "employee" } satisfies Profile;
const pregnancy = { stage: "pregnant", ...employee } satisfies Profile;
const hospital = {
  ...baby,
  hospitalized: true,
  gestationalWeeks: 27,
  birthWeightGrams: 920,
  hospitalStays: [{ from: "2026-11-07", through: "2026-11-17" }],
} satisfies Profile;

type Scenario = [id: string, input: Profile, expected: EvaluationStatus];
const scenarios: Scenario[] = [
  ["EMPLOYMENT_PREGNANCY_PROTECTION", pregnancy, "possible"],
  ["EMPLOYMENT_PREGNANCY_PROTECTION", { ...pregnancy, employment: "contract" }, "not-relevant"],
  ["EMPLOYMENT_PREGNANCY_PROTECTION", { stage: "pregnant" }, "missing-data"],
  [
    "SICKNESS_PREGNANCY",
    {
      ...pregnancy,
      sicknessLeave: true,
      sicknessInsurance: true,
      sicknessQualifyingPeriod: true,
      pregnancyCertificate: true,
    },
    "relevant",
  ],
  ["SICKNESS_PREGNANCY", { ...pregnancy, sicknessLeave: false }, "not-relevant"],
  ["SICKNESS_PREGNANCY", { ...pregnancy, sicknessLeave: true }, "missing-data"],
  ["BIRTH_REGISTRATION", { ...baby, birthRegistered: false }, "relevant"],
  ["BIRTH_REGISTRATION", { ...baby, birthRegistered: true }, "not-relevant"],
  ["BIRTH_REGISTRATION", baby, "missing-data"],
  ["CHILD_HEALTH_INSURANCE", { ...baby, healthRegistered: false, healthTitle: true }, "relevant"],
  ["CHILD_HEALTH_INSURANCE", { ...baby, healthRegistered: true }, "not-relevant"],
  ["CHILD_HEALTH_INSURANCE", { ...baby, healthRegistered: false }, "missing-data"],
  ["MATERNITY_LEAVE", { ...baby, ...employee }, "relevant"],
  ["MATERNITY_LEAVE", { ...baby, employment: "business" }, "not-relevant"],
  ["MATERNITY_LEAVE", baby, "missing-data"],
  ["MATERNITY_ALLOWANCE", { ...baby, employment: "business", insuredAtBirth: true }, "relevant"],
  ["MATERNITY_ALLOWANCE", { ...baby, employment: "contract" }, "missing-data"],
  ["MATERNITY_ALLOWANCE", { ...baby, insuredAtBirth: false }, "possible"],
  ["PARENTAL_LEAVE", { ...baby, ...employee }, "relevant"],
  ["PARENTAL_LEAVE", { ...baby, employment: "contract" }, "not-relevant"],
  ["PARENTAL_LEAVE", baby, "missing-data"],
  ["SUPPLEMENTARY_MATERNITY_LEAVE", { ...hospital, ...employee }, "relevant"],
  ["SUPPLEMENTARY_MATERNITY_LEAVE", { ...baby, ...employee, hospitalized: false }, "not-relevant"],
  [
    "SUPPLEMENTARY_MATERNITY_LEAVE",
    { ...hospital, ...employee, hospitalStays: undefined },
    "missing-data",
  ],
  ["CHILD_800_PLUS", baby, "relevant"],
  ["CHILD_800_PLUS", { ...baby, birthDate: "2008-11-17" }, "not-relevant"],
  ["CHILD_800_PLUS", { ...baby, livesInPoland: undefined }, "missing-data"],
  ["PARENTAL_BENEFIT", { ...baby, receivesMaternity: false }, "possible"],
  ["PARENTAL_BENEFIT", { ...baby, receivesMaternity: true }, "not-relevant"],
  ["PARENTAL_BENEFIT", baby, "missing-data"],
  [
    "BIRTH_GRANT_BECIKOWE",
    { ...baby, familyIncomePerPerson: 1922, medicalCareWeek10: true },
    "possible",
  ],
  [
    "BIRTH_GRANT_BECIKOWE",
    { ...baby, familyIncomePerPerson: 1922.01, medicalCareWeek10: true },
    "not-relevant",
  ],
  ["BIRTH_GRANT_BECIKOWE", { ...baby, medicalCareWeek10: true }, "missing-data"],
  [
    "ACTIVE_PARENT_WORK",
    { ...toddler, contributionPercent: 50, otherContributionPercent: 50 },
    "relevant",
  ],
  ["ACTIVE_PARENT_WORK", { ...toddler, workActive: false }, "not-relevant"],
  ["ACTIVE_PARENT_WORK", toddler, "missing-data"],
  [
    "ACTIVE_PARENT_NURSERY",
    { ...toddler, nursery: true, nurseryRegistered: true, nurseryFee: 2200 },
    "possible",
  ],
  [
    "ACTIVE_PARENT_NURSERY",
    { ...toddler, nursery: true, nurseryRegistered: true, nurseryFee: 2200.01 },
    "not-relevant",
  ],
  ["ACTIVE_PARENT_NURSERY", { ...toddler, nursery: true, nurseryRegistered: true }, "missing-data"],
  ["ACTIVE_PARENT_HOME", { ...toddler, legacyRko: false }, "relevant"],
  ["ACTIVE_PARENT_HOME", { ...baby, legacyRko: false }, "not-relevant"],
  ["ACTIVE_PARENT_HOME", toddler, "missing-data"],
  ["PATERNITY_LEAVE", { ...baby, otherParentEmployment: "employee" }, "possible"],
  ["PATERNITY_LEAVE", { ...baby, otherParentEmployment: "contract" }, "not-relevant"],
  ["PATERNITY_LEAVE", baby, "missing-data"],
  ["CARE_ALLOWANCE", { ...baby, careNeeded: true, sicknessInsurance: true }, "possible"],
  ["CARE_ALLOWANCE", { ...baby, careNeeded: false, sicknessInsurance: true }, "not-relevant"],
  ["CARE_ALLOWANCE", { ...baby, careNeeded: true }, "missing-data"],
  ["CHILDCARE_LEAVE", { ...baby, ...employee, employedSixMonths: true }, "possible"],
  ["CHILDCARE_LEAVE", { ...baby, ...employee, employedSixMonths: false }, "not-relevant"],
  ["CHILDCARE_LEAVE", { ...baby, ...employee }, "missing-data"],
  ["FAMILY_ALLOWANCE", { ...baby, familyIncomePerPerson: 650 }, "possible"],
  ["FAMILY_ALLOWANCE", { ...baby, familyIncomePerPerson: 900 }, "possible"],
  ["FAMILY_ALLOWANCE", baby, "missing-data"],
  ["CHILD_TAX_RELIEF", { ...baby, parentUsesTaxScale: true }, "possible"],
  ["CHILD_TAX_RELIEF", { ...baby, parentUsesTaxScale: false }, "not-relevant"],
  ["CHILD_TAX_RELIEF", baby, "missing-data"],
];

const evaluate = (id: string, input: Profile, date = asOf) =>
  evaluateProcedure(
    input,
    procedures.find((procedure) => procedure.id === id)!,
    date,
  );

scenarios.forEach(([id, input, expected], index) => {
  test(`${id} → ${expected} (${index + 1})`, () => {
    const result = evaluate(id, input);
    assert.equal(result.status, expected);
    if (expected === "relevant") {
      assert.ok(result.matchedConditions.length > 0);
      assert.ok(explainResult(result).sourceIds.length > 0);
    }
    if (expected === "missing-data") assert.ok(result.missingFields.length > 0);
  });
});

test("dokumenty płatnika i rola ZUS zależą od statusu zatrudnienia", () => {
  const input = { ...baby, insuredAtBirth: true, zusPays: true };
  const forms = (profile: Profile) =>
    evaluate("MATERNITY_ALLOWANCE", profile).documents.map(({ id }) => id);
  assert.ok(forms({ ...input, ...employee }).includes("Z-3"));
  assert.ok(forms({ ...input, employment: "contract" }).includes("Z-3a"));
  assert.ok(!forms({ ...input, employment: "business" }).some((id) => id.startsWith("Z-3")));
  assert.ok(!forms({ ...input, zusPays: false }).includes("ZAM"));
});

test("osobne świadczenia w programie Aktywny Rodzic i konflikt aktywności", () => {
  const profile = {
    ...toddler,
    activeComponent: "work",
    workActive: false,
    legacyRko: false,
  } as const;
  const plan = generatePlan(Object.freeze(profile), asOf);
  assert.deepEqual(
    plan.conflicts.map(({ fields }) => fields),
    [["workActive", "activeComponent"]],
  );
  assert.equal(evaluate("ACTIVE_PARENT_HOME", profile).status, "possible");
  assert.deepEqual(plan, generatePlan(profile, asOf));
});

test("po wygaśnięciu limit żłobkowy nie rozstrzyga dopasowania", () => {
  const result = evaluate(
    "ACTIVE_PARENT_NURSERY",
    { ...toddler, nursery: true, nurseryRegistered: true, nurseryFee: 2300 },
    "2027-04-01",
  );
  assert.equal(result.status, "possible");
  assert.ok(!result.amounts.includes("nurseryFee"));
});

test("okres Aktywnego Rodzica zaczyna się od miesiąca ukończenia 12 miesięcy", () => {
  const result = evaluate("ACTIVE_PARENT_HOME", {
    ...toddler,
    birthDate: "2025-11-30",
    legacyRko: false,
  });
  assert.equal(result.status, "relevant");
});
