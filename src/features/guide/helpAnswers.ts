import type { QuestionId } from "./flow";
import { normalizeGuideText } from "./textInput";

export const maxHelpQuestionLength = 10_000;

export type HelpAnswer = {
  text: string;
  source?: string;
};

const trimesterHelp = {
  label: "Nie znam swojego trymestru",
  terms: [
    "swojego trymestru",
    "ktory trymestr",
    "ktory to trymestr",
    "w ktorym jestem trymestrze",
    "w ktorym trymestrze",
    "obliczyc trymestr",
    "wyliczyc trymestr",
    "sprawdzic trymestr",
  ],
  text: "Jeśli znasz tydzień ciąży, możesz porównać go z zakresami na kartach. Możesz też podać przewidywany termin porodu albo pominąć pytanie i przejść dalej.",
};

export const helpTopics = [
  {
    label: "Gdzie złożyć wniosek o 800+?",
    terms: ["800", "wychowawcz"],
    text: "Wniosek o 800+ składasz elektronicznie, np. w eZUS lub w aplikacji mZUS. Po narodzinach złóż go w ciągu trzech miesięcy, aby ZUS mógł ustalić prawo do świadczenia od dnia urodzenia.",
    source: "child800",
  },
  {
    label: "Jak zgłosić dziecko do ubezpieczenia?",
    terms: [
      "ubezpieczenie zdrowotne",
      "ubezpieczyc dziecko",
      "nfz",
      "zcna",
      "ubezpieczenia dziecka",
      "dziecko do ubezpieczenia",
    ],
    text: "Po nadaniu PESEL osoba ubezpieczona może zgłosić dziecko jako członka rodziny. Pracownik przekazuje dane płatnikowi składek. Jeśli sama opłacasz składki, zgłoszenie ZUS ZCNA składasz w ZUS.",
    source: "health",
  },
  {
    label: "Czym jest becikowe?",
    terms: ["becik", "zapomog"],
    text: "Becikowe to jednorazowa zapomoga po narodzinach. Obowiązuje kryterium dochodowe, a jednym z warunków jest co do zasady opieka medyczna od najpóźniej 10. tygodnia ciąży do porodu.",
    source: "becikowe",
  },
  {
    label: "Jak zgłosić urodzenie?",
    terms: ["usc", "pesel", "akt urodzenia", "zglosic urodzenie", "karta urodzenia"],
    text: "Urodzenie możesz zgłosić online na gov.pl albo w USC właściwym dla miejsca urodzenia. Masz na to 21 dni od sporządzenia karty urodzenia.",
    source: "birth",
  },
  {
    label: "Jak działa urlop macierzyński?",
    terms: ["urlop macierzynski", "urlopu macierzynskiego"],
    text: "Urlop macierzyński przysługuje pracownicy. Jego wymiar zależy od liczby dzieci urodzonych przy jednym porodzie. Po szczegóły dotyczące wymiaru i podziału urlopu zajrzyj do poradnika na gov.pl.",
    source: "maternity",
  },
  {
    label: "Co daje ubezpieczenie chorobowe?",
    terms: ["chorobow", "zwolnienie lekarskie", "l4"],
    text: "Ubezpieczenie chorobowe ma znaczenie przy ustalaniu prawa do zasiłku chorobowego. Zgłoszenie do ubezpieczenia możesz sprawdzić w eZUS lub u płatnika składek.",
    source: "sickness",
  },
  trimesterHelp,
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
    source: "child800",
  },
  employment: {
    text: "Forma zatrudnienia pomaga mi dopasować informacje o urlopach i zasiłkach. Na przykład urlop macierzyński to uprawnienie pracownicze, a o prawie do zasiłku decydują odrębne warunki.",
    source: "maternity",
  },
  sicknessLeave: {
    text: "Jeśli korzystasz ze zwolnienia w ciąży, mogę uwzględnić w planie zasady zasiłku chorobowego i zapytać Cię o ubezpieczenie.",
    source: "sickness",
  },
  sicknessInsurance: helpTopics[5],
  medicalCareWeek10: helpTopics[2],
  standardResidence: {
    text: "Jeśli sprawa dotyczy także innego kraju, zasady mogą zależeć od przepisów o koordynacji. Na tej podstawie mogę wskazać w planie, co warto potwierdzić w urzędzie.",
  },
  birthRegistered: helpTopics[3],
  birthCardDate: {
    text: "Termin na zgłoszenie urodzenia w USC liczy się od sporządzenia karty urodzenia. Wpisanie tej daty pozwoli mi go wyliczyć.",
    source: "birth",
  },
  healthRegistered: helpTopics[1],
};

export const explanationPrompt = "Dlaczego o to pytasz?";

export function findHelpAnswer(question: string, context?: QuestionId): HelpAnswer | undefined {
  const search = normalizeGuideText(question);
  if (
    context &&
    (/^(dlaczego|czemu|po co|co to znaczy)\??$/.test(search) ||
      /^(dlaczego|czemu|po co).*(pytasz|potrzebujesz|mam poda|zatrudnien)/.test(search) ||
      /^jakie (to ma |ma to )?znaczenie\??$/.test(search))
  ) {
    return explanations[context];
  }
  return helpTopics.find(({ terms }) => terms.some((term) => search.includes(term)));
}

export const missingHelpAnswer: HelpAnswer = {
  text: "Spróbuj doprecyzować pytanie. Mogę pomóc m.in. w sprawach 800+, becikowego, urlopu macierzyńskiego, zgłoszenia urodzenia i ubezpieczenia dziecka.",
};
