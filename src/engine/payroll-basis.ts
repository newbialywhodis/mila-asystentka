type PayrollMonth = {
  basePay: number;
  regularVariable: number;
  actualVariable: number;
  workDays: number;
  requiredDays: number;
};

function isMoney(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000;
}

export function payrollBasis(
  months: PayrollMonth[],
  quarterly: number,
  annual: number,
): number | undefined {
  if (!months.length || months.length > 12) return;
  if (!isMoney(quarterly) || !isMoney(annual)) return;
  if (
    months.some(
      ({ basePay, regularVariable, actualVariable, workDays, requiredDays }) =>
        !isMoney(basePay) ||
        !isMoney(regularVariable) ||
        !isMoney(actualVariable) ||
        !Number.isInteger(workDays) ||
        !Number.isInteger(requiredDays) ||
        workDays < 0 ||
        workDays > requiredDays ||
        requiredDays < 1 ||
        requiredDays > 31,
    )
  )
    return;
  // Art. 38 ustawy zasiłkowej. When every month is incomplete, supplement
  // them all. A variable amount with no worked days needs comparable pay.
  const regularMonths = months.filter(({ workDays, requiredDays }) => workDays * 2 >= requiredDays);
  const included = regularMonths.length ? regularMonths : months;
  if (included.some(({ workDays }) => workDays === 0)) return;
  const total = included.reduce(
    (sum, { basePay, regularVariable, actualVariable, workDays, requiredDays }) =>
      sum + basePay + Math.round((regularVariable * requiredDays) / workDays) + actualVariable,
    0,
  );
  const basis = Math.round(total / included.length + (quarterly + annual) / 12);
  return basis > 0 && isMoney(basis) ? basis : undefined;
}

export function contributionBasis(
  average: number,
  declared?: { minimum: number; currentMonths: number; priorMonths: number },
) {
  if (!isMoney(average) || average === 0) return;
  if (!declared) return average;
  const { minimum, currentMonths, priorMonths } = declared;
  const months = currentMonths + priorMonths;
  if (
    !isMoney(minimum) ||
    minimum === 0 ||
    minimum > average ||
    !Number.isInteger(currentMonths) ||
    currentMonths < 1 ||
    !Number.isInteger(priorMonths) ||
    priorMonths < 0 ||
    months > 12
  )
    return;
  return Math.round(minimum + ((average - minimum) * months) / 12);
}
