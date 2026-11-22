import assert from "node:assert/strict";
import { test } from "node:test";
import { assessBenefit, benefitMoney } from "../src/engine/parent-benefit";
import type { CaseFacts } from "../src/engine/parent-case";
import { compareParentalPlans } from "../src/engine/parent-plan";
import { contributionBasis, payrollBasis } from "../src/engine/payroll-basis";

const today = "2026-11-22";
const employment = {
  employment: "employee",
  insured: true,
  standardRate: true,
  payer: "employer",
  basis: 600_000,
} satisfies CaseFacts;
const family = { birth: "2026-03-01", children: 1 } satisfies CaseFacts;
const parentalFacts = {
  ...employment,
  ...family,
  from: "2026-07-19",
  requestedDays: 70,
  careCertificate: false,
  parts: 0,
  usedDays: 0,
  otherParentDays: 0,
  soleParent: false,
  reserved: false,
} satisfies CaseFacts;

test("art. 30 ustawy zasiłkowej rozróżnia świadczenia przed porodem i po porodzie", () => {
  const facts = {
    ...employment,
    ...family,
    termination: "employerClosed",
    employmentEnded: "2026-02-10",
    alternativeEmployment: false,
    pregnancyProof: true,
  } satisfies CaseFacts;
  const untilBirth = assessBenefit("pregnancyAfterEmployment", facts, today);
  assert.deepEqual(untilBirth.period, { from: "2026-02-11", through: "2026-02-28", days: 18 });
  assert.equal(untilBirth.money?.total, 360_000);
  assert.equal(untilBirth.payer, "zus");
  assert.match(untilBirth.documents[0].title, /ZAS-55/);
  assert.equal(
    assessBenefit("pregnancyAfterEmployment", { ...facts, alternativeEmployment: true }, today)
      .status,
    "ineligible",
  );
  assert.equal(
    assessBenefit("pregnancyAfterEmployment", { ...facts, termination: "unlawful" }, today).status,
    "ineligible",
  );
  const afterBirth = assessBenefit(
    "maternity",
    { ...facts, termination: "unlawful", insured: false },
    today,
  );
  assert.equal(afterBirth.period?.days, 140);
  assert.equal(afterBirth.money?.total, 2_800_000);
  assert.equal(afterBirth.payer, "zus");
});

test("14 tygodni po porodzie pozwala przejąć pozostałe 42 dni, a pobyt w szpitalu ma odrębny wymiar", () => {
  const facts = {
    ...employment,
    ...family,
    transferReason: "return",
    motherDaysBeforeBirth: 0,
    motherDaysAfterBirth: 98,
    personalCare: true,
  } satisfies CaseFacts;
  const father = assessBenefit("maternityTransfer", facts, today);
  assert.deepEqual(father.period, { from: "2026-06-07", through: "2026-07-18", days: 42 });
  assert.equal(father.money?.total, 840_000);
  assert.equal(
    assessBenefit("maternityTransfer", { ...facts, motherDaysAfterBirth: 97 }, today).status,
    "ineligible",
  );
  const hospital = assessBenefit(
    "maternityTransfer",
    {
      ...facts,
      transferReason: "hospital",
      transferEvent: "2026-04-24",
      transferThrough: "2026-05-02",
      motherDaysAfterBirth: 56,
    },
    today,
  );
  assert.deepEqual(hospital.period, { from: "2026-04-26", through: "2026-05-02", days: 7 });
  assert.equal(hospital.money?.total, 140_000);
  assert.equal(
    assessBenefit("maternityTransfer", { ...facts, insured: false }, today).status,
    "ineligible",
  );
});

