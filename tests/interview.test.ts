import assert from "node:assert/strict";
import { test } from "node:test";
import { questions } from "../src/data/questions";
import { caseFactsSchema } from "../src/engine/parent-case";
import { assessBenefit } from "../src/engine/parent-benefit";
import {
  assessmentIdSchema,
  caseFactOwnership,
  confirmedValue,
  coverageOnDay,
  documentIdSchema,
  eventIdSchema,
  isoDateSchema,
  isValidTarget,
  personIdSchema,
  profileOwnership,
  titleIdSchema,
  validTimeSchema,
} from "../src/features/parent/family-session";
import type {
  Assessment,
  Fact,
  PersonId,
  TitleId,
  ValidTime,
} from "../src/features/parent/family-session";
import {
  acceptInterviewOperation,
  answerInterviewQuestion,
  applyConfirmedFacts,
  beginInterviewOperation,
  cancelInterviewRevision,
  cancelInterviewOperation,
  changeActivePerson,
  createInterviewSession,
  deferInterviewQuestion,
  finishInterview,
  getInterviewHandoff,
  getInterviewRoute,
  getNextInterviewQuestion,
  markInterviewAnswerUnknown,
  pauseInterview,
  resumeInterview,
  reviseInterviewAnswer,
  startInterview,
} from "../src/features/parent/interview-session";
import type { InterviewSession, Transition } from "../src/features/parent/interview-session";
import {
  interviewQuestions,
  interviewQuestionText,
  readInterviewAnswer,
} from "../src/features/parent/interview";
import type { InterviewQuestionId, QuestionRef } from "../src/features/parent/interview";

const asOf = "2026-11-22";
const a = personIdSchema.parse("parent-a");
const b = personIdSchema.parse("parent-b");
const t1 = titleIdSchema.parse("a-title-1");
const t2 = titleIdSchema.parse("a-title-2");
const tb = titleIdSchema.parse("b-title-1");
const day = (date = asOf): ValidTime => ({ kind: "day", day: isoDateSchema.parse(date) });
const period = (from: string, through: string): ValidTime => ({
  kind: "period",
  from: isoDateSchema.parse(from),
  through: isoDateSchema.parse(through),
});
const source = { kind: "answer", via: "button" } as const;

function ok(transition: Transition): InterviewSession {
  assert.ok(transition.ok, transition.ok ? "" : transition.reason);
  return transition.session;
}
function prompt(s: InterviewSession, id?: InterviewQuestionId): QuestionRef {
  const ref = s.interview.active;
  assert.ok(ref);
  if (id) assert.equal(ref.id, id);
  return ref;
}
function answer(s: InterviewSession, id: InterviewQuestionId, value: unknown): InterviewSession {
  return ok(answerInterviewQuestion(s, prompt(s, id), value));
}
function edit(s: InterviewSession, id: InterviewQuestionId): InterviewSession {
  const target = s.interview.visited.findLast((ref) => ref.id === id);
  assert.ok(target);
  return ok(reviseInterviewAnswer(s, target));
}
function start(): InterviewSession {
  return startInterview(createInterviewSession("test", asOf));
}
function subject(
  s = start(),
  personId = a,
  role: "birthing" | "otherParent" | "guardian" = "birthing",
  speaker: "self" | "helper" = "self",
): InterviewSession {
  return answer(s, "subject", { speaker, subject: { kind: "person", personId, role } });
}
function pregnant(): InterviewSession {
  return answer(subject(), "stage", "pregnant");
}
function employed(kind = "employee"): InterviewSession {
  return answer(pregnant(), "employment", { kind, titleId: t1 });
}
function employment(
  s: InterviewSession,
  personId: PersonId,
  titleId: TitleId,
  value: "employee" | "contract" | "business" | "collaborator",
  validTime = day(),
): InterviewSession {
  return ok(
    applyConfirmedFacts(s, {
      kind: "employment",
      baseRevision: s.contextRevision,
      personId,
      titleId,
      value,
      validTime,
    }),
  );
}
function coverage(
  s: InterviewSession,
  personId: PersonId,
  titleId: TitleId,
  coverageId: string,
  value: boolean,
  validTime = day(),
  basis: "observed" | "assumed" = "observed",
): InterviewSession {
  return ok(
    applyConfirmedFacts(s, {
      kind: "coverage",
      baseRevision: s.contextRevision,
      personId,
      titleId,
      coverageId,
      value,
      validTime,
      basis,
    }),
  );
}
function person(s: InterviewSession, personId = a) {
  const p = s.persons.find(({ id }) => id === personId);
  assert.ok(p);
  return p;
}
function title(s: InterviewSession, titleId = t1, personId = a) {
  const t = person(s, personId).titles.find(({ id }) => id === titleId);
  assert.ok(t);
  return t;
}
function fact<T>(value: T, basis: "observed" | "assumed" = "observed"): Fact<T> {
  return { state: "confirmed", value, basis, revision: 1, source, validTime: day() };
}
function assessment(
  s: InterviewSession,
  personId: PersonId,
  titleId: TitleId,
  id: string,
  date = asOf,
): Extract<Assessment, { kind: "calculator" }> {
  return {
    id: assessmentIdSchema.parse(id),
    kind: "calculator",
    benefit: "maternity",
    goal: "calculation",
    target: {
      eventId: s.family.event.id,
      subject: { kind: "person", personId, titleId },
      childIds: [],
    },
    asOf: isoDateSchema.parse(date),
    inputRevision: s.contextRevision,
    state: "draft",
    details: { basis: fact(600_000), from: fact(date) },
    result: {
      input: {},
      result: assessBenefit("maternity", {}, date),
      dependencies: [],
      asOf: isoDateSchema.parse(date),
      engineVersion: "test",
      state: "current",
      explanation: "Brakuje danych",
    },
  };
}
function twoPeople(): InterviewSession {
  const first = employed();
  return answer(edit(first, "subject"), "subject", {
    speaker: "self",
    subject: { kind: "person", personId: b, role: "otherParent" },
  });
}
function freeze(value: unknown): void {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
}

