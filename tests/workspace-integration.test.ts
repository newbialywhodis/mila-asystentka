import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../src/app/api/parent-document/route";
import { calculatorTools, discoveryDefinitions } from "../src/data/discovery";
import { discoverProcedures } from "../src/engine/discover-procedures";
import { assessBenefit } from "../src/engine/parent-benefit";
import type { Benefit, CaseFacts } from "../src/engine/parent-case";
import { documentSuggestions, acceptedDocumentFact } from "../src/features/parent/case-documents";
import {
  append,
  appendAssessment,
  continueWithDocument,
  getAssessment,
  getParentCase,
  newSession,
  saveFacts,
  selectBenefit,
  setSessionDemoRate,
  assessmentTurnIsCurrent,
} from "../src/features/parent/case-session";
import type { AttachedDocument, CaseSession } from "../src/features/parent/case-session";
import {
  confirmedValue,
  isValidTarget,
  isoDateSchema,
  personIdSchema,
  titleIdSchema,
} from "../src/features/parent/family-session";
import type { PersonRole } from "../src/features/parent/family-session";
import {
  applyConfirmedFacts,
  cancelInterviewOperation,
} from "../src/features/parent/interview-session";
import { toCaseFacts } from "../src/features/parent/interview-profile";
import {
  answerInterview,
  editInterview,
  interviewText,
  pauseWorkspaceInterview,
  procedureProjection,
  requestDestination,
  saveProcedureAnswer,
  selectScope,
  showDiscovery,
  showInterview,
} from "../src/features/parent/workspace-session";
import { calculatorSession } from "./workspace-fixture";
import { confirmComparison } from "../src/features/parent/comparison-session";
import { careComparisonExample } from "../src/features/parent/parent-examples";
import { refreshSnapshots } from "../src/features/parent/result-snapshots";

const asOf = "2026-11-22";
const a = personIdSchema.parse("a");
function answer(s: CaseSession, value: unknown, state?: "unknown" | "deferred") {
  const ref = s.data.interview.active;
  assert.ok(ref);
  return answerInterview(s, ref, value, JSON.stringify(value) ?? "Pomiń", state);
}
function interviewed(
  stage = "pregnant",
  employment = "employee",
  role: PersonRole = "birthing",
  helper = false,
) {
  let s = newSession("integration");
  s = showInterview({ ...s, asOf, data: { ...s.data, asOf: isoDateSchema.parse(asOf) } });
  s = answer(s, {
    speaker: helper ? "helper" : "self",
    subject: { kind: "person", personId: a, role },
  });
  s = answer(s, stage);
  if (s.data.interview.active?.id === "employment") s = answer(s, { kind: employment });
  return s;
}
function open(s: CaseSession, benefit: Benefit, id = a) {
  return selectScope(requestDestination(s, { kind: "calculator", benefit }), {
    personId: id,
    helper: false,
    father:
      benefit === "paternity" || benefit === "adoptivePaternity" || benefit === "maternityTransfer",
  });
}

