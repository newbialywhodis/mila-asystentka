import { formatDate, getPeriod, guideQuestions } from "./flow";
import type { Answers, QuestionId } from "./flow";

export function getFullQuestionText(id: QuestionId, text: string): string {
  const { hint } = guideQuestions[id];
  return hint ? `${text}\n\n${hint}` : text;
}

export function getQuestionText(
  id: QuestionId,
  answers: Answers,
  { editing = false, celebrate = false } = {},
): string {
  const { label } = guideQuestions[id];
  const question =
    id === "pregnancyTiming" ? "W którym jesteś trymestrze lub kiedy masz termin porodu?" : label;
  if (editing) return `Jasne, możemy to poprawić. ${question}`;

  const greeting = celebrate ? "Gratulacje! 💛 " : "";
  switch (id) {
    case "stage":
      return "Cześć, jestem Mila! Pomogę Ci ogarnąć formalności i sprawdzić, o jakie świadczenia możesz się ubiegać. Na jakim jesteś etapie?";
    case "planInterests":
      return "Jasne, przygotujmy się krok po kroku. Co chcesz uwzględnić w swoim planie?";
    case "pregnancyTiming":
      return `${greeting}${question}`;
    case "birthDate":
      return `${greeting}Od daty urodzenia policzę terminy. ${question}`;
    case "employment": {
      if (typeof answers.birthDate === "string") {
        return `Mam datę urodzenia: ${formatDate(answers.birthDate)}. A jak teraz pracujesz? Od tego zależy, które informacje o urlopach i świadczeniach Ci się przydadzą.`;
      }
      const timing = answers.pregnancyTiming;
      if (typeof timing === "string") {
        const detail = getPeriod(timing) ? "trymestr" : "termin porodu";
        return `Uwzględnię ${detail} w planie. A jak teraz pracujesz? Od tego zależy, które informacje o urlopach i świadczeniach Ci się przydadzą.`;
      }
      return "Dopytam jeszcze o pracę, żeby dobrać informacje o urlopach i świadczeniach. Jaka jest Twoja sytuacja zawodowa?";
    }
    case "sicknessLeave":
      return "Przy etacie warto sprawdzić zasady zwolnienia w ciąży. Czy jesteś teraz na zwolnieniu lekarskim?";
    case "sicknessInsurance": {
      const intro =
        answers.sicknessLeave === true
          ? "Skoro jesteś na zwolnieniu, dopytam o składki."
          : answers.employment === "contract"
            ? "Przy umowie zleceniu znaczenie ma ubezpieczenie chorobowe."
            : "Przy własnej działalności znaczenie ma ubezpieczenie chorobowe.";
      return `${intro} ${label}`;
    }
    case "standardResidence":
      return `Sprawdźmy jeszcze, według jakich zasad ułożyć plan. ${label}`;
    case "medicalCareWeek10":
      return "Jeszcze jedno pytanie, tym razem o becikowe. Czy jesteś pod opieką medyczną od 10. tygodnia ciąży lub wcześniej?";
    case "birthRegistered":
      return "Przejdźmy do formalności po narodzinach. Czy urodzenie zostało już zgłoszone w urzędzie stanu cywilnego?";
    case "birthCardDate":
      return "Żeby ustalić termin zgłoszenia urodzenia, potrzebuję daty z karty urodzenia. Kiedy ją sporządzono?";
    case "healthRegistered":
      return answers.birthRegistered === true
        ? `Skoro zgłoszenie urodzenia masz już za sobą, sprawdźmy ubezpieczenie. ${label}`
        : `Dopytam jeszcze o opiekę zdrowotną. ${label}`;
  }
}
