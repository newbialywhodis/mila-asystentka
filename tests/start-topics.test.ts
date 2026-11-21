import assert from "node:assert/strict";
import test from "node:test";
import { initialConversation, submitAnswer } from "../src/features/guide/conversation";
import { getProfile } from "../src/features/guide/flow";
import {
  parseStartTopics,
  preferredPlanSection,
  suggestedPlanInterests,
  topicChatHref,
} from "../src/features/guide/startTopics";

test("tematy z adresu są ograniczone do znanych wartości, uporządkowane i bez duplikatów", () => {
  assert.deepEqual(parseStartTopics("health,benefits,unknown,benefits,deadlines"), [
    "benefits",
    "health",
    "deadlines",
  ]);
  for (const value of [undefined, "", "<script>alert(1)</script>", "benefits,".repeat(30)]) {
    assert.deepEqual(parseStartTopics(value), []);
  }
  assert.deepEqual(parseStartTopics(["health", "leave"]), []);
  assert.deepEqual(parseStartTopics("Benefits, benefits,HEALTH"), []);
});

test("CTA przekazuje tylko tematy; pusty wybór rozpoczyna standardową rozmowę", () => {
  assert.equal(topicChatHref([]), "/chat");
  const href = topicChatHref(["health", "benefits", "health"]);
  const url = new URL(href, "http://localhost");
  assert.equal(url.pathname, "/chat");
  assert.deepEqual(parseStartTopics(url.searchParams.get("topics") ?? undefined), [
    "benefits",
    "health",
  ]);
  assert.equal(url.searchParams.size, 1);
});

test("sugestie korzystają z istniejących planInterests; terminy pozostają preferencją", () => {
  assert.deepEqual(suggestedPlanInterests(["benefits", "leave", "registration", "health"]), [
    "benefits",
    "leave",
    "registration",
    "support",
  ]);
  assert.deepEqual(suggestedPlanInterests(["deadlines"]), []);
  assert.equal(preferredPlanSection(["deadlines", "benefits"]), "timeline");
  assert.equal(preferredPlanSection(["benefits"]), "benefits");
  assert.equal(preferredPlanSection(["leave"]), "benefits");
  assert.equal(preferredPlanSection(["registration", "health"]), "tasks");
  assert.equal(preferredPlanSection([]), "timeline");
});

test("preferencje nie tworzą profilu ani odpowiedzi i nie pomijają potwierdzenia zainteresowań", () => {
  const suggested = suggestedPlanInterests(parseStartTopics("benefits,health"));
  const planning = submitAnswer(initialConversation, 0, "planning");
  const question = planning.messages[planning.prompt];
  assert.equal(question.kind, "question");
  assert.ok(question.kind === "question" && question.question === "planInterests");
  assert.equal(planning.answers.planInterests, undefined);
  assert.deepEqual(getProfile(planning.answers), {});
  const confirmed = submitAnswer(planning, planning.prompt, suggested);
  assert.deepEqual(confirmed.answers.planInterests, ["benefits", "support"]);
  assert.equal(confirmed.messages[confirmed.prompt].kind, "plan");

  for (const stage of ["born", "pregnant"]) {
    const conversation = submitAnswer(initialConversation, 0, stage);
    const next = conversation.messages[conversation.prompt];
    assert.ok(next.kind === "question");
    assert.equal(next.question, stage === "born" ? "birthDate" : "pregnancyTiming");
    assert.equal(conversation.answers.employment, undefined);
  }
});
