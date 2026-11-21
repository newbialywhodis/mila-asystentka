import { addDays, daysBetween, isoDate, parseDate } from "../../engine/dates";
import { assessBenefit } from "../../engine/parent-benefit";
import type { BenefitResult, DemoRate } from "../../engine/parent-benefit";
import { applyCaseFacts, emptyParentCase, formatDay, formatDays } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey, ParentCase } from "../../engine/parent-case";
import type { HelpAnswer } from "../guide/helpAnswers";
import type { DocumentData } from "./case-documents";
import { fields } from "./case-fields";
import type { CaseRequest } from "./case-message";
import type { CaseGoal, CaseTool } from "./parent-intent";

export type CaseQuestion = { key: FactKey; text: string; hint?: string };
export type CaseAnswer = { question: CaseQuestion; field: FactKey };

export type AttachedDocument = {
  kind: "document";
  file: File;
  preview: string;
  mode: "local" | "read" | "demo";
};

export type BenefitChoice = { kind: "chooseBenefit"; goal: CaseGoal; text: string };
export type AssessmentTurn = {
  kind: "assessment";
  benefit: Benefit;
  result: BenefitResult;
  insured?: boolean;
  goal: CaseGoal;
  question?: CaseQuestion;
  deferred?: true;
  text: string;
};

export type CaseTurn =
  | { kind: "user"; text: string; local?: boolean; answer?: CaseAnswer }
  | { kind: "note"; text: string }
  | { kind: "help"; answer: HelpAnswer }
  | { kind: "tool"; tool: CaseTool; text: string }
  | { kind: "propose"; benefit: Benefit; goal: CaseGoal; facts: CaseFacts; text: string }
  | AttachedDocument
  | BenefitChoice
  | AssessmentTurn;

export type CaseSession = {
  family: ParentCase;
  benefit: Benefit | null;
  goal: CaseGoal;
  asOf: string;
  turns: CaseTurn[];
  answered: CaseAnswer[];
  demoRate?: DemoRate;
};

export function newSession(): CaseSession {
  return {
    family: emptyParentCase,
    benefit: null,
    goal: "calculation",
    asOf: "",
    turns: [],
    answered: [],
  };
}

export function append(session: CaseSession, ...turns: CaseTurn[]): CaseSession {
  return { ...session, turns: [...session.turns, ...turns] };
}

export function selectBenefit(session: CaseSession, benefit: Benefit): CaseSession {
  if (!session.benefit || session.benefit === benefit) return { ...session, benefit };
  return {
    ...session,
    benefit,
    answered: [],
    family: applyCaseFacts(session.family, {
      from: undefined,
      through: undefined,
      requestedDays: undefined,
      insured: undefined,
      documentDate: undefined,
      standardRate: undefined,
      averagedRequest: undefined,
    }),
  };
}

export function saveFacts(session: CaseSession, facts: CaseFacts, sources?: ParentCase["sources"]) {
  const previous = session.family.facts;
  const patch = { ...facts };
  const previousStage =
    previous.birthStage ?? (previous.birth ? "born" : previous.dueDate ? "expected" : undefined);
  const stage = patch.birth ? "born" : patch.dueDate ? "expected" : patch.birthStage;
  if (stage) {
    patch.birthStage = stage;
    if (stage === "born") patch.dueDate = undefined;
    else patch.birth = undefined;
  }
  if (patch.averagedRequest) patch.standardRate = undefined;
  else if (patch.standardRate === true) patch.averagedRequest = undefined;
  if (patch.through !== undefined) patch.requestedDays = undefined;
  else if (patch.requestedDays !== undefined) patch.through = undefined;

  const stageChanged =
    stage !== undefined && previousStage !== undefined && stage !== previousStage;
  if (stageChanged && session.benefit === "maternity") {
    for (const key of [
      "children",
      "from",
      "through",
      "requestedDays",
      "documentDate",
      "averagedRequest",
      "standardRate",
      "exception",
      "insured",
      "payer",
      "insuredHeadcount",
      "basis",
      "fixedSalary",
      "debt",
      "debtPaid",
    ] as const) {
      if (!(key in patch)) patch[key] = undefined;
    }
  }
  const employmentChanged = "employment" in facts && facts.employment !== previous.employment;
  const coverageChanged =
    session.benefit === "maternity" || session.benefit === "lossMaternity"
      ? ("birth" in patch && patch.birth !== previous.birth) ||
        ("dueDate" in patch && patch.dueDate !== previous.dueDate)
      : "from" in facts && facts.from !== previous.from;
  if ((employmentChanged || coverageChanged) && !("insured" in patch)) patch.insured = undefined;
  if (
    session.benefit === "maternity" &&
    previous.dueDate &&
    "dueDate" in patch &&
    patch.dueDate !== previous.dueDate
  ) {
    for (const key of ["debt", "debtPaid", "insuredHeadcount"] as const) {
      if (!(key in patch)) patch[key] = undefined;
    }
  }
  if (employmentChanged) {
    for (const key of [
      "payer",
      "insuredHeadcount",
      "debt",
      "debtPaid",
      "basis",
      "fixedSalary",
    ] as const) {
      if (!(key in patch)) patch[key] = undefined;
    }
  }
  const family = applyCaseFacts(session.family, patch, sources);
  return {
    ...session,
    family,
    answered: session.answered.filter(
      ({ field }) => family.facts[field] !== undefined && family.facts[field] === previous[field],
    ),
  };
}

