import { calculatorSession } from "./workspace-fixture";
import { getParentCase, setCaseGoal } from "../src/features/parent/case-session";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { benefitMoney, assessBenefit, maternityTopUp } from "../src/engine/parent-benefit";
import { applyCaseFacts, emptyParentCase } from "../src/engine/parent-case";
import type { CaseFacts } from "../src/engine/parent-case";
import { compareParentalPlans } from "../src/engine/parent-plan";
import {
  acceptedDocumentFact,
  documentSuggestions,
  normalizeDocumentWire,
  validateDocumentRead,
} from "../src/features/parent/case-documents";
import { caseExamples } from "../src/features/parent/parent-examples";
import { caseActionSchema } from "../src/features/parent/parent-intent";
import {
  append,
  appendAssessment,
  continueWithDocument,
  getAssessment,
  saveFacts,
  saveQuestionAnswer,
  selectBenefit,
} from "../src/features/parent/case-session";
import type { AttachedDocument, CaseSession } from "../src/features/parent/case-session";
import { readFact } from "../src/features/parent/case-fields";

const today = "2026-11-21";
const employed: CaseFacts = {
  birth: "2025-12-01",
  employment: "employee",
  insured: true,
  children: 1,
  basis: 600_000,
  standardRate: true,
  payer: "zus",
};
const history: CaseFacts = {
  careCertificate: false,
  soleParent: false,
  reserved: false,
  parts: 0,
  usedDays: 0,
  otherParentDays: 0,
};

test("adopcja i piecza używają wieku, minimalnego wymiaru i dokumentu sądu", () => {
  const adoption: CaseFacts = {
    ...employed,
    birth: "2012-11-19",
    from: "2026-11-10",
    careKind: "adoption",
    careAccepted: "2026-11-10",
    courtApplication: "2026-11-10",
    previousCareBenefit: false,
  };
  const result = assessBenefit("careMaternity", adoption, today);
  assert.equal(result.period?.days, 63);
  assert.equal(result.money?.total, 1_260_000);
  assert.match(result.documents[2].title, /przysposobienie/);
  const foster = {
    ...adoption,
    birth: "2018-06-21",
    courtApplication: undefined,
    careKind: "foster",
  } as const;
  assert.equal(assessBenefit("careMaternity", foster, today).missing, "schoolDeferral");
  assert.equal(
    assessBenefit("careMaternity", { ...foster, schoolDeferral: true }, today).period?.days,
    140,
  );
  assert.equal(
    assessBenefit("careMaternity", { ...foster, careKind: "professional" }, today).status,
    "ineligible",
  );
});

test("po pojedynczym martwym urodzeniu liczy 56 dni i wskazuje odpowiedni dowód", () => {
  const result = assessBenefit(
    "lossMaternity",
    { ...employed, birth: "2026-11-12", childDeath: "2026-11-12" },
    today,
  );
  assert.equal(result.period?.days, 56);
  assert.equal(result.rate, 10_000);
  assert.ok(result.documents.some(({ title }) => title.includes("martwe urodzenie")));
});

test("rehabilitacyjne w ciąży używa ustalonej podstawy i wymaga orzeczenia", () => {
  const facts: CaseFacts = {
    from: "2026-11-01",
    through: "2026-11-14",
    employment: "employee",
    insured: true,
    payer: "zus",
    basis: 600_000,
    sickDaysUsed: 270,
    pregnancyProof: true,
    rehabUsed: 0,
    rehabExcluded: false,
  };
  assert.equal(assessBenefit("rehabilitation", facts, today).missing, "rehabMedical");
  assert.equal(
    assessBenefit("rehabilitation", { ...facts, rehabMedical: false }, today).status,
    "review",
  );
  const result = assessBenefit("rehabilitation", { ...facts, rehabMedical: true }, today);
  assert.equal(result.money?.total, 280_000);
  assert.match(result.documents[0].title, /ZNp-7/);
});

test("podwyższenie używa kwoty po zaliczce i progu za dni miesiąca", () => {
  const period = { from: "2026-11-01", through: "2026-11-30", days: 30 };
  assert.equal(maternityTopUp(period, "2026-11", 85_000)?.topUp, 15_000);
  assert.deepEqual(maternityTopUp({ ...period, through: "2026-11-11" }, "2026-11", 30_000), {
    days: 11,
    floor: 36_670,
    topUp: 6670,
  });
});

