import { confirmComparison } from "./comparison-session";
import type { PlanOptions } from "../../engine/parent-plan";
import type { AssessmentTarget } from "./family-session";
import {
  answerInterview,
  editInterview,
  interviewText,
  pauseWorkspaceInterview,
  procedureProjection,
  readProcedureAnswer,
  requestDestination,
  saveProcedureAnswer,
  selectScope,
  setScopeStage,
  showDiscovery,
  showInterview,
  showProcedure,
} from "./workspace-session";
import type { ScopeSelection } from "./workspace-session";
import type { QuestionRef, QuestionTarget } from "./interview";
import type { DiscoveryAction } from "../../data/discovery";
import type { DiscoveryItem } from "../../engine/discover-procedures";
import type { Field } from "../../types/profile";
import { cancelInterviewOperation } from "./interview-session";
import { personIdSchema } from "./family-session";
import { getCaseContext, getParentCase, setCaseGoal, setSessionDemoRate } from "./case-session";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { warsawToday } from "../../engine/dates";
import type { DemoRate } from "../../engine/parent-benefit";
import { labels } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey, ParentCase } from "../../engine/parent-case";
import { findHelpAnswer, unavailableHelpAnswer } from "../guide/helpAnswers";
import type { HelpAnswer } from "../guide/helpAnswers";
import { normalizeGuideText } from "../guide/textInput";
import { buildAssistantRequest } from "./case-assistant-context";

import type { DocumentData } from "./case-documents";
import { factValue, fields, readFact, readNarrativeFacts } from "./case-fields";
import { careComparisonLabel, readCareComparison, readCaseRequest } from "./case-message";
import {
  findFirstSteps,
  getFirstSteps,
  outOfScopeReply,
  pregnancyConcernReply,
  replyChoiceLabels,
  startingReply,
} from "./case-replies";
import {
  append,
  appendAssessment,
  appendCareComparison,
  askBenefit,
  continueWithAssessment,
  continueWithDocument,
  continueWithRequest,
  getBenefitTurn,
  newSession,
  saveFacts,
  saveQuestionAnswer,
  selectBenefit,
  toolMessages,
} from "./case-session";
import type {
  AssessmentTurn,
  AttachedDocument,
  BenefitChoice,
  CaseAnswer,
  CaseQuestion,
  CaseSession,
  CaseTurn,
} from "./case-session";
import { makeDemoPdf } from "./demo-document";
import { caseActionSchema } from "./parent-intent";
import type { CaseAction, CaseGoal, CaseReply, CaseTool, ReplyChoice } from "./parent-intent";

const expandedTools = ["formalities", "facts", "services", "rules"] as const;
export type ExpandedTool = (typeof expandedTools)[number];

const unavailableReply: CaseReply = {
  kind: "reply",
  text: "Nie udało mi się teraz odpowiedzieć. Możesz przejść do kalkulatora i uzupełnić dane krok po kroku.",
  choices: ["benefit"],
};
const unknownMessages: Partial<Record<FactKey, string>> = {
  birth: "Datę urodzenia możesz sprawdzić w akcie urodzenia dziecka.",
  dueDate: "Przewidywany termin porodu znajdziesz w karcie ciąży lub w zaświadczeniu od lekarza.",
  basis:
    "Ustaloną podstawę znajdziesz w dokumentach płacowych. Możesz też użyć stałej pensji z 12 pełnych miesięcy pracy na etacie, jeśli dotyczy Cię ten przypadek.",
  insured:
    "Stan ubezpieczenia jest nieustalony. Sprawdź poświadczenie ZUS, dane u płatnika albo konto eZUS na wskazany dzień.",
  payer:
    "Zapytaj pracodawcę lub płatnika składek, kto wypłaca zasiłek. Możesz też podać liczbę osób zgłoszonych do chorobowego na właściwy dzień.",
};

function unknownFactHint(key: FactKey) {
  return (
    unknownMessages[key] ?? "Możesz uzupełnić tę odpowiedź później lub na podstawie dokumentu."
  );
}

export function isExpanded(tool: CaseTool): tool is ExpandedTool {
  return expandedTools.some((item) => item === tool);
}