test("pusty czat → wywiad → dopasowanie → prognoza macierzyńskiego → kolejna sprawa", () => {
  let s = interviewed();
  s = answer(s, { kind: "date", date: "2027-02-12" });
  s = answer(s, false);
  assert.equal(s.view, "discovery");
  const discovery = discoverProcedures(s.data);
  assert.ok(discovery.items.length <= 4);
  assert.ok(discovery.results.some((r) => r.procedureId === "MATERNITY_ALLOWANCE"));
  s = open(s, "maternity");
  assert.equal(getParentCase(s).facts.dueDate, "2027-02-12");
  assert.notEqual(getAssessment(s)?.question?.key, "dueDate");
  s = appendAssessment(
    saveFacts(s, {
      employment: "employee",
      insured: true,
      children: 1,
      basis: 600_000,
      payer: "zus",
    }),
  );
  assert.equal(getAssessment(s)?.result.money?.total, 2_800_000);
  assert.equal(getAssessment(s)?.result.projected, true);
  const id = s.activeAssessmentId;
  const snapshot = s.data.assessments.find((x) => x.id === id)?.result;
  assert.equal(snapshot?.assessmentId, id);
  assert.ok(
    snapshot?.assessedAt && snapshot.engineVersion && snapshot.projectionDependencies?.length,
  );
  assert.deepEqual(snapshot?.result, assessBenefit("maternity", getParentCase(s).facts, asOf));
  s = showDiscovery({ ...s, tasks: ["my-task"] });
  s = open(s, "sickness");
  assert.notEqual(s.activeAssessmentId, id);
  assert.equal(getParentCase(s).facts.basis, undefined);
  assert.equal(confirmedValue(s.data.family.dueDate), "2027-02-12");
  assert.deepEqual(s.tasks, ["my-task"]);
  s = open(showDiscovery(s), "maternity");
  assert.equal(s.activeAssessmentId, id);
  assert.equal(getAssessment(s)?.result.money?.total, 2_800_000);
});

test("zlecenie z nieznanym chorobowym nie staje się potwierdzonym prawem", () => {
  let s = interviewed("born", "contract");
  s = answer(s, { kind: "date", date: "2026-11-18" });
  s = open(s, "maternity");
  s = saveFacts(s, { employment: "contract" });
  assert.equal(getAssessment(s)?.question?.key, "insured");
  assert.equal(getParentCase(s).facts.insured, undefined);
});

test("przerwanie, wznowienie, wyjaśnienie i złożony tekst zachowują aktywne pytanie", () => {
  let s = interviewed();
  const question = s.data.interview.active;
  s = interviewText(s, "Dlaczego o to pytasz?");
  assert.deepEqual(s.data.interview.active, question);
  s = interviewText(s, "Mąż pracuje na zleceniu, ja na etacie, termin mam w lutym");
  assert.deepEqual(s.data.interview.active, question);
  assert.equal(s.data.persons.length, 1);
  s = showInterview(pauseWorkspaceInterview(s), true);
  assert.equal(s.data.interview.active?.id, "timing");
  s = answer(s, undefined, "unknown");
  assert.equal(s.data.interview.active?.id, "need");
  assert.equal(showDiscovery(s).view, "discovery");
});

test("planowanie i nieznany etap mają różne ścieżki, narodziny nie wymagają daty", () => {
  const planning = interviewed("planning");
  assert.equal(discoverProcedures(planning.data).planning?.kind, "planning");
  assert.equal(planning.data.assessments.length, 0);
  const unknown = showDiscovery(newSession());
  assert.equal(discoverProcedures(unknown.data).contextRequired, true);
  assert.equal(discoverProcedures(unknown.data).items.length, 0);
  let born = interviewed("born");
  born = answer(born, undefined, "deferred");
  assert.equal(discoverProcedures(born.data).route, "standard");
  assert.equal(confirmedValue(born.data.family.children[0]?.birth), undefined);
  assert.ok(discoverProcedures(born.data).items.length);
});

for (const [stage, benefit] of [
  ["adoption", "careMaternity"],
  ["foster", "careMaternity"],
  ["loss", "lossMaternity"],
] as const) {
  test(`${stage}: właściwe skierowanie bez standardowych formalności porodu`, () => {
    const s = interviewed(stage);
    const discovery = discoverProcedures(s.data);
    assert.equal(discovery.results.length, 0);
    assert.ok(discovery.referrals.some((r) => r.action.benefit === benefit));
    assert.equal(open(s, benefit).view, "calculator");
  });
}

test("pomoc partnerowi i drugi rodzic nie przejmują danych osoby pomagającej", () => {
  const s = interviewed("pregnant", "contract", "otherParent", true);
  assert.equal(s.data.navigation.speaker?.kind, "helper");
  assert.equal(s.data.persons.length, 1);
  assert.deepEqual(s.data.persons[0].roles, ["otherParent"]);
  assert.equal(confirmedValue(s.data.persons[0].titles[0].employment), "contract");
  assert.notEqual(s.data.interview.active?.id, "need");
});

