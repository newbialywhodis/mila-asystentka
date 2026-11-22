import { addDays, isoDate, parseDate } from "./dates";
import { assessBenefit, parentalPool } from "./parent-benefit";
import type { DemoRate } from "./parent-benefit";
import type { CaseFacts } from "./parent-case";

export type PlanOptions = {
  start: string;
  weeks: number;
  otherWeeks: number;
  otherBasis: number;
  otherEmployment: NonNullable<CaseFacts["employment"]>;
  otherInsured: boolean;
  otherDebt?: number;
  together: boolean;
  workPercent: number;
  employmentPercent?: number;
  extensionWorkPercent?: number;
  maternity?: {
    motherDays: number;
    motherInsured: boolean;
    fatherInsured: boolean;
    motherDebt?: number;
    fatherDebt?: number;
  };
};

export function compareParentalPlans(
  facts: CaseFacts,
  options: PlanOptions,
  asOf: string,
  demoRate?: DemoRate,
) {
  const start = parseDate(options.start);
  if (
    !start ||
    !facts.children ||
    !facts.birth ||
    facts.careCertificate === undefined ||
    !Number.isInteger(options.weeks) ||
    options.weeks < 1 ||
    !Number.isInteger(options.otherWeeks) ||
    options.otherWeeks < 1 ||
    !Number.isInteger(options.workPercent) ||
    options.workPercent < 0 ||
    options.workPercent > 50 ||
    !Number.isSafeInteger(options.otherBasis) ||
    options.otherBasis <= 0 ||
    options.otherBasis > 100_000_000
  )
    return;
  const oneDays = options.weeks * 7;
  const twoDays = options.otherWeeks * 7;
  const override =
    demoRate && options.start >= demoRate.from ? demoRate.singleChildWeeks : undefined;
  if (oneDays + twoDays > parentalPool(facts.children, facts.careCertificate, override)) return;
  const common = { ...facts, soleParent: false };
  const previousParts = facts.parts ?? 0;
  const firstUsed = facts.usedDays ?? 0;
  const secondUsed = facts.otherParentDays ?? 0;
  const otherFinances = {
    employment: options.otherEmployment,
    insured: options.otherInsured,
    debt: options.otherDebt,
    basis: options.otherBasis,
  };
  const birth = parseDate(facts.birth);
  const maternity = options.maternity;
  const motherFacts: CaseFacts = {
    birth: facts.birth,
    children: facts.children,
    employment: facts.employment,
    insured: maternity?.motherInsured,
    debt: maternity?.motherDebt,
    basis: facts.basis,
    standardRate: facts.standardRate,
    averagedRequest: facts.averagedRequest,
  };
  const fullMaternity = maternity && assessBenefit("maternity", motherFacts, asOf);
  const splitMaternity = maternity &&
    birth && {
      mother: assessBenefit(
        "maternity",
        {
          ...motherFacts,
          through: isoDate(addDays(birth, maternity.motherDays - 1)),
        },
        asOf,
      ),
      father: assessBenefit(
        "maternityTransfer",
        {
          ...otherFinances,
          insured: maternity.fatherInsured,
          debt: maternity.fatherDebt,
          birth: facts.birth,
          children: facts.children,
          motherDaysBeforeBirth: 0,
          motherDaysAfterBirth: maternity.motherDays,
          personalCare: true,
          transferReason: "return",
        },
        asOf,
      ),
    };

  function compare(
    from: Date,
    workPercent: number,
    extensionWorkPercent: number,
    together: boolean,
  ) {
    const firstThrough = addDays(from, oneDays - 1);
    const first = assessBenefit(
      "parental",
      {
        ...common,
        from: options.start,
        through: isoDate(firstThrough),
        parts: previousParts,
        usedDays: firstUsed,
        otherParentDays: secondUsed + twoDays,
        reserved: false,
        workPercent,
        extensionWorkPercent,
        employmentPercent: options.employmentPercent ?? facts.employmentPercent,
      },
      asOf,
      demoRate,
    );
    const extensionDays = first.extensionDays ?? 0;
    const extended = addDays(firstThrough, extensionDays);
    const secondFrom = together ? from : addDays(extended, 1);
    const secondThrough = addDays(secondFrom, twoDays - 1);
    const second = assessBenefit(
      "parental",
      {
        birth: facts.birth,
        children: facts.children,
        careCertificate: facts.careCertificate,
        soleParent: false,
        ...otherFinances,
        from: isoDate(secondFrom),
        through: isoDate(secondThrough),
        parts: previousParts + 1,
        usedDays: secondUsed,
        otherParentDays: firstUsed + oneDays,
        standardRate: true,
        reserved: false,
        workPercent: 0,
      },
      asOf,
      demoRate,
    );
    const firstTotal = first.money && first.money.total + (first.extension?.money?.total ?? 0);
    return {
      first,
      second,
      firstTotal,
      last: isoDate(extended > secondThrough ? extended : secondThrough),
    };
  }
  return {
    fullMaternity,
    splitMaternity,
    standard: compare(start, 0, 0, false),
    adjusted: compare(
      start,
      options.workPercent,
      options.extensionWorkPercent ?? 0,
      options.together,
    ),
  };
}