test("pomniejsza stawkę w relacji do zwykłego etatu i pomija niepełny dzień przedłużenia", () => {
  const facts = {
    ...employed,
    ...history,
    from: "2026-05-04",
    through: "2026-06-14",
    workPercent: 25,
    employmentPercent: 50,
  };
  const result = assessBenefit("parental", facts, today);
  assert.equal(result.money?.daily, 7000);
  assert.equal(result.extensionDays, 10);
});

test("panel demo stosuje stawkę od wskazanego dnia i pozwala odtworzyć pierwotną kwotę", () => {
  const facts = { ...employed, ...history, from: "2026-11-02", through: "2026-11-08" };
  assert.equal(assessBenefit("parental", facts, today).money?.total, 98_000);
  assert.equal(
    assessBenefit("parental", facts, today, { from: "2026-11-02", parental: 7200 }).money?.total,
    100_800,
  );
  assert.equal(
    assessBenefit("parental", facts, today, { from: "2026-11-03", parental: 7200 }).money?.total,
    98_000,
  );
});

test("odczyt z bramki mapuje teksty na kwoty i wartości logiczne z numerem strony", () => {
  const normalized = normalizeDocumentWire({
    kind: "application",
    requestedBenefit: "paternity",
    candidates: [
      { key: "basis", value: "600000", page: 2 },
      { key: "insured", value: "false", page: 3 },
      { key: "birth", value: "2026-02-30", page: 4 },
      { key: "payer", value: "invalid", page: 2 },
    ],
    decisions: [{ status: "paid", page: 9, from: null, through: null }],
  });
  assert.deepEqual(normalized?.candidates, [
    { key: "basis", value: 600_000, page: 2 },
    { key: "insured", value: false, page: 3 },
  ]);
  assert.equal(normalized?.decisions[0].page, 9);
});

