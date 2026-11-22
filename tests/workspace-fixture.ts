import type { Benefit } from "../src/engine/parent-case";
import { newSession, selectBenefit } from "../src/features/parent/case-session";
import type { CaseSession } from "../src/features/parent/case-session";
import { personIdSchema, isoDateSchema } from "../src/features/parent/family-session";

/** Existing calculator tests now explicitly select the person/event before writing facts. */
export function calculatorSession(benefit: Benefit, asOf = "2026-11-21"): CaseSession {
  const s = newSession();
  const personId = personIdSchema.parse("fixture:person");
  const role = ["paternity", "adoptivePaternity", "maternityTransfer"].includes(benefit)
    ? "otherParent"
    : "birthing";
  return selectBenefit(
    {
      ...s,
      asOf,
      data: {
        ...s.data,
        asOf: isoDateSchema.parse(asOf),
        family: {
          ...s.data.family,
          stage: {
            state: "confirmed",
            value: "born",
            revision: 0,
            source: { kind: "demo", label: "test" },
            validTime: { kind: "undated" },
            basis: "observed",
          },
          event: {
            ...s.data.family.event,
            kind: {
              state: "confirmed",
              value: "birth",
              revision: 0,
              source: { kind: "demo", label: "test" },
              validTime: { kind: "undated" },
              basis: "observed",
            },
          },
        },
        persons: [{ id: personId, roles: [role], titles: [], procedureFacts: {} }],
        navigation: { view: "start", activeSubject: { kind: "person", personId } },
      },
    },
    benefit,
  );
}
