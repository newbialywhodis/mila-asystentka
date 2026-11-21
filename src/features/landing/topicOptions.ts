import { startTopics } from "../guide/startTopics";
import type { StartTopic } from "../guide/startTopics";

const details: Record<StartTopic, { description: string; illustration: string }> = {
  benefits: { description: "Możliwości i warunki wsparcia", illustration: "benefits" },
  leave: { description: "Czas na opiekę nad dzieckiem", illustration: "leave" },
  registration: { description: "Dokumenty i pierwsze sprawy", illustration: "registration" },
  health: { description: "Zgłoszenie dziecka do ochrony zdrowia", illustration: "health" },
  deadlines: { description: "Ważne daty i kolejne kroki", illustration: "deadlines" },
};

export const landingTopics = startTopics.map(({ id, label }) => ({ id, label, ...details[id] }));

export function topicSelectionMessage(count: number) {
  if (!count) return "Możesz wybrać kilka tematów lub po prostu zacząć rozmowę.";
  if (count === 1) return "Zaznaczono jeden obszar do sprawdzenia.";
  if (count === landingTopics.length)
    return "Zaznaczono wszystkie dostępne obszary do sprawdzenia.";
  return `Zaznaczone obszary do sprawdzenia: ${count}.`;
}
