import type { QuestionId } from "./flow";
import { helpGuides } from "./helpGuides";
import type { HelpGuideId } from "./helpGuides";
import { normalizeGuideText } from "./textInput";

export const maxHelpQuestionLength = 2_000;
export const maxHelpAnswerLength = 1_200;
export const maxHelpSources = 4;

export type HelpAnswer = {
  text: string;
  sourceIds?: readonly string[];
  speechToken?: string | null;
  guide?: HelpGuideId;
  offeredGuide?: HelpGuideId;
};

export function getHelpGuideAnswer(guide: HelpGuideId): HelpAnswer {
  const { text, topicSourceId } = helpGuides[guide];
  return { text, sourceIds: [topicSourceId], guide };
}

export function getHelpGuideOffer(offeredGuide: HelpGuideId): HelpAnswer {
  const { overview, topicSourceId } = helpGuides[offeredGuide];
  return { text: overview, sourceIds: [topicSourceId], offeredGuide };
}

export function getHelpAnswerText(answer: HelpAnswer): string {
  if (answer.guide) {
    const { title, steps } = helpGuides[answer.guide];
    return [answer.text, title, ...steps.map((step, index) => `${index + 1}. ${step}`)].join("\n");
  }
  return answer.offeredGuide
    ? `${answer.text}\n\n${helpGuides[answer.offeredGuide].offer}`
    : answer.text;
}

export function findHelpFollowUp(answer: HelpAnswer, message: string): HelpAnswer | undefined {
  const normalized = normalizeHelpQuestion(message.replaceAll(",", " "));
  if (
    answer.offeredGuide &&
    /^(?:tak(?: (?:prosze|poprosze|pokaz mi|chetnie))?|poprosze|jasne|chetnie|prosze|pokaz mi)$/.test(
      normalized,
    )
  ) {
    return getHelpGuideAnswer(answer.offeredGuide);
  }
}

const trimesterDefinition = {
  label: "Co to trymestr?",
  text: "Trymestr to jeden z trzech etapów ciąży. Każdy trwa około trzech miesięcy.",
};

const trimesterHelp = {
  label: "Nie znam swojego trymestru",
  text: "Jeśli znasz tydzień ciąży, możesz porównać go z zakresami na kartach. Możesz też podać przewidywany termin porodu albo pominąć pytanie i przejść dalej.",
};

export const helpTopics = [
  {
    label: helpGuides.swrEzus.overviewQuestion,
    ...getHelpGuideOffer("swrEzus"),
  },
  {
    label: "Jak zgłosić dziecko do ubezpieczenia?",
    text: "Po nadaniu PESEL osoba ubezpieczona może zgłosić dziecko jako członka rodziny. Pracownik przekazuje dane płatnikowi składek. Jeśli sama opłacasz składki, zgłoszenie ZUS ZCNA składasz w ZUS.",
    sourceIds: ["health"],
  },
  {
    label: "Czym jest becikowe?",
    text: "Becikowe to jednorazowa zapomoga po narodzinach. Obowiązuje kryterium dochodowe, a jednym z warunków jest co do zasady opieka medyczna od najpóźniej 10. tygodnia ciąży do porodu.",
    sourceIds: ["becikowe"],
  },
  {
    label: "Jak zgłosić urodzenie?",
    text: "Urodzenie możesz zgłosić online na gov.pl albo w USC właściwym dla miejsca urodzenia. Masz na to 21 dni od sporządzenia karty urodzenia.",
    sourceIds: ["birth"],
  },
  {
    label: "Jak działa urlop macierzyński?",
    text: "Urlop macierzyński przysługuje pracownicy. Jego wymiar zależy od liczby dzieci urodzonych przy jednym porodzie. Po szczegóły dotyczące wymiaru i podziału urlopu zajrzyj do poradnika na gov.pl.",
    sourceIds: ["maternity"],
  },
  {
    label: "Co daje ubezpieczenie chorobowe?",
    text: "Ubezpieczenie chorobowe ma znaczenie przy ustalaniu prawa do zasiłku chorobowego. Zgłoszenie do ubezpieczenia możesz sprawdzić w eZUS lub u płatnika składek.",
    sourceIds: ["sickness"],
  },
  trimesterHelp,
  trimesterDefinition,
] as const;

