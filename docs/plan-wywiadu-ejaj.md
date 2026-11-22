# Plan implementacji wywiadu i pomocy AI w Mili

Branch: `ejaj`. Status: plan do realizacji. Data: 22 listopada 2026.

Mila ma pomagać osobie, która nie zna nazw świadczeń. Główna ścieżka prowadzi przez przygotowany, rozgałęziony wywiad, wstępne dopasowanie spraw, szczegółowe sprawdzenie wybranej sprawy i rozmowę o dalszych krokach. AI wyjaśnia i pomaga nawigować; katalog oraz silniki TypeScript ustalają warunki, terminy i kwoty.

Ten etap obejmuje plan i utworzenie brancha. Implementacja aplikacji będzie osobną pracą według poniższych etapów.

## 1. Decyzje dotyczące produktu

- Główna akcja startowa: **Sprawdź, co może Ci przysługiwać**.
- Skrót dla osoby znającej temat: **Wiem, jakie świadczenie sprawdzić**. Zachowuje obecną listę i kalkulatory.
- Wywiad jest rozmową z jednym pytaniem naraz, przyciskami i możliwością wpisania prostej odpowiedzi.
- Pytania, kolejność, zależności oraz przejścia są przygotowane w kodzie. Przejście wywiadu nie wymaga wywołania modelu.
- Krótki wywiad daje wstępne dopasowanie, a nie obietnicę kompletnej kwalifikacji prawnej. Szczegóły zbieramy po wyborze sprawy.
- AI jest dostępne do wyjaśnień podczas wywiadu i do rozmowy po wyniku. Nie wybiera samodzielnie kolejnych pytań ani nie zmienia oceny silnika.
- Użytkownik może nie znać daty, ubezpieczenia albo swojej sytuacji zawodowej. Brak wiedzy pozostaje brakiem danych.
- PDF jest opcjonalnym sposobem uzupełnienia odpowiedzi. Nie jest wymagany do odkrywania świadczeń.
- Logowanie, baza danych, trwałe zapisywanie spraw, wysyłka do ZUS i urzędowe formularze PDF pozostają poza zakresem tej zmiany.
- W pierwszej wersji nie dodajemy nowych modeli ani bibliotek do prowadzenia rozmowy.

## 2. Elementy istniejącego kodu

