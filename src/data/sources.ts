import records from "./sources.json";
import type { Source } from "../types/catalog";

export const sources: Readonly<Record<string, Source>> = records as Record<string, Source>;