void describe("Ocena świadczenia rodzica", () => {
  test("ojcowski daje siedem dni, 1400 zł i wniosek do pracodawcy", () => {
    const example = caseExamples[0];
    const result = assessBenefit(example.benefit, example.facts, today);
    assert.equal(result.status, "eligible");
    assert.deepEqual(result.period, { from: "2026-11-02", through: "2026-11-08", days: 7 });
    assert.deepEqual(result.money, { basis: 600_000, daily: 20_000, total: 140_000 });
    assert.partialDeepStrictEqual(result.documents[0], {
      recipient: "Pracodawca",
      deadline: "2026-10-26",
    });
    assert.equal(
      result.documents.some(({ title }) => title.includes("ZAM")),
      true,
    );
    const earlier = assessBenefit(
      example.benefit,
      { ...example.facts, documentDate: "2026-10-23" },
      today,
    );
    assert.equal(
      earlier.documents.some(({ title }) => title.includes("ZAO")),
      true,
    );
  });

  test("odróżnia brak chorobowego od braku potwierdzenia", () => {
    const example = caseExamples[1];
    assert.equal(assessBenefit(example.benefit, example.facts, today).status, "ineligible");
    assert.partialDeepStrictEqual(
      assessBenefit(example.benefit, { ...example.facts, insured: undefined }, today),
      {
        status: "missing",
        missing: "insured",
        coverageDay: "2026-11-18",
      },
    );
  });

  test("oblicza 100% z podstawy po skalowaniu pensji oraz próg płatnika", () => {
    const example = caseExamples[2];
    const result = assessBenefit(
      example.benefit,
      { ...example.facts, payer: undefined, insuredHeadcount: 20 },
      today,
    );
    assert.equal(result.period?.days, 140);
    assert.equal(result.money?.daily, 17_258);
    assert.equal(result.payer, "zus");
    assert.equal(
      assessBenefit(
        example.benefit,
        { ...example.facts, payer: undefined, insuredHeadcount: 21 },
        today,
      ).payer,
      "employer",
    );
  });

  test("z danych wejściowych liczy trzy kolejne odcinki 140, 14 i 224 dni", () => {
    const maternity = assessBenefit("maternity", employed, today);
    const supplement = assessBenefit(
      "supplement",
      {
        supplementCare: false,
        ...employed,
        from: "2026-04-20",
        gestationalWeeks: 30,
        birthWeightGrams: 1200,
        hospitalFrom: "2025-12-01",
        hospitalThrough: "2025-12-10",
      },
      today,
    );
    const parental = assessBenefit(
      "parental",
      {
        ...employed,
        ...history,
        from: "2026-05-04",
        through: "2026-12-13",
      },
      today,
    );
    assert.deepEqual(maternity.period, { from: "2025-12-01", through: "2026-04-19", days: 140 });
    assert.deepEqual(supplement.period, { from: "2026-04-20", through: "2026-05-03", days: 14 });
    assert.deepEqual(parental.period, { from: "2026-05-04", through: "2026-12-13", days: 224 });
    assert.deepEqual(
      [maternity, supplement, parental].map((result) => result.money?.total),
      [2_800_000, 280_000, 3_136_000],
    );
  });

  test("odmawia szóstej części na podstawie wspólnego limitu", () => {
    const example = caseExamples[3];
    assert.partialDeepStrictEqual(assessBenefit(example.benefit, example.facts, today), {
      status: "ineligible",
    });
    assert.partialDeepStrictEqual(
      assessBenefit(example.benefit, { ...example.facts, parts: 4 }, today),
      {
        status: "missing",
        missing: "children",
      },
    );
  });

  test("uwzględnia próg na dzień prawa i wykorzystany ojcowski", () => {
    const facts: CaseFacts = { ...caseExamples[0].facts, employment: "business", debt: 4806 };
    assert.equal(assessBenefit("paternity", facts, today).status, "eligible");
    assert.equal(assessBenefit("paternity", { ...facts, debt: 4807 }, today).status, "ineligible");
    assert.equal(
      assessBenefit("paternity", { ...facts, debt: 4807, debtPaid: "2026-11-08" }, today).status,
      "eligible",
    );
    assert.equal(
      assessBenefit("paternity", { ...facts, paternityUsed: "full" }, today).status,
      "ineligible",
    );
  });

  test("wniosek 21 dni od porodu daje 81,5%, następny dzień 100%", () => {
    assert.equal(
      assessBenefit("maternity", { ...employed, averagedRequest: "2025-12-22" }, today).rate,
      8150,
    );
    assert.equal(
      assessBenefit("maternity", { ...employed, averagedRequest: "2025-12-23" }, today).rate,
      10000,
    );
    assert.equal(benefitMoney(600_000, 8150, 10).total, 163_000);
  });

  test("za 35 dni wydłużenia bez pracy wypłaca pełną stawkę 70% (komentarz ZUS, pkt 182)", () => {
    const plans = compareParentalPlans(
      { ...employed, ...history },
      {
        start: "2026-04-20",
        weeks: 10,
        otherWeeks: 9,
        otherBasis: 450_000,
        otherEmployment: "employee",
        otherInsured: true,
        employmentPercent: 100,
        together: true,
        workPercent: 50,
      },
      today,
    );
    assert.equal(plans?.standard.first.money?.daily, 14_000);
    assert.equal(plans?.standard.firstTotal, 980_000);
    assert.equal(plans?.adjusted.first.money?.daily, 7000);
    assert.equal(plans?.adjusted.first.extensionDays, 35);
    assert.equal(plans?.adjusted.second.money?.total, 661_500);
    assert.equal(plans?.adjusted.second.period?.from, "2026-04-20");
    assert.equal(plans?.adjusted.first.extension?.money?.daily, 14_000);
    assert.equal(plans?.adjusted.firstTotal, 980_000);
  });

  test("chorobowe w ciąży wymaga potwierdzenia i respektuje pozostałe dni", () => {
    const f: CaseFacts = {
      from: "2026-11-01",
      through: "2026-11-10",
      insured: true,
      employment: "contract",
      qualifying: true,
      pregnancyProof: true,
      sickDaysUsed: 260,
      basis: 600_000,
      payer: "zus",
    };
    assert.equal(assessBenefit("sickness", f, today).money?.total, 200_000);
    assert.partialDeepStrictEqual(
      assessBenefit("sickness", { ...f, through: "2026-11-11" }, today),
      {
        missing: "through",
        maximumDays: 10,
      },
    );
    assert.equal(
      assessBenefit("sickness", { ...f, qualifying: false }, today).status,
      "ineligible",
    );
  });
});

test("odczyt PDF pomija nieprawidłowe dane i nie wprowadza rozstrzygnięcia do kalkulatora", () => {
  const read = validateDocumentRead({
    requestedBenefit: "paternity",
    candidates: [
      { key: "basis", value: 600_000, page: 4 },
      { key: "birth", value: "2026-02-30", page: 1 },
    ],
    decisions: [{ status: "granted", page: 13, from: "2026-11-02", through: "2026-11-08" }],
  });
  assert.equal(read?.candidates?.length, 1);
  assert.equal(read?.decisions?.length, 1);
  const { facts, source } = acceptedDocumentFact("basis", 600_000, 4);
  const shared = applyCaseFacts(emptyParentCase, facts, source);
  assert.equal(shared.sources.basis?.page, 4);
  assert.partialDeepStrictEqual(assessBenefit("paternity", shared.facts, today), {
    status: "missing",
    missing: "birth",
  });
  assert.equal(applyCaseFacts(shared, { basis: 450_000 }).facts.basis, 450_000);
});

