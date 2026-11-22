import { calculatorTools, discoveryDefinitions, procedureIdSchema } from "../../data/discovery";
import type { DiscoveryAction } from "../../data/discovery";
import { procedures } from "../../data/procedures";
import { questions } from "../../data/questions";
import { discoverProcedures } from "../../engine/discover-procedures";
import type { DiscoveryItem } from "../../engine/discover-procedures";
import { evaluateProcedure } from "../../engine/evaluateProcedure";
import type { Question } from "../../types/catalog";
import type { Field } from "../../types/profile";
import { normalizeGuideText } from "../guide/textInput";
import { append, appendAssessment, selectBenefit, setCaseGoal } from "./case-session";
import type { CaseSession } from "./case-session";
import { assessmentIdSchema, childIdSchema, personIdSchema } from "./family-session";
import type { AssessmentTarget, PersonId, PersonRole, TitleId } from "./family-session";
import { formatDay } from "../../engine/parent-case";
import { readCaseDate } from "./case-fields";
import { interviewQuestionText, interviewQuestions, readInterviewAnswer } from "./interview";
import type { QuestionRef, QuestionTarget } from "./interview";
import { toProcedureProfile } from "./interview-profile";
import {
  answerInterviewQuestion,
  applyConfirmedFacts,
  changeActivePerson,
  deferInterviewQuestion,
  finishInterview,
  markInterviewAnswerUnknown,
  pauseInterview,
  resumeInterview,
  reviseInterviewAnswer,
  startInterview,
} from "./interview-session";
import { refreshSnapshots } from "./result-snapshots";

export const personRoleLabels: Record<PersonRole, string> = {
  birthing: "Osoba rodząca",
  otherParent: "Drugi rodzic",
  guardian: "Opiekun",
};
export function personLabel(s: CaseSession, id?: PersonId) {
  const p = s.data.persons.find((p) => p.id === id);
  return p
    ? `${p.roles.map((r) => personRoleLabels[r]).join(", ")} (${s.data.persons.indexOf(p) + 1})`
    : "Rodzina";
}
export function showDiscovery(s: CaseSession): CaseSession {
  const data = refreshSnapshots(finishInterview(s.data));
  return append(
    { ...s, data, view: "discovery", cursor: undefined, pendingDestination: undefined },
    {
      kind: "discovery",
      text: "Oto sprawy do sprawdzenia na podstawie potwierdzonych informacji. Wstępne dopasowanie nie potwierdza prawa do świadczenia.",
    },
  );
}
export function showInterview(s: CaseSession, resume = false): CaseSession {
  const data = resume ? resumeInterview(s.data) : startInterview(s.data);
  if (!data.interview.active && data.interview.mode === "finished")
    return showDiscovery({ ...s, data });
  return append(
    { ...s, data, view: "interview", cursor: undefined },
    {
      kind: "interview",
      question: data.interview.active,
      text: data.interview.active
        ? interviewQuestionText(data.interview.active)
        : "Wywiad jest wstrzymany. Możesz do niego wrócić.",
    },
  );
}
export function pauseWorkspaceInterview(s: CaseSession): CaseSession {
  return append(
    { ...s, data: pauseInterview(s.data), view: "interview" },
    { kind: "interview", text: "Wywiad jest wstrzymany. Odpowiedzi pozostają w tej rozmowie." },
  );
}
export function editInterview(s: CaseSession, question: QuestionTarget): CaseSession {
  let data = s.data;
  if (
    (question.id === "employment" || question.id === "need") &&
    data.navigation.activeSubject?.kind === "person" &&
    data.navigation.activeSubject.personId !== question.personId
  )
    data = changeActivePerson(
      data,
      question.personId,
      question.id === "employment" ? question.titleId : undefined,
    ).session;
  if (question.id === "subject" && !data.interview.visited.some((ref) => ref.id === "subject")) {
    data = resumeInterview(data);
    data = {
      ...data,
      interview: {
        ...data.interview,
        active: { ...question, promptRevision: data.contextRevision },
      },
    };
    return showInterview({ ...s, data });
  }
  const revised = reviseInterviewAnswer(data, question);
  if (!revised.ok) return s;
  return showInterview({ ...s, data: revised.session });
}
export function revisableInterviewAnswers(s: CaseSession) {
  return s.data.interview.visited.filter((question) => editInterview(s, question) !== s);
}
export function answerInterview(
  s: CaseSession,
  ref: QuestionRef,
  value: unknown,
  text: string,
  state?: "unknown" | "deferred",
  parser = false,
): CaseSession {
  const saved =
    state === "unknown"
      ? markInterviewAnswerUnknown(s.data, ref)
      : state === "deferred"
        ? deferInterviewQuestion(s.data, ref)
        : answerInterviewQuestion(s.data, ref, value, {
            source: { kind: "answer", via: parser ? "parser" : "button" },
          });
  if (!saved.ok)
    return append(s, {
      kind: "note",
      text: "Nie zapisano odpowiedzi. Sprawdź zakres i wybierz jedną z dostępnych opcji.",
    });
  const next = append(
    { ...s, data: refreshSnapshots(saved.session) },
    { kind: "user", text, local: true, interviewAnswer: ref },
  );
  if (saved.session.navigation.view === "discovery" || saved.session.interview.mode === "finished")
    return showDiscovery(next);
  return showInterview(next);
}
export function interviewText(s: CaseSession, text: string): CaseSession {
  const ref = s.data.interview.active;
  if (!ref)
    return append(s, { kind: "note", text: "Wznów wywiad albo przejdź do możliwych spraw." });
  const normalized = normalizeGuideText(text).replace(/[?!]+$/, "");
  if (["dlaczego", "dlaczego o to pytasz"].includes(normalized))
    return append(s, { kind: "note", text: interviewQuestions[ref.id].why });
  if (ref.id === "subject") {
    const role = (["birthing", "otherParent", "guardian"] as const).find(
      (r) => normalizeGuideText(personRoleLabels[r]) === normalized,
    );
    if (role) {
      const matches = s.data.persons.filter((p) => p.roles.includes(role));
      if (matches.length <= 1)
        return answerInterview(
          s,
          ref,
          {
            speaker: s.data.navigation.speaker?.kind === "helper" ? "helper" : "self",
            subject: {
              kind: "person",
              personId:
                matches[0]?.id ??
                personIdSchema.parse(`${s.data.id}:person:${s.data.persons.length + 1}`),
              role,
            },
          },
          text,
          undefined,
          true,
        );
    }
  }
  const parsed = readInterviewAnswer(ref, text);
  if (!parsed)
    return append(
      s,
      { kind: "user", text, local: true },
      {
        kind: "note",
        text: "Nie rozpoznałam jednej jednoznacznej odpowiedzi. Wybierz opcję przy pytaniu, wpisz prostą odpowiedź albo pomiń pytanie.",
      },
    );
  return parsed.kind === "answer"
    ? answerInterview(s, ref, parsed.value, text, undefined, true)
    : answerInterview(s, ref, undefined, text, parsed.kind);
}