test("podstawy, tytuły i ubezpieczenie nie przechodzą do innej osoby", () => {
  let s = appendAssessment(
    saveFacts(calculatorSession("maternity", asOf), {
      birth: "2026-11-18",
      employment: "employee",
      insured: true,
      children: 1,
      basis: 600_000,
      payer: "zus",
      standardRate: true,
    }),
  );
  const first = s.data.persons[0].id;
  const firstAssessment = s.activeAssessmentId;
  s = editInterview(showDiscovery(s), { id: "subject", eventId: s.data.family.event.id });
  s = answer(s, { speaker: "self", subject: { kind: "person", personId: a, role: "otherParent" } });
  s = open(s, "paternity");
  s = saveFacts(s, { from: "2026-11-20", employment: "contract" });
  assert.equal(getParentCase(s).facts.birth, "2026-11-18");
  assert.equal(getParentCase(s).facts.basis, undefined);
  assert.equal(getParentCase(s).facts.insured, undefined);
  assert.equal(s.data.assessments.find((x) => x.id === firstAssessment)?.result?.state, "current");
  assert.equal(
    confirmedValue(s.data.persons.find((p) => p.id === first)?.titles[0].employment),
    "employee",
  );
});

test("korekta terminu unieważnia snapshot; niezależny fakt procedury go zachowuje", () => {
  let s = appendAssessment(
    saveFacts(calculatorSession("maternity", asOf), {
      birth: "2026-11-18",
      employment: "employee",
      insured: true,
      children: 1,
      basis: 600_000,
      payer: "zus",
      standardRate: true,
    }),
  );
  const old = s.data.assessments[0].result;
  assert.equal(old?.state, "current");
  const originalDate = old?.input;
  s = saveFacts(s, { birth: "2026-11-19" });
  assert.equal(s.data.assessments[0].result?.state, "stale");
  assert.deepEqual(old?.input, originalDate);
  assert.equal(getAssessment(s)?.result.money, undefined);
});

test("formalność korzysta z banku pytań i unknown nie zapętla rozmowy", () => {
  let s = interviewed("born");
  s = answer(s, undefined, "deferred");
  s = selectScope(requestDestination(s, discoveryDefinitions.BIRTH_REGISTRATION.action), {
    personId: a,
    helper: false,
    father: false,
  });
  let p = procedureProjection(s);
  assert.ok(p?.missing);
  for (let i = 0; i < 8 && p?.missing; i++) {
    s = saveProcedureAnswer(s, p.missing, undefined, "unknown");
    p = procedureProjection(s);
  }
  assert.equal(p?.missing, undefined);
  assert.equal(p?.result.procedure.id, "BIRTH_REGISTRATION");
  assert.equal(s.data.assessments.at(-1)?.kind, "procedure");
});

test("odhaczone zadanie nie staje się faktem prawnym; powrót zachowuje zadania", () => {
  let s = interviewed("born");
  s = { ...s, tasks: ["CHILD_HEALTH_INSURANCE"] };
  s = showDiscovery(s);
  assert.deepEqual(s.tasks, ["CHILD_HEALTH_INSURANCE"]);
  assert.equal("healthRegistered" in (s.data.family.children[0]?.facts ?? {}), false);
});

test("hospitalizacja wprowadzana w dwóch pytaniach składa się w kanoniczny pobyt", () => {
  let s = calculatorSession("supplement", asOf);
  s = saveFacts(s, { birth: "2026-10-01", hospitalFrom: "2026-10-01" });
  assert.equal(getParentCase(s).facts.hospitalFrom, "2026-10-01");
  s = saveFacts(s, { hospitalThrough: "2026-10-20" });
  assert.equal(getParentCase(s).facts.hospitalRanges, "2026-10-01/2026-10-20");
});

