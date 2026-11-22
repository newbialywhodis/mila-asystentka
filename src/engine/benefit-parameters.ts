import { addDays, addMonths, isoDate, parseDate } from "./dates";

// Art. 46 ustawy zasiłkowej. Każda kwota obowiązuje przez trzy miesiące.
// Komunikaty Prezesa GUS o przeciętnym wynagrodzeniu dla celów emerytalnych.
const postInsuranceCeilings = [
  { from: "2023-03-01", basis: 673_349 },
  { from: "2023-06-01", basis: 712_426 },
  { from: "2023-09-01", basis: 700_576 },
  { from: "2023-12-01", basis: 719_495 },
  { from: "2024-03-01", basis: 754_036 },
  { from: "2024-06-01", basis: 814_738 },
  { from: "2024-09-01", basis: 803_841 },
  { from: "2024-12-01", basis: 816_162 },
  { from: "2025-03-01", basis: 847_721 },
  { from: "2025-06-01", basis: 896_228 },
  { from: "2025-09-01", basis: 874_863 },
  { from: "2025-12-01", basis: 877_170 },
  { from: "2026-03-01", basis: 919_779 },
  { from: "2026-06-01", basis: 956_288 },
  { from: "2026-09-01", basis: 923_313 },
  { from: "2026-12-01", basis: 931_701 },
];

export function postInsuranceBasis(from: string, through: string, basis: number) {
  const segments: { from: string; through: string; basis: number }[] = [];
  let next = from;
  for (const ceiling of postInsuranceCeilings) {
    const start = parseDate(ceiling.from);
    if (!start) continue;
    const end = addMonths(start, 3);
    const last = isoDate(addDays(end, -1));
    if (next < ceiling.from || next > last) continue;
    const stop = through < last ? through : last;
    const amount = Math.min(basis, ceiling.basis);
    const previous = segments.at(-1);
    if (previous?.basis === amount) previous.through = stop;
    else segments.push({ from: next, through: stop, basis: amount });
    if (stop === through) return segments;
    next = isoDate(end);
  }
}

// Art. 19 ustawy zasiłkowej. Wskaźniki kwartalne ZUS, w setnych częściach procenta.
// https://www.zus.pl/baza-wiedzy/skladki-wskazniki-odsetki/wskazniki/zasilki
const rehabilitationIndex: Record<number, readonly number[]> = {
  2023: [10_390, 10_940, 10_990, 10_400],
  2024: [10_100, 10_760, 11_320, 10_660],
  2025: [10_020, 10_550, 10_980, 10_320],
  2026: [9787, 10_510, 10_900, 10_040],
};

export function indexedRehabilitationBasis(basis: number, firstDay: Date) {
  const quarter = Math.floor(firstDay.getUTCMonth() / 3);
  const index = rehabilitationIndex[firstDay.getUTCFullYear()]?.[quarter];
  if (index !== undefined) return Math.round((basis * Math.max(10_000, index)) / 10_000);
}
