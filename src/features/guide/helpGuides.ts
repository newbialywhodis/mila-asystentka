export const helpGuides = {
  swrEzus: {
    title: "Wniosek SW‑R w eZUS",
    question: "Jak złożyć wniosek SW-R w eZUS?",
    overviewQuestion: "Gdzie złożyć wniosek o 800+?",
    overview:
      "Wniosek o 800+ składasz elektronicznie, np. w eZUS lub w aplikacji mZUS. Po narodzinach złóż go w ciągu trzech miesięcy, aby ZUS mógł ustalić prawo do świadczenia od dnia urodzenia.",
    offer: "Chcesz, żebym pokazała Ci, jak złożyć wniosek SW‑R w eZUS?",
    text: "Jako rodzic możesz złożyć wniosek SW‑R w kreatorze eZUS.",
    topicSourceId: "child800",
    source: {
      id: "child800Ezus",
      authority: "ZUS",
      title: "Tworzenie wniosku Rodzina 800+ w eZUS",
      url: "https://www.zus.pl/portal/pomoc/kub0024.html",
      type: "guidance",
      verifiedAt: "2026-11-22",
    },
    steps: [
      "Zaloguj się do eZUS. W menu Rodzina 800+ wybierz „Utwórz nowy wniosek”.",
      "Wybierz wniosek SW‑R i wskaż okres świadczeniowy.",
      "Sprawdź swoje dane, wpisz numer rachunku bankowego i dodaj dane dziecka.",
      "Uzupełnij oświadczenia i sprawdź podsumowanie. Wybierz „Podpisz i wyślij”.",
    ],
  },
} as const;

export type HelpGuideId = keyof typeof helpGuides;
