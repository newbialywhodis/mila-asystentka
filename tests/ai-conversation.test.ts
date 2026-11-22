import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAssistantRequest } from "../src/features/parent/case-assistant-context";
import {
  appendAssessment,
  getParentCase,
  newSession,
  saveFacts,
} from "../src/features/parent/case-session";
import type { CaseSession } from "../src/features/parent/case-session";
import {
  proposeFacts,
  confirmFactProposal,
  rejectFactProposal,
  proposalIsCurrent,
} from "../src/features/parent/fact-proposals";
import type { ProposalSelection } from "../src/features/parent/fact-proposals";
import { factCandidateSchema, candidateScope } from "../src/features/parent/intent-contract";
import type { FactCandidate } from "../src/features/parent/intent-contract";
import {
  assistantActionSchema,
  assistantRequestSchema,
  caseActionFromIntent,
  modelIntentSchema,
  normalizeAssistantRequest,
} from "../src/features/parent/parent-intent";
import { cancelInterviewOperation } from "../src/features/parent/interview-session";
import {
  isoDateSchema,
  personIdSchema,
  titleIdSchema,
  confirmedValue,
  coverageOnDay,
} from "../src/features/parent/family-session";
import { routeConversationCommand } from "../src/features/parent/conversation-routing";
import { explainCurrentResult } from "../src/features/parent/result-explanation";
import { showInterview } from "../src/features/parent/workspace-session";
import { discoverProcedures } from "../src/engine/discover-procedures";
import { readFact } from "../src/features/parent/case-fields";
import { documentSuggestions, validateDocumentRead } from "../src/features/parent/case-documents";
import { calculatorSession } from "./workspace-fixture";

const asOf = "2026-11-22";
const p1 = personIdSchema.parse("fictional-a");
const p2 = personIdSchema.parse("fictional-b");
function session(): CaseSession {
  const s = newSession("stage4");
  return showInterview({
    ...s,
    asOf,
    data: {
      ...s.data,
      asOf: isoDateSchema.parse(asOf),
      persons: [
        { id: p1, roles: ["birthing"], titles: [], procedureFacts: {} },
        { id: p2, roles: ["otherParent"], titles: [], procedureFacts: {} },
      ],
      navigation: { view: "start", activeSubject: { kind: "person", personId: p1 } },
    },
  });
}
function candidate(
  field: FactCandidate["field"],
  value: FactCandidate["value"],
  overrides: Partial<FactCandidate> = {},
): FactCandidate {
  return factCandidateSchema.parse({
    field,
    value,
    scope: candidateScope(field),
    person: candidateScope(field) === "family" ? null : "subject",
    title: null,
    validTime: { kind: "undated" },
    certainty: "stated",
    unit: ["basis"].includes(field) ? "grosz" : "none",
    ...overrides,
  });
}
function prepare(s: CaseSession, candidates: FactCandidate[]) {
  const proposed = proposeFacts(s, candidates);
  assert.ok(proposed.pendingProposal);
  return { s: proposed, proposal: proposed.pendingProposal };
}
function selection(
  index: number,
  c: FactCandidate,
  person = c.scope === "family" ? "" : String(p1),
  title = "",
): ProposalSelection {
  return { index, candidate: c, person, title, explicitlyConfirmed: true };
}

test("v2: jedna wypowiedź, kilka propozycji; przypuszczenie nie zapisuje się razem ze stwierdzeniami", () => {
  const candidates = [
    candidate("stage", "pregnant"),
    candidate("employment", "contract"),
    candidate("insured", false, { certainty: "tentative" }),
  ];
  const base = session();
  const { s, proposal } = prepare(base, candidates);
  assert.deepEqual(s.data, base.data);
  const saved = confirmFactProposal(s, proposal, [
    selection(0, candidates[0]),
    selection(1, candidates[1], p1, "new:1"),
  ]);
  assert.equal(saved.error, undefined);
  assert.equal(confirmedValue(saved.session.data.family.stage), "pregnant");
  assert.equal(confirmedValue(saved.session.data.persons[0].titles[0].employment), "contract");
  assert.equal(saved.session.data.persons[0].titles[0].sicknessCoverage.length, 0);
  assert.equal(saved.session.view, "discovery");
  assert.ok(discoverProcedures(saved.session.data).results.length);
  const resumed = showInterview(saved.session, true);
  assert.equal(resumed.data.interview.active?.id, "timing");
  assert.equal(saved.session.pendingProposal, undefined);
});