| Element                                          | Obecne zachowanie                                                         | Wykorzystanie                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/features/parent/useParentWorkspace.ts`      | Prowadzi aktywną sprawę, obsługuje lokalne rozpoznawanie i wywołania AI   | Jeden kontroler również dla wywiadu i wyboru dopasowanej sprawy                       |
| `src/features/parent/case-session.ts`            | Przechowuje fakty, historię, wybór świadczenia i wynik                    | Rozszerzenie istniejącego stanu i przejść, bez drugiej niezależnej rozmowy            |
| `src/features/guide/flow.ts`                     | Starszy wywiad dla planowania, ciąży i narodzin                           | Ponowne użycie tekstów i wybranych reguł; nie uruchamiamy go jako osobnego kontrolera |
| `src/features/guide/conversation.ts`             | Starsza historia i korekty; nadal używana przez testy i przykład landingu | Zachowanie do czasu świadomej migracji odbiorców                                      |
| `src/data/questions.ts`                          | Bank pytań powiązanych z polami `Profile`                                 | Baza pytań uzupełniających do procedur                                                |
| `src/engine/evaluateProcedure.ts` i `plan.ts`    | Ocena 19 procedur, brakujące pola, powody, terminy i źródła               | Podstawa dopasowania, bez kopiowania progów do wywiadu                                |
| `src/engine/parent-benefit.ts`                   | Szczegółowe sprawdzanie 12 wariantów świadczeń                            | Obliczenia po wybraniu właściwej sprawy                                               |
| `CaseTools.tsx`                                  | Buduje niepełny `Profile` z `CaseFacts`                                   | Wspólna jawna projekcja danych zamiast kolejnej lokalnej konwersji                    |
| `QuestionControls`, `FactControl`, `MilaMessage` | Istniejące pola, wybory i prezentacja wiadomości                          | Kompozycja interfejsu nowego wywiadu                                                  |
| `/api/guide-help`                                | Odpowiedzi z katalogu, FAQ, źródła i podpis odczytu głosowego             | Rozbudowa o kontekst kroku i bezpieczne tematy pomocy                                 |

Istotne ograniczenia obecnego kodu:

1. `Profile` i `CaseFacts` mają różne nazwy oraz zakresy pól. `sicknessInsurance`, `insuredAtBirth` i `insured` nie są równoważne bez daty i osoby.
2. Katalog jest częściowo pisany z perspektywy osoby rodzącej. Ojcostwo używa `otherParentEmployment`; samo przekazanie zatrudnienia rozmówcy do `employment` może pomylić osoby.
3. Planowanie ciąży nie jest wartością `Profile.stage`; stary wywiad obsługuje je oddzielnie. Nie należy udawać istniejącej ciąży, żeby wygenerować plan.
4. `getQuestionIds` starego wywiadu ma krótkie, sztywne gałęzie. Samo jego włączenie do czatu nie zapewni nowej ścieżki.
5. Dodanie własnego PDF-u obecnie zatrzymuje swobodne wywołania AI, a końcowy wynik częściowo blokuje dalsze odpowiedzi.
6. Wybrane tematy z adresu są preferencją, nie potwierdzonymi danymi o uprawnieniach.

## 3. Przebieg użytkownika

### Rozpoczęcie

Na pustym ekranie główna akcja rozpoczyna wywiad od lokalnej wiadomości: „Zadam Ci kilka krótkich pytań. Na ich podstawie pokażę sprawy, które warto sprawdzić. Jeśli czegoś nie wiesz, możesz wrócić do tego później”.

Sformułowania takie jak „nie wiem, co mi przysługuje” i „pomóż mi sprawdzić świadczenia” kierują lokalnie do tego samego wejścia. Samo powitanie nie rozpoczyna automatycznie długiego wywiadu. Konkretna prośba o ojcowski może nadal otworzyć obecny kalkulator.

### Krótki wywiad

Celem jest zwykle około 4–7 pytań przed pierwszym podsumowaniem, zależnie od ścieżki i danych już potwierdzonych. Nie pokazujemy stałego licznika typu „3 z 6”, jeśli liczba pytań może się zmienić.

| Kolejność | Ustalenie                                                                                      | Rozgałęzienie                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1         | Kogo dotyczy sprawdzanie: osoba w ciąży lub po porodzie, drugi rodzic, opiekun, sprawy rodziny | Osoba pomagająca wskazuje, czyją sytuację opisuje; nie zapisujemy automatycznie jej zatrudnienia jako zatrudnienia rodzica |
| 2         | Etap: planowanie, ciąża, dziecko już urodzone; dostępna inna sytuacja                          | Planowanie prowadzi do przygotowań. Adopcja, piecza i strata mają osobne wejścia do istniejących ścieżek                   |
| 3         | Termin porodu albo data urodzenia                                                              | Termin może pozostać nieznany; trymestr nie staje się wymyśloną datą                                                       |
| 4         | Sytuacja zawodowa wskazanego rodzica                                                           | Etat, zlecenie, działalność, osoba współpracująca, brak pracy, inna lub nieznana sytuacja                                  |
| 5         | Krajowa sytuacja rodzinna i zamieszkanie                                                       | Odpowiedź wskazująca inny kraj kieruje do potwierdzenia zasad; nie powoduje automatycznego odrzucenia całej pomocy         |
| 6         | Krótki sygnał potrzebny dla gałęzi                                                             | Np. zwolnienie w ciąży albo potrzeba sprawdzenia sytuacji po hospitalizacji dziecka; bez zbierania całej dokumentacji      |
| 7         | Dodatkowa informacja wspólna dla kilku trafnych spraw                                          | Np. liczba dzieci przy porodzie; pytanie pomijane, jeśli już potwierdzono tę informację                                    |

Pytanie pojawia się tylko wtedy, gdy jest potrzebne w danej gałęzi. Dane drugiego rodzica zbieramy dopiero dla spraw, które ich wymagają. W krótkim wywiadzie nie pytamy o pensję, saldo składek, miesiące wynagrodzeń, PESEL ani numer konta.

Nie rozbudowujemy standardowego wywiadu o wszystkie wyjątki. Osoba wybierająca stratę, adopcję lub pieczę otrzymuje neutralną wiadomość i właściwą istniejącą ścieżkę szczegółową. Nie przechodzi przez gratulacje ani standardowe pytania o poród. Nieobsługiwana kombinacja otrzymuje wyjaśnienie zakresu zamiast pozornego rozstrzygnięcia.

### Wstępne dopasowanie

Mila pokazuje krótką wiadomość oraz karty spraw. Każda karta zawiera nazwę, osobę, której dotyczy, powód pokazania, stan sprawdzenia i jedną główną akcję.

Etykiety wynikają z istniejącej oceny, z uwzględnieniem ograniczeń katalogu:

- „Pasuje do podanych odpowiedzi” dla `relevant`; nie oznacza decyzji urzędu.
- „Potrzebuję dodatkowych danych” dla `missing-data`, z nazwaniem najważniejszego braku.
- „Do sprawdzenia” dla `possible`, z powodem: przyszłe zdarzenie, wyjątek, ograniczenie zakresu albo data reguł.
- „Formalność do załatwienia” jako rodzaj karty, niezależny od statusu kwalifikacji.
- `not-relevant` poza główną listą, ale z możliwością sprawdzenia uzasadnienia. Zmiana danych może przywrócić pozycję.

Pierwsze widoczne karty dotyczą aktualnej sytuacji oraz terminów już policzonych przez silnik. Pozostałe sprawy są dostępne w rozwijanej liście. Nie pokazujemy 19 podobnie wyglądających kart z brakami ani nie traktujemy nieznanej informacji jako powodu ukrycia możliwości.

Tematy z landingu mogą zmieniać kolejność, lecz nie usuwają pozostałych dopasowań. Wstępne podsumowanie nie pokazuje indywidualnej kwoty bez właściwego obliczenia. Kwota katalogowa, jeśli jest wyświetlana, ma jednostkę, warunki i źródło.

### Szczegółowe sprawdzanie

Akcja na karcie otwiera istniejący kalkulator albo pytanie uzupełniające procedury. Potwierdzone i nadal aktualne informacje są używane ponownie. Wybór świadczenia nie kasuje wspólnego wywiadu.

Po zakończeniu dostępne są: wynik, dokumenty, dalsze kroki, zmiana danych oraz „Wróć do dopasowanych spraw”. Powrót zachowuje wywiad i oznaczenia zadań. Zmiana osoby lub tytułu ubezpieczenia nie przenosi cudzej podstawy, ubezpieczenia ani wykorzystanych okresów.

### Wyjaśnienia

„Dlaczego o to pytasz?” ma lokalną odpowiedź przypisaną do każdego pytania. Nieznana prosta odpowiedź pozostawia pytanie aktywne i pokazuje opcje. Użytkownik może skorzystać z pomocy AI, ale brak usługi nie blokuje kontynuowania.

Po wyniku działają „Co teraz?”, „Dlaczego taka kwota?” i „Jakie dokumenty?”. Wyjaśnienie konkretnego obliczenia powstaje lokalnie z jego części, stawki, okresu i powodów. AI może wyjaśniać pojęcia na podstawie katalogu. Nie generuje alternatywnej kwoty ani nowej decyzji o prawie.

## 4. Dane i stan rozmowy

Rozszerzyć `CaseSession` o jeden stan wywiadu. Nie montować obok niego starego `initialConversation` z drugim kompletem odpowiedzi.

Planowane typy w `src/features/parent/interview.ts`:

- `InterviewStage`: planowanie, ciąża, narodziny i skierowanie do szczególnej ścieżki.
- `InterviewSubject`: osoba rodząca, drugi rodzic, opiekun lub zakres rodzinny.
- `InterviewQuestionId`: zamknięta lista pytań wywiadu.
- `InterviewAnswers`: typowane odpowiedzi z rozróżnieniem danych wspólnych i wskazanego rodzica.
- `InterviewState`: etap pracy, odpowiedzi, pytania odłożone, aktywny cel uzupełnienia oraz numer rewizji.

Odpowiedź potwierdzona ma typ zgodny z pytaniem. Brak wpisu oznacza „jeszcze nie zapytano”, jawny stan `unknown` oznacza „osoba nie wie”, a `deferred` oznacza „wrócić później”. Odpowiedź `false` pozostaje rzeczywistym „nie”. Stan „nie dotyczy” wynika z gałęzi, nie zastępuje braku informacji. Walidacja używa Zod i unii rozróżnianych, bez `any`.

Przechowujemy tylko potrzebne fakty. `Profile`, listę dopasowań i następne pytanie wyliczamy; nie utrzymujemy ich jako równoległych mutowalnych kopii w React.

Dane rodzinne obejmują etap, daty i dziecko. Dane osoby obejmują zatrudnienie i odpowiedzi istotne dla jej sprawy. Przed użyciem informacji o drugim rodzicu przypisujemy je jawnie do tej osoby; brak danych nie jest dziedziczony po pierwszym rodzicu. Dla MVP wystarczą niewielkie rekordy rodziców z tymi polami, bez ogólnego systemu osób i dokumentów.

`session.family` zachowuje rolę szczegółowej aktywnej sprawy. Dodać identyfikator osoby, której dotyczą fakty aktywnej sprawy. Zapis danych wspólnych i aktualizacja szczegółów przechodzą przez te same czyste funkcje przejść; nie synchronizować stanów dwukierunkowymi efektami React.

Wprowadzić jawne adaptery w `interview-profile.ts`:

1. `toProcedureProfile(interview, procedureId, subject)` buduje wejście dla katalogu z uwzględnieniem perspektywy procedury.
2. `toCasePatch(interview, benefit, subject)` przekazuje do kalkulatora wyłącznie zgodne znaczeniowo i aktualne fakty.
3. `applyConfirmedCaseFacts(session, patch, origin)` aktualizuje wspólne informacje, gdy potwierdzono je w formularzu lub PDF-ie, i unieważnia zależne dane.

Nie mapować ogólnego „mam chorobowe” na `insuredAtBirth` ani `insured` dla dowolnego okresu. Ubezpieczenie wymaga osoby, tytułu i właściwego dnia. Nie mapować „nie pracuję” na brak wszelkich uprawnień. Nie mapować `other` do `employee`. Nie przekazywać przewidywanej daty porodu jako faktycznej daty urodzenia.

Zmiany etapu, osoby, daty, zatrudnienia oraz danych drugiego rodzica mają jawną tabelę zależności. Zmiana porodu z oczekiwanego na rzeczywisty unieważnia prognozę i odświeża wynik. Zmiana zatrudnienia czy osoby unieważnia zależne ubezpieczenie i podstawę, zgodnie z istniejącymi zasadami `saveFacts`. Nie usuwa niezależnej daty urodzenia.

Historia może zawierać poprzednie odpowiedzi, lecz aktywne karty i akcje odnoszą się do bieżącej rewizji. Wyniki z wcześniejszej rewizji oznaczamy jako nieaktualne. Spóźniona odpowiedź AI lub OCR nie nadpisuje późniejszej korekty.

## 5. Przejścia i wybieranie pytań

Dodać czyste funkcje: `startInterview`, `getNextInterviewQuestion`, `answerInterviewQuestion`, `deferInterviewQuestion`, `reviseInterviewAnswer`, `finishInterview` i `resumeInterview`. Mają działać w testach bez React, sieci oraz zależności od runtime Node.js.

Etapy: pusty ekran → wywiad → dopasowanie → szczegółowa sprawa → wynik. Pomoc jest przerwą w bieżącym etapie, nie nowym etapem kasującym pytanie. Skrót do kalkulatora może ominąć wywiad.

Algorytm następnego pytania:

1. Jeżeli trwa uzupełnianie konkretnej procedury, wybierz brakujące pole z jej aktualnego wyniku i przypisanego banku pytań. Dla wybranego terminu uwzględnij również `deadlines[].missingField`, bo brak daty do wyznaczenia terminu nie zawsze występuje w `missingFields` kwalifikacji.
2. W przeciwnym razie przejdź przez przygotowaną kolejność pytań wspólnych i warunkowych.
3. Pomiń odpowiedzi już potwierdzone dla właściwej osoby oraz pytania nieaktywne w gałęzi.
4. Nie powtarzaj automatycznie pytań oznaczonych `unknown` albo `deferred`.
5. Gdy krótki wywiad jest zakończony lub użytkownik wybiera wcześniejsze podsumowanie, pokaż dopasowanie wraz z brakami.

Nie wybierać pytania wyłącznie przez zsumowanie wszystkich `missingFields` z 19 procedur. Doprowadziłoby to do długiego formularza z pytaniami o dochód, składki i zdrowie przed pierwszą użyteczną odpowiedzią.

Przy pytaniu o szczegół procedury zapisywać, do której karty wrócić. Odpowiedź „Nie wiem” pozwala zobaczyć pozostałe dopasowania. Jeśli użytkownik pominie etap lub osobę, podsumowanie jasno wskazuje ten brak i nie przyznaje żadnego świadczenia na podstawie domysłu.

## 6. Dopasowanie procedur i akcje na kartach

Dodać `src/engine/discover-procedures.ts` oraz rejestr `src/data/discovery.ts`. Rejestr określa odbiorcę, grupę karty, pola potrzebne do uzupełnienia i akcję. Nie zawiera kopii stawek, progów dochodu ani długości urlopów.

`discoverProcedures` używa istniejącego `evaluateProcedure` z projekcją właściwej osoby. Wszelkie zmiany znaczenia reguł katalogu mają osobne testy. Zachować `generatePlan` dla istniejących odbiorców i współdzielić ocenę, zamiast pisać drugi silnik kwalifikacji.

| Procedura katalogu                | Akcja z dopasowania                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `EMPLOYMENT_PREGNANCY_PROTECTION` | Szczegóły ochrony zatrudnienia i dokumenty                                                       |
| `SICKNESS_PREGNANCY`              | Kalkulator `sickness`                                                                            |
| `BIRTH_REGISTRATION`              | Uzupełnienie daty lub statusu zgłoszenia, następnie instrukcja USC                               |
| `CHILD_HEALTH_INSURANCE`          | Uzupełnienie informacji o zgłoszeniu, następnie instrukcja                                       |
| `MATERNITY_LEAVE`                 | Dokumenty urlopowe; obliczenie zasiłku przez `maternity` jako osobna akcja                       |
| `MATERNITY_ALLOWANCE`             | Kalkulator `maternity`                                                                           |
| `PARENTAL_LEAVE`                  | Dokumenty urlopowe; kalkulator `parental` i porównanie opieki jako osobne akcje                  |
| `SUPPLEMENTARY_MATERNITY_LEAVE`   | Kalkulator `supplement` z wymaganymi danymi pobytu                                               |
| `CHILD_800_PLUS`                  | Uzupełnienie braków, terminy, dokumenty i oficjalna instrukcja                                   |
| `PARENTAL_BENEFIT`                | Uzupełnienie danych procedury i instrukcja; nie mylić ze zasiłkiem za rodzicielski               |
| `BIRTH_GRANT_BECIKOWE`            | Uzupełnienie danych procedury, dokumenty i instrukcja                                            |
| `ACTIVE_PARENT_WORK`              | Uzupełnienie danych właściwego wariantu i instrukcja                                             |
| `ACTIVE_PARENT_NURSERY`           | Uzupełnienie danych właściwego wariantu i instrukcja                                             |
| `ACTIVE_PARENT_HOME`              | Uzupełnienie danych właściwego wariantu i instrukcja                                             |
| `PATERNITY_LEAVE`                 | Dokumenty urlopowe dla właściwego rodzica; kalkulator `paternity` jako osobna akcja              |
| `CARE_ALLOWANCE`                  | Uzupełnienie danych i zakresu katalogu, dokumenty; bez sugerowania istniejącego kalkulatora kwot |
| `CHILDCARE_LEAVE`                 | Uzupełnienie danych procedury, dokumenty i terminy                                               |
| `FAMILY_ALLOWANCE`                | Uzupełnienie danych procedury i informacji wymagających ustalenia przez urząd                    |
| `CHILD_TAX_RELIEF`                | Uzupełnienie danych procedury i oficjalna instrukcja                                             |

Pozostałe obecne kalkulatory, m.in. rehabilitacyjne, przejęcie macierzyńskiego, świadczenia po ustaniu zatrudnienia, adopcji, pieczy i stracie, pozostają dostępne ze skrótu oraz odpowiednich odpowiedzi w wywiadzie. Nie udawać, że mają już odrębne kompletne procedury w katalogu 19 pozycji. Metadane skierowania mają wskazać realnie istniejące narzędzie.

Dla pól występujących w `missingFields` korzystać z `src/data/questions.ts`. Dodać renderer obsługujący istniejące typy `choice`, `date`, `number` i `hospital`, składając go z obecnych kontrolek. Brak pytania albo nieobsługiwany wyjątek oznacza jawny następny krok do instytucji, nie nieskończony wywiad.

Perspektywa osoby musi być jawna. Pracujący drugi rodzic nie otrzymuje karty własnego urlopu macierzyńskiego tylko dlatego, że zaznaczył etat. Karta dotycząca drugiej osoby ma jej etykietę i osobne braki. Sytuacje wymagające prawnej zmiany katalogu mają zachowawczy status do sprawdzenia, dopóki reguła nie zostanie zweryfikowana w źródle.

## 7. Rola AI i kontrakty API

W pierwszej wersji AI nie jest potrzebne do rozpoczęcia, odpowiedzi przyciskami, przechodzenia pytań, odkrycia spraw ani ich obliczenia. Proste odpowiedzi tekstowe obsługują lokalne parsery. Niejednoznacznej wypowiedzi nie zapisujemy jako faktu.

Zachować `/api/parent-intent` dla swobodnych rozmów poza wywiadem i istniejących skrótów. Dodać akcję `startInterview` i obsłużyć ją w schematach oraz aplikacji. W aktywnym wywiadzie lokalne przejścia mają pierwszeństwo; model nie może przypadkowo przenieść osoby do innego świadczenia.

Rozbudować `/api/guide-help` o rozróżniane żądania, zachowując obsługę istniejącego formatu na czas migracji:

- Zwykłe pytanie: tekst oraz opcjonalny identyfikator kroku lub procedury, bez pełnego profilu i odpowiedzi.
- Przygotowany temat: wyłącznie `topicId` z zamkniętego rejestru. Serwer sam tworzy pytanie ogólne i wybiera wiedzę katalogową.

Identyfikatory nowego wywiadu nie należą automatycznie do starego `QuestionId`. Kontekst musi mieć jawny rodzaj, np. `guide`, `interview` albo `procedure`, i być walidowany względem odpowiedniego rejestru. Nie poszerzać pola do dowolnego stringa.

Przykładowe tematy: różnica urlopu i zasiłku, znaczenie ubezpieczenia chorobowego, podstawa zasiłku, sposób przygotowania dokumentów dla wskazanej procedury. Każdy temat ma stały tekst, dozwolone źródła i lokalny wariant odpowiedzi na wypadek awarii.

Instrukcje modelu określają: wyjaśnij pytanie lub pojęcie, korzystaj z katalogu, nie twórz nowego wywiadu, nie ustalaj indywidualnego prawa, nie zmieniaj wyniku, nie dopisuj nieobsługiwanych możliwości wysyłki. Źródła i linki nadal wybieramy z rejestru. JSON oraz poprawny identyfikator źródła nie zastępują oceny zgodności treści.

Pytania o możliwości Mili mają deterministyczne odpowiedzi: szkic TXT jest demonstracyjny, urzędowa strona otwiera się osobno, aplikacja nie składa wniosku. Nie pozostawiać tej informacji losowej odpowiedzi modelu.

Usunąć zasadę zastępowania odpowiedzi przez ponowne wyświetlenie wyniku tylko dlatego, że `checkedAssessment` jest prawdziwe. Zamiast niej rozpoznawać: wyjaśnienie wyniku, dokumenty, zmianę danych, nową sprawę i pytanie ogólne. Każda akcja zachowuje aktywny stan oraz powrót do dopasowania.

Anulować wywołania po korekcie, zmianie sprawy i odmontowaniu. Sprawdzać rewizję przed dopisaniem odpowiedzi. Nie dodawać wywołania intencji przed każdym przygotowanym pytaniem pomocy; znany temat trafia bezpośrednio do pomocy albo lokalnego tekstu.

Zachować istniejącą obsługę wypowiedzi o pilnej sytuacji i potrzebie wsparcia. Takiej wiadomości nie interpretować jako odpowiedzi „inna sytuacja” ani nie blokować jej obowiązkiem dokończenia wywiadu. Nie rozszerzać przy tej zmianie porad medycznych.

## 8. PDF i prywatność

Zachować lokalny OCR, limity plików, podgląd i potwierdzenie pól. Nie włączać domyślnie chmurowego odczytu ani nie używać rzeczywistych akt konkursowych w wywołaniach modeli.

Po zatwierdzeniu danych z PDF-u aktualizować również zgodne pola wywiadu, z numerem dokumentu i strony. Rozpoznana nazwa świadczenia może proponować przejście do jego szczegółów; nie musi automatycznie omijać dopasowania. Przy rozbieżności z bieżącą osobą lub sprawą wymagany jest wybór celu, bez łączenia akt.

Zastąpić całkowitą blokadę AI po PDF-ie rozdzieleniem kanałów:

1. Fakty, wynik, obliczenia, dokumenty i odpowiedzi dotyczące konkretnej sprawy są obsługiwane lokalnie.
2. Przyciski ogólnej pomocy mogą użyć AI. Wysyłają tylko przygotowany `topicId`; do modelu nie trafiają PDF, OCR, nazwa pliku, fakty, wartości wyniku ani historia sprawy.
3. Swobodny tekst w sprawie z własnym PDF-em nie jest automatycznie wysyłany do AI. Lokalnie rozpoznana intencja może otworzyć ogólny temat. Gdy nie da się jej rozpoznać, Mila pokazuje wybór tematów i krótkie wyjaśnienie ochrony danych.

To świadomy zakres pierwszej wersji. Nie obiecujemy, że filtr nazwisk albo numerów zapewni anonimizację dowolnego tekstu. Pełna swobodna rozmowa z treścią akt wymaga odrębnego projektu i zgodności z zasadami dotyczącymi tych materiałów.

Pole „Dlaczego taka kwota?” pokazuje lokalne części obliczenia, również w sprawie z PDF-em. Dzięki temu wyjaśnienie indywidualnego wyniku nie wymaga przesyłania kwot ani danych zdrowotnych do modelu.

Zaktualizować opis prywatności: wywiad zostaje w pamięci strony, jawnie wskazać zwykły kanał swobodnego tekstu, dozwolone tematy po PDF-ie i odczyt głosowy. Nie generować zdalnego audio z indywidualnymi danymi dokumentu. Zachować MP3 i obecny podpis odpowiedzi pomocy; przy nieobsługiwanym odczycie pokazać stan dostępności.

W API walidować pola, rozmiary i konteksty przed wywołaniem dostawcy; błędy nie logują treści rozmowy ani dokumentu. Przed publicznym wdrożeniem potwierdzić limity żądań i wydatków. Nie implementować pozornego globalnego limitu jako mapy w pamięci procesu serverless.

## 9. Komponenty i integracja

Nowe komponenty funkcji w `src/features/parent`, z własnymi CSS Modules:

- `InterviewTurn.tsx`: tekst pytania jako `MilaMessage.children`, kontrolki jako `smartComponents`, lokalne wyjaśnienie, pominięcie i korekta.
- `DiscoveryTurn.tsx`: podsumowanie i lista kart z akcjami do spraw oraz pytaniami uzupełniającymi.
- `ProcedureQuestionTurn.tsx`: pytania banku katalogu, w tym liczby i okresy hospitalizacji.

Współdzielić kontrolki i elementy karty tam, gdzie mają realnie te same zachowania. Nie dodawać nowego katalogu ogólnych komponentów na potrzeby pojedynczego widoku. Używać `Button`, `IconButton`, `Sheet`, `MilaMessage` i istniejących ikon. Nowe kolory semantyczne tylko w `tokens.css`, po sprawdzeniu odbiorców.

Rozszerzyć `CaseTurn` o wywiad, dopasowanie i pytanie procedury, a `ParentThread` o ich renderowanie. Podczas pomocy poprzednie pytanie pozostaje dostępne; tekst pomocy nie usuwa jego przycisków. Aktualnie aktywne kontrolki muszą wynikać z etapu i rewizji, nie wyłącznie z pozycji ostatniej wiadomości w tablicy.

`CaseConversation` zachowuje istniejące zachowanie przewijania i fokusowania, lecz tytuł sprawy przed wyborem świadczenia może brzmieć „Wywiad o świadczeniach”. Nie zmieniamy układu całej strony. `MilaGuide` nadal izoluje stan poszczególnych rozmów.

`CaseTools` oraz widok planu używają wspólnego adaptera profilu, z widoczną perspektywą osoby. Odhaczenia zadań przenieść do stanu sprawy, jeśli powrót do dopasowania lub zmiana widoku obecnie je resetuje. Nie dodawać przechowywania odpowiedzi w `localStorage`.

Nowe stałe objaśnienia pomocy uwzględnić w `getStaticHelpTexts` i istniejącym procesie przygotowania nagrań. Sprawdzić `audioManifest.json` oraz `bun run audio:generate` dla nowych tekstów, używając fikcyjnych i ogólnych treści. Wywiad nie czeka na audio, a niedostępność nagrania nie blokuje odpowiedzi.

Zachować granicę klienta na istniejącym wejściu `MilaGuide`. Katalog i czyste przejścia mają działać w przeglądarce; klucze i SDK generujące odpowiedzi zostają po stronie serwera. Reguły wynikają z dokumentacji zainstalowanej wersji Next.js i AI SDK, nie z pamięci innych wersji.

## 10. Kolejność implementacji

| Etap | Zakres                                                                 | Wynik możliwy do odebrania                                                                      |
| ---- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 0    | Zapis stanu bazowego, istniejących zmian i kontroli projektu           | Lista zastanych błędów, żadnego nadpisania pracy użytkownika                                    |
| 1    | Typy, bank pytań, czyste przejścia wywiadu i korekty                   | Pełny przygotowany wywiad działa w testach bez sieci                                            |
| 2    | Adaptery osób i danych, rejestr skierowań, dopasowanie procedur        | Ten sam profil daje powtarzalną listę i właściwe akcje                                          |
| 3    | Integracja `CaseSession`, hooka, wiadomości oraz startu                | Użytkownik przechodzi wywiad i widzi karty w prawdziwym czacie                                  |
| 4    | Pytania procedur, przejście do kalkulatorów i powrót                   | Jedna sprawa rodziny prowadzi do kilku sprawdzonych możliwości bez powtarzania danych wspólnych |
| 5    | Wyjaśnienia, konteksty API, obsługa końcowego wyniku i PDF-u           | Pomoc działa bez utraty pytania i bez wysyłania akt                                             |
| 6    | Próby przeglądarkowe, poprawki dostępności, opis zakresu i prywatności | Przejście kryteriów odbioru i gotowość do osobnego wdrożenia                                    |

Etapy są zależne w tej kolejności. Po etapie 4 musi działać kompletna ścieżka produktu bez AI; etap 5 ją wzbogaca. Nie rozpoczynać prac od zmiany samego promptu, bo nie rozwiąże to braku wspólnego stanu i dopasowania.

Proponowane granice commitów:

1. `feat(interview): add predefined intake state and branching`
2. `feat(discovery): match procedures and route to existing calculators`
3. `feat(chat): connect intake and discovery to the conversation`
4. `feat(guide): continue procedure assessment and preserve interview answers`
5. `fix(ai): support follow-up help without exposing document data`
6. `test(guide): verify interview journeys and update product documentation`

## 11. Mapa zmian w plikach

| Plik lub grupa                                                      | Zaplanowana zmiana                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/features/parent/interview.ts`                                  | Typy, pytania, gałęzie i lokalne objaśnienia                        |
| `src/features/parent/interview-session.ts`                          | Czyste przejścia, pomijanie, korekty, rewizje                       |
| `src/features/parent/interview-profile.ts`                          | Projekcje do katalogu i aktywnej sprawy, przypisanie osoby          |
| `src/data/discovery.ts`                                             | Metadane kart i docelowe akcje dla istniejących procedur            |
| `src/engine/discover-procedures.ts`                                 | Ocena z wykorzystaniem katalogu i wybór kolejności kart             |
| `src/features/parent/case-session.ts`                               | Wywiad i nowe rodzaje wiadomości w jednej sprawie                   |
| `src/features/parent/useParentWorkspace.ts`                         | Start, odpowiedzi, pomoc, przejścia i anulowanie żądań              |
| `src/features/parent/StartActions.tsx`                              | Główna akcja wywiadu i zachowany skrót świadczenia                  |
| `src/features/parent/ParentThread.tsx`                              | Renderowanie, aktywne kontrolki, korekta wywiadu                    |
| Nowe komponenty wymienione w sekcji 9                               | Pytania i dopasowanie z CSS Modules                                 |
| `src/features/parent/CaseTools.tsx`                                 | Wspólna projekcja, pełniejszy plan, zachowanie odhaczeń             |
| `src/features/parent/BenefitTurn.tsx`, `ParentResult.tsx`           | Powrót do dopasowania i lokalne wyjaśnienie wyniku                  |
| `src/features/parent/DocumentTurn.tsx`, `case-documents.ts`         | Integracja potwierdzonych danych z wywiadem i celem sprawy          |
| `src/features/parent/parent-intent.ts`, `case-assistant-context.ts` | Akcja startu, filtrowanie kontekstu i kontrola trybu                |
| `src/app/api/parent-intent/route.ts`                                | Instrukcje rozpoznania startu bez sterowania przygotowanym wywiadem |
| `src/app/api/guide-help/route.ts`                                   | Nowe jawne konteksty i przygotowane tematy                          |
| `src/features/guide/helpAnswers.ts`, `helpKnowledge.ts`             | Objaśnienia, lokalne odpowiedzi i zakres wiedzy dla tematów         |
| `src/features/guide/audioManifest.json`, `public/audio/mila`        | Nagrania nowych stałych objaśnień przy zachowaniu obecnego procesu  |
| `src/features/guide/CaseConversation.tsx`                           | Tytuł, fokus i obsługa nowego etapu                                 |
| `src/features/landing/LandingPrivacy.tsx`, `README.md`              | Faktyczny przebieg wywiadu, rola AI i przepływ danych               |
| `tests/interview.test.ts`, `tests/discovery.test.ts`                | Gałęzie, korekty, osoby, skierowania i braki                        |
| Istniejące testy rozmowy, pomocy, kalkulatorów i landingu           | Regresje oraz nowe kontrakty                                        |

