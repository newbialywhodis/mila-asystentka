import { calculatorTools, discoveryDefinitions } from "../../data/discovery";
import type { ProcedureId } from "../../data/discovery";
import { procedures } from "../../data/procedures";
import { assessBenefit } from "../../engine/parent-benefit";
import { casePatchSchema } from "../../engine/parent-case";
import { parseDate } from "../../engine/dates";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import type { Field, Profile } from "../../types/profile";
import {
  caseFactOwnership,
  isoDateSchema,
  isValidTarget,
  profileOwnership,
  timeContains,
} from "./family-session";
import type {
  AssessmentId,
  AssessmentTarget,
  ChildId,
  EventId,
  Fact,
  Family,
  ISODate,
  Person,
  PersonId,
  TitleId,
  InsuranceTitle,
  ValidTime,
} from "./family-session";
import type { InterviewSession } from "./interview-session";

export type ProjectionRef =
  | {
      kind: "family";
      eventId: EventId;
      field:
        | keyof Family
        | "event.kind"
        | `shared.${keyof Family["shared"]}`
        | `eventFacts.${keyof Family["eventFacts"]}`;
    }
  | {
      kind: "person";
      personId: PersonId;
      field: "roles" | "titles" | "workSituation" | keyof Person["procedureFacts"];
    }
  | {
      kind: "title";
      personId: PersonId;
      titleId: TitleId;
      field: keyof InsuranceTitle;
      coverageId?: string;
    }
  | {
      kind: "child";
      childId: ChildId;
      field: keyof Family["children"][number] | keyof Family["children"][number]["facts"];
    }
  | {
      kind: "assessment";
      assessmentId: AssessmentId;
      field: "target" | "state" | "details" | "configuration" | Field | FactKey;
    }
  | {
      kind: "usage";
      personId?: PersonId;
      eventId: EventId;
      field: "usedDays" | "paternityUsed" | "parts";
    }
  | { kind: "selection"; field: "persons" | "target" | "assessments" };
export type ProjectionDependency = {
  readonly ref: ProjectionRef;
  readonly revision: number | null;
  readonly state?: Fact<unknown>["state"];
  readonly basis?: "observed" | "assumed";
  readonly validTime?: ValidTime;
  readonly onDay?: ISODate;
  // Structural selections (including absent members) must also be invalidated.
  readonly selection?: string;
};
export type OmissionReason =
  | "missing"
  | "unknown"
  | "deferred"
  | "stale"
  | "assumed"
  | "outside-period"
  | "conflict"
  | "invalid-target"
  | "subject"
  | "title"
  | "child"
  | "unsupported-scope"
  | "unsupported-employment"
  | "family-scope"
  | "coverage-day";
export type Projection<T> = {
  readonly value: T;
  readonly omitted: readonly { field: string; reason: OmissionReason }[];
  readonly assumptions: readonly string[];
  readonly dependencies: readonly ProjectionDependency[];
};

// Local builders hold only the returned projection and its audit, never a second store.
function audit() {
  const omitted: { field: string; reason: OmissionReason }[] = [];
  const assumptions: string[] = [];
  const dependencies: ProjectionDependency[] = [];
  const omit = (field: string, reason: OmissionReason) => {
    if (!omitted.some((entry) => entry.field === field && entry.reason === reason))
      omitted.push({ field, reason });
  };
  const select = (ref: ProjectionRef, value: unknown) => {
    dependencies.push({ ref, revision: null, selection: JSON.stringify(value) ?? "absent" });
  };
  const read = <T>(
    field: string,
    fact: Fact<T> | undefined,
    ref: ProjectionRef,
    day?: ISODate,
    allowAssumed = false,
  ): T | undefined => {
    dependencies.push({
      ref,
      revision: fact?.revision ?? null,
      state: fact?.state,
      onDay: day,
      ...(fact?.state === "confirmed" || fact?.state === "stale"
        ? { basis: fact.basis, validTime: structuredClone(fact.validTime) }
        : {}),
    });
    if (!fact || fact.state !== "confirmed") {
      omit(field, fact?.state ?? "missing");
      return;
    }
    if (fact.basis === "assumed" && !allowAssumed) {
      omit(field, "assumed");
      return;
    }
    if (day && !timeContains(fact.validTime, day)) {
      omit(field, "outside-period");
      return;
    }
    if (fact.basis === "assumed" && !assumptions.includes(field)) assumptions.push(field);
    return structuredClone(fact.value);
  };
  const result = <T>(value: T): Projection<T> => ({ value, omitted, assumptions, dependencies });
  return { omitted, assumptions, dependencies, omit, select, read, result };
}
type Audit = ReturnType<typeof audit>;