test("start bez danych ma jawny kursor, jedno zdarzenie i nie tworzy rodzica domyślnie", () => {
  const empty = createInterviewSession("test", asOf);
  const started = startInterview(empty);
  assert.equal(empty.interview.mode, "idle");
  assert.equal(started.interview.mode, "asking");
  assert.equal(prompt(started).id, "subject");
  assert.deepEqual(started.persons, []);
  assert.deepEqual(started.assessments, []);
  assert.equal(getInterviewRoute(started), "undetermined");
  assert.deepEqual(startInterview(started), started);
  assert.deepEqual(getNextInterviewQuestion(started), started.interview.active);
});

test("planowanie kończy krótką gałąź bez fikcyjnej ciąży, daty i tytułu", () => {
  const s = answer(subject(), "stage", "planning");
  assert.equal(getInterviewRoute(s), "planning");
  assert.equal(s.interview.mode, "finished");
  assert.equal(getNextInterviewQuestion(s), undefined);
  assert.equal(s.family.dueDate, undefined);
  assert.deepEqual(person(s).titles, []);
  assert.equal(getInterviewHandoff(s).route, "planning");
});

for (const kind of ["employee", "contract", "business", "collaborator"] as const) {
  test(`ciąża i ${kind}: tytuł należy do wskazanej osoby, bez pensji i domyślnego chorobowego`, () => {
    const s = employed(kind);
    assert.equal(confirmedValue(title(s).employment), kind);
    assert.equal(person(s).workSituation, undefined);
    assert.deepEqual(title(s).sicknessCoverage, []);
    assert.equal(prompt(s).id, "timing");
    assert.equal(getInterviewHandoff(s).route, "standard");
    assert.deepEqual(s.assessments, []);
  });
}

test("brak pracy i inna sytuacja nie tworzą fikcyjnego tytułu ani negatywnego ubezpieczenia", () => {
  for (const kind of ["notWorking", "other"] as const) {
    const s = answer(pregnant(), "employment", { kind });
    assert.equal(confirmedValue(person(s).workSituation), kind);
    assert.deepEqual(person(s).titles, []);
    assert.equal(prompt(s).id, "timing");
  }
});

test("Nie wiem o pracy pozostaje unknown i nie zapętla pytania", () => {
  let s = pregnant();
  s = ok(markInterviewAnswerUnknown(s, prompt(s, "employment")));
  assert.equal(person(s).workSituation?.state, "unknown");
  assert.equal(prompt(s).id, "timing");
  s = ok(markInterviewAnswerUnknown(s, prompt(s)));
  s = ok(markInterviewAnswerUnknown(s, prompt(s, "need")));
  assert.equal(s.interview.mode, "finished");
  assert.equal(getNextInterviewQuestion(s), undefined);
  assert.equal(getInterviewHandoff(s).missing.length, 3);
});

test("drugi rodzic ma własną rolę i nie dostaje pytań o zwolnienie osoby rodzącej", () => {
  let s = answer(subject(start(), b, "otherParent"), "stage", "pregnant");
  s = answer(s, "employment", { kind: "contract", titleId: tb });
  s = ok(deferInterviewQuestion(s, prompt(s, "timing")));
  assert.deepEqual(person(s, b).roles, ["otherParent"]);
  assert.equal(s.interview.mode, "finished");
  assert.equal(person(s, b).sicknessCheck, undefined);
});

test("pomoc partnerowi zapisuje fakty partnera, bez tworzenia pomagającego", () => {
  const s = answer(
    answer(subject(start(), b, "otherParent", "helper"), "stage", "pregnant"),
    "employment",
    { kind: "business", titleId: tb },
  );
  assert.deepEqual(s.navigation.speaker, { kind: "helper" });
  assert.equal(s.persons.length, 1);
  assert.equal(person(s, b).id, b);
  assert.equal(confirmedValue(title(s, tb, b).employment), "business");
  assert.equal(
    s.persons.some(({ id }) => id === a),
    false,
  );
});

test("cała rodzina nie jest pozorną osobą z zatrudnieniem", () => {
  let s = answer(start(), "subject", { speaker: "self", subject: { kind: "family" } });
  s = answer(s, "stage", "pregnant");
  assert.equal(prompt(s).id, "timing");
  assert.deepEqual(s.persons, []);
});

test("dwie osoby zachowują odrębne zatrudnienie i chorobowe przy przełączaniu", () => {
  let s = answer(twoPeople(), "employment", { kind: "business", titleId: tb });
  s = coverage(s, a, t1, "a-coverage", false);
  s = coverage(s, b, tb, "b-coverage", true);
  const beforeB = person(s, b);
  s = ok(changeActivePerson(s, a, t1));
  assert.equal(confirmedValue(title(s).employment), "employee");
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse(asOf)), false);
  assert.equal(coverageOnDay(person(s, b), tb, isoDateSchema.parse(asOf)), true);
  assert.deepEqual(person(s, b), beforeB);
  assert.equal(confirmedValue(title(s, tb, b).employment), "business");
});

