"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

const ChatLoginDraftContext = createContext<{
  draft: string;
  setDraft: (draft: string) => void;
} | null>(null);

export function ChatLoginDraft({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState("");
  return <ChatLoginDraftContext value={{ draft, setDraft }}>{children}</ChatLoginDraftContext>;
}

export function useChatLoginDraft() {
  const login = useContext(ChatLoginDraftContext);
  if (!login) throw new Error("The chat login draft requires ChatLoginDraft.");
  return login;
}
