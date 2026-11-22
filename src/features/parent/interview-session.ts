import { z } from "zod";
import { caseFactsSchema } from "../../engine/parent-case";
import { writeAssessmentFacts } from "./assessment-facts";
import type { AssessmentFactsCommand } from "./assessment-facts";
import {
  childIdSchema,
  confirmedValue,
  factSourceSchema,
  isoDateSchema,
  markStale,
  timeContains,
  timesOverlap,
  titleIdSchema,
  validTimeSchema,
} from "./family-session";
import type {
  Assessment,
  Fact,
  FactRef,
  FactSource,
  FamilyData,
  Family,
  FactFields,
  ISODate,
  Person,
  PersonId,
  Subject,
  TitleId,
  ValidTime,
  WorkKind,
} from "./family-session";
import { interviewQuestions, sameQuestion } from "./interview";
import type { QuestionRef, QuestionTarget } from "./interview";
import { eventIdSchema } from "./family-session";

export type OperationToken = {
  readonly requestId: string;
  readonly sequence: number;
  readonly sessionId: string;
  readonly contextRevision: number;
  readonly subjectId?: PersonId;
  readonly promptRevision?: number;
};
// Untrusted interpretations stay outside FamilyData until an explicit confirmed command.
export type InterviewProposal = {
  readonly status: "proposed";
  readonly token: OperationToken;
  readonly candidates: readonly { readonly question: QuestionRef; readonly value: unknown }[];
};
export type InterviewSession = FamilyData & {
  readonly id: string;
  readonly asOf: ISODate;
  readonly contextRevision: number;
  readonly navigation: {
    readonly view: "start" | "interview" | "discovery";
    readonly speaker?:
      | { readonly kind: "helper" }
      | { readonly kind: "self"; readonly personId?: PersonId };
    readonly activeSubject?: Subject;
    readonly subjectStatus?: { readonly state: "unknown" | "deferred"; readonly revision: number };
  };
  readonly interview: {
    readonly mode: "idle" | "asking" | "paused" | "finished";
    readonly active?: QuestionRef;
    readonly visited: readonly QuestionTarget[];
    readonly passRevision: number;
    readonly editing?: {
      readonly question: QuestionTarget;
      readonly returnMode: "asking" | "paused" | "finished";
      readonly returnView: "interview" | "discovery";
    };
  };
  readonly operationSequence: number;
  readonly pendingOperation?: OperationToken;
};
export type Transition =
  | { readonly ok: true; readonly session: InterviewSession }
  | {
      readonly ok: false;
      readonly session: InterviewSession;
      readonly reason:
        | "stale"
        | "inactive"
        | "invalid-answer"
        | "invalid-target"
        | "scope-conflict";
    };

const success = (session: InterviewSession): Transition => ({ ok: true, session });
const failure = (
  session: InterviewSession,
  reason: Extract<Transition, { ok: false }>["reason"],
): Transition => ({ ok: false, session, reason });

export function createInterviewSession(
  id: string,
  asOf: string,
  eventId = `${id}:event`,
): InterviewSession {
  return {
    id: z.string().trim().min(1).parse(id),
    asOf: isoDateSchema.parse(asOf),
    contextRevision: 0,
    family: {
      event: { id: eventIdSchema.parse(eventId) },
      eventFacts: {},
      children: [],
      shared: {},
    },
    persons: [],
    assessments: [],
    usage: [],
    navigation: { view: "start" },
    interview: { mode: "idle", visited: [], passRevision: 0 },
    operationSequence: 0,
  };
}

function activePerson(s: InterviewSession): Person | undefined {
  const subject = s.navigation.activeSubject;
  return subject?.kind === "person"
    ? s.persons.find(({ id }) => id === subject.personId)
    : undefined;
}

export function getInterviewRoute(
  s: InterviewSession,
): "undetermined" | "planning" | "standard" | "adoption" | "foster" | "loss" {
  if (confirmedValue(s.family.loss) === true) return "loss";
  const stage = confirmedValue(s.family.stage);
  if (stage === "planning") return "planning";
  if (stage === "receivingCare") {
    const kind = confirmedValue(s.family.event.kind);
    return kind === "adoption" || kind === "foster" ? kind : "undetermined";
  }
  return stage === "pregnant" || stage === "born" ? "standard" : "undetermined";
}

function applicableQuestions(s: InterviewSession): QuestionTarget[] {
  const eventId = s.family.event.id;
  const refs: QuestionTarget[] = [
    { id: "subject", eventId },
    { id: "stage", eventId },
  ];
  if (getInterviewRoute(s) !== "standard") return refs;
  const person = activePerson(s);
  if (person) {
    const subject = s.navigation.activeSubject;
    const selected = subject?.kind === "person" ? subject.titleId : undefined;
    const currentTitles = person.titles.filter(
      ({ employment, ended }) =>
        employment?.state === "confirmed" &&
        (employment.validTime.kind === "undated" || timeContains(employment.validTime, s.asOf)) &&
        !(ended?.state === "confirmed" && ended.value < s.asOf),
    );
    // Multiple titles require an explicit title selection for any subsequent individual check.
    const titleId = selected ?? (currentTitles.length === 1 ? currentTitles[0].id : undefined);
    if (titleId || currentTitles.length === 0)
      refs.push({ id: "employment", personId: person.id, titleId });
  }
  if (confirmedValue(s.family.stage) === "pregnant")
    refs.push({ id: "timing", eventId, field: "dueDate" });
  else
    refs.push({
      id: "timing",
      eventId,
      field: "birth",
      childId: s.family.children[0]?.id ?? childIdSchema.parse(`${eventId}:child:1`),
    });
  if (person?.roles.includes("birthing") && confirmedValue(s.family.stage) === "pregnant")
    refs.push({ id: "need", personId: person.id });
  return refs.sort((a, b) => interviewQuestions[a.id].order - interviewQuestions[b.id].order);
}

