import type { PlanInterest } from "./flow";
import type { PlanSection } from "./PlanNavigation";

// Conversation preferences, never eligibility answers. Only the planning path
// has an interests question; suggestions there still require confirmation.
export const startTopics = [
  { id: "benefits", label: "Świadczenia", interest: "benefits" },
  { id: "leave", label: "Urlopy", interest: "leave" },
  { id: "registration", label: "Formalności", interest: "registration" },
  { id: "health", label: "Ubezpieczenie", interest: "support" },
  { id: "deadlines", label: "Terminy", interest: undefined },
] as const satisfies readonly { id: string; label: string; interest: PlanInterest | undefined }[];

export type StartTopic = (typeof startTopics)[number]["id"];

export function parseStartTopics(value: string | string[] | undefined): StartTopic[] {
  // Repeated parameters are ambiguous. Ignore them, oversized input and unknown
  // IDs rather than rendering untrusted text in the conversation.
  if (typeof value !== "string" || value.length > 120) return [];
  const requested = new Set(value.split(","));
  return startTopics.filter(({ id }) => requested.has(id)).map(({ id }) => id);
}

export function suggestedPlanInterests(topics: readonly StartTopic[]): PlanInterest[] {
  return startTopics.flatMap(({ id, interest }) =>
    topics.includes(id) && interest ? [interest] : [],
  );
}

export function topicChatHref(topics: readonly StartTopic[]) {
  const validated = parseStartTopics(topics.join(","));
  return validated.length ? `/chat?topics=${validated.join(",")}` : "/chat";
}

export function preferredPlanSection(topics: readonly StartTopic[]): PlanSection {
  if (topics.includes("deadlines")) return "timeline";
  if (topics.includes("benefits") || topics.includes("leave")) return "benefits";
  if (topics.includes("registration") || topics.includes("health")) return "tasks";
  return "timeline";
}
