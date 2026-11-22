import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesDocumentCoverage } from "../src/features/parent/case-documents";
import { readScanPages } from "../src/features/parent/scan-evidence";

const application = {
  number: 2,
  text: [
    "ZAM — wniosek o wypłatę zasiłku macierzyńskiego",
    "[ ] za okres urlopu macierzyńskiego",
    "[X] za okres urlopu ojcowskiego",
    "[ ] za okres urlopu rodzicielskiego",
    "Wnioskowany okres od 02.11.2026 do 08.11.2026.",
    "Data urodzenia dziecka: 12.08.2026.",
    "Dotychczas wykorzystany urlop ojcowski: 0 tygodni.",
  ].join("\n"),
};

test("import bierze wnioskowany okres, stan na ten dzień i ustaloną podstawę ze stron źródłowych", () => {
  const { applications } = readScanPages([
    application,
    {
      number: 3,
      text: "Wniosek o poświadczenie ubezpieczenia chorobowego\nCzy osoba podlegała ubezpieczeniu chorobowemu 02.11.2026?",
    },
    {
      number: 4,
      text: "Odpowiedź na wniosek o poświadczenie ubezpieczenia\nTytuł: umowa o pracę.\nOsoba nie podlegała ubezpieczeniu chorobowemu w dniu 02.11.2026.",
    },
    {
      number: 5,
      text: "Podstawa wymiaru składek: 6 950,00 zł.\nUstalona miesięczna podstawa wymiaru zasiłku: 6 000,00 zł.",
    },
    {
      number: 6,
      text: "Decyzja\nPrzyznano zasiłek za okres od 01.11.2026 do 14.11.2026.\nUstalona podstawa wymiaru zasiłku: 7 000,00 zł.",
    },
  ]);
  assert.equal(applications.length, 1);
  const { requestedBenefit, candidates } = applications[0].read;
  assert.equal(requestedBenefit, "paternity");
  assert.deepEqual(
    candidates.filter(({ key }) => key === "basis" || key === "from" || key === "through"),
    [
      { key: "from", value: "2026-11-02", page: 2 },
      { key: "through", value: "2026-11-08", page: 2 },
      { key: "basis", value: 600_000, page: 5 },
    ],
  );
  const insured = candidates.find(({ key }) => key === "insured");
  assert.deepEqual(insured, {
    key: "insured",
    value: false,
    page: 4,
    coverage: { day: "2026-11-02", employment: "employee" },
  });
  assert.ok(insured);
  assert.ok(
    matchesDocumentCoverage(insured, "paternity", { from: "2026-11-02", employment: "employee" }),
  );
  assert.equal(
    matchesDocumentCoverage(insured, "paternity", { from: "2026-11-03", employment: "employee" }),
    false,
  );
  assert.equal(
    matchesDocumentCoverage(insured, "paternity", { from: "2026-11-02", employment: "contract" }),
    false,
  );
});

test("dwa wnioski zachowują swoje okresy i nie przejmują podstawy z nieprzypisanego załącznika", () => {
  const { applications } = readScanPages([
    application,
    {
      number: 8,
      text: "ZUR — wniosek o zasiłek za okres urlopu rodzicielskiego\nWnioskowany okres od 03.05.2027 do 14.11.2027.",
    },
    { number: 10, text: "Ustalona podstawa wymiaru zasiłku: 5 000,00 zł." },
  ]);
  assert.deepEqual(
    applications.map(({ page, read }) => [
      page,
      read.requestedBenefit,
      read.candidates.find(({ key }) => key === "from")?.value,
    ]),
    [
      [2, "paternity", "2026-11-02"],
      [8, "parental", "2027-05-03"],
    ],
  );
  assert.ok(applications.every(({ read }) => read.candidates.every(({ key }) => key !== "basis")));
});

test("brak poświadczenia na właściwy dzień nie zamienia się w odpowiedź o chorobowym", () => {
  const { applications } = readScanPages([
    application,
    {
      number: 3,
      text: "Wniosek o poświadczenie ubezpieczenia chorobowego\nTytuł: umowa o pracę.\nCzy osoba podlegała ubezpieczeniu chorobowemu w dniu 02.11.2026?",
    },
    {
      number: 4,
      text: "Odpowiedź na wniosek o poświadczenie ubezpieczenia\nTytuł: umowa o pracę.\nOsoba nie podlegała ubezpieczeniu chorobowemu w dniu 03.11.2026.",
    },
  ]);
  assert.equal(
    applications[0].read.candidates.some(({ key }) => key === "insured"),
    false,
  );
});

test("data urodzenia wnioskodawcy nie jest datą dziecka, a podpisana data dziecka zostaje", () => {
  const base = [
    "ZAO Wniosek o zasiłek macierzyński za okres urlopu ojcowskiego",
    "Twoje dane",
    "Data urodzenia: 01.01.2002",
    "Wnioskowany okres od 02.11.2026 do 08.11.2026",
  ].join("\n");
  const proposals = (text: string) =>
    readScanPages([{ number: 1, text }]).applications[0].read.candidates.filter(
      ({ key }) => key === "birth",
    );
  assert.deepEqual(proposals(base), []);
  assert.deepEqual(proposals(base + "\nData urodzenia dziecka: 12.08.2026"), [
    { key: "birth", value: "2026-08-12", page: 1 },
  ]);
  const { fallback } = readScanPages([
    { number: 1, text: "Odpis skrócony aktu urodzenia\nData urodzenia\n12.08.2026" },
  ]);
  assert.deepEqual(fallback.candidates, [{ key: "birth", value: "2026-08-12", page: 1 }]);
});

