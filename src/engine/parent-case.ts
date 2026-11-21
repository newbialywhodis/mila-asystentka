import { z } from "zod";
import { parseDate } from "./dates";

export const benefits = [
  "maternity",
  "paternity",
  "parental",
  "supplement",
  "sickness",
  "rehabilitation",
  "careMaternity",
  "lossMaternity",
] as const;
export const employmentTypes = ["employee", "contract", "business", "collaborator"] as const;
export const benefitSchema = z.enum(benefits);
export type Benefit = z.infer<typeof benefitSchema>;
const date = z.iso.date().refine((value) => parseDate(value) !== undefined);
const money = z.number().int().min(0).max(100_000_000);
const positiveMoney = money.min(1);
export const caseFactsSchema = z.strictObject({
  birthStage: z.enum(["born", "expected"]),
  birth: date,
  dueDate: date,
  from: date,
  through: date,
  requestedDays: z.number().int().min(1).max(938),
  employment: z.enum(employmentTypes),
  insured: z.boolean(),
  exception: z.boolean(),
  children: z.number().int().min(1).max(20),
  careKind: z.enum(["adoption", "foster", "professional"]),
  courtApplication: date,
  schoolDeferral: z.boolean(),
  previousCareBenefit: z.boolean(),
  basis: positiveMoney,
  fixedSalary: positiveMoney,
  payer: z.enum(["zus", "employer"]),
  insuredHeadcount: z.number().int().min(1).max(10_000_000),
  debt: money,
  debtPaid: date,
  otherParentDays: z.number().int().min(0).max(938),
  usedDays: z.number().int().min(0).max(938),
  parts: z.number().int().min(0).max(5),
  careCertificate: z.boolean(),
  soleParent: z.boolean(),
  reserved: z.boolean(),
  averagedRequest: date,
  standardRate: z.boolean(),
  paternityUsed: z.enum(["none", "week", "full"]),
  workPercent: z.number().int().min(0).max(50),
  employmentPercent: z.number().int().min(1).max(100),
  qualifying: z.boolean(),
  pregnancyProof: z.boolean(),
  sickDaysUsed: z.number().int().min(0).max(270),
  rehabMedical: z.boolean(),
  rehabUsed: z.number().int().min(0).max(360),
  employerSickPayEnded: z.boolean(),
  gestationalWeeks: z.number().int().min(0).max(45),
  birthWeightGrams: z.number().int().positive().max(8000),
  hospitalFrom: date,
  hospitalThrough: date,
  documentDate: date,
});
export const casePatchSchema = caseFactsSchema.partial();
export type CaseFacts = z.infer<typeof casePatchSchema>;
export type FactKey = keyof CaseFacts;
export type FactSource = { label: string; page?: number };
export type ParentCase = {
  facts: CaseFacts;
  sources: Partial<Record<FactKey, FactSource>>;
};

export const labels: Record<Benefit, string> = {
  maternity: "Zasiłek macierzyński",
  paternity: "Zasiłek za okres ojcowskiego",
  parental: "Zasiłek za okres rodzicielskiego",
  supplement: "Uzupełniający macierzyński",
  sickness: "Zasiłek chorobowy w ciąży",
  rehabilitation: "Świadczenie rehabilitacyjne w ciąży",
  careMaternity: "Zasiłek po przyjęciu dziecka na wychowanie",
  lossMaternity: "Zasiłek po martwym urodzeniu",
};

export const employmentLabels: Record<(typeof employmentTypes)[number], string> = {
  employee: "Umowa o pracę",
  contract: "Umowa zlecenia",
  business: "Działalność",
  collaborator: "Osoba współpracująca",
};

export const emptyParentCase: ParentCase = { facts: {}, sources: {} };

export function applyCaseFacts(
  current: ParentCase,
  facts: CaseFacts,
  sources: ParentCase["sources"] = {},
): ParentCase {
  const next = { facts: { ...current.facts }, sources: { ...current.sources } };
  for (const key of Object.keys(facts) as FactKey[]) {
    const value = facts[key];
    if (value === undefined) {
      delete next.facts[key];
      delete next.sources[key];
    } else {
      Object.assign(next.facts, { [key]: value });
      next.sources[key] = sources[key] ?? { label: "Potwierdzone w rozmowie" };
    }
  }
  return next;
}

export function moneyLabel(cents: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(cents / 100);
}

export function formatDay(iso: string) {
  return iso.split("-").reverse().join(".");
}

export function formatDays(days: number) {
  return days === 1 ? "1 dzień" : days + " dni";
}
