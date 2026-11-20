# Mila — katalog i silnik

Mila prowadzi krótką rozmowę i układa plan przygotowań, świadczeń oraz formalności związanych z ciążą i rodzicielstwem. Katalog świadczeń, formularzy, terminów i źródeł znajduje się w `src/data`, a deterministyczny silnik w `src/engine`. Silnik przyjmuje profil i datę oceny w formacie RRRR-MM-DD. Wyniki zawierają przesłanki, źródła, brakujące odpowiedzi i terminy. Źródła zweryfikowano 17 listopada 2026 r. Sprawy międzynarodowe, pełna ocena dochodu i hospitalizacja po porodzie mnogim wymagają sprawdzenia.

## Instalacja i kontrole

Używaj wersji Bun wskazanej w polu `packageManager` w `package.json`.

```sh
bun install --frozen-lockfile
bun run dev
bun run check
```

`bun run dev` uruchamia aplikację pod adresem `http://localhost:3000`. `bun run check` sprawdza formatowanie, uruchamia Oxlint, sprawdza typy, wykonuje testy i waliduje katalog. Do automatycznych poprawek użyj `bun run lint:fix` i `bun run format`. Aby uruchomić wersję produkcyjną lokalnie, wykonaj `bun run build`, a następnie `bun run start`.

Wpisane pytania Mila dopasowuje do odpowiedzi ze źródłami. Ustaw serwerowy `OPENAI_API_KEY` (lokalnie w `.env.local`), aby włączyć dopasowanie przez AI dla pytań, których nie rozpoznaje lokalnie. Opcjonalnie ustaw `OPENAI_HELP_MODEL`, aby zmienić domyślny model `gpt-4.1-mini`. Do API trafia tylko wpisane pytanie, treść bieżącego pytania Mili oraz lista możliwych odpowiedzi.

## Źródła

`bun run sources fetch` pobiera kopie źródeł, a `bun run sources diff` porównuje je z sumami w manifeście. Oba polecenia przyjmują opcjonalną listę identyfikatorów źródeł. Zmiany wymagają ręcznej oceny.
