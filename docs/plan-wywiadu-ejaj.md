# Plan implementacji wywiadu i pomocy AI w Mili

Branch: `ejaj`. Status: specyfikacja po audycie kodu, do wdrażania etapami. Data: 22 listopada 2026.

Mila ma pomagać osobie, która nie zna nazw świadczeń. Zachowujemy kierunek obecnego planu: przygotowana rozmowa → wstępne dopasowanie → szczegółowe sprawdzenie wybranej sprawy → wynik i dalsza rozmowa. Korekta dotyczy przede wszystkim własności danych, przejść i naturalnych wypowiedzi. AI proponuje interpretację; katalog i silniki TypeScript ustalają warunki, terminy oraz kwoty.

Dokument opisuje **zmiany przyszłe**, nie zaimplementowane funkcje. W tym zadaniu zmieniamy wyłącznie ten plik; bez implementacji, nowych zależności, commita i wdrożenia.

## 1. Decyzje dotyczące produktu

- Główna akcja: **Sprawdź, co może Ci przysługiwać**. Skrót **Wiem, jakie świadczenie sprawdzić** zachowuje istniejący wybór kalkulatorów. PDF, przykłady, porównanie opieki i wsparcie pozostają osiągalne bez wywiadu.
- Szybkie rozpoznanie daje wartość po ustaleniu osoby i sytuacji; zwykle 2–4 odpowiedzi wystarczą do pierwszych kart. Nie ma minimalnej liczby obowiązkowych kroków. **Pokaż możliwe sprawy** działa również wcześniej, z jawnym wskazaniem braków.
- Jedno pytanie naraz, przyciski i swobodny tekst w tym samym czacie. Pomoc, korekta i zmiana celu nie kasują kontekstu. Nie pokazujemy fikcyjnego postępu „3 z 6”.
- Pytania prawne, ich zależności, walidacja i kolejność są deterministyczne. AI rozpoznaje intencję i kandydatów faktów, wyjaśnia pytania i pojęcia. Nie zatwierdza faktów, nie przyznaje świadczenia, nie przelicza wyniku i nie tworzy pytań prawnych.
- Cała ścieżka przyciski → dopasowanie → istniejący kalkulator → wynik → kolejna sprawa działa bez AI. Przy awarii interpretacji użytkownik zachowuje tekst i może potwierdzić dane kontrolkami.
- Nie dodajemy frameworka agentowego, bazy, autentykacji, CRM ani trwałego zapisu. Istniejące logowanie i usługi demonstracyjne oraz szkice wniosków zachowujemy; ich wersje produkcyjne i wypełnione urzędowe PDF-y nie są częścią tej zmiany.
- Poprawność kalkulatorów i lokalna ścieżka PDF → ocena → wynik mają pierwszeństwo przed rozbudową rozmowy. Wymagań konkursowych nie uznajemy za opcjonalne z powodu ich odrębnego zakresu.

## 2. Rzeczywisty stan projektu i konsekwencje audytu

Przeczytano `AGENTS.md`, `README.md`, dokumenty ZUS oraz bieżący plan; sprawdzono implementację i testy wskazane poniżej. Opisy dawnych stanów z dokumentacji nie zastępują kodu. Na początku audytu Git był czysty, branch `ejaj`, HEAD `564c0c7`. Dawna wzmianka planu o lokalnych zmianach i błędach `.next` nie opisuje tego stanu. W tym audycie `bun test`: **151 zaliczonych, 0 błędów, 11 plików**; osobno przeszły lint, typecheck i walidacja katalogu. `bun run check` zatrzymało się na formatowaniu niezmienianego `src/features/landing/LandingPaperwork.tsx`; ten plan przechodzi kontrolę formatowania. Nie jest to nowy odbiór przeglądarkowy, buildu ani reguł prawnych.

| Element istniejący                                                  | Ustalenie z kodu                                                                                                                                                                                                                  | Decyzja dla planu                                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `parent/case-session.ts`, `engine/parent-case.ts`                   | `CaseSession.family` to `ParentCase` z jednym płaskim `CaseFacts` i źródłami `{label,page?}`, nie model rodziny. `selectBenefit` usuwa część pól; `saveFacts` unieważnia je według aktywnego świadczenia                          | Dodać Family/Persons/Assessments; nie nazywać dotychczasowego zestawu faktami całej rodziny                                |
| `useParentWorkspace.ts`, `ParentThread.tsx`                         | Pytanie wynika z `getBenefitTurn`, czyli ostatniego odpowiedniego wpisu historii. `deferred` jest cechą wiadomości. Hook ma `useState` i anulowanie AI, ale nie pełny kontrakt rewizji/aktywności rozmowy                         | Jeden właściciel stanu i jawny kursor pytania; historia jest prezentacją                                                   |
| `case-fields.ts`, `case-message.ts`                                 | `readFact` obsługuje proste odpowiedzi; `readCaseRequest` skróty kalkulatorów; `readNarrativeFacts` niewielki podzbiór danych i odrzuca wzmianki o partnerze. Wielozdaniowe propozycje zależą od rozpoznania świadczenia          | Zachować parsery; bezpośredni zapis tylko jednoznacznych odpowiedzi. Opis bez nazwy świadczenia też może uzupełniać wywiad |
| `parent-intent.ts`, `/api/parent-intent`                            | AI SDK `generateText` + `Output.object`, Zod, jedna akcja; fakty modelu walidowane i ograniczane do 12. `continueWithAssessment` proponuje potwierdzenie; bez wybranego świadczenia nie zapisuje opisu sytuacji                   | Rozszerzyć istniejący kontrakt o wywiad i propozycje przypisane do osoby, bez osobnego systemu AI                          |
| `case-assistant-context.ts`                                         | Do 16 wiadomości, po 2000 znaków według schematu; część lokalnych odpowiedzi pomijana, wynik i dokument nieserializowane. Zwykły tekst i jego historia nadal mogą zawierać dane prywatne                                          | Nie nazywać tego anonimizacją; kontrolowana projekcja i osobny kanał tematów pomocy                                        |
| `guide/flow.ts`, `conversation.ts`                                  | Planowanie ma 2 pytania, ciąża/narodziny po 5 w sztywnych gałęziach; `Profile.stage` ma tylko `pregnant/born`. Stary stan nie steruje obecnym czatem                                                                              | Reużywać teksty/kontrolki, nie montować drugiego kontrolera. Zachować odbiorców, w tym landing i testy                     |
| `data/questions.ts`, `types/profile.ts`                             | Bank pytań katalogu, ale bez własności osoby, pochodzenia i stanów odpowiedzi                                                                                                                                                     | Adapter, nie drugi magazyn danych. „Inna sytuacja” nie wystarcza dla kalkulatora                                           |
| `evaluateProcedure.ts`, `plan.ts`                                   | 19 procedur, statusy `relevant/possible/missing-data/not-relevant`, źródła, braki i terminy. `generatePlan` ocenia wszystkie przy jednym `Profile`, sortuje fazą, potem datą                                                      | Discovery zmienia perspektywę i prezentację, nie kwalifikację                                                              |
| `parent-benefit.ts`, `parent-plan.ts`, `payroll-basis.ts`           | 12 wariantów kalkulatora; dokładniejsza ocena, kwoty w groszach, okresy, płatnik i dokumenty. `eligible` może nadal mieć `missing: basis/payer`; katalog nie ma równoważnego zakresu                                              | Rozróżnić prawo, kompletność wyniku i prezentację; zachować silniki i ich granice                                          |
| `CaseTools.tsx`, `PlanReport`, `PlanDetails`                        | Niepełna konwersja `CaseFacts → Profile`, np. bez ubezpieczenia i drugiego rodzica; `collaborator → other`. Brak etapu trafia do planowania. Odhaczenia lokalne w `Formalities`                                                   | Wspólny adapter; planowanie wyłącznie jawne; odhaczenia w sesji                                                            |
| `CareComparison.tsx`                                                | Lokalny szkic `facts/options`, wynik z `compareParentalPlans`, oddzielne dane drugiej osoby. Historyczny turn nie śledzi korekt sesji                                                                                             | Zachować symulator; potwierdzone dane i aktualny wariant do assessmentu; szkic formularza może zostać lokalny              |
| `DocumentTurn`, `case-documents`, `local-document`, `scan-evidence` | PDF.js/Tesseract lokalnie, do 30 MB i 100 stron naraz, wybór zakresu powyżej 30 stron, potwierdzanie i konflikty. Część kandydatów ma dzień i typ zatrudnienia, bez ID osoby/tytułu. `continueWithDocument` sprawdza ostatni turn | Zachować OCR/ręczną pracę; dodać cel, pochodzenie i rewizję. Decyzja zasiłkowa służy porównaniu po obliczeniu              |
| `/api/parent-document`, `uploadAllowed`                             | Opcjonalny odczyt chmurowy po ustawieniu zmiennej i kliknięciu zgody wysyła cały PDF do modelu                                                                                                                                    | Zakaz wysyłania własnych akt wymaga wyłączenia tej ścieżki w UI **i** route, także przy ustawionej zmiennej                |
| `checkedAssessment` w hooku                                         | Po `eligible/ineligible` `askHelp` nie wywołuje pomocy, a `reply` modelu jest zastępowane kolejnym wynikiem. Po własnym PDF-ie tekst kończy się lokalnym FAQ/fallbackiem                                                          | Zastąpić blokadę jawnym routingiem pomocy i działań                                                                        |
| `MilaGuide`, `CaseConversation`                                     | Osobny hook na rozmowę; nieaktywne rozmowy pozostają zamontowane                                                                                                                                                                  | Przełączenie nie oznacza unmount; przekazać aktywność do hooka/OCR i unieważniać oczekujące akcje                          |

Stos z `package.json`: Next `16.4.6`, AI SDK `7.0.178`, Zod `4.6.7`, Base UI `1.9.0`, CSS Modules, Bun `1.4.4`. Bez nowej zależności runtime. Przy implementacji czytać dokumentację zainstalowanego Next w `node_modules/next/dist/docs/` (w audycie sprawdzono przewodniki Route Handlers i Server/Client Components), a dla zmienianych wywołań również lokalne API AI SDK.

## 3. Przebieg użytkownika i krótki wywiad

Na wejściu Mila proponuje rozmowę o sytuacji; samo powitanie nie uruchamia obowiązkowej ankiety. Opis może rozpocząć wywiad i propozycję danych równocześnie. Prośba o konkretny kalkulator nadal prowadzi bezpośrednio do niego, ale przed użyciem danych ustala osobę i zdarzenie.