function observed<T>(fact: Fact<T> | undefined): T | undefined {
  return fact?.state === "confirmed" && fact.basis === "observed" ? fact.value : undefined;
}

export function projectionRoute(s: InterviewSession) {
  const stage = observed(s.family.stage);
  const kind = observed(s.family.event.kind);
  if (observed(s.family.loss) === true) return "loss";
  if (s.family.loss?.state === "confirmed" && s.family.loss.value) return "undetermined";
  if (stage === "planning") return "planning";
  if (stage === "receivingCare" && (kind === "adoption" || kind === "foster")) return kind;
  if ((stage === "pregnant" || stage === "born") && kind === "birth") return "standard";
  return "undetermined";
}

function context(s: InterviewSession, target: AssessmentTarget, a: Audit) {
  a.select({ kind: "selection", field: "target" }, target);
  a.select({ kind: "selection", field: "persons" }, s.persons.map(({ id }) => id).sort());
  a.select(
    { kind: "family", eventId: s.family.event.id, field: "children" },
    s.family.children.map(({ id }) => id).sort(),
  );
  for (const field of ["stage", "loss"] as const)
    a.read<unknown>(field, s.family[field], { kind: "family", eventId: s.family.event.id, field });
  a.read("event.kind", s.family.event.kind, {
    kind: "family",
    eventId: s.family.event.id,
    field: "event.kind",
  });
  if (!isValidTarget(s, target)) {
    a.omit("target", "invalid-target");
    return;
  }
  const subject = target.subject;
  const person = s.persons.find(
    ({ id }) => id === (subject.kind === "person" ? subject.personId : target.applicantId),
  );
  if (person) {
    a.select({ kind: "person", personId: person.id, field: "roles" }, person.roles);
    a.select(
      { kind: "person", personId: person.id, field: "titles" },
      person.titles.map(({ id }) => id).sort(),
    );
  }
  // No implicit first/only title: the assessment/discovery target names it.
  const title = (subject.kind === "person" ? subject.titleId : target.applicantTitleId)
    ? person?.titles.find(
        ({ id }) => id === (subject.kind === "person" ? subject.titleId : target.applicantTitleId),
      )
    : undefined;
  if (
    (person && s.persons.filter(({ id }) => id === person.id).length !== 1) ||
    (title && person && person.titles.filter(({ id }) => id === title.id).length !== 1)
  ) {
    a.omit("target", "conflict");
    return;
  }
  const children = s.family.children.filter(({ id }) => target.childIds.includes(id));
  return { person, title, children };
}

function employment(
  person: Person | undefined,
  title: InsuranceTitle | undefined,
  day: ISODate | undefined,
  a: Audit,
  field: string,
  allowEnded = false,
) {
  if (!person) {
    a.omit(field, "subject");
    return;
  }
  a.read(
    field,
    person.workSituation,
    { kind: "person", personId: person.id, field: "workSituation" },
    day,
  );
  if (!title) {
    a.omit(field, "title");
    return;
  }
  const ref = { kind: "title", personId: person.id, titleId: title.id } as const;
  const ended = a.read("employmentEnded", title.ended, { ...ref, field: "ended" });
  // CaseFacts.employment also names a former insurance title. The existing
  // calculator, using employmentEnded and insured, decides post-insurance rules.
  const formerTitle = Boolean(allowEnded && day && ended && ended < day);
  const candidates = [title.employment, ...(title.employmentPeriods ?? [])].filter(
    (f) => f?.state === "confirmed" && (!day || timeContains(f.validTime, day)),
  );
  if (
    candidates.length > 1 &&
    candidates.some(
      (f) =>
        f?.state === "confirmed" &&
        candidates[0]?.state === "confirmed" &&
        f.value !== candidates[0].value,
    )
  ) {
    a.omit(field, "conflict");
    return;
  }
  const value = a.read(
    field,
    candidates[0] ?? title.employment,
    { ...ref, field: "employment" },
    formerTitle ? ended : day,
  );
  if (day && ended && ended < day && !allowEnded) {
    a.omit(field, "outside-period");
    return;
  }
  if (
    day &&
    !formerTitle &&
    observed(person.workSituation) &&
    person.workSituation?.state === "confirmed" &&
    timeContains(person.workSituation.validTime, day)
  ) {
    a.omit(field, "conflict");
    return;
  }
  return value;
}

