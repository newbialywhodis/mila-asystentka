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