| Kolejność przygotowana          | Zakres i moment pytania                                                                                                              | Co można odłożyć                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1. Kogo dotyczy sprawdzanie?    | Osoba rodząca, drugi rodzic, opiekun, cała rodzina; „pomagam komuś” ustala osobę opisywaną, nie zatrudnienie rozmówcy                | Imiona i dane pomagającego niepotrzebne. Bez wyboru ogólne możliwości, bez indywidualnej oceny        |
| 2. Sytuacja rodziny             | Planowanie, ciąża, narodziny, przyjęcie dziecka; osobne spokojne wejście po stracie                                                  | Daty/szczegóły. Nie wnioskować płci, ojcostwa lub roli z nazwy partnera                               |
| 3. Sytuacja zawodowa osoby      | Jeśli pomaga wybrać urlop/zasiłek: etat, zlecenie, działalność, współpraca, brak pracy, inna sytuacja, nie wiem                      | Dane drugiej osoby i umowy; brak pracy nie oznacza braku wszystkich tytułów ubezpieczenia             |
| 4. Data lub jeden sygnał gałęzi | Opcjonalny termin/urodzenie; w ciąży np. potrzeba sprawdzenia zwolnienia. Po narodzinach pilna formalność wskazana przez użytkownika | Miesiąc/trymestr to orientacja rozmowy, nigdy data. Hospitalizacja jako sygnał bez wywiadu medycznego |
| Po pierwszym dopasowaniu        | Pytania wybranej sprawy: zamieszkanie/sytuacja zagraniczna, liczba dzieci, rejestracje, właściwy dzień ubezpieczenia, okres          | Dochód, pensja, podstawy składek, salda, szczegółowe okresy i dokumenty dopiero dla wybranej oceny    |

Po osobie i etapie zaproponować pierwsze dopasowanie; nie czekać na odpowiedzi wspólne dla wszystkich 19 procedur. Brak/unknown/deferred nie powoduje pętli. Użytkownik może poprosić o dalsze zawężenie. Tematy z landingu to preferencja kolejności, nie fakt ani filtr ukrywający resztę.

Planowanie prowadzi do istniejącego `PlanningPlan`, bez fikcyjnego `pregnant` i indywidualnego prawa. Nieznany etap nie oznacza planowania. Narodziny bez daty zachowują etap i instrukcje, bez obliczonych terminów. Adopcja/piecza kierują do istniejących `careMaternity`, `careParental`, ewentualnie `adoptivePaternity`; nie stosować automatycznie katalogu porodu. Piecza zawodowa zachowuje ograniczenie silnika. Po stracie oferujemy wsparcie i `lossMaternity`, bez gratulacji, standardowej rejestracji porodu i pytań poza wybraną potrzebą. Nieobsługiwane kombinacje pozostają do weryfikacji.

Karta wskazuje: sprawę, osobę/zakres rodzinny, powód pokazania, stan sprawdzenia, braki i jedną główną akcję. Dalej: pytania silnika → wynik → dokumenty/wyjaśnienie/korekta → **Wróć do dopasowanych spraw** → kolejne sprawdzenie. Dane wspólne reużywane; indywidualne wyłącznie dla właściwej osoby, tytułu i okresu.

## 4. Dane i jeden właściciel stanu — P0

### 4.1. Struktura i własność

Docelowo jedna sesja zawiera `family`, `persons`, `assessments`, `interview`, `navigation`, `turns`, `tasks`, `privacy` i liczniki rewizji. Nie dokładamy `InterviewAnswers` kopiujących fakty. `Profile`, `CaseFacts`, discovery i następne pytanie są projekcjami. Zapis wyłącznie przez czyste przejścia `case-session`/`interview-session` wywoływane przez `useParentWorkspace`; bez dwukierunkowych efektów synchronizacji React.

Poniższe typy są kontraktem projektowym, nie gotowym modułem. `PersonId`, `EventId`, `TitleId`, `AssessmentId`, `DocumentId` to różne nominalne identyfikatory lokalne; walidator sprawdza referencje w sesji. `ISODate` oznacza datę kalendarzową zwalidowaną przez istniejące `parseDate`. Rekordy nie potrzebują nazwisk ani PESEL.

```ts
type FactSource =
  | { kind: "answer"; via: "button" | "parser" | "confirmation" }
  | { kind: "pdf"; documentId: DocumentId; page: number }
  | { kind: "calculation"; calculationId: string }
  | { kind: "demo"; label: string };

type ValidTime =
  | { kind: "day"; day: ISODate }
  | { kind: "period"; from: ISODate; through: ISODate }
  | { kind: "undated" };

type Fact<T> =
  | {
      state: "confirmed";
      value: T;
      revision: number;
      source: FactSource;
      validTime: ValidTime;
      basis: "observed" | "assumed";
    }
  | { state: "unknown" | "deferred"; revision: number }
  | {
      state: "stale";
      previous: T;
      revision: number;
      source: FactSource;
      validTime: ValidTime;
      reason: string;
    };

type FactFields<T> = { [K in keyof T]?: Fact<NonNullable<T[K]>> };
type WorkKind = "employee" | "contract" | "business" | "collaborator" | "notWorking" | "other";

type InsuranceTitle = {
  id: TitleId;
  employment?: Fact<Exclude<WorkKind, "notWorking" | "other">>;
  ended?: Fact<ISODate>;
  employmentPercent?: Fact<number>;
  sicknessCoverage: { id: string; fact: Fact<boolean> }[];
};

type Person = {
  id: PersonId;
  roles: ("birthing" | "otherParent" | "guardian")[];
  workSituation?: Fact<"notWorking" | "other">;
  titles: InsuranceTitle[];
  procedureFacts: FactFields<Pick<Profile, "employedSixMonths" | "parentUsesTaxScale">>;
};

type Family = {
  event: { id: EventId; kind?: Fact<"birth" | "adoption" | "foster"> };
  eventFacts: FactFields<
    Pick<
      CaseFacts,
      | "careKind"
      | "courtApplication"
      | "adoptionFinal"
      | "careAccepted"
      | "sameCareAgeLimit"
      | "survivingChildren"
    >
  >;
  stage?: Fact<"planning" | "pregnant" | "born" | "receivingCare">;
  dueDate?: Fact<ISODate>;
  childrenCount?: Fact<number>;
  children: {
    id: string;
    birth?: Fact<ISODate>;
    death?: Fact<ISODate>;
    schoolDeferral?: Fact<boolean>;
    gestationalWeeks?: Fact<number>;
    birthWeightGrams?: Fact<number>;
    hospitalStays?: Fact<HospitalStay[]>;
    facts: FactFields<
      Pick<
        Profile,
        | "hospitalized"
        | "healthRegistered"
        | "healthTitle"
        | "healthRegistrationTrigger"
        | "zaZyciemCertificate"
        | "activeDisabilityCertificate"
      >
    >;
  }[];
  shared: FactFields<
    Pick<Profile, "livesInPoland" | "birthRegistered" | "birthCardDate" | "familyChildDisability">
  >;
};

type AssessmentTarget = {
  eventId: EventId;
  subject: { kind: "family" } | { kind: "person"; personId: PersonId; titleId?: TitleId };
  relatedPersonId?: PersonId;
  childIds: string[];
};
```

MVP: jedno bieżące zdarzenie rodzicielskie na rozmowę, niewielka lista właściwych osób i dzieci tego zdarzenia. Nowe niezależne zdarzenie rozpoczyna osobną rozmowę; bez genealogii. Osoba może mieć kilka tytułów, ale **jedno obliczenie używa jednego wybranego tytułu**. Nie sumujemy praw/kwot automatycznie. Istniejący `maternityTopUp` nadal przyjmuje potwierdzoną sumę po zaliczce; to osobny zakres.

`workSituation` przechowuje brak pracy, inną lub nieznaną sytuację poza rozpoznanym tytułem. Znane konkretne formy są zapisywane w `titles`, bez ich kopii w `workSituation`. Brak pracy nie tworzy fikcyjnego tytułu ubezpieczenia; można jednocześnie zachować historyczny zakończony tytuł. Wybranie znanego tytułu rozstrzyga wcześniejszy ogólny opis dla tego samego okresu, bez usuwania historii.

Rozmówca to kontekst nawigacji: `self` z opcjonalnym `personId` albo `helper`, oraz `activeSubjectId`. Pomagający nie staje się rodzicem. Rola nie jest tożsamością; wybór osoby nie tworzy duplikatu. Ojcostwo dla istniejącej ścieżki ojcowskiego trzeba potwierdzić przy wyborze, nie wywnioskować z `otherParent`.

Brak pola oznacza „nie zebrano”; `unknown` — osoba nie wie; `deferred` — odkłada; `confirmed false` — rzeczywiste „nie”; `stale` — wymaga sprawdzenia po zmianie zależności. „Nie dotyczy” wylicza funkcja stosowalności **dla celu**, nie globalna negatywna odpowiedź. Kandydaci AI/OCR mają osobny status `proposed` w oczekującej propozycji, poza faktami. Potwierdzone założenie przyszłe ma `basis: assumed`; nie staje się historycznym dowodem po porodzie.

### 4.2. Assessments i dane szczegółowe

Assessment ma ID, `target`, rodzaj (`calculator` z `Benefit`, `procedure` z `ProcedureId`, `comparison`), `asOf`, rewizję wejścia, typowany zestaw szczegółów i opcjonalny snapshot. Bez worka `Record<string, unknown>` na dane domenowe. Szczegóły to mapowane `FactFields<Pick<CaseFacts, ...>>` lub `FactFields<Pick<Profile, ...>>`; porównanie ma jawne dane obu osób i warianty `PlanOptions`.

Kontrakt rozróżnianego assessmentu:

```ts
type Assessment = AssessmentBase &
  (
    | {
        kind: "calculator";
        benefit: Benefit;
        details: FactFields<Pick<CaseFacts, CalculationDetailKey>>;
        result?: ResultSnapshot<CaseFacts, BenefitResult>;
      }
    | {
        kind: "procedure";
        procedureId: ProcedureId;
        details: FactFields<Pick<Profile, ProcedureDetailKey>>;
        result?: ResultSnapshot<Profile, ProcedureResult>;
      }
    | {
        kind: "comparison";
        first: AssessmentTarget;
        second: AssessmentTarget;
        options: FactFields<PlanOptions>;
        result?: ResultSnapshot<ComparisonInput, ComparisonResult>;
      }
  );
```

`AssessmentBase` zawiera `id`, `target`, `asOf`, `inputRevision`, cel `calculation/application`, referencje reużywanych szczegółów i zapis lokalnych obliczeń podstawy. `CalculationDetailKey` i `ProcedureDetailKey` to zamknięte unie kluczy przypisanych assessmentowi przez poniższy rejestr, z wyłączeniem pól projekcyjnych. `ComparisonInput` to `{facts: CaseFacts; options: PlanOptions}`, `ComparisonResult` to niepusty typ wyniku istniejącego `compareParentalPlans`. `ResultSnapshot<Input, Result>` ma strukturę opisaną pod tabelą. Nie są to istniejące eksporty. Ocena ma zawsze wskazany podmiot; bez osoby UI może pokazać kategorię/instrukcję i wybór podmiotu, ale nie tworzy pozornej oceny rodzinnej urlopu osobowego.

