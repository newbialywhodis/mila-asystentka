import assert from "node:assert/strict";
import test from "node:test";
import version from "../src/data/version.json";
import { initialConversation, submitAnswer } from "../src/features/guide/conversation";
import { getProfile } from "../src/features/guide/flow";
import {
  exampleAllowance,
  exampleAnswers,
  exampleAsOf,
  exampleRegistration,
} from "../src/features/landing/exampleCase";

test("fikcyjny przykład landingu można odtworzyć przez aktualny wywiad", () => {
  let conversation = initialConversation;
  while (conversation.messages[conversation.prompt].kind === "question") {
    const message = conversation.messages[conversation.prompt];
    if (message.kind !== "question") break;
    assert.ok(Object.hasOwn(exampleAnswers, message.question));
    conversation = submitAnswer(
      conversation,
      conversation.prompt,
      exampleAnswers[message.question as keyof typeof exampleAnswers],
    );
  }
  assert.equal(conversation.messages[conversation.prompt].kind, "plan");
  assert.deepEqual(getProfile(conversation.answers), getProfile(exampleAnswers));
});

test("przykład zachowuje spójność dat i nie sugeruje potwierdzonego prawa do zasiłku", () => {
  assert.ok(exampleAsOf >= version.verifiedAt);
  assert.ok(exampleAnswers.birthDate <= exampleAnswers.birthCardDate);
  assert.ok(exampleAnswers.birthCardDate <= exampleAsOf);
  assert.equal(exampleRegistration.audit.evaluatedAt, exampleAsOf);
  assert.equal(exampleRegistration.status, "relevant");
  assert.equal(exampleRegistration.deadlines[0].date, "2026-12-10");
  assert.equal(exampleRegistration.deadlines[0].rule.type, "offset");
  assert.equal(exampleAllowance.status, "missing-data");
  assert.ok(exampleAllowance.missingFields.includes("insuredAtBirth"));
});