export function saveQuestionAnswer(
  session: CaseSession,
  question: CaseQuestion,
  facts: CaseFacts,
  sources?: ParentCase["sources"],
) {
  const patch = { ...facts };
  if (question.key === "basis") {
    if (patch.fixedSalary !== undefined) patch.basis = undefined;
    else if (patch.basis !== undefined) patch.fixedSalary = undefined;
  }
  if (question.key === "payer" && patch.insuredHeadcount !== undefined) patch.payer = undefined;
  const next = saveFacts(session, patch, sources);
  const field = Object.keys(facts)[0] as FactKey | undefined;
  if (!field || getAssessment(next)?.question?.key === question.key) return next;
  return {
    ...next,
    answered: [
      ...next.answered.filter((step) => step.question.key !== question.key),
      { question, field },
    ],
  };
}

export function getAssessment(session: CaseSession): AssessmentTurn | undefined {
  const { benefit, family, asOf, goal, demoRate } = session;
  if (!benefit) return;
  const result = assessBenefit(benefit, family.facts, asOf, demoRate);
  const missing =
    goal === "application" && result.status === "eligible"
      ? result.documents.length
        ? undefined
        : "payer"
      : result.missing;
  const question: CaseQuestion | undefined = missing && {
    key: missing,
    text: questionText(missing, result, session),
    hint:
      result.status === "missing" && result.reason !== "Potrzebuję jeszcze jednej informacji."
        ? result.reason
        : missing === "from" && family.facts.requestedDays !== undefined
          ? "Możesz wpisać np. „7 grudnia”. Bez roku przyjmę najbliższy taki dzień."
          : fields[missing].hint,
  };
  const text =
    question?.text ??
    (goal === "application" && result.documents.length
      ? "Sprawdź, co przygotować, gdzie złożyć wniosek i do kiedy."
      : result.status === "eligible"
        ? "Mam wynik dla podanych danych."
        : result.reason);
  return {
    kind: "assessment",
    benefit,
    goal,
    result,
    insured: result.coverageDay ? family.facts.insured : undefined,
    question,
    text,
  };
}

const periodNames: Partial<Record<Benefit, string>> = {
  paternity: " ojcowskiego",
  parental: " rodzicielskiego",
  sickness: " chorobowego w ciąży",
  rehabilitation: " świadczenia rehabilitacyjnego",
};

function questionText(key: FactKey, result: BenefitResult, session: CaseSession) {
  const { requestedDays } = session.family.facts;
  if (key === "from" && requestedDays !== undefined && session.benefit) {
    return `Sprawdzę ${formatDays(requestedDays)}${periodNames[session.benefit] ?? ""}. Od kiedy chcesz zacząć?`;
  }
  if (key === "insured" && result.coverageDay) {
    const date = formatDay(result.coverageDay);
    return result.projected || result.coverageDay > session.asOf
      ? `Czy zakładasz, że ${date} będziesz mieć ubezpieczenie chorobowe?`
      : `Czy ${date} obejmowało Cię ubezpieczenie chorobowe?`;
  }
  if (result.projected) {
    if (key === "children") return "Ilu dzieci się spodziewasz?";
    if (key === "basis") return "Jaką podstawę wymiaru zasiłku przyjąć do prognozy?";
    if (key === "payer") return "Kto będzie wypłacał zasiłek?";
    if (key === "debt") return "Jakie saldo składek przyjąć w prognozie na dzień porodu?";
  }
  return fields[key].question;
}