function coverage(
  person: Person | undefined,
  title: InsuranceTitle | undefined,
  day: ISODate | undefined,
  a: Audit,
  field: string,
  allowAssumed = false,
) {
  if (!person) {
    a.omit(field, "subject");
    return;
  }
  if (!title) {
    a.omit(field, "title");
    return;
  }
  const ref = {
    kind: "title",
    personId: person.id,
    titleId: title.id,
    field: "sicknessCoverage",
  } as const;
  a.select(ref, title.sicknessCoverage.map(({ id }) => id).sort());
  if (!day) {
    a.omit(field, "coverage-day");
    return;
  }
  const candidates = title.sicknessCoverage.filter(
    ({ fact }) => fact.state === "confirmed" && timeContains(fact.validTime, day),
  );
  // Prefer evidence, but never allow an assumption to contradict it silently.
  const values = candidates.map(({ id, fact }) =>
    a.read(field, fact, { ...ref, coverageId: id }, day, allowAssumed),
  );
  for (const { id, fact } of title.sicknessCoverage.filter((entry) => !candidates.includes(entry)))
    a.read(field, fact, { ...ref, coverageId: id }, day, allowAssumed);
  const known = values.filter((value) => value !== undefined);
  if (!known.length) {
    a.omit(field, candidates.length ? "assumed" : "missing");
    return;
  }
  if (!known.every((value) => value === known[0])) {
    a.omit(field, "conflict");
    return;
  }
  const ended = observed(title.ended);
  a.read("employmentEnded", title.ended, {
    kind: "title",
    personId: person.id,
    titleId: title.id,
    field: "ended",
  });
  if (known[0] && ended && ended < day) {
    a.omit(field, "conflict");
    return;
  }
  return known[0];
}

function completedStays(stays: NonNullable<Profile["hospitalStays"]>, day: ISODate) {
  return stays.every(
    ({ from, through }) =>
      parseDate(from) && parseDate(through) && from <= through && through <= day,
  );
}

function birthDate(children: readonly Family["children"][number][], asOf: ISODate, a: Audit) {
  if (!children.length) {
    a.omit("birthDate", "child");
    return;
  }
  const dates = children.map((child) =>
    a.read("birthDate", child.birth, { kind: "child", childId: child.id, field: "birth" }),
  );
  if (dates.some((date) => !date)) return;
  if (!dates.every((date) => date === dates[0]) || dates[0]! > asOf) {
    a.omit("birthDate", "conflict");
    return;
  }
  return dates[0];
}

function sameTarget(a: AssessmentTarget, b: AssessmentTarget) {
  return (
    a.eventId === b.eventId &&
    a.subject.kind === b.subject.kind &&
    (a.subject.kind !== "person" ||
      (b.subject.kind === "person" &&
        a.subject.personId === b.subject.personId &&
        a.subject.titleId === b.subject.titleId)) &&
    a.relatedPersonId === b.relatedPersonId &&
    a.applicantId === b.applicantId &&
    a.applicantTitleId === b.applicantTitleId &&
    JSON.stringify([...a.childIds].sort()) === JSON.stringify([...b.childIds].sort())
  );
}

