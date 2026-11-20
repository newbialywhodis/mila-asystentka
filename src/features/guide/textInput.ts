import { addDays, isoDate, normalizeNumericDate, parseDate } from "../../engine/dates";
import { canSkipQuestion, getDateBounds, guideQuestions, isGuideDate } from "./flow";
import type { Answer, QuestionId } from "./flow";

export function normalizeGuideText(text: string) {
  return text
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ł", "l")
    .replace(/\s+/g, " ")
    .trim();
}

const stageReplies = {
  pregnant: ["ciaza", "jestem w ciazy", "spodziewam sie dziecka"],
  planning: ["planuje", "planuje ciaze", "staram sie o dziecko", "planuje dziecko"],
  born: [
    "po porodzie",
    "juz urodzilam",
    "urodzilam",
    "dziecko juz sie urodzilo",
    "mam juz dziecko",
  ],
};

const workReplies = {
  employee: [
    "etat",
    "na etacie",
    "umowa o prace",
    "mam umowe o prace",
    "pracuje na umowie o prace",
    "pracuje na umowe o prace",
    "jestem zatrudniona na etacie",
  ],
  contract: ["zlecenie", "umowa zlecenie", "umowa zlecenia", "mam umowe zlecenia"],
  business: [
    "dzialalnosc",
    "wlasna dzialalnosc",
    "mam firme",
    "prowadze firme",
    "samozatrudnienie",
    "b2b",
  ],
  other: ["inna", "nie pracuje", "jestem bezrobotna", "ucze sie", "studiuje", "umowa o dzielo"],
};

const interestReplies = {
  benefits: ["swiadczenia", "zasilki", "finanse"],
  leave: ["urlopy", "urlopy rodzicielskie"],
  registration: ["formalnosci", "sprawy urzedowe"],
  support: ["wsparcie", "pomoc dla rodzicow"],
};

const months = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "wrzesnia",
  "pazdziernika",
  "listopada",
  "grudnia",
];

type TextAnswer = { value: Answer } | { clarification: string };

export function readTextAnswer(
  id: QuestionId,
  message: string,
  asOf: string,
  birthDate?: string,
): TextAnswer | undefined {
  if (message.includes("?")) return;
  const text = normalizeGuideText(message).replace(/[.!]+$/, "");
  if (
    canSkipQuestion(id) &&
    /^(pomin( pytanie)?|nie wiem|nie znam daty|nie pamietam)$/.test(text)
  ) {
    return { value: null };
  }

  const question = guideQuestions[id];
  if (question.input === "choice") {
    const option = question.options.find(({ label }) => normalizeGuideText(label) === text);
    if (option) return { value: option.value };

    if (id === "stage" || id === "employment") {
      const replies = id === "stage" ? stageReplies : workReplies;
      const match = Object.entries(replies).find(([, aliases]) => aliases.includes(text));
      if (match) return { value: match[0] };
    } else {
      if (/\b(?:chyba|nie wiem|nie mam pojecia|nie jestem pewna|do konca)\b/.test(text)) return;
      const reply = text.match(/^(tak|nie),?\s+(.+)$/);
      if (reply && !/^(?:ale|chyba|czy|czemu|dlaczego|jak|kiedy|gdzie|co|po co)\b/.test(reply[2])) {
        if (reply[1] === "tak" && !/\b(?:nie|chyba|czy)\b/.test(reply[2])) return { value: true };
        if (reply[1] === "nie" && !/\b(?:tak|wiem|chyba|czy)\b/.test(reply[2]))
          return { value: false };
      }
      if (/^(tak jest|juz|mam|jestem)$/.test(text)) return { value: true };
      if (/^(jeszcze nie|nie mam|nie jestem)$/.test(text)) return { value: false };
    }
    return;
  }

  if (question.input === "multi") {
    const topics = text.replace(/^(interesuja mnie|chce uwzglednic|poprosze) /, "");
    if (/^wszystk(ie( tematy)?|o)$/.test(topics)) {
      return { value: question.options.map(({ value }) => value) };
    }
    const matches = topics
      .split(/\s*(?:,|;|\s+i\s+|\s+oraz\s+)\s*/)
      .map(
        (topic) =>
          question.options.find(
            ({ value, label }) =>
              normalizeGuideText(label) === topic || interestReplies[value].includes(topic),
          )?.value,
      );
    if (matches.every((match) => match !== undefined)) return { value: [...new Set(matches)] };
    return;
  }

  if (question.input === "timing") {
    const trimester = text.match(
      /^(?:jestem w |to |w )?(i{1,3}|[1-3]|pierwsz(?:y|ym)|drug(?:i|im)|trzec(?:i|im))\.? trymestr(?:ze)?$/,
    )?.[1];
    if (trimester) {
      if (/^(i|1|pierwsz\w+)$/.test(trimester)) return { value: "early" };
      if (/^(ii|2|drug\w+)$/.test(trimester)) return { value: "middle" };
      return { value: "late" };
    }
    const week = Number(
      text.match(/^(?:jestem w |to |w )?(\d{1,2})\.? (?:tydzien|tygodniu)(?: ciazy)?$/)?.[1],
    );
    if (week >= 1 && week <= 45) {
      return { value: week <= 12 ? "early" : week <= 27 ? "middle" : "late" };
    }
  }

  const date = readDate(text, asOf);
  if (date === undefined) return;
  if (isGuideDate(date, getDateBounds(id, asOf, birthDate))) return { value: date };
  return {
    clarification:
      "Ta data nie pasuje do zakresu pytania. Sprawdź dzień, miesiąc i rok, a potem wpisz ją jeszcze raz lub wybierz z kalendarza.",
  };
}

function readDate(text: string, asOf: string): string | undefined {
  const value = text
    .replace(
      /^(mam termin(?: porodu)? na|termin(?: porodu)? to|urodzilam|dziecko urodzilo sie|karta zostala sporzadzona) /,
      "",
    )
    .replace(/ (?:r|roku)$/, "");
  const today = parseDate(asOf);
  if (today && (value === "wczoraj" || value === "przedwczoraj")) {
    return isoDate(addDays(today, value === "wczoraj" ? -1 : -2));
  }
  if (today && (value === "dzisiaj" || value === "dzis")) return asOf;
  const numeric = normalizeNumericDate(value);
  if (numeric) return numeric;
  const named = value.match(/^(\d{1,2}) ([a-z]+) (\d{4})$/);
  if (named) {
    const month = months.indexOf(named[2]) + 1;
    return `${named[3]}-${String(month).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
  }
}