test("PDF wymaga aktualnej rewizji i celu; konflikt zachowuje wybór oraz identyfikator źródła", () => {
  const document: AttachedDocument = {
    kind: "document",
    mode: "local",
    file: new File([], "own.pdf"),
    preview: "blob:test",
    documentId: "pdf-1",
  };
  const s = append(
    saveFacts(calculatorSession("maternity", asOf), { birth: "2026-11-18" }),
    document,
  );
  const source = acceptedDocumentFact("birth", "2026-11-19", 3).source;
  const read = {
    kind: "birthRecord" as const,
    requestedBenefit: null,
    candidates: [{ key: "birth" as const, value: "2026-11-19", page: 3 }],
    decisions: [],
  };
  assert.equal(documentSuggestions(read, getParentCase(s).facts, asOf)[0]?.[0].value, "2026-11-19");
  const data = {
    assessmentId: s.activeAssessmentId,
    baseRevision: s.data.contextRevision,
    benefit: null,
    facts: { birth: "2026-11-19" },
    sources: source,
  };
  const late = { ...s, data: cancelInterviewOperation(s.data) };
  assert.equal(continueWithDocument(late, document, data), late);
  assert.equal(continueWithDocument(s, document, { ...data, assessmentId: undefined }), s);
  const saved = continueWithDocument(s, document, data);
  assert.equal(getParentCase(saved).facts.birth, "2026-11-19");
  assert.deepEqual(
    saved.data.family.children[0].birth?.state === "confirmed" &&
      saved.data.family.children[0].birth.source,
    { kind: "pdf", documentId: "pdf-1", page: 3 },
  );
});

test("upload PDF jest zablokowany niezależnie od konfiguracji", async () => {
  const previous = process.env.MILA_PDF_UPLOAD_ALLOWED;
  try {
    process.env.MILA_PDF_UPLOAD_ALLOWED = "1";
    const response = await POST();
    assert.equal(response.status, 403);
    assert.match(JSON.stringify(await response.json()), /wyłączone/);
  } finally {
    if (previous === undefined) delete process.env.MILA_PDF_UPLOAD_ALLOWED;
    else process.env.MILA_PDF_UPLOAD_ALLOWED = previous;
  }
});

test("różne rozmowy mają odrębne ID i nie współdzielą assessmentów", () => {
  const first = newSession();
  const second = newSession();
  assert.notEqual(first.data.id, second.data.id);
  assert.notEqual(first.data.family.event.id, second.data.family.event.id);
  assert.notEqual(first.data.assessments, second.data.assessments);
});

test("granica zapisu odrzuca obcy assessment i dane poza zakresem", () => {
  const s = calculatorSession("maternity", asOf);
  assert.equal(
    applyConfirmedFacts(s.data, {
      kind: "caseFacts",
      baseRevision: s.data.contextRevision - 1,
      assessmentId: s.activeAssessmentId!,
      facts: { basis: 100_000 },
    }).ok,
    false,
  );
  assert.equal(
    applyConfirmedFacts(s.data, {
      kind: "caseFacts",
      baseRevision: s.data.contextRevision,
      assessmentId: s.activeAssessmentId!,
      facts: { birth: "2028-01-01" },
    }).ok,
    false,
  );
  assert.equal(Object.keys(calculatorTools).length, 12);
  assert.equal(selectBenefit(s, "maternity").activeAssessmentId, s.activeAssessmentId);
  assert.equal(toCaseFacts(s.data, s.activeAssessmentId!).value.basis, undefined);
  assert.ok(titleIdSchema.parse("separate-title"));
});