test("atomowość: błąd osoby, daty, tytułu lub brak dnia ubezpieczenia wycofuje cały wybrany zestaw", () => {
  const cs = [
    candidate("stage", "pregnant"),
    candidate("employment", "contract"),
    candidate("insured", false, { certainty: "tentative" }),
  ];
  const { s, proposal } = prepare(session(), cs);
  const selections = cs.map((c, i) =>
    selection(i, c, c.scope === "family" ? "" : p1, c.scope === "family" ? "" : "new:1"),
  );
  for (const invalid of [
    selections,
    selections.map((r, i) => (i === 1 ? { ...r, person: "unknown-person" } : r)),
    selections.map((r, i) => (i === 1 ? { ...r, title: "foreign-title" } : r)),
    selections.map((r, i) =>
      i === 2
        ? {
            ...r,
            candidate: { ...r.candidate, validTime: { kind: "day" as const, day: "2026-02-31" } },
          }
        : r,
    ),
  ]) {
    const result = confirmFactProposal(s, proposal, invalid);
    assert.ok(result.error);
    assert.equal(result.session, s);
    assert.equal(result.session.data.family.stage, undefined);
  }
});

test("dwóch rodziców: dwa zatrudnienia i brak automatycznego ojcostwa lub przenoszenia aktywnej osoby", () => {
  const cs = [
    candidate("employment", "contract"),
    candidate("employment", "business", { person: "related" }),
  ];
  const { s, proposal } = prepare(session(), cs);
  const saved = confirmFactProposal(s, proposal, [
    selection(0, cs[0], p1, "new:0"),
    selection(1, cs[1], p2, "new:1"),
  ]);
  assert.equal(saved.error, undefined);
  assert.equal(confirmedValue(saved.session.data.persons[0].titles[0].employment), "contract");
  assert.equal(confirmedValue(saved.session.data.persons[1].titles[0].employment), "business");
  assert.equal(saved.session.data.persons[1].father, undefined);
  assert.deepEqual(
    saved.session.data.navigation.activeSubject,
    session().data.navigation.activeSubject,
  );
});

test("dwa tytuły tej samej osoby i jawny okres ubezpieczenia nie scalają się", () => {
  const cs = [
    candidate("employment", "employee"),
    candidate("employment", "contract"),
    candidate("insured", false, { validTime: { kind: "day", day: isoDateSchema.parse(asOf) } }),
  ];
  const { s, proposal } = prepare(session(), cs);
  const saved = confirmFactProposal(s, proposal, [
    selection(0, cs[0], p1, "new:0"),
    selection(1, cs[1], p1, "new:1"),
    selection(2, cs[2], p1, "new:1"),
  ]);
  assert.equal(saved.error, undefined);
  const person = saved.session.data.persons[0];
  assert.equal(person.titles.length, 2);
  assert.equal(coverageOnDay(person, person.titles[0].id, isoDateSchema.parse(asOf)), undefined);
  assert.equal(coverageOnDay(person, person.titles[1].id, isoDateSchema.parse(asOf)), false);
});