export function toProcedureProfile(
  s: InterviewSession,
  procedureId: ProcedureId,
  target: AssessmentTarget,
  asOf: string,
): Projection<Profile> {
  const day = isoDateSchema.parse(asOf);
  const a = audit();
  const value: Profile = {};
  const c = context(s, target, a);
  if (!c) return a.result(value);
  if (projectionRoute(s) !== "standard") {
    a.omit("stage", "unsupported-scope");
    return a.result(value);
  }
  const policy = discoveryDefinitions[procedureId].subjectPolicy;
  const { person, title, children } = c;
  if (
    policy !== "family" &&
    (!person ||
      (policy === "birthing" && !person.roles.includes("birthing")) ||
      (policy === "otherParent" && !person.roles.includes("otherParent")) ||
      (policy === "parent" && !person.roles.length))
  ) {
    a.omit("subject", "subject");
    return a.result(value);
  }
  const stage = observed(s.family.stage);
  if (stage === "pregnant" || stage === "born") value.stage = stage;
  value.dueDate = a.read(
    "dueDate",
    s.family.dueDate,
    {
      kind: "family",
      eventId: target.eventId,
      field: "dueDate",
    },
    undefined,
    true,
  );
  value.birthDate = birthDate(children, day, a);
  value.childrenBorn = a.read("childrenBorn", s.family.childrenCount, {
    kind: "family",
    eventId: target.eventId,
    field: "childrenCount",
  });
  if (stage === "pregnant" && value.birthDate) {
    delete value.birthDate;
    a.omit("birthDate", "conflict");
  }
  if (person) {
    const employmentDay =
      procedureId === "MATERNITY_ALLOWANCE" && value.birthDate
        ? isoDateSchema.parse(value.birthDate)
        : day;
    const work = employment(person, title, employmentDay, a, "employment");
    if (work === "employee" || work === "contract" || work === "business") {
      // Stage 1 has only a generic otherParent role, not a confirmed father.
      // Keep this as a referral instead of attributing an employee leave to
      // someone solely because they are the other parent.
      if (procedureId === "PATERNITY_LEAVE" && observed(person.father) === true)
        value.otherParentEmployment = work;
      else if (procedureId === "PATERNITY_LEAVE") a.omit("otherParentEmployment", "subject");
      else value.employment = work;
    } else if (work) a.omit("employment", "unsupported-employment");
    value.sicknessInsurance = coverage(person, title, day, a, "sicknessInsurance");
    if (person.roles.includes("birthing"))
      value.insuredAtBirth = coverage(
        person,
        title,
        value.birthDate ? isoDateSchema.parse(value.birthDate) : undefined,
        a,
        "insuredAtBirth",
      );
    for (const field of ["employedSixMonths", "parentUsesTaxScale"] as const) {
      const v = a.read(
        field,
        person.procedureFacts[field],
        { kind: "person", personId: person.id, field },
        day,
      );
      if (v !== undefined) Object.assign(value, { [field]: v });
    }
  }
  for (const field of Object.keys(profileOwnership) as Field[]) {
    if (
      ["livesInPoland", "birthRegistered", "birthCardDate", "familyChildDisability"].includes(field)
    ) {
      const key = field as keyof Family["shared"];
      const fact = s.family.shared[key];
      const v = a.read<unknown>(
        field,
        fact,
        {
          kind: "family",
          eventId: target.eventId,
          field: `shared.${key}`,
        },
        key !== "birthCardDate" && fact?.state === "confirmed" && fact.validTime.kind !== "undated"
          ? day
          : undefined,
      );
      if (v !== undefined) Object.assign(value, { [field]: v });
    }
  }
  if (children.length === 1) {
    const child = children[0];
    for (const field of ["gestationalWeeks", "birthWeightGrams", "hospitalStays"] as const) {
      const v = a.read<unknown>(field, child[field], { kind: "child", childId: child.id, field });
      if (v !== undefined) Object.assign(value, { [field]: v });
    }
    for (const field of Object.keys(profileOwnership) as Field[]) {
      if (["hospitalized", "zaZyciemCertificate", "activeDisabilityCertificate"].includes(field)) {
        const key = field as keyof typeof child.facts;
        const fact = child.facts[key];
        const v = a.read<unknown>(
          field,
          fact,
          {
            kind: "child",
            childId: child.id,
            field: key,
          },
          undefined,
        );
        if (v !== undefined) Object.assign(value, { [field]: v });
      }
    }
    if (value.hospitalStays && !completedStays(value.hospitalStays, day)) {
      delete value.hospitalStays;
      a.omit("hospitalStays", "outside-period");
    }
  } else a.omit("child", children.length ? "unsupported-scope" : "child");

  const matches = s.assessments.filter(
    (assessment) =>
      assessment.kind === "procedure" &&
      assessment.procedureId === procedureId &&
      assessment.asOf === day &&
      sameTarget(assessment.target, target),
  );
  a.select({ kind: "selection", field: "assessments" }, matches.map(({ id }) => id).sort());
  const assessment =
    matches.length === 1 && matches[0].kind === "procedure" ? matches[0] : undefined;
  if (matches.length > 1) a.omit("details", "conflict");
  if (assessment) {
    a.select({ kind: "assessment", assessmentId: assessment.id, field: "state" }, assessment.state);
    a.select(
      { kind: "assessment", assessmentId: assessment.id, field: "target" },
      assessment.target,
    );
  }
  for (const field of Object.keys(profileOwnership) as Field[]) {
    if (profileOwnership[field] !== "procedure") continue;
    const key = field as keyof NonNullable<typeof assessment>["details"];
    if (!assessment) {
      a.omit(field, "missing");
      continue;
    }
    if (assessment.state === "stale") {
      a.omit(field, "stale");
      continue;
    }
    const fact = assessment.details[key];
    // Procedure facts describe this assessment, but changing conditions need a day.
    const periodRequired = [
      "receivesMaternity",
      "familyIncomePerPerson",
      "activeComponent",
      "legacyRko",
      "nursery",
      "nurseryRegistered",
      "nurseryFee",
      "workActive",
      "otherWorkActive",
      "contributionPercent",
      "otherContributionPercent",
      "preferentialContributions",
      "otherPreferentialContributions",
    ].includes(field);
    const v = a.read<unknown>(
      field,
      fact,
      { kind: "assessment", assessmentId: assessment.id, field },
      periodRequired || (fact?.state === "confirmed" && fact.validTime.kind !== "undated")
        ? day
        : undefined,
    );
    if (v === undefined) continue;
    if (field === "receivesMaternity" && v === false && target.subject.kind !== "family") {
      a.omit(field, "family-scope");
      continue;
    }
    if ((field.startsWith("other") || field === "otherWorkActive") && !target.relatedPersonId) {
      a.omit(field, "subject");
      continue;
    }
    Object.assign(value, { [field]: v });
  }
  // Missing deadline anchors are not necessarily missing eligibility conditions.
  const procedure = procedures.find(({ id }) => id === procedureId);
  for (const deadline of procedure?.deadlines ?? [])
    if (deadline.rule.type === "offset" && value[deadline.rule.field] === undefined)
      a.omit(deadline.rule.field, "missing");
  return { value, omitted: a.omitted, assumptions: a.assumptions, dependencies: a.dependencies };
}

