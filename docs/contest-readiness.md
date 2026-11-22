# Cel: doprowadzenie Mili do gotowości konkursowej

Przejmij rolę inżyniera odpowiedzialnego za końcowy odbiór techniczny i funkcjonalny Mili przed oceną jury HackNation. Twoim zadaniem jest zweryfikowanie i doprowadzenie istniejącego produktu do możliwie pełnej zgodności z oficjalnymi wymaganiami ZUS.

Nie traktuj tego jako zadania projektowania nowej aplikacji, kolejnego researchu ani reorganizacji architektury. Mila już istnieje. Chcemy ją ukończyć.

## 1. Źródła prawdy

Przeczytaj:

- AGENTS.md
- README.md
- docs/checklista-wymagan-zus.md
- docs/plan-aplikacji-zus.md
- Pełną treść zadania konkursowego ZUS.
- Regulamin zadania konkursowego.
- Załączone materiały prawne, tabele świadczeń, poradnik oraz dostępne przykładowe sprawy w lokalnym katalogu Sprawy/.

Oficjalne wymagania konkursowe i właściwe przepisy mają pierwszeństwo przed wcześniejszymi planami, dokumentacją i założeniami implementacji.

Dokumentacja repozytorium może być nieaktualna. Nie traktuj oznaczonych checkboxów ani poprzednich raportów jako dowodu działania funkcjonalności.

## 2. Docelowy produkt

Mila jest konwersacyjnym przewodnikiem po świadczeniach związanych z ciążą i rodzicielstwem.

Użytkownik może opisać swoją sytuację naturalnym językiem, skorzystać z dostępnych akcji lub dodać dokumentację. Mila ustala brakujące informacje, prowadzi użytkownika do właściwych narzędzi, pokazuje indywidualne uprawnienia, okresy, kwoty, uzasadnienia, dokumenty oraz dalsze formalności.

AI odpowiada za rozumienie rozmowy, dobór narzędzi i naturalne wyjaśnianie. Deterministyczny silnik odpowiada za reguły prawne, walidację, obliczenia i wyniki.

Wszystkie istotne funkcje konkursowe powinny pozostać osiągalne również przy niedostępności modelu AI. Nie oznacza to tworzenia równoległej architektury — wykorzystaj istniejące komponenty i wspólny silnik.

## 3. Ustal rzeczywisty stan projektu

Rozpocznij od sprawdzenia aktualnego katalogu roboczego, git status, różnic względem HEAD, istniejących testów oraz dostępnych poleceń.

Uwzględnij lokalne, niezacommitowane zmiany. Nie cofaj ani nie nadpisuj cudzej pracy.

Uruchom istniejące sprawdzenia:

- bun run check
- bun run build

Następnie uruchom aplikację i sprawdź najważniejsze funkcje w rzeczywistej przeglądarce, korzystając z dostępnych narzędzi Playwright.

Nie uznawaj funkcjonalności za działającą wyłącznie dlatego, że istnieje odpowiedni komponent, endpoint lub test jednostkowy.

Zaktualizuj istniejącą checklistę wymagań ZUS, zamiast tworzyć kolejne obszerne dokumenty planistyczne. Dla każdego wymagania wskaż jego aktualny stan, dowód działania oraz konkretny brak.

## 4. Priorytet prac

Realizuj zadania w następującej kolejności:

P0 — poprawność i możliwość oddania projektu:

- Praktyczne użycie aplikacji przez jury bez instrukcji programisty i bez znajomości wewnętrznych komend.
- Poprawny przebieg od rzeczywistego PDF-u konkursowego do oceny ubezpieczenia, uprawnienia, okresu i kwoty.
- Poprawność deterministycznych obliczeń dla obsługiwanych przypadków.
- Wyeliminowanie błędnych założeń, nieprawidłowych wyników i blokujących błędów.
- Dostępność najważniejszych ścieżek również przy awarii AI.
- Działające wdrożenie, dostęp jury do repozytorium oraz wymagane materiały zgłoszeniowe.

P1 — kompletność:

- Uzupełnienie braków we wszystkich wymaganiach a–j z sekcji 3 zadania ZUS.
- Szczególne sytuacje, symulacje usług, formularze, panel zmiany parametrów.
- Naturalne powiązanie funkcjonalności z rozmową.
- Responsywność i dostępność wszystkich istotnych ścieżek.

