import type { ActiveComponent, Field, Profile } from "./profile";

export interface Validity {
  from?: string;
  through?: string;
}

export interface Source {
  authority: "ZUS" | "ELI" | "gov.pl" | "PIP" | "NFZ" | "MF";
  title: string;
  url: string;
  snapshotUrl?: string;
  type: "law" | "procedure" | "form" | "guidance";
  verifiedAt: string;
}

export type DocumentKind =
  | "pdf-form"
  | "online-wizard"
  | "employer-document"
  | "payer-document"
  | "statement"
  | "medical-certificate"
  | "legal-act"
  | "information-page";

export interface Document {
  title: string;
  code?: string;
  kind: DocumentKind;
  actor: string;
  source: string;
  validity?: Validity;
}

export interface DocumentRequirement {
  id: string;
  when?: string[];
  note?: string;
}

export type AmountUnit = "monthly" | "once" | "percent-base" | "monthly-ceiling";
export interface Amount {
  value: number;
  unit: AmountUnit;
  label: string;
  sources: string[];
  validity?: Validity;
  when?: string[];
}

type DateField = {
  [K in Field]: NonNullable<Profile[K]> extends string
    ? string extends NonNullable<Profile[K]>
      ? K
      : never
    : never;
}[Field];
export type DateRule =
  | { type: "offset"; field: DateField; value: number; unit: "days" | "months" }
  | { type: "yearly"; opens: [number, number]; closes: [number, number]; clock?: "800-period" }
  | { type: "guidance" };

export interface Deadline {
  id: string;
  title: string;
  rule: DateRule;
  consequence: string;
  sources: string[];
}

export type Phase = "pregnancy" | "birth" | "later";
export type Category = "zus" | "work" | "municipal" | "registration" | "health" | "tax";
export interface Procedure {
  id: string;
  title: string;
  summary: string;
  authority: string;
  category: Category;
  phase: Phase;
  conditions: string[];
  documents: DocumentRequirement[];
  deadlines: Deadline[];
  amounts?: string[];
  sources: string[];
  steps: string[];
  review?: string;
  component?: ActiveComponent;
  validity?: Validity;
}

export type Outcome =
  | { state: "yes" | "no" }
  | { state: "unknown"; fields: Field[] }
  | { state: "review"; reason: string };

export type Fact =
  | { kind: "answer"; field: Field; value: boolean | string }
  | { kind: "number"; field: Field; min?: number; max?: number }
  | { kind: "age"; from?: number; through: number; unit: "months" | "cutoff" }
  | { kind: "component"; component: ActiveComponent }
  | { kind: "activity" | "nursery-limit" | "supplement" | "household-income" };

export interface Condition {
  fact: Fact;
  pass: string;
  fail: string;
  sources: string[];
}

export interface Question {
  label: string;
  hint?: string;
  input: "choice" | "date" | "number" | "hospital";
  options?: readonly { label: string; value: string | boolean | number }[];
  min?: number;
  max?: number;
  integer?: boolean;
}

export type EvaluationStatus = "relevant" | "possible" | "missing-data" | "not-relevant";
export type DeadlineResult = Deadline & { opens?: string; date?: string; missingField?: Field };

export interface ProcedureResult {
  procedure: Procedure;
  status: EvaluationStatus;
  missingFields: Field[];
  matchedConditions: string[];
  reasons: { id: string; text: string; sources: string[] }[];
  documents: { id: string; state: "applicable" | "conditional"; note?: string }[];
  deadlines: DeadlineResult[];
  amounts: string[];
  duration?: { weeks: number; note: string };
  audit: { evaluatedAt: string; rulesetVersion: string };
}
