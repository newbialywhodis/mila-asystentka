import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculatorTools,
  discoveryActionSchema,
  discoveryDefinitions,
  procedureIds,
} from "../src/data/discovery";
import type { ProcedureId } from "../src/data/discovery";
import { procedures } from "../src/data/procedures";
import { discoverProcedures, rankDiscoveredProcedures } from "../src/engine/discover-procedures";
import { evaluateProcedure } from "../src/engine/evaluateProcedure";
import { assessBenefit } from "../src/engine/parent-benefit";
import { benefits } from "../src/engine/parent-case";
import type { Benefit, CaseFacts } from "../src/engine/parent-case";
import { generatePlan } from "../src/engine/plan";
import {
  assessmentIdSchema,
  childIdSchema,
  isoDateSchema,
  personIdSchema,
  titleIdSchema,
} from "../src/features/parent/family-session";
import type {
  Assessment,
  AssessmentTarget,
  Fact,
  InsuranceTitle,
  Person,
  ValidTime,
} from "../src/features/parent/family-session";
import {
  projectionRoute,
  toCaseFacts,
  toProcedureProfile,
} from "../src/features/parent/interview-profile";
import { createInterviewSession } from "../src/features/parent/interview-session";
import type { InterviewSession } from "../src/features/parent/interview-session";
import type { Profile } from "../src/types/profile";

const asOf = "2026-11-22";
const birth = "2026-11-20";
const pa = personIdSchema.parse("a");
const pb = personIdSchema.parse("b");
const ta = titleIdSchema.parse("a-1");
const ta2 = titleIdSchema.parse("a-2");
const tb = titleIdSchema.parse("b-1");
const childId = childIdSchema.parse("child");
const aid = assessmentIdSchema.parse("assessment");
const undated: ValidTime = { kind: "undated" };
const day = (value = asOf): ValidTime => ({ kind: "day", day: isoDateSchema.parse(value) });
const period = (from = "2026-01-01", through = "2027-12-31"): ValidTime => ({
  kind: "period",
  from: isoDateSchema.parse(from),
  through: isoDateSchema.parse(through),
});
function fact<T>(
  value: T,
  validTime: ValidTime = undated,
  basis: "observed" | "assumed" = "observed",
): Fact<T> {
  return {
    state: "confirmed",
    value,
    validTime,
    basis,
    revision: 1,
    source: { kind: "answer", via: "confirmation" },
  };
}
function title(
  employment: NonNullable<CaseFacts["employment"]> = "employee",
  id = ta,
  sicknessCoverage: InsuranceTitle["sicknessCoverage"] = [],
): InsuranceTitle {
  return { id, employment: fact(employment, period()), sicknessCoverage };
}
function parent(
  id = pa,
  roles: Person["roles"] = ["birthing"],
  titles: readonly InsuranceTitle[] = [title()],
): Person {
  return { id, roles, titles, procedureFacts: {} };
}
function session(stage: "pregnant" | "born" = "pregnant", persons = [parent()]): InterviewSession {
  const s = createInterviewSession("discovery", asOf);
  return {
    ...s,
    persons,
    family: {
      ...s.family,
      stage: fact(stage),
      event: { ...s.family.event, kind: fact("birth") },
      dueDate: fact(isoDateSchema.parse("2027-03-01")),
      childrenCount: fact(1),
      children:
        stage === "born"
          ? [{ id: childId, birth: fact(isoDateSchema.parse(birth)), facts: {} }]
          : [],
    },
  };
}
function target(
  s: InterviewSession,
  subject: AssessmentTarget["subject"] = { kind: "person", personId: pa, titleId: ta },
): AssessmentTarget {
  return { eventId: s.family.event.id, subject, childIds: s.family.children.map(({ id }) => id) };
}
function withCalculator(
  s: InterviewSession,
  benefit: Benefit,
  details: Extract<Assessment, { kind: "calculator" }>["details"] = {},
  t = target(s),
): InterviewSession {
  return {
    ...s,
    assessments: [
      ...s.assessments,
      {
        kind: "calculator",
        id: aid,
        benefit,
        target: t,
        asOf: s.asOf,
        inputRevision: 1,
        goal: "calculation",
        state: "draft",
        details,
      },
    ],
  };
}
function withProcedure(
  s: InterviewSession,
  procedureId: ProcedureId,
  details: Extract<Assessment, { kind: "procedure" }>["details"],
  t = target(s),
): InterviewSession {
  return {
    ...s,
    assessments: [
      ...s.assessments,
      {
        kind: "procedure",
        id: aid,
        procedureId,
        target: t,
        asOf: s.asOf,
        inputRevision: 1,
        goal: "application",
        state: "draft",
        details,
      },
    ],
  };
}
function result(s: InterviewSession, id: ProcedureId) {
  const item = discoverProcedures(s).results.find((item) => item.procedureId === id);
  assert.ok(item, id);
  return item;
}
function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const entry of Object.values(value)) frozen(entry);
  }
  return value;
}

test("rejestr dokładnie pokrywa 19 procedur, akcje i wszystkie 12 istniejących kalkulatorów", () => {
  assert.equal(procedureIds.length, 19);
  assert.deepEqual([...procedureIds].sort(), procedures.map(({ id }) => id).sort());
  assert.deepEqual(Object.keys(discoveryDefinitions).sort(), [...procedureIds].sort());
  assert.deepEqual(Object.keys(calculatorTools).sort(), [...benefits].sort());
  for (const [id, definition] of Object.entries(discoveryDefinitions)) {
    assert.equal(definition.procedureId, id);
    for (const action of [
      definition.action,
      definition.fallback,
      ...definition.additionalActions,
    ]) {
      assert.ok(discoveryActionSchema.safeParse(action).success);
      if (action.kind === "calculator") assert.ok(benefits.includes(action.benefit));
    }
  }
  assert.equal(discoveryDefinitions.PARENTAL_BENEFIT.calculator, undefined);
  assert.equal(discoveryDefinitions.CARE_ALLOWANCE.calculator, undefined);
  assert.equal(
    discoveryActionSchema.safeParse({ kind: "calculator", benefit: "care" }).success,
    false,
  );
  assert.equal(
    discoveryActionSchema.safeParse({ kind: "officialGuidance", sourceId: "toString" }).success,
    false,
  );
  assert.equal(
    discoveryActionSchema.safeParse({ kind: "formalities", procedureId: "fake" }).success,
    false,
  );
});

