import { z } from "zod";
import { maxHelpAnswerLength } from "../../../features/guide/helpAnswers";
import { requestMilaSpeech, verifySpeechToken } from "../../../features/guide/milaVoice";

export const maxDuration = 20;

const speechRequest = z.strictObject({
  text: z.string().min(1).max(maxHelpAnswerLength),
  token: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
});

export async function POST(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  ) {
    return new Response(null, { status: 415 });
  }

  const payload = speechRequest.safeParse(await request.json().catch(() => null));
  if (!payload.success) return new Response(null, { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return new Response(null, { status: 503 });

  const { text, token } = payload.data;
  // Only synthesize text issued by the help endpoint.
  if (!(await verifySpeechToken(text, token, apiKey))) return new Response(null, { status: 403 });

  try {
    const response = await requestMilaSpeech(
      text,
      apiKey,
      AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    );
    const contentType = response.headers.get("content-type");
    if (response.ok && response.body && contentType?.startsWith("audio/")) {
      return new Response(response.body, {
        headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
      });
    }
    await response.body?.cancel();
    console.warn("[guide-speech] ElevenLabs HTTP", response.status);
  } catch (error) {
    if (!request.signal.aborted) {
      console.warn(
        "[guide-speech] ElevenLabs",
        error instanceof Error ? error.name : "UnknownError",
      );
    }
  }
  return new Response(null, { status: 502 });
}
