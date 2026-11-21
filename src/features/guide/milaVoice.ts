export const voiceId = "QWxjfoFYJP0TtqPaCcTu";
export const modelId = "eleven_multilingual_v2";
export const format = "mp3_44100_128";

export function requestMilaSpeech(text: string, apiKey: string, signal: AbortSignal) {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: modelId }),
    signal,
  });
}

const encoder = new TextEncoder();

function importSpeechKey(apiKey: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function speechTokenPayload(text: string) {
  return encoder.encode(`mila-guide-speech:${text}`);
}

export async function createSpeechToken(text: string, apiKey: string) {
  const key = await importSpeechKey(apiKey);
  const signature = await crypto.subtle.sign("HMAC", key, speechTokenPayload(text));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifySpeechToken(text: string, token: string, apiKey: string) {
  const key = await importSpeechKey(apiKey);
  const signature = Uint8Array.from(atob(token), (character) => character.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, signature, speechTokenPayload(text));
}
