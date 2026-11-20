# Mila — raport badawczy i specyfikacja danych dla wyzwania ZUS „Przewodnik Przyszłej Mamy”

**Stan prawny i weryfikacja źródeł: 17 listopada 2026 r.** Raport powstał wyłącznie na podstawie niezależnych źródeł pierwotnych i urzędowych: ZUS, gov.pl, ELI/Sejm, PIP, NFZ/pacjent.gov.pl oraz Ministerstwa Finansów. Nie wykorzystuję katalogu, tekstów ani struktury danych zdazymy.pl jako źródła merytorycznego.

Najważniejszy wniosek implementacyjny jest taki: **Mila nie powinna przechowywać „dokumentów do przeczytania przez AI”, lecz wersjonowany, lokalny model faktów prawnych i proceduralnych.** Źródłowe ustawy, strony ZUS i formularze są warstwą dowodową/audytową; rekomendację generuje deterministyczny silnik reguł z danych JSON/TypeScript. Taki model jest szybki, offline-first i przede wszystkim pozwala bezpiecznie odpowiedzieć „brakuje mi danych”, zamiast zgadywać.

## Zakres wyzwania i granice produktu

Publiczny opis HackNation 2026 potwierdza tylko ogólny cel zadania ZUS. Inicjatorem jest Zakład Ubezpieczeń Społecznych, kampania nazywa się **„Przewodnik Przyszłej Mamy”**, a zadaniem jest stworzenie aplikacji pomagającej przyszłym i świeżo upieczonym rodzicom odnaleźć się w świadczeniach, uprawnieniach i formalnościach związanych z ciążą oraz rodzicielstwem i zamienić skomplikowane procedury w prostą ścieżkę. Publiczna karta zadania nie definiuje konkretnej technologii, obowiązkowego AI, liczby świadczeń, integracji z ZUS ani obowiązku automatycznego składania wniosków. citeturn868757search0turn868757search1

To oznacza, że następujące elementy są **interpretacją produktową zespołu**, a nie wymaganiem organizatora: konwersacyjna Mila, lokalny katalog JSON, deterministyczny rules engine, rekomendacje „dlaczego to widzę?”, edycja wcześniejszych odpowiedzi i przeliczanie planu. Są one jednak bardzo dobrze zgodne z publicznym celem wyzwania. citeturn868757search0

Granica odpowiedzialności aplikacji powinna być wyraźna. ZUS obsługuje m.in. zasiłki z ubezpieczenia chorobowego, 800+ oraz program Aktywny Rodzic, ale rejestracja urodzenia należy do USC, świadczenie rodzicielskie i becikowe zazwyczaj do gminy/MOPS, zgłoszenie członka rodziny do ubezpieczenia zdrowotnego odbywa się poprzez płatnika/ZUS, urlopy pracownicze wymagają działań wobec pracodawcy, a ulga na dziecko jest sprawą podatkową. citeturn247316search0turn474417view3turn474417view5turn247316search16turn363956search7

### Zmiany szczególnie istotne dla danych w 2025–2026

**Uzupełniający urlop macierzyński** dla rodziców wcześniaków i dzieci hospitalizowanych wszedł w życie 19 marca 2025 r. W zależności od tygodnia ciąży, masy urodzeniowej i hospitalizacji może wynosić do 8 albo do 15 tygodni. Analogicznie rozszerzono okres świadczenia rodzicielskiego dla osób nieuprawnionych do zasiłku macierzyńskiego. citeturn363956search10turn474417view7turn247316search13

W październiku 2026 r. ZUS przebudował część formularzy zasiłkowych. Od **24 października 2026 r.** nowy formularz **ZAM** pełni centralną rolę przy wnioskach o zasiłek macierzyński, a od 26 października aktualny **Z-15** zastąpił wcześniejsze formularze Z-15a/Z-15b dla zasiłku opiekuńczego. To bardzo ważne dla lokalnego katalogu: stary kod formularza może stać się nieaktualny praktycznie z dnia na dzień. citeturn868757search3turn363956search5turn569705view7

We wrześniu 2026 r. ZUS wdrożył także nowe wersje kreatorów programu Aktywny Rodzic: AWP, AWZ i AWD oraz formularzy informacyjnych/odwoławczych. Te wnioski nie są zwykłymi PDF-ami: ZUS udostępnia je jako **interaktywne kreatory elektroniczne**, których nie da się ręcznie pobrać i wypełnić jak klasycznego druku. citeturn363956search2turn363956search3

Dlatego model `Document` musi odróżniać co najmniej `pdf-form`, `online-wizard`, `employer-document`, `statement`, `medical-certificate`, `legal-act` i `information-page`.

## Pełna mapa podróży od ciąży do około dwóch lat po porodzie

Nie każda osoba przejdzie wszystkie poniższe ścieżki. Silnik Mili powinien traktować je jako **kandydatów do oceny**, a nie checklistę obowiązkową.

| Moment | Formalność / uprawnienie | Organ | Czy ZUS? | Dane potrzebne Mili |
|---|---|---|---|---|
| ciąża | ochrona stosunku pracy | pracodawca / PIP | nie | rodzaj umowy, termin umowy, etap ciąży |
| ciąża | ograniczenia pracy / szczególne prawa pracownicze | pracodawca | nie | etat, ciąża |
| ciąża | L4 i świadczenie chorobowe | pracodawca / ZUS | tak/częściowo | tytuł ubezpieczenia, chorobowe, e-ZLA |
| ciąża | 100% podstawy przy niezdolności przypadającej w ciąży | ZUS/płatnik | tak | kod B lub zaświadczenie o ciąży |
| przed porodem | rozpoczęcie urlopu/zasiłku macierzyńskiego przed porodem | pracodawca/ZUS | tak | status pracowniczy, przewidywana data porodu |
| poród | rejestracja urodzenia | USC | nie | karta urodzenia, rodzice |
| poród | akt urodzenia, PESEL, meldunek | USC | nie | wynik rejestracji |
| po porodzie | zgłoszenie dziecka do zdrowotnego | płatnik/ZUS | tak technicznie | kto ubezpiecza dziecko |
| po porodzie | urlop macierzyński | pracodawca | nie, ale zasiłek tak | liczba dzieci, pracownik |
| po porodzie | zasiłek macierzyński | ZUS/płatnik | tak | ubezpieczenie chorobowe, status, liczba dzieci |
| po porodzie | uzupełniający urlop macierzyński | pracodawca | zasiłek w ZUS | tydzień ciąży, masa, hospitalizacja |
| dalej | urlop rodzicielski | pracodawca | zasiłek w ZUS | rodzice, plan podziału urlopu |
| dalej | urlop ojcowski | pracodawca | zasiłek w ZUS | ojciec ubezpieczony/pracownik, wiek dziecka |
| dalej | urlop wychowawczy | pracodawca | zasadniczo nie | staż pracy, wiek dziecka |
| opieka | zasiłek opiekuńczy | ZUS/płatnik | tak | rodzaj opieki, wiek dziecka, wykorzystany limit |
| narodziny | 800+ | ZUS | tak | rodzic/opiekun, PESEL, data urodzenia |
| narodziny | becikowe | gmina/MOPS | nie | dochód, opieka medyczna od 10. tygodnia |
| narodziny | świadczenie rodzicielskie | gmina/MOPS | nie | brak prawa do odpowiedniego zasiłku macierzyńskiego, sytuacja rodzinna |
| narodziny | zasiłek rodzinny + dodatki | gmina/MOPS | nie | dochód rodziny, liczba dzieci, sytuacje dodatkowe |
| 12–35 mies. | Aktywni rodzice w pracy | ZUS | tak | aktywność obojga/samotnego rodzica, podstawy składek |
| żłobek | Aktywnie w żłobku | ZUS | tak | placówka, opłata, inne świadczenia AR |
| 12–35 mies. | Aktywnie w domu | ZUS | tak | wiek, brak konkurencyjnego komponentu |
| rozliczenie PIT | ulga na dziecko | US | nie | liczba dzieci, sytuacja dochodowa, wykonywanie władzy |

