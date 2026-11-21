# Mila — blisko siebie

Autorski prototyp Rive. Otwórz lokalny podgląd:

```powershell
./prototypes/mila-family-hug/preview.ps1
```

Po trzech sekundach rodzina zbliża się i przytula. Kliknięcie sceny uruchamia
przejście wcześniej. `-Mode Manual` czeka na kliknięcie, `-Mode Still` pokazuje
nieruchome objęcie. Ponowne uruchomienie podglądu rozpoczyna scenę od nowa.

## Pliki do oceny

- `renders/family-hug.gif` — sekwencja z natywnego renderera, odtwarzana raz.
- `renders/calm-loop.gif` — sześciusekundowa pętla po objęciu.
- `renders/contact-sheet.png` i sześć numerowanych PNG — klatki kontrolne.
- `poses/start.png`, `poses/final.png` — kluczowe pozy.
- `scene.rml` — edytowalne ilustracje, rig, pięć timeline’ów i maszyna stanów.
- `artwork/family.svg` — autorski rysunek przed riggingiem; materiał odniesienia.
- `tools/render-preview.py` — odtwarza scenę w Rive, zapisuje PNG i GIF,
  porównuje fazy pętli oraz sprawdza nieruchomą pozę. Nie generuje RML.

RML jest źródłem bieżącej sceny. Nie konwertuj ponownie SVG na `scene.rml`:
nadpisałoby to ręcznie przygotowany rig i animację.

## Sterowanie i rig

`FamilyHug`: początek → przygotowanie (0,6 s) → uścisk (0,8 s) → spokojna
pętla (6 s). `FamilyControls.hug=true` uruchamia przejście;
`autoplay=false` wyłącza automatyczny start; `still=true` wybiera nieruchomą
pozę końcową. Tryb Still pozostaje aktywny do przeładowania sceny.

Główne ramię drugiego rodzica: `RootBone` + `Bone`, dwa `Tendon` i sześć
`CubicWeight` deformujących rękaw. Pozostałe kończyny mają hierarchie przegubów
z osobnymi barkami i łokciami; głowy poruszają się niezależnie. To częściowy
rig wektorowy, bez pełnego IK ani automatycznego dopasowywania anatomii.
Ramię z tyłu korzysta z maski i osobnego rysunku dłoni ujawnianego przy
kontakcie. Rozdzielenie warstw chroni twarz niemowlęcia przed zasłonięciem.

## Weryfikacja

Wymagany Rive CLI 1.10.0. Renderowanie podglądów wymaga również Python 3 i Pillow
(zastane w środowisku; nie instalowano zależności aplikacji).

```powershell
rive prototypes/mila-family-hug --verify
rive inspect prototypes/mila-family-hug --summary
python prototypes/mila-family-hug/tools/render-preview.py
```

`renders/verification.json` przechowuje wynik porównania obrazów. Obrazki
surowych klatek i raporty robocze są lokalne i ignorowane przez Git.

Lokalny podgląd i renderowanie działają bez konta. CLI 1.10.0 kompiluje scenę
w pamięci, ale w tym środowisku nie zapisuje trwałego `.riv` bez logowania.
Eksport przez `--publish` lub `.rev` wymaga sesji Rive; nie wykonywano go.
Nie użyto usług generujących ilustracje, kredytów, konta ani publikacji.

Nie dodano runtime’u Rive do Next.js. Nie zmieniono aplikacji. Nie użyto danych
ani grafiki Lemonade. Kadrowanie jest kwadratowe, z zapasem nad głowami;
osobny układ mobilny będzie wymagał oceny przy integracji.