| Właściciel kanoniczny        | Pola obecnych modeli i zasada                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family / zdarzenie / dziecko | Etap, faktyczny poród i termin osobno, liczba dzieci porodu/przyjęcia, daty dzieci, `careKind`, `courtApplication`, `adoptionFinal`, `careAccepted`, `schoolDeferral`, `careChildren`, `childDeath`, `survivingChildren`, hospitalizacja, masa, tydzień przy porodzie i zaświadczenia dziecka. `sameCareAgeLimit` dotyczy grupy dzieci. Strata jest zdarzeniem szczególnym, nie wymusza niepodanej daty                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Person + Title               | `employment`, `employmentEnded`, `employmentPercent`, chorobowe na oznaczony dzień/okres. Dwa etaty tej samej osoby mają inne ID. „Mam chorobowe” bez dnia nie zasila automatycznie oceny                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Assessment kalkulatora       | Pozostałe `CaseFacts`: `birthStage` (tryb prognozy), `certifiedDueDate`, `from/through/requestedDays`, `exception`, `termination/alternativeEmployment`, dane przejęcia (`transferReason`, `transferEvent`, `transferThrough`, `motherDaysBeforeBirth/AfterBirth`, `motherInsured`, `motherJobPercent`, `motherJobEnds`, `personalCare`), `maternityEnd/supplementCare`, `previousCareDays/Benefit`, `basis/fixedSalary`, `payer/insuredHeadcount`, `debt/debtPaid`, `usedDays/otherParentDays/parts`, `soleParent/reserved`, `averagedRequest/parentalInFirstYear/standardRate`, `paternityUsed`, `workPercent/extensionWorkPercent`, wyczekiwanie/chorobowe (`qualifying`, `qualifyingDays`, `waitingException`, `illnessStart`, `postInsuranceExcluded`, `lateOnsetCode`, `sickPayDaysRemaining`, `pregnancyProof`, `sickDaysUsed`, `employerSickPayEnded`), rehabilitacyjne (`sickPeriodExhausted`, `rehabMedical`, `rehabExcluded`, `rehabUsed`, `rehabSickBasis`, `rehabStart`), `combinedHospitalEvidence/documentDate`. `insured` jest projekcją osoby/tytułu dla dnia silnika, `careCertificate` projekcją zaświadczenia dziecka |
| Assessment procedury         | Pozostałe pola `Profile`: dochód rodziny w okresie oceny, opieka medyczna osoby rodzącej od 10. tygodnia do porodu, zwolnienie/dokumentowanie ciąży, wyczekiwanie, pobieranie zasiłku w rodzinie, wariant Aktywnego Rodzica i miesiąc, żłobek/opłata/rejestr, aktywność/procenty składek każdej osoby, samotne wychowanie według definicji programu, potrzeba opieki, daty urlopów i płatnik. Jawny podmiot/okres; reużycie tylko przy identycznym znaczeniu i zakresie                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Assessment porównania        | Potwierdzone parametry `PlanOptions`, referencje dwóch osób/tytułów. Symulowane tygodnie nie stają się wykorzystanym urlopem                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Skróty w tabeli oznaczają istniejące klucze, nie nowe pola. Implementacja wymaga jawnego rejestru własności **każdego** `keyof Profile` i `FactKey` (`satisfies` + test kompletności), również pól projekcyjnych. Wspólny fakt ma jedno miejsce zapisu; assessment przechowuje referencję, nie drugą mutowalną wartość. Szczegół z innego assessmentu reużywa się przez jawną referencję i potwierdzenie zakresu, nie kopiowanie „ostatniej podstawy”. Referencje nie mogą tworzyć cykli. Zaświadczenia i zdrowotne są przypisane do dziecka; przy wielu dzieciach projekcja nie rozciąga odpowiedzi jednego na wszystkie. `birthRegistered/birthCardDate` w MVP dotyczą wybranego zdarzenia; jeśli dokumenty rozróżniają dzieci, przechowywać je w rekordzie dziecka i pytać o cel, zamiast agregować domyślnie.

Wynik nie oznacza wykorzystania urlopu. MVP zachowuje potwierdzone liczniki `usedDays/otherParentDays/parts/paternityUsed`, przypisane do osoby, zdarzenia i rodzaju okresu; powiązane oceny czytają ten sam rekord. Nie budować pełnego kalendarza rozliczeń. Zmiana wspólnej puli unieważnia powiązane wyniki obu osób, ale nie zmienia ich finansów.

`standardResidence` pozostaje odpowiedzią assessmentu o wskazanym wnioskodawcy i sytuacji rodziny, bo obecne pytanie łączy obywatelstwo z zakresem krajowym. Nie dziedziczyć obywatelstwa po partnerze. `livesInPoland` można reużyć rodzinnie tylko po potwierdzeniu wspólnego zamieszkania z dzieckiem; przy różnej sytuacji osób zapisać odpowiedź we właściwej ocenie i wskazać zakres zagraniczny do weryfikacji. Nie budować przy tej zmianie silnika koordynacji międzynarodowej.

Snapshot zawiera wynik `BenefitResult`/`ProcedureResult`/`compareParentalPlans`, zamrożone wejście, zależności z rewizjami, `asOf`, wersję katalogu albo identyfikator wersji kalkulatora oraz `DemoRate`, stan `current/stale` i lokalne uzasadnienie. `BenefitResult` dziś nie ma audytu wersji — dodać obudowę assessmentu, nie przypisywać mu istniejącego `ProcedureResult.audit`. Tylko aktualny snapshot służy akcjom/eksportowi. Jeden bieżący snapshot na assessment; historyczne turny mogą prezentować wcześniejsze.

### 4.3. Adaptery bez niejawnych utożsamień

Planowane `interview-profile.ts`: `toProcedureProfile(session, procedureId, target, asOf)`, `toCaseFacts(session, assessmentId)`, `applyConfirmedFacts(session, command)`. Projekcje zwracają wartość, pominięte pola z przyczynami i zależności, także nieobecne wymagane pola. Bez domyślnych odpowiedzi. Import z formularza/PDF-u to zapis kanonicznych faktów, nie odwrotne kopiowanie całego profilu.