test("macierzyński przed porodem zaczyna się najwcześniej 42 dni przed przewidywaną datą", () => {
  const facts = {
    ...employment,
    children: 1,
    birthStage: "expectedEarly",
    dueDate: "2026-12-13",
  } satisfies CaseFacts;
  assert.equal(assessBenefit("maternity", facts, today).missing, "from");
  assert.equal(assessBenefit("maternity", { ...facts, from: "2026-10-31" }, today).missing, "from");
  const result = assessBenefit("maternity", { ...facts, from: "2026-11-01" }, today);
  assert.equal(result.coverageDay, "2026-11-01");
  assert.deepEqual(result.period, { from: "2026-11-01", through: "2027-03-20", days: 140 });
});

test("po zgonie jedynego dziecka zachowuje prawo przez siedem dni po dniu zgonu", () => {
  const result = assessBenefit(
    "lossMaternity",
    { ...employment, ...family, childDeath: "2026-07-16" },
    today,
  );
  assert.equal(result.period?.through, "2026-07-23");
  const twins = assessBenefit(
    "lossMaternity",
    { ...employment, ...family, children: 2, survivingChildren: 1, childDeath: family.birth },
    today,
  );
  assert.equal(twins.period?.days, 140);
});

test("ojcowski po przysposobieniu respektuje obydwa ograniczenia, a z pieczy można przejść do adopcji", () => {
  const facts = {
    ...employment,
    birth: "2012-12-03",
    from: "2026-11-26",
    requestedDays: 7,
    adoptionFinal: "2026-01-17",
    paternityUsed: "none",
  } satisfies CaseFacts;
  assert.equal(assessBenefit("adoptivePaternity", facts, today).money?.total, 140_000);
  assert.equal(
    assessBenefit("adoptivePaternity", { ...facts, from: "2026-11-27" }, today).status,
    "ineligible",
  );
  const adoption = assessBenefit(
    "careMaternity",
    {
      ...employment,
      birth: "2022-10-10",
      children: 2,
      sameCareAgeLimit: true,
      careKind: "adoption",
      careAccepted: "2026-10-01",
      courtApplication: "2026-11-01",
      from: "2026-11-05",
      previousCareBenefit: true,
      previousCareDays: 70,
    },
    today,
  );
  assert.equal(adoption.period?.days, 147);
});

test("pół etatu także w wydłużeniu daje dodatkowe 70 dni i 70 zł dziennie", () => {
  const result = assessBenefit(
    "parental",
    { ...parentalFacts, workPercent: 50, extensionWorkPercent: 50, employmentPercent: 100 },
    today,
  );
  assert.equal(result.money?.total, 490_000);
  assert.equal(result.extensionDays, 70);
  assert.deepEqual(result.extension, {
    through: "2026-12-05",
    workPercent: 50,
    money: { basis: 600_000, daily: 7000, total: 490_000 },
  });
});

test("przy pieczy nad dwojgiem dzieci po osiągnięciu granicy wieku wymiar odpowiada liczbie uprawnionych dzieci", () => {
  const facts = {
    ...employment,
    birth: "2019-01-03",
    from: "2025-10-02",
    careAccepted: "2025-10-02",
    careKind: "foster",
    children: 2,
    sameCareAgeLimit: false,
    previousCareBenefit: false,
    careChildren: [
      { birth: "2019-01-03", schoolDeferral: false },
      { birth: "2021-04-14", schoolDeferral: false },
    ],
  } satisfies CaseFacts;
  // Przypadek z pkt 124 komentarza ZUS przesunięty o trzy lata.
  const result = assessBenefit("careMaternity", facts, today);
  assert.deepEqual(result.period, { from: "2025-10-02", through: "2026-02-18", days: 140 });
  assert.equal(result.money?.total, 2_800_000);
});

