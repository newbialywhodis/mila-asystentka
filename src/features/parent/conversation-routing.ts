import { append, appendAssessment, getBenefitTurn } from "./case-session";
import type { CaseSession } from "./case-session";
import {
  editInterview,
  interviewText,
  pauseWorkspaceInterview,
  requestDestination,
  showDiscovery,
  showInterview,
  showProcedure,
  procedureProjection,
  revisableInterviewAnswers,
  personRoleLabels,
} from "./workspace-session";
import { cancelInterviewOperation } from "./interview-session";
import { questions } from "../../data/questions";
import type { Question } from "../../types/catalog";
import { explainCurrentResult } from "./result-explanation";
import { interviewQuestions, readInterviewAnswer } from "./interview";
import { findHelpAnswer } from "../guide/helpAnswers";
import { normalizeGuideText } from "../guide/textInput";
import type { CaseAction } from "./parent-intent";
import { readNavigationIntent } from "./intent-contract";
import { sameQuestion } from "./interview";

export function applyConversationIntent(
  s: CaseSession,
  intent: Extract<CaseAction, { kind: "interpret" }>["intent"],
): CaseSession {
  if (intent === "showMatches") return showDiscovery(s);
  if (intent === "pause") return pauseWorkspaceInterview(s);
  if (intent === "resume") return showInterview(s, true);
  if (intent === "explainResult") return explainCurrentResult(s);
  if (intent === "documents")
    return s.view === "calculator"
      ? explainCurrentResult(s)
      : s.view === "procedure"
        ? showProcedure({
            ...s,
            procedureInstructions: true,
            data: cancelInterviewOperation(s.data),
          })
        : append(s, { kind: "note", text: "Wybierz sprawę, aby zobaczyć właściwe dokumenty." });
  if (intent === "switchSubject") {
    if (s.view === "calculator" && s.benefit)
      return requestDestination(s, { kind: "calculator", benefit: s.benefit });
    return editInterview(s, { id: "subject", eventId: s.data.family.event.id });
  }
  if (intent === "back") {
    const previous = revisableInterviewAnswers(s)
      .filter((ref) => !s.data.interview.active || !sameQuestion(ref, s.data.interview.active))
      .at(-1);
    return previous
      ? editInterview(s, previous)
      : append(s, {
          kind: "note",
          text: "Nie ma wcześniejszej odpowiedzi do poprawienia. Możesz wrócić do dopasowanych spraw.",
        });
  }
  if (intent === "changeGoal") return showDiscovery(s);
  if (intent === "explainQuestion") {
    if (s.view === "procedure") {
      const p = procedureProjection(s);
      const field = s.procedureQuestion ?? p?.missing;
      const q: Question | undefined = field ? questions[field] : undefined;
      return append(s, {
        kind: "note",
        text:
          q?.hint ??
          "To pytanie pochodzi z katalogu formalności. Pomaga sprawdzić warunki lub termin tej sprawy. Możesz odłożyć odpowiedź i zobaczyć instrukcję.",
      });
    }
    const active = s.data.interview.active;
    const turn = getBenefitTurn(s);
    const text =
      s.view === "interview" && active
        ? `${interviewQuestions[active.id].why} ${interviewQuestions[active.id].simple}`
        : turn?.kind === "assessment" && turn.question
          ? (turn.question.hint ??
            "To pole pomaga kalkulatorowi sprawdzić warunki, okres lub kwotę. Możesz odłożyć odpowiedź.")
          : "Wybierz sprawę lub pytanie, które mam wyjaśnić.";
    return append(s, { kind: "note", text });
  }
  return append(s, {
    kind: "note",
    text: "Możesz odpowiedzieć kontrolkami przy pytaniu, wybrać ogólny temat pomocy albo zobaczyć możliwe sprawy.",
  });
}

export function routeConversationCommand(s: CaseSession, input: string): CaseSession | undefined {
  const text = normalizeGuideText(input).replace(/[.!?]+$/, "");
  const navigation = readNavigationIntent(input);
  if (navigation)
    return applyConversationIntent(
      append(s, { kind: "user", text: input, local: true }),
      navigation,
    );
  let intent: Parameters<typeof applyConversationIntent>[1] | undefined;
  if (["sprawdz co moze ci przyslugiwac", "rozpocznij wywiad"].includes(text))
    return showInterview(s, s.data.interview.mode !== "idle");
  else if (
    /^(?:dlaczego(?: mnie)?(?: o to)? pytasz|dlaczego o to pytasz|nie rozumiem(?: tego)? pytania|nie rozumiem|co to znaczy|dlaczego)$/.test(
      text,
    )
  )
    intent = "explainQuestion";
  else if (
    /^(?:wlasciwie )?(?:chodzi(?:lo)?(?: mi)? o mojego (?:meza|partnera)|chce sprawdzic swiadczenia mojego partnera)$/.test(
      text,
    )
  )
    intent = "switchSubject";
  else if (
    /^(?:nie znam odpowiedzi[, ]+)?sprawdzmy cos innego$/.test(text) ||
    text === "chce sprawdzic cos innego"
  )
    intent = "showMatches";
  else if (
    /^(?:jakie dokumenty mam zlozyc|jakie dokumenty sa potrzebne|pokaz dokumenty)$/.test(text)
  )
    intent = "documents";
  else if (
    /^(?:dlaczego wyszlo|skad (?:ta|taka) kwota|jaka podstawe przyjelas|wyjasnij (?:kwote|wynik))/.test(
      text,
    )
  )
    intent = "explainResult";
  if (intent)
    return applyConversationIntent(append(s, { kind: "user", text: input, local: true }), intent);
  if (text === "wroc do poprzedniego wyniku") {
    const previous = s.turns.findLast(
      (t) => t.kind === "assessment" && t.assessmentId && t.assessmentId !== s.activeAssessmentId,
    );
    if (previous?.kind !== "assessment")
      return s.cursor?.kind === "assessment"
        ? appendAssessment(s)
        : append(s, { kind: "note", text: "Nie ma wcześniejszej oceny w tej rozmowie." });
    const assessment = s.data.assessments.find((a) => a.id === previous.assessmentId);
    if (!assessment || assessment.kind !== "calculator") return s;
    return appendAssessment({
      ...s,
      activeAssessmentId: assessment.id,
      benefit: assessment.benefit,
      goal: assessment.goal,
      data: {
        ...s.data,
        contextRevision: s.data.contextRevision + 1,
        pendingOperation: undefined,
        navigation: { ...s.data.navigation, activeSubject: assessment.target.subject },
      },
    });
  }
  const known = findHelpAnswer(input);
  if (known)
    return append(s, { kind: "user", text: input, local: true }, { kind: "help", answer: known });
  // Only a whole, simple answer reaches the direct local writer.
  if (
    s.view === "interview" &&
    s.data.interview.active &&
    readInterviewAnswer(s.data.interview.active, input)
  )
    return interviewText(s, input);
  if (
    s.view === "interview" &&
    s.data.interview.active?.id === "subject" &&
    Object.values(personRoleLabels).some((label) => normalizeGuideText(label) === text)
  )
    return interviewText(s, input);
}