Źródła mapy: ZUS, gov.pl, PIP i pacjent.gov.pl. citeturn868757search9turn247316search6turn868757search4turn247316search0turn247316search23turn474417view6turn815495view0turn815495view1turn815495view2turn474417view5turn815495view3turn815495view4turn363956search7

### Ciąża i prawa pracownicze

Pracownica w ciąży jest szczególnie chroniona przed wypowiedzeniem i rozwiązaniem umowy. Przy umowie o pracę na czas określony lub okres próbny przekraczający miesiąc, która miałaby się rozwiązać po upływie trzeciego miesiąca ciąży, zasadą jest przedłużenie do dnia porodu; istnieją ustawowe wyjątki, dlatego Mila nie powinna wyciągać takiego wniosku wyłącznie z pytania „czy masz umowę na czas określony?”. citeturn868757search9turn123976search8

Dla kodu oznacza to osobną procedurę `EMPLOYMENT_PREGNANCY_PROTECTION`, która przy braku szczegółów zwraca `possible` lub `missing-data`, a nie automatyczne „umowa zostanie przedłużona”.

### Choroba i L4 w ciąży

Zasiłek chorobowy wymaga podlegania odpowiedniemu ubezpieczeniu i spełnienia warunków z ustawy zasiłkowej. Okres zasiłkowy wynosi co do zasady 182 dni, a przy niezdolności przypadającej w czasie ciąży może wynosić do 270 dni. Do wypłaty świadczenia w wysokości 100% podstawy z tytułu niezdolności przypadającej w okresie ciąży ZUS wymaga m.in. e-ZLA z kodem `B` albo odrębnego zaświadczenia lekarskiego potwierdzającego ciążę. citeturn247316search6turn815495view6turn123976search19

Jeżeli zasiłek wypłaca ZUS, dokumenty płatnika zależą od tytułu ubezpieczenia: m.in. `Z-3` dla pracowników, `Z-3a` dla wielu innych ubezpieczonych. Nie należy więc oznaczać `Z-3` jako „formularz dla matki”; zwykle jest to dokument przekazywany przez płatnika składek. citeturn569705view6turn815495view6

### Rejestracja dziecka i ubezpieczenie zdrowotne

Urodzenie dziecka zgłasza się w USC w ciągu **21 dni od sporządzenia karty urodzenia**; przy martwym urodzeniu termin wynosi 3 dni od sporządzenia karty martwego urodzenia. Po rejestracji USC sporządza akt urodzenia, nadaje/przekazuje PESEL i dokonuje meldunku. Jeśli rodzic nie zgłosi urodzenia w terminie, kierownik USC rejestruje je z urzędu. citeturn247316search0turn123976search0

Rejestracja urodzenia **nie oznacza automatycznego zgłoszenia dziecka do ubezpieczenia zdrowotnego**. Ubezpieczony rodzic przekazuje informację płatnikowi; dla zgłoszenia członka rodziny wykorzystywany jest `ZUS ZCNA`. Termin na przekazanie danych wynosi zasadniczo 7 dni od powstania okoliczności wymagającej zgłoszenia. citeturn247316search10turn247316search16turn247316search23

### Macierzyński i rodzicielski

Zasiłek macierzyński jest świadczeniem ubezpieczeniowym i nie należy utożsamiać go z urlopem macierzyńskim. Pracownik korzysta z urlopu na podstawie Kodeksu pracy; osoba ubezpieczona, która nie jest pracownikiem, może mieć prawo do zasiłku za okres odpowiadający danemu urlopowi, mimo że „urlopu” w rozumieniu prawa pracy nie ma. citeturn123976search19turn868757search4

Dla jednego dziecka podstawowy urlop macierzyński wynosi 20 tygodni; wymiar rośnie przy porodzie mnogim. Rodzicielski wynosi łącznie do 41 tygodni przy jednym dziecku albo 43 tygodni przy porodzie mnogim, a każdemu z rodziców przysługuje nieprzenoszalne prawo do 9 tygodni. Przy dziecku posiadającym odpowiednie zaświadczenie „Za życiem” maksymalne wymiary rodzicielskiego wynoszą odpowiednio 65 i 67 tygodni. citeturn868757search6turn868757search10

Za okres macierzyńskiego zasiłek wynosi 100% podstawy, a za rodzicielski zasadniczo 70%. Jeżeli odpowiedni wniosek zostanie złożony nie później niż 21 dni po porodzie, możliwa jest uśredniona stawka 81,5% za macierzyński i rodzicielski; nieprzenoszalna 9‑tygodniowa część drugiego rodzica pozostaje rozliczana na zasadach 70%. citeturn868757search5turn868757search6

Nowy formularz `ZAM` jest obecnie kluczowym wnioskiem ZUS o zasiłek macierzyński. Gdy świadczenie wypłaca ZUS, dodatkowo wymagane może być zaświadczenie płatnika `Z-3` albo `Z-3a`; ZUS wprost wskazuje wyjątki, dlatego dokumentacja musi być generowana warunkowo. citeturn868757search10turn569705view5turn569705view6

### Wcześniactwo i hospitalizacja

Dla dziecka urodzonego przed 28. tygodniem ciąży lub z masą urodzeniową do 1000 g przysługuje jeden tydzień uzupełniającego urlopu za każdy tydzień hospitalizacji do końca 15. tygodnia po porodzie. Dla dziecka urodzonego po 28., lecz przed 37. tygodniem i ważącego ponad 1000 g limit wynosi 8 tygodni. Osobna reguła obejmuje dzieci urodzone po 37. tygodniu, jeśli pobyt szpitalny trwał co najmniej dwa kolejne dni, a przynajmniej jeden przypadał między 5. a 28. dniem po porodzie. Niepełny tydzień hospitalizacji zaokrągla się w górę. citeturn474417view7

Wniosek pracowniczy o uzupełniający urlop trzeba złożyć co najmniej 21 dni przed zakończeniem macierzyńskiego. Przy porodzie mnogim ustalając wymiar bierze się pod uwagę najniższą masę urodzeniową oraz najdłuższą hospitalizację spośród dzieci. citeturn474417view7

To powinien być osobny moduł `prematurity.ts`, ponieważ jest to klasyczny przypadek, w którym proste `if (premature) return 8 weeks` byłoby błędne.

### Zasiłek opiekuńczy

Od października 2026 r. aktualny podstawowy wniosek to `Z-15`; zastąpił wcześniejsze Z-15a/Z-15b. W zależności od przypadku dochodzą e-ZLA lub inne dowody, np. potwierdzające chorobę niani. Zasiłek opiekuńczy ma roczne limity zależne od osoby, nad którą sprawowana jest opieka; nie należy zapisywać jednego uniwersalnego limitu bez kontekstu. citeturn363956search5turn569705view7turn247316search4

### 800+

