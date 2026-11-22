import { parseDate } from "../../engine/dates";
import { casePatchSchema, employmentLabels, formatDay, moneyLabel } from "../../engine/parent-case";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import { normalizeGuideText, normalizePolishDate } from "../guide/textInput";

type Choice = { label: string; value: string | boolean };
type Field = {
  label: string;
  question: string;
  hint?: string;
  help?: string;
  options?: Choice[];
} & ({ type: "money" | "number"; placeholder: string } | { type?: "date" | "text" });
const yesNo = [
  { label: "Tak", value: true },
  { label: "Nie", value: false },
];

export const fields: Record<FactKey, Field> = {
  birthStage: {
    label: "Etap rodzicielstwa",
    question: "Czy dziecko już się urodziło?",
    options: [
      { value: "born", label: "Już się urodziło" },
      { value: "expected", label: "Jeszcze nie" },
      { value: "expectedEarly", label: "Jeszcze nie, chcę zacząć macierzyński przed porodem" },
    ],
  },
  dueDate: {
    label: "Przewidywana data porodu",
    question: "Jaki jest przewidywany termin porodu?",
    hint: "Od tego dnia oszacuję okres zasiłku. Po porodzie możesz wpisać rzeczywistą datę.",
    type: "date",
    help: "Podaj przewidywaną datę porodu z karty ciąży lub od lekarza.",
  },
  certifiedDueDate: {
    label: "Termin porodu z zaświadczenia",
    question:
      "Jaki przewidywany termin porodu widniał na zaświadczeniu przy wcześniejszym rozpoczęciu macierzyńskiego?",
    type: "date",
    help: "Przepisz przewidywaną datę porodu z zaświadczenia użytego przy rozpoczęciu macierzyńskiego.",
  },
  childDeath: {
    label: "Data śmierci dziecka",
    question: "Kiedy zmarło dziecko? Przy martwym urodzeniu podaj dzień porodu.",
    type: "date",
    help: "Podaj datę z dokumentu. Przy martwym urodzeniu wpisz datę porodu.",
  },
  survivingChildren: {
    label: "Dzieci pozostałe przy życiu",
    question: "Ile dzieci z tego porodu pozostało przy życiu?",
    type: "number",
    placeholder: "np. 1",
    help: "Policz dzieci z tego porodu, które żyją. Jeśli żadne nie przeżyło, wpisz 0.",
  },
  maternityEnd: {
    label: "Koniec macierzyńskiego",
    question: "Jaki był ostatni dzień macierzyńskiego wraz z ewentualnym uzupełnieniem?",
    type: "date",
    help: "Podaj ostatni dzień macierzyńskiego. Jeśli korzystasz z dodatkowego urlopu dla rodziców wcześniaków lub noworodków w szpitalu, podaj ostatni dzień tego urlopu.",
  },
  supplementCare: {
    label: "Uzupełniający macierzyński po przyjęciu dziecka",
    question: "Czy sprawdzasz uzupełniający macierzyński po przyjęciu dziecka na wychowanie?",
    options: yesNo,
  },
  careKind: {
    label: "Tryb przyjęcia na wychowanie",
    question: "W jakim trybie dziecko przyjęto na wychowanie?",
    options: [
      { value: "adoption", label: "Przysposobienie" },
      { value: "foster", label: "Rodzina zastępcza niezawodowa" },
      { value: "professional", label: "Rodzina zastępcza zawodowa" },
    ],
  },
  previousCareBenefit: {
    label: "Zasiłek wykorzystany wcześniej po przyjęciu dziecka",
    question: "Czy wcześniej pobierano już ten zasiłek na dziecko przyjęte na wychowanie?",
    options: yesNo,
  },
  previousCareDays: {
    label: "Dni wykorzystane wcześniej w pieczy",
    question:
      "Ile dni zasiłku na warunkach macierzyńskiego już wykorzystano w pieczy na te dzieci?",
    type: "number",
    placeholder: "np. 14",
    help: "Zsumuj dni, za które wypłacono już zasiłek na warunkach macierzyńskiego za opiekę nad tymi dziećmi.",
  },
  adoptionFinal: {
    label: "Prawomocność orzeczenia o przysposobieniu",
    question: "Kiedy uprawomocniło się postanowienie o przysposobieniu dziecka?",
    type: "date",
    help: "Podaj dzień, w którym postanowienie sądu stało się prawomocne. Datę możesz sprawdzić w sądzie.",
  },
  careAccepted: {
    label: "Data przyjęcia na wychowanie",
    question: "Kiedy przyjęto dziecko lub dzieci na wychowanie?",
    type: "date",
    help: "Podaj dzień, od którego dziecko faktycznie jest pod Twoją opieką.",
  },
  sameCareAgeLimit: {
    label: "Wspólna granica wieku",
    question:
      "Czy wszystkie przyjęte dzieci mają tę samą datę urodzenia i ten sam status odroczenia obowiązku szkolnego?",
    options: yesNo,
  },
  careChildren: {
    label: "Daty urodzenia przyjętych dzieci",
    question:
      "Podaj datę urodzenia każdego przyjętego dziecka i zaznacz odroczenie obowiązku szkolnego, jeżeli dotyczy.",
  },
  courtApplication: {
    label: "Data wniosku do sądu o przysposobienie",
    question: "Kiedy wystąpiono do sądu z wnioskiem o przysposobienie?",
    type: "date",
    help: "Podaj dzień złożenia wniosku o adopcję w sądzie. Sprawdź potwierdzenie złożenia.",
  },
  schoolDeferral: {
    label: "Odroczenie obowiązku szkolnego",
    question: "Czy jest dokument potwierdzający odroczenie obowiązku szkolnego?",
    options: yesNo,
  },
  rehabMedical: {
    label: "Orzeczenie medyczne ZUS",
    question:
      "Czy lekarz orzecznik potwierdził dalszą niezdolność do pracy i rokowanie odzyskania zdolności do pracy?",
    options: yesNo,
  },
  rehabExcluded: {
    label: "Wyłączenia świadczenia rehabilitacyjnego",
    question: "Czy dotyczy Cię któreś z wyłączeń świadczenia rehabilitacyjnego?",
    hint: "Sprawdź emeryturę, rentę, zasiłek dla bezrobotnych, świadczenie lub zasiłek przedemerytalny, rodzicielskie świadczenie uzupełniające, świadczenie nauczycielskie i urlop dla poratowania zdrowia. Po ustaniu ubezpieczenia uwzględnij też wyłączenia z art. 13 ust. 1, np. nowy tytuł do chorobowego lub obowiązkowe ubezpieczenie rolnicze.",
    options: yesNo,
  },
  rehabUsed: {
    label: "Wykorzystane dni świadczenia rehabilitacyjnego",
    question: "Ile dni świadczenia rehabilitacyjnego już wykorzystano?",
    type: "number",
    placeholder: "np. 90",
    help: "Zsumuj dni pobierania tego świadczenia. Jeśli dotąd go nie pobierasz, wpisz 0.",
  },
  rehabSickBasis: {
    label: "Podstawa poprzedzającego zasiłku chorobowego (zł)",
    question:
      "Jaka była miesięczna podstawa poprzedzającego zasiłku chorobowego? Podaj kwotę przed waloryzacją świadczenia rehabilitacyjnego.",
    type: "money",
    placeholder: "np. 4 800,50",
    help: "Przepisz miesięczną podstawę poprzedniego zasiłku chorobowego, w złotych. Użyj kwoty sprzed przeliczenia na potrzeby świadczenia rehabilitacyjnego.",
  },
  rehabStart: {
    label: "Pierwszy dzień przyznanego świadczenia",
    question: "Od którego dnia przyznano pierwszą część tego świadczenia rehabilitacyjnego?",
    type: "date",
    help: "Sprawdź w decyzji ZUS dzień, od którego przyznano świadczenie po raz pierwszy.",
  },
  birth: {
    label: "Data urodzenia",
    question: "Kiedy urodziło się dziecko?",
    hint: "Ta data pozwala ustalić okres świadczenia i obowiązujące terminy.",
    type: "date",
    help: "Podaj rzeczywistą datę urodzenia dziecka, np. z aktu urodzenia.",
  },
  from: {
    label: "Pierwszy dzień",
    question: "Od którego dnia ma się zacząć ten okres?",
    type: "date",
    help: "Podaj pierwszy dzień, który mam uwzględnić w obliczeniu.",
  },
  through: {
    label: "Ostatni dzień",
    question: "Jaki jest ostatni dzień tego okresu?",
    type: "date",
    help: "Podaj ostatni dzień, który mam uwzględnić w obliczeniu. Ten dzień też się liczy.",
  },
  requestedDays: {
    label: "Planowana liczba dni",
    question: "Ile dni chcesz uwzględnić w tym okresie?",
    type: "number",
    placeholder: "np. 28",
    help: "Podaj liczbę dni kalendarzowych, razem z weekendami i świętami. Dwa tygodnie to 14 dni.",
  },
  employment: {
    label: "Tytuł ubezpieczenia",
    question: "Dla jakiego tytułu chcesz sprawdzić ubezpieczenie?",
    options: Object.entries(employmentLabels).map(([value, label]) => ({ value, label })),
  },
  insured: {
    label: "Ubezpieczenie chorobowe",
    question: "Czy w tym dniu obejmowało Cię ubezpieczenie chorobowe z tego tytułu?",
    options: yesNo,
  },
  exception: {
    label: "Szczególne okoliczności",
    question:
      "Czy umowa skończyła się w związku z likwidacją, upadłością lub śmiercią pracodawcy, przedłużeniem do dnia porodu albo bezprawnym rozwiązaniem?",
    options: yesNo,
  },
  termination: {
    label: "Powód ustania zatrudnienia",
    question: "Z jakiego powodu ustała umowa o pracę?",
    options: [
      { value: "employerClosed", label: "Śmierć, upadłość lub likwidacja pracodawcy" },
      { value: "unlawful", label: "Naruszenie prawa potwierdzone prawomocnym wyrokiem" },
      { value: "extended", label: "Umowa przedłużona do dnia porodu" },
      { value: "ordinary", label: "Inny powód" },
    ],
  },
  employmentEnded: {
    label: "Ostatni dzień zatrudnienia",
    question: "Jaki był ostatni dzień zatrudnienia?",
    type: "date",
    help: "Podaj ostatni dzień obowiązywania umowy, np. ze świadectwa pracy.",
  },
  alternativeEmployment: {
    label: "Zapewnienie innego zatrudnienia",
    question: "Czy zapewniono Ci inne zatrudnienie?",
    options: yesNo,
  },
  transferReason: {
    label: "Powód przejęcia opieki",
    question: "Dlaczego ojciec ma przejąć opiekę?",
    options: [
      { value: "return", label: "Matka rezygnuje z dalszej części" },
      { value: "hospital", label: "Pobyt matki w szpitalu uniemożliwiający opiekę" },
      { value: "incapacity", label: "Orzeczona niezdolność matki do samodzielnej egzystencji" },
      { value: "death", label: "Śmierć matki" },
      { value: "abandonment", label: "Porzucenie dziecka przez matkę" },
      { value: "newEmployment", label: "Matka bez tytułu do ubezpieczenia podejmuje pracę" },
    ],
  },
  motherDaysBeforeBirth: {
    label: "Dni macierzyńskiego matki przed porodem",
    question:
      "Ile dni macierzyńskiego matka wykorzystała przed porodem? Wpisz 0, jeśli zaczęła w dniu porodu.",
    type: "number",
    placeholder: "np. 14",
    help: "Policz dni macierzyńskiego do dnia przed porodem włącznie. Jeśli urlop zaczął się w dniu porodu, wpisz 0.",
  },
  motherInsured: {
    label: "Ubezpieczenie chorobowe matki",
    question: "Czy matka była objęta ubezpieczeniem chorobowym i korzystała z macierzyńskiego?",
    options: yesNo,
  },
  motherDaysAfterBirth: {
    label: "Dni macierzyńskiego matki po porodzie",
    question: "Ile dni macierzyńskiego matka wykorzystała po porodzie do dnia przed przejęciem?",
    type: "number",
    placeholder: "np. 98",
    help: "Policz dni od dnia porodu do ostatniego dnia macierzyńskiego matki przed przejęciem. Dolicz weekendy i święta.",
  },
  transferEvent: {
    label: "Data zdarzenia dotyczącego matki",
    question: "Kiedy nastąpiło zdarzenie będące powodem przejęcia opieki?",
    type: "date",
    help: "Podaj dzień zdarzenia, przez które ojciec przejmuje opiekę, np. dzień przyjęcia matki do szpitala.",
  },
  transferThrough: {
    label: "Ostatni dzień hospitalizacji matki",
    question: "Do którego dnia pobyt matki w szpitalu uniemożliwia jej opiekę nad dzieckiem?",
    type: "date",
    help: "Podaj ostatni dzień pobytu matki w szpitalu, który uniemożliwia jej opiekę.",
  },
  personalCare: {
    label: "Osobista opieka nad dzieckiem",
    question:
      "Czy ojciec sprawuje osobistą opiekę w tym okresie i korzysta z urlopu lub przerwał działalność zarobkową?",
    options: yesNo,
  },
  motherJobPercent: {
    label: "Wymiar nowego etatu matki (%)",
    question: "Jaki procent pełnego etatu wynosi nowe zatrudnienie matki?",
    type: "number",
    placeholder: "np. 75",
    help: "Przelicz wymiar z umowy na procent pełnego etatu. Pełny etat to 100, a trzy czwarte etatu to 75.",
  },
  motherJobEnds: {
    label: "Ostatni dzień nowego zatrudnienia matki",
    question: "Kiedy kończy się nowe zatrudnienie matki, jeśli data jest już znana?",
    type: "date",
    help: "Podaj ostatni dzień obowiązywania nowej umowy matki, jeśli jest już znany.",
  },
  children: {
    label: "Liczba urodzonych dzieci",
    question: "Ile dzieci urodziło się przy tym porodzie?",
    type: "number",
    placeholder: "np. 1",
    help: "Policz dzieci z tego jednego porodu. Dla bliźniąt wpisz 2.",
  },
  basis: {
    label: "Ustalona podstawa (zł)",
    question: "Jaka jest ustalona miesięczna podstawa wymiaru zasiłku?",
    type: "money",
    placeholder: "np. 5 200,50",
    help: "Wpisz miesięczną kwotę opisaną jako „podstawa wymiaru zasiłku”. Znajdziesz ją w dokumentach albo uzyskasz w kadrach lub ZUS.",
  },
  fixedSalary: {
    label: "Stałe wynagrodzenie brutto (zł)",
    question: "Ile wynosiło stałe miesięczne wynagrodzenie brutto przez 12 pełnych miesięcy?",
    type: "money",
    placeholder: "np. 6 500,00",
    help: "Wpisz jedną miesięczną kwotę brutto przed składkami i podatkiem, jeśli była taka sama przez 12 pełnych miesięcy.",
  },
  payer: {
    label: "Kto wypłaca zasiłek",
    question: "Kto wypłaca zasiłek w tej sprawie?",
    options: [
      { label: "ZUS", value: "zus" },
      { label: "Pracodawca lub płatnik", value: "employer" },
    ],
  },
  insuredHeadcount: {
    label: "Liczba zgłoszonych do chorobowego",
    question:
      "Ile osób płatnik zgłaszał do chorobowego 30 listopada poprzedniego roku? Jeśli wtedy nikogo nie zgłaszał, podaj stan z pierwszego miesiąca zgłoszeń.",
    type: "number",
    placeholder: "np. 25",
    help: "Policz osoby objęte u tego płatnika ubezpieczeniem chorobowym. O liczbę na wskazany dzień możesz zapytać kadry.",
  },
  debt: {
    label: "Zadłużenie w dniu powstania prawa (zł)",
    question:
      "Jakie było zadłużenie w ZUS w dniu powstania prawa? Wpisz 0, jeśli składki były rozliczone.",
    type: "money",
    placeholder: "np. 0,00",
    help: "Wpisz kwotę zaległych składek w złotych na dzień, od którego przysługuje świadczenie. Gdy nie ma zaległości, wpisz 0.",
  },
  debtPaid: {
    label: "Data całkowitej spłaty",
    question: "Kiedy spłacono całość zadłużenia?",
    type: "date",
    help: "Podaj dzień, w którym została uregulowana cała zaległość w ZUS.",
  },
  otherParentDays: {
    label: "Dni rodzicielskiego drugiego rodzica",
    question: "Ile dni rodzicielskiego drugi rodzic wykorzystał lub już zaplanował?",
    type: "number",
    placeholder: "np. 63",
    help: "Zsumuj wykorzystane i zaplanowane dni rodzicielskiego drugiego rodzica. Jeśli to 9 tygodni, wpisz 63.",
  },
  usedDays: {
    label: "Twoje dotychczasowe dni rodzicielskiego",
    question: "Ile dni rodzicielskiego masz już za sobą?",
    type: "number",
    placeholder: "np. 28",
    help: "Policz wykorzystane już dni urlopu rodzicielskiego, razem z weekendami. Jeśli to 4 tygodnie, wpisz 28.",
  },
  parts: {
    label: "Łączna liczba części urlopu",
    question: "Ile razy korzystaliście już z urlopu rodzicielskiego?",
    type: "number",
    placeholder: "np. 2",
    help: "Policz osobne wnioski, na podstawie których korzystaliście już z rodzicielskiego. Jeden Twój i jeden drugiego rodzica to 2. Jeśli nie było jeszcze rodzicielskiego, wpisz 0, także po samym macierzyńskim.",
  },
  careCertificate: {
    label: "Zaświadczenie „Za życiem”",
    question: "Czy dziecko ma zaświadczenie „Za życiem”?",
    options: yesNo,
  },
  soleParent: {
    label: "Brak drugiego rodzica prawnego",
    question: "Czy jesteś jedynym rodzicem prawnym dziecka?",
    options: yesNo,
  },
  reserved: {
    label: "Wyłączne tygodnie rodzica",
    question: "Czy liczysz wyłączne 9 tygodni dla drugiego rodzica?",
    options: yesNo,
  },
  averagedRequest: {
    label: "Data wniosku o uśrednioną stawkę",
    question: "Kiedy złożono wniosek o wypłatę w wysokości 81,5%?",
    type: "date",
    help: "Wpisz dzień złożenia wniosku o wypłatę według stawki 81,5%. Sprawdź potwierdzenie złożenia.",
  },
  parentalInFirstYear: {
    label: "Rodzicielski w pierwszym roku",
    question:
      "Czy w pierwszym roku życia dziecka wykorzystano przynajmniej jeden dzień rodzicielskiego rozliczony po stawce 81,5%?",
    options: yesNo,
  },
  standardRate: {
    label: "Stawka podstawowa",
    question: "Czy stosujemy podstawową stawkę, bez wniosku o uśrednienie?",
    options: [{ label: "Stawka podstawowa", value: true }],
  },
  paternityUsed: {
    label: "Dotychczasowy ojcowski",
    question: "Ile ojcowskiego wykorzystano wcześniej?",
    options: [
      { label: "Jeszcze nic", value: "none" },
      { label: "Tydzień", value: "week" },
      { label: "Dwa tygodnie", value: "full" },
    ],
  },
  workPercent: {
    label: "Praca podczas rodzicielskiego (% etatu)",
    question:
      "Na jaką część pełnego etatu wracasz do pracy u tego pracodawcy? Wpisz procent od 0 do 50.",
    type: "number",
    placeholder: "np. 25",
    help: "Podaj procent pełnego etatu podczas urlopu. Ćwierć etatu to 25, pół etatu to 50, a bez pracy wpisz 0.",
  },
  employmentPercent: {
    label: "Zwykły wymiar pracy (% etatu)",
    question:
      "Ile procent pełnego etatu wynosi Twój zwykły wymiar pracy? Dla pełnego etatu wpisz 100.",
    type: "number",
    placeholder: "np. 100",
    help: "Podaj wymiar pracy z umowy w procentach. Pełny etat to 100, a pół etatu to 50.",
  },
  extensionWorkPercent: {
    label: "Wymiar pracy w wydłużeniu (%)",
    question:
      "Jaki procent pełnego etatu planujesz przepracować w wydłużonej części? Wpisz 0, jeśli cały ten okres będzie bez pracy.",
    type: "number",
    placeholder: "np. 25",
    help: "Podaj, ile procent pełnego etatu chcesz pracować w dodatkowym okresie urlopu. Ćwierć etatu to 25. Jeśli wtedy nie pracujesz, wpisz 0.",
  },
  qualifying: {
    label: "Okres wyczekiwania spełniony",
    question:
      "Czy upłynął Twój okres wyczekiwania lub masz potwierdzony wyjątek? Zwykle wynosi 30 dni przy obowiązkowym chorobowym i 90 dni przy dobrowolnym.",
    options: yesNo,
  },
  qualifyingDays: {
    label: "Zaliczone dni chorobowego",
    question:
      "Ile dni chorobowego upłynęło przed pierwszym dniem zasiłku? Dolicz poprzednie okresy zaliczane do wyczekiwania.",
    type: "number",
    placeholder: "np. 30",
    help: "Podaj liczbę dni, które liczą się do wymaganego stażu w ubezpieczeniu chorobowym. Jeśli masz wcześniejsze okresy zaliczone przez kadry lub ZUS, dodaj je.",
  },
  waitingException: {
    label: "Wyjątek od wyczekiwania",
    question:
      "Czy płatnik lub ZUS potwierdził wyjątek dający prawo bez wyczekiwania, np. 10 lat obowiązkowego chorobowego?",
    options: yesNo,
  },
  illnessStart: {
    label: "Pierwszy dzień ciągłej niezdolności",
    question: "Od jakiego dnia trwa nieprzerwana niezdolność do pracy objęta zwolnieniem?",
    type: "date",
    help: "Jeśli kolejne zwolnienia obejmują dni bez przerwy, podaj pierwszy dzień całego ciągu zwolnień.",
  },
  postInsuranceExcluded: {
    label: "Wyłączenia po ustaniu ubezpieczenia",
    question:
      "Czy masz emeryturę, rentę, zasiłek dla bezrobotnych lub przedemerytalny, inne prawo do świadczeń chorobowych albo nowy tytuł do chorobowego? Uwzględnij też obowiązkowe ubezpieczenie rolnicze i inne wyłączenia z art. 13.",
    options: yesNo,
  },
  lateOnsetCode: {
    label: "Kod E na e-ZLA",
    question: "Czy lekarz oznaczył chorobę o późnym ujawnieniu na e-ZLA kodem E?",
    options: yesNo,
  },
  sickPayDaysRemaining: {
    label: "Pozostałe dni wynagrodzenia chorobowego",
    question:
      "Ile dni wynagrodzenia chorobowego od pracodawcy pozostało od początku podanego okresu? Roczny limit to zwykle 33 dni, a od roku po 50. urodzinach 14 dni.",
    type: "number",
    placeholder: "np. 14",
    help: "Wpisz, ile dni płatnego chorobowego zostało u pracodawcy na początek tego zwolnienia. Stan możesz sprawdzić w kadrach.",
  },
  pregnancyProof: {
    label: "Potwierdzenie ciąży",
    question: "Czy masz e-ZLA z kodem B lub osobne potwierdzenie ciąży?",
    options: yesNo,
  },
  sickDaysUsed: {
    label: "Wykorzystane dni okresu zasiłkowego",
    question: "Ile dni okresu zasiłkowego wykorzystano przed tym zwolnieniem?",
    type: "number",
    placeholder: "np. 60",
    help: "Podaj liczbę dni wcześniejszych zwolnień, które kadry lub ZUS zaliczają do tego samego okresu zasiłkowego.",
  },
  sickPeriodExhausted: {
    label: "Potwierdzony koniec okresu zasiłkowego",
    question:
      "Czy płatnik lub ZUS potwierdził wyczerpanie przysługującego okresu zasiłkowego przed podanym początkiem?",
    options: yesNo,
  },
  employerSickPayEnded: {
    label: "Koniec wynagrodzenia chorobowego",
    question: "Czy ten okres przypada już po dniach wynagrodzenia chorobowego od pracodawcy?",
    options: yesNo,
  },
  gestationalWeeks: {
    label: "Ukończone tygodnie ciąży przy porodzie",
    question:
      "W którym tygodniu ukończono ciążę według zaświadczenia? Podaj liczbę ukończonych tygodni.",
    type: "number",
    placeholder: "np. 34",
    help: "Przepisz liczbę pełnych tygodni z zaświadczenia. Jeśli widzisz 34 tygodnie i 3 dni, wpisz 34.",
  },
  birthWeightGrams: {
    label: "Masa urodzeniowa (g)",
    question: "Jaka była masa urodzeniowa w gramach?",
    type: "number",
    placeholder: "np. 2 200",
    help: "Wpisz wagę przy urodzeniu z dokumentu ze szpitala. Jeśli widzisz 2,2 kg, wpisz 2200.",
  },
  hospitalFrom: {
    label: "Pierwszy dzień pobytu w szpitalu",
    question: "Kiedy zaczął się pobyt dziecka w szpitalu?",
    type: "date",
    help: "Sprawdź na wypisie lub zaświadczeniu dzień przyjęcia dziecka do szpitala.",
  },
  hospitalThrough: {
    label: "Ostatni dzień pobytu w szpitalu",
    question: "Kiedy skończył się pobyt dziecka w szpitalu?",
    type: "date",
    help: "Sprawdź na wypisie lub zaświadczeniu ostatni dzień tego pobytu dziecka.",
  },
  documentDate: {
    label: "Data złożenia wniosku",
    question: "Kiedy złożono wniosek?",
    type: "date",
    help: "Podaj dzień złożenia wniosku z potwierdzenia od pracodawcy lub w eZUS.",
  },
  hospitalRanges: {
    label: "Okresy hospitalizacji",
    question: "Jakie były kolejne okresy pobytu dziecka w szpitalu?",
    hint: "Wpisz np. 2026-04-01/2026-04-03, 2026-04-12/2026-04-18. Podaj pierwszy i ostatni dzień każdego pobytu.",
    type: "text",
    help: "Każdy pobyt wpisz jako data przyjęcia/data wypisu w formacie RRRR-MM-DD. Kolejne pobyty oddziel przecinkiem.",
  },
  combinedHospitalEvidence: {
    label: "Dokumenty z porodu mnogiego",
    question:
      "Czy masz zaświadczenia z najniższą masą urodzeniową i pobytami najdłużej hospitalizowanego dziecka?",
    options: yesNo,
  },
};

