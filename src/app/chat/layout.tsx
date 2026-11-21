import type { ReactNode } from "react";
import { ChatLoginDraft } from "../../features/guide/ChatLoginDraft";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <ChatLoginDraft>{children}</ChatLoginDraft>;
}
