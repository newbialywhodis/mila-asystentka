import { addDays, daysBetween, isoDate, parseDate, warsawToday } from "../../engine/dates";
import { assessBenefit } from "../../engine/parent-benefit";
import { compareParentalPlans } from "../../engine/parent-plan";
import { createInterviewSession, applyConfirmedFacts } from "./interview-session";
import type { InterviewSession } from "./interview-session";
import {
  assessmentIdSchema,
  documentIdSchema,
  confirmedValue,
  isoDateSchema,
} from "./family-session";
import type { AssessmentId, AssessmentTarget, FactSource } from "./family-session";
import { toCaseFacts } from "./interview-profile";
import { dependencyStamp, refreshSnapshots } from "./result-snapshots";
import type { QuestionRef, QuestionTarget } from "./interview";
import type { Field } from "../../types/profile";
import type { DiscoveryAction } from "../../data/discovery";
import type { BenefitResult, DemoRate } from "../../engine/parent-benefit";
import { formatDay, formatDays } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey, ParentCase } from "../../engine/parent-case";
import type { HelpAnswer } from "../guide/helpAnswers";
import type { DocumentData } from "./case-documents";
import { fields } from "./case-fields";
import type { CaseRequest } from "./case-message";
import { startingReply } from "./case-replies";
import type { PregnancyConcernTurn } from "./case-replies";
import type { CaseAction, CaseGoal, CaseReply, CaseTool } from "./parent-intent";

export type CaseQuestion = { key: FactKey; text: string; hint?: string };
export type CaseAnswer = { question: CaseQuestion; field: FactKey };
export type CareComparisonTurn = {
  kind: "compareCare";
  baseRevision?: number;
  text: string;
  facts: CaseFacts;
  asOf: string;
  demoRate?: DemoRate;
  workPercent: Extract<CaseAction, { kind: "compareCare" }>["workPercent"];
};

export type AttachedDocument = {
  kind: "document";
  file: File;
  preview: string;
  mode: "local" | "demo";
  documentId?: string;
};

export type BenefitChoice = { kind: "chooseBenefit"; goal: CaseGoal; text: string };
export type AssessmentTurn = {
  kind: "assessment";
  assessmentId?: AssessmentId;
  inputRevision?: number;
  snapshotInput?: CaseFacts;
  dependencyStamp?: string;
  demoRate?: DemoRate;
  benefit: Benefit;
  result: BenefitResult;
  insured?: boolean;
  goal: CaseGoal;
  question?: CaseQuestion;
  deferred?: true;
  text: string;
};

export type CaseTurn =
  | {
      kind: "user";
      text: string;
      local?: boolean;
      answer?: CaseAnswer;
      interviewAnswer?: QuestionTarget;
    }
  | { kind: "interview"; question?: QuestionRef; text: string }
  | { kind: "discovery"; text: string }
  | { kind: "scope"; text: string }
  | { kind: "procedure"; text: string; assessmentId: AssessmentId }
  | { kind: "note"; text: string }
  | CaseReply
  | PregnancyConcernTurn
  | { kind: "help"; answer: HelpAnswer }
  | { kind: "tool"; tool: CaseTool; text: string }
  | { kind: "propose"; benefit: Benefit; goal: CaseGoal; facts: CaseFacts; text: string }
  | CareComparisonTurn
  | AttachedDocument
  | BenefitChoice
  | AssessmentTurn;

export type CaseSession = {
  data: InterviewSession;
  activeAssessmentId?: AssessmentId;
  view: "start" | "interview" | "discovery" | "scope" | "calculator" | "procedure" | "choice";
  cursor?: BenefitChoice | AssessmentTurn;
  pendingDestination?: DiscoveryAction;
  procedureQuestion?: Field;
  procedureInstructions?: boolean;
  returnDocument?: AttachedDocument;
  documentTargets: Record<string, AssessmentId>;
  scopeTarget?: AssessmentTarget;
  tasks: string[];
  privacy: "standard" | "localDocuments";
  benefit: Benefit | null;
  goal: CaseGoal;
  asOf: string;
  turns: CaseTurn[];
  answered: CaseAnswer[];
  demoRate?: DemoRate;
};

