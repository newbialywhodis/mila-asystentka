import type { Validity } from "../types/catalog";

const dayMilliseconds = 86_400_000;

export function normalizeNumericDate(text: string): string | undefined {
  const value = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = value.match(/^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/);
  if (parts) {
    const [, day, , month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
}

export function parseDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = new Date(value + "T00:00:00Z");
  if (Number.isFinite(date.getTime()) && isoDate(date) === value) return date;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * dayMilliseconds);
}

export function addMonths(date: Date, months: number): Date {
  const target = new Date(date);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months + 1);
  target.setUTCDate(0);
  target.setUTCDate(Math.min(target.getUTCDate(), date.getUTCDate()));
  return target;
}

export function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / dayMilliseconds;
}

export function monthDistance(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  );
}

export function isCurrent(validity: Validity | undefined, asOf: string): boolean {
  return (
    (!validity?.from || validity.from <= asOf) && (!validity?.through || validity.through >= asOf)
  );
}

export function warsawToday(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return [part("year"), part("month"), part("day")].join("-");
}