export function validateFact(key: FactKey, value: unknown): CaseFacts | undefined {
  const parsed = casePatchSchema.safeParse({ [key]: value });
  return parsed.success ? parsed.data : undefined;
}

const lengthWords = new Map([
  ["jeden", 1],
  ["jedna", 1],
  ["dwa", 2],
  ["trzy", 3],
  ["cztery", 4],
  ["piec", 5],
  ["szesc", 6],
  ["siedem", 7],
  ["osiem", 8],
  ["dziewiec", 9],
  ["dziesiec", 10],
  ["czternascie", 14],
]);
const units = "(dzien|dni|tydzien|tygodnie|tygodni)";
const lengthWithUnit = "(\\d{1,3}|" + [...lengthWords.keys()].join("|") + ") " + units;
export const periodLengthPattern = "(?:tydzien|" + lengthWithUnit + ")";
const lengthWithUnitPattern = new RegExp("^" + lengthWithUnit + "$");
const dayCountFields = new Set<FactKey>([
  "requestedDays",
  "otherParentDays",
  "usedDays",
  "sickDaysUsed",
  "rehabUsed",
]);

export function readPeriodLength(text: string): number | undefined {
  if (text === "tydzien") return 7;
  const match = text.match(lengthWithUnitPattern);
  if (!match) return;
  const count = lengthWords.get(match[1]) ?? Number(match[1]);
  return count * (match[2].startsWith("ty") ? 7 : 1);
}