const explanations: Partial<Record<QuestionId, HelpAnswer>> = {
  stage: {
    text: "Dzięki temu wybiorę pytania o przygotowania przed ciążą, sprawy w ciąży albo formalności po narodzinach.",
  },
  planInterests: {
    text: "Wybrane tematy pomogą mi przygotować listę spraw, które chcesz sprawdzić przed ciążą. Możesz też pominąć pytanie, żeby zobaczyć wszystkie tematy.",
  },
  pregnancyTiming: {
    text: "Trymestr pomaga mi dopasować przygotowania. Jeśli podasz termin porodu, umieszczę tę datę w harmonogramie. Terminy liczone od narodzin zależą od faktycznej daty urodzenia.",
  },
  birthDate: {
    text: "Data urodzenia pomaga ustalić terminy. Na przykład złożenie wniosku o 800+ w ciągu trzech miesięcy pozwala ZUS ustalić prawo do świadczenia od dnia narodzin.",
    sourceIds: ["child800"],
  },
  employment: {
    text: "Forma zatrudnienia pomaga mi dopasować informacje o urlopach i zasiłkach. Na przykład urlop macierzyński to uprawnienie pracownicze, a o prawie do zasiłku decydują odrębne warunki.",
    sourceIds: ["maternity"],
  },
  sicknessLeave: {
    text: "Jeśli korzystasz ze zwolnienia w ciąży, mogę uwzględnić w planie zasady zasiłku chorobowego i zapytać Cię o ubezpieczenie.",
    sourceIds: ["sickness"],
  },
  sicknessInsurance: helpTopics[5],
  medicalCareWeek10: helpTopics[2],
  standardResidence: {
    text: "Jeśli sprawa dotyczy także innego kraju, zasady mogą zależeć od przepisów o koordynacji. Na tej podstawie mogę wskazać w planie, co warto potwierdzić w urzędzie.",
  },
  birthRegistered: helpTopics[3],
  birthCardDate: {
    text: "Termin na zgłoszenie urodzenia w USC liczy się od sporządzenia karty urodzenia. Wpisanie tej daty pozwoli mi go wyliczyć.",
    sourceIds: ["birth"],
  },
  healthRegistered: helpTopics[1],
};

export const explanationPrompt = "Dlaczego o to pytasz?";

export const aboutMilaAnswer: HelpAnswer = {
  text: "Jestem Mila. Pomagam Ci ogarnąć formalności przed porodem i po nim. Mogę odpowiedzieć na pytania o świadczenia, urlopy i wnioski. Jeśli przejdziesz przez moje pytania, ułożę też plan z terminami i dokumentami.",
};

function normalizeHelpQuestion(text: string) {
  return normalizeGuideText(text)
    .replaceAll("‑", "-")
    .replace(/[?!.]+$/, "")
    .trimEnd();
}

const explanationQuestions = new Set([
  normalizeHelpQuestion(explanationPrompt),
  "dlaczego",
  "dlaczego pytasz",
  "czemu",
  "czemu o to pytasz",
  "po co",
  "po co o to pytasz",
  "co to znaczy",
  "jakie to ma znaczenie",
  "jakie ma to znaczenie",
]);
const answersByQuestion = new Map<string, HelpAnswer>(
  helpTopics.map((answer) => [normalizeHelpQuestion(answer.label), answer]),
);
for (const id of Object.keys(helpGuides) as HelpGuideId[]) {
  answersByQuestion.set(normalizeHelpQuestion(helpGuides[id].question), getHelpGuideAnswer(id));
}
for (const alias of [
  "trymestr",
  "co to jest trymestr",
  "co to znaczy trymestr",
  "co oznacza trymestr",
  "czym jest trymestr",
]) {
  answersByQuestion.set(alias, trimesterDefinition);
}

export function findHelpAnswer(question: string, context?: QuestionId): HelpAnswer | undefined {
  const normalized = normalizeHelpQuestion(question);
  if (
    /^(?:do czego (?:wlasciwie )?sluzysz|co (?:potrafisz|robisz)|jak (?:dzialasz|mozesz mi pomoc)|kim jestes)$/.test(
      normalized,
    )
  ) {
    return aboutMilaAnswer;
  }
  return context && explanationQuestions.has(normalized)
    ? explanations[context]
    : answersByQuestion.get(normalized);
}

export const missingHelpAnswer: HelpAnswer = {
  text: "Spróbuj doprecyzować pytanie. Mogę pomóc m.in. w sprawach 800+, becikowego, urlopu macierzyńskiego, zgłoszenia urodzenia i ubezpieczenia dziecka.",
};

export const unavailableHelpAnswer: HelpAnswer = {
  text: "Nie mogę teraz sprawdzić odpowiedzi. Możesz spróbować ponownie lub wrócić do planu.",
};

export function getStaticHelpTexts(): string[] {
  return [
    ...helpTopics,
    ...Object.values(explanations),
    aboutMilaAnswer,
    missingHelpAnswer,
    unavailableHelpAnswer,
  ].map(({ text }) => text);
}
