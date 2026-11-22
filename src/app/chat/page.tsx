import type { Metadata } from "next";
import { cookies } from "next/headers";
import { MilaGuide } from "../../features/guide/MilaGuide";
import { demoProfile, demoProfileCookie } from "../../features/guide/demo-profile";
import { parseStartTopics, topicChatHref } from "../../features/guide/startTopics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rozmowa z Milą - Twój plan",
  description: "Odpowiedz na krótkie pytania i ułóż plan świadczeń, terminów i formalności.",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ topics }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const initialTopics = parseStartTopics(topics);
  const demoSignedIn = cookieStore.get(demoProfileCookie)?.value === demoProfile.id;

  async function signOut() {
    "use server";
    const cookieStore = await cookies();
    cookieStore.set(demoProfileCookie, "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/chat",
    });
  }

  return (
    <MilaGuide
      key={demoSignedIn ? "signed-in" : "guest"}
      initialTopics={initialTopics}
      loginHref={demoSignedIn ? undefined : topicChatHref(initialTopics, "/chat/login")}
      signOutAction={demoSignedIn ? signOut : undefined}
    />
  );
}
