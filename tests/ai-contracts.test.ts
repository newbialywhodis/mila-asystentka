import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as intent } from "../src/app/api/parent-intent/route";
import { POST as help } from "../src/app/api/guide-help/route";
import { POST as speech } from "../src/app/api/guide-speech/route";
import { buildAssistantRequest } from "../src/features/parent/case-assistant-context";
import { newSession } from "../src/features/parent/case-session";
import {
  buildTopicHelpRequest,
  buildQuestionHelpRequest,
  generalHelpTopics,
  guideHelpRequestSchema,
} from "../src/features/guide/help-topics";
import { groundHelpAnswer } from "../src/features/guide/helpKnowledge";
import { missingHelpAnswer, unavailableHelpAnswer } from "../src/features/guide/helpAnswers";
import { helpTopicIdSchema } from "../src/features/guide/help-topics";

function request(payload: unknown, route: (request: Request) => Promise<Response>) {
  return route(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}
function provider(output: unknown) {
  return Response.json({
    content: [{ type: "text", text: typeof output === "string" ? output : JSON.stringify(output) }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: { inputTokens: { total: 100 }, outputTokens: { total: 20 } },
    warnings: [],
  });
}

test("chronione tematy: ścisły topicId, zero tekstu/historii/OCR i zero dostawcy nawet bez klucza", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Nie wolno wywołać dostawcy");
  });
  for (const topicId of helpTopicIdSchema.options) {
    const payload = buildTopicHelpRequest(topicId);
    assert.deepEqual(Object.keys(payload).sort(), ["mode", "topicId"]);
    assert.equal((await request(payload, help)).status, 200);
    assert.equal(
      (await (await request(payload, help)).json()).text,
      generalHelpTopics[topicId].text,
    );
  }
  for (const extra of [
    { question: "prywatny tekst" },
    { messages: [] },
    { history: "historia" },
    { family: {} },
    { result: 28000 },
    { ocr: "tekst OCR" },
    { filename: "akta.pdf" },
    { sessionId: "sesja" },
    { context: "stage" },
    { previousSourceIds: ["maternity"] },
  ]) {
    assert.equal(
      (await request({ mode: "topic", topicId: "benefitBasis", ...extra }, help)).status,
      400,
    );
  }
  assert.equal(
    (await request({ mode: "topic", topicId: "individual-case-28000" }, help)).status,
    400,
  );
  assert.equal(mock.mock.callCount(), 0);
  assert.throws(() => buildQuestionHelpRequest("localDocuments", "prywatne dane"));
});

test("odpowiedź zgodna ze schematem i źródłem nadal musi mieć pokrycie w katalogu", async (t) => {
  const oldKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = "fictional-test-key";
  t.after(() => {
    if (oldKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = oldKey;
  });
  const mock = t.mock.method(globalThis, "fetch", async () =>
    provider({
      aboutMila: false,
      text: "Zawsze dostaniesz 999999 zł i możesz pominąć wniosek.",
      sourceIds: ["maternity"],
    }),
  );
  const result = await request({ mode: "question", question: "Wyjaśnij ogólną zasadę" }, help);
  assert.deepEqual(await result.json(), missingHelpAnswer);
  assert.equal(mock.mock.callCount(), 1);
  assert.equal(
    groundHelpAnswer(generalHelpTopics.benefitBasis.text, ["child800"], "2026-11-22"),
    undefined,
  );
  assert.ok(groundHelpAnswer(generalHelpTopics.benefitBasis.text, ["maternity"], "2026-11-22"));
  assert.equal((await request({ text: "Mój wynik to 28000 zł" }, speech)).status, 400);
});

test("parent-intent: rzeczywisty payload SDK ma wyłącznie dozwoloną projekcję; dawne żądanie migruje", async (t) => {
  const oldKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = "fictional-test-key";
  t.after(() => {
    if (oldKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = oldKey;
  });
  const seen: { url: string; body: unknown; model: string | null }[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      url: input instanceof Request ? input.url : input.toString(),
      body: JSON.parse(typeof init?.body === "string" ? init.body : "null"),
      model: new Headers(init?.headers).get("ai-language-model-id"),
    });
    return provider({
      action: {
        kind: "interpret",
        intent: "answer",
        candidates: [
          {
            field: "stage",
            value: "pregnant",
            evidence: "Jestem w ciąży",
            person: null,
            title: null,
            validTime: { kind: "undated", from: null, through: null },
            certainty: "stated",
            unit: "none",
          },
        ],
      },
    });
  });
  const payload = buildAssistantRequest(newSession("private-technical-id"), "Jestem w ciąży");
  const reply = await request(payload, intent);
  assert.equal(reply.status, 200);
  const body = await reply.json();
  assert.equal(body.kind, "interpret");
  assert.equal(body.candidates[0].scope, "family");
  assert.equal(body.candidates[0].value, "pregnant");
  assert.doesNotMatch(
    JSON.stringify(seen),
    /private-technical-id|contextRevision|pendingOperation|documentId/,
  );
  assert.equal(new URL(seen[0].url).hostname, "ai-gateway.vercel.sh");
  assert.equal(seen[0].model, process.env.MILA_INTENT_MODEL?.trim() || "openai/gpt-5-mini");
  const v1 = await request(
    {
      messages: [{ role: "user", content: "Jestem w ciąży" }],
      context: { benefit: null, goal: "calculation", pending: null, confirmed: [] },
    },
    intent,
  );
  assert.equal(v1.status, 200);
});

