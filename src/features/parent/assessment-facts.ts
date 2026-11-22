import { questions } from "../../data/questions";
import { assessBenefit } from "../../engine/parent-benefit";
import { casePatchSchema } from "../../engine/parent-case";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import { parseDate } from "../../engine/dates";
import type { Question } from "../../types/catalog";
import type { Field } from "../../types/profile";
import { applyConfirmedFacts } from "./interview-session";
import type { InterviewSession, Transition } from "./interview-session";
import { toCaseFacts } from "./interview-profile";
import {
  caseFactOwnership,
  childIdSchema,
  confirmedValue,
  factSourceSchema,
  isoDateSchema,
  isValidTarget,
  profileOwnership,
  titleIdSchema,
} from "./family-session";
import type { AssessmentId, Fact, FactSource, ValidTime } from "./family-session";

export type AssessmentFactsCommand = {
  readonly baseRevision: number;
  readonly assessmentId: AssessmentId;
  readonly source?: FactSource;
  readonly sources?: Partial<Record<FactKey, FactSource>>;
} & (
  | { readonly kind: "caseFacts"; readonly facts: CaseFacts }
  | {
      readonly kind: "procedureFact";
      readonly field: Field;
      readonly value: unknown;
      readonly state?: "unknown" | "deferred";
    }
);

function validProcedureValue(field: Field, value: unknown): boolean {
  const question: Question = questions[field];
  if (question.input === "choice") return Boolean(question.options?.some((o) => o.value === value));
  if (question.input === "date") return typeof value === "string" && Boolean(parseDate(value));
  if (question.input === "number")
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      (!question.integer || Number.isInteger(value)) &&
      (question.min === undefined || value >= question.min) &&
      (question.max === undefined || value <= question.max)
    );
  return (
    Array.isArray(value) &&
    value.every(
      (v: unknown) =>
        v !== null &&
        typeof v === "object" &&
        "from" in v &&
        "through" in v &&
        typeof v.from === "string" &&
        typeof v.through === "string" &&
        Boolean(parseDate(v.from) && parseDate(v.through)) &&
        v.from <= v.through,
    )
  );
}