test("ciąża na etacie: ochrona possible, przyszły macierzyński possible, bez pozornego przyznania", () => {
  const s = session();
  assert.equal(result(s, "EMPLOYMENT_PREGNANCY_PROTECTION").evaluation.status, "possible");
  const maternity = result(s, "MATERNITY_ALLOWANCE");
  assert.equal(maternity.evaluation.status, "possible");
  assert.ok(maternity.presentation.flags.includes("future"));
  assert.equal(maternity.projection.value.insuredAtBirth, undefined);
  assert.equal(result(s, "SICKNESS_PREGNANCY").evaluation.status, "missing-data");
  assert.ok(discoverProcedures(s).results.every((r) => r.evaluation.status !== "relevant"));
});

test("zlecenie i działalność bez potwierdzonego chorobowego zachowują unknown jako brak", () => {
  for (const employment of ["contract", "business"] as const) {
    const s = withProcedure(
      session("pregnant", [parent(pa, ["birthing"], [title(employment)])]),
      "SICKNESS_PREGNANCY",
      {
        sicknessLeave: fact(true),
        sicknessQualifyingPeriod: fact(true),
        pregnancyCertificate: fact(true),
      },
    );
    const item = result(s, "SICKNESS_PREGNANCY");
    assert.equal(item.projection.value.sicknessInsurance, undefined);
    assert.equal(item.evaluation.status, "missing-data");
    assert.deepEqual(item.evaluation.missingFields, ["sicknessInsurance"]);
    assert.ok(
      item.projection.dependencies.some(({ ref }) => ref.kind === "title" && ref.titleId === ta),
    );
  }
});

test("brak pracy i other nie udają obsługiwanego zatrudnienia ani odmowy wszystkich świadczeń", () => {
  for (const work of ["notWorking", "other"] as const) {
    const s = session("born", [
      { ...parent(pa, ["birthing"], []), workSituation: fact(work, day()) },
    ]);
    const profile = toProcedureProfile(
      s,
      "MATERNITY_LEAVE",
      target(s, { kind: "person", personId: pa }),
      asOf,
    );
    assert.equal(profile.value.employment, undefined);
    assert.ok(profile.omitted.some(({ reason }) => reason === "title"));
    assert.equal(result(s, "CHILD_800_PLUS").evaluation.status, "missing-data");
    assert.ok(
      discoverProcedures(s).results.some(({ evaluation }) => evaluation.status !== "not-relevant"),
    );
  }
});

test("collaborator: katalog pomija z ograniczeniem, kalkulator zachowuje oryginalny tytuł", () => {
  const s = withCalculator(
    session("born", [parent(pa, ["birthing"], [title("collaborator")])]),
    "maternity",
    { birthStage: fact("born") },
  );
  const profile = toProcedureProfile(s, "MATERNITY_ALLOWANCE", target(s), asOf);
  assert.equal(profile.value.employment, undefined);
  assert.ok(profile.omitted.some(({ reason }) => reason === "unsupported-employment"));
  assert.equal(toCaseFacts(s, aid).value.employment, "collaborator");
});

test("dwie osoby: ojcowski i rodzicielski otrzymują własny tytuł, chorobowe i szczegóły", () => {
  const s = session("born", [parent(), parent(pb, ["otherParent"], [title("contract", tb)])]);
  const items = discoverProcedures(s).results;
  const paternity = items.find(({ procedureId }) => procedureId === "PATERNITY_LEAVE");
  assert.ok(paternity);
  assert.deepEqual(paternity.target.subject, { kind: "person", personId: pb, titleId: tb });
  // The model confirms an otherParent, not fatherhood. A catalogue employee
  // refusal would be an individual determination about an unconfirmed subject.
  assert.equal(paternity.projection.value.otherParentEmployment, undefined);
  assert.equal(paternity.projection.value.employment, undefined);
  assert.equal(paternity.evaluation.status, "missing-data");
  assert.equal(paternity.presentation.kind, "preliminary-referral");
  assert.ok(paternity.action.missing.includes("fatherRole"));
  assert.ok(
    paternity.action.alternatives.some((a) => a.kind === "calculator" && a.benefit === "paternity"),
  );
  const parental = items.filter(({ procedureId }) => procedureId === "PARENTAL_LEAVE");
  assert.equal(parental.length, 2);
  assert.equal(
    parental.find((i) => i.target.subject.kind === "person" && i.target.subject.personId === pa)
      ?.evaluation.status,
    "relevant",
  );
  assert.equal(
    parental.find((i) => i.target.subject.kind === "person" && i.target.subject.personId === pb)
      ?.evaluation.status,
    "not-relevant",
  );
  assert.ok(
    toProcedureProfile(
      s,
      "MATERNITY_ALLOWANCE",
      target(s, { kind: "person", personId: pb, titleId: tb }),
      asOf,
    ).omitted.some(({ reason }) => reason === "subject"),
  );
});

test("dwa tytuły jednej osoby dają osobne oceny i żadnego domyślnego tytułu", () => {
  const s = session("born", [
    parent(pa, ["birthing"], [title("employee"), title("business", ta2)]),
  ]);
  const items = discoverProcedures(s).results.filter(
    ({ procedureId }) => procedureId === "MATERNITY_LEAVE",
  );
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map(({ evaluation }) => evaluation.status),
    ["relevant", "not-relevant"],
  );
  const projection = toProcedureProfile(
    s,
    "MATERNITY_LEAVE",
    target(s, { kind: "person", personId: pa }),
    asOf,
  );
  assert.equal(projection.value.employment, undefined);
  assert.ok(projection.omitted.some(({ reason }) => reason === "title"));
});

