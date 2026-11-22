import type { QuestionId } from "./flow";
import { normalizeGuideText } from "./textInput";
import { z } from "zod";
import { sources } from "../../data/sources";

export const maxHelpQuestionLength = 2_000;
export const maxHelpAnswerLength = 1_200;
export const maxHelpSources = 4;
export const helpAnswerSchema = z.strictObject({
  text: z.string().min(1).max(maxHelpAnswerLength),
  sourceIds: z
    .array(z.enum(Object.keys(sources)))
    .max(maxHelpSources)
    .optional(),
  speechToken: z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/)
    .nullable()
    .optional(),
});

export type HelpAnswer = {
  text: string;
  sourceIds?: readonly string[];
  speechToken?: string | null;
};

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
    label: "Gdzie złożyć wniosek o 800+?",
    text: "Wniosek o 800+ składasz elektronicznie, np. w eZUS lub w aplikacji mZUS. Po narodzinach złóż go w ciągu trzech miesięcy, aby ZUS mógł ustalić prawo do świadczenia od dnia urodzenia.",
    sourceIds: ["child800"],
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

export const generalHelpTopics = {
  leaveAndAllowance: {
    label: "Czym różni się urlop od zasiłku?",
    text: "Urlop to przerwa w pracy przewidziana dla pracownika. Zasiłek jest świadczeniem pieniężnym. Prawo do urlopu i prawo do wypłaty wymagają osobnego sprawdzenia.",
    sourceIds: ["maternity"],
  },
  sicknessInsurance: {
    label: "Jak działa ubezpieczenie chorobowe?",
    text: helpTopics[5].text,
    sourceIds: ["sickness"],
  },
  benefitBasis: {
    label: "Czym jest podstawa wymiaru zasiłku?",
    text: "Podstawa wymiaru służy do obliczenia zasiłku. Nie musi być równa pensji brutto ani podstawie składek. W Mili korzystaj z podstawy ustalonej przez płatnika lub dostępnego formularza podstawy. Własną kwotę sprawdzisz w lokalnym kalkulatorze.",
    sourceIds: ["maternity"],
  },
  usualDocuments: {
    label: "Jakie dokumenty zwykle są potrzebne?",
    text: "Dokumenty zależą od świadczenia, formy pracy i płatnika. Mogą obejmować wniosek, zaświadczenie płatnika składek oraz dokument potwierdzający zdarzenie. Wybierz konkretną sprawę, aby zobaczyć właściwą listę i oficjalne źródła.",
    sourceIds: ["maternity"],
  },
  applicationDeadline: {
    label: "Jak rozumieć termin składania wniosku?",
    text: "Sprawdź, od jakiego zdarzenia biegnie termin i jaki jest skutek jego przekroczenia. Data urodzenia, data karty urodzenia i początek urlopu to różne zdarzenia. Termin dla wybranej sprawy znajdziesz w jej instrukcji.",
    sourceIds: ["birth", "maternity"],
  },
} as const satisfies Record<string, HelpAnswer & { label: string }>;

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
for (const topic of Object.values(generalHelpTopics))
  answersByQuestion.set(normalizeHelpQuestion(topic.label), topic);
for (const alias of [
  "trymestr",
  "co to jest trymestr",
  "co to znaczy trymestr",
  "co oznacza trymestr",
  "czym jest trymestr",
]) {
  answersByQuestion.set(alias, trimesterDefinition);
}

for (const alias of [
  "co to znaczy ubezpieczenie chorobowe",
  "co to jest ubezpieczenie chorobowe",
  "czym jest ubezpieczenie chorobowe",
  "chorobowe",
])
  answersByQuestion.set(alias, generalHelpTopics.sicknessInsurance);

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
    ...Object.values(generalHelpTopics),
    ...Object.values(explanations),
    aboutMilaAnswer,
    missingHelpAnswer,
    unavailableHelpAnswer,
  ].map(({ text }) => text);
}