function recordAnswer(
  session: CaseSession,
  question: CaseQuestion,
  facts: CaseFacts,
  {
    text,
    correction = false,
    sources,
  }: { text?: string; correction?: boolean; sources?: ParentCase["sources"] } = {},
) {
  const message =
    text ??
    Object.entries(facts)
      .map(([key, value]) => {
        const field = key as FactKey;
        const answer = factValue(field, value);
        return field === question.key && !correction
          ? answer
          : fields[field].label + " · " + answer;
      })
      .join(" · ");
  const next = saveQuestionAnswer(session, question, facts, sources);
  const answer = next.answered.find((step) => !session.answered.includes(step));
  return appendAssessment(
    append(next, {
      kind: "user",
      text: correction ? "Poprawiam odpowiedź · " + message : message,
      local: true,
      answer,
    }),
    facts.from !== undefined || facts.requestedDays !== undefined,
  );
}

export function useParentWorkspace(active = true) {
  const [session, setSession] = useState(() => newSession());
  const sessionRef = useRef(session);
  const activeRef = useRef(active);
  const generation = useRef(0);
  const [expanded, setExpandedState] = useState<ExpandedTool | null>(null);
  const toolTrigger = useRef<HTMLElement>(null);
  const toolRoot = useRef<Element>(null);
  const [thinking, setThinking] = useState(false);
  const pendingRequest = useRef<AbortController>(null);
  const fileSelection = useRef(0);
  const previews = useRef(new Set<string>());
  useLayoutEffect(() => {
    activeRef.current = active;
    if (!active) {
      pendingRequest.current?.abort();
      pendingRequest.current = null;
      generation.current++;
      fileSelection.current++;
      const next = {
        ...sessionRef.current,
        data: cancelInterviewOperation(sessionRef.current.data),
      };
      sessionRef.current = next;
      setSession(next);
      setThinking(false);
    }
  }, [active]);
  const benefitTurn = getBenefitTurn(session);
  const pregnancyConcern = session.turns.at(-1)?.kind === "pregnancyConcern";
  const question =
    benefitTurn?.kind === "assessment" && !pregnancyConcern ? benefitTurn.question : undefined;

  useEffect(() => {
    const urls = previews.current;
    const selection = fileSelection;
    return () => {
      pendingRequest.current?.abort();
      selection.current++;
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  function setExpanded(tool: ExpandedTool | null) {
    if (
      tool &&
      document.activeElement instanceof HTMLElement &&
      !document.activeElement.closest('[role="dialog"]')
    ) {
      toolTrigger.current = document.activeElement;
      toolRoot.current = document.activeElement.closest("[data-chat]");
    }
    setExpandedState(tool);
  }
  function finalToolFocus() {
    if (!activeRef.current) return false;
    return toolTrigger.current?.isConnected
      ? toolTrigger.current
      : (toolRoot.current?.querySelector<HTMLTextAreaElement>(
          'textarea[aria-label="Wiadomość do Mili"]',
        ) ?? false);
  }

  function cancelRequest() {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    setThinking(false);
  }

  function update(apply: (previous: CaseSession) => CaseSession) {
    if (!activeRef.current) return;
    cancelRequest();
    generation.current++;
    const previous = sessionRef.current;
    let next = apply(previous.asOf ? previous : { ...previous, asOf: warsawToday() });
    if (
      next.data.contextRevision === previous.data.contextRevision &&
      (next.view !== previous.view ||
        next.goal !== previous.goal ||
        next.privacy !== previous.privacy ||
        next.activeAssessmentId !== previous.activeAssessmentId)
    )
      next = { ...next, data: cancelInterviewOperation(next.data) };
    sessionRef.current = next;
    setSession(next);
    return next;
  }

  function requestBenefit() {
    askWhichBenefit("Sprawdź świadczenie");
  }

  function askWhichBenefit(text: string) {
    update((previous) =>
      askBenefit(append(previous, { kind: "user", text, local: true }), "calculation"),
    );
  }

  function chooseReply(turn: CaseReply, choice: ReplyChoice) {
    if (pendingRequest.current || session.turns.at(-1) !== turn || !turn.choices.includes(choice))
      return;
    const text = replyChoiceLabels[choice];
    if (choice === "benefit") {
      askWhichBenefit(text);
      return;
    }
    update((previous) =>
      append(previous, { kind: "user", text }, { kind: "help", answer: getFirstSteps(choice, "") }),
    );
  }

  function compareCare(
    workPercent: Extract<CaseAction, { kind: "compareCare" }>["workPercent"] = null,
    text = careComparisonLabel,
  ) {
    update((previous) =>
      appendCareComparison(append(previous, { kind: "user", text, local: true }), workPercent),
    );
  }

  function begin(benefit: Benefit, choice?: BenefitChoice, text = labels[benefit]) {
    update((previous) => {
      if (choice && getBenefitTurn(previous) !== choice) return previous;
      return requestDestination(
        append(
          { ...previous, goal: choice?.goal ?? "calculation" },
          { kind: "user", text, local: true },
        ),
        { kind: "calculator", benefit },
      );
    });
  }

  function changeGoal(goal: CaseGoal) {
    update((previous) => {
      return appendAssessment(
        append(setCaseGoal(previous, goal), {
          kind: "user",
          text: goal === "application" ? "Zobacz dokumenty" : "Wróć do wyniku",
          local: true,
        }),
      );
    });
  }

  function save(facts: CaseFacts, sources?: ParentCase["sources"]) {
    update((previous) => {
      const next = saveFacts(previous, facts, sources);
      return getBenefitTurn(previous)?.kind === "assessment" ? appendAssessment(next) : next;
    });
  }

  function resolveProposal(turn: Extract<CaseTurn, { kind: "propose" }>, accepted: boolean) {
    update((previous) => {
      if (previous.turns.at(-1) !== turn) return previous;
      const next = setCaseGoal(selectBenefit(previous, turn.benefit), turn.goal);
      return appendAssessment(
        append(accepted ? saveFacts(next, turn.facts) : next, {
          kind: "user",
          text: accepted ? "Potwierdzam dane" : "Podam dane po kolei",
          local: true,
        }),
      );
    });
  }

  function confirm(
    turn: AssessmentTurn,
    facts: CaseFacts,
    options?: { text?: string; sources?: ParentCase["sources"] },
  ) {
    update((previous) => {
      if (!turn.question || getBenefitTurn(previous) !== turn) return previous;
      return recordAnswer(previous, turn.question, facts, options);
    });
  }

  function correct(answer: CaseAnswer, facts: CaseFacts) {
    update((previous) => {
      if (
        !previous.answered.includes(answer) ||
        getParentCase(previous).facts[answer.field] === facts[answer.field]
      )
        return previous;
      return recordAnswer(previous, answer.question, facts, { correction: true });
    });
  }

  function defer(turn: AssessmentTurn, text = "Nie wiem") {
    update((previous) => {
      if (!turn.question || getBenefitTurn(previous) !== turn) return previous;
      const deferred = {
        ...turn,
        deferred: true as const,
        text: unknownFactHint(turn.question.key),
      };
      return append(
        { ...previous, cursor: deferred },
        { kind: "user", text, local: true },
        deferred,
      );
    });
  }

  function resume() {
    update(appendAssessment);
  }

  function open(tool: CaseTool, text?: string) {
    update((previous) => {
      const next = text ? append(previous, { kind: "user", text, local: true }) : previous;
      return append(next, { kind: "tool", tool, text: toolMessages[tool] });
    });
    if (isExpanded(tool)) setExpanded(tool);
  }

  function load(
    benefit: Benefit,
    facts: CaseFacts,
    label: string,
    origin = "Fikcyjny przykład Mili",
  ) {
    setExpanded(null);
    const sources = Object.fromEntries(Object.keys(facts).map((key) => [key, { label: origin }]));
    update((previous) => {
      const fresh = newSession();
      const next = saveFacts(
        selectBenefit(
          {
            ...fresh,
            asOf: previous.asOf,
            privacy: previous.privacy,
            turns: previous.turns,
            data: {
              ...fresh.data,
              persons: [
                {
                  id: personIdSchema.parse("demo:person"),
                  roles: [
                    benefit === "paternity" ||
                    benefit === "adoptivePaternity" ||
                    benefit === "maternityTransfer"
                      ? "otherParent"
                      : "birthing",
                  ],
                  titles: [],
                  procedureFacts: {},
                },
              ],
              navigation: {
                view: "start",
                activeSubject: { kind: "person", personId: personIdSchema.parse("demo:person") },
              },
            },
            benefit,
            goal: "calculation",
          },
          benefit,
        ),
        facts,
        sources,
      );
      return appendAssessment(append(next, { kind: "user", text: label, local: true }));
    });
  }

  function addDocument(file: File, mode: AttachedDocument["mode"]) {
    const preview = URL.createObjectURL(file);
    previews.current.add(preview);
    const document: AttachedDocument = {
      kind: "document",
      file,
      preview,
      mode,
      documentId: crypto.randomUUID(),
    };
    update((previous) => append(previous, document));
  }

  async function attachDocument(file: File) {
    update((previous) => ({
      ...previous,
      privacy: "localDocuments",
      data: cancelInterviewOperation(previous.data),
    }));
    const selection = ++fileSelection.current;
    const context = generation.current;
    const header = await file
      .slice(0, 5)
      .text()
      .catch(() => "");
    if (!activeRef.current || selection !== fileSelection.current || context !== generation.current)
      return;
    if (header !== "%PDF-") {
      update((previous) =>
        append(previous, {
          kind: "note",
          text: "Wybierz plik w formacie PDF, który można otworzyć.",
        }),
      );
      return;
    }
    const pdf =
      file.type === "application/pdf"
        ? file
        : new File([file], file.name, { type: "application/pdf" });
    addDocument(pdf, "local");
  }

  function attachDemoDocument() {
    fileSelection.current++;
    addDocument(
      new File([makeDemoPdf()], "ojcowski-demo.pdf", { type: "application/pdf" }),
      "demo",
    );
  }

  function finishDocument(document: AttachedDocument, data?: DocumentData) {
    update((previous) => continueWithDocument(previous, document, data));
  }

  function setDemoRate(demoRate?: DemoRate) {
    update((previous) => {
      const next = setSessionDemoRate(previous, demoRate);
      return getBenefitTurn(previous)?.kind === "assessment" ? appendAssessment(next) : next;
    });
  }

  function applyAction(action: Exclude<CaseAction, { kind: "help" }>) {
    if (action.kind === "open") {
      open(action.tool);
      return;
    }
    update((previous) => {
      if (action.kind === "reply") return append(previous, action);
      if (action.kind === "outOfScope") return append(previous, outOfScopeReply);
      if (action.kind === "urgentPregnancyCare")
        return append(previous, pregnancyConcernReply(action.text));
      if (action.kind === "compareCare") return appendCareComparison(previous, action.workPercent);
      if (action.kind === "firstSteps") {
        return append(previous, {
          kind: "help",
          answer: getFirstSteps(action.timing, action.intro),
        });
      }
      if (
        action.kind === "assess" &&
        action.benefit &&
        (!previous.activeAssessmentId || action.benefit !== previous.benefit)
      )
        return requestDestination(previous, { kind: "calculator", benefit: action.benefit });
      if (action.kind === "chooseBenefit") return askBenefit(previous, action.goal);
      if (action.kind === "unknownFact") {
        const current = getBenefitTurn(previous);
        return current?.kind === "assessment" && current.question
          ? append(previous, {
              ...current,
              deferred: true,
              text: unknownFactHint(current.question.key),
            })
          : append(previous, startingReply);
      }
      return continueWithAssessment(previous, action);
    });
  }

  async function send(text: string) {
    if (!activeRef.current || pendingRequest.current) return;
    const command = normalizeGuideText(text).replace(/[.!?]+$/, "");
    if (["pokaz mozliwe sprawy", "wroc do dopasowanych spraw"].includes(command)) {
      update(showDiscovery);
      return;
    }
    if (["sprawdz co moze ci przyslugiwac", "rozpocznij wywiad"].includes(command)) {
      update((s) => showInterview(s, s.data.interview.mode !== "idle"));
      return;
    }
    if (session.view === "scope") {
      update((s) =>
        append(s, {
          kind: "note",
          text: "Wybierz osobę i zakres sprawy dostępnymi kontrolkami. Nie przypisuję danych na podstawie niejednoznacznego opisu.",
        }),
      );
      return;
    }
    if (session.view === "interview") {
      update((s) => interviewText(s, text));
      return;
    }
    if (session.view === "procedure") {
      const p = procedureProjection(session);
      if (p?.missing) {
        const field = session.procedureQuestion ?? p.missing;
        const value = readProcedureAnswer(field, text);
        const state =
          normalizeGuideText(text) === "nie wiem"
            ? "unknown"
            : normalizeGuideText(text) === "pomin"
              ? "deferred"
              : undefined;
        if (value !== undefined || state)
          update((s) => saveProcedureAnswer(s, field, value, state));
        else
          update((s) =>
            append(
              s,
              { kind: "user", text, local: true },
              {
                kind: "note",
                text: "Wybierz jedną z opcji lub podaj prostą odpowiedź na aktywne pytanie.",
              },
            ),
          );
        return;
      }
    }
    const normalized = normalizeGuideText(text).replace(/[.!?]+$/, "");
    const comparison = readCareComparison(text);
    if (comparison) {
      compareCare(comparison.workPercent, text);
      return;
    }
    const firstSteps = findFirstSteps(normalized);
    if (firstSteps) {
      update((previous) =>
        append(previous, { kind: "user", text }, { kind: "help", answer: firstSteps }),
      );
      return;
    }
    if (["dodaj pdf", "dolacz pdf", "otworz pdf"].includes(normalized)) {
      update((previous) =>
        append(
          previous,
          { kind: "user", text, local: true },
          { kind: "tool", tool: "documents", text: toolMessages.documents },
        ),
      );
      return;
    }
    if (
      ["sprawdz swiadczenie", "chce sprawdzic swiadczenie", "zmien swiadczenie"].includes(
        normalized,
      )
    ) {
      askWhichBenefit(text);
      return;
    }
    if (benefitTurn?.kind === "assessment" && question) {
      if (["dlaczego o to pytasz", "dlaczego"].includes(normalized)) {
        update((s) =>
          append(s, {
            kind: "note",
            text:
              question.hint ??
              "Ta informacja jest potrzebna istniejącemu kalkulatorowi do sprawdzenia warunków, okresu lub kwoty. Możesz odłożyć odpowiedź.",
          }),
        );
        return;
      }
      const upcoming =
        question.key === "from" && getParentCase(session).facts.requestedDays !== undefined
          ? session.asOf
          : undefined;
      const facts = readFact(question.key, text, upcoming);
      if (facts && (!facts.birth || facts.birth <= session.asOf)) {
        confirm(benefitTurn, facts, { text });
        return;
      }
      if (["nie wiem", "pomin"].includes(normalized) && !benefitTurn.deferred) {
        defer(benefitTurn, text);
        return;
      }
    }
    const localContext = {
      asOf: session.asOf || warsawToday(),
      benefit: benefitTurn?.kind === "chooseBenefit" ? null : session.benefit,
      pending: question?.key,
    };
    const local = readCaseRequest(text, localContext);
    if (local) {
      if (
        !session.activeAssessmentId ||
        local.benefit !== session.benefit ||
        session.view !== "calculator"
      ) {
        begin(local.benefit, undefined, text);
        return;
      }
      update((previous) => continueWithRequest(previous, local, text));
      return;
    }
    const narrative = readNarrativeFacts(text);
    const statements = text.split(/(?<=[.!?])\s+/);
    if (statements.length > 1 && Object.keys(narrative).length) {
      const request = statements.map((part) => readCaseRequest(part, localContext)).find(Boolean);
      if (request) {
        update((previous) =>
          continueWithAssessment(append(previous, { kind: "user", text, local: true }), {
            kind: "assess",
            benefit: request.benefit,
            goal: request.goal ?? previous.goal,
            facts: { ...narrative, ...request.facts },
          }),
        );
        return;
      }
    }
    if (session.privacy === "localDocuments") {
      const known = findHelpAnswer(text);
      update((previous) =>
        append(
          previous,
          { kind: "user", text, local: true },
          known
            ? { kind: "help", answer: known }
            : {
                kind: "note",
                text: "Po dodaniu własnego PDF-u rozmowa działa lokalnie. Korzystaj z pytań, kalkulatorów i wyjaśnień. Swobodnego tekstu ani historii sprawy nie wysyłam do AI.",
              },
        ),
      );
      return;
    }
    const controller = new AbortController();
    pendingRequest.current = controller;
    setThinking(true);
    const request = buildAssistantRequest(session, text);
    const checkedAssessment =
      benefitTurn?.kind === "assessment" &&
      (benefitTurn.result.status === "eligible" || benefitTurn.result.status === "ineligible");
    const token = generation.current;
    const contextRevision = session.data.contextRevision;
    const withUser = append(sessionRef.current, { kind: "user", text });
    sessionRef.current = withUser;
    setSession(withUser);
    const isCurrent = () =>
      activeRef.current &&
      pendingRequest.current === controller &&
      generation.current === token &&
      sessionRef.current.data.contextRevision === contextRevision &&
      sessionRef.current.privacy === "standard";

    async function askHelp(question: string) {
      const known = findHelpAnswer(question);
      if (known) return known;
      if (checkedAssessment) return undefined;
      const last = session.turns.findLast((turn) => turn.kind === "help");
      const response = await fetch("/api/guide-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, previousSourceIds: last?.answer.sourceIds }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      }).catch(() => null);
      const help: HelpAnswer = response?.ok
        ? await response.json().catch(() => unavailableHelpAnswer)
        : unavailableHelpAnswer;
      return help;
    }

    const response = await fetch("/api/parent-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(21_000)]),
    }).catch(() => null);
    const action = caseActionSchema.safeParse(
      response?.ok ? await response.json().catch(() => null) : null,
    );
    if (controller.signal.aborted || !isCurrent()) return;
    if (action.success && action.data.kind === "help") {
      const help = await askHelp(action.data.question);
      if (controller.signal.aborted || !isCurrent()) return;
      update((previous) =>
        help ? append(previous, { kind: "help", answer: help }) : appendAssessment(previous),
      );
      return;
    }
    if (action.success && action.data.kind !== "help") {
      if (checkedAssessment && action.data.kind === "reply")
        update((previous) => appendAssessment(previous));
      else applyAction(action.data);
      return;
    }
    const known = findHelpAnswer(text);
    update((previous) =>
      append(previous, known ? { kind: "help", answer: known } : unavailableReply),
    );
  }

  return {
    session: { ...session, ...getCaseContext(session) },
    active,
    startInterview: () => update((s) => showInterview(s, s.data.interview.mode !== "idle")),
    pauseInterview: () => update(pauseWorkspaceInterview),
    resumeInterview: () => update((s) => showInterview(s, true)),
    showDiscovery: () => update(showDiscovery),
    answerInterview: (
      ref: QuestionRef,
      value: unknown,
      text: string,
      state?: "unknown" | "deferred",
    ) => update((s) => answerInterview(s, ref, value, text, state)),
    explainInterview: () => {
      const ref = session.data.interview.active;
      if (ref) update((s) => interviewText(s, "Dlaczego o to pytasz?"));
    },
    editInterview: (ref: QuestionTarget) => update((s) => editInterview(s, ref)),
    destination: (action: DiscoveryAction, item?: DiscoveryItem) =>
      update((s) => requestDestination(s, action, item)),
    prepareDocument: (document: AttachedDocument, benefit: Benefit) =>
      update((s) =>
        requestDestination({ ...s, returnDocument: document }, { kind: "calculator", benefit }),
      ),
    selectScope: (selection: ScopeSelection) =>
      update((s) => {
        const selected = selectScope(s, selection);
        const document = s.returnDocument;
        if (!document || selected.view !== "calculator" || !selected.activeAssessmentId)
          return selected;
        return append(
          {
            ...selected,
            returnDocument: undefined,
            documentTargets: {
              ...selected.documentTargets,
              [document.documentId || document.preview]: selected.activeAssessmentId,
            },
            turns: s.turns.filter((t) => t !== document),
            cursor: undefined,
          },
          document,
        );
      }),
    setScopeStage: (stage: string) => update((s) => setScopeStage(s, stage)),
    editProcedure: (field: Field) => update((s) => showProcedure(s, field)),
    saveProcedure: (field: Field, value: unknown, state?: "unknown" | "deferred") =>
      update((s) => saveProcedureAnswer(s, field, value, state)),
    confirmComparison: (
      facts: CaseFacts,
      options: PlanOptions,
      first: AssessmentTarget,
      second: AssessmentTarget,
      baseRevision: number,
    ) => {
      if (sessionRef.current.data.contextRevision !== baseRevision) return undefined;
      const count = sessionRef.current.data.assessments.length;
      const next = update((s) => confirmComparison(s, facts, options, first, second));
      return next && next.data.assessments.length > count ? next.data.contextRevision : undefined;
    },
    toggleTask: (id: string) =>
      update((s) => ({
        ...s,
        tasks: s.tasks.includes(id) ? s.tasks.filter((t) => t !== id) : [...s.tasks, id],
      })),
    benefitTurn,
    expanded,
    setExpanded,
    finalToolFocus,
    thinking,
    begin,
    requestBenefit,
    chooseReply,
    compareCare,
    changeGoal,
    save,
    resolveProposal,
    confirm,
    correct,
    defer,
    resume,
    open,
    load,
    attachDocument,
    attachDemoDocument,
    finishDocument,
    send,
    setDemoRate,
  };
}

export type ParentWorkspace = ReturnType<typeof useParentWorkspace>;