Świadczenie wychowawcze wynosi **800 zł miesięcznie na dziecko**, zasadniczo do ukończenia 18 lat. Dla rodzica właściwy jest elektroniczny kreator `SW-R`; istnieją odrębne wnioski m.in. dla opiekunów i pieczy zastępczej. Wnioski są elektroniczne, poprzez eZUS, mZUS, Emp@tię lub — w określonych przypadkach — bankowość. citeturn474417view6turn363956search0

Okres świadczeniowy trwa od 1 czerwca do 31 maja. Wniosek złożony od 1 lutego do 30 czerwca zapewnia ustalenie prawa od początku nowego okresu. W przypadku nowo narodzonego dziecka wniosek złożony w ciągu **3 miesięcy od dnia urodzenia** pozwala ustalić świadczenie od dnia urodzenia; późniejsze złożenie powoduje utratę wyrównania za wcześniejszy okres. citeturn569705view4

### Aktywny Rodzic

Program działa od 1 października 2024 r. i obejmuje trzy wzajemnie wykluczające się dla tego samego dziecka i okresu komponenty. citeturn247316search24turn815495view2

**Aktywni rodzice w pracy** dotyczy zasadniczo dziecka od miesiąca ukończenia 12 miesięcy do końca miesiąca ukończenia 35 miesięcy. Świadczenie wynosi 1500 zł miesięcznie albo 1900 zł przy określonym orzeczeniu o niepełnosprawności. Przy wspólnym wychowywaniu znaczenie ma aktywność obojga rodziców i określony poziom podstaw składek; dla samotnego rodzica stosowana jest odrębna reguła. Urlop wychowawczy i zawieszona działalność nie spełniają warunku aktywności. citeturn815495view0turn474417view2turn569705view0

**Aktywnie w żłobku** to do 1500 zł, ewentualnie do 1900 zł w przypadku wskazanego orzeczenia, ale nie więcej niż faktyczna opłata za pobyt. Środki trafiają do placówki/opiekuna, a nie na konto rodzica. Od 1 kwietnia 2026 do 31 marca 2027 maksymalny koszt pobytu pozwalający na świadczenie wynosi 2200 zł. citeturn815495view1turn569705view1

**Aktywnie w domu** wynosi 500 zł miesięcznie i dotyczy dzieci od 12. do 35. miesiąca życia spełniających warunki programu. citeturn815495view2turn569705view2

Wnioski są elektronicznymi kreatorami ZUS: `AWP`, `AWZ`, `AWD`, nie klasycznymi plikami PDF. citeturn363956search2

### Świadczenia gminne

**Becikowe** wynosi jednorazowo 1000 zł. Wniosek trzeba złożyć zasadniczo w ciągu 12 miesięcy od urodzenia. Prawo jest uzależnione od ustawowego kryterium dochodowego oraz — dla rodzica biologicznego — od pozostawania matki pod opieką medyczną co najmniej od 10. tygodnia ciąży do porodu. Właściwa jest jednostka gminna/MOPS, nie ZUS. citeturn474417view5turn123976search1

**Świadczenie rodzicielskie**, potocznie „kosiniakowe”, wynosi 1000 zł miesięcznie niezależnie od dochodu i dla jednego dziecka przysługuje podstawowo przez 52 tygodnie. Wniosek złożony w ciągu 3 miesięcy pozwala otrzymać świadczenie od miesiąca narodzin; przy późniejszym złożeniu prawo ustala się od miesiąca złożenia. Od 2025 r. okres może zostać wydłużony w związku z hospitalizacją dziecka na zasadach odpowiadających uzupełniającemu urlopowi macierzyńskiemu. Właściwa jest gmina/MOPS, a elektronicznie wniosek można składać przez Emp@tię. citeturn815495view3turn474417view3turn247316search13

**Zasiłek rodzinny i dodatki** są świadczeniami dochodowymi obsługiwanymi przez gminę. Aktualne progi dochodowe wynoszą 674 zł na osobę, a gdy w rodzinie jest dziecko z niepełnosprawnością — 764 zł; działa mechanizm „złotówka za złotówkę”. Jednym z dodatków jest dodatek z tytułu urodzenia dziecka, który również wymaga — poza wyjątkami adopcyjnymi/opiekuńczymi — odpowiedniego udokumentowania opieki medycznej matki od 10. tygodnia ciąży. citeturn247316search11turn815495view4turn123976search1

### Podatek

Ulga prorodzinna jest rozliczana w PIT, nie przez ZUS. W 2026 r. oficjalny poradnik MF wskazuje 92,67 zł miesięcznie na pierwsze i drugie dziecko, 166,67 zł na trzecie i 225 zł na czwarte i każde kolejne, z określonymi limitami dochodowymi przy jednym dziecku i odrębnymi regułami dla dziecka z niepełnosprawnością. Dokumenty rozliczeniowe to m.in. PIT-36/PIT-37 i PIT/O. citeturn363956search7

## Karty procedur do bezpośredniego przeniesienia do katalogu

Poniższe karty zawierają minimum, które powinno znaleźć się w danych. Nie traktowałbym tekstowych opisów jako kodowalnych reguł — warunki powinny być osobnymi atomami.

### `SICKNESS_PREGNANCY`

**Nazwa:** zasiłek chorobowy za niezdolność do pracy przypadającą w okresie ciąży.  
**Organ:** płatnik/ZUS.  
**Odbiorca:** osoba objęta ubezpieczeniem chorobowym, po spełnieniu warunków ustawy zasiłkowej.  
**Profil wymagany:** `employmentType`, `sicknessInsurance`, `sickLeave`, `pregnancyConfirmed`, `payerType`.  
**Kwota:** 100% podstawy w przypadkach przewidzianych dla niezdolności w czasie ciąży; nie zapisywać konkretnej kwoty pieniężnej.  
**Okres:** do 270 dni okresu zasiłkowego w ciąży.  
**Dokumenty:** e-ZLA; kod `B` albo odrębne zaświadczenie potwierdzające ciążę; zależnie od płatnika `Z-3` / `Z-3a` i inne dokumenty. citeturn247316search6turn815495view6turn123976search19  
**Źródło proceduralne:** `https://www.zus.pl/pl/swiadczenia/zasilki/zasilek-chorobowy/`  
**Prawo:** `https://eli.gov.pl/eli/DU/2026/854/ogl` citeturn123976search19  
**Bezpieczny wynik:** jeśli `sicknessInsurance` jest nieznane → `missing-data`, nigdy `eligible=true`.

### `EMPLOYMENT_PREGNANCY_PROTECTION`

**Nazwa:** ochrona pracownicy w ciąży.  
**Organ:** pracodawca; PIP jako źródło informacyjne/kontrolne.  
**Profil:** `employmentType`, `contractType`, `contractEndDate`, `pregnancyStage`, ewentualne wyjątki.  
**Dokument:** zaświadczenie lekarskie o ciąży, jeśli jest potrzebne do wykazania uprawnienia.  
**Prawo:** Kodeks pracy, tekst jednolity Dz.U. 2026 poz. 1245. citeturn868757search9turn123976search8  
**URL:** `https://eli.gov.pl/eli/DU/2026/1245/ogl`  
**Status:** dla zlecenia/B2B reguły kodeksowej ochrony pracowniczej nie mogą być automatycznie stosowane.

### `BIRTH_REGISTRATION`