test("dwa etaty jednej osoby mają inne ID i niezależne dane", () => {
  let s = employment(employed(), a, t2, "employee");
  s = coverage(s, a, t1, "first", true);
  s = coverage(s, a, t2, "second", false);
  assert.equal(person(s).titles.length, 2);
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse(asOf)), true);
  assert.equal(coverageOnDay(person(s), t2, isoDateSchema.parse(asOf)), false);
  s = ok(changeActivePerson(s, a, t2));
  assert.deepEqual(s.navigation.activeSubject, { kind: "person", personId: a, titleId: t2 });
});

test("false jest potwierdzoną odpowiedzią i nie wraca jako brak", () => {
  let s = ok(deferInterviewQuestion(employed(), prompt(employed(), "timing")));
  s = answer(s, "need", false);
  assert.equal(person(s).sicknessCheck?.state, "confirmed");
  assert.equal(confirmedValue(person(s).sicknessCheck), false);
  assert.equal(s.interview.mode, "finished");
  assert.equal(
    getInterviewHandoff(s).missing.some(({ question }) => question.id === "need"),
    false,
  );
});

test("unknown, deferred i brak są odrębne; wznowienie ponawia niepewne pytania raz", () => {
  const initial = pregnant();
  assert.equal(person(initial).workSituation, undefined);
  let s = ok(markInterviewAnswerUnknown(initial, prompt(initial)));
  s = ok(deferInterviewQuestion(s, prompt(s)));
  assert.equal(person(s).workSituation?.state, "unknown");
  assert.equal(s.family.dueDate?.state, "deferred");
  s = resumeInterview(finishInterview(s));
  assert.equal(prompt(s).id, "employment");
  s = ok(markInterviewAnswerUnknown(s, prompt(s)));
  assert.equal(prompt(s).id, "timing");
});

test("pomijanie nieaktywnego pytania i stara kontrolka nie zmieniają danych", () => {
  const before = pregnant();
  const old = prompt(before);
  const s = answer(before, "employment", { kind: "employee" });
  const stale = deferInterviewQuestion(s, old);
  assert.equal(stale.ok, false);
  assert.equal(stale.session, s);
  const inactive: QuestionRef = { id: "need", personId: a, promptRevision: s.contextRevision };
  assert.equal(markInterviewAnswerUnknown(s, inactive).ok, false);
  assert.equal(answerInterviewQuestion(s, inactive, false).ok, false);
});

test("korekta ciąża → planowanie zmienia gałąź, zachowując pracę i historię terminu", () => {
  let s = answer(employed(), "timing", { kind: "date", date: "2027-02-12" });
  s = answer(edit(s, "stage"), "stage", "planning");
  assert.equal(getInterviewRoute(s), "planning");
  assert.equal(s.family.dueDate?.state, "stale");
  assert.equal(confirmedValue(s.family.dueDate), undefined);
  assert.equal(confirmedValue(title(s).employment), "employee");
  assert.equal(getNextInterviewQuestion(s), undefined);
});

test("korekta etatu na brak pracy unieważnia ten tytuł, a powrót tworzy świadomie nowy", () => {
  let s = coverage(employed(), a, t1, "current", true);
  s = answer(edit(s, "employment"), "employment", { kind: "notWorking" });
  assert.equal(confirmedValue(person(s).workSituation), "notWorking");
  assert.equal(title(s).employment?.state, "stale");
  assert.equal(title(s).sicknessCoverage[0].fact.state, "stale");
  s = answer(edit(s, "employment"), "employment", { kind: "contract", titleId: t2 });
  assert.equal(confirmedValue(title(s, t2).employment), "contract");
  assert.equal(person(s).workSituation?.state, "stale");
});

test("korekta tytułu A1 unieważnia tylko zależne dane właściwego tytułu i okresu", () => {
  let s = answer(twoPeople(), "employment", { kind: "business", titleId: tb });
  s = employment(s, a, t2, "employee");
  s = coverage(s, a, t1, "today", true);
  s = coverage(s, a, t1, "historical", true, day("2026-01-01"));
  s = coverage(s, a, t2, "second", false);
  s = coverage(s, b, tb, "partner", true);
  s = {
    ...s,
    assessments: [
      assessment(s, a, t1, "affected"),
      assessment(s, a, t2, "other-title"),
      assessment(s, b, tb, "other-person"),
      assessment(s, a, t1, "other-day", "2026-01-01"),
    ],
  };
  const old = s;
  s = employment(s, a, t1, "contract");
  assert.equal(title(s).sicknessCoverage.find(({ id }) => id === "today")?.fact.state, "stale");
  assert.equal(
    title(s).sicknessCoverage.find(({ id }) => id === "historical")?.fact.state,
    "confirmed",
  );
  assert.deepEqual(person(s, b), person(old, b));
  assert.deepEqual(title(s, t2), title(old, t2));
  assert.equal(s.assessments[0].result?.state, "stale");
  const changed = s.assessments[0];
  assert.equal(changed.kind, "calculator");
  if (changed.kind === "calculator") {
    assert.equal(changed.details.basis?.state, "stale");
    assert.equal(changed.details.from?.state, "confirmed");
  }
  assert.deepEqual(s.assessments.slice(1), old.assessments.slice(1));
});

test("idempotentne potwierdzenie tego samego tytułu nie unieważnia dowodów i wyniku", () => {
  let s = coverage(employed(), a, t1, "coverage", true);
  s = { ...s, assessments: [assessment(s, a, t1, "current")] };
  const same = employment(s, a, t1, "employee");
  assert.equal(same.contextRevision, s.contextRevision);
  assert.deepEqual(same.persons, s.persons);
  assert.deepEqual(same.assessments, s.assessments);
});

test("informacja o chorobowym na dzień lub okres nie przechodzi na inny dzień", () => {
  let s = coverage(employed(), a, t1, "day", false, day("2026-11-01"));
  s = coverage(s, a, t1, "period", true, period("2026-11-20", "2026-11-22"));
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse("2026-11-01")), false);
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse("2026-11-02")), undefined);
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse("2026-11-20")), true);
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse("2026-11-23")), undefined);
});