test("chorobowe teraz, w dniu porodu i coverageDay pozostają trzema odrębnymi odczytami", () => {
  const p = parent(
    pa,
    ["birthing"],
    [
      title("employee", ta, [
        { id: "now", fact: fact(true, day()) },
        { id: "birth", fact: fact(false, day(birth)) },
      ]),
    ],
  );
  const s = withCalculator(session("born", [p]), "maternity", { birthStage: fact("born") });
  const profile = toProcedureProfile(s, "MATERNITY_ALLOWANCE", target(s), asOf);
  assert.equal(profile.value.sicknessInsurance, true);
  assert.equal(profile.value.insuredAtBirth, false);
  const projection = toCaseFacts(s, aid);
  assert.equal(projection.value.insured, false);
  assert.equal(assessBenefit("maternity", projection.value, asOf).coverageDay, birth);
});

test("ubezpieczenie innego dnia, undated, unknown, deferred, stale i założone nie jest dowodem dzisiejszym", () => {
  const variants: Fact<boolean>[] = [
    fact(true, day("2026-11-21")),
    fact(true),
    { state: "unknown", revision: 2 },
    { state: "deferred", revision: 2 },
    {
      state: "stale",
      previous: true,
      revision: 2,
      validTime: day(),
      basis: "observed",
      source: { kind: "answer", via: "button" },
      reason: "korekta",
    },
    fact(true, day(), "assumed"),
  ];
  for (const coverage of variants) {
    const s = session("pregnant", [
      parent(pa, ["birthing"], [title("employee", ta, [{ id: "coverage", fact: coverage }])]),
    ]);
    assert.equal(
      toProcedureProfile(s, "SICKNESS_PREGNANCY", target(s), asOf).value.sicknessInsurance,
      undefined,
    );
  }
});

test("sprzeczne pokrywające się deklaracje chorobowego nie rozstrzygają się kolejnością", () => {
  const entries = [
    { id: "yes", fact: fact(true, day()) },
    { id: "no", fact: fact(false, period()) },
  ];
  for (const sicknessCoverage of [entries, [...entries].reverse()]) {
    const s = session("pregnant", [
      parent(pa, ["birthing"], [title("employee", ta, sicknessCoverage)]),
    ]);
    const projection = toProcedureProfile(s, "SICKNESS_PREGNANCY", target(s), asOf);
    assert.equal(projection.value.sicknessInsurance, undefined);
    assert.ok(projection.omitted.some(({ reason }) => reason === "conflict"));
  }
});

test("narodziny bez daty nie używają terminu porodu ani prognozy kalkulatora", () => {
  const base = session("born");
  const s = withCalculator(
    { ...base, family: { ...base.family, children: [{ id: childId, facts: {} }] } },
    "maternity",
    { birthStage: fact("born") },
  );
  const profile = result(s, "MATERNITY_ALLOWANCE");
  assert.equal(profile.projection.value.birthDate, undefined);
  assert.equal(profile.evaluation.status, "missing-data");
  assert.ok(profile.evaluation.deadlines.some(({ missingField }) => missingField === "birthDate"));
  const facts = toCaseFacts(s, aid).value;
  assert.equal(facts.birth, undefined);
  assert.equal(facts.dueDate, undefined);
  assert.equal(assessBenefit("maternity", facts, asOf).projected, undefined);
});

test("termin przewidywany i data rzeczywista są oddzielne; prognoza wymaga jawnego trybu", () => {
  const s = session();
  const withoutMode = toCaseFacts(withCalculator(s, "maternity"), aid);
  assert.equal(withoutMode.value.dueDate, undefined);
  const futureDay = "2027-03-01";
  const p = parent(
    pa,
    ["birthing"],
    [title("employee", ta, [{ id: "forecast", fact: fact(true, day(futureDay), "assumed") }])],
  );
  const projection = toCaseFacts(
    withCalculator(session("pregnant", [p]), "maternity", { birthStage: fact("expected") }),
    aid,
  );
  assert.equal(projection.value.birth, undefined);
  assert.equal(projection.value.dueDate, futureDay);
  assert.equal(projection.value.insured, true);
  assert.ok(projection.assumptions.includes("insured"));
  assert.equal(assessBenefit("maternity", projection.value, asOf).projected, true);
  assert.equal(
    toProcedureProfile(session("pregnant", [p]), "MATERNITY_ALLOWANCE", target(s), asOf).value
      .insuredAtBirth,
    undefined,
  );
});

test("planowanie i nieznany etap nie stają się fikcyjną ciążą; nie ma 19 pustych kart", () => {
  const base = session();
  const planning = { ...base, family: { ...base.family, stage: fact("planning" as const) } };
  const discovery = discoverProcedures(planning);
  assert.equal(discovery.route, "planning");
  assert.equal(discovery.planning?.destination, "PlanningPlan");
  assert.equal(discovery.results.length, 0);
  assert.deepEqual(toCaseFacts(withCalculator(planning, "maternity"), aid).value, {});
  const unknown = discoverProcedures(createInterviewSession("unknown", asOf));
  assert.equal(unknown.route, "undetermined");
  assert.equal(unknown.contextRequired, true);
  assert.equal(unknown.items.length, 0);
  assert.ok(unknown.categories.length > 0);
});

test("adopcja, piecza i strata otrzymują jawne skierowania bez standardowych procedur porodu", () => {
  for (const route of ["adoption", "foster", "loss"] as const) {
    const base = session("born");
    const s: InterviewSession = {
      ...base,
      family: {
        ...base.family,
        stage: fact(route === "loss" ? "born" : "receivingCare"),
        loss: fact(route === "loss"),
        event: { ...base.family.event, kind: fact(route === "loss" ? "birth" : route) },
      },
    };
    const discovery = discoverProcedures(s);
    assert.equal(discovery.route, route);
    assert.deepEqual(discovery.results, []);
    const names = discovery.referrals.map(({ action }) => action.benefit);
    assert.ok(names.includes(route === "loss" ? "lossMaternity" : "careMaternity"));
    if (route === "adoption") assert.ok(names.includes("adoptivePaternity"));
    if (route === "foster") assert.ok(!names.includes("adoptivePaternity"));
    assert.ok(discovery.referrals.every(({ kind }) => kind === "preliminary-referral"));
    assert.equal(discovery.availableCalculators.length, 12);
  }
});

