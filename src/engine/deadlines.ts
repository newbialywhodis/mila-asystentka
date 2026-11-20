import type { Deadline, DeadlineResult } from "../types/catalog";
import type { Profile } from "../types/profile";
import { addDays, addMonths, isoDate, parseDate } from "./dates";

function calendarDate(year: number, [month, day]: [number, number]): string {
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

export function evaluateDeadline(
  deadline: Deadline,
  profile: Profile,
  asOf: string,
): DeadlineResult {
  const { rule } = deadline;
  if (rule.type === "guidance") return deadline;

  if (rule.type === "yearly") {
    const year = Number(asOf.slice(0, 4));
    const target = asOf > calendarDate(year, rule.closes) ? year + 1 : year;
    return {
      ...deadline,
      opens: calendarDate(target, rule.opens),
      date: calendarDate(target, rule.closes),
    };
  }

  const trigger = parseDate(profile[rule.field]);
  if (!trigger) return { ...deadline, missingField: rule.field };
  const date = rule.unit === "days" ? addDays(trigger, rule.value) : addMonths(trigger, rule.value);
  return { ...deadline, date: isoDate(date) };
}