test("wynik narzędzia i odpowiedzi przyjmują tylko prawidłowe, ustrukturyzowane fakty", () => {
  assert.equal(
    caseActionSchema.safeParse({
      kind: "assess",
      benefit: "paternity",
      goal: "application",
      facts: { insured: true },
    }).success,
    false,
  );
  assert.equal(
    caseActionSchema.safeParse({
      kind: "interpret",
      intent: "answer",
      candidates: [
        {
          field: "insured",
          value: "true",
          scope: "person",
          person: "subject",
          title: null,
          validTime: { kind: "undated" },
          certainty: "stated",
          unit: "none",
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    caseActionSchema.safeParse({
      kind: "interpret",
      intent: "answer",
      candidates: [
        {
          field: "insured",
          value: true,
          scope: "person",
          person: "subject",
          title: null,
          validTime: { kind: "undated" },
          certainty: "stated",
          unit: "none",
        },
      ],
    }).success,
    true,
  );
  assert.deepEqual(readFact("birth", "12.08.2026"), { birth: "2026-08-12" });
  assert.deepEqual(readFact("basis", "6 000,05 zł"), { basis: 600_005 });
});

test("po zmianie celu sprawa zachowuje dane i pozwala ustalić dokumenty przed podstawą", () => {
  const selected = calculatorSession("paternity", today);
  const session = saveFacts(selected, {
    ...caseExamples[0].facts,
    basis: undefined,
    payer: undefined,
  });
  assert.equal(getAssessment(session)?.question?.key, "basis");
  const application = setCaseGoal(session, "application");
  assert.equal(getAssessment(application)?.question?.key, "payer");
  const withPayer = saveFacts(application, { payer: "zus" });
  assert.equal(getAssessment(withPayer)?.question, undefined);
  assert.ok(getAssessment(withPayer)?.result.documents.length);
  assert.equal(getAssessment(withPayer)?.result.money, undefined);
  const next = selectBenefit(
    {
      ...withPayer,
      data: {
        ...withPayer.data,
        persons: withPayer.data.persons.map((p) => ({ ...p, roles: ["birthing"] })),
      },
    },
    "maternity",
  );
  assert.equal(getParentCase(next).facts.birth, getParentCase(withPayer).facts.birth);
  assert.equal(getParentCase(next).facts.from, undefined);
  assert.equal(getParentCase(next).facts.insured, undefined);
});

test("przed porodem szacuje okres i kwotę według przewidywanej daty, po przyjęciu założenia o ubezpieczeniu", () => {
  const facts: CaseFacts = {
    birthStage: "expected",
    dueDate: "2027-02-12",
    employment: "employee",
    children: 1,
    basis: 600_000,
    payer: "zus",
  };
  assert.equal(assessBenefit("maternity", {}, today).missing, "birthStage");
  assert.equal(assessBenefit("maternity", { birthStage: "expected" }, today).missing, "dueDate");
  assert.partialDeepStrictEqual(assessBenefit("maternity", facts, today), {
    status: "missing",
    missing: "insured",
    projected: true,
    coverageDay: "2027-02-12",
  });
  assert.partialDeepStrictEqual(assessBenefit("maternity", { ...facts, insured: true }, today), {
    status: "eligible",
    projected: true,
    period: { from: "2027-02-12", through: "2027-07-01", days: 140 },
    rate: 10_000,
    money: { basis: 600_000, daily: 20_000, total: 2_800_000 },
  });
  assert.equal(
    assessBenefit("maternity", { ...facts, insured: false }, today).status,
    "ineligible",
  );
  assert.equal(assessBenefit("paternity", facts, today).missing, "birth");
});

test("rzeczywista data z dokumentu zastępuje termin porodu i odświeża podstawę oceny", () => {
  const selected = calculatorSession("maternity", today);
  const planning = saveFacts(selected, {
    dueDate: "2026-11-16",
    insured: true,
    employment: "employee",
    basis: 600_000,
    children: 2,
  });
  const { facts, source } = acceptedDocumentFact("birth", "2026-11-19", 3);
  const born = saveFacts(planning, facts, source);
  assert.equal(getParentCase(born).facts.birthStage, "born");
  assert.equal(getParentCase(born).facts.dueDate, undefined);
  assert.equal(getParentCase(born).facts.basis, undefined);
  assert.equal(getParentCase(born).facts.children, undefined);
  assert.equal(getParentCase(born).sources.birth?.page, 3);
  assert.equal(getAssessment(born)?.result.coverageDay, "2026-11-19");
  assert.equal(getAssessment(born)?.question?.key, "employment");
  assert.equal(
    getAssessment(saveFacts(born, { employment: "employee" }))?.question?.key,
    "insured",
  );
});

test("poprawia wybraną odpowiedź i zachowuje pozostałe aktualne odpowiedzi", () => {
  const selected = calculatorSession("maternity", today);
  function answer(session: CaseSession, facts: CaseFacts) {
    const question = getAssessment(session)?.question;
    assert.ok(question);
    return saveQuestionAnswer(session, question, facts);
  }
  const afterStage = answer(selected, { birthStage: "born" });
  const afterDate = answer(afterStage, { birth: "2026-11-19" });
  const employed = answer(afterDate, { employment: "employee" });
  const corrected = saveQuestionAnswer(employed, afterDate.answered[1].question, {
    birth: "2026-11-20",
  });
  assert.equal(getParentCase(corrected).facts.birth, "2026-11-20");
  assert.ok(!corrected.answered.includes(employed.answered[2]));
  assert.equal(getAssessment(corrected)?.question?.key, "employment");
  const reconfirmed = saveFacts(corrected, { employment: "employee" });
  assert.ok(!corrected.answered.includes(afterDate.answered[1]));
  assert.equal(getAssessment(reconfirmed)?.question?.key, "insured");

  const planning = saveQuestionAnswer(corrected, afterStage.answered[0].question, {
    birthStage: "expected",
  });
  assert.equal(getAssessment(planning)?.question?.key, "dueDate");
  assert.equal(getParentCase(planning).facts.birth, undefined);
  assert.ok(!planning.answered.includes(corrected.answered.at(-1)!));
});

test("PDF uzupełnia bieżącą sprawę bez zmiany celu i bez powtarzania otwartego pytania", () => {
  const session = setCaseGoal(calculatorSession("maternity", today), "application");
  const document: AttachedDocument = {
    kind: "document",
    mode: "local",
    file: new File([], "test.pdf"),
    preview: "blob:pdf",
  };
  const attached = append(appendAssessment(session), document);
  const { facts, source } = acceptedDocumentFact("birth", "2026-11-19", 2);
  assert.equal(
    continueWithDocument(attached, document, { benefit: "paternity", facts, sources: source }),
    attached,
  );
  const continued = continueWithDocument(attached, document, {
    baseRevision: attached.data.contextRevision,
    assessmentId: attached.activeAssessmentId,
    benefit: null,
    facts,
    sources: source,
  });
  assert.equal(continued.goal, "application");
  assert.equal(continued.benefit, "maternity");
  assert.equal(continued.turns[0], document);
  assert.equal(continued.turns.length, 2);
  assert.equal(getParentCase(continued).sources.birth?.page, 2);
  assert.equal(getAssessment(continued)?.question?.key, "employment");
  assert.equal(continueWithDocument(continued, document), continued);
});

test("sugestie PDF zachowują sprzeczne wartości i pomijają termin porodu, gdy znamy datę urodzenia", () => {
  const read = validateDocumentRead({
    kind: "medicalCertificate",
    requestedBenefit: null,
    candidates: [
      { key: "dueDate", value: "2026-12-15", page: 1 },
      { key: "basis", value: 500_000, page: 2 },
      { key: "basis", value: 500_000, page: 3 },
      { key: "basis", value: 600_000, page: 4 },
    ],
    decisions: [],
  });
  assert.ok(read);
  assert.deepEqual(documentSuggestions(read, { birth: "2026-11-19", basis: 500_000 }, today), [
    [read.candidates[1], read.candidates[2], read.candidates[3]],
  ]);
  const decision = validateDocumentRead({
    ...read,
    kind: "decision",
    requestedBenefit: "maternity",
  });
  assert.deepEqual(decision?.candidates, []);
  assert.equal(decision?.requestedBenefit, null);
});

test("po korekcie wyboru stawki kalkulator używa bieżącej odpowiedzi", () => {
  const selected = calculatorSession("maternity", today);
  const averaging = saveFacts(selected, { ...employed, averagedRequest: "2025-12-20" });
  assert.equal(getAssessment(averaging)?.result.rate, 8150);
  const standard = saveFacts(averaging, { standardRate: true });
  assert.equal(getAssessment(standard)?.result.rate, 10_000);
});