export function readCaseDate(text: string, upcomingFrom?: string) {
  const explicit = normalizePolishDate(text);
  if (explicit) return parseDate(explicit) ? explicit : undefined;
  if (!upcomingFrom) return;
  const year = upcomingFrom.slice(0, 4);
  const candidate = normalizePolishDate(text, year);
  if (candidate && parseDate(candidate)) {
    if (candidate >= upcomingFrom) return candidate;
    const next = normalizePolishDate(text, String(Number(year) + 1));
    if (parseDate(next)) return next;
  }
}

export function readFact(key: FactKey, input: string, upcomingFrom?: string) {
  const field = fields[key];
  const text = normalizeGuideText(input).replace(/[.!]$/, "");
  if (field.type === "text") return validateFact(key, text);
  if (field.options) {
    const match = field.options.find(({ label }) => normalizeGuideText(label) === text);
    if (match) return validateFact(key, match.value);
    if (key === "employment") {
      if (/^(etat|na etacie)$/.test(text)) return validateFact(key, "employee");
      if (text === "zlecenie") return validateFact(key, "contract");
      if (/^(firma|b2b)$/.test(text)) return validateFact(key, "business");
    }
    if (key === "standardRate" && /^(tak|standardowa|podstawowa)$/.test(text))
      return validateFact(key, true);
    if (key === "paternityUsed") {
      const answer = text.replace(/ (?:z )?(?:urlopu )?ojcowskiego$/, "");
      if (
        /^(?:nic|jeszcze nie|(?:jeszcze )?nie (?:korzystalem|korzystalam|wykorzystalem|wykorzystalam)(?: jeszcze)?(?: nic| ani dnia)?)$/.test(
          answer,
        )
      )
        return validateFact(key, "none");
      const length = readPeriodLength(
        answer.replace(/^(?:wykorzystalem|wykorzystalam|wzialem|wzielam) (?:juz )?/, ""),
      );
      if (length === 0) return validateFact(key, "none");
      if (length === 7) return validateFact(key, "week");
      if (length === 14) return validateFact(key, "full");
    }
    return;
  }
  if (field.type === "date") {
    const dateText =
      key === "from"
        ? text.replace(/^od /, "")
        : key === "through"
          ? text.replace(/^do /, "")
          : text;
    const value = readCaseDate(dateText, key === "from" ? upcomingFrom : undefined);
    if (value) return validateFact(key, value);
    return;
  }
  if (dayCountFields.has(key)) {
    const days = /^\d+$/.test(text) ? Number(text) : readPeriodLength(text);
    return days === undefined ? undefined : validateFact(key, days);
  }
  const numeric = text.replace(/\s/g, "").replace(/(?:zl|pln|dni|tygodni|g|%)$/, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(numeric)) return;
  const number = Number(numeric.replace(",", "."));
  return validateFact(key, field.type === "money" ? Math.round(number * 100) : number);
}

