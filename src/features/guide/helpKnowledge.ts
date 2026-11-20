import { conditions } from "../../data/conditions";
import { procedures } from "../../data/procedures";
import { amounts, documents } from "../../data/references";
import { sources } from "../../data/sources";
import version from "../../data/version.json";
import { isCurrent } from "../../engine/dates";

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