function questionFact(s: InterviewSession, ref: QuestionTarget): Fact<unknown> | undefined {
  if (ref.id === "subject") {
    if (s.navigation.activeSubject)
      return {
        state: "confirmed",
        value: s.navigation.activeSubject,
        revision: 0,
        source: { kind: "answer", via: "button" },
        validTime: { kind: "undated" },
        basis: "observed",
      };
    return s.navigation.subjectStatus;
  }
  if (ref.id === "stage")
    return confirmedValue(s.family.loss) === true ? s.family.loss : s.family.stage;
  if (ref.id === "timing")
    return ref.field === "birth"
      ? s.family.children.find(({ id }) => id === ref.childId)?.birth
      : s.family.dueDate?.state === "confirmed"
        ? s.family.dueDate
        : s.family.pregnancyPeriod?.state === "confirmed"
          ? s.family.pregnancyPeriod
          : s.family.dueDate;
  const person = s.persons.find(({ id }) => id === ref.personId);
  return ref.id === "need"
    ? person?.sicknessCheck
    : ref.titleId
      ? person?.titles.find(({ id }) => id === ref.titleId)?.employment
      : person?.workSituation;
}

export function getNextInterviewQuestion(s: InterviewSession): QuestionRef | undefined {
  const target = applicableQuestions(s).find((ref) => {
    const fact = questionFact(s, ref);
    return (
      !fact ||
      fact.state === "stale" ||
      (fact.state !== "confirmed" && fact.revision < s.interview.passRevision)
    );
  });
  return target && { ...target, promptRevision: s.contextRevision };
}

export function getInterviewHandoff(s: InterviewSession) {
  return {
    eventId: s.family.event.id,
    subject: s.navigation.activeSubject,
    route: getInterviewRoute(s),
    contextRevision: s.contextRevision,
    missing: applicableQuestions(s).flatMap((question) => {
      const fact = questionFact(s, question);
      return fact?.state === "confirmed" ? [] : [{ question, state: fact?.state ?? "missing" }];
    }),
  };
}

function refresh(s: InterviewSession): InterviewSession {
  if (s.interview.mode !== "asking") return s;
  const active = s.interview.editing
    ? { ...s.interview.editing.question, promptRevision: s.contextRevision }
    : getNextInterviewQuestion(s);
  return { ...s, interview: { ...s.interview, active, mode: active ? "asking" : "finished" } };
}

function advance(s: InterviewSession): InterviewSession {
  return { ...s, contextRevision: s.contextRevision + 1, pendingOperation: undefined };
}

export function startInterview(s: InterviewSession): InterviewSession {
  if (s.interview.mode !== "idle") return s;
  return refresh({
    ...advance(s),
    navigation: { ...s.navigation, view: "interview" },
    interview: { ...s.interview, mode: "asking" },
  });
}

export function pauseInterview(s: InterviewSession): InterviewSession {
  if (s.interview.mode !== "asking") return s;
  return { ...advance(s), interview: { ...s.interview, mode: "paused", editing: undefined } };
}

export function finishInterview(s: InterviewSession): InterviewSession {
  if (s.navigation.view === "discovery") return s;
  return {
    ...advance(s),
    navigation: { ...s.navigation, view: "discovery" },
    interview: {
      ...s.interview,
      mode: getNextInterviewQuestion(s) ? "paused" : "finished",
      editing: undefined,
    },
  };
}

export function resumeInterview(s: InterviewSession): InterviewSession {
  if (s.interview.mode === "asking" && s.navigation.view === "interview") return s;
  const next = advance(s);
  return refresh({
    ...next,
    navigation: { ...s.navigation, view: "interview" },
    interview: {
      ...s.interview,
      mode: "asking",
      passRevision: next.contextRevision,
      editing: undefined,
    },
  });
}

export function changeActivePerson(
  s: InterviewSession,
  personId: PersonId,
  titleId?: TitleId,
): Transition {
  const person = s.persons.find(({ id }) => id === personId);
  if (!person || (titleId && !person.titles.some(({ id }) => id === titleId)))
    return failure(s, "invalid-target");
  const subject = s.navigation.activeSubject;
  if (subject?.kind === "person" && subject.personId === personId && subject.titleId === titleId)
    return success(s);
  return success(
    refresh({
      ...advance(s),
      navigation: {
        ...s.navigation,
        activeSubject: { kind: "person", personId, titleId },
        subjectStatus: undefined,
      },
      interview: {
        ...s.interview,
        editing: undefined,
        mode:
          s.interview.mode === "finished" && s.navigation.view === "interview"
            ? "asking"
            : s.interview.mode,
      },
    }),
  );
}

function matchesActive(s: InterviewSession, ref: QuestionRef): boolean {
  return (
    s.interview.mode === "asking" &&
    s.navigation.view === "interview" &&
    Boolean(
      s.interview.active &&
      sameQuestion(s.interview.active, ref) &&
      s.interview.active.promptRevision === ref.promptRevision,
    )
  );
}

export function reviseInterviewAnswer(s: InterviewSession, target: QuestionTarget): Transition {
  if (!s.interview.visited.some((ref) => sameQuestion(ref, target)))
    return failure(s, "invalid-target");
  if (!applicableQuestions(s).some((ref) => sameQuestion(ref, target)))
    return failure(s, "inactive");
  const mode = s.interview.mode === "idle" ? "asking" : s.interview.mode;
  const returnView = s.navigation.view === "discovery" ? "discovery" : "interview";
  return success(
    refresh({
      ...advance(s),
      navigation: { ...s.navigation, view: "interview" },
      interview: {
        ...s.interview,
        mode: "asking",
        editing: { question: target, returnMode: mode, returnView },
      },
    }),
  );
}

