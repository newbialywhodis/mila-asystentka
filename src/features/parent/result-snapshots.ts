import { timeContains } from "./family-session";
import { procedureIdSchema } from "../../data/discovery";
import type { InterviewSession } from "./interview-session";
import { toCaseFacts, toProcedureProfile } from "./interview-profile";
import type { ProjectionDependency } from "./interview-profile";

export function dependencyStamp(dependencies: readonly ProjectionDependency[] | undefined) {
  return JSON.stringify(
    dependencies?.filter(
      ({ ref, validTime, onDay }) =>
        !(onDay && validTime && !timeContains(validTime, onDay)) &&
        !(ref.kind === "person" && ref.field === "titles") &&
        !(ref.kind === "title" && ref.field === "sicknessCoverage" && !ref.coverageId) &&
        !(ref.kind === "selection" && ref.field === "persons") &&
        !(ref.kind === "family" && ref.field === "children") &&
        !(ref.kind === "assessment" && (ref.field === "state" || ref.field === "configuration")),
    ),
  );
}

/** Invalidation reads the same projections used for execution and export. */
export function refreshSnapshots(s: InterviewSession): InterviewSession {
  return {
    ...s,
    assessments: s.assessments.map((a) => {
      if (!a.result || a.result.state === "stale") return a;
      if (a.kind === "comparison" && a.firstAssessmentId && a.secondAssessmentId) {
        const dependencies = [
          ...toCaseFacts(s, a.firstAssessmentId).dependencies,
          ...toCaseFacts(s, a.secondAssessmentId).dependencies,
        ];
        return dependencyStamp(dependencies) === dependencyStamp(a.result.projectionDependencies)
          ? a
          : { ...a, result: { ...a.result, state: "stale" } };
      }
      const projection =
        a.kind === "calculator"
          ? toCaseFacts(s, a.id)
          : a.kind === "procedure"
            ? toProcedureProfile(s, procedureIdSchema.parse(a.procedureId), a.target, a.asOf)
            : undefined;
      if (
        projection &&
        JSON.stringify(projection.value) === JSON.stringify(a.result.input) &&
        (!a.result.projectionDependencies ||
          dependencyStamp(projection.dependencies) ===
            dependencyStamp(a.result.projectionDependencies))
      )
        return a;
      if (a.kind === "calculator") return { ...a, result: { ...a.result, state: "stale" } };
      if (a.kind === "procedure") return { ...a, result: { ...a.result, state: "stale" } };
      return { ...a, result: { ...a.result, state: "stale" } };
    }),
  };
}