**Nazwa:** zgłoszenie urodzenia dziecka.  
**Organ:** USC.  
**Termin:** 21 dni od sporządzenia karty urodzenia; martwe urodzenie — 3 dni od karty martwego urodzenia. citeturn247316search0turn123976search0  
**Rezultat:** akt urodzenia, PESEL, meldunek.  
**URL proceduralny:** `https://www.gov.pl/web/gov/zglos-urodzenie-dziecka`  
**Prawo:** `https://eli.gov.pl/eli/DU/2026/393/ogl` citeturn123976search0  
**Kod formularza:** brak uniwersalnego „PDF ZUS”; to usługa USC.

### `CHILD_HEALTH_INSURANCE`

**Nazwa:** zgłoszenie dziecka jako członka rodziny do ubezpieczenia zdrowotnego.  
**Organ:** płatnik składki/ZUS; system ochrony zdrowia.  
**Termin:** zasadniczo 7 dni od powstania obowiązku zgłoszenia. citeturn247316search16turn247316search23  
**Dokument:** `ZUS ZCNA`, ale pracownik zazwyczaj przekazuje dane swojemu płatnikowi, a nie „sam zgłasza dziecko w ZUS” w każdym przypadku.  
**URL:** `https://pacjent.gov.pl/aktualnosc/zglos-dziecko-do-ubezpieczenia` citeturn247316search10  
**Reguła UX:** po rejestracji USC Mila powinna nadal pokazywać to jako osobne zadanie.

### `MATERNITY_ALLOWANCE`

**Nazwa:** zasiłek macierzyński.  
**Organ:** ZUS albo płatnik zasiłków, zależnie od sytuacji.  
**Profil:** `sicknessInsurance`, `employmentType`, `childBirthDate`, `childrenBornCount`, `payerPaysBenefits`, `parentRole`, `requestedPeriods`.  
**Dokument podstawowy aktualny:** `ZAM`; zależnie od przypadku `Z-3`, `Z-3a`, dane dziecka i drugiego rodzica oraz dokumenty szczególne. citeturn868757search10turn569705view6  
**Stawki:** 100% za macierzyński; 70% zasadniczo za rodzicielski; możliwość 81,5% po odpowiednim wniosku w ciągu 21 dni od porodu. citeturn868757search5  
**Źródło proceduralne:** `https://www.zus.pl/swiadczenia/zasilki/zasilek-macierzynski/niezbedne-dokumenty`  
**Prawo:** `https://eli.gov.pl/eli/DU/2026/854/ogl` citeturn123976search19  
**Ważne:** `hasEmploymentContract=false` nie znaczy `not-relevant`; osoba na zleceniu lub działalności może być objęta chorobowym.

### `MATERNITY_LEAVE`

**Nazwa:** urlop macierzyński.  
**Organ:** pracodawca.  
**Odbiorca:** pracownik.  
**Wymiar:** 20 tygodni przy jednym dziecku, większy przy porodzie mnogim. citeturn868757search10  
**Prawo:** Kodeks pracy.  
**Status dla B2B/zlecenia:** `not-relevant` jako urlop pracowniczy, ale nie przesądza o zasiłku.

### `SUPPLEMENTARY_MATERNITY_LEAVE`

**Nazwa:** uzupełniający urlop macierzyński.  
**Organ:** pracodawca; wypłata zasiłku według zasad zasiłkowych.  
**Profil konieczny:** `gestationalWeekAtBirth`, `birthWeightGrams`, `hospitalStays[]`, `multipleBirth`.  
**Termin:** wniosek co najmniej 21 dni przed końcem podstawowego macierzyńskiego.  
**Maksimum:** zależnie od przypadku do 8 albo 15 tygodni. citeturn474417view7  
**URL:** `https://www.gov.pl/web/rodzina/uzupelniajacy-urlop-macierzynski`  
**Efektywność prawa:** od 19 marca 2025 r. citeturn363956search10  
**Implementacja:** liczba tygodni musi być wyliczana z pobytów szpitalnych, a nie z flagi `premature=true`.

### `PARENTAL_LEAVE`

**Nazwa:** urlop rodzicielski.  
**Organ:** pracodawca.  
**Termin wniosku:** co najmniej 21 dni przed rozpoczęciem urlopu, z wyjątkiem odrębnego 21‑dniowego wniosku po porodzie dotyczącego sposobu wypłaty zasiłku. citeturn868757search6  
**Wymiar:** 41/43 tygodnie, 65/67 w szczególnej ścieżce „Za życiem”; po 9 tygodni nieprzenoszalne dla każdego rodzica. citeturn868757search6  
**URL:** `https://www.gov.pl/web/rodzina/urlop-rodzicielski`

### `PATERNITY_LEAVE`

**Nazwa:** urlop ojcowski.  
**Organ:** pracodawca / ZUS w zakresie zasiłku.  
**Wymiar:** 2 tygodnie; zasadniczo do ukończenia przez dziecko 12 miesięcy. citeturn868757search10  
**Profil:** `parentRole=father`, `employee`, `childBirthDate`, wykorzystany urlop.  
**Ważne:** rozróżnić „urlop ojcowski” od 9‑tygodniowej nieprzenoszalnej części rodzicielskiego.

### `CARE_ALLOWANCE`

**Nazwa:** zasiłek opiekuńczy.  
**Organ:** ZUS/płatnik.  
**Dokument:** od 26 października 2026 `Z-15`; zależne dowody dodatkowe. citeturn363956search5turn569705view7  
**Profil:** `careSubject`, `childAge`, `reason`, `daysUsedCurrentYear`, `otherHouseholdMemberAvailable`, szczególne wyjątki.  
**Reguła:** nie kodować jednego limitu bez typu opieki.  
**URL:** `https://www.zus.pl/pl/wzory-formularzy/zasilki/zasilek-opiekunczy`

### `CHILD_800_PLUS`

**Nazwa:** świadczenie wychowawcze 800+.  
**Organ:** ZUS.  
**Kwota:** 800 zł miesięcznie, z regułami proporcji przy niepełnym miesiącu/opiece naprzemiennej. citeturn474417view6turn569705view4  
**Wniosek rodzica:** `SW-R`, wyłącznie elektroniczny kreator. citeturn363956search0turn363956search1  
**Termin noworodka:** 3 miesiące od urodzenia dla wyrównania od dnia narodzin. citeturn569705view4  
**Okres:** 1 czerwca–31 maja.  
**URL:** `https://www.zus.pl/pl/swiadczenia/swiadczenia-dla-rodzin/swiadczenie-wychowawcze-800-plus`  
**Prawo:** `https://eli.gov.pl/eli/DU/2026/508/ogl` citeturn123976search9

### `ACTIVE_PARENT_WORK`

**Nazwa:** Aktywni rodzice w pracy.  
**Organ:** ZUS.  
**Wniosek:** `AWP`, kreator online. citeturn363956search2  
**Wiek:** miesiąc ukończenia 12 mies. do końca miesiąca ukończenia 35 mies. citeturn569705view0  
**Kwota:** 1500/1900 zł.  
**Profil:** aktywność matki, aktywność drugiego rodzica, samotne wychowywanie, podstawy emerytalno-rentowe, ulgi w DG, piecza, pobyt dziecka, konkurencyjny komponent. citeturn815495view0turn569705view0  
**Prawo:** `https://eli.gov.pl/eli/DU/2026/532/ogl` citeturn123976search11  
**Status:** przy braku podstaw składkowych → `missing-data`, nie `relevant`.

### `ACTIVE_PARENT_NURSERY`