test("brak właściwej osoby to wstępne skierowanie, bez przejęcia danych innej osoby", () => {
  const s = session("born", [parent(pb, ["otherParent"], [title("employee", tb)])]);
  const item = result(s, "MATERNITY_ALLOWANCE");
  assert.equal(item.evaluation.status, "missing-data");
  assert.equal(item.presentation.kind, "preliminary-referral");
  assert.ok(item.action.missing.includes("person"));
  assert.equal(item.projection.value.insuredAtBirth, undefined);
});

test("negatywna odpowiedź osoby nie staje się negacją dla całej rodziny", () => {
  const personal = withProcedure(session("born"), "PARENTAL_BENEFIT", {
    receivesMaternity: fact(false, day()),
    standardResidence: fact(true),
  });
  const profile = toProcedureProfile(personal, "PARENTAL_BENEFIT", target(personal), asOf);
  assert.equal(profile.value.receivesMaternity, undefined);
  assert.ok(profile.omitted.some(({ reason }) => reason === "family-scope"));
  const base = session("born");
  const familyTarget = target(base, { kind: "family" });
  const family = withProcedure(
    base,
    "PARENTAL_BENEFIT",
    { receivesMaternity: fact(false, day()) },
    familyTarget,
  );
  assert.equal(
    toProcedureProfile(family, "PARENTAL_BENEFIT", familyTarget, asOf).value.receivesMaternity,
    false,
  );
});

test("walidacja celu odrzuca obce zdarzenie, osobę, tytuł i dziecko oraz duplikaty", () => {
  const s = session("born");
  const t = target(s);
  const invalid: AssessmentTarget[] = [
    { ...t, subject: { kind: "person", personId: pb, titleId: tb } },
    { ...t, subject: { kind: "person", personId: pa, titleId: tb } },
    { ...t, childIds: [childIdSchema.parse("foreign")] },
    { ...t, childIds: [childId, childId] },
    { ...t, relatedPersonId: pa },
    { ...t, eventId: createInterviewSession("foreign", asOf).family.event.id },
  ];
  for (const bad of invalid) {
    const projection = toProcedureProfile(s, "MATERNITY_LEAVE", bad, asOf);
    assert.deepEqual(projection.value, {});
    assert.ok(projection.omitted.some(({ reason }) => reason === "invalid-target"));
  }
});

test("braki terminów pozostają odrębne od warunków, ranking nie modyfikuje ocen", () => {
  const s = session("born");
  const item = result(s, "PARENTAL_LEAVE");
  assert.equal(item.evaluation.status, "relevant");
  assert.deepEqual(item.evaluation.missingFields, []);
  assert.deepEqual(item.presentation.deadlineMissingFields, ["parentalStart"]);
  assert.ok(item.projection.omitted.some(({ field }) => field === "parentalStart"));
  const before = structuredClone(discoverProcedures(s).results);
  const ranked = rankDiscoveredProcedures(frozen(before));
  assert.deepEqual(
    new Map(ranked.map((i) => [i.procedureId, i.evaluation.status])),
    new Map(discoverProcedures(s).results.map((i) => [i.procedureId, i.evaluation.status])),
  );
});

test("ranking stawia potwierdzone otwarte formalności, potem obliczone terminy; bez domyślnej pilności", () => {
  const base = session("born");
  const s = withProcedure(
    {
      ...base,
      family: {
        ...base.family,
        shared: { birthRegistered: fact(false), birthCardDate: fact("2026-11-20") },
      },
    },
    "PARENTAL_LEAVE",
    { parentalStart: fact("2026-12-20") },
  );
  const discovery = discoverProcedures(s);
  assert.equal(discovery.items[0].procedureId, "BIRTH_REGISTRATION");
  assert.equal(discovery.items[0].presentation.priority, 1);
  assert.equal(result(s, "PARENTAL_LEAVE").presentation.nextDeadline, "2026-11-29");
  assert.equal(result(s, "PARENTAL_LEAVE").presentation.priority, 2);
  assert.equal(result(session("born"), "BIRTH_REGISTRATION").presentation.priority, 3);
  const unknown = discoverProcedures(createInterviewSession("unknown", asOf));
  assert.ok(unknown.results.every((i) => i.presentation.priority === 5));
});

test("remisy mają stabilną kolejność katalogu, osoby i tytułu niezależnie od tablic wejściowych", () => {
  const a = parent(pa, ["birthing"], [title("employee", ta2), title("employee")]);
  const b = parent(pb, ["otherParent"], [title("employee", tb)]);
  const s = session("born", [b, a]);
  const reversed = {
    ...s,
    persons: [...s.persons].reverse().map((p) => ({ ...p, titles: [...p.titles].reverse() })),
  };
  const keys = (data: InterviewSession) =>
    rankDiscoveredProcedures(discoverProcedures(data).results).map((i) => [
      i.procedureId,
      i.target.subject,
    ]);
  assert.deepEqual(keys(s), keys(reversed));
  const parental = rankDiscoveredProcedures(discoverProcedures(s).results).filter(
    (i) => i.procedureId === "PARENTAL_LEAVE",
  );
  assert.deepEqual(
    parental.map((i) =>
      i.target.subject.kind === "person"
        ? [i.target.subject.personId, i.target.subject.titleId]
        : [],
    ),
    [
      [pa, ta],
      [pa, ta2],
      [pb, tb],
    ],
  );
});

