import assert from "node:assert/strict";
import test from "node:test";
import { calculateSupplement } from "../src/engine/prematurity";

const birth = { birthDate: "2026-01-01", childrenBorn: 1, hospitalized: true } as const;
const asOf = "2026-11-17";

test("sumuje rozłączne dni, usuwa nakładanie i zaokrągla sumę w górę", () => {
  const state = calculateSupplement(
    {
      ...birth,
      gestationalWeeks: 27,
      birthWeightGrams: 900,
      hospitalStays: [
        { from: "2026-01-01", through: "2026-01-04" },
        { from: "2026-01-03", through: "2026-01-07" },
        { from: "2026-01-12", through: "2026-01-12" },
      ],
    },
    asOf,
  );
  assert.deepEqual(state, { state: "calculated", weeks: 2 });
});

test("próg masy urodzeniowej działa niezależnie od wieku ciążowego", () => {
  const profile = {
    ...birth,
    gestationalWeeks: 38,
    hospitalStays: [{ from: "2026-01-01", through: "2026-06-01" }],
  };
  assert.deepEqual(calculateSupplement({ ...profile, birthWeightGrams: 1000 }, asOf), {
    state: "calculated",
    weeks: 15,
  });
  assert.deepEqual(
    calculateSupplement({ ...profile, gestationalWeeks: 28, birthWeightGrams: 1001 }, asOf),
    { state: "calculated", weeks: 8 },
  );
});

test("urodzenie o czasie wymaga dwóch kolejnych dni z pierwszym między dniem 5 i 28", () => {
  const profile = { ...birth, gestationalWeeks: 39, birthWeightGrams: 3400 };
  assert.deepEqual(
    calculateSupplement(
      { ...profile, hospitalStays: [{ from: "2026-01-01", through: "2026-01-06" }] },
      asOf,
    ),
    { state: "calculated", weeks: 0 },
  );
  assert.deepEqual(
    calculateSupplement(
      { ...profile, hospitalStays: [{ from: "2026-01-01", through: "2026-01-07" }] },
      asOf,
    ),
    { state: "calculated", weeks: 1 },
  );
  assert.deepEqual(
    calculateSupplement(
      { ...profile, hospitalStays: [{ from: "2026-01-29", through: "2026-01-30" }] },
      asOf,
    ),
    { state: "calculated", weeks: 1 },
  );
  assert.deepEqual(
    calculateSupplement(
      { ...profile, hospitalStays: [{ from: "2026-01-30", through: "2026-02-01" }] },
      asOf,
    ),
    { state: "calculated", weeks: 0 },
  );
});

test("brak dat nie daje liczby tygodni, a poród mnogi wymaga sprawdzenia", () => {
  assert.deepEqual(
    calculateSupplement({ ...birth, gestationalWeeks: 27, birthWeightGrams: 920 }, asOf),
    { state: "unknown", fields: ["hospitalStays"] },
  );
  assert.equal(calculateSupplement({ ...birth, childrenBorn: 2 }, asOf).state, "review");
});
