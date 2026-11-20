import assert from "node:assert/strict";
import { conditions, reviewOnFailure } from "../src/data/conditions";
import { procedures } from "../src/data/procedures";
import { questions } from "../src/data/questions";
import { amounts, documents } from "../src/data/references";
import { sources } from "../src/data/sources";
import version from "../src/data/version.json";
import { parseDate } from "../src/engine/dates";
import type { Validity } from "../src/types/catalog";

function refs(ids: readonly string[], records: object, owner: string) {
  for (const id of ids)
    assert.ok(Object.hasOwn(records, id), owner + ": nieznany identyfikator " + id);
}

function validity(interval?: Validity) {
  if (!interval) return;
  if (interval.from) assert.ok(parseDate(interval.from));
  if (interval.through) assert.ok(parseDate(interval.through));
  if (interval.from && interval.through) assert.ok(interval.from <= interval.through);
}

assert.ok(parseDate(version.verifiedAt));
assert.equal(new Set(procedures.map((procedure) => procedure.id)).size, procedures.length);
refs([...reviewOnFailure], conditions, "reviewOnFailure");

for (const [id, source] of Object.entries(sources)) {
  assert.ok(parseDate(source.verifiedAt), id);
  assert.ok(source.verifiedAt <= version.verifiedAt, id);
  assert.equal(new URL(source.url).protocol, "https:", id);
  if (source.snapshotUrl) assert.equal(new URL(source.snapshotUrl).protocol, "https:", id);
}

for (const [id, condition] of Object.entries(conditions)) {
  assert.ok(condition.sources.length, id);
  refs(condition.sources, sources, id);
  if ("field" in condition.fact) refs([condition.fact.field], questions, id);
}

for (const [id, document] of Object.entries(documents)) {
  refs([document.source], sources, id);
  validity(document.validity);
  if (document.kind === "online-wizard")
    assert.doesNotMatch(sources[document.source].url, /\.pdf(?:[/?]|$)/i, id);
}

for (const [id, amount] of Object.entries(amounts)) {
  assert.ok(Number.isFinite(amount.value) && amount.value >= 0, id);
  assert.ok(amount.sources.length, id);
  refs(amount.sources, sources, id);
  refs(amount.when ?? [], conditions, id);
  validity(amount.validity);
}

for (const procedure of procedures) {
  const { id } = procedure;
  refs(procedure.sources, sources, id);
  assert.ok(
    procedure.sources.some((source) => sources[source].type !== "law"),
    id,
  );
  assert.ok(
    procedure.sources.some((source) => sources[source].type === "law"),
    id,
  );
  assert.ok(procedure.conditions.length, id);
  refs(procedure.conditions, conditions, id);
  refs(procedure.amounts ?? [], amounts, id);
  validity(procedure.validity);
  assert.equal(
    new Set(procedure.deadlines.map((deadline) => deadline.id)).size,
    procedure.deadlines.length,
    id,
  );
  for (const deadline of procedure.deadlines) {
    refs(deadline.sources, sources, deadline.id);
    if (deadline.rule.type === "offset") refs([deadline.rule.field], questions, deadline.id);
  }
  for (const requirement of procedure.documents) {
    refs([requirement.id], documents, id);
    refs(requirement.when ?? [], conditions, id);
  }
}

console.log(
  `Sprawdzono ${procedures.length} procedur, ${Object.keys(documents).length} dokumenty i ${Object.keys(sources).length} źródeł.`,
);
