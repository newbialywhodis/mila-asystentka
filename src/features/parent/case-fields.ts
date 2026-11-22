import { parseDate } from "../../engine/dates";
import { casePatchSchema, employmentLabels, formatDay, moneyLabel } from "../../engine/parent-case";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import { normalizeGuideText, normalizePolishDate } from "../guide/textInput";

type Choice = { label: string; value: string | boolean };
type Field = {
  label: string;
  question: string;
  hint?: string;
  type?: "date" | "money" | "number" | "text";
  options?: Choice[];
};
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
  },
  certifiedDueDate: {
    label: "Termin porodu z zaświadczenia",
    question:
      "Jaki przewidywany termin porodu widniał na zaświadczeniu przy wcześniejszym rozpoczęciu macierzyńskiego?",
    type: "date",
  },
  childDeath: {
    label: "Data śmierci dziecka",
    question: "Kiedy zmarło dziecko? Przy martwym urodzeniu podaj dzień porodu.",
    type: "date",
  },
  survivingChildren: {
    label: "Dzieci pozostałe przy życiu",
    question: "Ile dzieci z tego porodu pozostało przy życiu?",
    type: "number",
  },
  maternityEnd: {
    label: "Koniec macierzyńskiego",
    question: "Jaki był ostatni dzień macierzyńskiego wraz z ewentualnym uzupełnieniem?",
    type: "date",
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
  },
  adoptionFinal: {
    label: "Prawomocność orzeczenia o przysposobieniu",
    question: "Kiedy uprawomocniło się postanowienie o przysposobieniu dziecka?",
    type: "date",
  },
  careAccepted: {
    label: "Data przyjęcia na wychowanie",
    question: "Kiedy przyjęto dziecko lub dzieci na wychowanie?",
    type: "date",
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
  rehabUsed: {
    label: "Wykorzystane dni świadczenia rehabilitacyjnego",
    question: "Ile dni świadczenia rehabilitacyjnego już wykorzystano?",
    type: "number",
  },
  birth: {
    label: "Data urodzenia",
    question: "Kiedy urodziło się dziecko?",
    hint: "Ta data pozwala ustalić okres świadczenia i obowiązujące terminy.",
    type: "date",
  },
  from: {
    label: "Pierwszy dzień",
    question: "Od którego dnia ma się zacząć ten okres?",
    type: "date",
  },
  through: {
    label: "Ostatni dzień",
    question: "Jaki jest ostatni dzień tego okresu?",
    type: "date",
  },
  requestedDays: {
    label: "Planowana liczba dni",
    question: "Ile dni chcesz uwzględnić w tym okresie?",
    type: "number",
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
  },
  transferEvent: {
    label: "Data zdarzenia dotyczącego matki",
    question: "Kiedy nastąpiło zdarzenie będące powodem przejęcia opieki?",
    type: "date",
  },
  transferThrough: {
    label: "Ostatni dzień hospitalizacji matki",
    question: "Do którego dnia pobyt matki w szpitalu uniemożliwia jej opiekę nad dzieckiem?",
    type: "date",
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
  },
  motherJobEnds: {
    label: "Ostatni dzień nowego zatrudnienia matki",
    question: "Kiedy kończy się nowe zatrudnienie matki, jeśli data jest już znana?",
    type: "date",
  },
  children: {
    label: "Liczba urodzonych dzieci",
    question: "Ile dzieci urodziło się przy tym porodzie?",
    type: "number",
  },
  basis: {
    label: "Ustalona podstawa (zł)",
    question: "Jaka jest ustalona miesięczna podstawa wymiaru zasiłku?",
    type: "money",
  },
  fixedSalary: {
    label: "Stałe wynagrodzenie brutto (zł)",
    question: "Ile wynosiło stałe miesięczne wynagrodzenie brutto przez 12 pełnych miesięcy?",
    type: "money",
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
  },
  debt: {
    label: "Zadłużenie w dniu powstania prawa (zł)",
    question:
      "Jakie było zadłużenie w ZUS w dniu powstania prawa? Wpisz 0, jeśli składki były rozliczone.",
    type: "money",
  },
  debtPaid: {
    label: "Data całkowitej spłaty",
    question: "Kiedy spłacono całość zadłużenia?",
    type: "date",
  },
  otherParentDays: {
    label: "Dni rodzicielskiego drugiego rodzica",
    question: "Ile dni rodzicielskiego drugi rodzic wykorzystał lub już zaplanował?",
    type: "number",
  },
  usedDays: {
    label: "Twoje dotychczasowe dni rodzicielskiego",
    question: "Ile dni rodzicielskiego masz już za sobą?",
    type: "number",
  },
  parts: {
    label: "Wykorzystane części obojga rodziców",
    question: "Ile części rodzicielskiego wykorzystaliście łącznie?",
    type: "number",
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
  },
  employmentPercent: {
    label: "Zwykły wymiar pracy (% etatu)",
    question:
      "Ile procent pełnego etatu wynosi Twój zwykły wymiar pracy? Dla pełnego etatu wpisz 100.",
    type: "number",
  },
  extensionWorkPercent: {
    label: "Wymiar pracy w wydłużeniu (%)",
    question:
      "Jaki procent pełnego etatu planujesz przepracować w wydłużonej części? Wpisz 0, jeśli cały ten okres będzie bez pracy.",
    type: "number",
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
  },
  birthWeightGrams: {
    label: "Masa urodzeniowa (g)",
    question: "Jaka była masa urodzeniowa w gramach?",
    type: "number",
  },
  hospitalFrom: {
    label: "Pierwszy dzień pobytu w szpitalu",
    question: "Kiedy zaczął się pobyt dziecka w szpitalu?",
    type: "date",
  },
  hospitalThrough: {
    label: "Ostatni dzień pobytu w szpitalu",
    question: "Kiedy skończył się pobyt dziecka w szpitalu?",
    type: "date",
  },
  documentDate: {
    label: "Data złożenia wniosku",
    question: "Kiedy złożono wniosek?",
    type: "date",
  },
  hospitalRanges: {
    label: "Okresy hospitalizacji",
    question: "Jakie były kolejne okresy pobytu dziecka w szpitalu?",
    hint: "Wpisz np. 2026-04-01/2026-04-03, 2026-04-12/2026-04-18. Podaj pierwszy i ostatni dzień każdego pobytu.",
    type: "text",
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

export function factInputValue(key: FactKey, value: CaseFacts[FactKey]) {
  if (value === undefined) return "";
  return fields[key].type === "money"
    ? String(Number(value) / 100).replace(".", ",")
    : factValue(key, value);
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