**Nazwa:** Aktywnie w żłobku.  
**Organ:** ZUS.  
**Wniosek:** `AWZ`, online.  
**Kwota:** do 1500/1900 zł, nie więcej niż opłata. citeturn569705view1  
**Dodatkowa zmienna:** `nurseryFee`; limit kosztu instytucji 2200 zł obowiązuje od 1.04.2026 do 31.03.2027. citeturn815495view1  
**Profil:** placówka wpisana do właściwego rejestru, opłata, inne komponenty programu.

### `ACTIVE_PARENT_HOME`

**Nazwa:** Aktywnie w domu.  
**Organ:** ZUS.  
**Wniosek:** `AWD`, online.  
**Kwota:** 500 zł.  
**Wiek:** 12–35 miesięcy.  
**Wykluczenia:** inny komponent Aktywnego Rodzica/RKO za ten sam okres oraz pozostałe przesłanki ustawowe. citeturn815495view2turn569705view2

### `BIRTH_GRANT_BECIKOWE`

**Nazwa:** jednorazowa zapomoga z tytułu urodzenia dziecka.  
**Organ:** gmina/MOPS.  
**Kwota:** 1000 zł.  
**Termin:** 12 miesięcy od urodzenia.  
**Profil:** dochód, liczba członków rodziny, opieka medyczna od 10. tygodnia, status rodzica/opiekuna, miejsce zamieszkania. citeturn474417view5  
**URL:** `https://www.gov.pl/web/gov/uzyskaj-becikowe`  
**Prawo:** `https://eli.gov.pl/eli/DU/2026/1240` citeturn123976search1

### `PARENTAL_BENEFIT`

**Nazwa:** świadczenie rodzicielskie.  
**Organ:** gmina/MOPS.  
**Kwota:** 1000 zł miesięcznie.  
**Okres:** podstawowo 52 tygodnie dla jednego dziecka, dłużej przy porodach mnogich i od 2025 r. możliwe dodatkowe tygodnie hospitalizacyjne. citeturn815495view3turn474417view3  
**Termin:** 3 miesiące dla ustalenia od miesiąca narodzin; później od miesiąca wniosku.  
**Kanał:** urząd lub Emp@tia.  
**Ważne:** Mila musi sprawdzić relację do zasiłku macierzyńskiego; nie należy rekomendować obu jako niezależnych „bonusów”.

### `FAMILY_ALLOWANCE`

**Nazwa:** zasiłek rodzinny z dodatkami.  
**Organ:** gmina/MOPS.  
**Profil:** szczegółowy dochód rodziny, członkowie rodziny, niepełnosprawność, wiek/nauka dziecka, sytuacja rodzinna.  
**Kryteria:** 674/764 zł na osobę w aktualnym stanie prawnym; mechanizm złotówka za złotówkę. citeturn247316search11turn815495view4  
**Prawo:** `https://eli.gov.pl/eli/DU/2026/1240`

## Inwentaryzacja źródeł i dokumentów do lokalnego repozytorium

Wersjonowanie musi odbywać się **per źródło i per fakt**, nie tylko przez pole `verifiedAt` całej procedury.

| Priorytet | Źródło | Co przechowywać lokalnie | Strategia |
|---|---|---|---|
| P0 | ELI — ustawa zasiłkowa Dz.U. 2026/854 | tekst/HTML + metadata + hash | cache pełny |
| P0 | Kodeks pracy Dz.U. 2026/1245 | tekst + hash | cache pełny |
| P0 | ustawa 800+ Dz.U. 2026/508 | tekst + metadata | cache pełny |
| P0 | Aktywny Rodzic Dz.U. 2026/532 | tekst + metadata | cache pełny |
| P0 | świadczenia rodzinne Dz.U. 2026/1240 | tekst + metadata | cache pełny |
| P0 | ZUS: zasiłek macierzyński | snapshot tekstu + URL | okresowa kontrola |
| P0 | ZUS: formularz ZAM | PDF + metadata/hash | cache wersjonowany |
| P0 | ZUS: Z-3 / Z-3a | PDF/link + metadata | cache wersjonowany |
| P0 | ZUS: 800+ | snapshot proceduralny | link do kreatora |
| P0 | ZUS: AWP/AWZ/AWD | metadata, NIE udawać PDF | link do kreatora |
| P0 | gov.pl rejestracja urodzenia | snapshot tekstu | cache |
| P0 | pacjent.gov.pl ubezpieczenie dziecka | snapshot | cache |
| P1 | PIP rodzicielstwo | snapshot poradnika | źródło pomocnicze |
| P1 | gov.pl urlop rodzicielski | snapshot | pomocnicze |
| P1 | gov.pl uzupełniający macierzyński | snapshot | pomocnicze |
| P1 | gov.pl świadczenie rodzicielskie | snapshot | pomocnicze |
| P1 | gov.pl becikowe | snapshot | pomocnicze |
| P1 | gov.pl zasiłek rodzinny | snapshot | pomocnicze |
| P2 | podatki.gov.pl/gov.pl ulga na dziecko | snapshot | moduł dodatkowy |

Podstawowe akty prawne są dostępne w ELI jako obowiązujące teksty jednolite. Ustawa zasiłkowa ma aktualny tekst jednolity Dz.U. 2026 poz. 854, Kodeks pracy — poz. 1245, świadczenia rodzinne — poz. 1240, Aktywny Rodzic — poz. 532, a Prawo o aktach stanu cywilnego — poz. 393. citeturn123976search19turn123976search8turn123976search1turn123976search11turn123976search0

### Co rzeczywiście pobierać

Do `sources/cache/` warto pobrać:

```text
eli/
  DU-2026-854.html
  DU-2026-1245.html
  DU-2026-1240.html
  DU-2026-532.html
  DU-2026-508.html
  DU-2026-393.html

zus/
  zam/
    2026-10-24-ZAM.pdf
    metadata.json
  z3/
  z3a/
  z15/
  pages/
    maternity-documents.html
    sickness-documents.html
    care-documents.html
    800-plus.html

gov/
  birth-registration.html
  parental-benefit.html
  becikowe.html
  active-parent-*.html
```

Nie ma sensu cachować „formularza SW-R.pdf”, bo **SW-R jest kreatorem elektronicznym**. To samo dotyczy AWP/AWZ/AWD. W katalogu dokumentów powinny mieć:

```json
{
  "kind": "online-wizard",
  "downloadable": false,
  "submission": "electronic-only"
}
```

ZUS oficjalnie potwierdza, że kreator SW i kreatory programu Aktywny Rodzic nie mają trybu ręcznego wypełniania. citeturn363956search1turn363956search2

### Prawo do lokalnego cache

Akty normatywne i urzędowe dokumenty są wyłączone spod ochrony prawa autorskiego na podstawie art. 4 ustawy o prawie autorskim. To nie oznacza jednak, że można automatycznie kopiować dowolne komercyjne opracowania czy cudzą, twórczo dobraną bazę danych; ustawa chroni również twórczy dobór/układ, a odrębna ustawa przewiduje ochronę baz danych. citeturn123976search86turn123976search20

Dlatego bezpieczna polityka Mili to: **cache źródeł urzędowych + własne rekordy danych zbudowane na tych źródłach**, bez importowania katalogu zdazymy.pl.

### Prywatność

Nie ma potrzeby przechowywania danych użytkowniczki na serwerze. Profil może istnieć w `sessionStorage`, `IndexedDB` albo pamięci aplikacji. Do dopasowania procedur wystarczą cechy typu `pregnancyStage`, `employmentType`, `sicknessInsurance`; numer PESEL, nazwisko i dokładny adres nie są potrzebne do samej rekomendacji. Dane medyczne takie jak ciąża, hospitalizacja dziecka lub niepełnosprawność są szczególnie wrażliwe, więc architektura offline-first jest dodatkowo korzystna.

