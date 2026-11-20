import type { Deadline, Procedure } from "../../types/catalog";

function deadline(
  id: string,
  title: string,
  rule: Deadline["rule"],
  consequence: string,
  ...sources: string[]
): Deadline {
  return { id, title, rule, consequence, sources };
}

const maternityPayer = [
  {
    id: "Z-3",
    when: ["zus-pays", "employee"],
    note: "Dokument przygotowuje pracodawca, gdy wypłaca ZUS. Sprawdź, czy ZUS ma już aktualne zaświadczenie.",
  },
  {
    id: "Z-3a",
    when: ["zus-pays", "contract"],
    note: "Dokument przygotowuje zleceniodawca, jeśli jest wymagany w Twojej sprawie.",
  },
];

const residence = ["poland", "standard-residence"];

export const procedures: readonly Procedure[] = [
  {
    id: "EMPLOYMENT_PREGNANCY_PROTECTION",
    phase: "pregnancy",
    category: "work",
    title: "Ochrona pracownicy w ciąży",
    authority: "Pracodawca",
    summary: "Sprawdź zasady ochrony zatrudnienia i organizacji pracy w ciąży.",
    conditions: ["employee"],
    documents: [{ id: "pregnancy" }],
    deadlines: [],
    sources: ["laborLaw", "pregnancy"],
    review:
      "Przedłużenie umowy do porodu zależy m.in. od rodzaju umowy, daty jej zakończenia i ustawowych wyjątków.",
    steps: [
      "Przekaż pracodawcy zaświadczenie o ciąży.",
      "Jeśli Twoja umowa ma się skończyć przed porodem, sprawdź jej rodzaj i datę zakończenia z kadrami lub PIP.",
    ],
  },
  {
    id: "SICKNESS_PREGNANCY",
    phase: "pregnancy",
    category: "zus",
    title: "Zasiłek chorobowy w ciąży",
    authority: "Płatnik zasiłków lub ZUS",
    summary:
      "Przy udokumentowanej niezdolności do pracy w ciąży okres zasiłkowy może wynosić do 270 dni.",
    conditions: ["sick-leave", "insured-now", "qualifying-period", "pregnancy-evidence"],
    documents: [
      { id: "eZLA", note: "Kod B albo odrębne zaświadczenie dokumentuje ciążę." },
      ...maternityPayer,
    ],
    deadlines: [],
    amounts: ["sickness100"],
    sources: ["benefitsLaw", "sickness", "sicknessDocs"],
    steps: [
      "Sprawdź w eZUS zwolnienie. Jeśli nie zawiera kodu B, skorzystaj z odrębnego zaświadczenia o ciąży.",
      "Ustal, kto wypłaca świadczenie i czy płatnik powinien przekazać dokumenty do ZUS.",
    ],
  },
  {
    id: "BIRTH_REGISTRATION",
    phase: "birth",
    category: "registration",
    title: "Zgłoszenie urodzenia dziecka",
    authority: "Urząd stanu cywilnego",
    summary: "Po zgłoszeniu USC sporządza akt urodzenia i nadaje dziecku PESEL.",
    conditions: ["birth-open"],
    documents: [{ id: "birthOnline", note: "Możesz również zgłosić urodzenie we właściwym USC." }],
    deadlines: [
      deadline(
        "usc",
        "21 dni od sporządzenia karty urodzenia",
        { type: "offset", field: "birthCardDate", value: 21, unit: "days" },
        "Po terminie USC rejestruje urodzenie z urzędu. Skontaktuj się z USC w sprawie dalszych kroków.",
        "civilLaw",
        "birth",
      ),
    ],
    sources: ["civilLaw", "birth"],
    steps: [
      "Ustal datę sporządzenia karty urodzenia przez placówkę.",
      "Zgłoś urodzenie przez gov.pl lub w USC właściwym dla miejsca urodzenia.",
    ],
  },
  {
    id: "CHILD_HEALTH_INSURANCE",
    phase: "birth",
    category: "health",
    title: "Ubezpieczenie zdrowotne dziecka",
    authority: "Płatnik składek lub ZUS",
    summary: "Po nadaniu PESEL zgłoś dziecko jako członka rodziny do ubezpieczenia.",
    conditions: ["health-open", "health-title"],
    documents: [
      {
        id: "zcna",
        note: "Pracownik przekazuje dane płatnikowi. Osoba prowadząca działalność składa zgłoszenie w ZUS.",
      },
    ],
    deadlines: [
      deadline(
        "health",
        "7 dni od nadania PESEL lub powstania nowego tytułu do ubezpieczenia",
        { type: "offset", field: "healthRegistrationTrigger", value: 7, unit: "days" },
        "Jeśli termin minął, skontaktuj się z płatnikiem i przekaż dane możliwie szybko.",
        "healthLaw",
        "health",
      ),
    ],
    sources: ["healthLaw", "health", "zcna"],
    steps: [
      "Ustal, która ubezpieczona osoba zgłosi dziecko.",
      "Przekaż dane do swojego płatnika. Jeśli jesteś własnym płatnikiem, złóż ZUS ZCNA.",
    ],
  },
  {
    id: "MATERNITY_LEAVE",
    phase: "birth",
    category: "work",
    title: "Urlop macierzyński",
    authority: "Pracodawca",
    summary: "Wymiar urlopu zależy od liczby dzieci urodzonych przy jednym porodzie.",
    conditions: ["employee", "children-count"],
    documents: [],
    deadlines: [],
    sources: ["laborLaw", "maternity"],
    steps: [
      "Uzgodnij z kadrami daty urlopu. Możesz wykorzystać do 6 tygodni przed przewidywaną datą porodu.",
      "Jeśli nie korzystasz z urlopu przed porodem, rozpoczyna się on w dniu porodu.",
    ],
  },
  {
    id: "MATERNITY_ALLOWANCE",
    phase: "birth",
    category: "zus",
    title: "Zasiłek macierzyński",
    authority: "Płatnik zasiłków lub ZUS",
    summary:
      "Ubezpieczenie chorobowe może dawać prawo do wypłaty także przy zleceniu lub działalności.",
    conditions: ["insured-birth"],
    documents: [
      {
        id: "hospital",
        when: ["supplement"],
        note: "Przy wniosku o zasiłek za okres odpowiadający uzupełniającemu urlopowi.",
      },
      {
        id: "ZAM",
        when: ["zus-pays"],
        note: "Jeżeli płaci ZUS, sprawdź w instrukcji, czy składasz ten wniosek dla rozpatrywanego okresu.",
      },
      ...maternityPayer,
    ],
    deadlines: [
      deadline(
        "averaged",
        "21 dni od porodu na wniosek o uśrednioną stawkę",
        { type: "offset", field: "birthDate", value: 21, unit: "days" },
        "Termin dotyczy wyboru stawki 81,5%. Po terminie stosuje się zwykłe zasady ustalania stawki.",
        "benefitsLaw",
        "maternityDocs",
      ),
    ],
    amounts: ["maternity100", "parental70", "averaged815"],
    sources: ["benefitsLaw", "maternityDocs"],
    steps: [
      "Ustal, kto wypłaci zasiłek i jakie dokumenty trzeba przekazać.",
      "Jeśli rozważasz uśrednioną stawkę, sprawdź zasady oraz termin 21 dni od porodu.",
      "Po hospitalizacji dziecka sprawdź w ZUS zasiłek za okres odpowiadający uzupełniającemu urlopowi macierzyńskiemu.",
    ],
  },
  {
    id: "PARENTAL_LEAVE",
    phase: "later",
    category: "work",
    title: "Urlop rodzicielski",
    authority: "Pracodawca",
    summary:
      "Łącznie 41 tygodni przy urodzeniu jednego dziecka lub 43 tygodnie przy porodzie mnogim. Po 9 tygodni dla każdego rodzica jest nieprzenoszalne.",
    conditions: ["employee"],
    documents: [{ id: "parental" }],
    deadlines: [
      deadline(
        "parental",
        "Co najmniej 21 dni przed początkiem urlopu",
        { type: "offset", field: "parentalStart", value: -21, unit: "days" },
        "Jeśli do planowanego początku zostało mniej czasu, ustal daty z pracodawcą.",
        "laborLaw",
        "parental",
      ),
    ],
    sources: ["laborLaw", "parental"],
    steps: [
      "Ustal podział okresów z drugim rodzicem. Zaświadczenie „Za życiem” może zwiększyć łączny wymiar do 65 lub 67 tygodni.",
      "Złóż wniosek o urlop u pracodawcy.",
    ],
  },
  {
    id: "SUPPLEMENTARY_MATERNITY_LEAVE",
    phase: "birth",
    category: "work",
    title: "Uzupełniający urlop macierzyński",
    authority: "Pracodawca",
    summary: "Pobyt dziecka w szpitalu po porodzie może dać dodatkowe tygodnie urlopu.",
    validity: { from: "2025-03-19" },
    conditions: ["employee", "supplement"],
    documents: [{ id: "supplement" }, { id: "hospital" }],
    deadlines: [
      deadline(
        "supplement",
        "Co najmniej 21 dni przed końcem urlopu macierzyńskiego",
        { type: "offset", field: "maternityEnd", value: -21, unit: "days" },
        "Jeśli jest mniej czasu, skontaktuj się z pracodawcą w sprawie możliwości złożenia wniosku.",
        "laborLaw",
        "supplement",
      ),
    ],
    sources: ["laborLaw", "supplement"],
    steps: [
      "Poproś szpital o zaświadczenie z datami pobytu oraz tygodniem ciąży i masą urodzeniową.",
      "Złóż wniosek u pracodawcy. Urlop wykorzystuje się jednorazowo bezpośrednio po macierzyńskim.",
    ],
  },
  {
    id: "CHILD_800_PLUS",
    phase: "birth",
    category: "zus",
    title: "Świadczenie wychowawcze 800+",
    authority: "ZUS",
    summary: "Comiesięczne wsparcie na dziecko do ukończenia 18 lat.",
    conditions: ["child-under-18", ...residence],
    documents: [{ id: "SW-R", note: "Dostępny m.in. w eZUS i mZUS." }],
    deadlines: [
      deadline(
        "newborn800",
        "3 miesiące od narodzin na świadczenie od dnia urodzenia",
        { type: "offset", field: "birthDate", value: 3, unit: "months" },
        "Po tym terminie świadczenie zasadniczo przysługuje od miesiąca złożenia wniosku.",
        "childLaw",
        "child800",
      ),
      deadline(
        "period800",
        "Wniosek na nowy okres świadczeniowy (1 lutego–30 czerwca)",
        { type: "yearly", opens: [2, 1], closes: [6, 30], clock: "800-period" },
        "Wniosek po 30 czerwca zasadniczo daje prawo od miesiąca złożenia. Dla noworodków działa również reguła trzech miesięcy.",
        "childLaw",
        "child800",
      ),
    ],
    amounts: ["child800"],
    sources: ["childLaw", "child800"],
    steps: [
      "Przygotuj dane dziecka i rachunku bankowego.",
      "Wniosek SW-R złóż do ZUS wyłącznie elektronicznie, np. przez eZUS lub mZUS.",
      "Okres świadczeniowy trwa od 1 czerwca do 31 maja. Gdy narodziny i wniosek wypadają w różnych okresach, sprawdź w eZUS, czy potrzebujesz wniosków na oba okresy.",
    ],
  },
  {
    id: "PARENTAL_BENEFIT",
    phase: "birth",
    category: "municipal",
    title: "Świadczenie rodzicielskie",
    authority: "Gmina lub MOPS",
    summary:
      "Wsparcie niezależne od dochodu. Przy jednym dziecku podstawowy okres wynosi 52 tygodnie.",
    conditions: ["no-maternity", "children-count", ...residence],
    documents: [
      { id: "parentalBenefit" },
      {
        id: "hospital",
        when: ["supplement"],
        note: "Przy ubieganiu się o wydłużenie wypłat za hospitalizację.",
      },
    ],
    deadlines: [
      deadline(
        "parentalBenefit",
        "3 miesiące od narodzin na świadczenie od miesiąca urodzenia",
        { type: "offset", field: "birthDate", value: 3, unit: "months" },
        "Późniejszy wniosek daje prawo od miesiąca złożenia w pozostałej części okresu świadczenia.",
        "familyLaw",
        "parentalBenefit",
      ),
    ],
    amounts: ["parentalBenefit"],
    sources: ["familyLaw", "parentalBenefit", "supplement"],
    review:
      "Gmina sprawdzi osobistą opiekę, okres wypłaty i ustawowe wyłączenia. Pobyt dziecka w szpitalu może wydłużyć okres wypłaty.",
    steps: [
      "Sprawdź właściwy urząd lub złóż wniosek przez Emp@tię.",
      "Jeśli ubiegasz się o wydłużenie okresu, poproś szpital o zaświadczenie i ustal termin z gminą.",
    ],
  },
  {
    id: "BIRTH_GRANT_BECIKOWE",
    phase: "birth",
    category: "municipal",
    title: "Becikowe",
    authority: "Gmina lub MOPS",
    summary:
      "Jednorazowa zapomoga po urodzeniu dziecka uzależniona od dochodu i opieki medycznej w ciąży.",
    conditions: ["medical-care", "becikowe-income", ...residence],
    documents: [{ id: "becikowe" }, { id: "birthMedical" }],
    deadlines: [
      deadline(
        "becikowe",
        "12 miesięcy od urodzenia na wniosek rodzica",
        { type: "offset", field: "birthDate", value: 12, unit: "months" },
        "Wniosek złożony po terminie pozostawia się bez rozpoznania.",
        "familyLaw",
        "becikowe",
      ),
    ],
    amounts: ["becikowe"],
    sources: ["familyLaw", "becikowe"],
    review:
      "Gmina potwierdza dochód według przepisów o świadczeniach rodzinnych. Przy samotnym wychowywaniu obowiązuje też warunek ustalenia alimentów z ustawowymi wyjątkami.",
    steps: [
      "Przygotuj zaświadczenie lekarza lub położnej i dokumenty dochodowe wymagane przez gminę.",
      "Złóż wniosek w jednostce gminy lub przez Emp@tię.",
    ],
  },
  {
    id: "ACTIVE_PARENT_WORK",
    phase: "later",
    category: "zus",
    component: "work",
    title: "Aktywni rodzice w pracy",
    authority: "ZUS",
    summary:
      "Wsparcie po spełnieniu warunków aktywności zawodowej, od 12. do 35. miesiąca życia dziecka.",
    validity: { from: "2024-10-01" },
    conditions: ["active-age", "no-nursery", "activity-check", ...residence, "component-work"],
    documents: [{ id: "AWP" }],
    deadlines: [
      deadline(
        "awp",
        "Od miesiąca ukończenia 12 miesięcy życia",
        { type: "guidance" },
        "Prawo ustala się zasadniczo od miesiąca złożenia wniosku.",
        "activeLaw",
        "work",
      ),
    ],
    amounts: ["work", "workHigher"],
    sources: ["activeLaw", "work", "activeForms"],
    steps: [
      "Sprawdź podstawy składek dla każdej osoby wymaganej w Twojej sytuacji.",
      "Wypełnij wniosek AWP w eZUS lub innym wskazanym kanale.",
    ],
  },
  {
    id: "ACTIVE_PARENT_NURSERY",
    phase: "later",
    category: "zus",
    component: "nursery",
    title: "Aktywnie w żłobku",
    authority: "ZUS",
    summary:
      "Dofinansowanie opłaty za pobyt dziecka w żłobku, klubie dziecięcym lub u dziennego opiekuna.",
    validity: { from: "2024-10-01" },
    conditions: [
      "nursery-age",
      "nursery",
      "nursery-registered",
      "nursery-fee",
      ...residence,
      "component-nursery",
    ],
    documents: [{ id: "AWZ" }],
    deadlines: [
      deadline(
        "awz",
        "2 miesiące od rozpoczęcia opieki na wyrównanie",
        { type: "offset", field: "nurseryStart", value: 2, unit: "months" },
        "Później prawo ustala się zasadniczo od miesiąca złożenia wniosku.",
        "activeLaw",
        "nursery",
      ),
    ],
    amounts: ["nursery", "nurseryHigher", "nurseryFee"],
    sources: ["activeLaw", "nursery", "activeForms"],
    review:
      "Przy starszym dziecku ZUS uwzględni rok szkolny i ewentualne trudności z objęciem wychowaniem przedszkolnym.",
    steps: [
      "Sprawdź wpis placówki lub opiekuna oraz opłatę bez wyżywienia.",
      "Złóż AWZ po rozpoczęciu opieki. Pieniądze trafiają do placówki lub opiekuna.",
    ],
  },
  {
    id: "ACTIVE_PARENT_HOME",
    phase: "later",
    category: "zus",
    component: "home",
    title: "Aktywnie w domu",
    authority: "ZUS",
    summary:
      "Wsparcie od miesiąca ukończenia 12 miesięcy do końca miesiąca ukończenia 35 miesięcy.",
    validity: { from: "2024-10-01" },
    conditions: ["active-age", ...residence, "rko-check", "component-home"],
    documents: [{ id: "AWD" }],
    deadlines: [
      deadline(
        "awd",
        "Od miesiąca ukończenia 12 miesięcy życia",
        { type: "guidance" },
        "Prawo ustala się zasadniczo od miesiąca złożenia wniosku.",
        "activeLaw",
        "home",
      ),
    ],
    amounts: ["home"],
    sources: ["activeLaw", "home", "activeForms"],
    steps: [
      "Porównaj trzy warianty Aktywnego Rodzica. W tym samym miesiącu można pobrać jeden na dziecko.",
      "Jeśli ten wariant pasuje, złóż wniosek AWD.",
    ],
  },
  {
    id: "PATERNITY_LEAVE",
    phase: "later",
    category: "work",
    title: "Urlop ojcowski",
    authority: "Pracodawca ojca dziecka",
    summary:
      "Ojcu zatrudnionemu na umowę o pracę przysługują do 2 tygodni urlopu w przewidzianym okresie.",
    conditions: ["child-under-1", "other-employee"],
    documents: [{ id: "paternity" }],
    deadlines: [
      deadline(
        "paternity",
        "Co najmniej 7 dni przed rozpoczęciem urlopu",
        { type: "offset", field: "paternityStart", value: -7, unit: "days" },
        "Jeśli do planowanej daty zostało mniej czasu, ojciec powinien uzgodnić datę z pracodawcą.",
        "laborLaw",
        "paternity",
      ),
    ],
    sources: ["laborLaw", "paternity"],
    review:
      "Sprawdź dotychczas wykorzystany wymiar i czy planowany urlop zmieści się przed ukończeniem 12 miesięcy przez dziecko.",
    steps: [
      "Ojciec składa wniosek pracodawcy. Urlop może być wykorzystany raz lub w dwóch częściach po tydzień.",
    ],
  },
  {
    id: "CARE_ALLOWANCE",
    phase: "later",
    category: "zus",
    title: "Zasiłek opiekuńczy",
    authority: "Płatnik zasiłków lub ZUS",
    summary: "Zasiłek na czas osobistej opieki w przypadkach przewidzianych w ustawie.",
    conditions: ["insured-now", "care-needed"],
    documents: [{ id: "Z-15" }],
    deadlines: [],
    sources: ["benefitsLaw", "care", "z15"],
    review:
      "Sprawdź powód opieki, wiek dziecka, wykorzystane dni i dostępność innych domowników. Właściwy limit zależy od sytuacji.",
    steps: ["Wypełnij wniosek Z-15 i sprawdź wymagane dowody dla Twojego powodu opieki."],
  },
  {
    id: "CHILDCARE_LEAVE",
    phase: "later",
    category: "work",
    title: "Urlop wychowawczy",
    authority: "Pracodawca",
    summary: "Urlop na osobistą opiekę nad dzieckiem po uzyskaniu wymaganego stażu pracy.",
    conditions: ["employee", "six-months"],
    documents: [{ id: "childcare" }],
    deadlines: [
      deadline(
        "childcare",
        "Co najmniej 21 dni przed rozpoczęciem urlopu",
        { type: "offset", field: "childcareLeaveStart", value: -21, unit: "days" },
        "Przy późniejszym wniosku sprawdź u pracodawcy datę rozpoczęcia urlopu.",
        "laborLaw",
        "childcare",
      ),
    ],
    sources: ["laborLaw", "childcare"],
    review:
      "Pracodawca ustali pozostały wymiar i termin z uwzględnieniem wieku dziecka i ewentualnego orzeczenia.",
    steps: ["Ustal staż pracy, pozostały wymiar i datę rozpoczęcia.", "Złóż wniosek u pracodawcy."],
  },
  {
    id: "FAMILY_ALLOWANCE",
    phase: "later",
    category: "municipal",
    title: "Zasiłek rodzinny i dodatki",
    authority: "Gmina lub MOPS",
    summary:
      "Świadczenie dochodowe z możliwością dodatków, w tym dodatku z tytułu urodzenia dziecka.",
    conditions: ["family-income", ...residence],
    documents: [
      { id: "family" },
      {
        id: "birthMedical",
        when: ["medical-care"],
        note: "W ścieżce rodzica przy ubieganiu się o dodatek z tytułu urodzenia.",
      },
    ],
    deadlines: [],
    sources: ["familyLaw", "family"],
    review:
      "Gmina wyliczy świadczenie, w tym według reguły „złotówka za złotówkę”, i sprawdzi warunki dodatków.",
    steps: [
      "Sprawdź wykaz dokumentów i wniosek o zasiłek rodzinny wraz z dodatkami w swojej gminie.",
    ],
  },
  {
    id: "CHILD_TAX_RELIEF",
    phase: "later",
    category: "tax",
    title: "Ulga na dziecko w PIT",
    authority: "Urząd skarbowy",
    summary: "Ulgę prorodzinną można rozliczyć w zeznaniu podatkowym po spełnieniu warunków.",
    conditions: ["tax-scale"],
    documents: [{ id: "pitO" }],
    deadlines: [],
    sources: ["taxLaw", "tax"],
    review:
      "Sprawdź zasady dla swojego roku podatkowego, liczbę miesięcy wykonywania władzy rodzicielskiej, dochód i sytuację drugiego rodzica.",
    steps: ["Sprawdź warunki ulgi i uzupełnij PIT/O przy zeznaniu PIT-36 lub PIT-37."],
  },
];