test("nowa osoba wymaga lokalnego wyboru roli; przypuszczenie wymaga jawnego potwierdzenia", () => {
  const cs = [candidate("employment", "business", { person: null, certainty: "tentative" })];
  const { s, proposal } = prepare(newSession("new-owner"), cs);
  assert.ok(
    confirmFactProposal(s, proposal, [
      { ...selection(0, cs[0], "new:otherParent", "new:0"), explicitlyConfirmed: false },
    ]).error,
  );
  const saved = confirmFactProposal(s, proposal, [selection(0, cs[0], "new:otherParent", "new:0")]);
  assert.equal(saved.error, undefined);
  assert.equal(saved.session.data.persons.length, 1);
  assert.deepEqual(saved.session.data.persons[0].roles, ["otherParent"]);
  assert.equal(saved.session.data.persons[0].father, undefined);
});

test("wybrane pola, poprawka wartości, odrzucenie i ponowne użycie propozycji", () => {
  const cs = [candidate("stage", "pregnant"), candidate("employment", "contract")];
  const { s, proposal } = prepare(session(), cs);
  const rejected = rejectFactProposal(s, proposal);
  assert.equal(rejected.pendingProposal, undefined);
  assert.deepEqual(rejected.data, s.data);
  const result = confirmFactProposal(s, proposal, [
    selection(1, candidate("employment", "employee"), p1, "new:1"),
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.session.data.family.stage, undefined);
  assert.equal(confirmedValue(result.session.data.persons[0].titles[0].employment), "employee");
  assert.ok(
    confirmFactProposal(result.session, proposal, [selection(1, cs[1], p1, "new:1")]).error,
  );
});

test("spóźniona propozycja po zmianie pytania, sesji, osoby, sprawy i prywatności nie zapisuje danych", () => {
  const { s, proposal } = prepare(session(), [candidate("stage", "pregnant")]);
  const variants: CaseSession[] = [
    { ...s, data: cancelInterviewOperation(s.data) },
    { ...s, data: { ...s.data, id: "another-session" } },
    {
      ...s,
      data: {
        ...s.data,
        navigation: { ...s.data.navigation, activeSubject: { kind: "person", personId: p2 } },
      },
    },
    { ...s, view: "discovery" },
    { ...s, privacy: "localDocuments" },
    { ...s, goal: "application" },
    { ...s, activeAssessmentId: calculatorSession("paternity").activeAssessmentId },
  ];
  for (const next of variants) {
    assert.equal(proposalIsCurrent(next, proposal), false);
    assert.equal(
      confirmFactProposal(next, proposal, [selection(0, proposal.candidates[0])]).session,
      next,
    );
  }
});

test("błędne klucze, zakres, jednostki, ISO i aliasy odpadają na granicach kontraktu", () => {
  const c = candidate("insured", false, { certainty: "tentative" });
  for (const invalid of [
    { ...c, field: "__proto__" },
    { ...c, person: "arbitrary-id" },
    { ...c, title: "arbitrary-title" },
    { ...c, scope: "family" },
    { ...c, value: "false" },
    { ...c, validTime: { kind: "period", from: "2026-11-22", through: "2026-11-21" } },
    { ...c, validTime: { kind: "day", day: "2026-02-30" } },
    { ...candidate("basis", 600000), unit: "PLN" },
  ])
    assert.equal(factCandidateSchema.safeParse(invalid).success, false);
  assert.equal(readFact("basis", "6000 g"), undefined);
  assert.equal(readFact("basis", "6000 zł")?.basis, 600000);
  assert.equal(
    assistantActionSchema.safeParse({
      kind: "assess",
      benefit: null,
      goal: "calculation",
      facts: { insured: true },
    }).success,
    false,
  );
});

test("adapter modelu konwertuje typy i zakres; odrzuca nadmiar, nawigację z faktami oraz niedozwolone aliasy", () => {
  const context = buildAssistantRequest(session(), "Test").context;
  const wire = {
    field: "insured",
    value: "false",
    evidence: "nie mam chorobowego",
    person: "subject",
    title: null,
    validTime: { kind: "undated", from: null, through: null },
    certainty: "tentative",
    unit: "none",
  };
  const output = (entries: object[], intent = "answer") =>
    modelIntentSchema.parse({ action: { kind: "interpret", intent, candidates: entries } });
  const action = caseActionFromIntent(output([wire]), context);
  assert.equal(action.kind, "interpret");
  if (action.kind === "interpret")
    assert.deepEqual(
      action.candidates[0],
      candidate("insured", false, { certainty: "tentative", evidence: "nie mam chorobowego" }),
    );
  assert.throws(() =>
    caseActionFromIntent(output(Array.from({ length: 13 }, () => wire)), context),
  );
  assert.throws(() => caseActionFromIntent(output([wire], "showMatches"), context));
  assert.throws(() => caseActionFromIntent(output([{ ...wire, title: "selected" }]), context));
});

test("v1 na wejściu przechodzi przez tę samą normalizację v2; nie wysyła ID i wartości", () => {
  const normalized = normalizeAssistantRequest(
    assistantRequestSchema.parse({
      messages: [{ role: "user", content: "Witaj" }],
      context: { benefit: null, goal: "calculation", pending: null, confirmed: [] },
    }),
  );
  assert.equal(normalized.version, 2);
  const s = appendAssessment(
    saveFacts(calculatorSession("paternity", asOf), {
      birth: "2026-08-12",
      from: "2026-11-02",
      through: "2026-11-15",
      employment: "employee",
      insured: true,
      paternityUsed: "none",
      basis: 600000,
      payer: "zus",
    }),
  );
  const request = buildAssistantRequest(s, "Skąd ta kwota?");
  assert.equal(request.context.mode, "result");
  assert.ok(request.context.confirmed.includes("basis"));
  assert.doesNotMatch(
    JSON.stringify(request),
    /600000|140000|2026-08-12|2026-11-02|fixture:person|assessment:|contextRevision|documentId/,
  );
  assert.throws(() =>
    buildAssistantRequest({ ...s, privacy: "localDocuments" }, "Prywatne pytanie"),
  );
});

test("pomoc w wywiadzie zachowuje pytanie, nieznane odpowiedzi i zmiana osoby używają lokalnych przejść", () => {
  const s = session();
  for (const question of [
    "Co to znaczy ubezpieczenie chorobowe?",
    "Dlaczego mnie o to pytasz?",
    "Nie rozumiem tego pytania",
  ]) {
    const next = routeConversationCommand(s, question);
    assert.ok(next);
    assert.deepEqual(next.data.interview.active, s.data.interview.active);
  }
  assert.equal(routeConversationCommand(s, "Pokaż mi już możliwe świadczenia")?.view, "discovery");
  assert.equal(
    routeConversationCommand(s, "Nie znam odpowiedzi, sprawdźmy coś innego")?.view,
    "discovery",
  );
  const changed = routeConversationCommand(s, "Właściwie chodzi o mojego męża.");
  assert.equal(changed?.data.interview.active?.id, "subject");
  assert.equal(changed?.data.persons[1].father, undefined);
});

test("wyjaśnienie kwoty i podstawy pochodzi ze snapshotu, korekta unieważnia stare uzasadnienie", () => {
  const s = appendAssessment(
    saveFacts(calculatorSession("paternity", asOf), {
      birth: "2026-08-12",
      from: "2026-11-02",
      through: "2026-11-15",
      employment: "employee",
      insured: true,
      paternityUsed: "none",
      basis: 600000,
      payer: "zus",
    }),
  );
  const explained = explainCurrentResult(s);
  const turn = explained.turns.at(-1);
  assert.equal(turn?.kind, "explanation");
  if (turn?.kind !== "explanation") return;
  assert.match(turn.text, /6\s?000,00\s*zł/);
  assert.match(turn.text, /200,00\s*zł/);
  assert.match(turn.text, /14 dni/);
  assert.match(turn.text, /2\s?800,00\s*zł/);
  assert.match(turn.text, /Płatnik: ZUS/);
  assert.equal(
    explained.turns.filter((t) => t.kind === "assessment").length,
    s.turns.filter((t) => t.kind === "assessment").length,
  );
  const corrected = saveFacts(explained, { basis: 660000 });
  assert.equal(
    corrected.data.assessments.find((a) => a.id === s.activeAssessmentId)?.result?.state,
    "stale",
  );
  assert.equal(explainCurrentResult(corrected).turns.at(-1)?.kind, "note");
  const { s: proposed, proposal } = prepare(s, [candidate("basis", 660000)]);
  const subject = proposed.data.navigation.activeSubject;
  assert.ok(subject?.kind === "person");
  const saved = confirmFactProposal(proposed, proposal, [
    selection(0, proposal.candidates[0], subject.personId, proposed.data.persons[0].titles[0].id),
  ]);
  assert.equal(saved.error, undefined);
  assert.equal(getParentCase(saved.session).facts.basis, 660000);
});

test("OCR: identyczna wartość innej osoby lub innego dnia pozostaje oddzielną propozycją", () => {
  const read = validateDocumentRead({
    kind: "payerCertificate",
    requestedBenefit: null,
    decisions: [],
    candidates: [
      {
        key: "insured",
        value: true,
        page: 1,
        personId: p1,
        titleId: titleIdSchema.parse("a"),
        coverage: { day: "2026-11-02", employment: "employee" },
      },
      {
        key: "insured",
        value: true,
        page: 1,
        personId: p2,
        titleId: titleIdSchema.parse("b"),
        coverage: { day: "2026-11-03", employment: "employee" },
      },
    ],
  });
  assert.ok(read);
  const groups = documentSuggestions(read, { insured: true }, asOf);
  assert.equal(groups[0].length, 2);
  assert.equal(validateDocumentRead({ ...read, kind: "decision" })?.candidates.length, 0);
});
import { guardModelCandidates } from "../src/features/parent/intent-contract";
import { matchesDocumentTarget } from "../src/features/parent/case-documents";
import {
  documentIsActive,
  continueWithDocument,
  append,
  selectBenefit,
} from "../src/features/parent/case-session";

test("kontrola znaczenia: mąż pracuje to nie ja, przypuszczenie nie jest pewnością, okres wymaga źródłowej daty", () => {
  const base = session();
  const context = buildAssistantRequest(
    {
      ...base,
      data: {
        ...base.data,
        navigation: { ...base.data.navigation, speaker: { kind: "self", personId: p1 } },
      },
    },
    "test",
  ).context;
  const employment = candidate("employment", "employee", { evidence: "Mój mąż pracuje na etacie" });
  assert.equal(
    guardModelCandidates([employment], "Mój mąż pracuje na etacie, nie ja", context)[0].person,
    null,
  );
  const insured = candidate("insured", false, {
    evidence: "nie mam chorobowego",
    certainty: "stated",
  });
  assert.equal(
    guardModelCandidates([insured], "Chyba nie mam chorobowego", context)[0].certainty,
    "tentative",
  );
  assert.throws(() =>
    guardModelCandidates(
      [{ ...insured, validTime: { kind: "day", day: isoDateSchema.parse(asOf) } }],
      "Chyba nie mam chorobowego",
      context,
    ),
  );
  assert.throws(() =>
    guardModelCandidates(
      [candidate("employment", "notWorking", { evidence: "nie ja" })],
      "To mój mąż prowadzi działalność, nie ja",
      context,
    ),
  );
  assert.throws(() =>
    guardModelCandidates(
      [candidate("basis", 600000, { evidence: "podstawa 6000 kg" })],
      "Moja podstawa 6000 kg",
      context,
    ),
  );
  const wire = {
    field: "employment",
    value: "notWorking",
    evidence: "nie ja",
    person: "subject",
    title: null,
    validTime: { kind: "undated", from: null, through: null },
    certainty: "stated",
    unit: "none",
  };
  const modeled = modelIntentSchema.parse({
    action: { kind: "interpret", intent: "correct", candidates: [wire] },
  });
  assert.deepEqual(
    caseActionFromIntent(modeled, context, "To mój mąż prowadzi działalność, nie ja"),
    { kind: "interpret", intent: "switchSubject", candidates: [] },
  );
});

test("data bez roku nie dostaje wymyślonego roku; data rzeczywista nie jest terminem porodu", () => {
  const context = buildAssistantRequest(session(), "test").context;
  const date = {
    field: "birth",
    value: "2026-02-12",
    evidence: "12 lutego",
    person: null,
    title: null,
    validTime: { kind: "undated", from: null, through: null },
    certainty: "stated",
    unit: "none",
  };
  const modeled = modelIntentSchema.parse({
    action: { kind: "interpret", intent: "answer", candidates: [date] },
  });
  assert.equal(
    caseActionFromIntent(modeled, context, "Dziecko urodziło się 12 lutego").kind,
    "reply",
  );
  const full = modelIntentSchema.parse({
    action: {
      kind: "interpret",
      intent: "answer",
      candidates: [{ ...date, evidence: "12 lutego 2026" }],
    },
  });
  const action = caseActionFromIntent(full, context, "Dziecko urodziło się 12 lutego 2026");
  assert.equal(action.kind, "interpret");
  if (action.kind === "interpret") assert.equal(action.candidates[0].value, "2026-02-12");
  assert.throws(() =>
    guardModelCandidates(
      [candidate("dueDate", "2026-02-12", { evidence: "12 lutego 2026" })],
      "Dziecko urodziło się 12 lutego 2026",
      context,
    ),
  );
});

test("korekta ubezpieczenia unieważnia kwotę i nie używa AI do ponownego obliczenia", () => {
  const s = appendAssessment(
    saveFacts(calculatorSession("paternity", asOf), {
      birth: "2026-08-12",
      from: "2026-11-02",
      through: "2026-11-15",
      employment: "employee",
      insured: true,
      paternityUsed: "none",
      basis: 600000,
      payer: "zus",
    }),
  );
  const c = candidate("insured", false, {
    validTime: { kind: "day", day: isoDateSchema.parse("2026-11-02") },
  });
  const { s: proposed, proposal } = prepare(s, [c]);
  const person = proposed.data.persons[0];
  const saved = confirmFactProposal(proposed, proposal, [
    selection(0, c, person.id, person.titles[0].id),
  ]);
  assert.equal(saved.error, undefined);
  assert.equal(getParentCase(saved.session).facts.insured, false);
  const latest = saved.session.turns.at(-1);
  assert.equal(latest?.kind, "assessment");
  if (latest?.kind === "assessment") {
    assert.equal(latest.result.status, "ineligible");
    assert.equal(latest.result.money, undefined);
  }
  const second = appendAssessment(selectBenefit(s, "parental"));
  const returned = routeConversationCommand(second, "Wróć do poprzedniego wyniku");
  assert.equal(returned?.activeAssessmentId, s.activeAssessmentId);
});

test("pomoc katalogowa nie wyłącza oczekującego potwierdzania PDF-u; cudzy cel jest odrzucany", () => {
  const s = calculatorSession("paternity", asOf);
  const document = {
    kind: "document" as const,
    file: new File([], "fictional.pdf"),
    preview: "blob:fiction",
    mode: "local" as const,
    documentId: "fictional-document",
  };
  const waiting = append({ ...s, privacy: "localDocuments" }, document, {
    kind: "help",
    answer: { text: "Ogólna pomoc" },
  });
  assert.equal(documentIsActive(waiting, document), true);
  const target = waiting.data.assessments[0].target;
  const continued = continueWithDocument(waiting, document, {
    target,
    baseRevision: waiting.data.contextRevision,
    assessmentId: waiting.activeAssessmentId,
    benefit: "paternity",
    facts: { birth: "2026-08-12" },
    sources: { birth: { label: "PDF", page: 1 } },
  });
  assert.equal(getParentCase(continued).facts.birth, "2026-08-12");
  assert.equal(
    matchesDocumentTarget(
      { key: "insured", value: true, page: 1, personId: p2 },
      target,
      document.documentId,
    ),
    false,
  );
  assert.equal(
    matchesDocumentTarget(
      {
        key: "insured",
        value: true,
        page: 1,
        validTime: { kind: "day", day: isoDateSchema.parse("2026-11-02") },
      },
      target,
      document.documentId,
    ),
    false,
  );
  assert.equal(continued.privacy, "localDocuments");
});

test("jawna korekta właściciela atomowo wycofuje zapis u A i potwierdza u B, zachowując pochodzenie", () => {
  const c = candidate("employment", "business");
  const initial = prepare(session(), [c]);
  const first = confirmFactProposal(initial.s, initial.proposal, [selection(0, c, p1, "new:0")]);
  assert.equal(first.error, undefined);
  const text = "To mój mąż prowadzi działalność, nie ja";
  const moved = candidate("employment", "business", { person: null, evidence: text });
  const proposed = proposeFacts(first.session, [moved], text);
  const proposal = proposed.pendingProposal;
  assert.ok(proposal);
  const accepted = { ...selection(0, moved, p2, "new:0"), withdrawPrevious: true };
  const invalid = confirmFactProposal(proposed, proposal, [{ ...accepted, person: "unknown" }]);
  assert.equal(invalid.session, proposed);
  assert.equal(proposed.data.persons[0].titles[0].employment?.state, "confirmed");
  const result = confirmFactProposal(proposed, proposal, [accepted]);
  assert.equal(result.error, undefined);
  assert.equal(result.session.data.persons[0].titles[0].employment?.state, "stale");
  assert.equal(confirmedValue(result.session.data.persons[1].titles[0].employment), "business");
  assert.equal(result.session.data.persons[1].father, undefined);
  assert.equal(result.session.view, "discovery");
  assert.equal(
    result.session.data.navigation.activeSubject?.kind === "person" &&
      result.session.data.navigation.activeSubject.personId,
    p2,
  );
  const previous = result.session.data.persons[0].titles[0].employment;
  assert.ok(
    previous &&
      "source" in previous &&
      previous.source.kind === "answer" &&
      previous.source.via === "aiConfirmation",
  );
});
import { procedureExplanationIsCurrent } from "../src/features/parent/result-explanation";
import {
  requestDestination,
  selectScope,
  saveProcedureAnswer,
} from "../src/features/parent/workspace-session";

test("wyjaśnienie formalności używa zapisanego wyniku, terminów i dokumentów, a korekta je unieważnia", () => {
  let s = calculatorSession("paternity", asOf);
  s = selectScope(
    requestDestination(s, { kind: "procedureQuestions", procedureId: "BIRTH_REGISTRATION" }),
    { personId: s.data.persons[0].id, helper: false, father: false },
  );
  s = saveProcedureAnswer(s, "birthRegistered", false);
  s = saveProcedureAnswer(s, "birthCardDate", "2026-11-20");
  const explained = explainCurrentResult(s);
  const turn = explained.turns.at(-1);
  assert.equal(turn?.kind, "procedureExplanation");
  if (turn?.kind !== "procedureExplanation") return;
  assert.match(turn.text, /Zgłoszenie urodzenia/);
  assert.match(turn.text, /11\.12\.2026/);
  assert.equal(procedureExplanationIsCurrent(explained, turn), true);
  const corrected = saveProcedureAnswer(explained, "birthCardDate", "2026-11-21");
  assert.equal(procedureExplanationIsCurrent(corrected, turn), false);
  const request = buildAssistantRequest(explained, "Nie rozumiem");
  assert.doesNotMatch(JSON.stringify(request), /2026-11-20|11\.12\.2026|snapshot|assessedAt/);
});

test("wielopolowe informacje procedury trafiają do rodziny, a fakt drugiej osoby wymaga jej zakresu", () => {
  let family = calculatorSession("paternity", asOf);
  family = selectScope(
    requestDestination(family, { kind: "procedureQuestions", procedureId: "BIRTH_REGISTRATION" }),
    { personId: family.data.persons[0].id, helper: false, father: false },
  );
  const cs = [
    candidate("procedure:birthRegistered", false),
    candidate("procedure:birthCardDate", "2026-11-20"),
  ];
  const proposed = prepare(family, cs);
  const saved = confirmFactProposal(
    proposed.s,
    proposed.proposal,
    cs.map((c, i) => selection(i, c, "")),
  );
  assert.equal(saved.error, undefined);
  assert.equal(confirmedValue(saved.session.data.family.shared.birthRegistered), false);
  assert.equal(confirmedValue(saved.session.data.family.shared.birthCardDate), "2026-11-20");

  let couple = calculatorSession("paternity", asOf);
  couple = {
    ...couple,
    data: {
      ...couple.data,
      persons: [
        ...couple.data.persons,
        { id: p2, roles: ["otherParent"], titles: [], procedureFacts: {} },
      ],
    },
  };
  const firstId = couple.data.persons[0].id;
  couple = selectScope(
    requestDestination(couple, { kind: "procedureQuestions", procedureId: "ACTIVE_PARENT_WORK" }),
    { personId: firstId, relatedPersonId: p2, helper: false, father: false },
  );
  const activity = candidate("procedure:otherWorkActive", true, { person: "related" });
  const pair = prepare(couple, [activity]);
  assert.ok(confirmFactProposal(pair.s, pair.proposal, [selection(0, activity, firstId)]).error);
  const correct = confirmFactProposal(pair.s, pair.proposal, [selection(0, activity, p2)]);
  assert.equal(correct.error, undefined);
  const assessment = correct.session.data.assessments.find(
    (a) => a.id === couple.activeAssessmentId,
  );
  assert.ok(assessment?.kind === "procedure");
  assert.equal(confirmedValue(assessment.details.otherWorkActive), true);
});

test("dwa tytuły tego samego typu nie są scalane z powodu identycznej wartości", () => {
  const context = buildAssistantRequest(session(), "test").context;
  const text = "Mam etat w firmie A i etat w firmie B";
  const wire = (evidence: string) => ({
    field: "employment",
    value: "employee",
    evidence,
    person: "subject",
    title: null,
    validTime: { kind: "undated", from: null, through: null },
    certainty: "stated",
    unit: "none",
  });
  const action = caseActionFromIntent(
    modelIntentSchema.parse({
      action: {
        kind: "interpret",
        intent: "answer",
        candidates: [wire("etat w firmie A"), wire("etat w firmie B")],
      },
    }),
    context,
    text,
  );
  assert.equal(action.kind, "interpret");
  if (action.kind !== "interpret") return;
  assert.equal(action.candidates.length, 2);
  const { s, proposal } = prepare(session(), action.candidates);
  const result = confirmFactProposal(s, proposal, [
    selection(0, action.candidates[0], p1, "new:0"),
    selection(1, action.candidates[1], p1, "new:1"),
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.session.data.persons[0].titles.length, 2);
  assert.notEqual(
    result.session.data.persons[0].titles[0].id,
    result.session.data.persons[0].titles[1].id,
  );
});
import { getBenefitTurn } from "../src/features/parent/case-session";

test("potwierdzona data urodzenia wiąże nowy rekord dziecka z aktywnym kalkulatorem i nie wraca jako brak", () => {
  const s = appendAssessment(calculatorSession("paternity", asOf));
  const birth = candidate("birth", "2026-08-12");
  const prepared = prepare(s, [birth]);
  const result = confirmFactProposal(prepared.s, prepared.proposal, [selection(0, birth)]);
  assert.equal(result.error, undefined);
  assert.equal(getParentCase(result.session).facts.birth, "2026-08-12");
  const turn = getBenefitTurn(result.session);
  assert.equal(turn?.kind, "assessment");
  if (turn?.kind === "assessment") assert.equal(turn.question?.key, "from");
});