export function factValue(key: FactKey, value: NonNullable<CaseFacts[FactKey]>) {
  if (Array.isArray(value)) return value.map(({ birth }) => formatDay(birth)).join(", ");
  const field = fields[key];
  if (field.options)
    return field.options.find((option) => option.value === value)?.label ?? String(value);
  if (field.type === "date") return formatDay(String(value));
  if (field.type === "money") return moneyLabel(Number(value));
  return String(value);
}

export function readNarrativeFacts(message: string): CaseFacts {
  const text = normalizeGuideText(message);
  const facts: CaseFacts = {};
  if (
    /\b(?:drugi rodzic|drugiego rodzica|moja zona|moj maz|moj partner|moja partnerka)\b/.test(text)
  )
    return facts;
  if (/\b(?:mam umowe o prace|pracuje na etacie|pracuje na umowie o prace)\b/.test(text))
    facts.employment = "employee";
  if (/\b(?:mam umowe zlecenia|pracuje na zleceniu|pracuje na umowie zlecenia)\b/.test(text))
    facts.employment = "contract";
  if (/\bprowadze (?:jednoosobowa )?(?:dzialalnosc|firme)\b/.test(text))
    facts.employment = "business";
  const birth = text.match(
    /\b(?:urodzilam|dziecko urodzilo sie|data urodzenia to)\s+(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})\b/,
  );
  if (birth) Object.assign(facts, readFact("birth", birth[1]));
  const basis = text.match(
    /\b(?:ustalona podstawa(?: zasilku)?|podstawa wymiaru(?: zasilku)?) (?:wynosi |to )?(\d[\d ]*(?:[,.]\d{1,2})?)\s*(?:zl\b|pln\b|$)/,
  );
  if (basis) Object.assign(facts, readFact("basis", basis[1]));
  return facts;
}