test("nowy tytuł tej samej osoby ma osobny assessment i nie unieważnia niezależnego wyniku", () => {
  let s = appendAssessment(
    saveFacts(calculatorSession("maternity", asOf), {
      birth: "2026-11-18",
      employment: "employee",
      insured: true,
      children: 1,
      basis: 600_000,
      payer: "zus",
      standardRate: true,
    }),
  );
  const firstAssessment = s.activeAssessmentId;
  const person = s.data.persons[0];
  const newTitle = titleIdSchema.parse("second-title");
  s = selectScope(
    requestDestination(showDiscovery(s), { kind: "calculator", benefit: "maternity" }),
    { personId: person.id, titleId: newTitle, newTitle: true, helper: false, father: false },
  );
  assert.notEqual(s.activeAssessmentId, firstAssessment);
  assert.equal(getParentCase(s).facts.basis, undefined);
  s = saveFacts(s, { employment: "contract" });
  const refreshed = refreshSnapshots(s.data);
  assert.equal(
    refreshed.assessments.find((a) => a.id === firstAssessment)?.result?.state,
    "current",
  );
  assert.equal(refreshed.persons[0].titles.length, 2);
});

test("formalność ojcowskiego wymaga potwierdzenia ojcostwa przed uruchomieniem pytań", () => {
  const s = showDiscovery(interviewed("born", "employee", "otherParent"));
  const chosen = selectScope(requestDestination(s, discoveryDefinitions.PATERNITY_LEAVE.action), {
    personId: a,
    helper: false,
    father: false,
  });
  assert.equal(chosen.view, "scope");
  assert.equal(chosen.data.assessments.length, 0);
});

test("walidacja rodzinnego wnioskodawcy odrzuca nieistniejącą osobę i parę z tą samą osobą", () => {
  const s = interviewed();
  const target = {
    eventId: s.data.family.event.id,
    subject: { kind: "family" as const },
    childIds: [],
  };
  assert.equal(
    isValidTarget(s.data, { ...target, applicantId: personIdSchema.parse("foreign") }),
    false,
  );
  assert.equal(isValidTarget(s.data, { ...target, applicantId: a, relatedPersonId: a }), false);
  assert.equal(isValidTarget(s.data, { ...target, applicantId: a }), true);
});

test("potwierdzenie zdrowotnego dotyczy wskazanego zgłaszającego i jego tytułu", () => {
  let s = interviewed("born");
  s = answer(s, { kind: "date", date: "2026-11-18" });
  s = selectScope(requestDestination(s, discoveryDefinitions.CHILD_HEALTH_INSURANCE.action), {
    personId: a,
    helper: false,
    father: false,
  });
  s = saveProcedureAnswer(s, "healthTitle", true);
  assert.equal(procedureProjection(s)?.projection.value.healthTitle, true);
  const second = personIdSchema.parse("another-applicant");
  s = {
    ...s,
    data: {
      ...s.data,
      persons: [
        ...s.data.persons,
        { id: second, roles: ["otherParent"], titles: [], procedureFacts: {} },
      ],
    },
  };
  s = selectScope(
    requestDestination(showDiscovery(s), discoveryDefinitions.CHILD_HEALTH_INSURANCE.action),
    { personId: second, helper: false, father: false },
  );
  assert.equal(procedureProjection(s)?.projection.value.healthTitle, undefined);
  assert.equal(s.data.assessments.filter((a) => a.kind === "procedure").length, 2);
});