export function toCaseFacts(
  s: InterviewSession,
  assessmentId: AssessmentId,
): Projection<CaseFacts> {
  const a = audit();
  const value: CaseFacts = {};
  const matches = s.assessments.filter(({ id }) => id === assessmentId);
  const assessment = matches.length === 1 ? matches[0] : undefined;
  a.select({ kind: "assessment", assessmentId, field: "target" }, assessment?.target);
  if (!assessment || assessment.kind !== "calculator") {
    a.omit("assessment", "invalid-target");
    return a.result(value);
  }
  const c = context(s, assessment.target, a);
  if (!c || !c.person) {
    a.omit("subject", "subject");
    return a.result(value);
  }
  a.select({ kind: "assessment", assessmentId, field: "state" }, assessment.state);
  a.select(
    { kind: "assessment", assessmentId, field: "configuration" },
    { benefit: assessment.benefit, asOf: assessment.asOf, goal: assessment.goal },
  );
  if (assessment.state === "stale") {
    a.omit("assessment", "stale");
    return a.result(value);
  }
  const { person, title, children } = c;
  const day = assessment.asOf;
  const route = projectionRoute(s);
  const routes: readonly string[] = calculatorTools[assessment.benefit].routes;
  if (!routes.includes(route)) {
    a.omit("assessment", "unsupported-scope");
    return a.result(value);
  }
  const birthingBenefit =
    [
      "maternity",
      "sickness",
      "rehabilitation",
      "pregnancyAfterEmployment",
      "lossMaternity",
    ].includes(assessment.benefit) &&
    route !== "adoption" &&
    route !== "foster";
  if (
    !person.roles.length ||
    (birthingBenefit && !person.roles.includes("birthing")) ||
    (["paternity", "maternityTransfer", "adoptivePaternity"].includes(assessment.benefit) &&
      !person.roles.includes("otherParent"))
  ) {
    a.omit("subject", "subject");
    return a.result(value);
  }
  const familyRef = { kind: "family", eventId: assessment.target.eventId } as const;
  value.birth = birthDate(children, day, a);
  value.dueDate = a.read(
    "dueDate",
    s.family.dueDate,
    { ...familyRef, field: "dueDate" },
    undefined,
    true,
  );
  value.children = a.read(
    "children",
    s.family.childrenCount,
    {
      ...familyRef,
      field: "childrenCount",
    },
    undefined,
    observed(s.family.stage) === "pregnant",
  );
  const stage = observed(s.family.stage);
  const plannedStart = observed(assessment.details.from);
  const forecastDetails =
    (stage === "pregnant" &&
      ["expected", "expectedEarly"].includes(observed(assessment.details.birthStage) ?? "")) ||
    (assessment.benefit !== "maternity" &&
      assessment.forecast === true &&
      Boolean(plannedStart && plannedStart > day));
  if (stage === "pregnant" && value.birth) {
    delete value.birth;
    a.omit("birth", "conflict");
  }
  for (const key of [
    "careKind",
    "courtApplication",
    "adoptionFinal",
    "careAccepted",
    "sameCareAgeLimit",
    "survivingChildren",
  ] as const) {
    const v = a.read<unknown>(key, s.family.eventFacts[key], {
      ...familyRef,
      field: `eventFacts.${key}`,
    });
    if (v !== undefined) Object.assign(value, { [key]: v });
  }
  for (const key of Object.keys(caseFactOwnership) as FactKey[]) {
    if (caseFactOwnership[key] !== "calculation") continue;
    const field = key as keyof typeof assessment.details;
    const fact = assessment.details[field];
    // Money is checked against the engine's coverage day below. Other details
    // belong solely to this assessment, never to a neighbouring calculation.
    const v = a.read<unknown>(
      key,
      fact,
      { kind: "assessment", assessmentId, field: key },
      undefined,
      forecastDetails,
    );
    if (v !== undefined) Object.assign(value, { [key]: v });
  }
  if (stage !== "pregnant") {
    delete value.dueDate;
    if (value.birthStage === "expected" || value.birthStage === "expectedEarly") {
      delete value.birthStage;
      a.omit("birthStage", "conflict");
    }
  } else if (value.birthStage !== "expected" && value.birthStage !== "expectedEarly") {
    delete value.dueDate;
    a.omit("birthStage", "missing");
  }
  if (children.length === 1) {
    const child = children[0];
    for (const [key, field] of [
      ["childDeath", "death"],
      ["schoolDeferral", "schoolDeferral"],
      ["gestationalWeeks", "gestationalWeeks"],
      ["birthWeightGrams", "birthWeightGrams"],
    ] as const) {
      const v = a.read<unknown>(key, child[field], { kind: "child", childId: child.id, field });
      if (v !== undefined) Object.assign(value, { [key]: v });
    }
    value.careCertificate = a.read("careCertificate", child.facts.zaZyciemCertificate, {
      kind: "child",
      childId: child.id,
      field: "zaZyciemCertificate",
    });
    const stays = a.read("hospitalRanges", child.hospitalStays, {
      kind: "child",
      childId: child.id,
      field: "hospitalStays",
    });
    if (!stays?.length && child.hospitalStayDraft) {
      value.hospitalFrom = a.read("hospitalFrom", child.hospitalStayDraft.from, {
        kind: "child",
        childId: child.id,
        field: "hospitalStayDraft",
      });
      value.hospitalThrough = a.read("hospitalThrough", child.hospitalStayDraft.through, {
        kind: "child",
        childId: child.id,
        field: "hospitalStayDraft",
      });
    }
    if (stays?.length && completedStays([...stays], day))
      value.hospitalRanges = stays.map(({ from, through }) => `${from}/${through}`).join(", ");
    else if (stays) a.omit("hospitalRanges", "outside-period");
  } else if (children.length > 1) {
    const careChildren = children.map((child) => ({
      birth: a.read("careChildren", child.birth, {
        kind: "child",
        childId: child.id,
        field: "birth",
      }),
      schoolDeferral: a.read("careChildren", child.schoolDeferral, {
        kind: "child",
        childId: child.id,
        field: "schoolDeferral",
      }),
    }));
    if (
      careChildren.every(
        (child): child is { birth: ISODate; schoolDeferral: boolean } =>
          child.birth !== undefined && child.schoolDeferral !== undefined,
      )
    )
      value.careChildren = careChildren;
    a.omit("hospitalRanges", "unsupported-scope");
  }
  if (
    [
      "motherInsured",
      "motherDaysAfterBirth",
      "motherDaysBeforeBirth",
      "motherJobPercent",
      "motherJobEnds",
    ].some((key) => value[key as FactKey] !== undefined)
  ) {
    const related = s.persons.find(({ id }) => id === assessment.target.relatedPersonId);
    if (related) a.select({ kind: "person", personId: related.id, field: "roles" }, related.roles);
    if (!related?.roles.includes("birthing")) {
      for (const field of [
        "motherInsured",
        "motherDaysAfterBirth",
        "motherDaysBeforeBirth",
        "motherJobPercent",
        "motherJobEnds",
      ] as const) {
        delete value[field];
        a.omit(field, "subject");
      }
    }
  }
  if (title) {
    value.employmentEnded = a.read("employmentEnded", title.ended, {
      kind: "title",
      personId: person.id,
      titleId: title.id,
      field: "ended",
    });
    value.employmentPercent = a.read("employmentPercent", title.employmentPercent, {
      kind: "title",
      personId: person.id,
      titleId: title.id,
      field: "employmentPercent",
    });
  }
  for (const [field, personId, period] of [
    ["usedDays", person.id, "parental"],
    ["otherParentDays", assessment.target.relatedPersonId, "parental"],
    ["paternityUsed", person.id, "paternity"],
  ] as const) {
    const entries = s.usage.filter(
      (u) =>
        u.personId === personId && u.eventId === assessment.target.eventId && u.period === period,
    );
    a.select(
      {
        kind: "usage",
        eventId: assessment.target.eventId,
        personId,
        field: period === "parental" ? "usedDays" : "paternityUsed",
      },
      entries.map((entry) => ({ personId: entry.personId, period: entry.period })),
    );
    if (entries.length !== 1) {
      a.omit(field, entries.length ? "conflict" : "missing");
      continue;
    }
    const entry = entries[0];
    const fact = entry.period === "parental" ? entry.usedDays : entry.paternityUsed;
    const v = a.read<unknown>(
      field,
      fact,
      {
        kind: "usage",
        personId,
        eventId: assessment.target.eventId,
        field: period === "parental" ? "usedDays" : "paternityUsed",
      },
      fact?.state === "confirmed" && fact.validTime.kind !== "undated" ? day : undefined,
    );
    if (v !== undefined) Object.assign(value, { [field]: v });
  }
  value.parts = a.read(
    "parts",
    s.parentalParts,
    {
      kind: "usage",
      eventId: assessment.target.eventId,
      field: "parts",
    },
    s.parentalParts?.state === "confirmed" && s.parentalParts.validTime.kind !== "undated"
      ? day
      : undefined,
  );

  // Probe only for coverageDay; this provisional input/result is never exposed.
  // Some branches require employment before they can report the day.
  const provisional = observed(title?.employment);
  const probe = assessBenefit(assessment.benefit, { ...value, employment: provisional }, day);
  const coverageDay = probe.coverageDay ? isoDateSchema.parse(probe.coverageDay) : undefined;
  if (coverageDay) value.employment = employment(person, title, coverageDay, a, "employment", true);
  else a.omit("employment", "coverage-day");
  const forecast =
    (probe.projected === true && stage === "pregnant") ||
    (assessment.forecast === true && Boolean(coverageDay && coverageDay > day));
  if (
    value.employmentPercent !== undefined &&
    title?.employmentPercent?.state === "confirmed" &&
    (!coverageDay || !timeContains(title.employmentPercent.validTime, coverageDay))
  ) {
    delete value.employmentPercent;
    a.omit("employmentPercent", "outside-period");
  }
  value.insured = coverage(person, title, coverageDay, a, "insured", forecast);
  for (const key of [
    "basis",
    "fixedSalary",
    "debt",
    "rehabSickBasis",
    "payer",
    "insuredHeadcount",
  ] as const) {
    if (value[key] === undefined) continue;
    const fact = assessment.details[key];
    const valid =
      fact?.state === "confirmed" &&
      title &&
      coverageDay &&
      timeContains(fact.validTime, coverageDay) &&
      (!(key === "basis" || key === "fixedSalary" || key === "rehabSickBasis") ||
        !value.through ||
        timeContains(fact.validTime, isoDateSchema.parse(value.through)));
    if (!valid) {
      delete value[key];
      a.omit(key, "outside-period");
    }
  }
  // Dated declarations about mutable conditions must cover the same legal day.
  // Undated calculation choices (e.g. requested rate or duration) stay local to
  // this exact assessment and are never reused in another one.
  for (const key of [
    "qualifying",
    "qualifyingDays",
    "waitingException",
    "pregnancyProof",
    "postInsuranceExcluded",
    "rehabMedical",
    "rehabExcluded",
    "sickPeriodExhausted",
    "alternativeEmployment",
    "personalCare",
    "motherInsured",
    "motherJobPercent",
  ] as const) {
    const fact = assessment.details[key];
    if (
      value[key] !== undefined &&
      fact?.state === "confirmed" &&
      fact.validTime.kind !== "undated" &&
      (!coverageDay || !timeContains(fact.validTime, coverageDay))
    ) {
      delete value[key];
      a.omit(key, "outside-period");
    }
  }
  const checked = assessBenefit(assessment.benefit, value, day);
  // Later incomplete/review results in the existing engine sometimes omit
  // coverageDay. Re-probe at its insurance gate instead of treating that omission
  // as a different day (which would discard valid facts after every next question).
  const verifiedDay = assessBenefit(
    assessment.benefit,
    { ...value, insured: undefined },
    day,
  ).coverageDay;
  if (
    value.insured !== undefined &&
    (verifiedDay !== probe.coverageDay ||
      (checked.coverageDay !== undefined && checked.coverageDay !== probe.coverageDay))
  ) {
    for (const field of [
      "insured",
      "employment",
      "employmentPercent",
      "basis",
      "fixedSalary",
      "debt",
      "rehabSickBasis",
      "payer",
      "insuredHeadcount",
    ] as const) {
      delete value[field];
      a.omit(field, "coverage-day");
    }
  }
  if (checked.missing) a.omit(checked.missing, "missing");
  // Validate units/ranges with the unchanged calculator contract, dropping no
  // malformed field silently. The canonical facts themselves are never edited.
  for (const key of Object.keys(value) as FactKey[]) {
    if (value[key] === undefined) {
      delete value[key];
      continue;
    }
    if (!casePatchSchema.safeParse({ [key]: value[key] }).success) {
      delete value[key];
      a.omit(key, "conflict");
    }
  }
  return { value, omitted: a.omitted, assumptions: a.assumptions, dependencies: a.dependencies };
}
