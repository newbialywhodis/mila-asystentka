import type { Question } from "../types/catalog";
import type { Field } from "../types/profile";

const yesNo = [
  { label: "Tak", value: true },
  { label: "Nie", value: false },
] as const;
const jobs = [
  { label: "Umowa o pracę", value: "employee" },
  { label: "Umowa zlecenia", value: "contract" },
  { label: "Własna działalność", value: "business" },
  { label: "Inna sytuacja", value: "other" },
] as const;

function boolean(label: string, hint?: string): Question {
  return { label, hint, input: "choice", options: yesNo };
}

function date(label: string, hint?: string): Question {
  return { label, hint, input: "date" };
}

export const questions = {
  stage: {
    label: "Na jakim jesteś etapie?",
    input: "choice",
    options: [
      { label: "Jestem w ciąży", value: "pregnant" },
      { label: "Dziecko już się urodziło", value: "born" },
    ],
  },
  dueDate: date("Kiedy wypada przewidywany termin porodu?", "Data pomaga ułożyć plan przygotowań."),
  birthDate: date("Kiedy urodziło się dziecko?"),
  childrenBorn: {
    label: "Ile dzieci urodziło się przy tym porodzie?",
    input: "number",
    min: 1,
    max: 25,
    integer: true,
  },
  employment: { label: "Jaka jest Twoja sytuacja zawodowa?", input: "choice", options: jobs },
  otherParentEmployment: {
    label: "Jaka jest sytuacja zawodowa ojca dziecka?",
    input: "choice",
    options: jobs,
  },
  sicknessInsurance: boolean(
    "Czy podlegasz teraz ubezpieczeniu chorobowemu?",
    "Możesz sprawdzić zgłoszenie w eZUS lub u płatnika składek.",
  ),
  insuredAtBirth: boolean(
    "Czy miałaś ubezpieczenie chorobowe w dniu porodu?",
    "Możesz sprawdzić zgłoszenie w eZUS lub u płatnika składek.",
  ),
  sicknessLeave: boolean("Czy jesteś na zwolnieniu lekarskim w ciąży?"),
  sicknessQualifyingPeriod: boolean(
    "Czy spełniasz warunek okresu wyczekiwania?",
    "Co do zasady to 30 dni ubezpieczenia obowiązkowego albo 90 dni dobrowolnego. ZUS opisuje wyjątki.",
  ),
  pregnancyCertificate: boolean("Czy masz e-ZLA z kodem B albo osobne zaświadczenie o ciąży?"),
  zusPays: boolean("Czy zasiłek wypłaca ZUS?"),
  livesInPoland: boolean("Czy mieszkasz z dzieckiem w Polsce?"),
  standardResidence: boolean(
    "Czy masz polskie obywatelstwo, a sprawa dotyczy wyłącznie Polski?",
    "Wybierz „Nie”, jeśli sprawa obejmuje np. pracę lub świadczenia w innym państwie.",
  ),
  birthRegistered: boolean("Czy urodzenie zostało zgłoszone do USC?"),
  birthCardDate: date(
    "Kiedy sporządzono kartę urodzenia?",
    "Jeśli nie znasz daty, zapytaj placówkę, która wystawiła kartę.",
  ),
  healthRegistered: boolean(
    "Czy dziecko jest zgłoszone przy aktualnym tytule do ubezpieczenia zdrowotnego?",
  ),
  healthTitle: boolean("Czy osoba ubezpieczona może zgłosić dziecko do ubezpieczenia?"),
  healthRegistrationTrigger: date("Kiedy nadano PESEL albo powstał nowy tytuł do ubezpieczenia?"),
  maternityEnd: date("Kiedy kończy się urlop macierzyński?"),
  parentalStart: date("Kiedy ma się zacząć urlop rodzicielski?"),
  paternityStart: date("Kiedy ma się zacząć urlop ojcowski?"),
  childcareLeaveStart: date("Kiedy ma się zacząć urlop wychowawczy?"),
  employedSixMonths: boolean(
    "Czy masz co najmniej 6 miesięcy stażu pracy?",
    "Uwzględnij wcześniejsze okresy zatrudnienia zgodnie z przepisami.",
  ),
  hospitalized: boolean("Czy dziecko było hospitalizowane po urodzeniu?"),
  gestationalWeeks: {
    label: "Ile pełnych tygodni ciąży upłynęło do porodu?",
    input: "number",
    min: 0,
    max: 45,
    integer: true,
    hint: "Przepisz z dokumentacji. Przy 27 tygodniach i 5 dniach wpisz 27.",
  },
  birthWeightGrams: {
    label: "Jaka była masa urodzeniowa dziecka w gramach?",
    input: "number",
    min: 1,
    integer: true,
  },
  hospitalStays: {
    label: "Jakie okresy pobytu podano w zaświadczeniu szpitala?",
    hint: "Dodaj każdy zakończony pobyt. Wpisz pierwszy i ostatni dzień wskazany w zaświadczeniu.",
    input: "hospital",
  },
  receivesMaternity: boolean(
    "Czy któreś z rodziców otrzymuje zasiłek macierzyński lub odpowiednie uposażenie?",
  ),
  activeComponent: {
    label: "Czy w tym miesiącu przyznano świadczenie Aktywny Rodzic na to dziecko?",
    input: "choice",
    options: [
      { label: "Nie", value: "none" },
      { label: "Aktywni rodzice w pracy", value: "work" },
      { label: "Aktywnie w żłobku", value: "nursery" },
      { label: "Aktywnie w domu", value: "home" },
    ],
  },
  legacyRko: boolean("Czy na to dziecko przyznano wcześniej rodzinny kapitał opiekuńczy (RKO)?"),
  nursery: boolean("Czy dziecko korzysta ze żłobka, klubu dziecięcego lub dziennego opiekuna?"),
  nurseryRegistered: boolean(
    "Czy placówka lub opiekun figuruje w wymaganym rejestrze lub wykazie?",
  ),
  nurseryFee: {
    label: "Ile wynosi miesięczna opłata za pobyt bez wyżywienia, w złotych?",
    input: "number",
    min: 0,
  },
  nurseryStart: date("Kiedy dziecko rozpoczęło opiekę w placówce lub u dziennego opiekuna?"),
  singleParent: boolean(
    "Czy wychowujesz dziecko samodzielnie?",
    "Odpowiedz zgodnie z definicją podaną przez ZUS dla programu Aktywny Rodzic.",
  ),
  workActive: boolean(
    "Czy spełniasz warunek aktywności zawodowej w programie Aktywny Rodzic?",
    "Szczególne zasady dotyczą m.in. zasiłków, służby i KRUS. Sprawdź je w źródłach karty.",
  ),
  otherWorkActive: boolean(
    "Czy druga osoba spełnia warunek aktywności w programie Aktywny Rodzic?",
  ),
  contributionPercent: {
    label:
      "Ile procent minimalnego wynagrodzenia stanowi Twoja podstawa składek emerytalno-rentowych?",
    hint: "Wpisz procent ustalony według zasad programu. Dla niektórych tytułów ZUS stosuje szczególne przeliczenie.",
    input: "number",
    min: 0,
  },
  otherContributionPercent: {
    label: "Ile procent minimalnego wynagrodzenia stanowi podstawa składek drugiej osoby?",
    input: "number",
    min: 0,
  },
  preferentialContributions: boolean(
    "Czy korzystasz z preferencji składkowych uwzględnianych w programie?",
  ),
  otherPreferentialContributions: boolean(
    "Czy druga osoba korzysta z preferencji składkowych uwzględnianych w programie?",
  ),
  familyIncomePerPerson: {
    label: "Jaki jest miesięczny dochód na osobę ustalony do świadczeń rodzinnych, w złotych?",
    hint: "Skorzystaj z definicji dochodu do świadczeń rodzinnych. Jeśli nie znasz tak ustalonej kwoty, zostaw pole puste.",
    input: "number",
    min: 0,
  },
  medicalCareWeek10: boolean(
    "Czy opieka medyczna od co najmniej 10. tygodnia ciąży trwała do porodu?",
  ),
  familyChildDisability: boolean(
    "Czy w rodzinie jest dziecko z orzeczeniem wymaganym do wyższego progu?",
  ),
  careNeeded: boolean("Czy potrzebujesz przerwy w pracy na osobistą opiekę nad dzieckiem?"),
  parentUsesTaxScale: boolean("Czy rozliczasz dochody według skali podatkowej?"),
  activeDisabilityCertificate: boolean(
    "Czy orzeczenie zawiera oba wskazania wymagane w programie Aktywny Rodzic?",
    "Chodzi o stałą lub długotrwałą opiekę albo pomoc oraz stały udział opiekuna w leczeniu, rehabilitacji i edukacji.",
  ),
  zaZyciemCertificate: boolean("Czy dziecko ma zaświadczenie „Za życiem”?"),
} satisfies Record<Field, Question>;