export function cancelInterviewRevision(s: InterviewSession): InterviewSession {
  const editing = s.interview.editing;
  if (!editing) return s;
  return refresh({
    ...advance(s),
    navigation: { ...s.navigation, view: editing.returnView },
    interview: { ...s.interview, mode: editing.returnMode, editing: undefined },
  });
}

function confirmed<T>(
  value: T,
  revision: number,
  source: FactSource,
  validTime: ValidTime,
  basis: "observed" | "assumed",
): Fact<T> {
  return { state: "confirmed", value, revision, source, validTime, basis };
}

function sameFact<T>(
  fact: Fact<T> | undefined,
  value: T,
  validTime: ValidTime,
  basis: "observed" | "assumed",
): boolean {
  return (
    fact?.state === "confirmed" &&
    fact.value === value &&
    JSON.stringify(fact.validTime) === JSON.stringify(validTime) &&
    fact.basis === basis
  );
}

const employmentDependents = [
  "basis",
  "fixedSalary",
  "payer",
  "insuredHeadcount",
  "debt",
  "debtPaid",
  "qualifying",
  "qualifyingDays",
  "waitingException",
  "rehabSickBasis",
] as const;

function staleAssumptions<T>(fields: FactFields<T>, revision: number): FactFields<T> {
  const next = { ...fields };
  for (const key in fields) {
    const fact = fields[key];
    if (fact?.state === "confirmed" && fact.basis === "assumed")
      Object.assign(next, { [key]: markStale(fact, revision, "Założenie wymaga potwierdzenia") });
  }
  return next;
}

function staleFields<T>(fields: FactFields<T>, revision: number): FactFields<T> {
  const next = { ...fields };
  for (const key in fields)
    Object.assign(next, { [key]: markStale(fields[key], revision, "Korekta rodzaju zdarzenia") });
  return next;
}

function staleAssessment(
  a: Assessment,
  revision: number,
  employmentScope: ValidTime | undefined,
  stage: boolean,
): Assessment {
  if (a.kind === "comparison")
    return {
      ...a,
      state: "stale",
      inputRevision: revision,
      result: a.result && { ...a.result, state: "stale" },
    };
  if (a.kind === "procedure")
    return {
      ...a,
      details: stage ? staleAssumptions(a.details, revision) : a.details,
      state: "stale",
      inputRevision: revision,
      result: a.result && { ...a.result, state: "stale" },
    };
  const details = { ...(stage ? staleAssumptions(a.details, revision) : a.details) };
  if (employmentScope) {
    for (const key of employmentDependents) {
      const fact = details[key];
      if (fact?.state === "confirmed" && timesOverlap(fact.validTime, employmentScope))
        Object.assign(details, {
          [key]: markStale<string | number | boolean>(
            fact,
            revision,
            "Zmiana zatrudnienia tego tytułu",
          ),
        });
    }
  }
  return {
    ...a,
    details,
    state: "stale",
    inputRevision: revision,
    result: a.result && { ...a.result, state: "stale" },
  };
}

function invalidateDependentData(
  s: InterviewSession,
  changed: FactRef,
  revision: number,
): InterviewSession {
  const eventChange = changed.kind === "family";
  const assessments = s.assessments.map((a) => {
    const targets = a.kind === "comparison" ? [a.target, a.first, a.second] : [a.target];
    const affected = targets.some(({ subject, eventId }) =>
      eventChange
        ? eventId === changed.eventId
        : changed.kind === "person"
          ? subject.kind === "person" && subject.personId === changed.personId
          : subject.kind === "person" &&
            subject.personId === changed.personId &&
            (!subject.titleId || subject.titleId === changed.titleId) &&
            (changed.validTime.kind === "undated" || timeContains(changed.validTime, a.asOf)),
    );
    const depends = a.result?.dependencies.some(({ ref }) => {
      if (ref.kind !== changed.kind) return false;
      if (ref.kind === "family")
        return (
          changed.kind === "family" &&
          ref.eventId === changed.eventId &&
          ref.field === changed.field
        );
      if (ref.kind === "person")
        return (
          changed.kind === "person" &&
          ref.personId === changed.personId &&
          ref.field === changed.field
        );
      return (
        changed.kind === "title" &&
        ref.personId === changed.personId &&
        ref.titleId === changed.titleId &&
        timesOverlap(ref.validTime, changed.validTime)
      );
    });
    return affected || depends
      ? staleAssessment(
          a,
          revision,
          changed.kind === "title" &&
            changed.field === "employment" &&
            a.target.subject.kind === "person" &&
            a.target.subject.personId === changed.personId &&
            a.target.subject.titleId === changed.titleId
            ? changed.validTime
            : undefined,
          changed.kind === "family" && changed.field === "stage",
        )
      : a;
  });
  return { ...s, assessments };
}