Starego `flow.ts`, `conversation.ts` i `QuestionTurn.tsx` nie usuwać automatycznie. Przed ewentualnym uproszczeniem wyszukać ich rzeczywistych odbiorców, w tym przykład landingu. Nie odtwarzać usuniętych przez użytkownika `StartTopicContext.tsx` i jego CSS jako skutku ubocznego tej pracy.

## 12. Testy i odbiór

### Testy logiki

- Planowanie kończy się przygotowaniami, bez wymyślonej ciąży i wyliczonego prawa.
- Ciąża na etacie, na zleceniu, przy działalności oraz inna sytuacja mają właściwe gałęzie.
- Drugi rodzic jest odróżniony od osoby rodzącej. Dane jednej osoby nie rozstrzygają ubezpieczenia i kwoty drugiej.
- Narodziny z nieznaną datą nadal pozwalają zobaczyć braki; przyszła data urodzenia jest odrzucana.
- `false`, `unknown`, `deferred` i brak odpowiedzi nie są utożsamiane.
- „Nie wiem” nie powoduje pętli pytań. Korekta przywraca potrzebną gałąź i usuwa tylko zależne odpowiedzi.
- Zmiana zatrudnienia, daty i osoby unieważnia stare indywidualne obliczenie.
- Każda procedura ma realną akcję. Nie ma przycisku do nieistniejącego kalkulatora.
- Urlop i odpowiadający mu zasiłek pozostają odrębnymi sprawami.
- Przed narodzinami odpowiedzi przyszłe zachowują warunkowy status.
- Brak lub historyczna wersja reguł zachowuje informację o konieczności sprawdzenia.
- Wybrane tematy z adresu nie stają się odpowiedzią ani nie usuwają innych dopasowań.
- Zmiana danych aktualizuje listę bez zmieniania reguł liczenia istniejących kalkulatorów.