test("porównanie dwóch rodziców używa tylko odrębnych danych drugiej osoby", () => {
  const facts = { ...parentalFacts, debt: 0 };
  const options = {
    start: parentalFacts.from,
    weeks: 10,
    otherWeeks: 9,
    otherBasis: 450_000,
    otherEmployment: "business",
    otherInsured: true,
    otherDebt: 4807,
    together: true,
    workPercent: 0,
  } as const;
  assert.equal(compareParentalPlans(facts, options, today)?.adjusted.first.money?.total, 980_000);
  assert.equal(compareParentalPlans(facts, options, today)?.adjusted.second.status, "ineligible");
  assert.equal(
    compareParentalPlans(facts, { ...options, otherDebt: 4806 }, today)?.adjusted.second.money
      ?.total,
    661_500,
  );
  assert.equal(
    compareParentalPlans(facts, { ...options, otherInsured: false, otherDebt: 0 }, today)?.adjusted
      .second.status,
    "review",
  );
});

test("chorobowe liczy wyczekiwanie, okres po ustaniu oraz dzień przejścia na macierzyński", () => {
  const facts = {
    from: "2026-10-02",
    through: "2026-10-31",
    birth: "2026-10-30",
    employment: "contract",
    employmentEnded: "2026-10-01",
    insured: false,
    illnessStart: "2026-10-02",
    postInsuranceExcluded: false,
    qualifyingDays: 90,
    pregnancyProof: true,
    sickDaysUsed: 0,
    basis: 600_000,
  } satisfies CaseFacts;
  assert.equal(
    assessBenefit("sickness", { ...facts, qualifyingDays: 89 }, today).missing,
    "waitingException",
  );
  assert.equal(
    assessBenefit("sickness", { ...facts, through: "2026-10-30" }, today).status,
    "ineligible",
  );
  const result = assessBenefit("sickness", facts, today);
  assert.equal(result.period?.days, 28);
  assert.equal(result.money?.total, 560_000);
  assert.equal(result.payer, "zus");
});

test("podstawa z listy płac uzupełnia zmienne i pomija miesiąc poniżej połowy", () => {
  const first = {
    basePay: 500_000,
    regularVariable: 10_000,
    actualVariable: 5000,
    workDays: 10,
    requiredDays: 20,
  };
  const second = { ...first, basePay: 400_000, workDays: 9 };
  // 5000 zł + 200 zł uzupełnionej premii + 50 zł bez uzupełnienia + (1200 zł + 600 zł) / 12.
  assert.equal(payrollBasis([first, second], 120_000, 60_000), 540_000);
  assert.equal(payrollBasis([{ ...first, workDays: 0 }], 0, 0), undefined);
  assert.equal(benefitMoney(287_633, 8000, 1).daily, 7670);
});

test("zmiana puli z datą obowiązywania wpływa na rzeczywisty dostępny wymiar", () => {
  const change = { parental: 8000, singleChildWeeks: 19, from: parentalFacts.from };
  assert.equal(assessBenefit("parental", parentalFacts, today, change).maximumDays, 70);
  assert.equal(assessBenefit("parental", parentalFacts, today, change).money?.total, 1_120_000);
  assert.equal(
    assessBenefit("parental", { ...parentalFacts, requestedDays: 71 }, today, change).status,
    "missing",
  );
  assert.equal(
    assessBenefit("parental", parentalFacts, today, { ...change, from: "2026-07-20" }).maximumDays,
    224,
  );
});

test("art. 48a rozkłada nadwyżkę deklaracji na 12 miesięcy i dolicza poprzedni tytuł", () => {
  // 4000 zł + 4000 zł średniej nadwyżki × 2/12, a przy 4 wcześniejszych miesiącach × 6/12.
  assert.equal(
    contributionBasis(800_000, { minimum: 400_000, currentMonths: 2, priorMonths: 0 }),
    466_667,
  );
  assert.equal(
    contributionBasis(800_000, { minimum: 400_000, currentMonths: 2, priorMonths: 4 }),
    600_000,
  );
  assert.equal(contributionBasis(700_000), 700_000);
  assert.equal(
    contributionBasis(350_000, { minimum: 400_000, currentMonths: 1, priorMonths: 0 }),
    undefined,
  );
});