test("data poza katalogiem i review zachowują possible bez sztucznej pilności", () => {
  const s = session();
  const earlier = discoverProcedures(s, "2026-11-16");
  assert.ok(earlier.results.every((i) => i.evaluation.status === "possible"));
  assert.ok(earlier.results.every((i) => i.presentation.flags.includes("rule-review")));
  assert.ok(earlier.results.every((i) => i.presentation.priority === 5));
  const protection = result(s, "EMPLOYMENT_PREGNANCY_PROTECTION");
  assert.equal(protection.evaluation.status, "possible");
  assert.ok(protection.presentation.flags.includes("rule-review"));
});

test("zależności wskazują właściwą osobę, tytuł, fakt ubezpieczenia i również brakujące pola", () => {
  const s = session("born", [
    parent(
      pa,
      ["birthing"],
      [title("employee", ta, [{ id: "birth-proof", fact: fact(true, day(birth)) }])],
    ),
    parent(pb, ["otherParent"], [title("business", tb)]),
  ]);
  const projection = toProcedureProfile(s, "MATERNITY_ALLOWANCE", target(s), asOf);
  assert.ok(
    projection.dependencies.some(
      ({ ref, revision }) =>
        ref.kind === "title" &&
        ref.personId === pa &&
        ref.titleId === ta &&
        ref.coverageId === "birth-proof" &&
        revision === 1,
    ),
  );
  assert.ok(
    !projection.dependencies.some(({ ref }) => ref.kind === "title" && ref.personId === pb),
  );
  assert.ok(
    projection.dependencies.some(
      ({ ref, revision }) =>
        ref.kind === "family" && ref.field === "shared.birthCardDate" && revision === null,
    ),
  );
  const changedB = {
    ...s,
    persons: s.persons.map((p) => (p.id === pb ? { ...p, titles: [title("contract", tb)] } : p)),
  };
  assert.deepEqual(
    toProcedureProfile(changedB, "MATERNITY_ALLOWANCE", target(s), asOf),
    projection,
  );
});

test("kalkulator przez adapter zachowuje 140 dni i kwotę z niezmienionego silnika, w groszach", () => {
  const s = withCalculator(
    session("born", [
      parent(
        pa,
        ["birthing"],
        [title("employee", ta, [{ id: "birth", fact: fact(true, day(birth)) }])],
      ),
    ]),
    "maternity",
    {
      birthStage: fact("born"),
      through: fact("2027-04-08"),
      basis: fact(600_000, period()),
      payer: fact("employer", period()),
      averagedRequest: fact("2026-12-12"),
    },
  );
  const projection = toCaseFacts(s, aid);
  assert.equal(projection.value.basis, 600_000);
  const assessment = assessBenefit("maternity", projection.value, asOf);
  assert.equal(assessment.status, "eligible");
  assert.equal(assessment.period?.days, 140);
  assert.equal(assessment.money?.daily, 20_000);
  assert.equal(assessment.money?.total, 2_800_000);
  const manual: CaseFacts = {
    birthStage: "born",
    birth,
    children: 1,
    employment: "employee",
    insured: true,
    through: "2027-04-08",
    basis: 600_000,
    payer: "employer",
    averagedRequest: "2026-12-12",
  };
  assert.deepEqual(assessment, assessBenefit("maternity", manual, asOf));
});

test("finanse nie przeciekają między assessmentami ani dniami; podstawa składek nie staje się zasiłkową", () => {
  const base = session("born");
  const s = withCalculator(
    withProcedure(base, "ACTIVE_PARENT_WORK", {
      contributionPercent: fact(100),
      familyIncomePerPerson: fact(1500),
    }),
    "maternity",
    { birthStage: fact("born"), basis: fact(500_000, day("2026-10-01")) },
  );
  const projection = toCaseFacts(s, aid);
  // Duplicate IDs are invalid upstream; use a unique calculator assessment below.
  const clean = { ...s, assessments: s.assessments.filter((a) => a.kind === "calculator") };
  const facts = toCaseFacts(clean, aid);
  assert.equal(facts.value.basis, undefined);
  assert.equal(facts.value.fixedSalary, undefined);
  assert.ok(
    facts.omitted.some(({ field, reason }) => field === "basis" && reason === "outside-period"),
  );
  assert.deepEqual(projection.value, {});
});

test("dane wyłącznie z pasującego assessmentu: osoba, tytuł, dzień, procedura", () => {
  const base = session("pregnant", [
    parent(),
    parent(pb, ["otherParent"], [title("contract", tb)]),
  ]);
  const s = withProcedure(base, "SICKNESS_PREGNANCY", {
    sicknessLeave: fact(true),
    pregnancyCertificate: fact(true),
  });
  assert.equal(
    toProcedureProfile(s, "SICKNESS_PREGNANCY", target(s), asOf).value.sicknessLeave,
    true,
  );
  assert.equal(
    toProcedureProfile(s, "CARE_ALLOWANCE", target(s), asOf).value.sicknessLeave,
    undefined,
  );
  assert.equal(
    toProcedureProfile(s, "SICKNESS_PREGNANCY", target(s), "2026-11-23").value.sicknessLeave,
    undefined,
  );
  const stale = {
    ...s,
    assessments: s.assessments.map((a) => ({ ...a, state: "stale" as const })),
  };
  assert.equal(
    toProcedureProfile(stale, "SICKNESS_PREGNANCY", target(s), asOf).value.sicknessLeave,
    undefined,
  );
});

test("hospitalizacja pozostaje rozłączna i przy jednym dziecku; przyszłe pobyty są pomijane", () => {
  const base = session("born");
  const stays = [
    { from: "2026-11-20", through: "2026-11-20" },
    { from: "2026-11-22", through: "2026-11-22" },
  ];
  const s = withCalculator(
    {
      ...base,
      family: {
        ...base.family,
        children: [{ ...base.family.children[0], hospitalStays: fact(stays) }],
      },
    },
    "supplement",
    { from: fact("2027-04-09") },
  );
  assert.equal(
    toCaseFacts(s, aid).value.hospitalRanges,
    "2026-11-20/2026-11-20, 2026-11-22/2026-11-22",
  );
  const future = {
    ...s,
    family: {
      ...s.family,
      children: [
        { ...s.family.children[0], hospitalStays: fact([{ from: birth, through: "2026-11-23" }]) },
      ],
    },
  };
  assert.equal(toCaseFacts(future, aid).value.hospitalRanges, undefined);
});