### Testy API i prywatności

- Przyciski wywiadu oraz przejście do dopasowania wykonują zero wywołań modeli.
- Przygotowany temat wysyła tylko identyfikator, bez historii, kwot, dat, imion i OCR.
- Nieznany `topicId`, kontekst lub dodatkowe pole profilu jest odrzucane przed wywołaniem dostawcy.
- Dopytanie po wyniku nie jest zastępowane ponownie wyświetlonym wynikiem.
- Próba wymuszenia przez model innej kwoty nie zmienia danych ani lokalnego wyniku.
- Własny PDF nie trafia do `/api/parent-intent` ani pomocy. Swobodny tekst w chronionej sprawie nie jest wysyłany automatycznie.
- Timeout, 503 i nieprawidłowy JSON pozostawiają działający wywiad, pytanie i lokalne wyjaśnienie.
- Spóźniona odpowiedź po korekcie lub przełączeniu sprawy nie pojawia się w nowym kontekście.
- Zdalny odczyt głosowy nie otrzymuje indywidualnych danych sprawy z dokumentu.

### Scenariusze w przeglądarce

Playwright w trybie headless, desktop i telefon; dane wyłącznie fikcyjne. Repozytorium nie ma bezpośredniej zależności Playwright w `package.json`, więc najpierw sprawdzić dostępne CLI i Chromium. Nie zmieniać pliku lock tylko po to, by zapisać ten plan; podczas implementacji dodać minimalną zależność developerską wyłącznie, jeśli jest potrzebna do trwałego uruchamiania scenariuszy.