test("parent-intent: awaria, timeout, wadliwy JSON i celowo niebezpieczne odpowiedzi nie dają faktów", async (t) => {
  const oldKey = process.env.AI_GATEWAY_API_KEY;
  process.env.AI_GATEWAY_API_KEY = "fictional-test-key";
  t.after(() => {
    if (oldKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = oldKey;
  });
  let response: unknown = "{bad json";
  let timeout = false;
  const mock = t.mock.method(globalThis, "fetch", async () => {
    if (timeout) throw new DOMException("Test timeout", "TimeoutError");
    return provider(response);
  });
  t.mock.method(console, "warn", () => {});
  const payload = buildAssistantRequest(newSession(), "Sprawdź moje dane");
  const wire = {
    field: "insured",
    value: "false",
    evidence: "nie mam chorobowego",
    person: null,
    title: null,
    validTime: { kind: "undated", from: null, through: null },
    certainty: "tentative",
    unit: "none",
  };
  for (const bad of [
    "{bad json",
    { action: { kind: "saveFacts", facts: { insured: true } } },
    { action: { kind: "reply", text: "Dostaniesz 28000 zł", choices: [] } },
    {
      action: {
        kind: "interpret",
        intent: "answer",
        candidates: [{ ...wire, field: "unregistered" }],
      },
    },
    {
      action: {
        kind: "interpret",
        intent: "answer",
        candidates: [{ ...wire, person: "unknown-id" }],
      },
    },
    {
      action: {
        kind: "interpret",
        intent: "answer",
        candidates: [{ ...wire, field: "basis", value: "5000 PLN", unit: "grosz" }],
      },
    },
    {
      action: {
        kind: "interpret",
        intent: "answer",
        candidates: [{ ...wire, field: "birth", value: "2026-02-31" }],
      },
    },
    {
      action: {
        kind: "interpret",
        intent: "answer",
        candidates: Array.from({ length: 13 }, () => wire),
      },
    },
  ]) {
    response = bad;
    const result = await request(payload, intent);
    assert.equal(result.status, 503);
    assert.equal(await result.json(), null);
  }
  timeout = true;
  assert.equal((await request(payload, intent)).status, 503);
  assert.equal(mock.mock.callCount(), 18);
  delete process.env.AI_GATEWAY_API_KEY;
  assert.equal((await request(payload, intent)).status, 503);
  assert.equal(
    (await request({ mode: "question", question: "Nieznane pytanie bez API" }, help)).status,
    503,
  );
  assert.deepEqual(
    await (await request({ mode: "question", question: "Nieznane pytanie bez API" }, help)).json(),
    unavailableHelpAnswer,
  );
  assert.equal(
    guideHelpRequestSchema.safeParse({ mode: "question", question: "tekst", ocr: "OCR" }).success,
    false,
  );
});
