import assert from "node:assert/strict";
import test from "node:test";
import { addMonths, isoDate, parseDate, warsawToday } from "../src/engine/dates";
import { evaluateProcedure } from "../src/engine/evaluateProcedure";
import { procedures } from "../src/data/procedures";

const find = (id: string) => procedures.find((procedure) => procedure.id === id)!;

test("walidacja kalendarza, koniec miesiąca i czas w Polsce", () => {
  assert.equal(parseDate("2026-02-29"), undefined);
  assert.equal(parseDate("2026-13-01"), undefined);
  assert.equal(isoDate(addMonths(parseDate("2027-01-31")!, 1)), "2027-02-28");
  assert.equal(isoDate(addMonths(parseDate("2028-01-31")!, 1)), "2028-02-29");
  assert.equal(warsawToday(new Date("2026-11-17T23:30:00Z")), "2026-11-18");
});

test("USC liczy od karty, zdrowotne od zgłoszonego zdarzenia, rodzicielski wstecz", () => {
  const profile = {
    stage: "born",
    birthDate: "2026-11-03",
    birthCardDate: "2026-11-05",
    healthRegistrationTrigger: "2026-11-11",
    parentalStart: "2027-01-04",
  } as const;
  assert.equal(
    evaluateProcedure(profile, find("BIRTH_REGISTRATION"), "2026-11-17").deadlines[0].date,
    "2026-11-26",
  );
  assert.equal(
    evaluateProcedure(profile, find("CHILD_HEALTH_INSURANCE"), "2026-11-17").deadlines[0].date,
    "2026-11-18",
  );
  assert.equal(
    evaluateProcedure(profile, find("PARENTAL_LEAVE"), "2026-11-17").deadlines[0].date,
    "2026-12-14",
  );
  assert.equal(
    evaluateProcedure(
      { ...profile, birthCardDate: undefined },
      find("BIRTH_REGISTRATION"),
      "2026-11-17",
    ).deadlines[0].missingField,
    "birthCardDate",
  );
});

test("800+ liczy trzy miesiące i osobno następne okno świadczeniowe", () => {
  const [newborn, period] = evaluateProcedure(
    { stage: "born", birthDate: "2026-08-31" },
    find("CHILD_800_PLUS"),
    "2026-11-17",
  ).deadlines;
  assert.equal(newborn.date, "2026-11-30");
  assert.equal(period.opens, "2027-02-01");
  assert.equal(period.date, "2027-06-30");
});
