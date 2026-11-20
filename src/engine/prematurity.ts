import type { Profile, Field } from "../types/profile";
import { daysBetween, parseDate } from "./dates";

type Supplement =
  | { state: "unknown"; fields: Field[] }
  | { state: "review"; reason: string }
  | { state: "calculated"; weeks: number };

type Interval = { from: number; through: number };

function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  for (const interval of intervals.sort((a, b) => a.from - b.from)) {
    const previous = merged.at(-1);
    if (previous && interval.from <= previous.through + 1) {
      previous.through = Math.max(previous.through, interval.through);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function hospitalIntervals(
  stays: NonNullable<Profile["hospitalStays"]>,
  birth: Date,
  today: Date,
): Interval[] | undefined {
  const intervals: Interval[] = [];
  for (const stay of stays) {
    const from = parseDate(stay.from);
    const through = parseDate(stay.through);
    if (!from || !through || from < birth || through < from || through > today) return;
    intervals.push({ from: daysBetween(birth, from), through: daysBetween(birth, through) });
  }
  return mergeIntervals(intervals);
}

function eligibleDays(intervals: Interval[], early: boolean, premature: boolean): number {
  const firstDay = early || premature ? 0 : 5;
  const lastDay = early ? 105 : 56;
  const qualifyingPair = intervals.some(
    ({ from, through }) => Math.max(from, 5) <= Math.min(through - 1, 28),
  );
  if (!early && !premature && !qualifyingPair) return 0;
  return intervals.reduce((total, { from, through }) => {
    return total + Math.max(0, Math.min(through, lastDay) - Math.max(from, firstDay) + 1);
  }, 0);
}

export function calculateSupplement(profile: Profile, asOf: string): Supplement {
  if (profile.hospitalized === false) return { state: "calculated", weeks: 0 };
  if (profile.hospitalized === undefined) return { state: "unknown", fields: ["hospitalized"] };

  const birth = parseDate(profile.birthDate);
  const today = parseDate(asOf);
  const { childrenBorn, gestationalWeeks, birthWeightGrams, hospitalStays } = profile;
  if (!birth || !today || birth > today) return { state: "unknown", fields: ["birthDate"] };
  if (!childrenBorn) return { state: "unknown", fields: ["childrenBorn"] };
  if (childrenBorn > 1) {
    return {
      state: "review",
      reason:
        "Przy porodzie mnogim trzeba uwzględnić najniższą masę urodzeniową i najdłuższą hospitalizację. Przygotuj zaświadczenia dla organu ustalającego wymiar.",
    };
  }
  if (
    gestationalWeeks === undefined ||
    gestationalWeeks < 0 ||
    gestationalWeeks > 45 ||
    !Number.isInteger(gestationalWeeks)
  ) {
    return { state: "unknown", fields: ["gestationalWeeks"] };
  }
  if (
    birthWeightGrams === undefined ||
    !Number.isFinite(birthWeightGrams) ||
    birthWeightGrams <= 0
  ) {
    return { state: "unknown", fields: ["birthWeightGrams"] };
  }
  if (!hospitalStays?.length) return { state: "unknown", fields: ["hospitalStays"] };
  const intervals = hospitalIntervals(hospitalStays, birth, today);
  if (!intervals) return { state: "unknown", fields: ["hospitalStays"] };

  const early = gestationalWeeks < 28 || birthWeightGrams <= 1000;
  const premature = gestationalWeeks < 37;
  const days = eligibleDays(intervals, early, premature);
  return { state: "calculated", weeks: Math.min(early ? 15 : 8, Math.ceil(days / 7)) };
}
