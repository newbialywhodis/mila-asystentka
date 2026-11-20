import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../src/app/api/guide-help/route";
import { getHelpKnowledge } from "../src/features/guide/helpKnowledge";

function requestHelp(payload: object) {
  return POST(
    new Request("http://localhost/api/guide-help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

test("wygasła kwota nie trafia do wiedzy modelu ani listy kwot procedury", () => {
  const current = getHelpKnowledge("2027-03-31");
  const nextDay = getHelpKnowledge("2027-04-01");
  assert.equal(current.amounts.nurseryFee.value, 2200);
  assert.equal(nextDay.amounts.nurseryFee, undefined);
  assert.deepEqual(nextDay.procedures.find(({ id }) => id === "ACTIVE_PARENT_NURSERY")?.amounts, [
    "nursery",
    "nurseryHigher",
  ]);
});

test("endpoint wysyła ograniczony kontekst i sprawdza identyfikatory źródeł modelu", async (t) => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.MILA_AI_MODEL;
  process.env.AI_GATEWAY_API_KEY = "mila-test-key";
  delete process.env.MILA_AI_MODEL;
  t.after(() => {
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.MILA_AI_MODEL;
    else process.env.MILA_AI_MODEL = previousModel;
  });

  const question = "A jakie są terminy po porodzie?";
  const payload = { question, context: "stage", previousSourceIds: ["becikowe", "child800"] };
  const output = {
    text: "Każde ze świadczeń ma osobny termin.",
    sourceIds: payload.previousSourceIds,
  };
  let aboutMila = false;
  const gateway = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      content: [{ type: "text", text: JSON.stringify({ aboutMila, ...output }) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 100 }, outputTokens: { total: 20 } },
      warnings: [],
    }),
  );

  const invalid = await requestHelp({ ...payload, profile: { birthDate: "2026-11-19" } });
  assert.equal(invalid.status, 400);
  assert.equal(gateway.mock.callCount(), 0);

  const introduction = await requestHelp({ question: "Do czego właściwie śłużysz?" });
  const description = await introduction.json();
  assert.match(description.text, /^Jestem Mila\./);
  assert.equal(description.sourceIds, undefined);
  assert.equal(gateway.mock.callCount(), 0);

  const reply = await requestHelp(payload);
  assert.equal(reply.status, 200);
  assert.deepEqual(await reply.json(), output);
  const [url, init] = gateway.mock.calls[0].arguments;
  assert.ok(typeof url === "string");
  assert.equal(new URL(url).hostname, "ai-gateway.vercel.sh");
  assert.ok(typeof init?.body === "string");
  assert.equal(new Headers(init.headers).get("ai-language-model-id"), "openai/gpt-5-mini");
  const { prompt, providerOptions } = JSON.parse(init.body);
  assert.deepEqual(providerOptions, {
    gateway: { disallowPromptTraining: true, has: ["structured-output"] },
    openai: { reasoningEffort: "minimal", store: false },
  });
  assert.equal(prompt[0].role, "system");
  assert.match(prompt[0].content, /Świadczenie wychowawcze 800\+/);
  const userMessage = JSON.parse(prompt[1].content[0].text);
  assert.match(userMessage.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(userMessage, {
    today: userMessage.today,
    guideQuestion: "Na jakim jesteś etapie?",
    previousSourceIds: payload.previousSourceIds,
    question,
  });

  aboutMila = true;
  const paraphrase = await requestHelp({ question: "Jaki jest właściwie cel tego czatu?" });
  assert.deepEqual(await paraphrase.json(), description);

  aboutMila = false;
  t.mock.method(console, "warn", () => {});
  output.sourceIds = ["toString"];
  const rejected = await requestHelp(payload);
  assert.equal(rejected.status, 503);
  assert.equal((await rejected.json()).sourceIds, undefined);
});
