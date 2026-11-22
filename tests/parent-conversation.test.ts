import assert from "node:assert/strict";
import { test } from "node:test";
import { assessBenefit } from "../src/engine/parent-benefit";
import type { CaseFacts } from "../src/engine/parent-case";
import { buildAssistantRequest } from "../src/features/parent/case-assistant-context";
import { readFact } from "../src/features/parent/case-fields";
import { readCareComparison, readCaseRequest } from "../src/features/parent/case-message";
import { pregnancyConcernReply } from "../src/features/parent/case-replies";
import {
  append,
  appendAssessment,
  appendCareComparison,
  appendMissingFactReply,
  askBenefit,
  continueWithAssessment,
  continueWithDocument,
  continueWithRequest,
  getAssessment,
  getBenefitTurn,
  newSession,
  saveFacts,
  saveQuestionAnswer,
  selectBenefit,
} from "../src/features/parent/case-session";
import {
  caseActionFromIntent,
  caseActionSchema,
  modelIntentSchema,
} from "../src/features/parent/parent-intent";

const asOf = "2026-11-21";
const paternity: CaseFacts = {
  birth: "2026-08-12",
  from: "2026-12-07",
  employment: "employee",
  insured: true,
  paternityUsed: "none",
  basis: 600_000,
  payer: "zus",
};

test("brak wymaganej daty końcowej zostawia aktywne pytanie bez powtarzania go", () => {
  const session = appendAssessment(
    saveFacts({ ...newSession(), asOf, benefit: "paternity" }, paternity),
  );
  const turn = getBenefitTurn(session);
  assert.equal(turn?.kind, "assessment");
  assert.equal(turn.question?.key, "through");

  const next = appendMissingFactReply(session, turn.question);
  const reply = next.turns.at(-1);
  assert.equal(reply?.kind, "reply");
  assert.match(reply.text, /Potrzebuję tej informacji/);
  assert.notEqual(reply.text, turn.text);
  assert.equal(getBenefitTurn(next), turn);
  assert.equal(next.family, session.family);

  const answered = saveQuestionAnswer(next, turn.question, { through: "2026-12-13" });
  assert.equal(getAssessment(answered)?.result.period?.days, 7);
});

test("odpowiedź o ciąży trafia do kontekstu dopytania bez pytania kalkulatora", () => {
  const session = appendAssessment({ ...newSession(), asOf, benefit: "paternity" });
  const message = "chyba poronie";
  const text = "To brzmi niepokojąco. Co teraz się dzieje?";
  const reply = pregnancyConcernReply(text);
  const next = append(session, { kind: "user", text: message }, reply);
  const request = buildAssistantRequest(next, "jak mi pomozesz");
  assert.deepEqual(request.messages.slice(-3), [
    { role: "user", content: message },
    { role: "assistant", content: reply.text },
    { role: "user", content: "jak mi pomozesz" },
  ]);
  assert.equal(request.context.pending, null);
  assert.equal(getBenefitTurn(next), getBenefitTurn(session));
  assert.ok(reply.text.startsWith(text));
  assert.match(reply.text, /112/);
});

test("wygenerowane dopytanie trafia do rozmowy bez automatycznej porady o ciąży", () => {
  const text = "Masz wyznaczony termin na jutro czy czujesz, że poród się zaczyna?";
  const reply = { kind: "reply" as const, text, choices: [] };
  const next = append(
    { ...newSession(), asOf },
    { kind: "user", text: "jednak chyba urodzi się jutro" },
    reply,
  );
  const request = buildAssistantRequest(next, "co?");
  assert.deepEqual(request.messages.slice(-2), [
    { role: "assistant", content: text },
    { role: "user", content: "co?" },
  ]);
});

test("model zwraca jedną dozwoloną akcję z danymi zgodnymi z kontraktem czatu", () => {
  const context = buildAssistantRequest(
    { ...newSession(), benefit: "paternity", goal: "application" },
    "Chcę uzupełnić dane",
  ).context;
  const assess = modelIntentSchema.parse({
    action: {
      kind: "assess",
      benefit: null,
      goal: "calculation",
      facts: [
        { key: "insured", value: "true" },
        { key: "birth", value: "nieznana" },
      ],
    },
  });
  const action = caseActionFromIntent(assess, context);
  assert.deepEqual(caseActionSchema.parse(action), {
    kind: "assess",
    benefit: null,
    goal: "application",
    facts: { insured: true },
  });
  assert.equal(
    modelIntentSchema.safeParse({ action: { kind: "google:python_interpreter" } }).success,
    false,
  );
  assert.equal(
    modelIntentSchema.safeParse({
      action: {
        kind: "urgentPregnancyCare",
        text: "Czy obawiasz się poronienia?",
        choices: ["benefit"],
      },
    }).success,
    false,
  );
});

