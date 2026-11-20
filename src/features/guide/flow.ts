import { questions } from "../../data/questions";
import { addDays, isoDate, parseDate } from "../../engine/dates";
import type { Profile } from "../../types/profile";
import type { IconName } from "../../components/ui/Icon";

const periods = {
  early: { label: "I trymestr", detail: "1–12. tydzień" },
  middle: { label: "II trymestr", detail: "13–27. tydzień" },
  late: { label: "III trymestr", detail: "Od 28. tygodnia" },
};

export const planInterests = [
  { value: "benefits", label: "Świadczenia finansowe" },
  { value: "leave", label: "Urlopy dla rodziców" },
  { value: "registration", label: "Formalności po porodzie" },
  { value: "support", label: "Wsparcie dla rodziców" },
] as const;

export type PlanInterest = (typeof planInterests)[number]["value"];
export type Period = keyof typeof periods;
export type QuestionId =
  | "stage"
  | "planInterests"
  | "pregnancyTiming"
  | "birthDate"
  | "employment"
  | "sicknessLeave"
  | "sicknessInsurance"
  | "medicalCareWeek10"
  | "standardResidence"
  | "birthRegistered"
  | "birthCardDate"
  | "healthRegistered";

export type Answer = string | boolean | readonly PlanInterest[] | null;
export type Answers = Partial<Record<QuestionId, Answer>>;

export type Option = { label: string; value: string | boolean; icon?: IconName; detail?: string };
type GuideQuestion = { label: string; hint?: string } & (
  | { input: "choice"; options: readonly Option[] }
  | { input: "timing"; options: readonly (Option & { detail: string })[] }
  | { input: "multi"; options: typeof planInterests }
  | { input: "date" }
);

export const guideQuestions: Record<QuestionId, GuideQuestion> = {
  stage: {
    ...questions.stage,
    options: [
      { ...questions.stage.options[0], icon: "pregnant" },
      { label: "Planuję ciążę", value: "planning", icon: "calendar" },
      { label: "Moje dziecko już się urodziło", value: "born", icon: "baby" },
    ],
  },
  planInterests: {
    label: "Co chcesz uwzględnić w planie?",
    hint: "Możesz wybrać kilka tematów.",
    input: "multi",
    options: planInterests,
  },
  pregnancyTiming: {
    label: "Na jakim etapie ciąży jesteś?",
    input: "timing",
    options: Object.entries(periods).map(([value, period]) => ({ ...period, value })),
  },
  birthDate: { ...questions.birthDate, input: "date" },
  employment: {
    label: "Jaka jest Twoja sytuacja zawodowa?",
    input: "choice",
    options: [
      { label: "Pracuję na etacie", value: "employee", icon: "work" },
      { label: "Mam umowę zlecenie", value: "contract", icon: "contract" },
      { label: "Prowadzę działalność", value: "business", icon: "business" },
      { label: "Inna sytuacja", value: "other", icon: "more" },
    ],
  },
  sicknessLeave: {
    label: questions.sicknessLeave.label,
    input: "choice",
    options: [
      { label: "Tak", value: true },
      { label: "Nie", value: false },
    ],
  },
  sicknessInsurance: {
    label: questions.sicknessInsurance.label,
    hint: questions.sicknessInsurance.hint,
    input: "choice",
    options: [
      { label: "Tak", value: true },
      { label: "Nie", value: false },
    ],
  },
  medicalCareWeek10: {
    label: "Czy jesteś pod opieką medyczną od najpóźniej 10. tygodnia ciąży?",
    hint: "Taka opieka do porodu to jeden z warunków otrzymania becikowego.",
    input: "choice",
    options: [
      { label: "Tak", value: true },
      { label: "Nie", value: false },
    ],
  },
  standardResidence: {
    label: questions.standardResidence.label,
    hint: questions.standardResidence.hint,
    input: "choice",
    options: [
      { label: "Tak", value: true },
      { label: "Nie", value: false },
    ],
  },
  birthRegistered: {
    label: questions.birthRegistered.label,
    input: "choice",
    options: [
      { label: "Tak", value: true },
      { label: "Nie", value: false },
    ],
  },
  birthCardDate: { ...questions.birthCardDate, input: "date" },
  healthRegistered: {
    label: "Czy dziecko jest już zgłoszone do ubezpieczenia zdrowotnego?",
    input: "choice",
    options: [
      { label: "Tak", value: true },
      { label: "Nie", value: false },
    ],
  },
};