const calculatorInputs: Record<Benefit, CaseFacts> = {
  maternity: {
    birth: "2026-08-12",
    children: 1,
    employment: "employee",
    insured: true,
    basis: 600_000,
    payer: "zus",
    standardRate: true,
  },
  paternity: {
    birth: "2026-08-12",
    from: "2026-11-02",
    through: "2026-11-08",
    employment: "employee",
    insured: true,
    basis: 600_000,
    payer: "zus",
    paternityUsed: "none",
  },
  adoptivePaternity: {
    careKind: "adoption",
    adoptionFinal: "2026-10-01",
    birth: "2024-01-01",
    from: "2026-11-02",
    through: "2026-11-08",
    employment: "employee",
    insured: true,
    basis: 600_000,
    payer: "zus",
    paternityUsed: "none",
  },
  parental: {
    birth: "2026-04-12",
    children: 1,
    from: "2026-11-02",
    through: "2026-11-08",
    employment: "employee",
    insured: true,
    basis: 600_000,
    payer: "zus",
    parts: 0,
    usedDays: 0,
    otherParentDays: 0,
    careCertificate: false,
    soleParent: false,
    reserved: false,
    standardRate: true,
  },
  supplement: {
    birth: "2026-10-01",
    children: 1,
    maternityEnd: "2026-11-01",
    supplementCare: false,
    gestationalWeeks: 27,
    birthWeightGrams: 900,
    hospitalRanges: "2026-10-01/2026-10-20",
    from: "2026-11-02",
    employment: "employee",
    insured: true,
    basis: 600_000,
    payer: "zus",
  },
  sickness: {
    from: "2026-11-01",
    through: "2026-11-10",
    employment: "employee",
    insured: true,
    qualifying: true,
    pregnancyProof: true,
    employerSickPayEnded: true,
    sickDaysUsed: 0,
    basis: 600_000,
    payer: "zus",
  },
  rehabilitation: {
    from: "2026-11-01",
    through: "2026-11-10",
    employment: "employee",
    insured: true,
    pregnancyProof: true,
    sickPeriodExhausted: true,
    sickDaysUsed: 270,
    rehabMedical: true,
    rehabExcluded: false,
    rehabUsed: 0,
    basis: 600_000,
    payer: "zus",
  },
  pregnancyAfterEmployment: {
    dueDate: "2026-12-12",
    from: "2026-11-01",
    through: "2026-11-10",
    employment: "employee",
    employmentEnded: "2026-10-31",
    termination: "employerClosed",
    pregnancyProof: true,
    insured: true,
    alternativeEmployment: false,
    basis: 600_000,
    payer: "zus",
  },
  maternityTransfer: {
    birth: "2026-07-01",
    children: 1,
    from: "2026-10-07",
    employment: "employee",
    insured: true,
    transferReason: "return",
    motherDaysBeforeBirth: 0,
    motherDaysAfterBirth: 98,
    motherInsured: true,
    personalCare: true,
    basis: 600_000,
    payer: "zus",
    standardRate: true,
  },
  careMaternity: {
    careKind: "adoption",
    careAccepted: "2026-10-01",
    courtApplication: "2026-10-01",
    birth: "2024-01-01",
    children: 1,
    schoolDeferral: false,
    previousCareDays: 0,
    previousCareBenefit: false,
    from: "2026-10-01",
    employment: "employee",
    insured: true,
    basis: 600_000,
    payer: "zus",
    standardRate: true,
  },
  careParental: {
    careKind: "adoption",
    careAccepted: "2026-01-01",
    courtApplication: "2026-01-01",
    birth: "2024-01-01",
    children: 1,
    schoolDeferral: false,
    previousCareDays: 140,
    from: "2026-11-01",
    through: "2026-11-07",
    employment: "employee",
    insured: true,
    basis: 600_000,
    payer: "zus",
    parts: 0,
    usedDays: 0,
    otherParentDays: 0,
    careCertificate: false,
    soleParent: false,
    reserved: false,
    standardRate: true,
  },
  lossMaternity: {
    birth: "2026-11-01",
    childDeath: "2026-11-01",
    children: 1,
    survivingChildren: 0,
    employment: "employee",
    insured: true,
    basis: 600_000,
    payer: "zus",
  },
};
for (const benefit of Object.keys(calculatorInputs) as Benefit[]) {
  test(`${benefit}: równoważność adaptera z niezmienionym silnikiem`, () => {
    let s = calculatorSession(benefit, asOf);
    const relatedPersonId = personIdSchema.parse("related");
    s = {
      ...s,
      data: {
        ...s.data,
        persons: [
          ...s.data.persons,
          {
            id: relatedPersonId,
            roles: benefit === "maternityTransfer" ? ["birthing"] : ["otherParent"],
            titles: [],
            procedureFacts: {},
          },
        ],
        assessments: s.data.assessments.map((a) => ({
          ...a,
          target: { ...a.target, relatedPersonId },
        })),
      },
    };
    const facts = calculatorInputs[benefit];
    s = saveFacts(s, facts);
    const original = assessBenefit(benefit, facts, asOf);
    const projected = getAssessment(s)?.result;
    assert.deepEqual(projected, original);
    assert.equal(original.status, "eligible");
    assert.ok(projected?.money);
  });
}