## Model danych i silnik reguł dla Codexa

Najważniejsza zasada: **reguła prawna nie może być anonimowym callbackiem TypeScript bez źródła.** Każdy atom warunku powinien mieć identyfikator, źródło, zakres ważności i możliwość wyjaśnienia użytkowniczce.

### Profil

```ts
export interface ParentProfile {
  asOfDate: string;

  stage?: "pregnant" | "born";
  pregnancyWeek?: number;
  expectedBirthDate?: string;

  child?: {
    birthDate?: string;
    childrenBornCount?: number;
    gestationalWeekAtBirth?: number;
    birthWeightGrams?: number;
    hasDisabilityCertificate?: boolean;
    hasZaZyciemCertificate?: boolean;
    hospitalStays?: {
      from: string;
      to: string;
    }[];
  };

  employment?: {
    type?:
      | "employment"
      | "mandate"
      | "business"
      | "unemployed"
      | "student"
      | "other";
    contractType?: "indefinite" | "fixed" | "trial";
    contractEndDate?: string;
    sicknessInsurance?: boolean;
    payerPaysBenefits?: boolean;
    businessPreferentialContributions?: boolean;
    activitySuspended?: boolean;
  };

  secondParent?: {
    exists?: boolean;
    jointlyRaisesChild?: boolean;
    employmentType?: string;
    pensionDisabilityContributionBase?: number;
  };

  family?: {
    singleParent?: boolean;
    alternatingCustody?: boolean;
    householdSize?: number;
    monthlyNetIncome?: number;
    childCount?: number;
  };

  childcare?: {
    nursery?: boolean;
    nurseryRegistered?: boolean;
    monthlyFee?: number;
  };

  benefitHistory?: {
    activeParentComponent?: "work" | "nursery" | "home";
    legacyRKO?: boolean;
    careAllowanceDaysUsed?: number;
  };
}
```

### Źródła

```ts
export interface Source {
  id: string;
  authority: "ZUS" | "ELI" | "GOV_PL" | "PIP" | "NFZ" | "MF";
  title: string;
  url: string;
  type: "law" | "procedure" | "form" | "guidance";
  validFrom?: string;
  validTo?: string;
  retrievedAt: string;
  sha256?: string;
  cachePath?: string;
}
```

### Warunek

```ts
export interface Condition {
  id: string;
  field: string;
  operator:
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "exists"
    | "dateBetween";

  value?: unknown;

  sourceRefs: string[];
  legalBasis?: {
    article?: string;
    paragraph?: string;
  };

  validFrom?: string;
  validTo?: string;

  explanation: string;
}
```

### Procedura

```ts
export interface Procedure {
  id: string;
  version: string;

  officialName: string;
  category:
    | "zus-benefit"
    | "employment-right"
    | "municipal-benefit"
    | "civil-registration"
    | "health-insurance"
    | "tax";

  authority: string;

  eligibility: {
    all?: string[];
    any?: string[];
    none?: string[];
  };

  requiredProfileFields: string[];

  deadlines: Deadline[];
  amounts?: AmountRule[];
  documents: DocumentRequirement[];

  steps: Step[];

  sourceRefs: string[];

  validFrom: string;
  validTo?: string;
  verifiedAt: string;
}
```

### Wynik silnika

```ts
export type EvaluationStatus =
  | "relevant"
  | "possible"
  | "missing-data"
  | "not-relevant";

export interface ProcedureResult {
  procedureId: string;
  status: EvaluationStatus;

  missingFields: string[];

  matchedConditions: {
    conditionId: string;
    sourceRefs: string[];
  }[];

  failedConditions: string[];

  reasons: string[];

  nextQuestions: string[];

  audit: {
    evaluatedAt: string;
    procedureVersion: string;
    rulesetVersion: string;
    profileHash?: string;
  };
}
```

Interpretacja statusów:

| status | zachowanie |
|---|---|
| `relevant` | wszystkie wymagane warunki znane i spełnione |
| `possible` | istnieje sensowna ścieżka, ale sprawa ma wyjątki lub wymaga organu do finalnego ustalenia |
| `missing-data` | brakuje konkretnej odpowiedzi blokującej ocenę |
| `not-relevant` | co najmniej jeden konieczny warunek jest jednoznacznie niespełniony |

**Nigdy** nie mapować `undefined` na `false`.

### Terminy jako reguły, nie tekst

```ts
interface Deadline {
  id: string;
  trigger:
    | "child.birthDate"
    | "maternityLeave.endDate"
    | "benefitPeriod.start"
    | "hospitalDischarge"
    | "custom";

  offset?: {
    value: number;
    unit: "days" | "months" | "weeks";
  };

  relation: "within" | "at-least-before" | "from-to";

  consequenceIfMissed:
    | "loss-of-backpay"
    | "application-left-unconsidered"
    | "later-entitlement"
    | "manual-review";

  sourceRefs: string[];
}
```

To ma znaczenie, bo „3 miesiące od urodzenia” dla 800+ nie jest tym samym typem terminu co „21 dni przed rozpoczęciem urlopu rodzicielskiego” albo „1 lutego–30 czerwca okresu świadczeniowego”. citeturn569705view4turn868757search6

### Kwoty jako wersjonowane wartości

```ts
interface AmountRule {
  amount: number;
  currency: "PLN";
  unit: "month" | "one-off";
  validFrom: string;
  validTo?: string;
  conditions?: string[];
  sourceRefs: string[];
}
```

Przykład limitu żłobkowego:

```json
{
  "id": "ACTIVE_NURSERY_COST_LIMIT",
  "amount": 2200,
  "currency": "PLN",
  "unit": "month",
  "validFrom": "2026-04-01",
  "validTo": "2027-03-31"
}
```

Ta data ważności wynika bezpośrednio z aktualnej usługi gov.pl. citeturn815495view1

### Pełny przykładowy rekord 800+

```json
{
  "id": "CHILD_800_PLUS",
  "version": "2026-11-17.1",
  "officialName": "Świadczenie wychowawcze",
  "displayName": "800+",
  "authority": "ZUS",
  "category": "zus-benefit",
  "requiredProfileFields": [
    "child.birthDate",
    "applicant.role"
  ],
  "amounts": [
    {
      "amount": 800,
      "currency": "PLN",
      "unit": "month",
      "validFrom": "2024-01-01",
      "sourceRefs": ["ZUS_800_2026", "ELI_800_2026"]
    }
  ],
  "application": {
    "documentId": "SW-R",
    "kind": "online-wizard",
    "electronicOnly": true
  },
  "deadlines": [
    {
      "id": "NEWBORN_RETROACTIVE",
      "trigger": "child.birthDate",
      "offset": {
        "value": 3,
        "unit": "months"
      },
      "relation": "within",
      "consequenceIfMissed": "loss-of-backpay",
      "sourceRefs": ["ZUS_800_2026"]
    }
  ],
  "sourceRefs": [
    "ZUS_800_2026",
    "ELI_800_2026"
  ],
  "verifiedAt": "2026-11-17"
}
```

Kwota, kanał elektroniczny i termin 3 miesięcy są zgodne z aktualnymi informacjami ZUS. citeturn474417view6turn569705view4

### Pełny przykładowy rekord Aktywni rodzice w pracy