export type AnswerMetadata = {
  readonly source?: FactSource;
  readonly validTime?: ValidTime;
  readonly basis?: "observed" | "assumed";
};
export type ConfirmedCommand =
  | AssessmentFactsCommand
  | (AnswerMetadata & { readonly baseRevision: number } & (
        | { readonly kind: "answer"; readonly question: QuestionRef; readonly value: unknown }
        | { readonly kind: "familyChildren"; readonly value: unknown }
        | {
            readonly kind: "withdrawEmployment";
            readonly personId: PersonId;
            readonly titleId: TitleId;
            readonly expected: WorkKind;
            readonly validTime: ValidTime;
          }
        | {
            readonly kind: "employment";
            readonly personId: PersonId;
            readonly titleId: TitleId;
            readonly value: WorkKind;
            readonly validTime: ValidTime;
          }
        | {
            readonly kind: "coverage";
            readonly personId: PersonId;
            readonly titleId: TitleId;
            readonly coverageId: string;
            readonly value: boolean;
            readonly validTime: ValidTime;
          }
      ));

function recordAnswer(
  before: InterviewSession,
  after: InterviewSession,
  target: QuestionTarget,
): InterviewSession {
  const editing = before.interview.editing;
  // An unchanged fact can still close an edit and change the active prompt.
  const current = after.contextRevision === before.contextRevision ? advance(after) : after;
  const view = editing?.returnView ?? current.navigation.view;
  const mode = editing?.returnMode ?? current.interview.mode;
  return refresh({
    ...current,
    navigation: { ...current.navigation, view },
    interview: {
      ...current.interview,
      editing: undefined,
      mode: mode === "finished" && view === "interview" ? "asking" : mode,
      visited: [...current.interview.visited.filter((ref) => !sameQuestion(ref, target)), target],
    },
  });
}

function invalidateStage(s: InterviewSession, revision: number): InterviewSession {
  return {
    ...invalidateDependentData(
      s,
      { kind: "family", eventId: s.family.event.id, field: "stage" },
      revision,
    ),
    family: {
      ...s.family,
      dueDate: markStale(s.family.dueDate, revision, "Zmiana etapu"),
      pregnancyPeriod: markStale(s.family.pregnancyPeriod, revision, "Zmiana etapu"),
      childrenCount:
        s.family.childrenCount?.state === "confirmed" && s.family.childrenCount.basis === "assumed"
          ? markStale(s.family.childrenCount, revision, "Założenie wymaga potwierdzenia")
          : s.family.childrenCount,
    },
    persons: s.persons.map((p) => ({
      ...p,
      workSituation:
        p.workSituation?.state === "confirmed" && p.workSituation.basis === "assumed"
          ? markStale(
              p.workSituation,
              revision,
              "Założenie sytuacji zawodowej wymaga potwierdzenia",
            )
          : p.workSituation,
      sicknessCheck: markStale(p.sicknessCheck, revision, "Zmiana etapu"),
      titles: p.titles.map((t) => ({
        ...t,
        employment:
          t.employment?.state === "confirmed" && t.employment.basis === "assumed"
            ? markStale(t.employment, revision, "Założenie zatrudnienia wymaga potwierdzenia")
            : t.employment,
        employmentPercent:
          t.employmentPercent?.state === "confirmed" && t.employmentPercent.basis === "assumed"
            ? markStale(
                t.employmentPercent,
                revision,
                "Założenie wymiaru pracy wymaga potwierdzenia",
              )
            : t.employmentPercent,
        sicknessCoverage: t.sicknessCoverage.map((c) => ({
          ...c,
          fact:
            c.fact.state === "confirmed" && c.fact.basis === "assumed"
              ? (markStale(c.fact, revision, "Prognoza nie jest dowodem po zmianie etapu") ??
                c.fact)
              : c.fact,
        })),
      })),
    })),
  };
}