P2 — pozostałe usprawnienia:

- Wyłącznie konkretne problemy jakościowe, które zostały znalezione podczas odbioru i których usunięcie nie zagraża stabilności.

Wymagania P1 nadal są wymaganiami konkursowymi. Priorytet określa kolejność realizacji, a nie zgodę na ich pominięcie.

## 5. Weryfikacja logiki biznesowej

Przeanalizuj każdy punkt wymagań ZUS i zamień go na mierzalne przypadki testowe.

W szczególności sprawdź:

- Chorobowe w ciąży, okresy wyczekiwania, rehabilitacyjne i zasiłek w wysokości macierzyńskiego po ustaniu zatrudnienia.
- Macierzyński, ojcowski, rodzicielski i uzupełniający macierzyński.
- Różną liczbę dzieci, ich wiek, wcześniactwo, hospitalizację, zaświadczenie „Za życiem”, martwe urodzenie i śmierć dziecka.
- Przejęcie macierzyńskiego przez ojca, również szczególne przypadki wcześniejszego przejęcia.
- Podział opieki, jednoczesne korzystanie z rodzicielskiego i nieprzenoszalne tygodnie.
- Faktyczny status ubezpieczenia obojga rodziców, bez zakładania aktywnego ubezpieczenia drugiego rodzica.
- Łączenie rodzicielskiego z pracą, okres wydłużenia, stawki dzienne i dopuszczalne limity.
- Adopcję i niezawodową pieczę zastępczą.
- Indywidualną podstawę zasiłku, daty obowiązywania przepisów, zaokrąglenia, płatnika, zadłużenie, dokumenty i terminy.
- Możliwość zmiany parametrów prawnych i rzeczywisty wpływ tej zmiany na kalkulator.

Oczekiwane wyniki ustalaj niezależnie na podstawie materiałów prawnych, tabel oraz dostępnych rozstrzygnięć. Nie wyprowadzaj oczekiwanych wyników testów z obecnego kodu kalkulatora.

Testuj zarówno przypadki pozytywne, odmowne, graniczne, niekompletne, jak i sprzeczne.

Nie zgaduj reguł prawnych. Jeśli materiały nie pozwalają na jednoznaczne ustalenie odpowiedzi, zachowaj odpowiedni status niepewności i wskaż konkretną przyczynę.

## 6. Akta konkursowe — najważniejszy test jury

Zinwentaryzuj lokalne przykładowe sprawy ZUS. Pogrupuj je według rodzaju świadczenia, decyzji i istotnych okoliczności.

Dla dostępnych przypadków ustal, na ile materiały pozwalają niezależnie potwierdzić:

- stan ubezpieczenia na właściwy dzień,
- prawo do świadczenia lub przyczynę odmowy,
- okres przysługiwania,
- podstawę wymiaru,
- stawkę,
- kwotę świadczenia,
- płatnika i wymagane dokumenty.

Zweryfikuj deterministyczny silnik na możliwie szerokim zbiorze przypadków, a reprezentatywne sprawy z każdej kategorii przeprowadź od otwarcia PDF-u aż do wyniku w rzeczywistej przeglądarce.

Oddziel ocenę skuteczności OCR od oceny poprawności obliczeń. Jeżeli OCR nie rozpozna części pól, użytkownik musi móc je sprawdzić na odpowiedniej stronie i uzupełnić ręcznie.

Decyzja ZUS służy do porównania wyniku, a nie do ustalania wyniku przez kalkulator.

Nie stosuj zakodowanych odpowiedzi dla konkretnych nazw plików ani innych sposobów pozornego zaliczania przypadków.

Nie kopiuj, nie publikuj ani nie wysyłaj akt konkursowych i ich treści do zewnętrznych usług. Zachowaj lokalne przetwarzanie. Publiczne testy, przykłady i materiały demonstracyjne powinny korzystać z własnych fikcyjnych danych.

## 7. Odbiór z perspektywy jurora

Przetestuj Milę jako osoba, która pierwszy raz otwiera aplikację i nie zna jej architektury.

Sprawdź co najmniej:

- wejście z ekranu startowego,
- ustalenie uprawnień na podstawie naturalnej rozmowy,
- samodzielne odnalezienie kalkulatora,
- import rzeczywistego dokumentu,
- zmianę danych i ponowne obliczenie,
- porównanie wariantów dla obojga rodziców,
- przygotowanie odpowiedniego wniosku,
- wszystkie wymagane symulacje urzędowe,
- interfejs mobilny,
- nieprawidłowe dane i nieczytelne dokumenty,
- niedostępność lub błędną odpowiedź API AI,
- przełączanie spraw i brak przenikania danych między nimi.

Przetestuj różne naturalne sformułowania tego samego pytania. Nie opieraj poprawności produktu na jednym wcześniej przygotowanym tekście demonstracyjnym.

Wyniki generowane przez AI nie mogą zmieniać ani przeczyć zwalidowanym wynikom silnika.

## 8. Zasady implementacji

Zachowaj istniejącą architekturę, konwencje AGENTS.md, Next.js, TypeScript, CSS Modules i istniejący design system.

Naprawiaj przyczyny problemów, a nie ich objawy. Wykorzystuj istniejące mechanizmy, jeżeli są odpowiednie.

Nie wprowadzaj nowych bibliotek, rozbudowanych abstrakcji, kolejnego redesignu, zmian maskotki ani eksperymentów z modelami AI, chyba że rozwiązują konkretny, odtworzony problem z wymaganiem konkursowym.

Nie duplikuj reguł biznesowych pomiędzy kalkulatorem, promptami AI i komponentami UI.

Nie osłabiaj testów, walidacji ani wymagań w celu uzyskania zielonego wyniku.

Pracuj małymi, spójnymi etapami. Po każdej zmianie zweryfikuj odpowiednie testy, a przy zmianie zachowania interfejsu również ścieżkę w przeglądarce.

Przed przejściem do kolejnego etapu napraw wykryte regresje albo jednoznacznie udokumentuj blokadę.

## 9. Definicja ukończenia

Projekt można uznać za gotowy do oddania, gdy:

- Wszystkie jawne wymagania konkursowe mają w istniejącej checkliście odpowiadające im kryteria odbioru.
- Status każdego wymagania jest uzasadniony konkretnym dowodem.
- Wszystkie przypadki uznane za obsługiwane dają poprawne wyniki zgodne z niezależnie ustaloną wartością oczekiwaną.
- Reprezentatywne ścieżki są potwierdzone od początku do końca w przeglądarce.
- bun run check i bun run build przechodzą.
- Nie ma znanych blokujących błędów ani błędnych obliczeń w obsługiwanych przypadkach.
- Potwierdzono publiczne demo odpowiadające wersji kodu przekazywanej jury lub wskazano konkretną zewnętrzną blokadę.
- Zweryfikowano komplet wymaganych materiałów zgłoszeniowych, w tym film do 3 minut, prezentację do 10 slajdów, opis, zrzuty ekranów, dostęp do kodu i demonstracji oraz informację o wykorzystaniu AI.

Nie deklaruj 100% zgodności, jeżeli nie została udowodniona.

## 10. Sposób pracy i raportowania

Rozpocznij od krótkiego preflightu i przedstaw maksymalnie pięć najważniejszych problemów w kolejności ich wpływu na ocenę konkursową. Następnie wykonuj i weryfikuj konkretne poprawki, zamiast kończyć na przedstawieniu kolejnego planu.

Nie wymagaj od nas zatwierdzania każdej oczywistej naprawy. Zatrzymaj się przy rzeczywistej blokadzie prawnej, braku niezbędnych danych, konflikcie równoległych zmian lub konieczności wykonania zewnętrznej czynności.

Raportuj zwięźle:

- Co było niepoprawne.
- Co zostało naprawione.
- Jak zostało zweryfikowane.
- Jaki jest następny najważniejszy krok.

Na końcu przedstaw aktualną macierz wymagań: spełnione, częściowo spełnione, niespełnione, niezweryfikowane. Podaj dowody, pozostałe ryzyka i czynności wymagane przed zgłoszeniem.

Nadrzędny cel: działająca, wiarygodna i kompletna Mila, którą juror może samodzielnie przetestować bez naszej pomocy.