```json
{
  "id": "ACTIVE_PARENT_WORK",
  "version": "2026-11-17.1",
  "officialName": "Świadczenie aktywni rodzice w pracy",
  "authority": "ZUS",
  "category": "zus-benefit",

  "requiredProfileFields": [
    "child.birthDate",
    "family.singleParent",
    "employment.activityStatus"
  ],

  "application": {
    "documentId": "AWP",
    "kind": "online-wizard",
    "electronicOnly": true
  },

  "amounts": [
    {
      "amount": 1500,
      "currency": "PLN",
      "unit": "month",
      "sourceRefs": ["GOV_ACTIVE_WORK"]
    },
    {
      "amount": 1900,
      "currency": "PLN",
      "unit": "month",
      "conditions": ["CHILD_REQUIRED_DISABILITY_CERTIFICATE"],
      "sourceRefs": ["GOV_ACTIVE_WORK"]
    }
  ],

  "ageWindow": {
    "fromMonthInclusive": 12,
    "throughMonthInclusive": 35
  },

  "mutuallyExclusiveWith": [
    "ACTIVE_PARENT_NURSERY",
    "ACTIVE_PARENT_HOME"
  ],

  "sourceRefs": [
    "GOV_ACTIVE_WORK",
    "ELI_ACTIVE_PARENT_2026"
  ],

  "verifiedAt": "2026-11-17"
}
```

Dla wspólnie wychowujących rodziców sam `activityStatus=true` jest niewystarczający; potrzebne są dane o podstawach składek, dlatego silnik po poznaniu tylko zatrudnienia powinien zwrócić `missing-data`. citeturn815495view0

### Pełny przykład becikowego

```json
{
  "id": "BIRTH_GRANT_BECIKOWE",
  "version": "2026-11-17.1",
  "officialName": "Jednorazowa zapomoga z tytułu urodzenia się dziecka",
  "authority": "GMINA",
  "category": "municipal-benefit",

  "requiredProfileFields": [
    "child.birthDate",
    "family.householdSize",
    "family.incomeForFamilyBenefits",
    "pregnancy.medicalCareFromWeek10"
  ],

  "amounts": [
    {
      "amount": 1000,
      "currency": "PLN",
      "unit": "one-off",
      "sourceRefs": ["GOV_BECIKOWE", "ELI_FAMILY_2026"]
    }
  ],

  "deadlines": [
    {
      "trigger": "child.birthDate",
      "offset": {
        "value": 12,
        "unit": "months"
      },
      "relation": "within",
      "consequenceIfMissed": "application-left-unconsidered",
      "sourceRefs": ["GOV_BECIKOWE"]
    }
  ],

  "sourceRefs": [
    "GOV_BECIKOWE",
    "ELI_FAMILY_2026"
  ],

  "verifiedAt": "2026-11-17"
}
```

Tu nie wolno wykorzystać prostego pola `monthlyNetIncome`, jeśli nie zostało ono obliczone zgodnie z definicją dochodu z ustawy o świadczeniach rodzinnych. Lepiej pytać użytkownika, czy zna dochód do świadczeń rodzinnych, albo wynik oznaczyć `possible` i skierować do kalkulacji/urzędu. citeturn123976search1turn247316search11

### Pipeline źródło → produkt

Rekomendowana struktura repo:

```text
mila/
├── src/
│   ├── data/
│   │   ├── procedures/
│   │   ├── documents/
│   │   ├── conditions/
│   │   ├── questions/
│   │   ├── amounts/
│   │   └── sources/
│   ├── engine/
│   │   ├── evaluateProcedure.ts
│   │   ├── evaluateCondition.ts
│   │   ├── deadlines.ts
│   │   ├── explain.ts
│   │   └── plan.ts
│   └── types/
│
├── legal-sources/
│   ├── manifest.json
│   └── cache/
│
├── scripts/
│   ├── fetch-sources.ts
│   ├── hash-sources.ts
│   ├── diff-sources.ts
│   └── validate-data.ts
│
├── tests/
│   ├── fixtures/
│   ├── procedures/
│   ├── deadlines/
│   └── regressions/
│
└── DATA_CHANGELOG.md
```

Pipeline:

**import → hash → diff → ekstrakcja → ręczna weryfikacja → testy → publikacja `data-version.json`.**

Automatyczny skrypt może wykrywać zmianę źródła, ale **nie powinien sam aktualizować reguły prawa w produkcji**. Zmiana HTML ZUS może być kosmetyczna albo merytoryczna. Pipeline powinien stworzyć review task:

```text
SOURCE_CHANGED:
  sourceId: ZUS_MATERNITY_DOCUMENTS
  oldHash: ...
  newHash: ...

AFFECTED:
  MATERNITY_ALLOWANCE
  PARENTAL_ALLOWANCE_PERIOD

STATUS:
  needs-human-review
```

## MVP hackathonowe, scenariusze testowe i specyfikacja dla Codexa

### Priorytet procedur

**P0 — konieczne do sensownego demo:**

1. ochrona pracownicy w ciąży,
2. chorobowe/L4 w ciąży,
3. rejestracja urodzenia,
4. zgłoszenie dziecka do ubezpieczenia zdrowotnego,
5. urlop macierzyński,
6. zasiłek macierzyński,
7. urlop rodzicielski,
8. uzupełniający urlop macierzyński,
9. 800+,
10. świadczenie rodzicielskie,
11. becikowe,
12. Aktywni rodzice w pracy,
13. Aktywnie w żłobku,
14. Aktywnie w domu.

**P1:** urlop ojcowski, zasiłek opiekuńczy, urlop wychowawczy, zasiłek rodzinny + dodatek z tytułu urodzenia.

**P2:** podatkowa ulga na dziecko, bardziej egzotyczne przypadki międzynarodowe, adopcja i pełny zakres pieczy zastępczej.

To daje 14 bardzo mocnych P0 i maksymalnie około 19 po rozszerzeniu — wystarczająco szeroko, by pokazać pełną podróż, ale nadal realnie zweryfikować każdą regułę.

### Minimalny zestaw pytań Mili

Rozmowa nie powinna pytać od razu o wszystkie możliwe pola. Najpierw:

1. Czy jesteś w ciąży, czy dziecko już się urodziło?
2. Termin porodu / data urodzenia.
3. Ile dzieci przy tym porodzie?
4. Jaki jest Twój status zawodowy?
5. Czy podlegasz dobrowolnemu/obowiązkowemu ubezpieczeniu chorobowemu, jeśli ma to znaczenie?
6. Czy wychowujesz dziecko wspólnie z drugim rodzicem?
7. Jaki jest jego status aktywności zawodowej?
8. Czy dziecko było wcześniakiem lub było hospitalizowane po porodzie?
9. Czy dziecko chodzi do żłobka / opiekuna?
10. Czy chcesz sprawdzić także świadczenia zależne od dochodu?

Dodatkowe pytania są uruchamiane dopiero przez `missingFields`.

### Scenariusz demonstracyjny: etat i ciąża

**Profil:** 28. tydzień ciąży, umowa o pracę, chorobowe, termin umowy za trzy miesiące.

**Mila powinna:** wskazać prawa pracownicze jako `possible/relevant`, zaproponować ścieżkę chorobowego, przygotować przyszły zestaw „poród → USC → zdrowotne → macierzyński → 800+”. Nie wolno automatycznie twierdzić, że umowa na pewno przedłuży się do porodu, dopóki nie są znane wszystkie przesłanki i wyjątki. Podstawa: PIP i Kodeks pracy. citeturn868757search9turn123976search8

