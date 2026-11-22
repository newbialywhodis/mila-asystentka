# Mila

Mila to przewodnik dla przyszłych rodziców przygotowany na HackNation. Po rozmowie pokazuje, jakie świadczenia mogą Ci przysługiwać, co trzeba załatwić i do kiedy.

## Mila – Zasiłkowy przewodnik przyszłego rodzica

Otwórz `/chat` i wybierz **Sprawdź, co może Ci przysługiwać**. Krótki lokalny wywiad prowadzi do dopasowanych spraw, szczegółowego kalkulatora i wyniku. **Wróć do dopasowanych spraw** zachowuje potwierdzone dane rodziny oraz wcześniejsze oceny. Możesz też wybrać **Wiem, jakie świadczenie sprawdzić** lub dodać PDF. Mila dopyta o potrzebne dane i pokaże, w jakim okresie i w jakiej kwocie może przysługiwać zasiłek, kto go wypłaca oraz jakie dokumenty złożyć. Możesz zmienić odpowiedź, przeliczyć podział opieki z drugim rodzicem albo sprawdzić skutki pracy w trakcie rodzicielskiego.

- [Demonstracja w przeglądarce](https://mila-asystentka.vercel.app/chat)
- [Film prezentujący działanie Mili, 1 min 11 s](https://mila-asystentka.vercel.app/materialy/mila-demo.webm)
- [Prezentacja konkursowa, 8 slajdów](public/materialy/mila-hacknation.pptx)
- [Zrzut importu PDF](public/materialy/import-pdf.png) · [wynik ojcowskiego](public/materialy/wynik-ojcowskiego.png) · [wynik na telefonie](public/materialy/wynik-na-telefonie.png) · [porównanie opieki](public/materialy/podzial-opieki.png)
- [Kryteria odbioru i próby ZUS](docs/checklista-wymagan-zus.md)

Model AI pomaga rozpoznać cel wypowiedzi i odpowiedzieć na ogólne pytania. ElevenLabs może odczytać odpowiedź głosem Mili. Kalkulator, ręczne wprowadzanie danych, odczyt lokalny Tesseract.js i symulacje urzędowe działają także przy niedostępności tych usług. Warunki prawne, okresy i obliczenia wyznacza kod TypeScript. Codex wspierał wdrożenie zmian i prowadzenie testów odbiorowych.

## Uruchomienie lokalne

Użyj Node.js 22 lub nowszego i wersji Bun wskazanej w [package.json](package.json).

```sh
bun install --frozen-lockfile
bun run dev
```

Strona główna jest na [localhost:3000](http://localhost:3000), a przycisk „Porozmawiaj z Milą” prowadzi do [/chat](http://localhost:3000/chat). Możesz od razu rozpocząć sprawę. Przycisk „Zaloguj się (demo)” pozwala wypróbować logowanie z fikcyjnym profilem. Spinacz przy polu wiadomości dodaje PDF do bieżącej sprawy, a menu po lewej przełącza sprawy zachowane w pamięci otwartej karty. Zmiany sprawdzisz poleceniami `bun run check` i `bun run build`.

## Próba na sprawie ZUS

Na ekranie startowym wybierz **Sprawdź sprawę z PDF-u** i otwórz plik z urządzenia. Mila odczyta strony lokalnie w przeglądarce i zaproponuje dane, które rozpoznała. Przyciski ze stronami otwierają dokument obok rozmowy w prawym panelu **Załączniki**. Na telefonie panel otwiera się po kliknięciu podglądu. Sprawdź dane, odznacz pola wymagające korekty i kliknij **Potwierdź i użyj danych**. Mila zapyta o informacje potrzebne do obliczeń.

Jeśli Mila rozpozna kilka wniosków, wybierz jeden okres. Gdy pola są nieczytelne, użyj **Strony do sprawdzenia ręcznie** i uzupełnij dane z podglądu. Przy pliku powyżej 30 stron możesz wskazać zakres przed skanowaniem. Lokalny odczyt obsługuje pliki do 30 MB i przetwarza do 100 stron naraz. Plik pozostaje w przeglądarce. Aplikacja pobiera pliki PDF.js i Tesseract.js z własnego serwera przy pierwszym odczycie. Porównaj wynik z rozstrzygnięciem ZUS dla tego samego świadczenia i okresu. [Przykłady do sprawdzenia](docs/plan-aplikacji-zus.md#własne-przykłady-do-publicznego-demo)

Własny PDF włącza dla całej rozmowy tryb lokalny: swobodny tekst, historia i dokument nie są wysyłane do AI. Chmurowy upload PDF jest wyłączony również w endpointzie, niezależnie od zmiennych środowiskowych. Dane z odczytu wymagają wskazania osoby, tytułu i celu oraz potwierdzenia; sprzeczna propozycja domyślnie zachowuje aktualną odpowiedź.

## Opcjonalne klucze

Wpisz potrzebne klucze w `.env.local` w katalogu projektu.

- `MILA_SITE_URL` ustawia domenę adresu kanonicznego i grafiki udostępniania strony głównej. Podaj pełny publiczny adres z `https://`.
- `AI_GATEWAY_API_KEY` włącza rozpoznawanie intencji w rozmowie i odpowiedzi z katalogu. Przy rozpoznawaniu intencji modelem głównym jest `openai/gpt-5-mini`, a zapasowym `google/gemini-2.5-flash`. Jeśli ustawisz inny model obsługujący odpowiedzi zgodne ze schematem JSON przez `MILA_INTENT_MODEL`, modelem zapasowym będzie GPT-5 mini. Po zmianie konfiguracji uruchom ponownie serwer.
- `ELEVENLABS_API_KEY` z uprawnieniem Text to Speech włącza odczyt wygenerowanych odpowiedzi głosem Mili. Po kliknięciu odtwarzania serwer wysyła do ElevenLabs tekst odpowiedzi. Ten klucz pozwala też uzupełnić gotowe nagrania poleceniem `bun run audio:generate`.

Na Vercel dodaj klucze w **Settings → Environment Variables** i wykonaj nowe wdrożenie. Przy publicznym dostępie ustaw limity żądań dla `/api/parent-document`, `/api/parent-intent`, `/api/guide-help` i `/api/guide-speech` oraz limity wydatków usług.

## Katalog i reguły

[Silnik raportu](src/engine) korzysta z [katalogu świadczeń i źródeł](src/data). Użyj `bun run sources fetch`, aby pobrać kopie źródeł, i `bun run sources diff`, aby sprawdzić zmiany.

W rozmowie wpisz „Ile dostanę ojcowskiego?” albo wybierz fikcyjną sprawę. Ten sam kalkulator działa po potwierdzeniu pól z PDF-u oraz przy porównaniu planów rodziców. Dokumenty z decyzjami służą do porównania wyniku po obliczeniu. [Przypadki odbiorowe](docs/plan-aplikacji-zus.md#8-sprawdziany-przed-pokazem)
