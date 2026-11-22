import { conditions } from "../../data/conditions";
import { procedures } from "../../data/procedures";
import { amounts, documents } from "../../data/references";
import { sources } from "../../data/sources";
import version from "../../data/version.json";
import { isCurrent } from "../../engine/dates";
import { generalHelpTopics, helpTopics, maxHelpAnswerLength } from "./helpAnswers";
import type { HelpAnswer } from "./helpAnswers";

/** Approved passages, not a JSON-shape or a citation-as-proof heuristic. */
export function getGroundedHelpPassages(asOf: string): HelpAnswer[] {
  return [
    ...helpTopics,
    ...Object.values(generalHelpTopics),
    ...procedures
      .filter((p) => isCurrent(p.validity, asOf))
      .map((p) => ({
        text: [p.summary, ...p.steps, p.review].filter(Boolean).join(" "),
        sourceIds: p.sources,
      })),
  ].filter((p) => p.text.length <= maxHelpAnswerLength && "sourceIds" in p && p.sourceIds?.length);
}

export function groundHelpAnswer(
  text: string,
  sourceIds: readonly string[],
  asOf: string,
): HelpAnswer | undefined {
  const passage = getGroundedHelpPassages(asOf).find(
    (p) =>
      p.text === text &&
      p.sourceIds?.length === sourceIds.length &&
      p.sourceIds.every((id) => sourceIds.includes(id)),
  );
  return passage && { text: passage.text, sourceIds: passage.sourceIds };
}

const sourceIndex = Object.fromEntries(
  Object.entries(sources).map(([id, { authority, title }]) => [id, { authority, title }]),
);

export function getHelpKnowledge(asOf: string) {
  const currentDocuments = Object.fromEntries(
    Object.entries(documents).filter(([, { validity }]) => isCurrent(validity, asOf)),
  );
  const currentAmounts = Object.fromEntries(
    Object.entries(amounts).filter(([, { validity }]) => isCurrent(validity, asOf)),
  );
  return {
    verifiedAt: version.verifiedAt,
    procedures: procedures
      .filter(({ validity }) => isCurrent(validity, asOf))
      .map((procedure) => ({
        ...procedure,
        documents: procedure.documents.filter(({ id }) => Object.hasOwn(currentDocuments, id)),
        amounts: procedure.amounts?.filter((id) => Object.hasOwn(currentAmounts, id)),
      })),
    conditions,
    documents: currentDocuments,
    amounts: currentAmounts,
    sources: sourceIndex,
  };
}
