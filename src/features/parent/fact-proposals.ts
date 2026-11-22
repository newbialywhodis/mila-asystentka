import { z } from "zod";
import { append, appendAssessment, saveFacts, getCaseContext } from "./case-session";
import type { CaseSession } from "./case-session";
import { assistantAliases, buildAssistantRequest } from "./case-assistant-context";
import { normalizeGuideText } from "../guide/textInput";
import {
  factCandidateSchema,
  validateCandidates,
  guardModelCandidates,
  isRelatedAssessmentField,
  requiresTitleSelection,
} from "./intent-contract";
import type { FactCandidate } from "./intent-contract";
import { applyConfirmedFacts, confirmInterviewValue, getInterviewRoute } from "./interview-session";
import type { InterviewSession } from "./interview-session";
import { childIdSchema, personIdSchema, titleIdSchema, isValidTarget } from "./family-session";
import type { PersonId, PersonRole, TitleId, Subject } from "./family-session";
import type { Fact } from "./family-session";
import { refreshSnapshots } from "./result-snapshots";
import {
  showDiscovery,
  showInterview,
  showProcedure,
  requestDestination,
} from "./workspace-session";
import { calculatorTools } from "../../data/discovery";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import type { Field } from "../../types/profile";

export type FactProposal = {
  kind: "factsProposal";
  text: string;
  sessionId: string;
  revision: number;
  assessmentId: CaseSession["activeAssessmentId"];
  view: CaseSession["view"];
  privacy: CaseSession["privacy"];
  subject: string;
  assessmentContext: string;
  candidates: readonly FactCandidate[];
  ownershipCorrection: boolean;
};
export type ProposalSelection = {
  index: number;
  candidate: z.input<typeof factCandidateSchema>;
  person: string;
  title: string;
  explicitlyConfirmed: boolean;
  withdrawPrevious?: boolean;
};
export const newPersonRoles = ["birthing", "otherParent", "guardian"] as const;
function proposalContext(s: CaseSession) {
  return JSON.stringify({
    ...getCaseContext(s),
    eventId: s.data.family.event.id,
    asOfData: s.data.asOf,
    target: s.data.assessments.find((a) => a.id === s.activeAssessmentId)?.target,
  });
}
export function proposalIsCurrent(s: CaseSession, proposal: FactProposal) {
  return (
    s.pendingProposal === proposal &&
    s.data.id === proposal.sessionId &&
    s.data.contextRevision === proposal.revision &&
    s.activeAssessmentId === proposal.assessmentId &&
    s.view === proposal.view &&
    s.privacy === proposal.privacy &&
    proposalContext(s) === proposal.assessmentContext &&
    JSON.stringify(s.data.navigation.activeSubject) === proposal.subject
  );
}
export function proposeFacts(
  s: CaseSession,
  candidates: readonly FactCandidate[],
  latestText?: string,
): CaseSession {
  // Recheck the server response against the *current* local allowlist.
  const context = buildAssistantRequest(s, "Interpretacja").context;
  const checked = validateCandidates(
    latestText ? guardModelCandidates(candidates, latestText, context) : candidates,
    context,
  );
  if (!checked.length) return s;
  const proposal: FactProposal = {
    kind: "factsProposal",
    text: "Czy dobrze rozumiem? Wybierz dane do zapisania, sprawdź osobę i zakres. Przypuszczenia wymagają osobnego potwierdzenia.",
    sessionId: s.data.id,
    revision: s.data.contextRevision,
    assessmentId: s.activeAssessmentId,
    view: s.view,
    privacy: s.privacy,
    subject: JSON.stringify(s.data.navigation.activeSubject),
    assessmentContext: proposalContext(s),
    candidates: checked,
    ownershipCorrection: Boolean(latestText && /\bnie ja\b/.test(normalizeGuideText(latestText))),
  };
  return append({ ...s, pendingProposal: proposal }, proposal);
}
export function proposalPerson(s: CaseSession, candidate: FactCandidate) {
  const aliases = assistantAliases(s);
  return candidate.person ? (aliases[candidate.person]?.id ?? "") : "";
}
export function currentProposalFact(
  s: CaseSession,
  row: ProposalSelection,
): Fact<unknown> | undefined {
  const field = row.candidate.field;
  const family = s.data.family;
  const bound = s.data.assessments.find((a) => a.id === s.activeAssessmentId);
  const child =
    bound?.target.childIds.length === 1
      ? family.children.find((c) => c.id === bound.target.childIds[0])
      : family.children.length === 1
        ? family.children[0]
        : undefined;
  if (field === "stage") return family.stage;
  if (field === "dueDate") return family.dueDate;
  if (field === "pregnancyPeriod") return family.pregnancyPeriod;
  if (field === "children") return family.childrenCount;
  if (field === "birth") return child?.birth;
  switch (field.replace(/^procedure:/, "")) {
    case "gestationalWeeks":
      return child?.gestationalWeeks;
    case "birthWeightGrams":
      return child?.birthWeightGrams;
    case "schoolDeferral":
      return child?.schoolDeferral;
    case "childDeath":
      return child?.death;
    case "hospitalized":
      return child?.facts.hospitalized;
    case "zaZyciemCertificate":
      return child?.facts.zaZyciemCertificate;
    case "activeDisabilityCertificate":
      return child?.facts.activeDisabilityCertificate;
  }
  const person = s.data.persons.find((p) => p.id === row.person);
  const title = person?.titles.find((t) => t.id === row.title);
  if (field === "employment") return title?.employment ?? person?.workSituation;
  if (field === "insured")
    return title?.sicknessCoverage.find(
      (c) =>
        "validTime" in c.fact &&
        JSON.stringify(c.fact.validTime) === JSON.stringify(row.candidate.validTime),
    )?.fact;
  if (field === "need") return person?.sicknessCheck;
  const assessment = s.data.assessments.find((a) => a.id === s.activeAssessmentId);
  if (field.startsWith("procedure:")) {
    const key = field.slice(10);
    switch (key) {
      case "livesInPoland":
        return family.shared.livesInPoland;
      case "birthRegistered":
        return family.shared.birthRegistered;
      case "birthCardDate":
        return family.shared.birthCardDate;
      case "familyChildDisability":
        return family.shared.familyChildDisability;
      case "employedSixMonths":
        return person?.procedureFacts.employedSixMonths;
      case "parentUsesTaxScale":
        return person?.procedureFacts.parentUsesTaxScale;
    }
  }
  const ownerId = isRelatedAssessmentField(field)
    ? assessment?.target.relatedPersonId
    : assessment?.target.subject.kind === "person"
      ? assessment.target.subject.personId
      : assessment?.target.applicantId;
  if (row.candidate.scope !== "family" && row.person !== ownerId) return;
  if (field === "otherParentDays") {
    const usage = s.data.usage.find(
      (u) => u.personId === ownerId && u.eventId === family.event.id && u.period === "parental",
    );
    return usage?.period === "parental" ? usage.usedDays : undefined;
  }
  return assessment && assessment.kind !== "comparison"
    ? Object.entries(assessment.details).find(
        ([key]) => key === field.replace(/^procedure:/, ""),
      )?.[1]
    : undefined;
}
export function ownershipCorrectionSource(
  s: CaseSession,
  proposal: FactProposal,
  row: ProposalSelection,
) {
  if (!proposal.ownershipCorrection || row.candidate.field !== "employment") return;
  const aliases = assistantAliases(s);
  const title =
    aliases.title ?? (aliases.subject?.titles.length === 1 ? aliases.subject.titles[0] : undefined);
  const fact = title?.employment;
  if (
    !aliases.subject ||
    row.person === aliases.subject.id ||
    !title ||
    fact?.state !== "confirmed" ||
    fact.value !== row.candidate.value
  )
    return;
  return { personId: aliases.subject.id, titleId: title.id, fact };
}
function selectedPerson(data: InterviewSession, key: string): PersonId | undefined {
  return data.persons.find((p) => p.id === key)?.id;
}