test("zmiana parametrów demo unieważnia historyczny wynik i przelicza tym samym silnikiem", () => {
  let s = calculatorSession("parental", asOf);
  const related = personIdSchema.parse("rule-test-other");
  s = {
    ...s,
    data: {
      ...s.data,
      persons: [
        ...s.data.persons,
        { id: related, roles: ["otherParent"], titles: [], procedureFacts: {} },
      ],
      assessments: s.data.assessments.map((a) => ({
        ...a,
        target: { ...a.target, relatedPersonId: related },
      })),
    },
  };
  s = appendAssessment(saveFacts(s, calculatorInputs.parental));
  const old = s.cursor;
  assert.ok(old?.kind === "assessment");
  s = setSessionDemoRate(s, { from: "2026-01-01", parental: 8000 });
  assert.equal(s.data.assessments[0].result?.state, "stale");
  s = appendAssessment(s);
  assert.equal(assessmentTurnIsCurrent(s, old), false);
  assert.equal(getAssessment(s)?.result.money?.total, 112_000);
  assert.equal(s.data.assessments[0].result?.state, "current");
});

test("porównanie potwierdza odrębne finanse obu osób i zapisuje snapshot wariantu", () => {
  let s = calculatorSession("parental", asOf);
  const first = s.data.persons[0].id;
  const second = personIdSchema.parse("second");
  const firstTitle = titleIdSchema.parse("first-title");
  const secondTitle = titleIdSchema.parse("second-title");
  const employment = {
    state: "confirmed" as const,
    value: "employee" as const,
    revision: 0,
    source: { kind: "demo" as const, label: "test" },
    validTime: { kind: "day" as const, day: isoDateSchema.parse(asOf) },
    basis: "observed" as const,
  };
  s = {
    ...s,
    data: {
      ...s.data,
      persons: [
        { ...s.data.persons[0], titles: [{ id: firstTitle, employment, sicknessCoverage: [] }] },
        {
          id: second,
          roles: ["otherParent"],
          titles: [{ id: secondTitle, employment, sicknessCoverage: [] }],
          procedureFacts: {},
        },
      ],
    },
  };
  const base = { eventId: s.data.family.event.id, childIds: [] };
  s = confirmComparison(
    s,
    { ...careComparisonExample.facts, parts: 0, usedDays: 0, otherParentDays: 0 },
    careComparisonExample.options,
    { ...base, subject: { kind: "person", personId: first, titleId: firstTitle } },
    { ...base, subject: { kind: "person", personId: second, titleId: secondTitle } },
  );
  const comparison = s.data.assessments.find((a) => a.kind === "comparison");
  assert.ok(comparison && comparison.kind === "comparison");
  assert.equal(comparison.result?.state, "current");
  const firstFacts =
    comparison.firstAssessmentId && toCaseFacts(s.data, comparison.firstAssessmentId).value;
  const secondFacts =
    comparison.secondAssessmentId && toCaseFacts(s.data, comparison.secondAssessmentId).value;
  assert.equal(firstFacts && firstFacts.basis, 600_000);
  assert.equal(secondFacts && secondFacts.basis, 450_000);
});