### Scenariusz: zlecenie

**Profil:** umowa zlecenie, dziecko urodzone, odpowiedź na pytanie o chorobowe = „nie wiem”.

**Oczekiwane:** `MATERNITY_ALLOWANCE = missing-data`; Mila wyjaśnia, że rodzaj umowy sam nie przesądza prawa i pyta o ubezpieczenie chorobowe. `MATERNITY_LEAVE = not-relevant` jako kodeksowy urlop pracowniczy. 800+ nadal jest kandydatem niezależnym od zatrudnienia. citeturn868757search10turn474417view6

### Scenariusz: działalność

**Profil:** JDG, ubezpieczenie chorobowe potwierdzone, poród.

**Oczekiwane:** zasiłek macierzyński może być `relevant`, ale urlop macierzyński jako prawo pracownika — `not-relevant`; dokumentacja ZUS różni się od dokumentacji pracowniczej i nie wolno automatycznie żądać `Z-3`. citeturn569705view6

### Scenariusz: osoba bezrobotna

**Profil:** brak tytułu do zasiłku macierzyńskiego, jedno dziecko.

**Oczekiwane:** `MATERNITY_ALLOWANCE` może być `not-relevant/possible` zależnie od pełnej historii ubezpieczenia; `PARENTAL_BENEFIT` powinno pojawić się jako kandydat do sprawdzenia, 800+ jako P0, becikowe po zebraniu danych dochodowych. citeturn815495view3turn474417view6turn474417view5

### Scenariusz: wcześniak

**Profil:** urodzenie w 27. tygodniu, masa 920 g, hospitalizacja.

**Oczekiwane:** natychmiast uruchomić `SUPPLEMENTARY_MATERNITY_LEAVE` i dodatkowe pytania o dokładne daty hospitalizacji. Nie wyświetlać gotowej liczby tygodni, dopóki daty pobytu nie są znane. citeturn474417view7

### Scenariusz: Aktywny Rodzic

**Profil:** dziecko 18 miesięcy, oboje rodzice pracują, brak danych o podstawie składek.

**Oczekiwane:** `ACTIVE_PARENT_WORK = missing-data`, a nie „należy Ci się 1500 zł”. Mila pyta o dane potrzebne do oceny minimalnego poziomu aktywności. Jeśli dziecko jednocześnie chodzi do żłobka, aplikacja powinna przedstawić `ACTIVE_PARENT_NURSERY` jako alternatywę, a nie drugi kumulowany benefit. citeturn815495view0turn815495view1

### Scenariusz: konflikt odpowiedzi

Użytkownik mówi:

> „Nie pracuję, ale mam Aktywni rodzice w pracy.”

Silnik nie zmienia profilu automatycznie. Powinien zwrócić konflikt:

```json
{
  "type": "PROFILE_CONFLICT",
  "fields": [
    "employment.activityStatus",
    "benefitHistory.activeParentComponent"
  ],
  "action": "ask-user"
}
```

Dzięki temu aplikacja nie „naprawia” danych na podstawie domysłów.

### Specyfikacja do przekazania Codexowi

Codex powinien wytworzyć jeden spójny moduł danych i reguł z następującymi artefaktami:

- `types/profile.ts`, `procedure.ts`, `source.ts`, `document.ts`, `condition.ts`, `result.ts`;
- lokalny `sources.json` ze źródłami urzędowymi i datą/hashami;
- katalog `documents.json` rozróżniający PDF, kreator online, oświadczenie, zaświadczenie lekarskie i dokument płatnika;
- 14 procedur P0 w oddzielnych JSON/TS;
- wersjonowane `amounts.json`;
- wersjonowane `conditions.json`;
- `questions.json` z `requiredForConditionIds`, a nie z liniowym flow;
- deterministyczny `evaluateProcedure(profile, procedure, date)`;
- `generatePlan(profile)` sortujący elementy według terminu i etapu;
- `explainResult()` generujący „Dlaczego to widzę?” z IDs warunków i źródeł;
- kalkulator terminów;
- wyspecjalizowany kalkulator hospitalizacji dla uzupełniającego macierzyńskiego;
- walidator integralności danych;
- testy jednostkowe i fixture'y scenariuszy;
- manifest wersji danych;
- skrypty `fetch`, `hash` i `diff` oficjalnych źródeł.

**Definition of Done dla pojedynczej procedury:**

Procedura jest gotowa dopiero wtedy, gdy ma: oficjalną nazwę, organ, `validFrom`, wymagane pola profilu, wszystkie krytyczne warunki jako osobne `Condition`, dokumenty z właściwym typem, termin z jednoznacznym triggerem, kwoty z okresem ważności, co najmniej jedno źródło prawne i jedno proceduralne, `verifiedAt`, test pozytywny, test negatywny oraz test `missing-data`.

**Definition of Done dla silnika:**

Dla żadnego brakującego pola `undefined` nie może być interpretowane jako odpowiedź negatywna. Każda pozytywna rekomendacja musi posiadać `matchedConditions[]` i `sourceRefs[]`. Każda procedura z wymaganym, nieznanym warunkiem musi zwrócić `missing-data` albo `possible`, nie `relevant`. Zmiana wcześniejszej odpowiedzi musi przeliczać plan od zera bez mutowania poprzedniego wyniku.

**Sekwencja prac dla Codexa:**

Najpierw typy i schemat walidacji; następnie manifest źródeł; potem warunki atomowe; potem 14 procedur P0; następnie silnik; deadline engine; test fixtures; dopiero potem UI conversation adapter. AI/chat nie powinien być zależnością warstwy prawnej.

Najbardziej wartościowa technicznie zasada projektu brzmi więc:

```text
OFFICIAL SOURCE
      ↓
VERIFIED FACT / CONDITION
      ↓
VERSIONED LOCAL DATA
      ↓
DETERMINISTIC RULE ENGINE
      ↓
RELEVANT / POSSIBLE / MISSING-DATA / NOT-RELEVANT
      ↓
PLAN + WHY + DEADLINE + DOCUMENT + SOURCE
```

To podejście wykorzystuje dokładnie to, czego potrzebuje Wasz flow Start → Rozmowa → Plan → Edycja: edycja odpowiedzi zmienia wyłącznie `profile`; cała reszta jest ponownie deterministycznie obliczana.

Najważniejsze źródła bazowe do zapisania w pierwszym commicie to aktualna ustawa zasiłkowa Dz.U. 2026 poz. 854, Kodeks pracy Dz.U. 2026 poz. 1245, ustawa o świadczeniach rodzinnych Dz.U. 2026 poz. 1240, ustawa Aktywny Rodzic Dz.U. 2026 poz. 532, ustawa 800+ Dz.U. 2026 poz. 508 oraz Prawo o aktach stanu cywilnego Dz.U. 2026 poz. 393. citeturn123976search19turn123976search8turn123976search1turn123976search11turn123976search9turn123976search0

W praktyce **nie potrzebujecie więc w Codexie „bazy dokumentów prawnych do RAG-u” jako rdzenia produktu**. Potrzebujecie małego, dobrze zweryfikowanego, wersjonowanego repozytorium około 15–20 procedur i kilkudziesięciu atomowych warunków, a źródłowe dokumenty służą do audytu i aktualizacji. Dla hackathonu będzie to szybsze, bardziej przewidywalne i znacznie łatwiejsze do obrony przed jury niż system, w którym model językowy sam interpretuje przepisy przy każdym zapytaniu.