/** A single validated write boundary, with ownership decided by the domain registries. */
export function writeAssessmentFacts(
  s: InterviewSession,
  command: AssessmentFactsCommand,
): Transition {
  const fail = (reason: "invalid-target" | "invalid-answer" | "scope-conflict"): Transition => ({
    ok: false,
    session: s,
    reason,
  });
  const original = s.assessments.find((a) => a.id === command.assessmentId);
  if (!original || !isValidTarget(s, original.target) || original.kind === "comparison")
    return fail("invalid-target");
  if (
    (command.kind === "caseFacts" && command.facts.birth && command.facts.birth > s.asOf) ||
    (command.kind === "procedureFact" &&
      command.field === "birthDate" &&
      typeof command.value === "string" &&
      command.value > s.asOf)
  )
    return fail("invalid-answer");
  const source = command.source ?? { kind: "answer", via: "confirmation" };
  if (
    !factSourceSchema.safeParse(source).success ||
    Object.values(command.sources ?? {}).some((v) => !factSourceSchema.safeParse(v).success)
  )
    return fail("invalid-answer");
  if (
    command.kind === "caseFacts" &&
    (original.kind !== "calculator" || !casePatchSchema.safeParse(command.facts).success)
  )
    return fail("invalid-answer");
  if (
    command.kind === "procedureFact" &&
    (original.kind !== "procedure" ||
      (!command.state && !validProcedureValue(command.field, command.value)))
  )
    return fail("invalid-answer");
  if (
    command.kind === "procedureFact" &&
    !command.state &&
    ["employment", "otherParentEmployment", "sicknessInsurance", "insuredAtBirth"].includes(
      command.field,
    )
  ) {
    const subject = original.target.subject;
    const personId = subject.kind === "person" ? subject.personId : original.target.applicantId;
    const person = s.persons.find((p) => p.id === personId);
    if (!person) return fail("invalid-target");
    const titleId =
      subject.kind === "person"
        ? (subject.titleId ?? (person.titles.length === 1 ? person.titles[0].id : undefined))
        : undefined;
    if (command.field === "employment" || command.field === "otherParentEmployment") {
      const value = casePatchSchema.shape.employment.safeParse(command.value);
      if (!value.success || !value.data) return fail("invalid-answer");
      const id = titleId ?? titleIdSchema.parse(`${person.id}:title:procedure`);
      const saved = applyConfirmedFacts(s, {
        kind: "employment",
        baseRevision: s.contextRevision,
        personId: person.id,
        titleId: id,
        value: value.data,
        source,
        validTime: { kind: "day", day: original.asOf },
      });
      if (!saved.ok) return saved;
      return {
        ok: true,
        session: {
          ...saved.session,
          assessments: saved.session.assessments.map((a) =>
            a.id === original.id
              ? {
                  ...a,
                  state: "draft",
                  inputRevision: saved.session.contextRevision,
                  target: {
                    ...a.target,
                    subject: { kind: "person", personId: person.id, titleId: id },
                  },
                }
              : a,
          ),
        },
      };
    }
    const birth = s.family.children.find((c) => original.target.childIds.includes(c.id))?.birth;
    const day = command.field === "insuredAtBirth" ? confirmedValue(birth) : original.asOf;
    if (!titleId || !day || typeof command.value !== "boolean") return fail("invalid-target");
    const saved = applyConfirmedFacts(s, {
      kind: "coverage",
      baseRevision: s.contextRevision,
      personId: person.id,
      titleId,
      coverageId: `${titleId}:${day}`,
      value: command.value,
      source,
      validTime: { kind: "day", day },
    });
    if (!saved.ok) return saved;
    return {
      ok: true,
      session: {
        ...saved.session,
        assessments: saved.session.assessments.map((a) =>
          a.id === original.id
            ? {
                ...a,
                state: "draft",
                inputRevision: saved.session.contextRevision,
                deferredFields: a.deferredFields?.filter((f) => f !== command.field),
              }
            : a,
        ),
      },
    };
  }
  let next = s;
  const subject = original.target.subject;
  if (command.kind === "caseFacts" && command.facts.employment !== undefined) {
    if (subject.kind !== "person") return fail("invalid-target");
    const titleId = subject.titleId ?? titleIdSchema.parse(`${subject.personId}:title:manual`);
    const saved = applyConfirmedFacts(next, {
      kind: "employment",
      baseRevision: next.contextRevision,
      personId: subject.personId,
      titleId,
      value: command.facts.employment,
      source: command.sources?.employment ?? source,
      validTime: {
        kind: "day",
        day: isoDateSchema.parse(
          (original.kind === "calculator"
            ? assessBenefit(
                original.benefit,
                { ...toCaseFacts(s, original.id).value, ...command.facts },
                original.asOf,
              ).coverageDay
            : undefined) ??
            command.facts.from ??
            command.facts.birth ??
            command.facts.dueDate ??
            original.asOf,
        ),
      },
    });
    if (!saved.ok) return saved;
    next = {
      ...saved.session,
      assessments: saved.session.assessments.map((a) =>
        a.id === original.id
          ? { ...a, state: "draft", target: { ...a.target, subject: { ...subject, titleId } } }
          : a,
      ),
    };
  }
  const draft = structuredClone(next);
  const revision = next.contextRevision + 1;
  const target = draft.assessments.find((a) => a.id === original.id);
  if (!target || target.kind === "comparison") return fail("invalid-target");
  const targetPersonId =
    target.target.subject.kind === "person"
      ? target.target.subject.personId
      : target.target.applicantId;
  const person = draft.persons.find((p) => p.id === targetPersonId);
  const title = person?.titles.find(
    (t) => target.target.subject.kind === "person" && t.id === target.target.subject.titleId,
  );
  const day = { kind: "day", day: target.asOf } as const;
  const make = <T>(
    value: T | undefined,
    fieldSource = source,
    validTime: ValidTime = { kind: "undated" },
  ): Fact<T> =>
    value === undefined
      ? { state: "deferred", revision }
      : {
          state: "confirmed",
          value: structuredClone(value),
          revision,
          source: fieldSource,
          validTime,
          basis: "observed",
        };
  const child = () => {
    const id = target.target.childIds[0] ?? childIdSchema.parse(`${draft.family.event.id}:child:1`);
    let found = draft.family.children.find((c) => c.id === id);
    if (!found) {
      found = { id, facts: {} };
      Object.assign(draft.family, { children: [...draft.family.children, found] });
      Object.assign(target, { target: { ...target.target, childIds: [id] } });
    }
    return found;
  };
  if (command.kind === "procedureFact") {
    const { field, value } = command;
    const fact = command.state ? { state: command.state, revision } : make(value, source, day);
    switch (profileOwnership[field]) {
      case "procedure":
        if (field.startsWith("other") && !target.target.relatedPersonId)
          return fail("invalid-target");
        Object.assign(target.details, { [field]: fact });
        break;
      case "person":
        if (!person) return fail("invalid-target");
        Object.assign(person.procedureFacts, { [field]: fact });
        break;
      case "family":
        if (field === "stage")
          Object.assign(draft.family, {
            stage: fact,
            event: { ...draft.family.event, kind: make("birth") },
          });
        else if (field === "dueDate") Object.assign(draft.family, { dueDate: fact });
        else if (field === "childrenBorn") Object.assign(draft.family, { childrenCount: fact });
        else Object.assign(draft.family.shared, { [field]: fact });
        break;
      case "child": {
        const c = child();
        if (field === "birthDate") Object.assign(c, { birth: fact });
        else if (["hospitalStays", "gestationalWeeks", "birthWeightGrams"].includes(field))
          Object.assign(c, { [field]: fact });
        else Object.assign(c.facts, { [field]: fact });
        break;
      }
      case "title":
        if (command.state)
          Object.assign(target, {
            deferredFields: [...(target.deferredFields ?? []).filter((f) => f !== field), field],
          });
        else return fail("invalid-target");
        break;
      case "projection":
        if (command.state)
          Object.assign(target, {
            deferredFields: [...(target.deferredFields ?? []).filter((f) => f !== field), field],
          });
        else return fail("scope-conflict");
        break;
    }
  } else {
    const patch = command.facts;
    // Establish the event only from an explicit answer, never from an unknown stage.
    if (patch.birthStage || patch.birth || patch.dueDate || patch.careKind) {
      const careKind = patch.careKind ?? confirmedValue(draft.family.eventFacts.careKind);
      const stage = careKind
        ? "receivingCare"
        : patch.birthStage === "born" || patch.birth
          ? "born"
          : patch.birthStage || patch.dueDate
            ? "pregnant"
            : confirmedValue(draft.family.stage);
      Object.assign(draft.family, {
        ...(stage ? { stage: make(stage) } : {}),
        event: {
          ...draft.family.event,
          kind: make(careKind ? (careKind === "adoption" ? "adoption" : "foster") : "birth"),
        },
      });
    }
    if (original.kind === "calculator" && original.benefit === "lossMaternity")
      Object.assign(draft.family, { loss: make(true) });
    for (const key of Object.keys(patch) as FactKey[]) {
      if (key === "insured" || key === "employment") continue;
      const value = patch[key];
      const fact = make(value, command.sources?.[key] ?? source);
      switch (caseFactOwnership[key]) {
        case "calculation":
          Object.assign(target.details, { [key]: fact });
          break;
        case "family":
          if (key === "children") Object.assign(draft.family, { childrenCount: fact });
          else if (key === "dueDate") Object.assign(draft.family, { dueDate: fact });
          else Object.assign(draft.family.eventFacts, { [key]: fact });
          break;
        case "child":
          Object.assign(child(), { [key === "childDeath" ? "death" : key]: fact });
          break;
        case "title":
          if (!title) return fail("invalid-target");
          Object.assign(title, { [key === "employmentEnded" ? "ended" : key]: fact });
          break;
        case "usage": {
          if (!person) return fail("invalid-target");
          if (key === "parts") Object.assign(draft, { parentalParts: fact });
          else {
            const period = key === "paternityUsed" ? "paternity" : "parental";
            const entry = draft.usage.find(
              (u) =>
                u.personId === person.id &&
                u.eventId === draft.family.event.id &&
                u.period === period,
            );
            if (entry) Object.assign(entry, { [key]: fact });
            else
              Object.assign(draft, {
                usage: [
                  ...draft.usage,
                  { personId: person.id, eventId: draft.family.event.id, period, [key]: fact },
                ],
              });
          }
          break;
        }
        case "projection":
          if (key === "careCertificate")
            Object.assign(child().facts, { zaZyciemCertificate: fact });
          else if (key === "careChildren" && Array.isArray(value)) {
            const children = value.map((v, index) => ({
              id: childIdSchema.parse(`${draft.family.event.id}:child:${index + 1}`),
              birth: make(v.birth, command.sources?.[key] ?? source),
              schoolDeferral: make(v.schoolDeferral, command.sources?.[key] ?? source),
              facts: {},
            }));
            Object.assign(draft.family, { children });
            Object.assign(target, {
              target: { ...target.target, childIds: children.map((c) => c.id) },
            });
          } else if (key === "otherParentDays") {
            if (!target.target.relatedPersonId) return fail("invalid-target");
            const entry = draft.usage.find(
              (u) =>
                u.personId === target.target.relatedPersonId &&
                u.period === "parental" &&
                u.eventId === draft.family.event.id,
            );
            if (entry) Object.assign(entry, { usedDays: fact });
            else
              Object.assign(draft, {
                usage: [
                  ...draft.usage,
                  {
                    personId: target.target.relatedPersonId,
                    eventId: draft.family.event.id,
                    period: "parental",
                    usedDays: fact,
                  },
                ],
              });
          }
          break;
      }
    }
    if (patch.hospitalFrom || patch.hospitalThrough || patch.hospitalRanges) {
      const existing = confirmedValue(child().hospitalStays)?.[0];
      const from =
        patch.hospitalFrom ?? confirmedValue(child().hospitalStayDraft?.from) ?? existing?.from;
      const through =
        patch.hospitalThrough ??
        confirmedValue(child().hospitalStayDraft?.through) ??
        existing?.through;
      const stays = patch.hospitalRanges
        ? patch.hospitalRanges.split(",").map((r) => {
            const [from, through] = r.trim().split("/");
            return { from, through };
          })
        : from && through
          ? [{ from, through }]
          : [];
      // A half-entered stay belongs to this calculation until both endpoints are confirmed.
      Object.assign(child(), {
        hospitalStayDraft: {
          ...child().hospitalStayDraft,
          ...(patch.hospitalFrom ? { from: make(isoDateSchema.parse(patch.hospitalFrom)) } : {}),
          ...(patch.hospitalThrough
            ? { through: make(isoDateSchema.parse(patch.hospitalThrough)) }
            : {}),
        },
      });
      if (stays.length)
        Object.assign(child(), { hospitalStays: make(stays), hospitalStayDraft: undefined });
    }
    Object.assign(target, { state: "draft" });
    const projected = toCaseFacts(draft, target.id).value;
    const benefit = original.kind === "calculator" ? original.benefit : undefined;
    const probe =
      benefit &&
      assessBenefit(
        benefit,
        { ...projected, employment: confirmedValue(title?.employment) },
        target.asOf,
      );
    const coverageDay = probe
      ? (probe.coverageDay ??
        assessBenefit(
          benefit || "maternity",
          { ...projected, insured: undefined, employment: confirmedValue(title?.employment) },
          target.asOf,
        ).coverageDay)
      : undefined;
    if (patch.employmentPercent !== undefined && title && coverageDay)
      Object.assign(title, {
        employmentPercent: make(
          patch.employmentPercent,
          command.sources?.employmentPercent ?? source,
          { kind: "day", day: isoDateSchema.parse(coverageDay) },
        ),
      });
    if (patch.insured !== undefined) {
      if (!title || !person || !coverageDay) return fail("invalid-target");
      const day = isoDateSchema.parse(coverageDay);
      const coverage = make(patch.insured, command.sources?.insured ?? source, {
        kind: "day",
        day,
      });
      if (coverage.state === "confirmed" && day > draft.asOf) {
        Object.assign(coverage, { basis: "assumed" });
        Object.assign(target, { forecast: true });
      }
      Object.assign(title, {
        sicknessCoverage: [
          ...title.sicknessCoverage.filter(
            (c) =>
              !(
                "validTime" in c.fact &&
                c.fact.validTime.kind === "day" &&
                c.fact.validTime.day === day
              ),
          ),
          { id: `${title.id}:${day}`, fact: coverage },
        ],
      });
    }
    for (const key of [
      "basis",
      "fixedSalary",
      "rehabSickBasis",
      "payer",
      "insuredHeadcount",
      "debt",
    ] as const) {
      if (!(key in patch) || patch[key] === undefined) continue;
      if (!title || !coverageDay) return fail("invalid-target");
      const from = isoDateSchema.parse(coverageDay);
      const through = isoDateSchema.parse(
        projected.through && projected.through >= from ? projected.through : from,
      );
      const financialFact = make(patch[key], command.sources?.[key] ?? source, {
        kind: "period",
        from,
        through,
      });
      if (
        financialFact.state === "confirmed" &&
        (coverageDay > draft.asOf || confirmedValue(draft.family.stage) === "pregnant")
      )
        Object.assign(financialFact, { basis: "assumed" });
      Object.assign(target.details, { [key]: financialFact });
    }
  }
  Object.assign(target, {
    state: "draft",
    inputRevision: revision,
    ...(command.kind === "procedureFact" && !command.state
      ? { deferredFields: target.deferredFields?.filter((f) => f !== command.field) }
      : {}),
  });
  return {
    ok: true,
    session: { ...draft, contextRevision: revision, pendingOperation: undefined },
  };
}
