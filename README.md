# Mila — katalog i silnik

Mila prowadzi krótką rozmowę i układa plan przygotowań, świadczeń oraz formalności związanych z ciążą i rodzicielstwem. Katalog świadczeń, formularzy, terminów i źródeł znajduje się w `src/data`, a deterministyczny silnik w `src/engine`. Silnik przyjmuje profil i datę oceny w formacie RRRR-MM-DD. Wyniki zawierają przesłanki, źródła, brakujące odpowiedzi i terminy. Źródła zweryfikowano 17 listopada 2026 r. Sprawy międzynarodowe, pełna ocena dochodu i hospitalizacja po porodzie mnogim wymagają sprawdzenia.

## Instalacja i kontrole

Używaj Node.js 22 lub nowszego i wersji Bun wskazanej w polu `packageManager` w `package.json`.

```sh
bun install --frozen-lockfile
bun run dev
bun run check
```

`bun run dev` uruchamia aplikację pod adresem `http://localhost:3000`. `bun run check` sprawdza formatowanie, uruchamia Oxlint, sprawdza typy, wykonuje testy i waliduje katalog. Do automatycznych poprawek użyj `bun run lint:fix` i `bun run format`. Aby uruchomić wersję produkcyjną lokalnie, wykonaj `bun run build`, a następnie `bun run start`.

## Odpowiedzi AI

Dodaj `AI_GATEWAY_API_KEY` do `.env.local` i uruchom ponownie serwer deweloperski. Na Vercel dodaj ten klucz w **Settings → Environment Variables** dla wybranego środowiska i wykonaj nowe wdrożenie. Domyślny model to `openai/gpt-5-mini`, dostępny w ramach darmowych kredytów AI Gateway. Aby go zastąpić, ustaw `MILA_AI_MODEL` na identyfikator modelu obsługującego odpowiedzi według JSON Schema i wykluczenie trenowania na promptach. [Uwierzytelnianie AI Gateway](https://vercel.com/docs/ai-gateway/authentication-and-byok)

Mila dołącza do pytania aktualne dla danej daty procedury, warunki, formularze, kwoty i identyfikatory źródeł z `src/data`. Z tych danych model układa odpowiedź, a aplikacja zamienia identyfikatory na linki z katalogu. Aby poszerzyć zakres wiedzy, dodaj zweryfikowane dane do katalogu i uruchom `bun run validate:data`. Plan, kwalifikację i terminy dla konkretnej osoby oblicza silnik w `src/engine`.

Poza katalogiem Gateway otrzymuje wpisane pytanie, etykietę bieżącego kroku i ewentualne identyfikatory źródeł z poprzedniej odpowiedzi. Wybrane odpowiedzi, profil i raport pozostają w aplikacji. Stałe odpowiedzi na krótkie pytania o przewodnik i FAQ działają lokalnie. Endpoint `POST /api/guide-help` wymaga JSON i ogranicza długość pytania, odpowiedzi oraz czas wywołania. Dla publicznego wdrożenia ustaw limit żądań na tym endpoincie i budżet klucza. [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) · [Budżety AI Gateway](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets)

## Nagrania Mili

Dodaj `ELEVENLABS_API_KEY=...` do pliku `.env.local` w katalogu projektu. Klucz potrzebuje uprawnienia Text to Speech. Uruchom `bun run audio:generate --dry-run`, aby sprawdzić liczbę brakujących nagrań, a następnie `bun run audio:generate`, aby je pobrać. Skrypt używa głosu `QWxjfoFYJP0TtqPaCcTu` i modelu Multilingual v2.

Do wdrożenia dołącz pliki MP3 z `public/audio/mila/` i manifest `src/features/guide/audioManifest.json`. Po zmianie tekstów uruchom generator ponownie. Aplikacja odtwarza gotowe MP3 i korzysta z syntezy przeglądarki dla pozostałych wiadomości.

## Źródła

`bun run sources fetch` pobiera kopie źródeł, a `bun run sources diff` porównuje je z sumami w manifeście. Oba polecenia przyjmują opcjonalną listę identyfikatorów źródeł. Zmiany wymagają ręcznej oceny.