1. Osoba bez wiedzy o świadczeniach: start → wywiad → karty → uzupełnienie sprawy → wynik → dokumenty → powrót.
2. Osoba w ciąży i na zleceniu, nieznająca ubezpieczenia: pominięcie → warunkowe dopasowanie → instrukcja sprawdzenia → późniejsze uzupełnienie.
3. Drugi rodzic po narodzinach: brak pomylenia ról → właściwa karta → obecny kalkulator ojcowskiego.
4. Planowanie ciąży: krótka ścieżka przygotowań, bez pytań o datę urodzenia i podstawę zasiłku.
5. Własny fikcyjny PDF: lokalny odczyt → potwierdzenie → wywiad bez powtórek → wynik → pomoc ogólna z kontrolą żądań sieciowych.
6. „Dlaczego o to pytasz?” w środku wywiadu: odpowiedź i powrót do nadal aktywnego pytania.
7. Edycja zatrudnienia po wyniku: przeliczenie i odświeżenie kart, stary wynik widocznie nieaktualny.
8. Dwie rozmowy: przełączenie nie miesza danych, odpowiedzi AI ani odhaczeń.
9. Całkowita niedostępność usług AI: pełny wywiad i szczegółowe obliczenie nadal osiągalne.
10. Skrót znanego świadczenia, przykłady, strata i adopcja: istniejące wejścia pozostają dostępne.

