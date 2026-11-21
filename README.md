# Mila

Mila to przewodnik dla przyszłych rodziców przygotowany na HackNation. Po rozmowie pokazuje, jakie świadczenia mogą Ci przysługiwać, co trzeba załatwić i do kiedy.

## Uruchomienie lokalne

Użyj Node.js 22 lub nowszego i wersji Bun wskazanej w [package.json](package.json).

```sh
bun install --frozen-lockfile
bun run dev
```

Otwórz [localhost:3000](http://localhost:3000), aby zobaczyć stronę główną Mili. Przycisk „Rozpocznij rozmowę” prowadzi do [/chat](http://localhost:3000/chat). Rozmowa, raport i gotowe nagrania działają bez kluczy API. Odpowiedzi są przechowywane w bieżącej sesji; odświeżenie strony rozpoczyna rozmowę od nowa. Zmiany sprawdzisz poleceniem `bun run check`.

## Opcjonalne klucze

Wpisz potrzebne klucze w `.env.local` w katalogu projektu.

- `AI_GATEWAY_API_KEY` włącza odpowiedzi AI na otwarte pytania. Po dodaniu klucza uruchom ponownie serwer.
- `ELEVENLABS_API_KEY` z uprawnieniem Text to Speech włącza odczyt wygenerowanych odpowiedzi głosem Mili. Po kliknięciu odtwarzania serwer wysyła do ElevenLabs tekst odpowiedzi. Ten klucz pozwala też uzupełnić gotowe nagrania poleceniem `bun run audio:generate`.

Na Vercel dodaj klucze w **Settings → Environment Variables** i wykonaj nowe wdrożenie. Przy publicznym dostępie ustaw limit żądań dla `/api/guide-help` i `/api/guide-speech` oraz limit kredytów klucza ElevenLabs.

## Katalog i reguły

[Silnik raportu](src/engine) korzysta z [katalogu świadczeń i źródeł](src/data). Użyj `bun run sources fetch`, aby pobrać kopie źródeł, i `bun run sources diff`, aby sprawdzić zmiany.