test("nadmiar propozycji modelu nie odrzuca poprawnego tekstu odpowiedzi", () => {
  const { context } = buildAssistantRequest(newSession(), "Od czego zacząć?");
  const text = "Co chcesz najpierw omówić?";
  const modeled = modelIntentSchema.parse({
    action: {
      kind: "reply",
      text,
      choices: ["beforeBirth", "beforeBirth", "afterBirth", "benefit"],
    },
  });
  assert.deepEqual(caseActionSchema.parse(caseActionFromIntent(modeled, context)), {
    kind: "reply",
    text,
    choices: ["beforeBirth", "afterBirth"],
  });
});

test("akcja poza zakresem przechodzi do czatu bez tekstu modelu", () => {
  const { context } = buildAssistantRequest(newSession(), "Daj przepis na ciasto owocowe");
  const action = { kind: "outOfScope" };
  const modeled = modelIntentSchema.parse({ action });
  assert.deepEqual(caseActionSchema.parse(caseActionFromIntent(modeled, context)), action);
  assert.equal(
    modelIntentSchema.safeParse({ action: { ...action, text: "Prosty placek owocowy" } }).success,
    false,
  );
});

test("kontekst intencji zawiera klucz pytania, a dane z odczytu PDF zostają w sprawie", () => {
  const document = {
    kind: "document",
    file: new File([], "przyklad.pdf"),
    mode: "local",
    preview: "blob:przyklad",
  } as const;
  const session = continueWithDocument({ ...newSession(), asOf, turns: [document] }, document, {
    benefit: "paternity",
    facts: { birth: "2026-08-12", from: "2026-12-07", employment: "employee" },
    sources: {},
  });
  const question = getAssessment(session)?.question;
  assert.equal(question?.key, "insured");
  assert.match(question?.text ?? "", /07\.12\.2026/);
  const request = buildAssistantRequest(session, "Skąd bierze się to pytanie?");
  assert.equal(request.context.pending, "insured");
  assert.deepEqual(request.context.confirmed, ["birth", "from", "employment", "birthStage"]);
  assert.doesNotMatch(JSON.stringify(request), /07\.12\.2026|2026-08-12|przyklad\.pdf/);
});

test("porównanie przechowuje własne dane wejściowe i wymaga ubezpieczenia dla symulacji", () => {
  const session = saveFacts({ ...newSession(), asOf, benefit: "paternity" }, paternity);
  const started = appendCareComparison(session, 50);
  const comparison = started.turns.at(-1);
  assert.equal(comparison?.kind, "compareCare");
  if (comparison?.kind !== "compareCare") return;
  const revised = saveFacts(started, { birth: "2026-09-12", basis: 720_000 });
  assert.equal(comparison.workPercent, 50);
  assert.equal(comparison.facts.insured, undefined);
  assert.equal(session.family.facts.insured, true);
  assert.equal(comparison.facts.birth, "2026-08-12");
  assert.equal(comparison.facts.basis, 600_000);
  assert.equal(revised.family.facts.basis, 720_000);
});

test("opis sytuacji bez świadczenia nie otwiera listy kalkulatora", () => {
  const session = { ...newSession(), asOf };
  const next = continueWithAssessment(session, {
    kind: "assess",
    benefit: null,
    goal: "calculation",
    facts: { dueDate: "2026-11-24" },
  });
  assert.equal(next.turns.at(-1)?.kind, "reply");
  assert.equal(getBenefitTurn(next), undefined);
  assert.deepEqual(next.family.facts, {});
});

test("pusta odpowiedź modelu nie powtarza pytania z kalkulatora", () => {
  const session = appendAssessment({ ...newSession(), asOf, benefit: "paternity" });
  const action = { kind: "assess", benefit: null, goal: "calculation", facts: {} } as const;
  const next = continueWithAssessment(session, action);
  assert.equal(next.turns.at(-1)?.kind, "reply");
  assert.equal(getBenefitTurn(next), getBenefitTurn(session));

  const proposed = continueWithAssessment(next, {
    ...action,
    facts: { birth: "2026-11-20" },
  });
  assert.equal(proposed.turns.at(-1)?.kind, "propose");
});