Sprawdzić Tab, Shift+Tab, Enter, spację, fokus po pytaniu i korekcie, powrót z `Sheet`, nazwy dostępne przycisków, komunikat błędu powiązany z polem oraz `prefers-reduced-motion`. Brak pułapek fokusu i poziomego przewijania na telefonie. Nie dodawać testów kopiujących wygląd CSS; testować przebieg i skutki.

Kontrole końcowe: `bun run check` oraz `bun run build`. Do tego scenariusze Playwright i ograniczona próba prawdziwego AI na fikcyjnych pytaniach, oceniona względem oczekiwanej roli i źródeł. Testy sieciowe z atrapą dostawcy pozostają podstawą powtarzalnego CI.

### Kryteria zakończenia

- Osoba nieznająca żadnej nazwy świadczenia dochodzi do użytecznej listy spraw.
- Cała główna ścieżka działa bez klucza AI.
- Każdy wynik mówi, dla kogo jest, na jakich danych się opiera i czego brakuje.
- Można sprawdzić więcej niż jedną sprawę i wrócić do wywiadu bez przepisywania danych wspólnych.
- AI nie ustala kwot, nie dopisuje uprawnienia i nie otrzymuje treści lokalnych akt.
- Po PDF-ie dostępne są lokalne wyjaśnienia i przygotowane ogólne tematy AI.
- Wynik prowadzi do dokumentów i właściwej instrukcji, bez obietnicy złożenia wniosku przez Milę.
- Testy istniejących kalkulatorów zachowują wyniki, a nowe scenariusze i kontrole projektu przechodzą.

