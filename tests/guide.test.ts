import assert from "node:assert/strict";
import test from "node:test";
import {
  appendHelp,
  cancelRevision,
  getEditableAnswers,
  initialConversation,
  resolveHelp,
  reviseAnswer,
  submitAnswer,
} from "../src/features/guide/conversation";
import { answerLabel, getProfile, getQuestionIds, saveAnswer } from "../src/features/guide/flow";
import type { Answers } from "../src/features/guide/flow";
import { explanationPrompt, findHelpAnswer, helpTopics } from "../src/features/guide/helpAnswers";
import { readTextAnswer } from "../src/features/guide/textInput";

test("zmiana etapu usuwa dane wcześniej zadanych pytań", () => {
  const answers = saveAnswer(
    { stage: "born", birthDate: "2026-11-17", birthRegistered: false },
    "stage",
    "pregnant",
  );
  assert.deepEqual(answers, { stage: "pregnant" });
  assert.equal(getQuestionIds(answers)[1], "pregnancyTiming");
});

test("zmiana danych po narodzinach zmienia ostatnie pytanie i usuwa nieaktualną datę", () => {
  const answers: Answers = {
    stage: "born",
    birthDate: "2026-11-17",
    employment: "employee",
    birthRegistered: false,
    birthCardDate: "2026-11-17",
  };
  assert.equal(getQuestionIds(answers).at(-1), "birthCardDate");
  const updated = saveAnswer(answers, "birthRegistered", true);
  assert.equal(getQuestionIds(updated).at(-1), "healthRegistered");
  const profile = getProfile(updated);
  assert.equal(profile.birthDate, "2026-11-17");
  assert.equal(profile.employment, "employee");
  assert.equal(profile.birthRegistered, true);
  assert.equal(profile.birthCardDate, undefined);
  assert.equal(getProfile(saveAnswer(answers, "birthDate", "2026-11-18")).birthCardDate, undefined);
});

test("przedział ciąży nie staje się przewidywaną datą porodu", () => {
  const answers: Answers = {
    stage: "pregnant",
    pregnancyTiming: "middle",
    employment: "employee",
    sicknessLeave: true,
    sicknessInsurance: false,
  };
  assert.equal(getQuestionIds(answers).at(-1), "sicknessInsurance");
  assert.equal(getProfile(answers).dueDate, undefined);
  const updated = saveAnswer(answers, "sicknessLeave", false);
  assert.equal(getQuestionIds(updated).at(-1), "medicalCareWeek10");
  assert.equal(getProfile(updated).sicknessInsurance, undefined);
  assert.equal(
    getProfile(saveAnswer(updated, "pregnancyTiming", "2027-02-03")).dueDate,
    "2027-02-03",
  );
});

test("wybory w ścieżce planowania ciąży służą planowi przygotowań", () => {
  const answers = saveAnswer({ stage: "planning" }, "planInterests", ["leave", "benefits"]);
  assert.deepEqual(getQuestionIds(answers), ["stage", "planInterests"]);
  assert.equal(
    answerLabel("planInterests", ["leave", "benefits"]),
    "Świadczenia finansowe, Urlopy dla rodziców",
  );
  assert.deepEqual(getProfile(answers), {});
  assert.deepEqual(saveAnswer(answers, "stage", "born"), { stage: "born" });
});

test("dodatkowe pytanie korzysta z kontekstu bieżącego kroku", () => {
  assert.equal(findHelpAnswer(explanationPrompt, "employment")?.source, "maternity");
  assert.equal(findHelpAnswer(explanationPrompt, "birthCardDate")?.source, "birth");
  assert.equal(
    findHelpAnswer("Co to znaczy urlop macierzyński?", "planInterests")?.source,
    "maternity",
  );
  assert.equal(
    findHelpAnswer("Jak ubezpieczyć dziecko po nadaniu PESEL?", "employment")?.source,
    "health",
  );
  assert.equal(findHelpAnswer("Co znaczy numer telefonu?"), undefined);
});

test("znane pytania mają odpowiedź bez wysyłania pytania do AI", () => {
  for (const { label, text } of helpTopics) {
    assert.equal(findHelpAnswer(label)?.text, text, label);
  }
});