export function requestDestination(
  s: CaseSession,
  action: DiscoveryAction,
  item?: DiscoveryItem,
): CaseSession {
  if (
    item &&
    (item.action.contextRevision !== s.data.contextRevision ||
      ![item.action.destination, ...item.action.alternatives, item.action.fallback].some(
        (a) => JSON.stringify(a) === JSON.stringify(action),
      ))
  )
    return s;
  if (action.kind === "officialGuidance") return s;
  return append(
    {
      ...s,
      view: "scope",
      data: pauseInterview(s.data),
      cursor: undefined,
      pendingDestination: action,
      scopeTarget:
        item?.target ?? s.data.assessments.find((a) => a.id === s.activeAssessmentId)?.target,
    },
    {
      kind: "scope",
      text: "Ustalmy osobę i zakres tej sprawy. Dane indywidualne pozostają przy wybranej osobie i tytule.",
    },
  );
}
export type ScopeSelection = {
  personId?: PersonId;
  role?: PersonRole;
  titleId?: TitleId;
  newTitle?: boolean;
  helper: boolean;
  father: boolean;
  relatedPersonId?: PersonId;
};
export function selectScope(s: CaseSession, selection: ScopeSelection): CaseSession {
  const action = s.pendingDestination;
  if (!action || action.kind === "officialGuidance") return s;
  const role = selection.role;
  const personId =
    selection.personId ?? personIdSchema.parse(`${s.data.id}:person:${s.data.persons.length + 1}`);
  const existing = s.data.persons.find((p) => p.id === personId);
  if (!existing && !role) return s;
  if (
    selection.titleId &&
    !existing?.titles.some((t) => t.id === selection.titleId) &&
    !selection.newTitle
  )
    return s;
  if (
    selection.newTitle &&
    (!selection.titleId ||
      s.data.persons.some((p) => p.titles.some((t) => t.id === selection.titleId)))
  )
    return s;
  if (
    selection.relatedPersonId &&
    (selection.relatedPersonId === personId ||
      !s.data.persons.some((p) => p.id === selection.relatedPersonId))
  )
    return s;
  const roles = existing?.roles ?? (role ? [role] : []);
  const benefit = action.kind === "calculator" ? action.benefit : undefined;
  const definitionForScope =
    action.kind === "procedureQuestions" || action.kind === "formalities"
      ? discoveryDefinitions[action.procedureId]
      : undefined;
  if (
    (definitionForScope?.subjectPolicy === "birthing" && !roles.includes("birthing")) ||
    (definitionForScope?.subjectPolicy === "otherParent" && !roles.includes("otherParent"))
  )
    return append(s, { kind: "note", text: "Wybierz osobę o właściwej roli dla tej formalności." });
  if (definitionForScope?.required.includes("fatherRole") && !selection.father)
    return append(s, {
      kind: "note",
      text: "Najpierw potwierdź, że ta sprawa dotyczy ojca dziecka.",
    });
  if (
    benefit &&
    [
      "maternity",
      "sickness",
      "rehabilitation",
      "pregnancyAfterEmployment",
      "lossMaternity",
    ].includes(benefit) &&
    !roles.includes("birthing")
  )
    return append(s, {
      kind: "note",
      text: "Ta sprawa wymaga wskazania osoby rodzącej. Wybierz właściwą osobę.",
    });
  if (
    benefit &&
    ["paternity", "adoptivePaternity", "maternityTransfer"].includes(benefit) &&
    (!roles.includes("otherParent") || !selection.father)
  )
    return append(s, {
      kind: "note",
      text: "Wybierz właściwego drugiego rodzica i świadomie potwierdź ojcostwo dla tej sprawy.",
    });
  const revision = s.data.contextRevision + 1;
  const basePerson = existing ?? { id: personId, roles, titles: [], procedureFacts: {} };
  const person =
    selection.newTitle && selection.titleId
      ? {
          ...basePerson,
          titles: [...basePerson.titles, { id: selection.titleId, sicknessCoverage: [] }],
        }
      : basePerson;
  const father = selection.father
    ? {
        state: "confirmed" as const,
        value: true,
        revision,
        source: { kind: "answer" as const, via: "confirmation" as const },
        validTime: { kind: "undated" as const },
        basis: "observed" as const,
      }
    : person.father;
  const subject = {
    kind: "person" as const,
    personId,
    titleId: selection.titleId ?? (person.titles.length === 1 ? person.titles[0].id : undefined),
  };
  let data = {
    ...s.data,
    contextRevision: revision,
    pendingOperation: undefined,
    persons: existing
      ? s.data.persons.map((p) => (p.id === personId ? { ...person, father } : p))
      : [...s.data.persons, { ...person, father }],
    navigation: {
      ...s.data.navigation,
      activeSubject: subject,
      speaker: selection.helper ? { kind: "helper" as const } : { kind: "self" as const, personId },
    },
  };
  let next = {
    ...s,
    data,
    scopeTarget: {
      eventId: data.family.event.id,
      subject,
      childIds: data.family.children.map((c) => c.id),
      relatedPersonId: selection.relatedPersonId,
    },
  };
  if (benefit) {
    const routes: readonly string[] = calculatorTools[benefit].routes;
    const route = discoverProcedures(data).route;
    if (!routes.includes(route))
      return append(next, {
        kind: "scope",
        text: "Potwierdź sytuację rodziny, aby otworzyć właściwy kalkulator. Nie zmieniaj jej, jeśli wybrana sprawa nie pasuje.",
      });
    return appendAssessment(
      setCaseGoal(selectBenefit({ ...next, pendingDestination: undefined }, benefit), s.goal),
    );
  }
  if (action.kind !== "procedureQuestions" && action.kind !== "formalities") return next;
  const procedureId = action.procedureId;
  const definition = discoveryDefinitions[procedureId];
  if (definition.required.includes("relatedPerson") && !selection.relatedPersonId)
    return append(next, {
      kind: "note",
      text: "Ta sprawa wymaga wskazania drugiej osoby. Dodaj ją w wywiadzie, a następnie wybierz obie osoby.",
    });
  if (!data.family.children.length) {
    const child = { id: childIdSchema.parse(`${data.family.event.id}:child:1`), facts: {} };
    data = { ...data, family: { ...data.family, children: [child] } };
  }
  const target: AssessmentTarget = {
    eventId: data.family.event.id,
    subject: definition.subjectPolicy === "family" ? { kind: "family" } : subject,
    applicantId: definition.subjectPolicy === "family" ? personId : undefined,
    applicantTitleId: definition.subjectPolicy === "family" ? subject.titleId : undefined,
    childIds: s.scopeTarget?.childIds.length
      ? s.scopeTarget.childIds
      : data.family.children.map((c) => c.id),
    relatedPersonId: selection.relatedPersonId,
  };
  const previous = data.assessments.find(
    (a) =>
      a.kind === "procedure" &&
      a.procedureId === procedureId &&
      JSON.stringify(a.target) === JSON.stringify(target),
  );
  const id =
    previous?.id ??
    assessmentIdSchema.parse(`${data.id}:assessment:${data.assessments.length + 1}`);
  next = {
    ...next,
    data: {
      ...data,
      assessments: previous
        ? data.assessments.map((a) => (a.id === id ? { ...a, state: "draft" as const } : a))
        : [
            ...data.assessments,
            {
              kind: "procedure",
              id,
              target,
              asOf: data.asOf,
              inputRevision: revision,
              goal: "application",
              state: "draft",
              procedureId,
              details: {},
            },
          ],
    },
    activeAssessmentId: id,
  };
  return showProcedure({
    ...next,
    pendingDestination: undefined,
    view: "procedure",
    procedureInstructions: action.kind === "formalities",
  });
}