## 13. Stan bazowy i ograniczenia realizacji

Branch `ejaj` powstał z `main` przy rewizji `86991af`. W chwili przygotowania planu katalog roboczy zawierał wcześniejsze zmiany w `bun.lock`, `LandingPaperwork.tsx`, `StartActions.tsx` i usunięcie obu plików `StartTopicContext`. Nie należą do realizacji tego planu i nie wolno ich nadpisywać ani automatycznie dołączać do commitów.

W poprzedniej kontroli tego checkoutu 151 testów, lint i walidacja katalogu przeszły. Formatowanie zatrzymało się na `LandingPaperwork.tsx`, a typecheck zgłaszał błędy wygenerowanych `.next/dev/types`, w tym odwołanie do nieistniejącego layoutu czatu. Przed implementacją ponownie ustalić stan bazowy; nie traktować starego wyniku jako aktualnego odbioru. Nie edytować wygenerowanych typów ręcznie. Ewentualne czyszczenie cache ma dotyczyć wyłącznie zweryfikowanej ścieżki `.next` tego projektu.

Największe ryzyko funkcjonalne to pomylenie osoby i dnia oceny pomiędzy wywiadem, katalogiem i szczegółową sprawą. Dlatego adaptery oraz testy ról powstają przed interfejsem. Drugie ryzyko to pozorna kompletność krótkiego wywiadu; rozwiązuje je jawny status braków i późniejsze pytania. Trzecie to ujawnienie treści akt w dopytaniu; pierwsza wersja po PDF-ie dopuszcza do AI jedynie przygotowane tematy.

Plan nie zmienia obecnych wartości prawnych. Jeśli implementacja będzie wymagała nowych warunków lub rozszerzenia kwalifikacji na wyjątki, trzeba zweryfikować właściwe oficjalne źródło i dopisać przypadek kontrolny przed zmianą reguły.
