import { createHash, randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { guideQuestions } from "../src/features/guide/flow";
import type { Answers, QuestionId } from "../src/features/guide/flow";
import { getStaticHelpTexts } from "../src/features/guide/helpAnswers";
import { format, modelId, requestMilaSpeech, voiceId } from "../src/features/guide/milaVoice";
import { planNotices } from "../src/features/guide/planNotice";
import { getFullQuestionText, getQuestionText } from "../src/features/guide/questionText";

const audioDir = join("public", "audio", "mila");
const manifestPath = join("src", "features", "guide", "audioManifest.json");

// There is no birth date in the generation inputs. The variant with a user's date
// never enters this catalog.
function getStaticQuestionTexts() {
  const extraAnswers: Partial<Record<QuestionId, Answers[]>> = {
    employment: [{ pregnancyTiming: "early" }, { pregnancyTiming: "2026-12-31" }],
    sicknessInsurance: [{ sicknessLeave: true }, { employment: "contract" }],
    healthRegistered: [{ birthRegistered: true }],
  };
  return (Object.keys(guideQuestions) as QuestionId[]).flatMap((id) => {
    const texts = [
      getQuestionText(id, {}),
      getQuestionText(id, {}, { editing: true }),
      ...(extraAnswers[id] ?? []).map((answers) => getQuestionText(id, answers)),
    ];
    if (id === "pregnancyTiming" || id === "birthDate") {
      texts.push(getQuestionText(id, {}, { celebrate: true }));
    }
    return texts.map((text) => getFullQuestionText(id, text));
  });
}

async function writeAtomically(path: string, data: string | Uint8Array) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function main() {
  const [option, ...extraArgs] = process.argv.slice(2);
  if ((option !== undefined && option !== "--dry-run") || extraArgs.length) {
    throw new Error("Użycie: bun run audio:generate [--dry-run]");
  }

  const texts = new Set([
    ...getStaticQuestionTexts(),
    ...Object.values(planNotices),
    ...getStaticHelpTexts(),
  ]);
  const manifest: Record<string, string> = {};
  const pending = new Map<string, { text: string; model_id: string }>();
  for (const displayText of texts) {
    const text = displayText.replaceAll("💛 ", "");
    const payload = { text, model_id: modelId };
    const hash = createHash("sha256")
      .update(JSON.stringify({ voiceId, format, payload }))
      .digest("hex");
    const file = `${hash}.mp3`;
    manifest[displayText] = file;
    const existing = statSync(join(audioDir, file), { throwIfNoEntry: false });
    if (!existing?.isFile() || existing.size === 0) pending.set(file, payload);
  }
  const characters = [...pending.values()].reduce((total, { text }) => total + text.length, 0);
  console.log(
    `Katalog Mili: ${texts.size} tekstów. Do wygenerowania: ${pending.size} nagrań (${characters} znaków).`,
  );
  if (option === "--dry-run") return;

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? "";
  if (pending.size && !apiKey) {
    throw new Error("Wpisz ELEVENLABS_API_KEY w pliku .env.local i uruchom skrypt ponownie.");
  }

  await mkdir(audioDir, { recursive: true });
  let generated = 0;
  for (const [file, payload] of pending) {
    const response = await requestMilaSpeech(payload.text, apiKey, AbortSignal.timeout(60_000));
    if (!response.ok) {
      const body: { detail?: { status?: unknown; message?: unknown } } | null = await response
        .json()
        .catch(() => null);
      const status = body?.detail?.status;
      const reason =
        typeof status === "string" && /^[a-z0-9_]+$/.test(status) ? ` (${status})` : "";
      const detail = body?.detail?.message;
      const message =
        typeof detail === "string" ? detail.replaceAll(apiKey, "[ukryty klucz]").slice(0, 300) : "";
      throw new Error(
        `ElevenLabs HTTP ${response.status}${reason} przy nagraniu ${generated + 1}/${pending.size}. ${message}`.trim(),
      );
    }
    const audio = new Uint8Array(await response.arrayBuffer());
    if (!audio.length || !response.headers.get("content-type")?.startsWith("audio/")) {
      throw new Error(
        `ElevenLabs nie zwrócił audio przy nagraniu ${generated + 1}/${pending.size}.`,
      );
    }
    await writeAtomically(join(audioDir, file), audio);
    console.log(`Zapisano nagranie ${++generated}/${pending.size}.`);
  }

  const json = JSON.stringify(manifest, null, 2) + "\n";
  if (readFileSync(manifestPath, "utf8") !== json) await writeAtomically(manifestPath, json);
  console.log("Nagrania są gotowe do odtwarzania.");
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