test("otwiera porównanie na podstawie naturalnego pytania o pracę lub podział urlopu", () => {
  for (const [text, workPercent] of [
    ["Co się zmieni, jeśli wrócę na pół etatu podczas rodzicielskiego?", 50],
    ["A jeśli będę pracować na ćwierć etatu w trakcie urlopu rodzicielskiego?", 25],
    ["Jak możemy podzielić urlop rodzicielski?", null],
  ] as const) {
    assert.deepEqual(readCareComparison(text), { kind: "compareCare", workPercent });
  }
  assert.equal(
    readCareComparison("Czy mogę pracować na pół etatu podczas rodzicielskiego?"),
    undefined,
  );
  assert.equal(
    readCareComparison("Co się zmieni, jeśli wrócę na pół etatu po rodzicielskim?"),
    undefined,
  );
});

test("rozpoznaje świadczenie i długość z kilku naturalnych sformułowań", () => {
  const cases = [
    ["Chcę wziąć tydzień ojcowskiego", "paternity", 7, undefined],
    ["Poproszę o dwa tygodnie urlopu ojcowskiego", "paternity", 14, undefined],
    ["Ile dostanę za 7 dni ojcowskiego od 7 grudnia?", "paternity", 7, "2026-12-07"],
    ["Chcę wziąć urlop rodzicielski od 28.12.2026 na 2 tygodnie", "parental", 14, "2026-12-28"],
    ["Policz cztery tygodnie rodzicielskiego od 1 grudnia 2026", "parental", 28, "2026-12-01"],
    ["Jestem w ciąży. Mam L4 na 10 dni od 29.12.2026.", "sickness", 10, "2026-12-29"],
    ["Jestem w ciąży i mam zwolnienie lekarskie na 5 dni", "sickness", 5, undefined],
    ["Chcę policzyć 7 dni świadczenia rehabilitacyjnego w ciąży", "rehabilitation", 7, undefined],
    ["Ile dostanę na macierzyńskim?", "maternity", undefined, undefined],
    ["Chcę sprawdzić uzupełniający urlop macierzyński", "supplement", undefined, undefined],
    ["Zasiłek po adopcji", "careMaternity", undefined, undefined],
  ] as const;
  for (const [message, benefit, requestedDays, from] of cases) {
    const request = readCaseRequest(message, { asOf });
    assert.equal(request?.benefit, benefit, message);
    assert.equal(request?.facts.requestedDays, requestedDays, message);
    assert.equal(request?.facts.from, from, message);
    assert.equal(request?.facts.paternityUsed, undefined, message);
    assert.equal(request?.facts.insured, undefined, message);
  }
});

test("zachowuje cel dokumentów oraz przedział z podanymi datami", () => {
  const application = readCaseRequest("Jakie dokumenty są potrzebne do ojcowskiego?", { asOf });
  assert.equal(application?.goal, "application");
  assert.equal(application?.benefit, "paternity");
  const range = readCaseRequest("Ojcowski od 28.12.2026 do 3.01.2027", { asOf });
  assert.deepEqual(range?.facts, { from: "2026-12-28", through: "2027-01-03" });

  const bareChoice = readCaseRequest("Ojcowskie", { asOf });
  assert.ok(bareChoice);
  const choosing = askBenefit({ ...newSession(), asOf }, "application");
  assert.equal(continueWithRequest(choosing, bareChoice, "Ojcowskie").goal, "application");
});

test("nie zamienia wykorzystanego okresu, pytań ogólnych ani innego świadczenia w plan", () => {
  for (const input of [
    "Wykorzystałem tydzień ojcowskiego",
    "Nie chcę wziąć tygodnia ojcowskiego",
    "Co to jest urlop ojcowski?",
    "Czy ojcowski i rodzicielski można łączyć?",
    "Chcę sprawdzić świadczenie rodzicielskie",
    "Chcę tydzień ojcowskiego od 7.12.2026 do 20.12.2026",
    "Chcę wziąć tydzień ojcowskiego od 31.02.2027",
    "Ojcowski od 10 grudnia do 7 grudnia",
  ]) {
    assert.equal(readCaseRequest(input, { asOf }), undefined, input);
  }
  assert.deepEqual(readFact("paternityUsed", "Wykorzystałem już tydzień ojcowskiego"), {
    paternityUsed: "week",
  });
  assert.deepEqual(readFact("paternityUsed", "Nie korzystałem z ojcowskiego"), {
    paternityUsed: "none",
  });
  assert.deepEqual(readFact("usedDays", "dwa tygodnie"), { usedDays: 14 });
  assert.deepEqual(readFact("otherParentDays", "7 dni"), { otherParentDays: 7 });
  assert.equal(readFact("paternityUsed", "Chcę wziąć tydzień ojcowskiego"), undefined);
});

