import { addDays, isoDate, parseDate } from "./dates";
import { assessBenefit, parentalPool } from "./parent-benefit";
import type { DemoRate } from "./parent-benefit";
import type { CaseFacts } from "./parent-case";

export type PlanOptions = {
  start: string;
  weeks: number;
  otherWeeks: number;
  otherBasis: number;
  together: boolean;
  workPercent: number;
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
  if (oneDays + twoDays > parentalPool(facts.children, facts.careCertificate)) return;
  const common = { ...facts, soleParent: false };
  const previousParts = facts.parts ?? 0;
  const firstUsed = facts.usedDays ?? 0;
  const secondUsed = facts.otherParentDays ?? 0;

  function compare(from: Date, workPercent: number, together: boolean) {
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
        employmentPercent: facts.employmentPercent ?? 100,
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
        ...common,
        employment: "employee",
        insured: true,
        exception: false,
        from: isoDate(secondFrom),
        through: isoDate(secondThrough),
        parts: previousParts + 1,
        usedDays: secondUsed,
        otherParentDays: firstUsed + oneDays,
        basis: options.otherBasis,
        payer: undefined,
        fixedSalary: undefined,
        standardRate: true,
        averagedRequest: undefined,
        documentDate: undefined,
        reserved: false,
        workPercent: 0,
      },
      asOf,
      demoRate,
    );
    let firstTotal = first.money?.total;
    if (first.money && extensionDays) {
      const extension = assessBenefit(
        "parental",
        {
          ...common,
          from: isoDate(addDays(firstThrough, 1)),
          through: isoDate(extended),
          parts: previousParts,
          usedDays: firstUsed,
          otherParentDays: secondUsed + twoDays,
          reserved: false,
          workPercent: 0,
        },
        asOf,
        demoRate,
      );
      // The extension keeps the reduced daily payment from the period worked.
      firstTotal =
        extension.status === "eligible"
          ? first.money.total + first.money.daily * extensionDays
          : undefined;
    }
    return {
      first,
      second,
      firstTotal,
      last: isoDate(extended > secondThrough ? extended : secondThrough),
    };
  }
  return {
    standard: compare(start, 0, false),
    adjusted: compare(start, options.workPercent, options.together),
  };
}