| Pole docelowe                    | Dopuszczalne źródło i ograniczenie                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Profile.stage`, daty            | Rzeczywiste `pregnant/born` zdarzenia porodu. Planowanie → `PlanningPlan`; przyjęcie/nieustalona strata → ścieżka szczególna, bez fikcyjnego profilu. Termin ≠ urodzenie. `birthStage` kalkulatora wybiera potwierdzony tryb prognozy/porodu                                                                                                                                                                                             |
| `employment`                     | W kalkulatorze osoba i tytuł assessmentu. W procedurze osoba uprawniona według rejestru; ciąża/macierzyński po porodzie wymagają osoby rodzącej. `employee/contract/business` dokładnie. `collaborator` nie mieści się w `Profile.Employment`: pominąć ze wskazaniem ograniczenia, nie udawać działalności. `notWorking`, `other`, unknown i brak nie mapują się na obsługiwany typ pracy; braku pracy nie sprowadzać do `Profile.other` |
| `otherParentEmployment`          | Dla `PATERNITY_LEAVE` jawnie wskazany ojciec, także gdy jest rozmówcą. Nie „drugi element tablicy”. Dla `other*` aktywności osoba wskazana w parze danej oceny                                                                                                                                                                                                                                                                           |
| `Profile.sicknessInsurance`      | Chorobowe osoby/tytułu potwierdzone na `asOf`, bo katalog mówi „teraz”. Nie `insured` z dowolnego historycznego kalkulatora                                                                                                                                                                                                                                                                                                              |
| `Profile.insuredAtBirth`         | Chorobowe osoby rodzącej i właściwego tytułu na faktyczny dzień porodu. Nie stan dzisiejszy ani przyszłe założenie                                                                                                                                                                                                                                                                                                                       |
| `CaseFacts.insured`              | Chorobowe osoby/tytułu na **`coverageDay` wyznaczony przez `assessBenefit`**. Najpierw projekcja bez `insured` i odczyt dnia; jeśli silnik jeszcze go nie zwraca, uzupełnić wcześniejsze pola. Nie kopiować algorytmu dnia do adaptera. Dołączyć zgodną deklarację, ponownie ocenić i sprawdzić dzień. Przyszłość tylko jako jawne założenie w prognozie                                                                                 |
| Inne ubezpieczenia               | `healthTitle` i zdrowotne dziecka ≠ chorobowe. `motherInsured` w przejęciu dotyczy osoby rodzącej w zakresie pytania kalkulatora, nie ojca. Niejasnego zakresu nie importować automatycznie                                                                                                                                                                                                                                              |
| Podstawa, pensja, saldo, płatnik | Osoba + tytuł + właściwy okres/dzień + rodzaj wartości. `basis/fixedSalary/debt` w groszach; dochód/opłata `Profile` w złotych, stawka wyniku w punktach bazowych. Podstawa składek ≠ zasiłku; bez ponownego potrącania. Reużycie dopiero po potwierdzeniu zakresu. Formularze płac/składek zachowują lokalne wejście i rezultat obliczenia podstawy, nie tylko liczbę                                                                   |
| Agregaty rodziny                 | `receivesMaternity=false` wymaga potwierdzenia całego wymaganego zakresu rodziny/okresu; brak prawa jednej osoby nie dowodzi, że nikt nie pobiera. Dochód ma okres i definicję świadczeń rodzinnych; nie sumować przypadkowych pensji                                                                                                                                                                                                    |
| Hospitalizacja                   | Z dziecka do `hospitalStays` tylko potwierdzone zakończone przedziały. Z/do `hospitalFrom/Through/hospitalRanges` przez istniejące parsery/walidację. Nie spłaszczać rozłącznych pobytów ani mieszać dzieci; ograniczenia wielorodu pozostają `review`                                                                                                                                                                                   |

Migracja nie ustala osoby ze starego płaskiego `CaseFacts`. Dotychczasowy kalkulator może działać na rekordzie „Osoba sprawdzana”; role i drugą osobę ustalić przed discovery tego wymagającym. Nie dopisywać roli osoby rodzącej tylko przez wybór macierzyńskiego. Zmiana osoby otwiera inny assessment, nie zmienia właściciela poprzednich faktów.

Dla `notWorking/other` nie zapętlać pytania kalkulatora ograniczonego do czterech tytułów: zaoferować wskazanie właściwego obecnego lub zakończonego tytułu albo oficjalną instrukcję i powrót do innych kart. Znane ograniczenie wejścia nie jest odmową wszystkich uprawnień. Wiele deklaracji chorobowego na ten sam dzień/tytuł rozstrzyga konflikt; nie wygrywa automatycznie ostatnia w tablicy. Tylko `observed` o zgodnym zakresie zasila ocenę rzeczywistą; `assumed` wyłącznie oznaczoną prognozę.

### 4.4. Synchronizacja i unieważnianie

Potwierdzony zapis waliduje patch, cel i bazową rewizję, ustala konflikty, zapisuje zaakceptowane pola atomowo, wyznacza zależności, unieważnia wyniki i odświeża kursor. Idempotentny zapis tej samej wartości/zakresu nie usuwa zależności. Anulowanie edycji nie zmienia faktów. Poprzednią wartość oznaczamy `stale`, bez użycia w projekcji; zmiana gałęzi nie kasuje dowodów.

| Zmiana                                                   | Co sprawdzić ponownie / przeliczyć                                                                                                                      | Co pozostaje                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Zatrudnienie/tytuł A, korekta tego samego okresu         | Powiązane ubezpieczenie A, podstawa, saldo, płatnik/liczba ubezpieczonych, wyczekiwanie i wyniki tego tytułu. Nowy tytuł ma nowe ID                     | Fakty B, dziecka i niezależne okresy A. Powiązane porównanie może być stale bez zmiany danych B     |
| Dzień ubezpieczenia, `from`, koniec zatrudnienia         | Dobór coverage, saldo/podstawa o niezgodnym zakresie, wynik i dokumenty zależne od okresu                                                               | Dowody dla innych dni; nie przenosić ich na nowy dzień                                              |
| Termin → poród lub korekta urodzenia                     | Oceny wieku/okresów/terminów dziecka, prognozy, dobór chorobowego/salda na stary dzień, porównania. Założenia przyszłe stale nawet przy tej samej dacie | Praca obu osób i historyczne dowody. Termin zostaje w historii, nie jako aktywna alternatywa porodu |
| Liczba dzieci, przyjęcie, daty sądowe, strata            | Wymiary/granice assessmentów, spójność listy dzieci i liczby; bez tworzenia brakujących dat                                                             | Niezależne finanse i dane niezmienionych dzieci                                                     |
| Hospitalizacja / masa / tydzień / zaświadczenie          | Uzupełniający i zależne okresy/pule; bez zmiany chorobowego innej osoby                                                                                 | Niezależne sprawy i dane osoby                                                                      |
| Liczniki wykorzystania / stawka / praca na rodzicielskim | Wynik tej sprawy; przy wspólnej puli również zależne wyniki drugiej osoby i porównanie                                                                  | Podstawa i prawo niezależnych spraw                                                                 |
| Zmiana osoby / kolejne świadczenie                       | Nawigacja, token zapytań, wybór assessmentu i projekcji                                                                                                 | Żadne fakty/szczegóły poprzedniej sprawy nie są usuwane ani przepisywane                            |
| `asOf`, reguły, `DemoRate`                               | Oceny, kwoty, dokumenty, ranking terminów używające daty/wersji                                                                                         | Fakty z własnym czasem; demo nie staje się oficjalną regułą                                         |
| Potwierdzenie PDF / konfliktu                            | Wyłącznie zaakceptowane pola i zależności, jak przy ręcznej korekcie                                                                                    | Późniejsze odpowiedzi i dane innych osób bez jawnej decyzji                                         |

Rejestr zależności używa typowanych referencji (własność, klucz, ID osoby/tytułu/zdarzenia/assessmentu), nie dowolnych ścieżek tekstowych. Snapshot uwzględnia też brak pola, które można później uzupełnić. Pierwsza wersja może konserwatywnie unieważnić wszystkie assessmenty właściwej osoby/zdarzenia, lecz nie czyści niezależnych faktów ani danych B. `saveFacts` jest wzorcem istniejących zależności, nie kompletną specyfikacją rodziny. Zmiana etapu sprawdza również zakres potwierdzenia liczby dzieci i innych założeń przyszłych; nie zamienia oczekiwanej liczby dzieci automatycznie w potwierdzony wynik porodu.

## 5. Przejścia, kursor i naturalna rozmowa

### 5.1. Stan i kontrakty przejść

`interview` przechowuje tryb (`idle/asking/paused/finished`), aktywne `QuestionRef`, listę odwiedzonych pytań do korekty i cel powrotu. `QuestionRef` to unia: pytanie wspólne z `EventId`, osobowe z `PersonId/TitleId`, procedury z `AssessmentId/Field`, kalkulatora z `AssessmentId/FactKey`. Każda postać ma ID pytania i rewizję promptu. `navigation` wskazuje widok (`start/interview/discovery/assessment/result`) i aktywny assessment. Pomoc jest nakładką z `returnTo`, nie nowym magazynem danych. Odpowiedzi są tylko w rekordach sekcji 4.

Planowane czyste funkcje: `startInterview`, `getNextInterviewQuestion`, `answerInterviewQuestion`, `deferInterviewQuestion`, `reviseInterviewAnswer`, `finishInterview`, `resumeInterview`; zapis wszystkich ścieżek przez `applyConfirmedFacts`. Mogą być operacjami jednego reduktora, bez biblioteki stanu ani drugiego hooka.

Bank `interview.ts` ma zamknięte ID pytań startowych (`subject`, `stage`, `employment`, `timing`, `need`) i dla każdego: docelowy zakres, schemat odpowiedzi, stosowalność, deterministyczną kolejność, lokalny parser, tekst „dlaczego”, prostsze objaśnienie i zasadę odłożenia. `timing` rozróżnia datę i orientacyjny etap, nie rzutuje trymestru na datę. Pytania katalogowe zachowują `Field`, kalkulatorowe `FactKey`; nie mieszać tych trzech rejestrów w otwarty `string`. Odpowiedź `subject` zmienia kontekst podmiotu, nie pole ubezpieczenia lub pracy.

| Polecenie                       | Warunek i skutek                                                                                  | Cel powrotu                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Start / opis sytuacji           | Ustalenie podmiotu/etapu; kandydaci czekają na potwierdzenie, nie otwierają dowolnego kalkulatora | Wywiad lub wczesne discovery          |
| Odpowiedź / korekta             | Zgodny `QuestionRef`, typ, zakres i rewizja; atomowy zapis z unieważnieniem                       | Następne pytanie lub karty            |
| Cofnij                          | Edycja ostatniej odpowiedzi właściwego zakresu; bez usuwania przed zapisem                        | Poprzedni tryb i przeliczony kursor   |
| Pomoc / niezrozumienie          | Lokalna odpowiedź albo dozwolony kanał AI; kursor nadal aktywny                                   | To samo pytanie                       |
| Pokaż możliwe sprawy / przerwij | Fakty zostają, wywiad `paused`, braki jawne                                                       | Discovery i możliwość wznowienia      |
| Otwórz kartę                    | Walidacja akcji, osoby, zdarzenia i rewizji; istniejący assessment celu lub nowy rekord           | Zapamiętane discovery z jego zakresem |
| Zakończ / wróć do kart          | Snapshot, pytanie i szczegóły zostają; inna karta otwiera własne dane                             | Discovery, potem kolejny kalkulator   |
| Zmień osobę                     | Jednoznaczny wybór; bez transferu faktów. Przy „chodziło o partnera” pokazać zakres korekty       | Poprzednia potrzeba z nowym podmiotem |

Następne pytanie: aktywny ważny cel; dla kalkulatora `getAssessment`/`assessBenefit`, dla procedury jej `missingFields` oraz potrzebne `deadlines[].missingField`; poza sprawą krótka przygotowana kolejność. Pomijać zgodne potwierdzone dane i pola niestosowalne. `unknown/deferred` wracają po jawnym wznowieniu lub wyjaśnieniu, że wybranej dokładnej oceny nie można bez nich ukończyć. Nie sumować braków 19 procedur w ankietę. Pytanie nie wynika wyłącznie z `turns.findLast`; stare kontrolki sprawdzają prompt ID i rewizję.

### 5.2. Kolejność interpretacji tekstu

1. Przyciski i lokalne komendy nawigacji/pomocy przed parserem wartości. Zachować obecne ścieżki wsparcia i pilnych wypowiedzi; nie traktować ich jako odpowiedzi o etap ani nie rozszerzać porad medycznych.
2. Lokalny parser może zapisać bez dodatkowej karty **jedną jednoznaczną odpowiedź na aktywne pytanie**, przy ustalonej osobie/zakresie. Musi obejmować całą wypowiedź, nie wycinać „etat” z „partner na etacie”. Daty bez roku zgodnie z istniejącym skrótem planowania okresu tylko w tym jawnym kontekście kalkulatora, nie dla daty urodzenia.
3. Wielopolowy opis, zmiana osoby, przypuszczenie, niejasny zakres negacji lub konflikt trafiają do propozycji. Lokalny parser narracyjny może ją przygotować; AI dopiero poza jego pewnym zakresem. Oba wyniki przechodzą tę samą walidację i potwierdzanie.
4. Potwierdzenie pokazuje pola, osobę, dzień/okres i różnice wobec bieżących danych. Można zaakceptować wybrane pola, poprawić lub odrzucić całość. Wpisanie zdania i odpowiedź modelu nie zatwierdzają patcha wielopolowego.

Przykład „Jestem w szóstym miesiącu ciąży, pracuję na zleceniu, ale chyba nie mam chorobowego”: kandydaci `stage=pregnant` i `employment=contract` jako stwierdzenia; orientacyjny miesiąc tylko do rozmowy, bez daty; chorobowe jako przypuszczenie, nie `false`. Po potwierdzeniu dwóch pól pominąć etap i pracę. Przy chorobowym zapytać o ustalenie lub pozwolić wybrać `unknown`, bez zbiorczego zatwierdzenia przypuszczenia jako dowodu. Brak osoby/tytułu/dnia nadal uniemożliwia użycie go w konkretnej ocenie.

| Wypowiedź                                             | Działanie                                                                                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Nie wiem”                                            | `unknown` aktywnego pola, lokalna wskazówka, możliwość kart; nie „nie”                                                                                                              |
| „Nie rozumiem pytania” / „Dlaczego mnie o to pytasz?” | Objaśnienie banku pytań i prostsza wersja; pytanie pozostaje aktywne                                                                                                                |
| „Wróć do poprzedniego”                                | Edycja z anulowaniem, bez odtwarzania stanu z historii wiadomości                                                                                                                   |
| „Chodziło mi o mojego partnera”                       | Wybór osoby; propozycja korekty wskazanej odpowiedzi, nie transfer profilu. Jeśli poprzedni zapis miał błędnego właściciela, jawnie wycofać u A i zatwierdzić u B jednym poleceniem |
| „Jednak pracuję na etacie”                            | Propozycja korekty pracy aktywnej osoby i tytułu/okresu; po potwierdzeniu unieważnienie zależności                                                                                  |
| „Chcę sprawdzić coś innego”                           | Wybór tematu/karty, zachowanie poprzedniej sprawy; model nie zmienia arbitralnie benefit                                                                                            |
| „Pokaż mi już możliwe świadczenia”                    | Natychmiast discovery z brakami, bez obowiązku dokończenia wywiadu                                                                                                                  |

### 5.3. Asynchroniczność

Każda operacja AI/OCR/pomocy ma token `{requestId, sessionId, contextRevision, assessmentId?, subjectId?, promptId?, documentId?}`. `contextRevision` rośnie po zmianie faktów, celu, osoby, promptu, prywatności i dezaktywacji rozmowy. Dopisanie pomocy nie musi zmieniać rewizji faktów. Odpowiedź przyjmowana tylko przy zgodności tokenu z nadal oczekującą operacją; sam `AbortController` nie wystarcza.

Hook dostaje aktywność z `CaseConversation`; przełączenie rozmowy anuluje żądanie i podnosi generację również w zamontowanym komponencie. OCR może pozostawić lokalny odczyt do ponownego przejrzenia, lecz kandydaci po zmianie kontekstu nie zapisują faktów ani nie przełączają sprawy. Ich potwierdzenie wymaga ponownego porównania z aktualnymi wartościami. Dodanie własnego PDF-u natychmiast anuluje swobodne AI. Izolacja sesji dotyczy też audio i podglądu.

## 6. Discovery procedur i jawne akcje

Planowane `src/engine/discover-procedures.ts` i `src/data/discovery.ts` są warstwą projekcji oraz prezentacji. Bez progów dochodu, nowych okresów czy własnych reguł prawa.

`discoverProcedures(session, asOf)`:

1. Ustala podmioty według rejestru: osoba rodząca, właściwy rodzic/opiekun lub zdarzenie/rodzina. Dla osobowych urlopów może zwrócić osobne oceny A/B; rodzinne karty nie dublują wypłat. Nieznany podmiot daje akcję wskazania osoby.
2. Buduje `Profile` dla każdego celu i wywołuje istniejące `evaluateProcedure`. Zwraca oryginalny `ProcedureResult`, braki adaptera i ograniczenia zakresu. Planowanie i ścieżki szczególne nie udają kwalifikacji standardowego katalogu.
3. Zachowuje `generatePlan` dla obecnych odbiorców. Przy integracji wydzielić w `plan.ts` składanie planu z ocenionych wyników; `generatePlan(profile,asOf)` nadal ocenia tym samym silnikiem i wywołuje wspólny składacz. `PlanReport/PlanDetails` nowej sesji dostają wyniki z projekcjami osób, zamiast ponownie oceniać wszystko jednym profilem. Zachować stary interfejs.
4. Przygotowuje kartę z osobnym `evaluation` i `presentation`: flagi `future/needs-input/rule-review/unsupported-scope/stale/completed` oraz grupa priorytetu. `possible` może oznaczać przyszłość, `procedure.review`, datę poza katalogiem lub niepewność reguły. `missingFields` kwalifikacji i brak terminu pozostają odrębne.
5. Sortuje/grupuje według poniższego porządku; wybiera akcję rejestru. Nie zmienia statusu silnika na podstawie preferencji, heurystyki trafności lub wyniku innego kalkulatora.

Priorytety prezentacji: **(1)** otwarta formalność wymagająca działania teraz z potwierdzonego stanu i instrukcji/obliczonego okna, **(2)** najbliższy policzony ważny termin, **(3)** prawdopodobnie istotne sprawy sytuacji, **(4)** przyszłe możliwości, **(5)** pozostałe do sprawdzenia. W grupach stabilnie: data, zgodność z wybraną potrzebą, kolejność katalogu, ID osoby. „Najbliższy” nie tworzy progu kwalifikacji. Przeterminowany termin z konsekwencją pokazuje instrukcję, nie bezwarunkową utratę prawa. Bez daty brak pozornego deadline'u.

Domyślnie do 4 najtrafniejszych kart; urlop i odpowiadający zasiłek można grupować wizualnie, zachowując osobne oceny/akcje. Wszystkie znane pilne otwarte formalności widoczne także ponad limit. „Później” i „Pozostałe sprawy” mają licznik/rozwinięcie; istotna opcja z brakami nie znika przez niewiedzę. Bez etapu/osoby wybór kontekstu i kilka kategorii, nie 19 kart `missing-data`. `not-relevant` dostępne w „Dlaczego poza listą”; wyraźnie zamówiona sprawa pokazuje uzasadnienie odmowy/ograniczenia. Nie ukrywać zasiłku ojcowskiego zleceniobiorcy, bo katalogowy **urlop** wymaga etatu.

### Rejestr wszystkich 19 procedur

Docelowy `ProcedureId` to zamknięta unia poniższych ID; dziś `Procedure.id` jest `string`, więc unia jeszcze nie istnieje. `DiscoveryDefinition` zawiera `subjectPolicy`, `scope`, główną i dozwolone dodatkowe akcje. Typ akcji:

```ts
type DiscoveryAction =
  | { kind: "calculator"; benefit: Benefit }
  | { kind: "procedure"; procedureId: ProcedureId; view: "questions" | "details" }
  | { kind: "formalities"; procedureId: ProcedureId }
  | { kind: "official"; sourceId: SourceId };