test("pierwsza strona i zakres tego samego ZUR tworzą jeden wniosek z datami i odsyłaczami", () => {
  const first = {
    number: 5,
    text: "ZUR Wniosek o zasiłek macierzyński za okres urlopu rodzicielskiego\nStrona 1 z 3",
  };
  const second = {
    number: 6,
    text: "ZUR\nZakres wniosku\nProszę o wypłatę zasiłku macierzyńskiego\n16.12.2024 - 07.02.2027",
  };
  const { applications, references } = readScanPages([
    first,
    second,
    { number: 7, text: "ZUR\nNumer i data wniosku\nStrona3z3" },
  ]);
  assert.deepEqual(
    applications.map(({ page }) => page),
    [6],
  );
  assert.deepEqual(applications[0].read.candidates, [
    { key: "from", value: "2024-12-16", page: 6 },
    { key: "through", value: "2027-02-07", page: 6 },
  ]);
  assert.deepEqual(
    references.map(({ page }) => page),
    [5, 6],
  );
  assert.deepEqual(
    readScanPages([first, { ...first, number: 6 }]).applications.map(({ page }) => page),
    [5, 6],
  );
});

test("kontynuacja ZAO bez czytelnych dat nie pojawia się jako drugi wniosek", () => {
  const { applications } = readScanPages([
    {
      number: 1,
      text: "ZAO Wniosek o zasiłek macierzyński za okres urlopu ojcowskiego\nDane wnioskodawcy",
    },
    { number: 2, text: "ZAO\nZakres wniosku\nod [nieczytelne] do [nieczytelne]" },
  ]);
  assert.deepEqual(
    applications.map(({ page }) => page),
    [2],
  );
  assert.equal(applications[0].read.requestedBenefit, "paternity");
  assert.deepEqual(applications[0].read.candidates, []);
});

test("notatka o braku zgłoszenia wymaga zgodnego dnia, tytułu i sąsiadującego wniosku o poświadczenie", () => {
  const request = {
    number: 3,
    text: "Wniosek o poświadczenie ubezpieczenia chorobowego\nZ tytułu 0411\nRoszczenie o zasiłek macierzyński za okres: 02.11.2026 – 08.11.2026",
  };
  const reply = {
    number: 4,
    text: [
      "Odpowiedź na wniosek o poświadczenie ubezpieczenia chorobowego",
      "Na datę badania, tj. 2026-11-02: Nie dotyczy",
      "Notatka UBS",
      "Brak zgłoszenia do dobrowolnego ubezpieczenia chorobowego",
    ].join("\n"),
  };
  const insured = (question: typeof request, answer: typeof reply) =>
    readScanPages([application, question, answer]).applications[0].read.candidates.find(
      ({ key }) => key === "insured",
    );
  assert.deepEqual(insured(request, reply), {
    key: "insured",
    value: false,
    page: 4,
    coverage: { day: "2026-11-02", employment: "contract" },
  });
  assert.equal(insured(request, { ...reply, number: 5 }), undefined);
  assert.equal(
    insured({ ...request, text: request.text.replace("Roszczenie o", "Wynagrodzenie za") }, reply),
    undefined,
  );
  assert.equal(
    insured(request, { ...reply, text: reply.text.replace("11-02", "11-03") }),
    undefined,
  );
  assert.equal(
    insured({ ...request, text: request.text.replace("0411", "0510") }, reply),
    undefined,
  );
  assert.equal(
    insured(request, { ...reply, text: reply.text.split("\n").slice(0, 2).join("\n") }),
    undefined,
  );
});

test("rozstrzygnięcia z numerem strony służą do porównania bez przenoszenia do kalkulatora", () => {
  const refusal = {
    number: 4,
    text: [
      "Decyzja",
      "Zakład Ubezpieczeń Społecznych postanawia:",
      "- odmówić prawa do zasiłku macierzyńskiego od 25-09-2025",
      "do dnia 08-10-2025.",
      "Ustalona podstawa wymiaru zasiłku: 7 000,00 zł.",
    ].join("\n"),
  };
  const { applications, fallback } = readScanPages([
    application,
    refusal,
    { number: 5, text: "W sprawie przyznano zasiłek macierzyński." },
    { number: 6, text: "Decyzja\nJeżeli przyznano zasiłek, pouczenie obowiązuje." },
  ]);
  assert.deepEqual(fallback.decisions, [
    { status: "refused", page: 4, from: "2025-09-25", through: "2025-10-08" },
    { status: "granted", page: 5, from: null, through: null },
  ]);
  assert.equal(applications.length, 1);
  assert.ok(
    applications[0].read.candidates.every(({ key }) => key !== "basis" && key !== "insured"),
  );
  assert.equal(readScanPages([refusal]).fallback.kind, "decision");
});

test("podstawa w złotych i groszach wymaga wyraźnego ustalenia podstawy zasiłku", () => {
  const { fallback } = readScanPages([
    { number: 1, text: "Podstawa wymiaru składek wynosi 7 000,00 zł." },
    { number: 2, text: "Ustalono podstawę wymiaru zasiłku w wysokości 6.000,25 zł." },
  ]);
  assert.deepEqual(fallback.candidates, [{ key: "basis", value: 600_025, page: 2 }]);
});
