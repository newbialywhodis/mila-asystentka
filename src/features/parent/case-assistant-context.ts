import { getParentCase, getCaseContext, getBenefitTurn } from "./case-session";
import type { CaseSession, CaseTurn } from "./case-session";
import { caseFactOwnership, profileOwnership, confirmedValue } from "./family-session";
import { intentFieldSchema } from "./intent-contract";
import type { FactKey } from "../../engine/parent-case";
import type { Field } from "../../types/profile";
import { questions } from "../../data/questions";
import type { Question } from "../../types/catalog";
import type { IntentField } from "./intent-contract";
import { procedureIdSchema } from "../../data/discovery";
import { procedureProjection } from "./workspace-session";
import type { AssistantRequest } from "./parent-intent";

function toAssistantMessage(turn: CaseTurn): AssistantRequest["messages"][number] | undefined {
  switch (turn.kind) {
    case "user":
      return turn.local ? undefined : { role: "user", content: turn.text };
    case "help":
      return { role: "assistant", content: turn.answer.text };
    case "reply":
    case "pregnancyConcern":
      return { role: "assistant", content: turn.text };
    default:
      return undefined;
  }
}

/** The aliases are request-local. No identifiers, confirmed values, results or files. */
export function assistantAliases(session: CaseSession) {
  const subject = session.data.navigation.activeSubject;
  const person =
    subject?.kind === "person"
      ? session.data.persons.find((p) => p.id === subject.personId)
      : undefined;
  const relatedId = session.data.assessments.find((a) => a.id === session.activeAssessmentId)
    ?.target.relatedPersonId;
  const targetSubject = session.data.assessments.find((a) => a.id === session.activeAssessmentId)
    ?.target.subject;
  const selectedTitle =
    targetSubject?.kind === "person" && targetSubject.personId === person?.id
      ? targetSubject.titleId
      : subject?.kind === "person"
        ? subject.titleId
        : undefined;
  const others = session.data.persons.filter((p) => p.id !== person?.id);
  const related = relatedId
    ? others.find((p) => p.id === relatedId)
    : others.length === 1
      ? others[0]
      : undefined;
  return { subject: person, related, title: person?.titles.find((t) => t.id === selectedTitle) };
}

export function buildAssistantRequest(session: CaseSession, text: string): AssistantRequest {
  if (session.privacy !== "standard")
    throw new Error("Swobodny kanał AI jest wyłączony w tej rozmowie");
  const turn = getBenefitTurn(session);
  const pregnancyConcern = session.turns.at(-1)?.kind === "pregnancyConcern";
  const question =
    session.view === "calculator" && turn?.kind === "assessment" && !pregnancyConcern
      ? turn.question
      : undefined;
  const active = session.view === "interview" ? session.data.interview.active : undefined;
  const procedure = session.view === "procedure" ? procedureProjection(session) : undefined;
  const aliases = assistantAliases(session);
  const speakerId =
    session.data.navigation.speaker?.kind === "self"
      ? session.data.navigation.speaker.personId
      : undefined;
  const confirmed = new Set<IntentField>(
    Object.keys(getParentCase(session).facts) as IntentField[],
  );
  if (confirmedValue(session.data.family.stage)) confirmed.add("stage");
  if (confirmedValue(session.data.family.pregnancyPeriod)) confirmed.add("pregnancyPeriod");
  if (
    aliases.subject?.titles.some((t) => t.employment?.state === "confirmed") ||
    aliases.subject?.workSituation?.state === "confirmed"
  )
    confirmed.add("employment");
  if (procedure)
    for (const key of Object.keys(procedure.projection.value)) {
      const field = intentFieldSchema.safeParse(`procedure:${key}`);
      if (field.success) confirmed.add(field.data);
    }
  const history: AssistantRequest["messages"] = [];
  // Only the current conversational exchange; workflow transitions are boundaries.
  for (const previous of session.turns.slice().reverse()) {
    const message = toAssistantMessage(previous);
    if (!message || history.length >= 6) break;
    history.unshift(message);
  }
  const missing: IntentField[] = question
    ? [question.key]
    : procedure?.missing
      ? [`procedure:${procedure.missing}`]
      : active?.id === "stage"
        ? ["stage"]
        : active?.id === "employment"
          ? ["employment"]
          : active?.id === "need"
            ? ["need"]
            : active?.id === "timing"
              ? [active.field]
              : [];
  const assessmentTarget = session.data.assessments.find(
    (a) => a.id === session.activeAssessmentId,
  )?.target;
  const childCount = assessmentTarget?.childIds.length || session.data.family.children.length;
  const allowedFields = intentFieldSchema.options.filter((field) => {
    if (["hospitalRanges", "careChildren"].includes(field)) return false;
    if (field.startsWith("procedure:")) {
      const key = field.slice(10) as Field;
      const q: Question = questions[key];
      if (q.input === "hospital" || (childCount > 1 && profileOwnership[key] === "child"))
        return false;
    } else if (
      childCount > 1 &&
      (caseFactOwnership[field as FactKey] === "child" ||
        ["hospitalFrom", "hospitalThrough", "careCertificate"].includes(field))
    )
      return false;
    if (
      [
        "birthStage",
        "procedure:stage",
        "procedure:dueDate",
        "procedure:birthDate",
        "procedure:childrenBorn",
        "procedure:employment",
        "procedure:otherParentEmployment",
        "procedure:sicknessInsurance",
        "procedure:insuredAtBirth",
      ].includes(field)
    )
      return false;
    if (field.startsWith("procedure:")) return Boolean(procedure);
    if (
      [
        "stage",
        "pregnancyPeriod",
        "employment",
        "insured",
        "dueDate",
        "birth",
        "children",
        "need",
      ].includes(field)
    )
      return true;
    return session.view === "calculator";
  });
  return {
    version: 2,
    messages: [...history, { role: "user", content: text }],
    context: {
      mode:
        session.view === "scope"
          ? "scope"
          : session.view === "interview"
            ? "interview"
            : session.view === "discovery"
              ? "discovery"
              : session.view === "calculator" || session.view === "procedure"
                ? question || procedure?.missing
                  ? "assessment"
                  : "result"
                : "idle",
      questionKind: active ? "interview" : question ? "calculator" : procedure ? "procedure" : null,
      activeQuestion:
        active?.id ??
        question?.key ??
        (procedure?.missing ? `procedure:${procedure.missing}` : null),
      allowedFields,
      subject: aliases.subject ? "subject" : null,
      related: aliases.related ? "related" : null,
      speaker:
        speakerId && speakerId === aliases.subject?.id
          ? "subject"
          : speakerId && speakerId === aliases.related?.id
            ? "related"
            : null,
      title: aliases.title ? "selected" : null,
      benefit: turn?.kind === "chooseBenefit" ? null : getCaseContext(session).benefit,
      procedure: procedure ? procedureIdSchema.parse(procedure.assessment.procedureId) : null,
      goal: getCaseContext(session).goal,
      pending: question?.key ?? null,
      confirmed: [...confirmed],
      missing,
    },
  };
}