/** Validate and write a draft; publish only after every selected field succeeds. */
export function confirmFactProposal(
  s: CaseSession,
  proposal: FactProposal,
  selections: readonly ProposalSelection[],
): { session: CaseSession; error?: string } {
  const fail = (message: string) => ({ session: s, error: message });
  if (!proposalIsCurrent(s, proposal))
    return fail("Ta propozycja wygasła po zmianie rozmowy lub zakresu. Nie zapisano danych.");
  const bound = s.data.assessments.find((a) => a.id === s.activeAssessmentId);
  if (s.activeAssessmentId && (!bound || !isValidTarget(s.data, bound.target)))
    return fail("Cel sprawy jest nieprawidłowy. Niczego nie zapisano.");
  if (!selections.length || selections.length > 12)
    return fail("Wybierz przynajmniej jedną informację.");
  if (new Set(selections.map((v) => v.index)).size !== selections.length)
    return fail("Powtórzone pole propozycji.");
  let data = s.data;
  let createdSubject: Subject | undefined;
  let correctedSubject: Subject | undefined;
  const people = new Map<string, PersonId>();
  const titles = new Map<string, TitleId>();
  const seen = new Set<string>();
  const casePatch: CaseFacts = {};
  // The user may edit values/owners, but cannot replace the proposed field or scope.
  const priority = (c: ProposalSelection["candidate"]) =>
    c.field === "stage" ? 0 : c.field === "employment" ? 1 : c.field === "insured" ? 3 : 2;
  for (const selection of [...selections].sort(
    (a, b) => priority(a.candidate) - priority(b.candidate),
  )) {
    const original = proposal.candidates[selection.index];
    const parsed = factCandidateSchema.safeParse(selection.candidate);
    if (
      !original ||
      !parsed.success ||
      parsed.data.field !== original.field ||
      parsed.data.scope !== original.scope ||
      !selection.explicitlyConfirmed
    )
      return fail(
        "Sprawdź zaznaczone pola, wartości i potwierdzenie niepewnych informacji. Niczego nie zapisano.",
      );
    const c = parsed.data;
    if (c.scope === "family" && (selection.person !== "" || selection.title !== ""))
      return fail(
        "Informacja rodzinna nie może mieć przypisanej osoby ani tytułu. Niczego nie zapisano.",
      );
    if (selection.withdrawPrevious) {
      const previous = ownershipCorrectionSource(s, proposal, selection);
      if (!previous)
        return fail(
          "Nie można wycofać poprzedniej informacji w tym zakresie. Niczego nie zapisano.",
        );
      const withdrawn = applyConfirmedFacts(data, {
        kind: "withdrawEmployment",
        baseRevision: data.contextRevision,
        personId: previous.personId,
        titleId: previous.titleId,
        expected: previous.fact.value,
        validTime: previous.fact.validTime,
      });
      if (!withdrawn.ok) return fail("Poprzednia informacja zmieniła się. Niczego nie zapisano.");
      data = withdrawn.session;
    }
    const selectedChild =
      bound?.target.childIds.length === 1
        ? bound.target.childIds[0]
        : data.family.children.length === 1
          ? data.family.children[0].id
          : undefined;
    if (c.field === "birth" && data.family.children.length > 1 && !selectedChild)
      return fail(
        "Wybierz konkretne dziecko w danych sprawy. Nie przypisuję daty do pierwszego dziecka automatycznie.",
      );
    if (
      (c.field === "birth" &&
        data.family.stage?.state === "confirmed" &&
        data.family.stage.value !== "born") ||
      ((c.field === "dueDate" || c.field === "pregnancyPeriod") &&
        data.family.stage?.state === "confirmed" &&
        data.family.stage.value !== "pregnant")
    )
      return fail(
        "Data nie pasuje do potwierdzonego etapu. Zaznacz również właściwą korektę etapu lub odrzuć datę.",
      );
    let personId: PersonId | undefined;
    if (c.scope !== "family") {
      personId = people.get(selection.person) ?? selectedPerson(data, selection.person);
      if (!personId && selection.person.startsWith("new:")) {
        const role = z.enum(newPersonRoles).safeParse(selection.person.slice(4));
        if (!role.success) return fail("Wskaż właściwą osobę. Niczego nie zapisano.");
        personId = personIdSchema.parse(
          `${data.id}:person:proposal:${proposal.revision}:${people.size}`,
        );
        const saved = confirmInterviewValue(
          data,
          { id: "subject", eventId: data.family.event.id },
          {
            speaker: data.navigation.speaker?.kind ?? "self",
            subject: { kind: "person", personId, role: role.data as PersonRole },
          },
        );
        if (!saved.ok) return fail("Nie można ustalić osoby. Niczego nie zapisano.");
        data = saved.session;
        createdSubject ??= data.navigation.activeSubject;
        people.set(selection.person, personId);
      }
      if (!personId)
        return fail("Wskaż osobę dla każdej wybranej informacji. Niczego nie zapisano.");
    }
    const duplicate = `${c.field}:${personId ?? "family"}:${selection.title}:${JSON.stringify(c.validTime)}`;
    if (seen.has(duplicate))
      return fail("Dwie wybrane propozycje dotyczą tego samego pola i zakresu. Wybierz jedną.");
    seen.add(duplicate);
    let titleId: TitleId | undefined;
    if (personId && selection.title) {
      const person = data.persons.find((p) => p.id === personId);
      titleId = person?.titles.find((t) => t.id === selection.title)?.id;
      if (!titleId && /^new:\d+$/.test(selection.title)) {
        const index = Number(selection.title.slice(4));
        const employment = selections.find(
          (v) =>
            v.index === index &&
            v.candidate.field === "employment" &&
            v.person === selection.person,
        );
        if (!employment)
          return fail(
            "Nowy tytuł musi mieć wybraną propozycję zatrudnienia. Niczego nie zapisano.",
          );
        const key = `${personId}:${selection.title}`;
        titleId =
          titles.get(key) ??
          titleIdSchema.parse(`${personId}:title:proposal:${proposal.revision}:${index}`);
        titles.set(key, titleId);
      }
      if (!titleId) return fail("Tytuł nie należy do wskazanej osoby. Niczego nie zapisano.");
    }
    if ((c.scope === "family" || c.field === "need") && c.validTime.kind !== "undated")
      return fail(
        "Etap i dane zdarzenia zapisujemy bez dodatkowego okresu. Datę zdarzenia podaj jako wartość pola. Niczego nie zapisano.",
      );
    const metadata = {
      source: { kind: "answer" as const, via: "aiConfirmation" as const },
      validTime: c.validTime,
    };
    const question =
      c.field === "stage"
        ? { id: "stage" as const, eventId: data.family.event.id }
        : c.field === "birth"
          ? {
              id: "timing" as const,
              field: "birth" as const,
              eventId: data.family.event.id,
              childId: selectedChild ?? childIdSchema.parse(`${data.family.event.id}:child:1`),
            }
          : c.field === "dueDate" || c.field === "pregnancyPeriod"
            ? { id: "timing" as const, field: "dueDate" as const, eventId: data.family.event.id }
            : c.field === "need" && personId
              ? { id: "need" as const, personId }
              : undefined;
    let saved;
    if (question) {
      saved = confirmInterviewValue(
        data,
        question,
        c.field === "birth" || c.field === "dueDate"
          ? { kind: "date", date: c.value }
          : c.field === "pregnancyPeriod"
            ? { kind: "period", period: c.value }
            : c.value,
        metadata,
      );
    } else if (c.field === "children") {
      saved = applyConfirmedFacts(data, {
        kind: "familyChildren",
        baseRevision: data.contextRevision,
        value: c.value,
        ...metadata,
      });
    } else if (c.field === "employment" && personId) {
      if (!titleId && c.value !== "notWorking" && c.value !== "other")
        return fail("Wybierz lub utwórz tytuł zatrudnienia. Niczego nie zapisano.");
      saved = confirmInterviewValue(
        data,
        { id: "employment", personId, titleId },
        { kind: c.value, titleId },
        metadata,
      );
    } else if (c.field === "insured" && personId && titleId && typeof c.value === "boolean") {
      if (c.validTime.kind === "undated")
        return fail(
          "Ubezpieczenie wymaga jawnego dnia lub okresu. Możesz pozostawić tę propozycję niezaznaczoną.",
        );
      const title = data.persons
        .find((p) => p.id === personId)
        ?.titles.find((t) => t.id === titleId);
      const existing = title?.sicknessCoverage.find(
        (coverage) =>
          "validTime" in coverage.fact &&
          JSON.stringify(coverage.fact.validTime) === JSON.stringify(c.validTime),
      );
      saved = applyConfirmedFacts(data, {
        kind: "coverage",
        baseRevision: data.contextRevision,
        personId,
        titleId,
        coverageId: existing?.id ?? `${titleId}:proposal:${proposal.revision}`,
        value: c.value,
        ...metadata,
      });
    } else if (c.field === "insured" || c.field === "employment") {
      return fail("Wskaż osobę i właściwy tytuł. Niczego nie zapisano.");
    } else if (s.activeAssessmentId) {
      const assessment = data.assessments.find((a) => a.id === s.activeAssessmentId);
      const subject = assessment?.target.subject;
      const ownerId = isRelatedAssessmentField(c.field)
        ? assessment?.target.relatedPersonId
        : subject?.kind === "person"
          ? subject.personId
          : assessment?.target.applicantId;
      const ownerTitle =
        subject?.kind === "person" ? subject.titleId : assessment?.target.applicantTitleId;
      if (
        !assessment ||
        (c.scope !== "family" &&
          (!ownerId ||
            ownerId !== personId ||
            (requiresTitleSelection(c.field) && ownerTitle && ownerTitle !== titleId)))
      )
        return fail(
          "Informacja musi dotyczyć osoby i tytułu aktywnej sprawy. Niczego nie zapisano.",
        );
      if (c.validTime.kind !== "undated")
        return fail("Dane sprawy uzupełnij w jej aktywnym zakresie. Niczego nie zapisano.");
      if (c.field.startsWith("procedure:"))
        saved = applyConfirmedFacts(data, {
          kind: "procedureFact",
          baseRevision: data.contextRevision,
          assessmentId: assessment.id,
          field: c.field.slice(10) as Field,
          value: c.value,
          source: metadata.source,
        });
      else {
        Object.assign(casePatch, { [c.field as FactKey]: c.value });
        saved = { ok: true as const, session: data };
      }
    } else
      return fail(
        "Ta informacja wymaga wybrania konkretnej sprawy, osoby i tytułu. Niczego nie zapisano.",
      );
    if (!saved.ok)
      return fail(
        "Nie można zapisać zestawu: sprawdź typ wartości, osobę, tytuł i okres. Niczego nie zapisano.",
      );
    data = saved.session;
    if (
      c.field === "birth" &&
      bound &&
      !bound.target.childIds.length &&
      question?.id === "timing" &&
      question.field === "birth"
    ) {
      data = {
        ...data,
        assessments: data.assessments.map((a) =>
          a.id === bound.id ? { ...a, target: { ...a.target, childIds: [question.childId] } } : a,
        ),
      };
    }
    const targetSubject = bound?.target.subject;
    if (
      c.field === "employment" &&
      titleId &&
      targetSubject?.kind === "person" &&
      targetSubject.personId === personId &&
      !targetSubject.titleId &&
      selections.filter(
        (entry) => entry.person === selection.person && entry.candidate.field === "employment",
      ).length === 1
    ) {
      data = {
        ...data,
        assessments: data.assessments.map((a) =>
          a.id === bound?.id
            ? { ...a, target: { ...a.target, subject: { ...targetSubject, titleId } } }
            : a,
        ),
      };
    }
    if (selection.withdrawPrevious) correctedSubject = data.navigation.activeSubject;
  }
  if (Object.keys(casePatch).length) {
    const saved = saveFacts(
      { ...s, data },
      casePatch,
      undefined,
      Object.fromEntries(
        Object.keys(casePatch).map((key) => [key, { kind: "answer", via: "aiConfirmation" }]),
      ),
    );
    if (saved.turns.length !== s.turns.length)
      return fail("Nie można zapisać danych sprawy w tym zakresie. Niczego nie zapisano.");
    data = saved.data;
  }
  data = {
    ...data,
    navigation: {
      ...data.navigation,
      activeSubject:
        correctedSubject ??
        s.data.navigation.activeSubject ??
        createdSubject ??
        data.navigation.activeSubject,
    },
  };
  if (bound && (s.view === "calculator" || s.view === "procedure"))
    data = {
      ...data,
      assessments: data.assessments.map((a) =>
        a.id === bound.id
          ? { ...a, state: "draft" as const, inputRevision: data.contextRevision }
          : a,
      ),
    };
  const next = append(
    { ...s, data: refreshSnapshots(data), pendingProposal: undefined },
    { kind: "user", text: `Potwierdzam wybrane informacje (${selections.length})`, local: true },
  );
  if (correctedSubject)
    return {
      session: showDiscovery({
        ...next,
        activeAssessmentId: undefined,
        scopeTarget: undefined,
        benefit: null,
      }),
    };
  if (bound?.kind === "calculator") {
    const routes: readonly string[] = calculatorTools[bound.benefit].routes;
    if (!routes.includes(getInterviewRoute(data))) return { session: showDiscovery(next) };
    const target = data.assessments.find((a) => a.id === bound.id)?.target.subject;
    if (
      target?.kind === "person" &&
      !target.titleId &&
      (data.persons.find((p) => p.id === target.personId)?.titles.length ?? 0) > 1
    )
      return { session: requestDestination(next, { kind: "calculator", benefit: bound.benefit }) };
  }
  return {
    session:
      s.view === "calculator"
        ? appendAssessment(next)
        : s.view === "procedure"
          ? showProcedure(next)
          : data.navigation.activeSubject && data.family.stage?.state === "confirmed"
            ? showDiscovery(next)
            : showInterview(next, data.interview.mode !== "idle"),
  };
}
export function rejectFactProposal(s: CaseSession, proposal: FactProposal) {
  return proposalIsCurrent(s, proposal)
    ? append(
        { ...s, pendingProposal: undefined },
        { kind: "note", text: "Odrzucono propozycje. Potwierdzone dane pozostają bez zmian." },
      )
    : s;
}