export function appendAssessment(session: CaseSession, showRequestedPeriod = false): CaseSession {
  const assessment = getAssessment(session);
  if (!assessment) return askBenefit(session, session.goal);
  if (
    showRequestedPeriod &&
    assessment.question &&
    !assessment.result.period &&
    assessment.question.key !== "through" &&
    assessment.question.key !== "requestedDays"
  ) {
    const { from, through, requestedDays } = session.family.facts;
    const start = parseDate(from);
    const end =
      parseDate(through) ??
      (start && requestedDays !== undefined ? addDays(start, requestedDays - 1) : undefined);
    if (start && end && start <= end) {
      const range = formatDay(isoDate(start)) + " do " + formatDay(isoDate(end));
      const length = formatDays(daysBetween(start, end) + 1);
      assessment.text = `Sprawdzę okres od ${range} (${length}). ${assessment.text}`;
    }
  }
  return append(session, assessment);
}

export function askBenefit(session: CaseSession, goal: CaseGoal): CaseSession {
  return append(session, {
    kind: "chooseBenefit",
    goal,
    text:
      goal === "application"
        ? "Do którego świadczenia potrzebujesz dokumentów?"
        : "Które świadczenie chcesz sprawdzić?",
  });
}

export function getBenefitTurn(session: CaseSession): BenefitChoice | AssessmentTurn | undefined {
  return session.turns.findLast(
    (turn) => turn.kind === "chooseBenefit" || turn.kind === "assessment",
  );
}

export function continueWithRequest(session: CaseSession, request: CaseRequest, text: string) {
  const { benefit, facts } = request;
  const current = getBenefitTurn(session);
  const goal =
    request.goal ??
    (current?.kind === "chooseBenefit" || benefit === session.benefit
      ? (current?.goal ?? session.goal)
      : "calculation");
  const next = saveFacts({ ...selectBenefit(session, benefit), goal }, facts);
  return appendAssessment(
    append(next, { kind: "user", text, local: true }),
    facts.from !== undefined || facts.through !== undefined || facts.requestedDays !== undefined,
  );
}

export function continueWithDocument(
  session: CaseSession,
  document: AttachedDocument,
  data?: DocumentData,
) {
  if (session.turns.at(-1) !== document) return session;
  if (data?.benefit && session.benefit && data.benefit !== session.benefit) return session;

  const current = getBenefitTurn(session);
  const unanswered = current?.kind === "chooseBenefit" || (current?.question && !current.deferred);
  // Put the new attachment above the pending prompt without repeating the question.
  const next =
    unanswered && session.turns.at(-2) === current
      ? { ...session, turns: [...session.turns.slice(0, -2), document] }
      : session;
  const saved = data
    ? saveFacts({ ...next, benefit: session.benefit ?? data.benefit }, data.facts, data.sources)
    : next;
  if (current?.kind === "chooseBenefit" && !data?.benefit) return askBenefit(saved, current.goal);
  return appendAssessment({ ...saved, goal: current?.goal ?? saved.goal });
}

export const toolMessages: Record<CaseTool, string> = {
  documents:
    "Dodaj wypełniony wniosek lub zaświadczenie w PDF. Możesz wykorzystać dane z pliku w tej rozmowie.",
  plan: "Porównajmy podział opieki i powrót do pracy dla tej samej rodziny.",
  facts: "Tu możesz sprawdzić i poprawić dane, z których korzystam.",
  examples: "Wybierz fikcyjną sprawę, żeby zobaczyć obliczenie i kolejne kroki.",
  support: "Możesz sprawdzić formalności lub zobaczyć, kto oferuje wsparcie.",
  services: "Tutaj możesz wypróbować usługi na danych demonstracyjnych.",
  rules: "Tutaj możesz porównać wynik przed demonstracyjną zmianą stawki i po niej.",
  formalities: "Zebrałam formalności, które mogą dotyczyć Twojej rodziny.",
};
