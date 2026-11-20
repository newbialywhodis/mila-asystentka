import { procedures } from "../data/procedures";
import type { Phase, ProcedureResult } from "../types/catalog";
import type { Field, Profile } from "../types/profile";
import { evaluateProcedure } from "./evaluateProcedure";

const phaseOrder: Record<Phase, number> = { pregnancy: 0, birth: 1, later: 2 };

function upcomingDeadline(result: ProcedureResult, asOf: string): string {
  return (
    result.deadlines
      .map(({ date }) => date)
      .filter((date): date is string => Boolean(date && date >= asOf))
      .sort()[0] ?? "9999-12-31"
  );
}

export function generatePlan(profile: Profile, asOf: string) {
  const results = procedures.map((procedure) => evaluateProcedure(profile, procedure, asOf));
  const items = results
    .filter(({ status }) => status !== "not-relevant")
    .sort((a, b) => {
      return (
        phaseOrder[a.procedure.phase] - phaseOrder[b.procedure.phase] ||
        upcomingDeadline(a, asOf).localeCompare(upcomingDeadline(b, asOf))
      );
    });
  const conflicts: { fields: Field[]; message: string }[] = [];
  if (
    profile.activeComponent === "work" &&
    (profile.workActive === false ||
      (profile.singleParent === false && profile.otherWorkActive === false))
  ) {
    conflicts.push({
      fields: [profile.workActive === false ? "workActive" : "otherWorkActive", "activeComponent"],
      message:
        "Deklarowana aktywność i pobieranie świadczenia „Aktywni rodzice w pracy” wymagają potwierdzenia. Sprawdź odpowiedzi oraz ewentualny okres zachowania prawa w ZUS.",
    });
  }
  return { results, items, conflicts };
}