```

`SourceId` pochodzi z istniejącego rejestru; URL nigdy od modelu. Rejestr `satisfies Record<ProcedureId, DiscoveryDefinition>` i test porównania ID z katalogiem gwarantują kompletność. `questions` to **planowana** obsługa istniejącego banku `data/questions.ts`. `details/formalities` korzystają z `PlanReport/PlanDetails` z dodanym wyborem procedury, nie nieistniejącego panelu szczegółów czatu. Przy brakach `procedure` zaczyna pytania, potem pokazuje instrukcję/dokumenty/oficjalne źródła. Sama instrukcja dostępna bez wypełnienia wszystkiego, również przy ograniczeniu zakresu.

| ID procedury                      | Podmiot / standardowy zakres                   | Główna akcja → dostępne dalej                                                                            |
| --------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `EMPLOYMENT_PREGNANCY_PROTECTION` | Osoba w ciąży                                  | `procedure(details)` → dokumenty/źródła; bez kalkulatora ochrony umowy                                   |
| `SICKNESS_PREGNANCY`              | Osoba w ciąży, tytuł                           | `calculator(sickness)`                                                                                   |
| `BIRTH_REGISTRATION`              | Zdarzenie porodu                               | `procedure(questions)` → data **karty urodzenia**, status, USC                                           |
| `CHILD_HEALTH_INSURANCE`          | Dziecko + wskazana osoba zgłaszająca           | `procedure(questions)` → aktualny tytuł zdrowotny, zdarzenie terminu, ZCNA/instrukcja                    |
| `MATERNITY_LEAVE`                 | Osoba rodząca, urlop pracowniczy               | `procedure(details)` → `calculator(maternity)` osobno jako zasiłek                                       |
| `MATERNITY_ALLOWANCE`             | Osoba rodząca, tytuł                           | `calculator(maternity)`                                                                                  |
| `PARENTAL_LEAVE`                  | Wskazany rodzic, urlop pracowniczy             | `procedure(questions)` → daty/dokumenty; `calculator(parental)` i porównanie osobno                      |
| `SUPPLEMENTARY_MATERNITY_LEAVE`   | Uprawniona osoba, dane dziecka                 | `calculator(supplement)`; warunek etatu katalogowego urlopu nie staje się warunkiem całego zasiłku       |
| `CHILD_800_PLUS`                  | Rodzina/dziecko, wskazany wnioskodawca         | `procedure(questions)` → terminy/dokumenty/oficjalny kanał                                               |
| `PARENTAL_BENEFIT`                | Rodzina i opiekujący się wnioskodawca          | `procedure(questions)` → instrukcja gminy; **nie** `parental`                                            |
| `BIRTH_GRANT_BECIKOWE`            | Rodzina/zdarzenie, opieka osoby rodzącej       | `procedure(questions)` → dokumenty/instrukcja gminy                                                      |
| `ACTIVE_PARENT_WORK`              | Dziecko, okres i właściwa para osób            | `procedure(questions)` → aktywność obu osób, instrukcja                                                  |
| `ACTIVE_PARENT_NURSERY`           | Dziecko, okres opieki                          | `procedure(questions)` → opłata/rejestr/daty, instrukcja                                                 |
| `ACTIVE_PARENT_HOME`              | Dziecko, okres świadczenia                     | `procedure(questions)` → RKO/wybrany wariant, instrukcja                                                 |
| `PATERNITY_LEAVE`                 | Wskazany ojciec, urlop pracowniczy po porodzie | `procedure(questions)` → dokumenty urlopu; `calculator(paternity)` jako zasiłek                          |
| `CARE_ALLOWANCE`                  | Osoba/tytuł, potrzeba opieki                   | `procedure(questions)` → zakres `review`, Z-15/oficjalna instrukcja; brak kalkulatora kwoty opiekuńczego |
| `CHILDCARE_LEAVE`                 | Wskazany rodzic/opiekun                        | `procedure(questions)` → staż/data/dokumenty; bez kalkulatora pieniędzy                                  |
| `FAMILY_ALLOWANCE`                | Rodzina, okres dochodowy                       | `procedure(questions)` → instrukcja gminy; bez liczenia „złotówka za złotówkę”                           |
| `CHILD_TAX_RELIEF`                | Osoba i rok podatkowy                          | `procedure(questions)` → zakres `review`, PIT/O/oficjalna instrukcja; bez kalkulatora PIT                |

Akcje wyłącznie przez rejestr, z celem i rewizją. Gdzie katalog nie rozstrzyga przyjęcia/straty, pokazać ograniczenie i istniejącą ścieżkę szczególną/instrukcję, nie „warunki spełnione” z niewłaściwego profilu.

Poza 19 procedurami zachować dostępne: `adoptivePaternity`, `rehabilitation`, `pregnancyAfterEmployment`, `maternityTransfer`, `careMaternity`, `careParental`, `lossMaternity`; także zasiłki za okres `parental/paternity/supplement` niezależnie od statusu pracowniczego urlopu. Zachować `compareParentalPlans`, `maternityTopUp`, formularze podstawy, panel reguł i symulacje. Sygnał sytuacji może proponować narzędzie, nie tworzy nowej procedury prawnej.

## 7. Rola AI i minimalna rozbudowa kontraktów

### `/api/parent-intent`

Rozbudować istniejące schematy, `caseActionFromIntent`, builder kontekstu i routing hooka. Zachować modele/fallback i skróty; bez nowego endpointu, tool-loop ani agent SDK. Migracja przez jawne `version:2`; stary format obsługiwany do migracji wywołań/testów, bez dwóch niezależnych interpretatorów.

Żądanie v2: ograniczone `messages` jak dziś i `context` z `mode` (`idle/interview/discovery/assessment/result`), rodzajem pytania i dozwolonym ID, celem, `Benefit/ProcedureId`, jeśli istnieje, anonimowymi aliasami osób (`subject/related`), listą potwierdzonych **kluczy** i braków. Techniczne ID sesji/rewizje pozostają w lokalnym tokenie; model nie otrzymuje Family/Persons ani kwot wyniku. „Partner” może wymagać wyboru aliasu; model nie tworzy osoby i nie wybiera dowolnego ID.

Kontekst może wskazać alias wybranego tytułu; kandydat dotyczący ubezpieczenia/pracy musi wskazać ten alias lub pozostać nierozstrzygnięty. Dwa tytuły tego samego typu nie są jednym tytułem. Nawigacja i potwierdzenie sprawdzają zgodność akcji z bieżącym trybem/celem. W v2 dawne `assess.facts` również przechodzi przez propozycję z zakresem; nie pozostawiać bocznej drogi zapisu płaskiego patcha bez osoby.

Poza dotychczasowymi akcjami odpowiedź dodaje:

- `startInterview` — wejście do przygotowanej ścieżki;
- `interpret` z jedną intencją z zamkniętego zbioru (`answer/correct/switchSubject/back/pause/resume/showMatches/changeGoal/explainQuestion/explainResult/documents/generalHelp`) i maksymalnie 12 kandydatami;
- kandydat: rozróżniany `scope` (family/person/assessment), klucz właściwego rejestru, typowana wartość, alias osoby, jawny dzień/okres, jeśli podano, oraz `certainty: stated|tentative`. Przypuszczenie nie jest faktem ani pewnością numeryczną.

Model może nadal używać małych tablic `{key,value}` dla uproszczenia gramatyki; **konwersja na kontrakt aplikacji jest granicą zaufania**. Serwer i klient walidują klucz, wartość, jednostkę, alias, cel, zakres, daty i zależności. Nieprzypisane/sprzeczne dane wymagają doprecyzowania, błędne nie trafiają do patcha. Nieznane akcje/klucze i nadmiar payloadu odrzucane/ograniczane przed użyciem; bez dopisywania dat i bez sterowania kursorem przez model.

W zwykłym trybie swobodny tekst może zawierać dane podane przez użytkownika, również kilka faktów. Opis prywatności ma to wyjaśniać. Historię ograniczyć do bieżącej potrzeby; po zmianie osoby/kalkulatora nie doklejać starych wypowiedzi jako aktualnych danych. Krótkie dopytanie wyjaśnia kontekst aktywnego pytania i ostatniej ogólnej pomocy. Nie przesyłać potwierdzonych wartości przez wygenerowane automatycznie podsumowania historii.

### `/api/guide-help`

Zachować `HelpAnswer`, źródła, lokalne FAQ i podpis odczytu. Dzisiejsze `context?: QuestionId` dotyczy starego przewodnika, nie nowych ID. Rozszerzyć żądanie o ścisłą unię:

- `kind: question`: tekst, kontekst `guide/interview/procedure` z ID odpowiedniego rejestru, opcjonalne dozwolone `previousSourceIds`; tylko zwykły tryb;
- `kind: topic`: wyłącznie `topicId` z zamkniętego rejestru, bez tekstu, historii, kontekstu sprawy i dodatkowych pól. Serwer tworzy ogólne pytanie i wybiera źródła. Każdy temat ma lokalny fallback.

Tematy: np. urlop a zasiłek, chorobowe, znaczenie podstawy, ogólne dokumenty procedury. Temat nie jest serializacją użytkownika. Nie wykonywać parent-intent przed kliknięciem znanego tematu. Odpowiedź ze źródłami z dozwolonej listy; poprawny JSON nie dowodzi zgodności treści. Bez pokrycia lokalny fallback/ograniczenie, bez indywidualnej kwalifikacji.

### Pomoc po wyniku zamiast `checkedAssessment`

| Potrzeba                                 | Źródło / działanie                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| „Dlaczego taka kwota?”, „Pokaż podstawę” | Lokalny model wyjaśnienia snapshotu: powody, coverageDay, wejście podstawy, stawka, części okresów, dni, kwota dzienna, wydłużenie, płatnik, dokumenty/źródła. Rozwinąć „Jak to ustaliłam” w `ParentResult`; bez liczenia w AI |
| „Jakie dokumenty?”, „Co teraz?”          | `BenefitResult.documents` i właściwe instrukcje, z osobą/okresem; nie lista innej sprawy                                                                                                                                       |
| Zmiana danych                            | Edycja → unieważnienie → ten sam silnik; lokalne wskazanie, co zmieniło wynik                                                                                                                                                  |
| Kolejne świadczenie / powrót do kart     | Zachowanie assessmentu i wspólnych faktów, bez ponownej ankiety                                                                                                                                                                |
| Ogólne pojęcia/pytanie                   | Lokalne FAQ lub dozwolony `guide-help`; zachowany kursor, jeśli były braki                                                                                                                                                     |

Usunąć `if (checkedAssessment) return undefined` w pomocy i zastępowanie każdego `reply` ponownym wynikiem. Zastępuje je powyższy routing **z walidacją**, nie swobodny tekst modelu o indywidualnej kwocie. `eligible` z brakiem podstawy nadal pozwala uzupełniać i pytać. MVP nie wysyła indywidualnego wyniku do modelu: AI wyjaśnia ogólne pojęcie, lokalny widok dokładne uzasadnienie. Bezpieczne streszczanie indywidualnego wyniku do AI można odłożyć.

W kontekście oceny/wyniku `reply` nie jest kanałem uzasadnienia prawa/kwoty: wyjaśnienie i doprecyzowanie prowadzić przez typowaną intencję oraz lokalny tekst albo katalogową pomoc. Zachować krótkie odpowiedzi konwersacyjne poza oceną, lecz nie renderować ich jako części wyniku. Sam prompt „nie zmieniaj kwoty” nie zabezpiecza UI przed tekstem sprzecznym z kalkulatorem.

## 8. PDF, pochodzenie i prywatność

Lokalny OCR, zakres stron, podgląd, wybór jednego z wielu wniosków, ręczne uzupełnienie i porównanie rozstrzygnięcia zostają. Załącznik otrzymuje `DocumentId`, powiązanie z sesją i wybrany cel importu; nazwa pliku jest lokalną etykietą. Osoba/tytuł ustalane przy potwierdzeniu, nie przez automatyczną identyfikację ze skanu. `Fact.source` przechowuje pochodzenie, właściciel wynika z miejsca zapisu, czas z `validTime`. Bez przypisania osoby/okresu nie łączyć danych różnych wniosków.

Kandydaci pozostają propozycjami. Przy konflikcie pokazać bieżącą wartość i propozycję, osobę, zakres, źródło/stronę; domyślnie zachować bieżącą. Późniejszy import nie oznacza nowszego stanu. Po zmianie rewizji porównać ponownie. Zgodna liczba nie dowodzi zgodności osoby/okresu. Dowód chorobowego z innego dnia pozostaje dowodem tego dnia, ale nie zasila bieżącego `insured`.

Końcowa decyzja o badanym zasiłku i adnotacja o wypłacie służą porównaniu po obliczeniu, nie kwalifikacji/kwocie. `validateDocumentRead` odrzuca kandydatów z `decision`; zachować zabezpieczenie. Odrębne dowody podlegania ubezpieczeniu obsługuje lokalny parser i potwierdzenie zakresu, nie sentencja decyzji zasiłkowej.

Docelowe kanały:

1. **Zwykła rozmowa bez własnego PDF-u:** tekst i ograniczona historia mogą trafiać do parent-intent/guide-help. Przyciski, silniki i zapis faktów nie wymagają wysyłki. Maskowanie nazwisk/PESEL nie zapewnia niezawodnej anonimizacji.
2. **Rozmowa chroniona:** już po dodaniu własnego PDF-u (także nieczytelnego, pominiętego, niezatwierdzonego) `privacy=localDocuments`. Tryb pozostaje do zamknięcia sesji; usunięcie podglądu nie przywraca wysyłki. Tekst, historia, fakty, OCR, nazwy plików i wynik nie trafiają do generatywnego AI. Nierozpoznany tekst otwiera lokalny wybór pomocy/akcji, zachowując kontekst.
3. **Ogólna pomoc po PDF-ie:** tylko `topicId`. Żadnej historii/danych sprawy. AI może użyć katalogu, nie załącznika. Awaria nie przełącza na swobodny kanał.

Obecny cloud upload jest sprzeczny z wymaganiem: wyłączyć akcję chmurową i `/api/parent-document` dla uploadu użytkownika, niezależnie od `MILA_PDF_UPLOAD_ALLOWED` i nagłówka zgody. Test: zero wywołań dostawcy nawet przy bezpośrednim żądaniu. Fikcyjny PDF demo zachowuje deterministyczny odczyt; nie wymaga wyjątku chmurowego. Podstawowa ścieżka lokalna bez zmian.

Polityka kanału sprawdzana **przed budowaniem** payloadu i fetch; serwerowy schemat `topic` odrzuca dodatkowe pola. Serwer bez trwałej sesji nie może niezależnie wiedzieć o otwarciu PDF-u w przeglądarce — nie deklarować takiej ochrony dla dowolnego ręcznie skonstruowanego żądania tekstowego. Gwarancja produktu: izolowany builder, zamknięty kontrakt tematów i testy sieciowe; endpoint uploadu blokuje PDF także na serwerze.

Audio: ogólne teksty przez istniejące MP3/podpis pomocy, bez danych akt. Indywidualnych wyjaśnień nie wysyłać do ElevenLabs ani automatycznie `speechSynthesis`, które może używać sieci. Brak audio nie blokuje tekstu. Nowe stałe odpowiedzi w `getStaticHelpTexts` muszą dostać nagrania/manifest według istniejącego testu, bez jego osłabiania.

Dane w pamięci otwartej karty, bez `localStorage` na fakty/PDF. Zachować zwalnianie object URL/zasobów OCR. Przy implementacji zaktualizować prywatność i README. Limity wielkości/liczby pól przed dostawcą, `no-store`, logi bez treści sprawy; limity żądań/kosztów potwierdzić na hostingu, nie udawać globalnego limitu mapą procesu serverless.

## 9. Komponenty i integracja bez przebudowy interfejsu

Planowane małe `InterviewTurn`, `DiscoveryTurn`, `ProcedureQuestionTurn` w `src/features/parent`, z CSS Modules. Tekst jako `MilaMessage.children`, karty/formy/wybory w `smartComponents`; pasek akcji pozostaje na końcu. Reużywać `SingleChoice`, `QuestionControls`, `FactControl`, `Button`, `IconButton`, `Sheet`, karty wyniku/załącznika. Bez nowego layoutu lub formularza administracyjnego.

Rozszerzyć `CaseTurn` i `ParentThread`. Aktywność kontrolek według `QuestionRef` i rewizji, nie „ostatnia wiadomość”; pomoc nie dezaktywuje pytania. Stare kontrolki i eksport nieaktualnych wyników zablokowane/oznaczone. Osoba/tytuł widoczne przy pytaniu i wyniku.

`CaseTools` korzysta z kanonicznych faktów/projekcji; `PlanReport/PlanDetails` ze wspólnego składania ocen. `tasks` przenieść z lokalnego `Formalities` do sesji. Klucz: procedura + zdarzenie/dziecko + osoba, jeśli osobowe. „Wykonano” nie zmienia oceny prawnej ani `birthRegistered` bez osobnej odpowiedzi. Zmiana daty nie odznacza zadania po cichu — może dać „sprawdź ponownie”.

`CaseConversation` zachowuje przewijanie, załączniki i fokus; dostarcza aktywność/ID sesji hookowi. `MilaGuide` izoluje rozmowy. Tytuł przed świadczeniem może brzmieć „Możliwe sprawy rodziny”. Etykiety kontrolek, błąd powiązany z polem, Tab/Shift+Tab, Enter/spacja, Escape w `Sheet`, powrót fokusu do wyzwalacza/pytania, `aria-live=polite`. Bez kradzieży fokusu podczas pisania/odpowiedzi w tle; 360 px, powiększenie, brak poziomego przewijania, `prefers-reduced-motion`.

## 10. Bezpieczna kolejność implementacji

Przed każdym etapem sprawdzić Git i bazowe kontrole, zachować zastane zmiany. Każdy etap osobno odbieralny; bez migracji całego repo naraz. Nie usuwać starego przepływu przed przejściem jego testów i próby PDF. Kolejność 1 → 2 → 3 → 4 → 5; regresje sprawdzane w każdym etapie.

### Etap 1 — model, pytania i deterministyczne przejścia

- **Zakres/pliki:** nowe `family-session.ts` (typy i własność), `interview.ts` (typowany bank i objaśnienia), `interview-session.ts` (przejścia), `tests/interview.test.ts`. Fact/Proposal, kursor, korekty, unieważnianie, osoba i stany unknown/deferred/stale. Bez podłączania nowego modelu do działającego hooka.
- **Zależności:** typy domenowe, Zod, daty i teksty istniejących banków; bez AI i nowej biblioteki.
- **Odbiór/testy:** offline każda krótka gałąź, powrót z pomocy, wczesne dopasowanie jako polecenie, korekta. Kompletność rejestru kluczy, izolacja A/B, cofnięcie/anulowanie, założenie vs dowód, zależności i stary token; istniejące testy zielone.
- **Ryzyko:** zbyt szeroki model — jedno zdarzenie i istniejące pola; nieustalonego właściciela nie zastępować domysłem.
- **Poza zakresem:** UI, discovery, migracja działającego PDF-u, endpointy i zmiany prawa.

### Etap 2 — adaptery, discovery i rejestr 19 procedur

- **Zakres/pliki:** nowe `interview-profile.ts`, `src/data/discovery.ts`, `src/engine/discover-procedures.ts`; małe wydzielenie składania ocen w `engine/plan.ts`, zachowanie `generatePlan`; testy adapterów/discovery.
- **Zależności:** etap 1, `evaluateProcedure`, `assessBenefit`, katalog/bank pytań. Bez drugiego silnika kwalifikacji.
- **Odbiór/testy:** pełne mapowanie 19 ID/realnych akcji i osobne narzędzia spoza katalogu; właściwe osoby/tytuły/daty/jednostki, brak zmyślonego etatu i daty, stabilny ranking, braki/przyszłość/review zachowane. Dla identycznego wejścia `evaluateProcedure` bez zmiany wyniku; dotychczasowy `generatePlan` bez zmiany kwalifikacji.
- **Ryzyko:** katalog nie obejmuje wszystkich wariantów kalkulatora/historycznych reguł — jawne ograniczenia i skierowania, bez rozszerzania prawa.
- **Poza zakresem:** UI, nowe kalkulatory, AI, uniwersalny import PDF.

### Etap 3 — sesja, czat, kalkulatory i powroty

- **Zakres/pliki:** `case-session.ts`, `useParentWorkspace.ts`, `StartActions`, `ParentThread`, nowe turny, `BenefitTurn`, `ParentResult`, `CaseTools`, `CareComparison`, formularze podstawy, `CaseConversation`, `PlanReport/PlanDetails`. Jeden zapis, snapshoty, zadania i ścieżka wywiad → karty → kalkulator → wynik → karty → kolejny kalkulator.
- **Zależności/migracja:** etapy 1–2. Najpierw projekcja dla istniejącego kalkulatora i test równoważności, potem zmiana właściciela zapisu; nie utrzymywać dwóch mutowalnych zestawów. Dotychczasowe `session.family: ParentCase` usunąć z nowej sesji lub udostępnić tylko jako projekcję kompatybilności pod inną nazwą. `benefit/goal/asOf` odczytywać z aktywnego assessmentu.
- **Odbiór/testy:** pełna główna ścieżka bez AI, wiele spraw A/B bez powtórek/przecieków, kursor niezależny od historii, korekta zmienia zależne wyniki, symulacje i porównanie zachowane. Headless Playwright: ręczny kalkulator i fikcyjny PDF do kwoty/dokumentów, desktop/telefon, klawiatura/powrót z Sheet.
- **Most PDF konieczny już tutaj:** `DocumentData → applyConfirmedFacts` z wybranym celem, `DocumentId`, rewizją i ochroną konfliktów. Zachować lokalny odczyt/potwierdzanie. Od razu `localDocuments`, anulowanie żądań i brak cloud uploadu (UI + route). Bogatsze pochodzenie i tematy AI w etapie 4. Nie odkładać prywatności do końca migracji.
- **Ryzyko:** `selectBenefit/saveFacts` i lokalny stan porównania — przenosić pionowo po jednej ścieżce, porównywać wejścia/wyniki, bez refaktoringu silników. Szkic formularza nie jest zapisem kanonicznym; zapis po zatwierdzeniu.
- **Poza zakresem:** interpretacja wielopolowa przez AI, nowy OCR, redesign i reguły prawne.

### Etap 4 — naturalne wypowiedzi, AI, pomoc po wyniku i pochodzenie PDF

- **Zakres/pliki:** `parent-intent.ts`, `case-assistant-context.ts`, `case-fields/case-message`, route intencji/pomocy, `helpAnswers/helpKnowledge`, hook, `DocumentTurn/case-documents`, lokalne wyjaśnienie w `ParentResult`, manifest/nagrania, `LandingPrivacy`, README. Wielopolowi kandydaci, potwierdzanie per pole, konflikty osoba/czas, tematy w chronionej rozmowie, usunięcie blokady `checkedAssessment`.
- **Zależności:** model i tokeny etapu 3; istniejący AI SDK. Zmiany schematów wymagają próby rzeczywistego dostawcy na fikcyjnych danych, bez zmiany modeli dla eksperymentu.
- **Odbiór/testy:** ciąża/zlecenie/przypuszczenie, zmiana osoby i wielopolowa korekta zapisują tylko zatwierdzone dane. Pomoc po wyniku nie powtarza bez powodu karty. Kontrakty i payloady dostawcy potwierdzają izolację dokumentów. Awaria AI nie blokuje etapu 3. Lokalne uzasadnienie działa też po PDF-ie.
- **Ryzyko:** poprawny JSON o błędnym znaczeniu — propozycja i deterministyczna walidacja, testy intencji/źródeł. Chroniona rozmowa ma ograniczoną swobodną interpretację; jawny komunikat i lokalne akcje.
- **Poza zakresem:** przesyłanie akt/indywidualnego wyniku do modelu, autonomiczne pytania prawne, ogólna anonimizacja i agent.

### Etap 5 — odbiór end-to-end i konkursowy

- **Zakres/pliki:** scenariusze przeglądarkowe oraz testy domenowe, kontraktów/regresji; późniejsza aktualizacja `docs/checklista-wymagan-zus.md` dowodami nowej wersji i materiałów demo, jeśli zmienił się przepływ. Ten audyt ich nie modyfikuje.
- **Zależności:** etapy 1–4, niezależne oczekiwane wyniki, lokalne akta i docelowe środowisko. Repo nie ma zależności Playwright — sprawdzić CLI/przeglądarki; minimalną zależność developerską dodać dopiero dla powtarzalnego CI, jeśli potrzebna.
- **Odbiór/testy:** macierz sekcji 12, `bun run check`, `bun run build`, headless desktop/telefon Chromium i WebKit, sieć/fokus, reprezentatywne rzeczywiste sprawy wyłącznie lokalnie. Obliczenia/formularze bez regresji; dowody dla konkretnej rewizji. Osobno publiczne demo/materiały i dostęp jury.
- **Ryzyko:** niepełne akty lub brak niezależnego odniesienia — opisać brak dowodu, bez deklaracji pełnej zgodności.
- **Poza zakresem:** produkcyjne integracje, nowe prawo, publikacja/commit bez osobnego zadania i dalszy redesign.

## 11. Mapa zmian i granica migracji

| Pliki                                                                                                                    | Rola / etap                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Nowe `parent/family-session.ts`, `interview.ts`, `interview-session.ts`                                                  | Typy, bank, przejścia, zależności — 1                       |
| Nowe `parent/interview-profile.ts`, `data/discovery.ts`, `engine/discover-procedures.ts`                                 | Adaptery i akcje — 2                                        |
| `engine/plan.ts`                                                                                                         | Wspólne składanie ocen, zachowanie `generatePlan` — 2       |
| `parent/case-session.ts`, `useParentWorkspace.ts`                                                                        | Jeden zapis, kursor, assessmenty/tokeny — 3; AI — 4         |
| `StartActions`, `ParentThread`, nowe `InterviewTurn/DiscoveryTurn/ProcedureQuestionTurn` + CSS Modules                   | Rozmowa i karty — 3                                         |
| `BenefitTurn`, `ParentResult`, `CaseTools`, `CareComparison`, `PayrollBasisForm`, `ContributionBasisForm`                | Cel zapisu, stan, powroty, ślad podstawy — 3–4              |
| `guide/CaseConversation`, `MilaGuide`, `PlanReport`, `PlanDetails`                                                       | Aktywność, perspektywa planu, zadania — 3                   |
| `parent/DocumentTurn`, `case-documents`, `/api/parent-document/route.ts`, wejścia przekazujące `uploadAllowed`           | Most/rewizje/blokada uploadu — 3; pochodzenie/konflikty — 4 |
| `parent/parent-intent`, `case-assistant-context`, `case-fields`, `case-message`, `/api/parent-intent`, `/api/guide-help` | Kontrakty i komendy — 4                                     |
| `guide/helpAnswers`, `helpKnowledge`, `audioManifest.json`, `public/audio/mila`, `landing/LandingPrivacy`, README        | Tematy, nagrania, opis prywatności — 4                      |
| Nowe testy wywiadu/adapterów/discovery, istniejące testy rozmowy/silników/PDF/pomocy                                     | 1–5; browser przy zmianach interakcji                       |

Nowe pliki są propozycją miejsca implementacji, nie istniejącymi zależnościami. Nie usuwać automatycznie `guide/flow.ts`, `conversation.ts`, `QuestionTurn`; mają odbiorców w testach/przykładzie landingu. Nie zmieniać wspólnych tokenów/komponentów bez inspekcji użyć. `Profile` i `CaseFacts` zachowują znaczenia jako wejścia silników; nowy model powstaje nad nimi. Zmiana prawnego znaczenia pola wymaga osobnego uzasadnienia/testu, nie jest skutkiem migracji nazwy.

## 12. Testy i kryteria odbioru

### Macierz krytycznych ścieżek

Każda ścieżka ma test czystych przejść/projekcji; interakcje również headless Playwright na fikcyjnych danych. Bez realnego AI w podstawowym CI; atrapy sukcesu, błędu, konfliktu i opóźnienia.

| #   | Scenariusz                                          | Obserwowalny wynik wymagany                                                                                                                        |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ciąża na etacie                                     | Szybkie karty bez pensji; prognoza dopiero po danych/założeniach, ponowne sprawdzenie po porodzie                                                  |
| 2   | Zlecenie, nieznane chorobowe                        | unknown ≠ false, karta/instrukcja pozostają, brak pętli                                                                                            |
| 3   | Działalność                                         | Wczesne karty bez salda; kalkulator pyta o saldo/podstawę właściwego dnia i tytułu                                                                 |
| 4   | Drugi rodzic, inne zatrudnienie                     | Własne chorobowe/podstawa, brak dziedziczenia od A, urlop odróżniony od zasiłku                                                                    |
| 5   | Pomoc partnerowi                                    | Helper nie staje się podmiotem; sprostowanie otwiera świadomą korektę właściciela                                                                  |
| 6   | Planowanie                                          | `PlanningPlan`, bez fikcyjnej ciąży/porodu/indywidualnego prawa                                                                                    |
| 7   | Narodziny, nieznana data                            | Możliwości i braki, bez obliczonych dat; termin nie przechodzi jako urodzenie                                                                      |
| 8   | Adopcja, piecza, strata (osobne próby)              | Istniejące kalkulatory szczególne, granice zakresu, neutralny język; bez udawania standardowego porodu                                             |
| 9   | Korekta i anulowanie                                | Tylko zależne fakty stale, dane B zostają; anulowanie bez zmian; nieaktualny wynik nie służy eksportowi                                            |
| 10  | Kilka faktów w zdaniu                               | Propozycja osoby/zakresu, wybór pól, „chyba” nie zapisuje negacji, pominięcie potwierdzonych pytań                                                 |
| 11  | AI w środku wywiadu                                 | Odpowiedź i powrót do aktywnego pytania, działające przyciski, bez ponawiania danych wspólnych                                                     |
| 12  | Kilka świadczeń w rodzinie                          | Wywiad → karty → kalkulator A → wynik → karty → B → poprzedni wynik; szczegóły/zadania zachowane, zero transferu finansów                          |
| 13  | PDF częściowo sprzeczny                             | Lokalny odczyt/podgląd, źródła/strony, brak domyślnego nadpisania, osoba/okres; decyzja nie zasila silnika                                         |
| 14  | Brak AI, timeout, 503, wadliwy JSON                 | Główna ścieżka i wyjaśnienie kwoty lokalnie; tekst i aktywne kontrolki zachowane                                                                   |
| 15  | Spóźnione AI/OCR po zmianie danych/sprawy/rozmowy   | Nieaktualny token → brak zapisu/przełączenia/starej propozycji, także gdy abort zignorowany                                                        |
| 16  | Pytania po wyniku                                   | Podstawa/kwota, dokumenty, korekta, nowy temat i pytania ogólne działają; `eligible` z `missing=basis` nie blokuje                                 |
| 17  | Różne osoby, dwa tytuły tego samego typu, różne dni | A ≠ B, A1 ≠ A2, dziś ≠ poród ≠ coverageDay, prognoza ≠ dowód; `other/notWorking` nie stają się etatem                                              |
| 18  | Regresje kalkulatorów                               | Wszystkie 12 wariantów, porównanie, praca/wydłużenie, podstawa z płac/składek, podwyższenie, demo reguł/dokumenty poprawne także przez skrót i PDF |

Dodatkowo: pełność rejestru 19 ID/akcji, remisy rankingu, brak 19 pustych kart, widoczne istotne braki/terminy, `deadlines.missingField`, ograniczenia dat/wygasłe reguły, nieznana osoba, wieloród/rozłączne pobyty, konflikty Aktywnego Rodzica, tematy URL bez faktów. Snapshot nie jest aktualny tylko dlatego, że jego wiadomość jest ostatnia.

### Testy żądań i prywatności

- Przyciski/proste odpowiedzi/discovery/kalkulatory: zero żądań AI. Sprawdzić faktyczne wywołania, nie tylko `buildAssistantRequest`.
- Po własnym PDF-ie w każdej drodze (spinacz, start, pominięcie OCR, błąd skanu, drugi dokument, inne świadczenie, powrót do rozmowy) brak swobodnego parent-intent/guide-help. Model czekał → dodanie PDF → odpowiedź nie jest używana.
- Przechwycić **żądania browsera i body serwera do dostawcy**, również fallback i TTS. Fikcyjne PDF/OCR/tekst ze znacznikami: nazwisko, data, kwota, nazwa pliku, unikalna fraza. Żaden nie występuje w chronionym kanale. Dozwolone body tylko znany `topicId`; prompt dostawcy zawiera temat/katalog, bez akt/historii.
- `topic` z dodatkowymi `question/profile/messages/document`, nieznane ID, zły kontekst, zbyt długi payload lub błędny JSON → błąd przed dostawcą. Bezpośredni `/api/parent-document` nie wywołuje AI także z dawną zgodą i włączoną zmienną.
- W zwykłym trybie ograniczona historia, brak serializacji snapshotów/dokumentów. Nie oczekiwać niezawodnej anonimizacji tekstu wpisanego przez użytkownika.
- Prompt injection z fikcyjnego dokumentu, sugestia zmiany kwoty i akcja spoza rejestru nie zmieniają faktów/wyniku. Sam JSON i znany `sourceId` nie dowodzą zgodności odpowiedzi.

### Niezależność wyników i odbiór techniczny

Oczekiwania obliczeń ustalać odrębnie: konkretne źródło/wersja przepisu lub tabela organizatora, ręczny rachunek z jednostkami/datą/zaokrągleniem, a przy aktach strony dowodów. Decyzja potwierdza tylko zawarte prawo/okres/kwotę; kwota policzona z Z-3 nie dowodzi przelewu. Nie wyprowadzać oczekiwań przez uruchomienie `assessBenefit`. Równoważność adaptera ze starą ścieżką to test regresji, nie niezależne potwierdzenie prawa.

Reużywać `parent-benefit`, `contest-benefits`, `parent-conversation`, `scan-evidence`, `procedures`, `guide`, `guide-help`, `dates`, `prematurity`, `start-topics`, `landing`. Zachować granice okresów, wyczekiwania, salda, płatnika, stawek, przyjęcia i sytuacji szczególnych checklisty; nie zmieniać oczekiwań, bo adapter dał inną liczbę.

Po etapie `bun run check` i adekwatne regresje; po integracji i końcowo `bun run build`. Bez ręcznej edycji wygenerowanych typów `.next`. Browser: Chromium desktop/360 px, WebKit mobile, Tab/Shift+Tab/Enter/spacja/Escape, fokus po edycji/Sheet, błędy i brak kradzieży fokusu w tle. Powtarzalne scenariusze z atrapą API; mała próba realnego AI na fikcyjnych pytaniach ocenia intencję, źródła i zatwierdzanie, nie zastępuje CI.

Wywiad ukończony, gdy osoba bez znajomości nazw dochodzi do użytecznej listy, wybiera sprawę i po wyniku wraca do następnej bez powtórek wspólnych faktów. Ocena ma osobę/zdarzenie, datę, źródła/braki; stary wynik oznaczony. Pełna ścieżka bez AI, dokumenty niewysyłane do modelu, dotychczasowe funkcje konkursowe dostępne.

## 13. Konkurs, ryzyka i końcowy audyt planu

### Priorytety wobec dokumentacji ZUS

| Priorytet                                    | Co zachować lub ukończyć                                                                                                                                                                                      | Etapy                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Konieczne do ukończenia produktu             | Osoba/tytuł/dzień, poprawne obliczenia, lokalny PDF → wynik, warunki/podstawy/okresy/kwoty/płatnik/instrukcja, działanie bez AI                                                                               | Bramki wszystkich etapów; model P0 przed AI                                    |
| Konieczne wymagania konkursowe poza wywiadem | a–j: ciąża, macierzyńskie/szczególne sytuacje, praca na rodzicielskim, oboje rodzice, adopcja/piecza, podstawa, dokumenty/termin/adresat, ryzyka/wsparcie; także symulacje, szkice wniosków, panel parametrów | Zachować w 3; regresje i brakujące dowody w 5. Nie oznaczać jako opcjonalny UX |
| Potrzebne dla UX tego wdrożenia              | Krótkie discovery, wielopolowy tekst z potwierdzaniem, korekty, pomoc bez utraty pytania, powroty, dostępność/telefon                                                                                         | 1–4; odbiór 5                                                                  |
| Można odłożyć                                | Swobodna interpretacja po PDF-ie, AI objaśniające indywidualny snapshot, uniwersalny OCR, trwałe konta, wiele zdarzeń/relacji, nowe kalkulatory PIT/gminne, nowe głosy/animacje                               | Poza planem; nie ograniczać istniejących funkcji                               |

Checklista ZUS nadal wskazuje częściowe potwierdzenie a, b, e, f, g, j i reprezentatywnych akt; dostęp jury do prywatnego repo/zgłoszenia pozostaje niezweryfikowany. Tych braków nie rozwiązuje wywiad. Etap 5 ma je zweryfikować lub dokładnie opisać, nie przepisać checkboxy. `contest-readiness.md` wymaga dowodów z akt i niezależnych obliczeń; tutaj stanowi kontekst, nie polecenie implementacji aplikacji.

Gotowość konkursowa wymaga osobnego odbioru publicznego demo zgodnego z kodem, dostępu jury i materiałów (opis/rola AI, zrzuty, prezentacja do 10 slajdów, film do 3 minut). Ten plan nie potwierdza ich obecnej dostępności ani kompletności prawnej. Nie rozszerza katalogu; nowa reguła wymaga właściwego oficjalnego źródła i niezależnego przypadku kontrolnego.

### Pozostałe ryzyka i warunki rozpoczęcia

1. **Katalog a kalkulatory:** inne perspektywy i daty reguł; urlop nie przesądza zasiłku. Niepełne przypadki historyczne/wyjątkowe pozostają `review`, nie są naprawiane promptem.
2. **Migracja płaskich danych:** brak osoby/tytułu wyklucza automatyczny wspólny profil. Etykieta „Osoba sprawdzana” i doprecyzowanie ról są konieczne, bez CRM.
3. **Podstawa/saldo:** sama osoba nie wystarcza; wymagany tytuł/czas. Niezależne oczekiwanie kwoty pozostaje warunkiem odbioru.
4. **Asynchroniczność/prywatność:** zamontowana nieaktywna rozmowa, stary OCR i opcjonalny cloud upload to konkretne ryzyka. Tokeny i blokada serwera muszą wejść przy migracji przed rozszerzeniem AI.
5. **Budżet konkursowy/akta:** etapy 1–3 dostarczają produkt bez AI; nie odkładać przez wywiad brakujących prób ZUS. OCR i poprawność silnika mają osobny odbiór.

Audyt po korekcie: jeden zapis faktów; bez duplikatu odpowiedzi w `Profile/CaseFacts`; osoba/tytuł/czas przed projekcją; unknown/deferred/false/stale odróżnione; discovery nie zmienia kwalifikacji; 19 procedur z realnymi akcjami i zachowane dodatkowe kalkulatory; kursor/tokeny niezależne od historii; bez pozornej anonimizacji; most PDF i blokada uploadu już w etapie 3. Plan nadaje się do rozpoczęcia **etapu 1**, z testami kontraktów przed UI. Pełny odbiór wymaga dalszych etapów i niezależnych dowodów, nie samej realizacji tekstu.