function writeEmployment(
  s: InterviewSession,
  personId: PersonId,
  titleId: TitleId | undefined,
  value: WorkKind,
  source: FactSource,
  time: ValidTime,
  basis: "observed" | "assumed",
): Transition {
  const person = s.persons.find(({ id }) => id === personId);
  if (
    !person ||
    (titleId &&
      s.persons.some((p) => p.id !== personId && p.titles.some(({ id }) => id === titleId)))
  )
    return failure(s, "invalid-target");
  const existing = person.titles.find(({ id }) => id === titleId);
  if (value === "notWorking" || value === "other") {
    if (titleId && !existing) return failure(s, "invalid-target");
    if (
      person.titles.some(
        (t) =>
          t.id !== titleId &&
          t.employment?.state === "confirmed" &&
          timesOverlap(t.employment.validTime, time) &&
          !(t.ended?.state === "confirmed" && time.kind === "day" && t.ended.value < time.day),
      )
    )
      return failure(s, "scope-conflict");
    if (sameFact(person.workSituation, value, time, basis)) return success(s);
    const next = advance(s);
    const saved: InterviewSession = {
      ...next,
      navigation: {
        ...next.navigation,
        activeSubject:
          next.navigation.activeSubject?.kind === "person" &&
          next.navigation.activeSubject.personId === personId
            ? { kind: "person", personId }
            : next.navigation.activeSubject,
      },
      persons: s.persons.map((p) =>
        p.id === personId
          ? {
              ...p,
              workSituation: confirmed(value, next.contextRevision, source, time, basis),
              titles: p.titles.map((t) =>
                t.id === titleId
                  ? {
                      ...t,
                      employment: markStale(
                        t.employment,
                        next.contextRevision,
                        "Skorygowano sytuację zawodową",
                      ),
                      sicknessCoverage: t.sicknessCoverage.map((c) => ({
                        ...c,
                        fact:
                          c.fact.state === "confirmed" && timesOverlap(c.fact.validTime, time)
                            ? (markStale(
                                c.fact,
                                next.contextRevision,
                                "Korekta sytuacji zawodowej",
                              ) ?? c.fact)
                            : c.fact,
                      })),
                    }
                  : t,
              ),
            }
          : p,
      ),
    };
    return success(
      titleId
        ? invalidateDependentData(
            saved,
            { kind: "title", personId, titleId, field: "employment", validTime: time },
            next.contextRevision,
          )
        : saved,
    );
  }
  if (sameFact(existing?.employment, value, time, basis)) return success(s);
  const next = advance(s);
  let ordinal = next.contextRevision;
  let id = titleId ?? titleIdSchema.parse(`${personId}:title:${ordinal}`);
  while (!titleId && s.persons.some((p) => p.titles.some((t) => t.id === id))) {
    ordinal += 1;
    id = titleIdSchema.parse(`${personId}:title:${ordinal}`);
  }
  if (s.persons.some((p) => p.id !== personId && p.titles.some((t) => t.id === id)))
    return failure(s, "invalid-target");
  const title = {
    ...existing,
    id,
    employment: confirmed(value, next.contextRevision, source, time, basis),
    employmentPeriods:
      existing?.employment &&
      "validTime" in existing.employment &&
      !timesOverlap(existing.employment.validTime, time)
        ? [...(existing.employmentPeriods ?? []), existing.employment]
        : existing?.employmentPeriods?.map((f) =>
            f.state === "confirmed" && timesOverlap(f.validTime, time)
              ? (markStale(f, next.contextRevision, "Korekta zatrudnienia w tym okresie") ?? f)
              : f,
          ),
    sicknessCoverage: (existing?.sicknessCoverage ?? []).map((c) => ({
      ...c,
      fact:
        c.fact.state === "confirmed" && timesOverlap(c.fact.validTime, time)
          ? (markStale(c.fact, next.contextRevision, "Korekta zatrudnienia tego tytułu i okresu") ??
            c.fact)
          : c.fact,
    })),
    employmentPercent:
      value !== "employee" &&
      existing?.employmentPercent?.state === "confirmed" &&
      timesOverlap(existing.employmentPercent.validTime, time)
        ? markStale(existing?.employmentPercent, next.contextRevision, "Tytuł nie jest etatem")
        : existing?.employmentPercent,
  };
  const saved = {
    ...next,
    persons: s.persons.map((p) =>
      p.id === personId
        ? {
            ...p,
            workSituation:
              p.workSituation?.state === "confirmed"
                ? timesOverlap(p.workSituation.validTime, time)
                  ? markStale(p.workSituation, next.contextRevision, "Wskazano konkretny tytuł")
                  : p.workSituation
                : undefined,
            titles: [...p.titles.filter((t) => t.id !== id), title],
          }
        : p,
    ),
  };
  return success(
    invalidateDependentData(
      saved,
      { kind: "title", personId, titleId: id, field: "employment", validTime: time },
      next.contextRevision,
    ),
  );
}

