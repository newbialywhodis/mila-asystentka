import type { HelpAnswer } from "../guide/helpAnswers";
import { normalizeGuideText } from "../guide/textInput";
import type { CaseReply, FirstStepsTiming, ReplyChoice } from "./parent-intent";

export const replyChoiceLabels: Record<ReplyChoice, string> = {
  beforeBirth: "Co przygotować przed porodem?",
  afterBirth: "Co załatwić po narodzinach?",
  benefit: "Sprawdź świadczenie",
};

export const startingReply: CaseReply = {
  kind: "reply",
  text: "Mogę pomóc Ci zacząć od formalności albo sprawdzić świadczenie. Co Ci się teraz przyda?",
  choices: ["afterBirth", "benefit"],
};

export type PregnancyConcernTurn = { kind: "pregnancyConcern"; text: string };

// https://pacjent.gov.pl/ciaza-co-powinno-cie-niepokoic
// https://www.gov.pl/web/rpp/system-ratownictwa-medycznego
const pregnancyCare =
  "Jeśli masz obfite krwawienie, silny ból brzucha lub czujesz, że możesz zemdleć, dzwoń pod 112. Przy plamieniu, krwawieniu lub bólu brzucha w ciąży skontaktuj się od razu z ginekologiem lub ginekologiczną izbą przyjęć.";

export function pregnancyConcernReply(text: string): PregnancyConcernTurn {
  return { kind: "pregnancyConcern", text: `${text} ${pregnancyCare}` };
}

const firstSteps: Record<FirstStepsTiming, HelpAnswer> = {
  beforeBirth: {
    text: "Przed porodem możesz przygotować dane do zgłoszenia urodzenia i sprawdzić, jak zrobić to online. Warto też ustalić, kto po narodzinach zgłosi dziecko do ubezpieczenia zdrowotnego.",
    sourceIds: ["birth", "health"],
  },
  afterBirth: {
    text: "Zacznij od zgłoszenia urodzenia. Po nadaniu PESEL ustal, kto może zgłosić dziecko do ubezpieczenia zdrowotnego. Możesz też sprawdzić, jak złożyć wniosek o 800+.",
    sourceIds: ["birth", "health", "child800"],
  },
};

export function getFirstSteps(timing: FirstStepsTiming, intro: string): HelpAnswer {
  const answer = firstSteps[timing];
  return intro ? { ...answer, text: `${intro} ${answer.text}` } : answer;
}

export function findFirstSteps(normalized: string): HelpAnswer | undefined {
  for (const choice of ["beforeBirth", "afterBirth"] as const) {
    if (normalized === normalizeGuideText(replyChoiceLabels[choice]).replace(/\?$/, "")) {
      return firstSteps[choice];
    }
  }
}