test("niedatowane chorobowe i założenie nie są dowodem rzeczywistego ubezpieczenia", () => {
  let s = coverage(employed(), a, t1, "undated", true, { kind: "undated" });
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse(asOf)), undefined);
  s = coverage(s, a, t1, "forecast", false, day("2027-02-12"), "assumed");
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse("2027-02-12")), undefined);
  assert.equal(coverageOnDay(person(s), t1, isoDateSchema.parse("2027-02-12"), "assumed"), false);
});

test("sprzeczne deklaracje na ten sam tytuł i dzień wymagają jawnej korekty", () => {
  const s = coverage(employed(), a, t1, "first", true);
  const result = applyConfirmedFacts(s, {
    kind: "coverage",
    baseRevision: s.contextRevision,
    personId: a,
    titleId: t1,
    coverageId: "conflict",
    value: false,
    validTime: day(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.session, s);
  const corrected = coverage(s, a, t1, "first", false);
  assert.equal(coverageOnDay(person(corrected), t1, isoDateSchema.parse(asOf)), false);
});

test("zmiana terminu na rzeczywiste narodziny unieważnia prognozy, bez kopiowania daty", () => {
  let s = answer(employed(), "timing", { kind: "date", date: asOf });
  s = coverage(s, a, t1, "future", true, day(), "assumed");
  s = coverage(s, a, t1, "evidence", false, day("2026-11-01"));
  const check = assessment(s, a, t1, "forecast");
  assert.equal(check.kind, "calculator");
  s = {
    ...s,
    family: { ...s.family, childrenCount: fact(2, "assumed") },
    assessments: [
      check.kind === "calculator"
        ? { ...check, details: { ...check.details, basis: fact(600_000, "assumed") } }
        : check,
    ],
  };
  s = answer(edit(s, "stage"), "stage", "born");
  assert.equal(s.family.dueDate?.state, "stale");
  assert.deepEqual(s.family.children, []);
  assert.equal(s.family.childrenCount?.state, "stale");
  assert.equal(title(s).sicknessCoverage.find(({ id }) => id === "future")?.fact.state, "stale");
  assert.equal(
    title(s).sicknessCoverage.find(({ id }) => id === "evidence")?.fact.state,
    "confirmed",
  );
  assert.equal(confirmedValue(title(s).employment), "employee");
  assert.equal(prompt(s).id, "timing");
  assert.equal(interviewQuestionText(prompt(s)), questions.birthDate.label);
  s = answer(s, "timing", { kind: "date", date: asOf });
  assert.equal(confirmedValue(s.family.children[0].birth), asOf);
  const result = s.assessments[0];
  if (result.kind === "calculator") assert.equal(result.details.basis?.state, "stale");
});

test("narodziny bez daty zachowują etap, bez terminu ani fikcyjnego urodzenia", () => {
  let s = answer(subject(), "stage", "born");
  s = ok(markInterviewAnswerUnknown(s, prompt(s, "employment")));
  s = ok(markInterviewAnswerUnknown(s, prompt(s, "timing")));
  assert.equal(confirmedValue(s.family.stage), "born");
  assert.equal(s.family.children[0].birth?.state, "unknown");
  assert.equal(s.family.dueDate, undefined);
  assert.equal(s.interview.mode, "finished");
});

for (const route of ["adoption", "foster", "loss"] as const) {
  test(`${route} kieruje do ścieżki szczególnej bez dalszych pytań o standardowy poród`, () => {
    const s = answer(subject(start(), a, "guardian"), "stage", route);
    assert.equal(getInterviewRoute(s), route);
    assert.equal(s.interview.mode, "finished");
    assert.equal(getNextInterviewQuestion(s), undefined);
    assert.equal(s.family.dueDate, undefined);
    assert.deepEqual(s.family.children, []);
    assert.deepEqual(person(s).titles, []);
  });
}

test("wczesne dopasowanie działa nawet przed pierwszą odpowiedzią; wznowienie zachowuje fakty", () => {
  const empty = finishInterview(start());
  assert.equal(empty.navigation.view, "discovery");
  assert.equal(empty.interview.mode, "paused");
  assert.equal(getInterviewHandoff(empty).missing.length, 2);
  assert.equal(prompt(resumeInterview(empty)).id, "subject");
  const s = employed();
  const finished = finishInterview(s);
  assert.deepEqual(finished.persons, s.persons);
  assert.equal(finished.navigation.view, "discovery");
  assert.equal(prompt(resumeInterview(finished)).id, "timing");
});

test("przerwanie i powrót po pomocy nie zmieniają pytania ani faktów", () => {
  const s = employed();
  const paused = pauseInterview(s);
  assert.equal(
    answerInterviewQuestion(paused, prompt(paused), { kind: "date", date: asOf }).ok,
    false,
  );
  const resumed = resumeInterview(paused);
  assert.equal(prompt(resumed).id, "timing");
  assert.deepEqual(resumed.family, s.family);
  assert.deepEqual(resumed.persons, s.persons);
  assert.notEqual(prompt(resumed).promptRevision, prompt(s).promptRevision);
  const request = beginInterviewOperation(s, "explanation");
  const explained = ok(acceptInterviewOperation(request.session, request.token));
  assert.deepEqual(explained.interview.active, s.interview.active);
  assert.equal(explained.contextRevision, s.contextRevision);
});

test("anulowanie edycji nie zmienia faktów; zapis wraca do przerwanego celu", () => {
  const s = finishInterview(employed());
  const editing = edit(s, "stage");
  assert.deepEqual(editing.family, s.family);
  const cancelled = cancelInterviewRevision(editing);
  assert.deepEqual(cancelled.family, s.family);
  assert.deepEqual(cancelled.persons, s.persons);
  assert.equal(cancelled.navigation.view, "discovery");
  const updated = answer(edit(s, "stage"), "stage", "born");
  assert.equal(updated.navigation.view, "discovery");
  assert.equal(confirmedValue(updated.family.stage), "born");
});

test("token jest jednorazowy, izolowany między sesjami i odporny na ponowne requestId", () => {
  const first = beginInterviewOperation(start(), "same-id");
  const accepted = ok(acceptInterviewOperation(first.session, first.token));
  assert.equal(acceptInterviewOperation(accepted, first.token).ok, false);
  const second = beginInterviewOperation(accepted, "same-id");
  assert.equal(acceptInterviewOperation(second.session, first.token).ok, false);
  assert.equal(
    acceptInterviewOperation(second.session, { ...second.token, sessionId: "other" }).ok,
    false,
  );
  assert.equal(acceptInterviewOperation(second.session, second.token).ok, true);
});

test("stare operacje są odrzucane po odpowiedzi, korekcie, zmianie osoby i przerwaniu", () => {
  const pending = beginInterviewOperation(employed(), "old");
  const changed = answer(pending.session, "timing", { kind: "period", period: "middle" });
  const states = [
    changed,
    edit(pending.session, "stage"),
    pauseInterview(pending.session),
    finishInterview(pending.session),
  ];
  for (const state of states)
    assert.equal(acceptInterviewOperation(state, pending.token).ok, false);
  const two = answer(twoPeople(), "employment", { kind: "business", titleId: tb });
  const request = beginInterviewOperation(two, "person-switch");
  assert.equal(
    acceptInterviewOperation(ok(changeActivePerson(request.session, a, t1)), request.token).ok,
    false,
  );
  const staleWrite = applyConfirmedFacts(changed, {
    kind: "coverage",
    baseRevision: pending.token.contextRevision,
    personId: a,
    titleId: t1,
    coverageId: "late",
    value: true,
    validTime: day(),
  });
  assert.equal(staleWrite.ok, false);
  assert.equal(staleWrite.session, changed);
});

test("walidacja odrzuca nieprawidłowe daty, okresy, typy i propozycje bez potwierdzenia", () => {
  const s = employed();
  for (const value of [
    { kind: "date", date: "2027-02-30" },
    { kind: "date", date: "22.11" },
    { kind: "date", date: "1899-01-01" },
    { status: "proposed", kind: "date", date: "2027-01-01" },
  ]) {
    const result = answerInterviewQuestion(s, prompt(s), value);
    assert.equal(result.ok, false);
    assert.equal(result.session, s);
  }
  assert.equal(validTimeSchema.safeParse(period("2026-11-23", "2026-11-22")).success, false);
  assert.equal(
    answerInterviewQuestion(pregnant(), prompt(pregnant()), { kind: "employee", extra: true }).ok,
    false,
  );
  const born = answer(answer(subject(), "stage", "born"), "employment", { kind: "notWorking" });
  assert.equal(
    answerInterviewQuestion(born, prompt(born), { kind: "date", date: "2026-11-23" }).ok,
    false,
  );
  assert.equal(
    answerInterviewQuestion(born, prompt(born), { kind: "period", period: "early" }).ok,
    false,
  );
});

test("trymestr jest orientacją i nigdy nie staje się datą", () => {
  const s = answer(employed(), "timing", { kind: "period", period: "middle" });
  assert.equal(confirmedValue(s.family.pregnancyPeriod), "middle");
  assert.equal(s.family.dueDate, undefined);
  assert.equal(prompt(s).id, "need");
});

test("bank jest typowany i parsuje tylko całe jednoznaczne odpowiedzi", () => {
  const ref = prompt(pregnant());
  assert.deepEqual(readInterviewAnswer(ref, "etat"), {
    kind: "answer",
    id: "employment",
    value: { kind: "employee" },
  });
  assert.deepEqual(readInterviewAnswer(ref, "Nie wiem"), { kind: "unknown" });
  assert.deepEqual(readInterviewAnswer(ref, "Później"), { kind: "deferred" });
  for (const text of [
    "partner na etacie",
    "chyba etat",
    "etat, ale nie wiem czy mam chorobowe",
    "Nie wiem, czy partner ma etat",
  ])
    assert.equal(readInterviewAnswer(ref, text), undefined);
  const timing = prompt(employed());
  assert.deepEqual(readInterviewAnswer(timing, "12.02.2027"), {
    kind: "answer",
    id: "timing",
    value: { kind: "date", date: "2027-02-12" },
  });
  assert.equal(readInterviewAnswer(timing, "12 lutego"), undefined);
  const need = prompt(ok(deferInterviewQuestion(employed(), timing)));
  assert.deepEqual(readInterviewAnswer(need, "Nie"), { kind: "answer", id: "need", value: false });
  for (const definition of Object.values(interviewQuestions)) {
    assert.ok(definition.why.length > 0);
    assert.ok(definition.simple.length > 0);
    assert.equal(definition.canDefer, true);
  }
});

test("referencje nie mogą mieszać osób, tytułów i zdarzeń", () => {
  const s = employed();
  assert.equal(
    isValidTarget(s, {
      eventId: s.family.event.id,
      subject: { kind: "person", personId: a, titleId: t1 },
      childIds: [],
    }),
    true,
  );
  assert.equal(
    isValidTarget(s, {
      eventId: eventIdSchema.parse("other"),
      subject: { kind: "family" },
      childIds: [],
    }),
    false,
  );
  assert.equal(
    isValidTarget(s, {
      eventId: s.family.event.id,
      subject: { kind: "person", personId: b, titleId: t1 },
      childIds: [],
    }),
    false,
  );
  assert.equal(changeActivePerson(s, b).ok, false);
  assert.equal(changeActivePerson(s, a, t2).ok, false);
  assert.equal(
    applyConfirmedFacts(s, {
      kind: "coverage",
      baseRevision: s.contextRevision,
      personId: b,
      titleId: t1,
      coverageId: "wrong",
      value: true,
      validTime: day(),
    }).ok,
    false,
  );
  assert.equal(employment(s, a, t2, "employee").persons.length, 1);
  const two = twoPeople();
  assert.equal(
    applyConfirmedFacts(two, {
      kind: "employment",
      baseRevision: two.contextRevision,
      personId: b,
      titleId: t1,
      value: "employee",
      validTime: day(),
    }).ok,
    false,
  );
});

test("wybór istniejącej osoby nie tworzy duplikatu ani nie przenosi faktów", () => {
  let s = answer(twoPeople(), "employment", { kind: "business", titleId: tb });
  s = answer(edit(s, "subject"), "subject", {
    speaker: "helper",
    subject: { kind: "person", personId: a },
  });
  assert.equal(s.persons.length, 2);
  assert.equal(confirmedValue(title(s).employment), "employee");
  assert.equal(confirmedValue(title(s, tb, b).employment), "business");
  assert.equal(s.navigation.speaker?.kind, "helper");
});

test("rejestry własności obejmują każdy klucz obecnych modeli", () => {
  assert.deepEqual(Object.keys(profileOwnership).sort(), Object.keys(questions).sort());
  assert.deepEqual(
    Object.keys(caseFactOwnership).sort(),
    Object.keys(caseFactsSchema.shape).sort(),
  );
  assert.equal(caseFactOwnership.insured, "projection");
  assert.equal(caseFactOwnership.otherParentDays, "projection");
  assert.equal(profileOwnership.otherParentEmployment, "projection");
});

test("przejścia są deterministyczne i nie modyfikują zamrożonego wejścia", () => {
  const s = employed();
  const before = structuredClone(s);
  freeze(s);
  const one = answerInterviewQuestion(s, prompt(s), { kind: "date", date: "2027-02-12" });
  const two = answerInterviewQuestion(s, prompt(s), { kind: "date", date: "2027-02-12" });
  assert.deepEqual(one, two);
  assert.deepEqual(s, before);
  const covered = coverage(s, a, t1, "frozen", false);
  assert.notEqual(covered, s);
  assert.deepEqual(s, before);
});

test("korekta zakończonego planowania otwiera nową aktywną gałąź", () => {
  const planning = answer(subject(), "stage", "planning");
  const born = answer(edit(planning, "stage"), "stage", "born");
  assert.equal(born.interview.mode, "asking");
  assert.equal(prompt(born).id, "employment");
  assert.equal(confirmedValue(born.family.stage), "born");
});

test("idempotentna edycja zachowuje dowody, ale unieważnia token starego promptu", () => {
  const s = coverage(employed(), a, t1, "evidence", true);
  const editing = beginInterviewOperation(edit(s, "employment"), "editing-help");
  const saved = answer(editing.session, "employment", { kind: "employee" });
  assert.deepEqual(saved.persons, s.persons);
  assert.equal(prompt(saved).id, "timing");
  assert.ok(saved.contextRevision > editing.token.contextRevision);
  assert.equal(acceptInterviewOperation(saved, editing.token).ok, false);
});

test("Nie wiem przy korekcie konkretnego tytułu nie wraca w pętli ani nie unieważnia innego dnia", () => {
  let s = coverage(employed(), a, t1, "today", true);
  s = coverage(s, a, t1, "historical", false, day("2026-01-01"));
  s = edit(s, "employment");
  s = ok(markInterviewAnswerUnknown(s, prompt(s)));
  assert.equal(title(s).employment?.state, "unknown");
  assert.equal(title(s).sicknessCoverage.find(({ id }) => id === "today")?.fact.state, "stale");
  assert.equal(
    title(s).sicknessCoverage.find(({ id }) => id === "historical")?.fact.state,
    "confirmed",
  );
  assert.equal(prompt(s).id, "timing");
  assert.equal(prompt(resumeInterview(finishInterview(s))).id, "employment");
});

test("korekta pracy obejmującej okres zachowuje ten sam zakres, gdy nie podano nowego", () => {
  const employmentPeriod = period("2026-01-01", "2026-11-22");
  let s = employment(employed(), a, t1, "employee", employmentPeriod);
  s = answer(edit(s, "employment"), "employment", { kind: "contract" });
  const value = title(s).employment;
  assert.ok(value?.state === "confirmed");
  assert.deepEqual(value.validTime, employmentPeriod);
});

test("ten sam identyfikator dowodu nie może zmienić dnia nawet po unieważnieniu", () => {
  const s = employment(coverage(employed(), a, t1, "same-proof", true), a, t1, "contract");
  const result = applyConfirmedFacts(s, {
    kind: "coverage",
    baseRevision: s.contextRevision,
    personId: a,
    titleId: t1,
    coverageId: "same-proof",
    value: true,
    validTime: day("2026-11-21"),
  });
  assert.equal(result.ok, false);
  assert.equal(result.session, s);
});

test("przyszłe chorobowe wymaga jawnego założenia; prognoza nie udaje rzeczywistych narodzin", () => {
  const s = employed();
  assert.equal(
    applyConfirmedFacts(s, {
      kind: "coverage",
      baseRevision: s.contextRevision,
      personId: a,
      titleId: t1,
      coverageId: "future",
      value: true,
      validTime: day("2027-02-01"),
    }).ok,
    false,
  );
  const forecast = coverage(s, a, t1, "future", true, day("2027-02-01"), "assumed");
  assert.equal(coverageOnDay(person(forecast), t1, isoDateSchema.parse("2027-02-01")), undefined);
  const born = answer(answer(subject(), "stage", "born"), "employment", { kind: "notWorking" });
  assert.equal(
    answerInterviewQuestion(born, prompt(born), { kind: "date", date: asOf }, { basis: "assumed" })
      .ok,
    false,
  );
});

test("historyczny zakończony tytuł może współistnieć z brakiem pracy bez utraty dowodów", () => {
  let s = employed();
  s = {
    ...s,
    navigation: { ...s.navigation, activeSubject: { kind: "person", personId: a } },
    persons: s.persons.map((p) => ({
      ...p,
      titles: p.titles.map((t) => ({
        ...t,
        employment: {
          state: "confirmed",
          value: "employee",
          revision: 1,
          source,
          basis: "observed",
          validTime: period("2026-01-01", asOf),
        },
        ended: fact(isoDateSchema.parse("2026-11-21")),
      })),
    })),
  };
  const originalTitle = title(s);
  // Resume recalculates the cursor from facts, including the end of employment.
  s = resumeInterview(pauseInterview(s));
  assert.equal(prompt(s).id, "employment");
  s = answer(s, "employment", { kind: "notWorking" });
  assert.deepEqual(title(s), originalTitle);
  assert.equal(confirmedValue(person(s).workSituation), "notWorking");
});

test("sprostowanie roli tej samej osoby nie zostawia roli osoby rodzącej i nie rusza pracy", () => {
  let s = employed();
  s = answer(edit(s, "subject"), "subject", {
    speaker: "self",
    subject: { kind: "person", personId: a, role: "otherParent" },
  });
  assert.deepEqual(person(s).roles, ["otherParent"]);
  assert.equal(confirmedValue(title(s).employment), "employee");
  s = ok(deferInterviewQuestion(s, prompt(s, "timing")));
  assert.equal(s.interview.mode, "finished");
});

test("korekta rodzaju zdarzenia unieważnia dane przyjęcia i liczbę z innego zakresu", () => {
  let s = answer(subject(), "stage", "adoption");
  s = {
    ...s,
    family: {
      ...s.family,
      childrenCount: fact(2),
      eventFacts: { careAccepted: fact("2026-11-01"), courtApplication: fact("2026-10-01") },
    },
  };
  s = answer(edit(s, "stage"), "stage", "born");
  assert.equal(s.family.eventFacts.careAccepted?.state, "stale");
  assert.equal(s.family.eventFacts.courtApplication?.state, "stale");
  assert.equal(s.family.childrenCount?.state, "stale");
  assert.equal(getInterviewRoute(s), "standard");
});

test("zależny wynik B może być stale bez unieważnienia jego niezależnych finansów", () => {
  let s = answer(twoPeople(), "employment", { kind: "business", titleId: tb });
  const check = assessment(s, b, tb, "related");
  s = {
    ...s,
    assessments: [
      {
        ...check,
        result: check.result && {
          ...check.result,
          dependencies: [
            {
              ref: {
                kind: "title",
                personId: a,
                titleId: t1,
                field: "employment",
                validTime: day(),
              },
              revision: 1,
            },
          ],
        },
      },
    ],
  };
  const original = s.assessments[0];
  s = employment(s, a, t1, "contract");
  const changed = s.assessments[0];
  assert.equal(changed.result?.state, "stale");
  if (changed.kind === "calculator" && original.kind === "calculator")
    assert.deepEqual(changed.details, original.details);
  assert.equal(confirmedValue(title(s, tb, b).employment), "business");
});

test("porównanie wskazuje dwa osobne cele i unieważnia wynik po zmianie jednego", () => {
  let s = answer(twoPeople(), "employment", { kind: "business", titleId: tb });
  const first = assessment(s, a, t1, "first").target;
  const second = assessment(s, b, tb, "second").target;
  s = {
    ...s,
    assessments: [
      {
        id: assessmentIdSchema.parse("comparison"),
        kind: "comparison",
        target: first,
        first,
        second,
        asOf: isoDateSchema.parse(asOf),
        inputRevision: s.contextRevision,
        goal: "calculation",
        state: "draft",
        options: { weeks: fact(20), otherWeeks: fact(12) },
      },
    ],
  };
  const oldB = person(s, b);
  s = employment(s, b, tb, "contract");
  assert.equal(s.assessments[0].state, "stale");
  assert.equal(confirmedValue(title(s).employment), "employee");
  assert.notDeepEqual(person(s, b), oldB);
  assert.equal(s.assessments[0].kind, "comparison");
});

test("potwierdzony zapis zachowuje źródło i sprawdza metadane dokumentu", () => {
  const s = pregnant();
  const pdfSource = { kind: "pdf", documentId: "local-document", page: 2 } as const;
  // Sources from external input are validated together with the value.
  const documentId = documentIdSchema.parse("local-document");
  const confirmed = ok(
    answerInterviewQuestion(
      s,
      prompt(s),
      { kind: "contract", titleId: t1 },
      { source: { ...pdfSource, documentId } },
    ),
  );
  const employmentFact = title(confirmed).employment;
  assert.ok(employmentFact?.state === "confirmed");
  assert.deepEqual(employmentFact.source, pdfSource);
  assert.deepEqual(employmentFact.validTime, day());
  assert.equal(
    answerInterviewQuestion(
      s,
      prompt(s),
      { kind: "contract", titleId: t1 },
      { source: { kind: "pdf", documentId, page: 0 } },
    ).ok,
    false,
  );
});

test("korekta roli unieważnia osobową ocenę, zachowując jej finanse i dane drugiej osoby", () => {
  let s = answer(twoPeople(), "employment", { kind: "business", titleId: tb });
  s = { ...s, assessments: [assessment(s, a, t1, "a-check"), assessment(s, b, tb, "b-check")] };
  const oldB = person(s, b);
  const bCheck = s.assessments[1];
  s = answer(edit(s, "subject"), "subject", {
    speaker: "self",
    subject: { kind: "person", personId: a, role: "guardian" },
  });
  assert.equal(s.assessments[0].result?.state, "stale");
  const aCheck = s.assessments[0];
  if (aCheck.kind === "calculator") assert.equal(aCheck.details.basis?.state, "confirmed");
  assert.deepEqual(s.assessments[1], bCheck);
  assert.deepEqual(person(s, b), oldB);
});

test("założone zatrudnienie wymaga ponownego potwierdzenia po zmianie etapu", () => {
  let s = ok(
    answerInterviewQuestion(
      pregnant(),
      prompt(pregnant()),
      { kind: "employee", titleId: t1 },
      { basis: "assumed" },
    ),
  );
  s = answer(edit(s, "stage"), "stage", "born");
  assert.equal(title(s).employment?.state, "stale");
  assert.equal(prompt(s).id, "employment");
});

test("zmiana osoby po ukończeniu wywiadu otwiera jej brakujące pytania bez kopiowania pracy", () => {
  let s = twoPeople();
  s = ok(markInterviewAnswerUnknown(s, prompt(s, "employment")));
  s = ok(deferInterviewQuestion(s, prompt(s, "timing")));
  assert.equal(s.interview.mode, "finished");
  s = ok(changeActivePerson(s, a, t1));
  assert.equal(confirmedValue(title(s).employment), "employee");
  assert.equal(person(s, b).workSituation?.state, "unknown");
  assert.equal(prompt(s).id, "need");
});

test("nieustalona osoba i etap nie oznaczają planowania ani odmowy praw", () => {
  let s = ok(markInterviewAnswerUnknown(start(), prompt(start(), "subject")));
  s = ok(deferInterviewQuestion(s, prompt(s, "stage")));
  assert.equal(getInterviewRoute(s), "undetermined");
  assert.equal(s.interview.mode, "finished");
  assert.deepEqual(s.persons, []);
  assert.deepEqual(
    getInterviewHandoff(s).missing.map(({ state }) => state),
    ["unknown", "deferred"],
  );
  assert.equal(prompt(resumeInterview(s)).id, "subject");
});

test("przewidywany termin, który już minął, nie zmienia ciąży w narodziny", () => {
  const s = answer(employed(), "timing", { kind: "date", date: "2026-11-20" });
  assert.equal(confirmedValue(s.family.dueDate), "2026-11-20");
  assert.equal(confirmedValue(s.family.stage), "pregnant");
  assert.deepEqual(s.family.children, []);
});

test("powtórne potwierdzenie tego samego chorobowego nie tworzy drugiej kopii faktu", () => {
  const s = coverage(employed(), a, t1, "first", true);
  const repeated = coverage(s, a, t1, "second", true);
  assert.equal(repeated.contextRevision, s.contextRevision);
  assert.equal(title(repeated).sicknessCoverage.length, 1);
  const corrected = coverage(repeated, a, t1, "first", false);
  assert.equal(coverageOnDay(person(corrected), t1, isoDateSchema.parse(asOf)), false);
});

test("jawne anulowanie odrzuca spóźnioną operację także po ukończeniu wywiadu", () => {
  const completed = answer(subject(), "stage", "planning");
  const pending = beginInterviewOperation(completed, "late-help");
  const cancelled = cancelInterviewOperation(pending.session);
  assert.equal(acceptInterviewOperation(cancelled, pending.token).ok, false);
  assert.deepEqual(cancelled.family, completed.family);
  assert.deepEqual(cancelled.persons, completed.persons);
  assert.equal(cancelled.interview.mode, "finished");
});

test("automatyczny identyfikator nowego tytułu nie nadpisuje wcześniej wskazanego tytułu", () => {
  const initial = pregnant();
  const historicalId = titleIdSchema.parse(`${a}:title:${initial.contextRevision + 2}`);
  const historical = employment(initial, a, historicalId, "employee", day("2026-01-01"));
  const oldTitle = title(historical, historicalId);
  const current = answer(historical, "employment", { kind: "contract" });
  assert.equal(person(current).titles.length, 2);
  assert.deepEqual(title(current, historicalId), oldTitle);
  assert.equal(
    person(current).titles.some(
      (t) => t.id !== historicalId && confirmedValue(t.employment) === "contract",
    ),
    true,
  );
});

test("korekta dzisiejszego zatrudnienia zachowuje szczegół oceny potwierdzony na inny dzień", () => {
  let s = employed();
  const check = assessment(s, a, t1, "historical-detail");
  const historicalBasis: Fact<number> = {
    state: "confirmed",
    value: 500_000,
    revision: 1,
    source,
    basis: "observed",
    validTime: day("2026-01-01"),
  };
  s = {
    ...s,
    assessments: [{ ...check, details: { basis: historicalBasis, payer: fact("zus") } }],
  };
  s = employment(s, a, t1, "contract");
  const result = s.assessments[0];
  assert.equal(result.result?.state, "stale");
  if (result.kind === "calculator") {
    assert.deepEqual(result.details.basis, historicalBasis);
    assert.equal(result.details.payer?.state, "stale");
  }
});