test("generatePlan zachowuje swoje statusy i kolejność faz, discovery oddaje oryginalne oceny", () => {
  const profile: Profile = {
    stage: "born",
    birthDate: birth,
    employment: "employee",
    childrenBorn: 1,
    birthRegistered: false,
    birthCardDate: birth,
  };
  const plan = generatePlan(profile, asOf);
  assert.equal(plan.results.length, 19);
  assert.equal(
    plan.results.find(({ procedure }) => procedure.id === "BIRTH_REGISTRATION")?.status,
    "relevant",
  );
  assert.equal(
    plan.results.find(({ procedure }) => procedure.id === "MATERNITY_LEAVE")?.duration?.weeks,
    20,
  );
  assert.equal(
    plan.results.find(({ procedure }) => procedure.id === "EMPLOYMENT_PREGNANCY_PROTECTION")
      ?.status,
    "not-relevant",
  );
  // Both dated birth procedures have a 21-day deadline; catalogue order breaks
  // that tie. Undated maternity leave comes later within the birth phase.
  assert.deepEqual(
    plan.items.slice(0, 2).map(({ procedure }) => procedure.id),
    ["BIRTH_REGISTRATION", "MATERNITY_ALLOWANCE"],
  );
  for (const item of discoverProcedures(session("born")).results)
    assert.deepEqual(
      item.evaluation,
      evaluateProcedure(item.projection.value, item.evaluation.procedure, asOf),
    );
});

test("adaptery, discovery i ranking nie mutują sesji ani nie oddają referencji do zagnieżdżonych faktów", () => {
  const s = withCalculator(session("born"), "maternity", { birthStage: fact("born") });
  const before = structuredClone(s);
  frozen(s);
  toProcedureProfile(s, "MATERNITY_ALLOWANCE", target(s), asOf);
  toCaseFacts(s, aid);
  const data = discoverProcedures(s);
  rankDiscoveredProcedures(data.results);
  assert.deepEqual(s, before);
  assert.doesNotThrow(() => JSON.stringify(data));
  assert.throws(() => discoverProcedures(s, "2026-02-30"));
});

test("kompletne potwierdzone warunki chorobowego dają rzeczywiste relevant silnika", () => {
  const s = withProcedure(
    session("pregnant", [
      parent(pa, ["birthing"], [title("employee", ta, [{ id: "now", fact: fact(true, day()) }])]),
    ]),
    "SICKNESS_PREGNANCY",
    {
      sicknessLeave: fact(true, day()),
      sicknessQualifyingPeriod: fact(true, day()),
      pregnancyCertificate: fact(true, day()),
    },
  );
  const item = result(s, "SICKNESS_PREGNANCY");
  assert.equal(item.evaluation.status, "relevant");
  assert.equal(item.presentation.kind, "engine-evaluation");
  assert.deepEqual(item.evaluation.missingFields, []);
});

test("fakt pracy z innego dnia i ubezpieczenie innego tytułu nie uzupełniają bieżącej oceny", () => {
  const s = session("born", [
    parent(
      pa,
      ["birthing"],
      [
        { ...title("employee"), employment: fact("employee", day("2026-11-21")) },
        title("business", ta2, [{ id: "birth", fact: fact(true, day(birth)) }]),
      ],
    ),
  ]);
  const projection = toProcedureProfile(s, "MATERNITY_ALLOWANCE", target(s), asOf);
  assert.equal(projection.value.employment, undefined);
  assert.equal(projection.value.insuredAtBirth, undefined);
  assert.ok(
    projection.omitted.some(
      ({ field, reason }) => field === "employment" && reason === "outside-period",
    ),
  );
  assert.ok(
    !projection.dependencies.some(({ ref }) => ref.kind === "title" && ref.titleId === ta2),
  );
});

test("skończony tytuł zachowuje typ historyczny dla kalkulatora; sprzeczne dodatnie chorobowe jest pomijane", () => {
  const ended = "2026-11-01";
  const p = parent(
    pa,
    ["birthing"],
    [
      {
        ...title("employee", ta, [{ id: "no", fact: fact(false, day()) }]),
        employment: fact("employee", period("2026-01-01", ended)),
        ended: fact(isoDateSchema.parse(ended)),
      },
    ],
  );
  const s = withCalculator(session("pregnant", [p]), "rehabilitation", {
    from: fact(asOf),
    through: fact("2026-11-30"),
  });
  const projection = toCaseFacts(s, aid);
  assert.equal(projection.value.employment, "employee");
  assert.equal(projection.value.employmentEnded, ended);
  assert.equal(projection.value.insured, false);
  assert.equal(
    toProcedureProfile(s, "EMPLOYMENT_PREGNANCY_PROTECTION", target(s), asOf).value.employment,
    undefined,
  );
  const conflicting = session("pregnant", [
    {
      ...p,
      titles: [{ ...p.titles[0], sicknessCoverage: [{ id: "yes", fact: fact(true, day()) }] }],
    },
  ]);
  const profile = toProcedureProfile(conflicting, "SICKNESS_PREGNANCY", target(conflicting), asOf);
  assert.equal(profile.value.sicknessInsurance, undefined);
  assert.ok(profile.omitted.some(({ reason }) => reason === "conflict"));
});