export function applyConfirmedFacts(s: InterviewSession, command: ConfirmedCommand): Transition {
  if (command.baseRevision !== s.contextRevision) return failure(s, "stale");
  if (command.kind === "caseFacts" || command.kind === "procedureFact")
    return writeAssessmentFacts(s, command);
  const metadataRef = command.kind === "answer" ? command.question : undefined;
  const previousEmployment =
    metadataRef?.id === "employment"
      ? s.persons
          .find((p) => p.id === metadataRef.personId)
          ?.titles.find((t) => t.id === metadataRef.titleId)?.employment
      : undefined;
  const metadata = z
    .strictObject({
      source: factSourceSchema,
      validTime: validTimeSchema,
      basis: z.enum(["observed", "assumed"]),
    })
    .safeParse({
      source: command.source ?? { kind: "answer", via: "button" },
      validTime:
        command.validTime ??
        (previousEmployment && "validTime" in previousEmployment
          ? previousEmployment.validTime
          : { kind: "day", day: s.asOf }),
      basis: command.basis ?? "observed",
    });
  if (!metadata.success) return failure(s, "invalid-answer");
  const { source, validTime: time, basis } = metadata.data;
  if (command.kind === "withdrawEmployment") {
    const title = s.persons
      .find((p) => p.id === command.personId)
      ?.titles.find((t) => t.id === command.titleId);
    if (
      !title ||
      title.employment?.state !== "confirmed" ||
      title.employment.value !== command.expected ||
      JSON.stringify(title.employment.validTime) !== JSON.stringify(time)
    )
      return failure(s, "invalid-target");
    const next = advance(s);
    const reason = "Potwierdzona korekta właściciela informacji";
    return success(
      refresh(
        invalidateDependentData(
          {
            ...next,
            persons: next.persons.map((p) =>
              p.id !== command.personId
                ? p
                : {
                    ...p,
                    titles: p.titles.map((t) =>
                      t.id !== command.titleId
                        ? t
                        : {
                            ...t,
                            employment: markStale(t.employment, next.contextRevision, reason),
                            sicknessCoverage: t.sicknessCoverage.map((c) => ({
                              ...c,
                              fact:
                                c.fact.state === "confirmed" && timesOverlap(c.fact.validTime, time)
                                  ? (markStale(c.fact, next.contextRevision, reason) ?? c.fact)
                                  : c.fact,
                            })),
                          },
                    ),
                  },
            ),
          },
          {
            kind: "title",
            personId: command.personId,
            titleId: command.titleId,
            field: "employment",
            validTime: time,
          },
          next.contextRevision,
        ),
      ),
    );
  }
  if (command.kind === "familyChildren") {
    const value = caseFactsSchema.shape.children.safeParse(command.value);
    if (!value.success) return failure(s, "invalid-answer");
    const next = advance(s);
    return success(
      refresh(
        invalidateDependentData(
          {
            ...next,
            family: {
              ...next.family,
              childrenCount: confirmed(
                value.data,
                next.contextRevision,
                source,
                { kind: "undated" },
                basis,
              ),
            },
          },
          { kind: "family", eventId: s.family.event.id, field: "childrenCount" },
          next.contextRevision,
        ),
      ),
    );
  }
  if (command.kind === "employment") {
    const parsed = interviewQuestions.employment.schema.safeParse({
      kind: command.value,
      titleId: command.titleId,
    });
    if (!parsed.success) return failure(s, "invalid-answer");
    const written = writeEmployment(
      s,
      command.personId,
      command.titleId,
      parsed.data.kind,
      source,
      time,
      basis,
    );
    return written.ok ? success(refresh(written.session)) : written;
  }
  if (command.kind === "coverage") {
    const person = s.persons.find(({ id }) => id === command.personId);
    const title = person?.titles.find(({ id }) => id === command.titleId);
    if (!title) return failure(s, "invalid-target");
    if (typeof command.value !== "boolean" || !command.coverageId.trim())
      return failure(s, "invalid-answer");
    if (
      basis === "observed" &&
      (time.kind === "day" ? time.day > s.asOf : time.kind === "period" && time.through > s.asOf)
    )
      return failure(s, "invalid-answer");
    const previous = title.sicknessCoverage.find(({ id }) => id === command.coverageId);
    if (
      previous &&
      "validTime" in previous.fact &&
      JSON.stringify(previous.fact.validTime) !== JSON.stringify(time)
    )
      return failure(s, "scope-conflict");
    if (
      !previous &&
      title.sicknessCoverage.some((c) => sameFact(c.fact, command.value, time, basis))
    )
      return success(s);
    if (
      title.sicknessCoverage.some(
        (c) =>
          c.id !== command.coverageId &&
          c.fact.state === "confirmed" &&
          c.fact.basis === basis &&
          timesOverlap(c.fact.validTime, time) &&
          c.fact.value !== command.value,
      )
    )
      return failure(s, "scope-conflict");
    if (sameFact(previous?.fact, command.value, time, basis)) return success(s);
    const next = advance(s);
    const saved = {
      ...next,
      persons: s.persons.map((p) =>
        p.id === command.personId
          ? {
              ...p,
              titles: p.titles.map((t) =>
                t.id === command.titleId
                  ? {
                      ...t,
                      sicknessCoverage: [
                        ...t.sicknessCoverage.filter((c) => c.id !== command.coverageId),
                        {
                          id: command.coverageId,
                          fact: confirmed(command.value, next.contextRevision, source, time, basis),
                        },
                      ],
                    }
                  : t,
              ),
            }
          : p,
      ),
    };
    return success(
      refresh(
        invalidateDependentData(
          saved,
          {
            kind: "title",
            personId: command.personId,
            titleId: command.titleId,
            field: "coverage",
            validTime: time,
          },
          next.contextRevision,
        ),
      ),
    );
  }
  const ref = command.question;
  if (ref.promptRevision !== s.contextRevision) return failure(s, "stale");
  if (!matchesActive(s, ref)) return failure(s, "inactive");
  const next = advance(s);
  const revision = next.contextRevision;
  const factTime: ValidTime = { kind: "undated" };
  const make = <T>(value: T) => confirmed(value, revision, source, factTime, basis);
  switch (ref.id) {
    case "subject": {
      const parsed = interviewQuestions.subject.schema.safeParse(command.value);
      if (!parsed.success) return failure(s, "invalid-answer");
      const { speaker, subject } = parsed.data;
      const person =
        subject.kind === "person" && s.persons.find(({ id }) => id === subject.personId);
      if (subject.kind === "person" && !person && !subject.role)
        return failure(s, "invalid-target");
      const activeSubject: Subject =
        subject.kind === "family" ? subject : { kind: "person", personId: subject.personId };
      const persons =
        subject.kind === "family"
          ? s.persons
          : person
            ? s.persons.map((p) =>
                p.id === person.id && subject.role ? { ...p, roles: [subject.role] } : p,
              )
            : [
                ...s.persons,
                {
                  id: subject.personId,
                  roles: subject.role ? [subject.role] : [],
                  titles: [],
                  procedureFacts: {},
                },
              ];
      const saved: InterviewSession = {
        ...next,
        persons,
        navigation: {
          ...s.navigation,
          subjectStatus: undefined,
          activeSubject,
          speaker:
            speaker === "helper"
              ? { kind: "helper" }
              : {
                  kind: "self",
                  personId: subject.kind === "person" ? subject.personId : undefined,
                },
        },
      };
      const changedRole =
        subject.kind === "person" &&
        person &&
        subject.role &&
        (person.roles.length !== 1 || person.roles[0] !== subject.role);
      return success(
        recordAnswer(
          s,
          changedRole && subject.kind === "person"
            ? invalidateDependentData(
                saved,
                { kind: "person", personId: subject.personId, field: "roles" },
                revision,
              )
            : saved,
          ref,
        ),
      );
    }
    case "stage": {
      const parsed = interviewQuestions.stage.schema.safeParse(command.value);
      if (!parsed.success) return failure(s, "invalid-answer");
      const value = parsed.data;
      if (
        (value === "loss" && confirmedValue(s.family.loss) === true) ||
        (value !== "loss" &&
          confirmedValue(s.family.loss) !== true &&
          value ===
            (confirmedValue(s.family.stage) === "receivingCare"
              ? confirmedValue(s.family.event.kind)
              : confirmedValue(s.family.stage)))
      )
        return success(recordAnswer(s, s, ref));
      const invalidated = invalidateStage(next, revision);
      const stage =
        value === "adoption" || value === "foster"
          ? "receivingCare"
          : value === "loss"
            ? undefined
            : value;
      const family: Family = {
        ...invalidated.family,
        stage: stage ? make(stage) : markStale(s.family.stage, revision, "Ścieżka po stracie"),
        loss: make(value === "loss"),
        event: {
          ...s.family.event,
          kind:
            value === "loss" || value === "planning"
              ? markStale(s.family.event.kind, revision, "Nieustalony rodzaj zdarzenia")
              : make(value === "adoption" || value === "foster" ? value : "birth"),
        },
        children: invalidated.family.children.map((child) => ({
          ...child,
          birth:
            value === "born"
              ? child.birth
              : markStale(child.birth, revision, "Zmiana gałęzi narodzin"),
        })),
      };
      const previousKind = confirmedValue(s.family.event.kind);
      const currentKind = confirmedValue(family.event.kind);
      if (previousKind !== currentKind && previousKind !== undefined) {
        return success(
          recordAnswer(
            s,
            {
              ...invalidated,
              family: {
                ...family,
                eventFacts: staleFields(family.eventFacts, revision),
                childrenCount: markStale(
                  family.childrenCount,
                  revision,
                  "Korekta rodzaju zdarzenia",
                ),
              },
            },
            ref,
          ),
        );
      }
      return success(recordAnswer(s, { ...invalidated, family }, ref));
    }
    case "employment": {
      const parsed = interviewQuestions.employment.schema.safeParse(command.value);
      if (!parsed.success) return failure(s, "invalid-answer");
      if (ref.titleId && parsed.data.titleId && ref.titleId !== parsed.data.titleId)
        return failure(s, "invalid-target");
      const written = writeEmployment(
        s,
        ref.personId,
        ref.titleId ?? parsed.data.titleId,
        parsed.data.kind,
        source,
        time,
        basis,
      );
      if (!written.ok) return written;
      const person = written.session.persons.find(({ id }) => id === ref.personId);
      const titleId =
        parsed.data.kind === "notWorking" || parsed.data.kind === "other"
          ? undefined
          : (ref.titleId ?? parsed.data.titleId ?? person?.titles.at(-1)?.id);
      const saved = {
        ...written.session,
        navigation: {
          ...written.session.navigation,
          activeSubject: { kind: "person" as const, personId: ref.personId, titleId },
        },
      };
      return success(recordAnswer(s, saved, { ...ref, titleId }));
    }
    case "timing": {
      const parsed = interviewQuestions.timing.schema.safeParse(command.value);
      if (!parsed.success || (ref.field === "birth" && parsed.data.kind !== "date"))
        return failure(s, "invalid-answer");
      const value = parsed.data;
      if (ref.field === "birth" && basis !== "observed") return failure(s, "invalid-answer");
      if (
        value.kind === "date" &&
        (value.date < "1900-01-01" || (ref.field === "birth" && value.date > s.asOf))
      )
        return failure(s, "invalid-answer");
      const previous =
        ref.field === "birth"
          ? s.family.children.find(({ id }) => id === ref.childId)?.birth
          : value.kind === "date"
            ? s.family.dueDate
            : s.family.pregnancyPeriod;
      const timingBasis = ref.field === "dueDate" ? "assumed" : basis;
      if (
        sameFact(previous, value.kind === "date" ? value.date : value.period, factTime, timingBasis)
      )
        return success(recordAnswer(s, s, ref));
      const family =
        ref.field === "birth" && value.kind === "date"
          ? {
              ...s.family,
              children: s.family.children.some(({ id }) => id === ref.childId)
                ? s.family.children.map((c) =>
                    c.id === ref.childId ? { ...c, birth: make(value.date) } : c,
                  )
                : [...s.family.children, { id: ref.childId, birth: make(value.date), facts: {} }],
            }
          : {
              ...s.family,
              dueDate:
                value.kind === "date"
                  ? confirmed(value.date, revision, source, factTime, "assumed")
                  : markStale(s.family.dueDate, revision, "Podano orientacyjny etap zamiast daty"),
              pregnancyPeriod:
                value.kind === "period"
                  ? confirmed(value.period, revision, source, factTime, "assumed")
                  : markStale(s.family.pregnancyPeriod, revision, "Podano termin"),
            };
      return success(
        recordAnswer(
          s,
          invalidateDependentData(
            { ...next, family },
            { kind: "family", eventId: s.family.event.id, field: "timing" },
            revision,
          ),
          ref,
        ),
      );
    }
    case "need": {
      const parsed = interviewQuestions.need.schema.safeParse(command.value);
      if (!parsed.success) return failure(s, "invalid-answer");
      return success(
        recordAnswer(
          s,
          {
            ...next,
            persons: s.persons.map((p) =>
              p.id === ref.personId ? { ...p, sicknessCheck: make(parsed.data) } : p,
            ),
          },
          ref,
        ),
      );
    }
  }
}

