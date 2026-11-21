import type { Metadata } from "next";
import { MilaGuide } from "../../features/guide/MilaGuide";

export const metadata: Metadata = {
  title: "Rozmowa z Milą — Twój plan",
  description: "Odpowiedz na krótkie pytania i ułóż plan świadczeń, terminów i formalności.",
};

export default function ChatPage() {
  return <MilaGuide />;
}
