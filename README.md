# Mila

Mila to przewodnik dla przyszłych rodziców przygotowany na HackNation. Po rozmowie pokazuje, jakie świadczenia mogą Ci przysługiwać, co trzeba załatwić i do kiedy.

## Uruchomienie lokalne

Użyj Node.js 22 lub nowszego i wersji Bun wskazanej w [package.json](package.json).

```sh
bun install --frozen-lockfile
bun run dev
```

Strona główna jest na [localhost:3000](http://localhost:3000), a przycisk „Porozmawiaj z Milą” prowadzi do [/chat](http://localhost:3000/chat). Wybierz „Zaloguj przez mObywatela (demo)” i potwierdź na ekranie logowania, żeby otworzyć rozmowę na fikcyjnym profilu Jana Kowalskiego. Kalkulator, przykłady i podgląd PDF-u działają bez kluczy API. Spinacz przy polu wiadomości dodaje PDF do bieżącej sprawy. Przykład „Przykładowy PDF” pokazuje potwierdzenie odczytanych danych na fikcyjnym wniosku. Menu po lewej przełącza sprawy zachowane w pamięci otwartej karty. Zmiany sprawdzisz poleceniem `bun run check`.

## Próba na sprawie ZUS

Na ekranie startowym wybierz **Sprawdź sprawę z PDF-u** i otwórz plik z urządzenia. Mila odczyta strony lokalnie w przeglądarce i zaproponuje dane, które rozpoznała. Przyciski ze stronami otwierają dokument obok rozmowy w prawym panelu **Załączniki**. Na telefonie panel otwiera się po kliknięciu podglądu. Sprawdź dane, odznacz pola wymagające korekty i kliknij **Potwierdź i użyj danych**. Mila zapyta o informacje potrzebne do obliczeń.

Jeśli Mila rozpozna kilka wniosków, wybierz jeden okres. Przy pliku powyżej 30 stron możesz wskazać zakres przed skanowaniem. Lokalny odczyt obsługuje pliki do 30 MB i przetwarza do 100 stron naraz. Czas zależy od liczby stron i urządzenia. Plik pozostaje w przeglądarce. Aplikacja pobiera pliki PDF.js i Tesseract.js z własnego serwera przy pierwszym odczycie. Porównaj wynik z rozstrzygnięciem ZUS dla tego samego świadczenia i okresu. [Przykłady do sprawdzenia](docs/plan-aplikacji-zus.md#własne-przykłady-do-publicznego-demo)

## Opcjonalne klucze

Wpisz potrzebne klucze w `.env.local` w katalogu projektu.

- `MILA_SITE_URL` ustawia domenę adresu kanonicznego i grafiki udostępniania strony głównej. Podaj pełny publiczny adres z `https://`.
- `AI_GATEWAY_API_KEY` włącza wybór narzędzi na podstawie rozmowy i odpowiedzi z katalogu. Model wyboru narzędzi ustawisz przez `MILA_INTENT_MODEL`. Domyślnie jest to `google/gemini-2.5-flash`. Po zmianie konfiguracji uruchom ponownie serwer.
- `MILA_PDF_UPLOAD_ALLOWED=1` razem z kluczem AI udostępnia dodatkowy **Odczyt z AI w chmurze** dla PDF-ów do 3,5 MB. Akcja **Wyślij do odczytu** przekazuje plik do zewnętrznej usługi. Domyślny model to `google/gemini-2.5-flash`, a jego konfiguracja to `MILA_PDF_MODEL`. Odczyt lokalny działa bez tych ustawień.
- `ELEVENLABS_API_KEY` z uprawnieniem Text to Speech włącza odczyt wygenerowanych odpowiedzi głosem Mili. Po kliknięciu odtwarzania serwer wysyła do ElevenLabs tekst odpowiedzi. Ten klucz pozwala też uzupełnić gotowe nagrania poleceniem `bun run audio:generate`.

Na Vercel dodaj klucze w **Settings → Environment Variables** i wykonaj nowe wdrożenie. Przy publicznym dostępie ustaw limity żądań dla `/api/parent-document`, `/api/parent-intent`, `/api/guide-help` i `/api/guide-speech` oraz limity wydatków usług.

## Katalog i reguły

[Silnik raportu](src/engine) korzysta z [katalogu świadczeń i źródeł](src/data). Użyj `bun run sources fetch`, aby pobrać kopie źródeł, i `bun run sources diff`, aby sprawdzić zmiany.

W rozmowie wpisz „Ile dostanę ojcowskiego?” albo wybierz fikcyjną sprawę. Ten sam kalkulator działa po potwierdzeniu pól z PDF-u oraz przy porównaniu planów rodziców. Dokumenty z decyzjami służą do porównania wyniku po obliczeniu. [Przypadki odbiorowe](docs/plan-aplikacji-zus.md#8-sprawdziany-przed-pokazem)
