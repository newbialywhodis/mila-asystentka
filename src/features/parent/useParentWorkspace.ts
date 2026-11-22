import { useEffect, useRef, useState } from "react";
import { warsawToday } from "../../engine/dates";
import type { DemoRate } from "../../engine/parent-benefit";
import { emptyParentCase, labels } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey, ParentCase } from "../../engine/parent-case";
import { findHelpAnswer, findHelpFollowUp, unavailableHelpAnswer } from "../guide/helpAnswers";
import type { HelpAnswer } from "../guide/helpAnswers";
import { normalizeGuideText } from "../guide/textInput";
import { buildAssistantRequest } from "./case-assistant-context";
import { pdfUploadLimit } from "./case-documents";
import type { DocumentData } from "./case-documents";
import { factValue, fields, readFact, readNarrativeFacts } from "./case-fields";
import { careComparisonLabel, readCareComparison, readCaseRequest } from "./case-message";
import {
  findFirstSteps,
  getFirstSteps,
  outOfScopeReply,
  pregnancyConcernReply,
  replyChoiceLabels,
} from "./case-replies";
import {
  append,
  appendAssessment,
  appendCareComparison,
  appendMissingFactReply,
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

export function useParentWorkspace(uploadAllowed: boolean) {
  const [session, setSession] = useState(newSession);
  const [expanded, setExpanded] = useState<ExpandedTool | null>(null);
  const [thinking, setThinking] = useState(false);
  const pendingRequest = useRef<AbortController>(null);
  const fileSelection = useRef(0);
  const previews = useRef(new Set<string>());
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

  function cancelRequest() {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    setThinking(false);
  }

  function update(apply: (previous: CaseSession) => CaseSession) {
    cancelRequest();
    const asOf = warsawToday();
    setSession((previous) => apply(previous.asOf ? previous : { ...previous, asOf }));
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
      const next = selectBenefit(previous, benefit);
      return appendAssessment(
        append(
          { ...next, goal: choice?.goal ?? "calculation" },
          { kind: "user", text, local: true },
        ),
      );
    });
  }

  function changeGoal(goal: CaseGoal) {
    update((previous) => {
      return appendAssessment(
        append(
          { ...previous, goal },
          {
            kind: "user",
            text: goal === "application" ? "Zobacz dokumenty" : "Wróć do wyniku",
            local: true,
          },
        ),
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
      const next = {
        ...selectBenefit(previous, turn.benefit),
        goal: turn.goal,
      };
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
        previous.family.facts[answer.field] === facts[answer.field]
      )
        return previous;
      return recordAnswer(previous, answer.question, facts, { correction: true });
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
      const next = saveFacts(
        { ...previous, family: emptyParentCase, answered: [], benefit, goal: "calculation" },
        facts,
        sources,
      );
      return appendAssessment(append(next, { kind: "user", text: label, local: true }));
    });
  }

  function addDocument(file: File, mode: AttachedDocument["mode"]) {
    const preview = URL.createObjectURL(file);
    previews.current.add(preview);
    const document: AttachedDocument = { kind: "document", file, preview, mode };
    update((previous) => append(previous, document));
  }

  async function attachDocument(file: File) {
    const selection = ++fileSelection.current;
    const header = await file
      .slice(0, 5)
      .text()
      .catch(() => "");
    if (selection !== fileSelection.current) return;
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
    addDocument(pdf, uploadAllowed && pdf.size <= pdfUploadLimit ? "read" : "local");
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
      const next = { ...previous, demoRate };
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
      if (action.kind === "chooseBenefit") return askBenefit(previous, action.goal);
      if (action.kind === "unknownFact") {
        return appendMissingFactReply(previous, question);
      }
      return continueWithAssessment(previous, action);
    });
  }

  async function send(text: string) {
    if (pendingRequest.current) return;
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
    const latest = session.turns.at(-1);
    const followUp = latest?.kind === "help" ? findHelpFollowUp(latest.answer, text) : undefined;
    const knownHelp = followUp ?? findHelpAnswer(text);
    const hasPrivateDocument = session.turns.some(
      (turn) => turn.kind === "document" && turn.mode !== "demo",
    );
    if (knownHelp) {
      update((previous) =>
        append(
          previous,
          { kind: "user", text, local: hasPrivateDocument },
          { kind: "help", answer: knownHelp },
        ),
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
      if (normalized === "nie wiem") {
        update((previous) =>
          appendMissingFactReply(append(previous, { kind: "user", text, local: true }), question),
        );
        return;
      }
      const upcoming =
        question.key === "from" && session.family.facts.requestedDays !== undefined
          ? session.asOf
          : undefined;
      const facts = readFact(question.key, text, upcoming);
      if (facts && (!facts.birth || facts.birth <= session.asOf)) {
        confirm(benefitTurn, facts, { text });
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
    if (hasPrivateDocument) {
      update((previous) => append(previous, { kind: "user", text, local: true }, unavailableReply));
      return;
    }
    const controller = new AbortController();
    pendingRequest.current = controller;
    setThinking(true);
    const request = buildAssistantRequest(session, text);
    const checkedAssessment =
      benefitTurn?.kind === "assessment" &&
      (benefitTurn.result.status === "eligible" || benefitTurn.result.status === "ineligible");
    setSession((previous) => append(previous, { kind: "user", text }));

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
    if (controller.signal.aborted) return;
    if (action.success && action.data.kind === "help") {
      const help = await askHelp(action.data.question);
      if (controller.signal.aborted) return;
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
    update((previous) => append(previous, unavailableReply));
  }

  return {
    session,
    benefitTurn,
    expanded,
    setExpanded,
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