test("deklaracja rodzinna wymaga właściwego okresu, a finanse wymagają także tytułu", () => {
  const base = session("born");
  const t = target(base, { kind: "family" });
  for (const validTime of [undated, day("2026-11-21")]) {
    const s = withProcedure(
      base,
      "PARENTAL_BENEFIT",
      { receivesMaternity: fact(false, validTime) },
      t,
    );
    assert.equal(
      toProcedureProfile(s, "PARENTAL_BENEFIT", t, asOf).value.receivesMaternity,
      undefined,
    );
  }
  const s = withCalculator(
    base,
    "maternity",
    { basis: fact(600_000, period()), payer: fact("zus", period()) },
    target(base, { kind: "person", personId: pa }),
  );
  const projection = toCaseFacts(s, aid);
  assert.equal(projection.value.basis, undefined);
  assert.equal(projection.value.payer, undefined);
});

test("przejęcie wymaga wskazania osoby rodzącej dla jej własnych danych", () => {
  const base = session("born", [parent(), parent(pb, ["otherParent"], [title("employee", tb)])]);
  const details = {
    transferReason: fact("return" as const),
    motherDaysAfterBirth: fact(98),
    motherDaysBeforeBirth: fact(0),
  };
  const fatherTarget = target(base, { kind: "person", personId: pb, titleId: tb });
  const missing = toCaseFacts(
    withCalculator(base, "maternityTransfer", details, fatherTarget),
    aid,
  );
  assert.equal(missing.value.motherDaysAfterBirth, undefined);
  const bound = toCaseFacts(
    withCalculator(base, "maternityTransfer", details, { ...fatherTarget, relatedPersonId: pa }),
    aid,
  );
  assert.equal(bound.value.motherDaysAfterBirth, 98);
  assert.equal(bound.value.motherDaysBeforeBirth, 0);
});

test("niejednoznaczne assessmenty i założona ścieżka nie dają arbitralnej projekcji", () => {
  const base = withCalculator(session("born"), "maternity", { birthStage: fact("born") });
  assert.deepEqual(
    toCaseFacts({ ...base, assessments: [...base.assessments, ...base.assessments] }, aid).value,
    {},
  );
  const p = session();
  const assumed = {
    ...p,
    family: { ...p.family, stage: fact("pregnant" as const, undated, "assumed") },
  };
  assert.equal(projectionRoute(assumed), "undetermined");
  assert.equal(discoverProcedures(assumed).items.length, 0);
  const loss = { ...p, family: { ...p.family, loss: fact(true, undated, "assumed") } };
  assert.equal(projectionRoute(loss), "undetermined");
});

test("wieloród nie scala hospitalizacji różnych dzieci ani nie wymyśla schoolDeferral", () => {
  const base = session("born");
  const s: InterviewSession = {
    ...base,
    family: {
      ...base.family,
      childrenCount: fact(2),
      children: [
        { ...base.family.children[0], hospitalStays: fact([{ from: birth, through: asOf }]) },
        { id: childIdSchema.parse("child-2"), birth: fact(isoDateSchema.parse(birth)), facts: {} },
      ],
    },
  };
  const projection = toCaseFacts(
    withCalculator(s, "supplement", { from: fact("2027-06-25") }),
    aid,
  );
  assert.equal(projection.value.hospitalRanges, undefined);
  assert.equal(projection.value.careChildren, undefined);
  assert.ok(projection.omitted.some(({ reason }) => reason === "unsupported-scope"));
  assert.ok(
    projection.dependencies.some(
      ({ ref }) => ref.kind === "child" && ref.field === "schoolDeferral",
    ),
  );
});

test("wykorzystanie okresów jest przypisane do osoby i zdarzenia, bez domyślnych zer", () => {
  const base = session("born", [parent(), parent(pb, ["otherParent"], [title("employee", tb)])]);
  const s: InterviewSession = {
    ...base,
    usage: [
      { eventId: base.family.event.id, personId: pa, period: "parental", usedDays: fact(70) },
      { eventId: base.family.event.id, personId: pb, period: "parental", usedDays: fact(14) },
    ],
  };
  const noPair = toCaseFacts(withCalculator(s, "parental", { from: fact(asOf) }), aid);
  assert.equal(noPair.value.usedDays, 70);
  assert.equal(noPair.value.otherParentDays, undefined);
  assert.equal(noPair.value.parts, undefined);
  const paired = toCaseFacts(
    withCalculator(s, "parental", { from: fact(asOf) }, { ...target(s), relatedPersonId: pb }),
    aid,
  );
  assert.equal(paired.value.otherParentDays, 14);
});

test("adopcja i piecza korzystają z istniejącego kalkulatora; zawodowa piecza zachowuje odmowę", () => {
  const base = session("born", [
    parent(
      pa,
      ["guardian"],
      [title("employee", ta, [{ id: "coverage", fact: fact(true, day()) }])],
    ),
  ]);
  for (const careKind of ["adoption", "foster", "professional"] as const) {
    const s: InterviewSession = {
      ...base,
      family: {
        ...base.family,
        event: {
          ...base.family.event,
          kind: fact(careKind === "adoption" ? "adoption" : "foster"),
        },
        stage: fact("receivingCare"),
        eventFacts: {
          careKind: fact(careKind),
          careAccepted: fact(asOf),
          courtApplication: fact(asOf),
        },
      },
    };
    const projection = toCaseFacts(
      withCalculator(s, "careMaternity", {
        from: fact(asOf),
        previousCareBenefit: fact(false),
        standardRate: fact(true),
        basis: fact(600_000, period()),
        payer: fact("employer", period()),
      }),
      aid,
    );
    assert.equal(projection.value.careKind, careKind);
    const assessment = assessBenefit("careMaternity", projection.value, asOf);
    assert.equal(assessment.status, careKind === "professional" ? "ineligible" : "eligible");
    if (careKind !== "professional") assert.equal(assessment.period?.days, 140);
  }
});

test("po stracie kalkulator zachowuje 56 dni i neutralne skierowanie zamiast formalności USC", () => {
  const base = session("born", [
    parent(
      pa,
      ["birthing"],
      [title("employee", ta, [{ id: "birth", fact: fact(true, day(birth)) }])],
    ),
  ]);
  const s: InterviewSession = {
    ...base,
    family: {
      ...base.family,
      loss: fact(true),
      children: [{ ...base.family.children[0], death: fact(isoDateSchema.parse(birth)) }],
    },
  };
  const projection = toCaseFacts(
    withCalculator(s, "lossMaternity", {
      basis: fact(600_000, period()),
      payer: fact("employer", period()),
    }),
    aid,
  );
  assert.equal(assessBenefit("lossMaternity", projection.value, asOf).period?.days, 56);
  assert.equal(discoverProcedures(s).results.length, 0);
});

