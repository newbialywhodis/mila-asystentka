import { useEffect, useRef, useState } from "react";
import { warsawToday } from "../../engine/dates";
import type { DemoRate } from "../../engine/parent-benefit";
import { emptyParentCase, labels } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey, ParentCase } from "../../engine/parent-case";
import { findHelpAnswer, unavailableHelpAnswer } from "../guide/helpAnswers";
import type { HelpAnswer } from "../guide/helpAnswers";
import { normalizeGuideText } from "../guide/textInput";
import { pdfUploadLimit } from "./case-documents";
import type { DocumentData } from "./case-documents";
import { factValue, fields, readFact } from "./case-fields";
import {
  append,
  appendAssessment,
  askBenefit,
  continueWithDocument,
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
import type { AssistantRequest, CaseAction, CaseGoal, CaseTool } from "./parent-intent";

const expandedTools = ["plan", "formalities", "facts", "services", "rules"] as const;
export type ExpandedTool = (typeof expandedTools)[number];

const noConnection =
  "Nie udało mi się przetworzyć wiadomości. Spróbuj jeszcze raz lub wybierz, co chcesz sprawdzić.";
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

function assistantMessage(
  turn: Exclude<CaseTurn, AttachedDocument>,
): AssistantRequest["messages"][number] {
  if (turn.kind === "user") return { role: "user", content: turn.text };
  if (turn.kind === "help") return { role: "assistant", content: turn.answer.text };
  return { role: "assistant", content: turn.text };
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
      local: !text,
      answer,
    }),
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
  const question = benefitTurn?.kind === "assessment" ? benefitTurn.question : undefined;

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

  function defer(turn: AssessmentTurn, text = "Nie wiem") {
    update((previous) => {
      if (!turn.question || getBenefitTurn(previous) !== turn) return previous;
      return append(
        previous,
        { kind: "user", text, local: true },
        { ...turn, deferred: true, text: unknownFactHint(turn.question.key) },
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
      const current = getBenefitTurn(previous);
      if (action.kind === "clarify") return append(previous, { kind: "note", text: action.text });
      if (action.kind === "unknownFact") {
        return current?.kind === "assessment" && current.question
          ? append(previous, {
              ...current,
              deferred: true,
              text: unknownFactHint(current.question.key),
            })
          : askBenefit(previous, current?.goal ?? "calculation");
      }
      const choosing = current?.kind === "chooseBenefit";
      const benefit = action.benefit ?? (choosing ? null : previous.benefit);
      const goal = choosing && action.goal === "calculation" ? current.goal : action.goal;
      if (!benefit) return askBenefit(previous, goal);
      const selected = selectBenefit(previous, benefit);
      const next = { ...selected, goal };
      const facts = Object.fromEntries(
        Object.entries(action.facts).filter(
          ([key, value]) => next.family.facts[key as FactKey] !== value,
        ),
      );
      if (Object.keys(facts).length) {
        return append(previous, {
          kind: "propose",
          benefit,
          goal,
          facts,
          text: "Czy dobrze zrozumiałam? Potwierdź dane, żebym mogła sprawdzić świadczenie.",
        });
      }
      return appendAssessment(next);
    });
  }

  async function send(text: string) {
    if (pendingRequest.current) return;
    const normalized = normalizeGuideText(text).replace(/[.!?]$/, "");
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
    if (benefitTurn?.kind === "chooseBenefit") {
      const chosen = (Object.keys(labels) as Benefit[]).find(
        (benefit) => normalizeGuideText(labels[benefit]) === normalized,
      );
      if (chosen) {
        begin(chosen, benefitTurn, text);
        return;
      }
    }
    if (benefitTurn?.kind === "assessment" && question) {
      const facts = readFact(question.key, text);
      if (facts && (!facts.birth || facts.birth <= session.asOf)) {
        confirm(benefitTurn, facts, { text });
        return;
      }
      if (normalized === "nie wiem" && !benefitTurn.deferred) {
        defer(benefitTurn, text);
        return;
      }
    }
    const controller = new AbortController();
    pendingRequest.current = controller;
    setThinking(true);
    const user: CaseTurn = { kind: "user", text };
    const request: AssistantRequest = {
      messages: [
        ...session.turns
          .filter((turn) => turn.kind !== "document")
          .filter((turn) => turn.kind !== "user" || !turn.local),
        user,
      ]
        .slice(-16)
        .map(assistantMessage),
      context: {
        benefit: benefitTurn?.kind === "chooseBenefit" ? null : session.benefit,
        goal: benefitTurn?.goal ?? session.goal,
        pending: question ? { key: question.key, question: question.text } : null,
        confirmed: Object.keys(session.family.facts) as FactKey[],
      },
    };
    setSession((previous) => append(previous, user));

    async function askHelp(question: string) {
      const known = findHelpAnswer(question);
      if (known) return known;
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
    const action = caseActionSchema.safeParse(await response?.json().catch(() => null));
    if (controller.signal.aborted) return;
    if (action.success && action.data.kind === "help") {
      const help = await askHelp(action.data.question);
      if (controller.signal.aborted) return;
      update((previous) => append(previous, { kind: "help", answer: help }));
      return;
    }
    if (action.success && action.data.kind !== "help") {
      applyAction(action.data);
      return;
    }
    const known = findHelpAnswer(text);
    update((previous) => {
      const next = append(
        previous,
        known ? { kind: "help", answer: known } : { kind: "note", text: noConnection },
      );
      return !known && !getBenefitTurn(previous) ? askBenefit(next, "calculation") : next;
    });
  }

  return {
    session,
    benefitTurn,
    expanded,
    setExpanded,
    thinking,
    begin,
    requestBenefit,
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