export function canSkipQuestion(id: QuestionId) {
  return id !== "stage" && id !== "employment";
}

export function getDateBounds(id: QuestionId, asOf: string, birthDate?: string) {
  const today = parseDate(asOf);
  return {
    min: id === "birthCardDate" && birthDate ? birthDate : "1900-01-01",
    max: id === "pregnancyTiming" && today ? isoDate(addDays(today, 300)) : asOf,
  };
}

export function isGuideDate(value: string, { min, max }: { min: string; max: string }) {
  return Boolean(parseDate(value)) && value >= min && value <= max;
}

export function getQuestionIds(answers: Answers): QuestionId[] {
  if (answers.stage === "planning") return ["stage", "planInterests"];

  if (answers.stage === "born") {
    return [
      "stage",
      "birthDate",
      "employment",
      "birthRegistered",
      answers.birthRegistered === false ? "birthCardDate" : "healthRegistered",
    ];
  }

  let followUp: QuestionId = "standardResidence";
  if (answers.employment === "employee") followUp = "sicknessLeave";
  if (answers.employment === "contract" || answers.employment === "business") {
    followUp = "sicknessInsurance";
  }
  return [
    "stage",
    "pregnancyTiming",
    "employment",
    followUp,
    followUp === "sicknessLeave" && answers.sicknessLeave === true
      ? "sicknessInsurance"
      : "medicalCareWeek10",
  ];
}

export function saveAnswer(answers: Answers, id: QuestionId, value: Answer): Answers {
  if (id === "stage" && value !== answers.stage) return { stage: value };

  const updated = { ...answers, [id]: value };
  if (
    id === "birthDate" &&
    typeof value === "string" &&
    typeof updated.birthCardDate === "string" &&
    updated.birthCardDate < value
  ) {
    delete updated.birthCardDate;
  }
  const nextQuestions = getQuestionIds(updated);
  for (const question of getQuestionIds(answers)) {
    if (!nextQuestions.includes(question)) delete updated[question];
  }
  return updated;
}

function flag(answer: Answer | undefined) {
  return typeof answer === "boolean" ? answer : undefined;
}

function date(answer: Answer | undefined) {
  return typeof answer === "string" && parseDate(answer) ? answer : undefined;
}

export function getProfile(answers: Answers): Profile {
  const { stage, employment } = answers;
  const work =
    employment === "employee" ||
    employment === "contract" ||
    employment === "business" ||
    employment === "other"
      ? employment
      : undefined;

  if (stage === "born") {
    return {
      stage,
      employment: work,
      birthDate: date(answers.birthDate),
      birthRegistered: flag(answers.birthRegistered),
      birthCardDate: date(answers.birthCardDate),
      healthRegistered: flag(answers.healthRegistered),
    };
  }
  if (stage === "pregnant") {
    return {
      stage,
      employment: work,
      dueDate: date(answers.pregnancyTiming),
      sicknessLeave: flag(answers.sicknessLeave),
      sicknessInsurance: flag(answers.sicknessInsurance),
      medicalCareWeek10: flag(answers.medicalCareWeek10),
      standardResidence: flag(answers.standardResidence),
    };
  }
  return {};
}

export function getPeriod(answer: Answer | undefined): Period | undefined {
  if (answer === "early" || answer === "middle" || answer === "late") return answer;
}

export function formatDate(value: string) {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: "UTC" }).format(date)
    : value;
}

export function answerLabel(id: QuestionId, answer: Answer): string {
  if (answer === null) return "Pominięto";
  const question = guideQuestions[id];
  if (question.input === "multi") {
    return question.options
      .filter(({ value }) => typeof answer === "object" && answer.includes(value))
      .map(({ label }) => label)
      .join(", ");
  }
  if (question.input === "timing") {
    const option = question.options.find(({ value }) => value === answer);
    if (option) return `${option.label} · ${option.detail}`;
  }
  if (question.input === "choice") {
    return question.options.find(({ value }) => value === answer)?.label ?? "Pominięto";
  }
  return typeof answer === "string" && parseDate(answer) ? formatDate(answer) : "Pominięto";
}