export function answerInterviewQuestion(
  s: InterviewSession,
  ref: QuestionRef,
  value: unknown,
  metadata: AnswerMetadata = {},
): Transition {
  return applyConfirmedFacts(s, {
    kind: "answer",
    question: ref,
    value,
    baseRevision: ref.promptRevision,
    ...metadata,
  });
}

/** Confirmed multi-field commands use the same schemas/invalidation as an answer.
 * Targets are constructed locally; this never accepts a model-generated cursor. */
export function confirmInterviewValue(
  s: InterviewSession,
  target: QuestionTarget,
  value: unknown,
  metadata: AnswerMetadata = {},
): Transition {
  if (
    ("eventId" in target && target.eventId !== s.family.event.id) ||
    ("personId" in target && !s.persons.some((p) => p.id === target.personId))
  )
    return failure(s, "invalid-target");
  const question = { ...target, promptRevision: s.contextRevision };
  const prepared: InterviewSession = {
    ...s,
    navigation: { ...s.navigation, view: "interview" },
    interview: { ...s.interview, mode: "asking", active: question, editing: undefined },
  };
  const written = answerInterviewQuestion(prepared, question, value, metadata);
  if (!written.ok) return failure(s, written.reason);
  return success(
    refresh({
      ...written.session,
      navigation: { ...written.session.navigation, view: s.navigation.view },
      interview: {
        ...written.session.interview,
        mode: s.interview.mode,
        editing: s.interview.editing,
      },
    }),
  );
}

