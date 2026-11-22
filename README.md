# Mila

Mila to przewodnik dla przyszłych rodziców przygotowany na HackNation. Po rozmowie pokazuje, jakie świadczenia mogą Ci przysługiwać, co trzeba załatwić i do kiedy.

## Mila – Zasiłkowy przewodnik przyszłego rodzica

Otwórz rozmowę, wybierz świadczenie lub dodaj PDF. Mila dopyta o potrzebne dane i pokaże, w jakim okresie i w jakiej kwocie może przysługiwać zasiłek, kto go wypłaca oraz jakie dokumenty złożyć. Możesz zmienić odpowiedź, przeliczyć podział opieki z drugim rodzicem albo sprawdzić skutki pracy w trakcie rodzicielskiego.

- [Zobacz demonstrację Mili na YouTube](https://youtu.be/t1_mlextjJU)

Model AI pomaga rozpoznać cel wypowiedzi i odpowiedzieć na ogólne pytania. ElevenLabs może odczytać odpowiedź głosem Mili. Kalkulator, ręczne wprowadzanie danych, odczyt lokalny Tesseract.js i symulacje urzędowe działają także przy niedostępności tych usług. Warunki prawne, okresy i obliczenia wyznacza kod TypeScript. Codex wspierał wdrożenie zmian i prowadzenie testów odbiorowych.

Aplikacja korzysta z Next.js App Router, Reacta, TypeScriptu i CSS Modules. To prototyp bez bazy danych, z fikcyjnym profilem do logowania demonstracyjnego. Symulacje usług urzędowych nie wysyłają wniosków do urzędów.

## Uruchomienie lokalne

Użyj Node.js 22 lub nowszego i wersji Bun wskazanej w [package.json](package.json).

```sh
bun install --frozen-lockfile
bun run dev
```

Strona główna jest na [localhost:3000](http://localhost:3000), a przycisk „Porozmawiaj z Milą” prowadzi do [/chat](http://localhost:3000/chat). Aby wysyłać wiadomości i dodawać PDF-y, wybierz **Zaloguj się (demo)**, a następnie **Kontynuuj z profilem demo**. Logowanie nie wymaga podawania własnych danych ani połączenia z login.gov.pl.

Spinacz przy polu wiadomości dodaje PDF do bieżącej sprawy, a menu po lewej przełącza sprawy. Rozmowy i załączniki są przechowywane w pamięci aplikacji w przeglądarce i znikają po odświeżeniu lub zamknięciu strony. Zmiany sprawdzisz poleceniami `bun run check` i `bun run build`.

## Próba na sprawie ZUS

Po zalogowaniu profilem demo wybierz **Sprawdź sprawę z PDF-u** i otwórz plik z urządzenia. Możesz też wybrać **Wypróbuj przykład → Przykładowy PDF**, aby użyć fikcyjnego dokumentu wbudowanego w aplikację. Mila odczyta strony lokalnie w przeglądarce i zaproponuje dane, które rozpoznała. Przyciski ze stronami otwierają dokument obok rozmowy w prawym panelu **Załączniki**. Na telefonie panel otwiera się po kliknięciu podglądu. Sprawdź dane, odznacz pola wymagające korekty i kliknij **Potwierdź i użyj danych**. Mila zapyta o informacje potrzebne do obliczeń.

Jeśli Mila rozpozna kilka wniosków, wybierz jeden okres. Gdy pola są nieczytelne, użyj **Strony do sprawdzenia ręcznie** i uzupełnij dane z podglądu. Przy pliku powyżej 30 stron aplikacja poprosi o wskazanie zakresu przed skanowaniem. Lokalny odczyt obsługuje pliki do 30 MB i przetwarza do 100 stron naraz. W tym trybie plik pozostaje w przeglądarce. Aplikacja pobiera pliki PDF.js i Tesseract.js z własnego serwera przy pierwszym odczycie.

Czytelne rozstrzygnięcia znajdziesz w sekcji **Rozstrzygnięcia w PDF-ie** z odsyłaczem do strony źródłowej. Porównaj tam wynik dla tego samego świadczenia i okresu. Kalkulator ustala prawo na podstawie danych sprawy potwierdzonych w rozmowie.

## Opcjonalne klucze

Wpisz potrzebne klucze w `.env.local` w katalogu projektu.

- `MILA_SITE_URL` ustawia domenę adresu kanonicznego i grafiki udostępniania strony głównej. Podaj pełny publiczny adres z `https://`.
- `AI_GATEWAY_API_KEY` włącza rozpoznawanie intencji w rozmowie i odpowiedzi z katalogu. Przy rozpoznawaniu intencji modelem głównym jest `openai/gpt-5-mini`, a zapasowym `google/gemini-2.5-flash`. Jeśli ustawisz inny model obsługujący odpowiedzi zgodne ze schematem JSON przez `MILA_INTENT_MODEL`, modelem zapasowym będzie GPT-5 mini. Po zmianie konfiguracji uruchom ponownie serwer.
- `MILA_AI_MODEL` ustawia model odpowiedzi na ogólne pytania w `/api/guide-help`. Domyślnie jest to `openai/gpt-5-mini`. Ta zmienna jest niezależna od `MILA_INTENT_MODEL`.
- `MILA_PDF_UPLOAD_ALLOWED=1` razem z kluczem AI udostępnia dodatkowy **Odczyt z AI w chmurze** dla PDF-ów do 3,5 MB. Akcja **Wyślij do odczytu** przekazuje plik do zewnętrznej usługi. Domyślny model to `google/gemini-2.5-flash`, a jego konfiguracja to `MILA_PDF_MODEL`. Odczyt lokalny działa bez tych ustawień.
- `ELEVENLABS_API_KEY` z uprawnieniem Text to Speech włącza odczyt wygenerowanych odpowiedzi głosem Mili. Po kliknięciu odtwarzania serwer wysyła do ElevenLabs tekst odpowiedzi. Ten klucz pozwala też uzupełnić gotowe nagrania poleceniem `bun run audio:generate`.

Na Vercel dodaj klucze w **Settings → Environment Variables** i wykonaj nowe wdrożenie. Przy publicznym dostępie ustaw limity żądań dla `/api/parent-document`, `/api/parent-intent`, `/api/guide-help` i `/api/guide-speech` oraz limity wydatków usług.

## Katalog i reguły

[Silnik raportu](src/engine) korzysta z [katalogu świadczeń i źródeł](src/data). Użyj `bun run sources fetch`, aby pobrać kopie źródeł, i `bun run sources diff`, aby porównać ich adresy i sumy kontrolne z zapisanym manifestem. Polecenie `diff` sprawdza lokalne kopie; nie pobiera aktualnych treści. Po ręcznej weryfikacji zmian polecenie `bun run sources hash` aktualizuje manifest.

W rozmowie wpisz „Ile dostanę ojcowskiego?” albo wybierz fikcyjną sprawę przez **Wypróbuj przykład**. Ten sam kalkulator działa po potwierdzeniu pól z PDF-u oraz przy porównaniu planów rodziców. Reguły i obliczenia sprawdzają [testy](tests), a poprawność struktury katalogu — `bun run validate:data`.