test("historia zachowuje kolejność przy dopytaniu i zmianie ścieżki", () => {
  const asked = appendHelp(initialConversation, { id: 0, question: "Czy dostanę 800+?" });
  const planning = submitAnswer(asked, asked.prompt, "planning");
  const plan = submitAnswer(planning, planning.prompt, ["benefits"]);
  const editing = reviseAnswer(plan, "stage");
  assert.ok(editing.revision !== undefined);

  const updated = submitAnswer(editing, editing.revision, "born");
  const answer = { text: "Wniosek składasz w ZUS.", source: "child800" };
  const resolved = resolveHelp(updated, 0, answer);

  assert.deepEqual(resolved.answers, { stage: "born" });
  assert.deepEqual(
    resolved.messages.map(({ kind }) => kind),
    ["question", "help", "answer", "question", "answer", "plan", "question", "answer", "question"],
  );
  assert.deepEqual(resolved.messages[1], {
    kind: "help",
    exchange: { id: 0, question: "Czy dostanę 800+?", answer },
  });
  const next = resolved.messages[resolved.prompt];
  assert.equal(next.kind, "question");
  assert.equal(next.question, "birthDate");
  assert.equal(next.celebrate, true);
  assert.match(next.text, /^Gratulacje! 💛 /u);
  assert.match(next.text, /Kiedy urodziło się dziecko\?$/);
  assert.deepEqual([...getEditableAnswers(resolved)], [["stage", 7]]);
});

test("odpowiedź tekstowa zmienia profil i zachowuje treść wiadomości w historii", () => {
  const text = "Spodziewam się dziecka!";
  const parsed = readTextAnswer("stage", text, "2026-11-19");
  assert.deepEqual(parsed, { value: "pregnant" });
  assert.ok(parsed && "value" in parsed);
  const conversation = submitAnswer(initialConversation, 0, parsed.value, text);
  assert.equal(conversation.answers.stage, "pregnant");
  assert.equal(conversation.messages[0], initialConversation.messages[0]);
  assert.deepEqual(conversation.messages[1], { kind: "answer", question: "stage", text });
  const next = conversation.messages[conversation.prompt];
  assert.equal(next.kind, "question");
  assert.equal(next.question, "pregnancyTiming");
  assert.equal(next.celebrate, true);
  assert.match(next.text, /^Gratulacje! 💛 /u);
});

test("planowanie i ponowny wybór tego samego etapu nie wywołują gratulacji", () => {
  const planning = submitAnswer(initialConversation, 0, "planning");
  const interests = planning.messages[planning.prompt];
  assert.equal(interests.kind, "question");
  assert.equal(interests.celebrate, false);
  assert.doesNotMatch(interests.text, /Gratulacje/u);

  const pregnant = submitAnswer(initialConversation, 0, "pregnant");
  const editing = reviseAnswer(pregnant, "stage");
  assert.ok(editing.revision !== undefined);
  const confirmed = submitAnswer(editing, editing.revision, "pregnant");
  const timing = confirmed.messages[confirmed.prompt];
  assert.equal(timing.kind, "question");
  assert.equal(timing.question, "pregnancyTiming");
  assert.equal(timing.celebrate, false);
  assert.doesNotMatch(timing.text, /Gratulacje/u);
});

test("pole rozmowy rozpoznaje odpowiedzi, a dopytania zostawia do obsługi pomocy", () => {
  const today = "2026-11-19";
  assert.deepEqual(readTextAnswer("planInterests", "Urlopy i świadczenia", today), {
    value: ["leave", "benefits"],
  });
  assert.deepEqual(readTextAnswer("pregnancyTiming", "Jestem w 18. tygodniu ciąży.", today), {
    value: "middle",
  });
  assert.deepEqual(readTextAnswer("pregnancyTiming", "Mam termin na 8 lutego 2027", today), {
    value: "2027-02-08",
  });
  assert.deepEqual(readTextAnswer("birthDate", "Urodziłam wczoraj", today), {
    value: "2026-11-18",
  });
  const dateBeforeBirth = readTextAnswer("birthCardDate", "17.11.2026", today, "2026-11-18");
  assert.ok(dateBeforeBirth && "clarification" in dateBeforeBirth);
  assert.deepEqual(readTextAnswer("birthRegistered", "Tak, już zgłosiłam", today), { value: true });
  assert.deepEqual(readTextAnswer("birthRegistered", "Nie, jeszcze nie", today), { value: false });
  assert.equal(readTextAnswer("birthRegistered", "Nie, jak to zrobić?", today), undefined);
  assert.equal(readTextAnswer("birthRegistered", "Nie wiem, jak to zrobić", today), undefined);
  assert.equal(readTextAnswer("birthRegistered", "Nie mam pojęcia", today), undefined);
});

test("anulowanie zmiany przywraca pytanie i zachowuje dopytanie z edycji", () => {
  const planning = submitAnswer(initialConversation, 0, "planning");
  const editing = reviseAnswer(planning, "stage");
  const exchange = { id: 0, question: "Dlaczego o to pytasz?", answer: { text: "Dopasuję plan." } };
  const cancelled = cancelRevision(appendHelp(editing, exchange));

  assert.equal(cancelled.revision, undefined);
  assert.equal(cancelled.prompt, planning.prompt);
  assert.deepEqual(cancelled.answers, planning.answers);
  assert.deepEqual(cancelled.messages, [...planning.messages, { kind: "help", exchange }]);
});
