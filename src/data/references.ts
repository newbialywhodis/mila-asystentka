import documentRecords from "./documents.json";
import amountRecords from "./amounts.json";
import type { Amount, Document } from "../types/catalog";

export const documents: Readonly<Record<string, Document>> = documentRecords as Record<
  string,
  Document
>;
export const amounts: Readonly<Record<string, Amount>> = amountRecords as Record<string, Amount>;