test("pyta o start zaplanowanego ojcowskiego i pokazuje zakres od razu po dacie", () => {
  const message = "Chcę wziąć tydzień ojcowskiego";
  const request = readCaseRequest(message, { asOf });
  assert.ok(request);
  const session = continueWithRequest({ ...newSession(), asOf }, request, message);
  const first = getAssessment(session)?.question;
  assert.equal(first?.key, "from");
  assert.match(first.text, /7 dni ojcowskiego/);
  const date = readFact("from", "7 grudnia", asOf);
  assert.deepEqual(date, { from: "2026-12-07" });
  assert.deepEqual(readFact("from", "3 stycznia", asOf), { from: "2027-01-03" });
  assert.equal(readFact("birth", "7 grudnia", asOf), undefined);
  const next = appendAssessment(saveQuestionAnswer(session, first, date), true);
  const turn = getBenefitTurn(next);
  assert.equal(turn?.kind, "assessment");
  assert.equal(turn.question?.key, "birth");
  assert.match(turn.text, /od 07\.12\.2026 do 13\.12\.2026 \(7 dni\)/);
});

test("zmiana startu zachowuje długość, a wybranie konkretnego końca ją zastępuje", () => {
  const session = saveFacts(
    { ...newSession(), asOf, benefit: "paternity" },
    {
      ...paternity,
      requestedDays: 7,
    },
  );
  const corrected = saveFacts(session, { from: "2026-12-28" });
  assert.equal(corrected.family.facts.insured, undefined);
  assert.equal(corrected.family.facts.requestedDays, 7);
  const confirmed = saveFacts(corrected, { insured: true });
  assert.deepEqual(getAssessment(confirmed)?.result.period, {
    from: "2026-12-28",
    through: "2027-01-03",
    days: 7,
  });
  assert.equal(getAssessment(confirmed)?.result.money?.total, 140_000);
  const explicit = saveFacts(confirmed, { through: "2027-01-10" });
  assert.equal(explicit.family.facts.requestedDays, undefined);
  assert.equal(getAssessment(explicit)?.result.period?.days, 14);
  const lengthReply = readCaseRequest("Jednak tydzień", {
    asOf,
    benefit: "paternity",
  });
  assert.ok(lengthReply);
  const revised = continueWithRequest(explicit, lengthReply, "Jednak tydzień");
  assert.equal(revised.family.facts.through, undefined);
  assert.equal(getAssessment(revised)?.result.period?.days, 7);
  assert.equal(selectBenefit(revised, "parental").family.facts.requestedDays, undefined);
});

test("zweryfikowany okres nadal musi mieścić się w dostępnych dniach i granicy wieku", () => {
  const invalid = assessBenefit("paternity", { requestedDays: 10 }, asOf);
  assert.equal(invalid.missing, "requestedDays");
  assert.match(invalid.reason, /7 dni albo 14 dni/);
  const used = assessBenefit(
    "paternity",
    { ...paternity, requestedDays: 14, paternityUsed: "week" },
    asOf,
  );
  assert.equal(used.missing, "requestedDays");
  assert.match(used.reason, /Został Ci tydzień/);
  const pastLimit = assessBenefit(
    "paternity",
    { ...paternity, birth: "2025-12-10", requestedDays: 7 },
    asOf,
  );
  assert.equal(pastLimit.status, "ineligible");
  assert.match(pastLimit.reason, /12 miesięcy/);
});

test("kalkulator liczy podaną długość dla rodzicielskiego i chorobowego", () => {
  const parental = assessBenefit(
    "parental",
    {
      ...paternity,
      birth: "2026-04-12",
      from: "2026-12-28",
      requestedDays: 28,
      parts: 0,
      children: 1,
      careCertificate: false,
      usedDays: 0,
      otherParentDays: 0,
      soleParent: false,
      reserved: false,
      standardRate: true,
    },
    asOf,
  );
  assert.deepEqual(parental.period, { from: "2026-12-28", through: "2027-01-24", days: 28 });
  assert.equal(parental.money?.total, 392_000);
  const sickness = assessBenefit(
    "sickness",
    {
      from: "2026-12-29",
      requestedDays: 10,
      employment: "employee",
      insured: true,
      qualifying: true,
      pregnancyProof: true,
      employerSickPayEnded: true,
      sickDaysUsed: 0,
      basis: 600_000,
      payer: "zus",
    },
    asOf,
  );
  assert.deepEqual(sickness.period, { from: "2026-12-29", through: "2027-01-07", days: 10 });
  assert.equal(sickness.money?.total, 200_000);
});