test("po wygaśnięciu limitu opłaty discovery zachowuje possible i rule-review", () => {
  const now = "2027-04-01";
  const base = session("born");
  const s: InterviewSession = {
    ...base,
    asOf: isoDateSchema.parse(now),
    family: {
      ...base.family,
      shared: { livesInPoland: fact(true) },
      children: [{ ...base.family.children[0], birth: fact(isoDateSchema.parse("2025-12-01")) }],
    },
  };
  const t = target(s, { kind: "family" });
  const data = withProcedure(
    s,
    "ACTIVE_PARENT_NURSERY",
    {
      standardResidence: fact(true),
      nursery: fact(true, day(now)),
      nurseryRegistered: fact(true, day(now)),
      nurseryFee: fact(500, day(now)),
      activeComponent: fact("none", day(now)),
    },
    t,
  );
  const item = result(data, "ACTIVE_PARENT_NURSERY");
  assert.equal(item.evaluation.status, "possible");
  assert.ok(item.evaluation.reasons.some(({ text }) => text.includes("limit opłaty")));
  assert.ok(item.presentation.flags.includes("rule-review"));
});

test("wszystkie potwierdzone otwarte formalności pozostają widoczne ponad limit czterech kart", () => {
  const base = session("born");
  const s: InterviewSession = {
    ...base,
    family: {
      ...base.family,
      children: Array.from({ length: 5 }, (_, index) => ({
        id: childIdSchema.parse(`child-${index}`),
        birth: fact(isoDateSchema.parse(birth)),
        facts: {},
      })),
    },
  };
  const scoped: InterviewSession = {
    ...s,
    assessments: s.family.children.map((child, index) => ({
      kind: "procedure",
      id: assessmentIdSchema.parse(`health-${index}`),
      procedureId: "CHILD_HEALTH_INSURANCE",
      target: { eventId: s.family.event.id, subject: { kind: "family" }, childIds: [child.id] },
      asOf: s.asOf,
      inputRevision: 1,
      goal: "application",
      state: "draft",
      details: { healthRegistered: fact(false), healthTitle: fact(true) },
    })),
  };
  const discovery = discoverProcedures(scoped);
  assert.equal(discovery.items.length, 5);
  assert.ok(
    discovery.items.every(
      ({ procedureId, presentation }) =>
        procedureId === "CHILD_HEALTH_INSURANCE" && presentation.priority === 1,
    ),
  );
});

test("przekroczony termin nie jest odmową, a historyczny status formalności nie tworzy dzisiejszej pilności", () => {
  const base = session("born");
  const oldBirth = "2026-10-01";
  const s: InterviewSession = {
    ...base,
    family: {
      ...base.family,
      shared: { birthRegistered: fact(false), birthCardDate: fact(oldBirth) },
      children: [{ ...base.family.children[0], birth: fact(isoDateSchema.parse(oldBirth)) }],
    },
  };
  const item = result(s, "BIRTH_REGISTRATION");
  assert.equal(item.evaluation.status, "relevant");
  assert.equal(item.presentation.priority, 1);
  assert.equal(item.evaluation.deadlines[0].date, "2026-10-22");
  const dated = {
    ...s,
    family: {
      ...s.family,
      shared: { ...s.family.shared, birthRegistered: fact(false, day(oldBirth)) },
    },
  };
  assert.equal(result(dated, "BIRTH_REGISTRATION").presentation.priority, 3);
  assert.equal(result(dated, "BIRTH_REGISTRATION").evaluation.status, "missing-data");
});

test("pozytywne pobieranie jednej osoby może wykluczyć świadczenie rodzinne; jej negacja nie może", () => {
  const base = session("born");
  const s = withProcedure(base, "PARENTAL_BENEFIT", { receivesMaternity: fact(true, day()) });
  assert.equal(
    toProcedureProfile(s, "PARENTAL_BENEFIT", target(s), asOf).value.receivesMaternity,
    true,
  );
  assert.equal(result(s, "PARENTAL_BENEFIT").evaluation.status, "not-relevant");
});

test("typ tytułu dla macierzyńskiego pochodzi z dnia porodu, a ochrona pracy z dnia oceny", () => {
  const s = session("born", [
    parent(pa, ["birthing"], [{ ...title(), employment: fact("employee", day(birth)) }]),
  ]);
  const projection = toProcedureProfile(s, "MATERNITY_ALLOWANCE", target(s), asOf);
  assert.equal(projection.value.employment, "employee");
  assert.ok(
    projection.dependencies.some(
      ({ ref, onDay }) => ref.kind === "title" && ref.field === "employment" && onDay === birth,
    ),
  );
  assert.equal(
    toProcedureProfile(s, "PARENTAL_LEAVE", target(s), asOf).value.employment,
    undefined,
  );
});

test("uzupełniający okres nie jest automatycznie przypisany wyłącznie osobie rodzącej", () => {
  const base = session("born", [parent(), parent(pb, ["otherParent"], [title("employee", tb)])]);
  const fatherTarget = target(base, { kind: "person", personId: pb, titleId: tb });
  const projection = toCaseFacts(
    withCalculator(base, "supplement", { from: fact("2027-04-09") }, fatherTarget),
    aid,
  );
  assert.equal(projection.value.birth, birth);
  assert.equal(projection.value.employment, "employee");
  const items = discoverProcedures(base).results.filter(
    ({ procedureId }) => procedureId === "SUPPLEMENTARY_MATERNITY_LEAVE",
  );
  assert.equal(items.length, 2);
  assert.ok(items.every(({ evaluation }) => evaluation.status === "missing-data"));
});
