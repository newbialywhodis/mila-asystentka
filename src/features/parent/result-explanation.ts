import type { BenefitResult } from "../../engine/parent-benefit";
import { formatDay, formatDays, labels, moneyLabel } from "../../engine/parent-case";
import { append, assessmentTurnIsCurrent } from "./case-session";
import type { CaseSession } from "./case-session";
import type { CaseTurn } from "./case-session";
import { documents } from "../../data/references";
import { questions } from "../../data/questions";
import { dependencyStamp } from "./result-snapshots";

export function procedureExplanationIsCurrent(
  s: CaseSession,
  turn: Extract<CaseTurn, { kind: "procedureExplanation" }>,
) {
  const snapshot = s.data.assessments.find((a) => a.id === turn.assessmentId)?.result;
  return (
    snapshot?.state === "current" &&
    snapshot.engineVersion === turn.snapshot.engineVersion &&
    snapshot.asOf === turn.snapshot.asOf &&
    JSON.stringify(snapshot.input) === JSON.stringify(turn.snapshot.input) &&
    dependencyStamp(snapshot.projectionDependencies) ===
      dependencyStamp(turn.snapshot.projectionDependencies)
  );
}

/** Presentation of the engine's stored numbers. No new arithmetic/eligibility rules. */
export function resultCalculationLines(result: BenefitResult) {
  const lines: string[] = [];
  if (result.moneyParts)
    for (const part of result.moneyParts)
      lines.push(
        `${formatDay(part.from)} – ${formatDay(part.through)}: podstawa ${moneyLabel(part.basis)}, dziennie ${moneyLabel(part.daily)}, ${formatDays(part.days)}.`,
      );
  else if (result.money)
    lines.push(
      `Przyjęta podstawa: ${moneyLabel(result.money.basis)}. Kwota dzienna: ${moneyLabel(result.money.daily)}.`,
    );
  if (result.extension?.money)
    lines.push(
      `Wydłużenie: ${formatDays(result.extensionDays ?? 0)}, dziennie ${moneyLabel(result.extension.money.daily)}, kwota ${moneyLabel(result.extension.money.total)}.`,
    );
  return lines;
}
export function resultExplanationLines(result: BenefitResult) {
  const lines: string[] = [result.reason];
  if (result.projected) lines.push("To prognoza dla potwierdzonych założeń, a nie decyzja ZUS.");
  if (result.period)
    lines.push(
      `Okres: ${formatDay(result.period.from)} – ${formatDay(result.period.through)}, ${formatDays(result.period.days)}.`,
    );
  if (result.rate !== undefined)
    lines.push(`Stawka: ${new Intl.NumberFormat("pl-PL").format(result.rate / 100)}% podstawy.`);
  lines.push(...resultCalculationLines(result));
  if (result.money) lines.push(`Kwota brutto w obliczeniu: ${moneyLabel(result.money.total)}.`);
  if (result.payer)
    lines.push(`Płatnik: ${result.payer === "zus" ? "ZUS" : "pracodawca lub płatnik składek"}.`);
  if (result.missing)
    lines.push(
      "Wynik ma braki; uzupełnij aktywne pytanie przed traktowaniem kwoty jako pełnego wyliczenia.",
    );
  if (result.documents.length)
    lines.push(
      "Dokumenty: " +
        result.documents
          .map(
            (d) =>
              `${d.title} (${d.recipient}${d.deadline ? `, do ${formatDay(d.deadline)}` : ""})`,
          )
          .join("; ") +
        ".",
    );
  return lines;
}
export function explainCurrentResult(s: CaseSession): CaseSession {
  const a = s.data.assessments.find((a) => a.id === s.activeAssessmentId);
  if (a?.kind === "procedure" && a.result?.state === "current") {
    const result = a.result.result;
    const status = {
      relevant: "Wstępnie dopasowana sprawa",
      possible: "Możliwa sprawa do sprawdzenia",
      "missing-data": "Brakuje danych do oceny",
      "not-relevant": "Poza listą dla podanych danych",
    }[result.status];
    const text = [
      result.procedure.title,
      status,
      result.procedure.summary,
      ...result.reasons.map((r) => r.text),
      ...result.missingFields.map((f) => `Do ustalenia: ${questions[f].label}`),
      ...result.deadlines.map(
        (d) =>
          `${d.title}${d.date ? `: ${formatDay(d.date)}` : " — termin wymaga danych"}. ${d.consequence}`,
      ),
      ...result.documents.map(
        (d) =>
          `${d.state === "conditional" ? "Warunkowo: " : "Dokument: "}${documents[d.id]?.title ?? d.id}${d.note ? `. ${d.note}` : ""}`,
      ),
      "To wyjaśnienie zapisanej oceny katalogowej, nie decyzja urzędu.",
    ].join("\n");
    return append(s, {
      kind: "procedureExplanation",
      assessmentId: a.id,
      snapshot: a.result,
      text,
    });
  }
  const turn = s.turns.findLast((t) => t.kind === "assessment" && t.assessmentId === a?.id);
  if (
    !a ||
    a.kind !== "calculator" ||
    !a.result ||
    a.result.state !== "current" ||
    turn?.kind !== "assessment" ||
    !assessmentTurnIsCurrent(s, turn)
  )
    return append(s, {
      kind: "note",
      text: "Nie ma aktualnego wyniku do wyjaśnienia. Wróć do sprawy i uzupełnij dane; nieaktualna kwota nie jest bieżącym wynikiem.",
    });
  const text = [
    labels[a.benefit],
    ...resultExplanationLines(a.result.result),
    a.result.input.fixedSalary !== undefined
      ? `Podstawa wynika ze stałej pensji ${moneyLabel(a.result.input.fixedSalary)} przyjętej za 12 pełnych miesięcy.`
      : "",
    "To uzasadnienie zapisanej oceny Mili. Szczegóły zależą od podanych danych i ograniczeń wskazanych w wyniku.",
  ]
    .filter(Boolean)
    .join("\n");
  return append(s, { kind: "explanation", text, assessment: turn });
}