function skipQuestion(
  s: InterviewSession,
  ref: QuestionRef,
  state: "unknown" | "deferred",
): Transition {
  if (ref.promptRevision !== s.contextRevision) return failure(s, "stale");
  if (!matchesActive(s, ref)) return failure(s, "inactive");
  const next = advance(s);
  const revision = next.contextRevision;
  const fact = { state, revision };
  let saved = next;
  switch (ref.id) {
    case "subject":
      saved = {
        ...next,
        navigation: {
          ...s.navigation,
          activeSubject: undefined,
          speaker: undefined,
          subjectStatus: fact,
        },
      };
      break;
    case "stage": {
      const invalidated = invalidateStage(next, revision);
      saved = {
        ...invalidated,
        family: {
          ...invalidated.family,
          stage: fact,
          loss: markStale(s.family.loss, revision, "Nieznany etap"),
          event: {
            ...s.family.event,
            kind: markStale(s.family.event.kind, revision, "Nieznany etap"),
          },
        },
      };
      break;
    }
    case "timing":
      saved = invalidateDependentData(
        {
          ...next,
          family:
            ref.field === "dueDate"
              ? {
                  ...s.family,
                  dueDate: fact,
                  pregnancyPeriod: markStale(
                    s.family.pregnancyPeriod,
                    revision,
                    "Odłożono ustalenie terminu",
                  ),
                }
              : {
                  ...s.family,
                  children: s.family.children.some(({ id }) => id === ref.childId)
                    ? s.family.children.map((c) =>
                        c.id === ref.childId ? { ...c, birth: fact } : c,
                      )
                    : [...s.family.children, { id: ref.childId, birth: fact, facts: {} }],
                },
        },
        { kind: "family", eventId: s.family.event.id, field: "timing" },
        revision,
      );
      break;
    case "need":
      saved = {
        ...next,
        persons: s.persons.map((p) => (p.id === ref.personId ? { ...p, sicknessCheck: fact } : p)),
      };
      break;
    case "employment": {
      const employment = s.persons
        .find((p) => p.id === ref.personId)
        ?.titles.find((t) => t.id === ref.titleId)?.employment;
      const scope: ValidTime =
        employment && "validTime" in employment ? employment.validTime : { kind: "undated" };
      saved = {
        ...next,
        persons: s.persons.map((p) =>
          p.id !== ref.personId
            ? p
            : ref.titleId
              ? {
                  ...p,
                  titles: p.titles.map((t) =>
                    t.id === ref.titleId
                      ? {
                          ...t,
                          employment: fact,
                          sicknessCoverage: t.sicknessCoverage.map((c) => ({
                            ...c,
                            fact:
                              c.fact.state === "confirmed" && timesOverlap(c.fact.validTime, scope)
                                ? (markStale(c.fact, revision, "Nieznane zatrudnienie") ?? c.fact)
                                : c.fact,
                          })),
                        }
                      : t,
                  ),
                }
              : { ...p, workSituation: fact },
        ),
      };
      if (ref.titleId)
        saved = invalidateDependentData(
          saved,
          {
            kind: "title",
            personId: ref.personId,
            titleId: ref.titleId,
            field: "employment",
            validTime: scope,
          },
          revision,
        );
      break;
    }
  }
  return success(recordAnswer(s, saved, ref));
}

export function deferInterviewQuestion(s: InterviewSession, ref: QuestionRef): Transition {
  return skipQuestion(s, ref, "deferred");
}
export function markInterviewAnswerUnknown(s: InterviewSession, ref: QuestionRef): Transition {
  return skipQuestion(s, ref, "unknown");
}

export function beginInterviewOperation(
  s: InterviewSession,
  requestId: string,
): { readonly session: InterviewSession; readonly token: OperationToken } {
  const token: OperationToken = {
    requestId: z.string().trim().min(1).parse(requestId),
    sequence: s.operationSequence + 1,
    sessionId: s.id,
    contextRevision: s.contextRevision,
    subjectId: activePerson(s)?.id,
    promptRevision: s.interview.active?.promptRevision,
  };
  return { session: { ...s, operationSequence: token.sequence, pendingOperation: token }, token };
}

export function acceptInterviewOperation(s: InterviewSession, token: OperationToken): Transition {
  const pending = s.pendingOperation;
  if (
    !pending ||
    token.requestId !== pending.requestId ||
    token.sequence !== pending.sequence ||
    token.sessionId !== s.id ||
    token.sessionId !== pending.sessionId ||
    token.contextRevision !== s.contextRevision ||
    token.contextRevision !== pending.contextRevision ||
    token.subjectId !== pending.subjectId ||
    token.promptRevision !== pending.promptRevision
  )
    return failure(s, "stale");
  return success({ ...s, pendingOperation: undefined });
}

/** Cancels a pending operation even when the interview has already finished. */
export function cancelInterviewOperation(s: InterviewSession): InterviewSession {
  return refresh(advance(s));
}
