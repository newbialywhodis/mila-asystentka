import { mkdir, writeFile } from "node:fs/promises";
import { POST } from "../src/app/api/parent-intent/route";
import { buildAssistantRequest } from "../src/features/parent/case-assistant-context";
import { newSession } from "../src/features/parent/case-session";
import { showInterview, answerInterview } from "../src/features/parent/workspace-session";
import { personIdSchema } from "../src/features/parent/family-session";
import { assistantActionSchema } from "../src/features/parent/parent-intent";

if (!process.env.AI_GATEWAY_API_KEY?.trim())
  throw new Error("Brak konfiguracji AI Gateway; test dostawcy nie został wykonany.");
let session = showInterview(newSession("fictional-provider-test"));
const question = session.data.interview.active;
if (!question) throw new Error("Brak pytania");
session = answerInterview(
  session,
  question,
  {
    speaker: "self",
    subject: {
      kind: "person",
      personId: personIdSchema.parse("fictional-person"),
      role: "birthing",
    },
  },
  "Osoba rodząca",
);
const samples = [
  "Jestem w ciąży i pracuję na zleceniu",
  "Chyba nie opłacam chorobowego",
  "To mój mąż prowadzi działalność, nie ja",
  "Dziecko urodziło się 12 lutego",
  "Dlaczego wyszło mi tyle pieniędzy?",
  "Nie rozumiem tego pytania",
  "Wróć do moich świadczeń",
];
function semanticCheck(index: number, action: unknown): boolean {
  const parsed = assistantActionSchema.safeParse(action);
  if (!parsed.success) return false;
  const a = parsed.data;
  if (index === 0)
    return (
      a.kind === "interpret" &&
      a.candidates.some((c) => c.field === "stage" && c.value === "pregnant") &&
      a.candidates.some((c) => c.field === "employment" && c.value === "contract")
    );
  if (index === 1)
    return (
      a.kind === "interpret" &&
      a.candidates.some(
        (c) =>
          c.field === "insured" &&
          c.value === false &&
          c.certainty === "tentative" &&
          c.validTime.kind === "undated",
      )
    );
  if (index === 2)
    return (
      a.kind === "interpret" &&
      (a.intent === "switchSubject" ||
        a.candidates.some(
          (c) =>
            c.field === "employment" &&
            c.value === "business" &&
            (c.person === null || c.person === "related"),
        ))
    );
  if (index === 3)
    return (
      a.kind === "reply" ||
      (a.kind === "interpret" &&
        !a.candidates.some((c) => c.field === "birth" || c.field === "dueDate"))
    );
  return (
    a.kind === "interpret" &&
    a.intent === ["explainResult", "explainQuestion", "showMatches"][index - 4] &&
    !a.candidates.length
  );
}
const results = [];
for (const text of samples) {
  const started = Date.now();
  const response = await POST(
    new Request("http://localhost/api/parent-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAssistantRequest(session, text)),
    }),
  );
  const body: unknown = await response.json();
  const parsed = assistantActionSchema.safeParse(body);
  const record = {
    text,
    status: response.status,
    schemaValid: parsed.success,
    semanticValid: semanticCheck(samples.indexOf(text), body),
    elapsedMs: Date.now() - started,
    action: body,
  };
  results.push(record);
  console.log(JSON.stringify(record));
  if (response.status !== 200) break;
  if (text !== samples.at(-1)) await new Promise((resolve) => setTimeout(resolve, 17_000));
}
await mkdir("test-results/stage4", { recursive: true });
await writeFile("test-results/stage4/provider.json", JSON.stringify(results, null, 2));
if (results.length !== samples.length || results.some((r) => !r.schemaValid || !r.semanticValid))
  process.exitCode = 1;