export function setScopeStage(s: CaseSession, stage: string): CaseSession {
  let data = resumeInterview(s.data);
  // Scope selection is an explicit correction, using the stage-1 write boundary.
  const question = {
    id: "stage" as const,
    eventId: data.family.event.id,
    promptRevision: data.contextRevision,
  };
  data = { ...data, interview: { ...data.interview, active: question } };
  const written = answerInterviewQuestion(data, question, stage);
  if (!written.ok) return s;
  return append(
    { ...s, data: pauseInterview(refreshSnapshots(written.session)), view: "scope" },
    { kind: "scope", text: "Sytuacja zapisana. Wybierz osobę i potwierdź zakres sprawy." },
  );
}
export function procedureProjection(s: CaseSession) {
  const a = s.data.assessments.find((a) => a.id === s.activeAssessmentId);
  if (!a || a.kind !== "procedure") return;
  const id = procedureIdSchema.parse(a.procedureId);
  const projection = toProcedureProfile(s.data, id, a.target, a.asOf);
  const procedure = procedures.find((p) => p.id === id);
  if (!procedure) return;
  const result = evaluateProcedure(projection.value, procedure, a.asOf);
  const fields = [
    ...new Set([
      ...result.missingFields,
      ...result.deadlines.flatMap((d) => (d.missingField ? [d.missingField] : [])),
    ]),
  ];
  const missing = fields.find(
    (f) =>
      !a.deferredFields?.includes(f) &&
      !projection.omitted.some(
        (o) => o.field === f && (o.reason === "unknown" || o.reason === "deferred"),
      ),
  );
  return { assessment: a, projection, result, missing };
}
export function showProcedure(s: CaseSession, editing?: Field): CaseSession {
  const p = procedureProjection(s);
  if (!p) return s;
  const a = p.assessment;
  const question = editing ?? p.missing;
  const data = {
    ...s.data,
    assessments: s.data.assessments.map((item) =>
      item.id === a.id
        ? {
            ...a,
            result: {
              assessmentId: a.id,
              input: structuredClone(p.projection.value),
              result: structuredClone(p.result),
              dependencies: [],
              projectionDependencies: p.projection.dependencies,
              asOf: a.asOf,
              assessedAt: new Date().toISOString(),
              engineVersion: p.result.audit.rulesetVersion,
              state: "current" as const,
              explanation: p.result.procedure.summary,
            },
          }
        : item,
    ),
  };
  return append(
    { ...s, data, view: "procedure", cursor: undefined, procedureQuestion: question },
    {
      kind: "procedure",
      text: question
        ? questions[question].label
        : "Sprawdź instrukcję, dokumenty i źródła tej sprawy.",
      assessmentId: a.id,
    },
  );
}
export function saveProcedureAnswer(
  s: CaseSession,
  field: Field,
  value: unknown,
  state?: "unknown" | "deferred",
): CaseSession {
  if (!s.activeAssessmentId) return s;
  const question: Question = questions[field];
  const saved = applyConfirmedFacts(s.data, {
    kind: "procedureFact",
    baseRevision: s.data.contextRevision,
    assessmentId: s.activeAssessmentId,
    field,
    value,
    state,
  });
  if (!saved.ok)
    return append(s, {
      kind: "note",
      text: "Potrzebny jest właściwy podmiot lub tytuł. Wróć do dopasowania i wybierz zakres sprawy.",
    });
  return showProcedure(
    append(
      { ...s, data: refreshSnapshots(saved.session) },
      {
        kind: "user",
        text:
          state === "unknown"
            ? "Nie wiem"
            : state === "deferred"
              ? "Pomiń"
              : (question.options?.find((o) => o.value === value)?.label ??
                (question.input === "date" && typeof value === "string"
                  ? formatDay(value)
                  : Array.isArray(value)
                    ? "Potwierdzam okresy hospitalizacji"
                    : String(value))),
        local: true,
      },
    ),
  );
}
export function readProcedureAnswer(field: Field, text: string): unknown {
  const q = questions[field];
  const normalized = normalizeGuideText(text);
  if (q.input === "choice")
    return q.options?.find(
      (o) => normalizeGuideText(o.label) === normalized || String(o.value) === normalized,
    )?.value;
  if (q.input === "date") return readCaseDate(text);
  if (q.input === "number" && /^\d+(?:[.,]\d+)?$/.test(text.trim()))
    return Number(text.replace(",", "."));
}
