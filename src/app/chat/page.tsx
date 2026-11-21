import type { Metadata } from "next";
import { MilaGuide } from "../../features/guide/MilaGuide";
import { parseStartTopics } from "../../features/guide/startTopics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rozmowa z Milą — Twój plan",
  description: "Odpowiedz na krótkie pytania i ułóż plan świadczeń, terminów i formalności.",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { topics } = await searchParams;
  return (
    <MilaGuide
      initialTopics={parseStartTopics(topics)}
      uploadAllowed={
        process.env.MILA_PDF_UPLOAD_ALLOWED === "1" &&
        Boolean(process.env.AI_GATEWAY_API_KEY?.trim())
      }
    />
  );
}