export function newSession(id = crypto.randomUUID()): CaseSession {
  return {
    data: createInterviewSession(id, warsawToday()),
    view: "start",
    tasks: [],
    documentTargets: {},
    privacy: "standard",
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

export function appendCareComparison(
  session: CaseSession,
  workPercent: CareComparisonTurn["workPercent"],
): CaseSession {
  return append(session, {
    kind: "compareCare",
    baseRevision: session.data.contextRevision,
    text: "Porównajmy, jak podział rodzicielskiego i powrót do pracy wpłyną na zasiłek i datę końca urlopu.",
    facts: {
      ...getParentCase(session).facts,
      insured: undefined,
      debt: undefined,
      debtPaid: undefined,
    },
    asOf: session.asOf,
    demoRate: session.demoRate,
    workPercent,
  });
}

/** Compatibility selections are used before a check exists; the assessment owns execution context. */
export function getCaseContext(session: CaseSession) {
  const assessment = session.data.assessments.find((a) => a.id === session.activeAssessmentId);
  return assessment
    ? {
        benefit: assessment.kind === "calculator" ? assessment.benefit : null,
        goal: assessment.goal,
        asOf: assessment.asOf,
      }
    : { benefit: session.benefit, goal: session.goal, asOf: session.asOf || session.data.asOf };
}
export function setCaseGoal(session: CaseSession, goal: CaseGoal): CaseSession {
  return {
    ...session,
    goal,
    data: {
      ...session.data,
      assessments: session.data.assessments.map((a) =>
        a.id === session.activeAssessmentId ? { ...a, goal } : a,
      ),
    },
  };
}

export function assessmentTurnIsCurrent(session: CaseSession, turn: AssessmentTurn): boolean {
  if (!turn.assessmentId) return true;
  const assessment = session.data.assessments.find((a) => a.id === turn.assessmentId);
  if (!assessment || assessment.kind !== "calculator" || assessment.result?.state === "stale")
    return false;
  const projection = toCaseFacts(session.data, assessment.id);
  return (
    JSON.stringify(projection.value) === JSON.stringify(turn.snapshotInput) &&
    turn.dependencyStamp === dependencyStamp(projection.dependencies) &&
    (JSON.stringify(turn.demoRate) === JSON.stringify(session.demoRate) ||
      JSON.stringify(
        assessBenefit(turn.benefit, projection.value, assessment.asOf, session.demoRate),
      ) === JSON.stringify(turn.result))
  );
}

export function setSessionDemoRate(session: CaseSession, demoRate?: DemoRate): CaseSession {
  const data: InterviewSession = {
    ...session.data,
    contextRevision: session.data.contextRevision + 1,
    pendingOperation: undefined,
    assessments: session.data.assessments.map((a) => {
      if (!a.result || a.result.state === "stale") return a;
      if (a.kind === "calculator")
        return JSON.stringify(assessBenefit(a.benefit, a.result.input, a.asOf, demoRate)) ===
          JSON.stringify(a.result.result)
          ? a
          : { ...a, result: { ...a.result, state: "stale" } };
      if (a.kind === "comparison")
        return JSON.stringify(
          compareParentalPlans(a.result.input.facts, a.result.input.options, a.asOf, demoRate),
        ) === JSON.stringify(a.result.result)
          ? a
          : { ...a, result: { ...a.result, state: "stale" } };
      return a;
    }),
  };
  return { ...session, data, demoRate };
}

export function getParentCase(session: CaseSession): ParentCase {
  const facts = session.activeAssessmentId
    ? toCaseFacts(session.data, session.activeAssessmentId).value
    : {};
  const assessment = session.data.assessments.find((a) => a.id === session.activeAssessmentId);
  const sources: ParentCase["sources"] = {};
  for (const key of Object.keys(facts) as FactKey[]) {
    const detail =
      assessment?.kind === "calculator" && key in assessment.details
        ? assessment.details[key as keyof typeof assessment.details]
        : undefined;
    const target = assessment?.target;
    const subject = target?.subject;
    const person =
      subject?.kind === "person"
        ? session.data.persons.find((p) => p.id === subject.personId)
        : undefined;
    const title = person?.titles.find(
      (t) => subject?.kind === "person" && t.id === subject.titleId,
    );
    const child = session.data.family.children.find((c) => target?.childIds.includes(c.id));
    const sharedFact =
      key === "birth"
        ? child?.birth
        : key === "dueDate"
          ? session.data.family.dueDate
          : key === "children"
            ? session.data.family.childrenCount
            : key === "employment"
              ? title?.employment
              : undefined;
    const fact = detail || sharedFact;
    const source = fact && "source" in fact ? fact.source : undefined;
    if (source)
      sources[key] = {
        label:
          source.kind === "pdf"
            ? "Potwierdzone z PDF"
            : source.kind === "demo"
              ? source.label
              : "Potwierdzona odpowiedź",
        ...(source.kind === "pdf" ? { page: source.page } : {}),
      };
  }
  return { facts, sources };
}

export function selectBenefit(session: CaseSession, benefit: Benefit): CaseSession {
  const data = { ...session.data, asOf: isoDateSchema.parse(session.asOf || session.data.asOf) };
  const subject = data.navigation.activeSubject;
  if (!subject || subject.kind !== "person") return { ...session, data, benefit };
  const person = data.persons.find((p) => p.id === subject.personId);
  if (person && person.titles.length > 1 && !subject.titleId)
    return {
      ...session,
      data,
      benefit,
      activeAssessmentId: undefined,
      cursor: undefined,
      view: "scope",
      pendingDestination: { kind: "calculator", benefit },
    };
  const titleId =
    subject.titleId ?? (person?.titles.length === 1 ? person.titles[0].id : undefined);
  const target: AssessmentTarget = {
    eventId: data.family.event.id,
    subject: { ...subject, titleId },
    childIds: data.family.children.map((c) => c.id),
    ...(session.scopeTarget?.relatedPersonId
      ? { relatedPersonId: session.scopeTarget.relatedPersonId }
      : {}),
  };
  const existing = data.assessments.find(
    (a) =>
      a.kind === "calculator" &&
      a.benefit === benefit &&
      a.asOf === data.asOf &&
      a.target.subject.kind === "person" &&
      a.target.subject.personId === subject.personId &&
      a.target.subject.titleId === titleId &&
      JSON.stringify([...a.target.childIds].sort()) ===
        JSON.stringify([...target.childIds].sort()) &&
      (!a.target.relatedPersonId || a.target.relatedPersonId === target.relatedPersonId),
  );
  const id =
    existing?.id ??
    assessmentIdSchema.parse(`${data.id}:assessment:${data.assessments.length + 1}`);
  const stage = confirmedValue(data.family.stage);
  const stageDetail =
    stage === "pregnant"
      ? {
          birthStage: {
            state: "confirmed" as const,
            value: "expected" as const,
            revision: data.contextRevision,
            source: { kind: "answer" as const, via: "confirmation" as const },
            validTime: { kind: "undated" as const },
            basis: "observed" as const,
          },
        }
      : {};
  return {
    ...session,
    data: {
      ...data,
      assessments: existing
        ? data.assessments.map((a) => (a.id === id ? { ...a, state: "draft", target } : a))
        : [
            ...data.assessments,
            {
              id,
              target,
              asOf: data.asOf,
              inputRevision: data.contextRevision,
              goal: session.goal,
              state: "draft",
              kind: "calculator",
              benefit,
              details: stageDetail,
            },
          ],
    },
    activeAssessmentId: id,
    benefit,
    answered: session.activeAssessmentId === id ? session.answered : [],
    view: "calculator",
    cursor: undefined,
  };
}

export function saveFacts(
  session: CaseSession,
  facts: CaseFacts,
  sources?: ParentCase["sources"],
  provenance?: Partial<Record<FactKey, FactSource>>,
) {
  const previous = getParentCase(session).facts;
  const patch = { ...facts };
  const previousStage =
    previous.birthStage ?? (previous.birth ? "born" : previous.dueDate ? "expected" : undefined);
  const stage = patch.birth
    ? "born"
    : patch.dueDate
      ? previous.birthStage === "expectedEarly"
        ? "expectedEarly"
        : "expected"
      : patch.birthStage;
  if (stage) {
    patch.birthStage = stage;
    if (stage === "born") patch.dueDate = undefined;
    else patch.birth = undefined;
  }
  if (patch.averagedRequest) patch.standardRate = undefined;
  else if (patch.standardRate === true) patch.averagedRequest = undefined;
  if (patch.through !== undefined) patch.requestedDays = undefined;
  else if (patch.requestedDays !== undefined) patch.through = undefined;
  if (session.benefit === "rehabilitation") {
    if (patch.basis !== undefined) patch.rehabSickBasis = undefined;
    else if (patch.rehabSickBasis !== undefined) patch.basis = undefined;
  }

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
        ("dueDate" in patch && patch.dueDate !== previous.dueDate) ||
        ("from" in patch && patch.from !== previous.from)
      : session.benefit === "pregnancyAfterEmployment"
        ? "employmentEnded" in patch && patch.employmentEnded !== previous.employmentEnded
        : session.benefit === "maternityTransfer"
          ? (
              [
                "birth",
                "transferReason",
                "transferEvent",
                "motherDaysAfterBirth",
                "motherInsured",
              ] as const
            ).some((key) => key in patch && patch[key] !== previous[key])
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
      "rehabSickBasis",
      "rehabStart",
    ] as const) {
      if (!(key in patch)) patch[key] = undefined;
    }
  }
  let selected = session.activeAssessmentId
    ? session
    : session.benefit
      ? selectBenefit(session, session.benefit)
      : session;
  if (!selected.activeAssessmentId) return selected;
  const factSources: Partial<Record<FactKey, FactSource>> = {};
  for (const key of Object.keys(sources ?? {}) as FactKey[]) {
    const source = sources?.[key];
    if (source)
      factSources[key] = source.page
        ? { kind: "pdf", documentId: documentIdSchema.parse(source.label), page: source.page }
        : { kind: "demo", label: source.label };
  }
  const written = applyConfirmedFacts(selected.data, {
    kind: "caseFacts",
    baseRevision: selected.data.contextRevision,
    assessmentId: selected.activeAssessmentId,
    facts: patch,
    sources: provenance ?? factSources,
  });
  if (!written.ok)
    return append(selected, {
      kind: "note",
      text: "Nie zapisano tych danych. Najpierw ustal osobę, tytuł oraz właściwy dzień lub okres. Możesz uzupełnić aktywne pytanie i wrócić do dokumentu.",
    });
  selected = { ...selected, data: refreshSnapshots(written.session), cursor: undefined };
  const family = getParentCase(selected);
  return {
    ...selected,
    answered: selected.answered.filter(
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
  if (question.key === "qualifying" && patch.qualifyingDays !== undefined)
    patch.qualifying = undefined;
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
  const { benefit, asOf, goal } = getCaseContext(session);
  const { demoRate } = session;
  const family = getParentCase(session);
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
    assessmentId: session.activeAssessmentId,
    inputRevision: session.data.assessments.find((a) => a.id === session.activeAssessmentId)
      ?.inputRevision,
    snapshotInput: structuredClone(family.facts),
    dependencyStamp: session.activeAssessmentId
      ? dependencyStamp(toCaseFacts(session.data, session.activeAssessmentId).dependencies)
      : undefined,
    demoRate,
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
  const { requestedDays } = getParentCase(session).facts;
  if (key === "from" && requestedDays !== undefined && session.benefit) {
    return `Sprawdzę ${formatDays(requestedDays)}${periodNames[session.benefit] ?? ""}. Od kiedy chcesz zacząć?`;
  }
  if (key === "employment" && result.coverageDay)
    return `Jaka forma pracy dotyczy tego tytułu na ${formatDay(result.coverageDay)}? Potwierdź zakres dla tego dnia.`;
  if (key === "insured" && result.coverageDay) {
    const date = formatDay(result.coverageDay);
    return result.projected || result.coverageDay > session.asOf
      ? `Czy zakładasz, że ${date} będziesz mieć ubezpieczenie chorobowe?`
      : `Czy ${date} obejmowało Cię ubezpieczenie chorobowe?`;
  }
  if (key === "basis" && session.benefit === "rehabilitation") {
    return "Jaka jest podstawa świadczenia rehabilitacyjnego ustalona przez płatnika, po uwzględnieniu ewentualnej waloryzacji?";
  }
  if (key === "employmentEnded" && session.benefit === "rehabilitation") {
    return "Jaki był ostatni dzień ubezpieczenia chorobowego z tego tytułu?";
  }
  if (key === "maternityEnd" && session.benefit === "supplement") {
    return "Jaki jest ostatni dzień macierzyńskiego albo urlopu na warunkach macierzyńskiego, po którym ma się zacząć uzupełniający?";
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
    const { from, through, requestedDays } = getParentCase(session).facts;
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
  const a = session.data.assessments.find((a) => a.id === session.activeAssessmentId);
  const data =
    a?.kind === "calculator"
      ? {
          ...session.data,
          assessments: session.data.assessments.map((item) =>
            item.id === a.id
              ? {
                  ...a,
                  result: {
                    assessmentId: a.id,
                    input: structuredClone(getParentCase(session).facts),
                    result: structuredClone(assessment.result),
                    dependencies: [],
                    projectionDependencies: toCaseFacts(session.data, a.id).dependencies,
                    asOf: a.asOf,
                    assessedAt: new Date().toISOString(),
                    engineVersion: "parent-benefit:stage3-v1",
                    demoRate: session.demoRate,
                    state: "current" as const,
                    explanation: assessment.result.reason,
                  },
                }
              : item,
          ),
        }
      : session.data;
  return append({ ...session, data, cursor: assessment, view: "calculator" }, assessment);
}

export function askBenefit(session: CaseSession, goal: CaseGoal): CaseSession {
  const choice: BenefitChoice = {
    kind: "chooseBenefit",
    goal,
    text:
      goal === "application"
        ? "Do którego świadczenia potrzebujesz dokumentów?"
        : "Które świadczenie chcesz sprawdzić?",
  };
  return append({ ...session, view: "choice", cursor: choice }, choice);
}

export function getBenefitTurn(session: CaseSession): BenefitChoice | AssessmentTurn | undefined {
  return session.cursor;
}

export function continueWithRequest(session: CaseSession, request: CaseRequest, text: string) {
  const { benefit, facts } = request;
  const current = getBenefitTurn(session);
  const goal =
    request.goal ??
    (current?.kind === "chooseBenefit" || benefit === session.benefit
      ? (current?.goal ?? session.goal)
      : "calculation");
  const next = saveFacts(setCaseGoal(selectBenefit(session, benefit), goal), facts);
  return appendAssessment(
    append(next, { kind: "user", text, local: true }),
    facts.from !== undefined || facts.through !== undefined || facts.requestedDays !== undefined,
  );
}

export function continueWithAssessment(
  session: CaseSession,
  action: Extract<CaseAction, { kind: "assess" }>,
): CaseSession {
  const current = getBenefitTurn(session);
  const choosing = current?.kind === "chooseBenefit";
  const benefit = action.benefit ?? (choosing ? null : session.benefit);
  if (!benefit) return append(session, startingReply);

  const goal = choosing && action.goal === "calculation" ? current.goal : action.goal;
  const next = setCaseGoal(selectBenefit(session, benefit), goal);
  const facts = Object.fromEntries(
    Object.entries(action.facts).filter(
      ([key, value]) => getParentCase(next).facts[key as FactKey] !== value,
    ),
  );
  if (Object.keys(facts).length) {
    return append(session, {
      kind: "propose",
      benefit,
      goal,
      facts,
      text: "Czy dobrze zrozumiałam? Potwierdź dane, żebym mogła sprawdzić świadczenie.",
    });
  }
  if (action.benefit === null && goal === session.goal) return append(session, startingReply);
  return appendAssessment(next);
}

export function continueWithDocument(
  session: CaseSession,
  document: AttachedDocument,
  data?: DocumentData,
) {
  if (session.turns.at(-1) !== document) return session;
  if (
    data &&
    (data.baseRevision !== session.data.contextRevision ||
      data.assessmentId !== session.activeAssessmentId)
  )
    return session;
  if (data?.benefit && session.benefit && data.benefit !== session.benefit) return session;

  const current = getBenefitTurn(session);
  const unanswered = current?.kind === "chooseBenefit" || (current?.question && !current.deferred);
  // Put the new attachment above the pending prompt without repeating the question.
  const next =
    unanswered && session.turns.at(-2) === current
      ? { ...session, turns: [...session.turns.slice(0, -2), document] }
      : session;
  const saved = data
    ? saveFacts(
        { ...next, benefit: session.benefit ?? data.benefit },
        data.facts,
        data.sources,
        Object.fromEntries(
          Object.entries(data.sources).map(([key, source]) => [
            key,
            {
              kind: "pdf",
              documentId: documentIdSchema.parse(document.documentId || "local-document"),
              page: source?.page ?? 1,
            },
          ]),
        ),
      )
    : next;
  if (current?.kind === "chooseBenefit" && !data?.benefit) return askBenefit(saved, current.goal);
  return appendAssessment(setCaseGoal(saved, current?.goal ?? getCaseContext(saved).goal));
}

export const toolMessages: Record<CaseTool, string> = {
  documents:
    "Dodaj wypełniony wniosek lub zaświadczenie w PDF. Możesz wykorzystać dane z pliku w tej rozmowie.",
  facts: "Tu możesz sprawdzić i poprawić dane, z których korzystam.",
  examples: "Wybierz fikcyjną sprawę, żeby zobaczyć obliczenie i kolejne kroki.",
  support: "Możesz sprawdzić formalności lub zobaczyć, kto oferuje wsparcie.",
  services: "Tutaj możesz wypróbować usługi na danych demonstracyjnych.",
  rules: "Tutaj możesz porównać wynik przed demonstracyjną zmianą stawki i po niej.",
  formalities: "Zebrałam formalności, które mogą dotyczyć Twojej rodziny.",
};
