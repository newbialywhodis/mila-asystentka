import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { test } from "node:test";
import { POST } from "../src/app/api/guide-help/route";
import { POST as postSpeech } from "../src/app/api/guide-speech/route";
import audioManifest from "../src/features/guide/audioManifest.json";
import { getStaticHelpTexts } from "../src/features/guide/helpAnswers";
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

function requestSpeech(payload: object) {
  return postSpeech(
    new Request("http://localhost/api/guide-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

test("wszystkie stałe odpowiedzi Mili mają gotowe MP3", () => {
  const recordings = new Map<string, string>(Object.entries(audioManifest));
  for (const text of getStaticHelpTexts()) {
    const filename = recordings.get(text);
    assert.ok(filename, `Brak nagrania dla odpowiedzi „${text}”. Uruchom bun run audio:generate.`);
    const audio = statSync(new URL(`../public/audio/mila/${filename}`, import.meta.url), {
      throwIfNoEntry: false,
    });
    assert.ok(audio?.isFile() && audio.size > 0, `Brak pliku audio ${filename}.`);
  }
});

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

test("Mila sprawdza źródła modelu i pozwala odczytać podpisaną odpowiedź", async (t) => {
  const previousKey = process.env.AI_GATEWAY_API_KEY;
  const previousModel = process.env.MILA_AI_MODEL;
  const previousSpeechKey = process.env.ELEVENLABS_API_KEY;
  process.env.AI_GATEWAY_API_KEY = "mila-test-key";
  process.env.ELEVENLABS_API_KEY = "mila-speech-test-key";
  delete process.env.MILA_AI_MODEL;
  t.after(() => {
    if (previousKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.MILA_AI_MODEL;
    else process.env.MILA_AI_MODEL = previousModel;
    if (previousSpeechKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = previousSpeechKey;
  });

  const question = "A jakie są terminy po porodzie?";
  const payload = { question, context: "stage", previousSourceIds: ["becikowe", "child800"] };
  const output = {
    text: "Każde ze świadczeń ma osobny termin.",
    sourceIds: payload.previousSourceIds,
  };
  let aboutMila = false;
  let speechAvailable = true;
  const audio = new Uint8Array([73, 68, 51]);
  const provider = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    if (typeof input === "string" && input.startsWith("https://api.elevenlabs.io/")) {
      return speechAvailable
        ? new Response(audio, { headers: { "Content-Type": "audio/mpeg" } })
        : Response.json({ detail: "błąd dostawcy" }, { status: 429 });
    }
    return Response.json({
      content: [{ type: "text", text: JSON.stringify({ aboutMila, ...output }) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 100 }, outputTokens: { total: 20 } },
      warnings: [],
    });
  });

  const invalid = await requestHelp({ ...payload, profile: { birthDate: "2026-11-19" } });
  assert.equal(invalid.status, 400);
  assert.equal(provider.mock.callCount(), 0);

  const introduction = await requestHelp({ question: "Do czego właściwie śłużysz?" });
  const description = await introduction.json();
  assert.match(description.text, /^Jestem Mila\./);
  assert.equal(description.sourceIds, undefined);
  assert.equal(provider.mock.callCount(), 0);

  const reply = await requestHelp(payload);
  assert.equal(reply.status, 200);
  const { speechToken, ...answer } = await reply.json();
  assert.deepEqual(answer, output);
  assert.match(speechToken, /^[A-Za-z0-9+/]{43}=$/);
  const [url, init] = provider.mock.calls[0].arguments;
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

  const speechPayload = { text: output.text, token: speechToken };
  assert.equal((await requestSpeech({ text: output.text })).status, 400);
  assert.equal((await requestSpeech({ ...speechPayload, text: "Inny tekst." })).status, 403);
  assert.equal(provider.mock.callCount(), 1);

  const speech = await requestSpeech(speechPayload);
  assert.equal(speech.status, 200);
  assert.equal(speech.headers.get("content-type"), "audio/mpeg");
  assert.equal(speech.headers.get("cache-control"), "no-store");
  assert.deepEqual(new Uint8Array(await speech.arrayBuffer()), audio);
  const [speechUrl, speechInit] = provider.mock.calls[1].arguments;
  assert.equal(
    speechUrl,
    "https://api.elevenlabs.io/v1/text-to-speech/QWxjfoFYJP0TtqPaCcTu?output_format=mp3_44100_128",
  );
  assert.equal(new Headers(speechInit?.headers).get("xi-api-key"), "mila-speech-test-key");
  assert.equal(
    speechInit?.body,
    JSON.stringify({ text: output.text, model_id: "eleven_multilingual_v2" }),
  );

  t.mock.method(console, "warn", () => {});
  speechAvailable = false;
  const failedSpeech = await requestSpeech(speechPayload);
  assert.equal(failedSpeech.status, 502);
  assert.equal(await failedSpeech.text(), "");

  delete process.env.ELEVENLABS_API_KEY;
  assert.equal((await requestSpeech(speechPayload)).status, 503);
  assert.deepEqual(await (await requestHelp(payload)).json(), { ...output, speechToken: null });

  aboutMila = true;
  const paraphrase = await requestHelp({ question: "Jaki jest właściwie cel tego czatu?" });
  assert.deepEqual(await paraphrase.json(), description);

  aboutMila = false;
  output.sourceIds = ["toString"];
  const rejected = await requestHelp(payload);
  assert.equal(rejected.status, 503);
  assert.equal((await rejected.json()).sourceIds, undefined);
});
