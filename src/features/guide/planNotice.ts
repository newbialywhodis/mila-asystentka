import type { Answers } from "./flow";

export const planNotices = {
  planning: "Gotowe! Ułożyłam dla Ciebie plan przygotowań. Możesz przejrzeć go we własnym tempie.",
  pregnant:
    "Gotowe! W Twoim planie znajdziesz sprawy do załatwienia przed porodem i po narodzinach.",
  born: "Gotowe! W Twoim planie znajdziesz terminy, formalności po narodzinach i świadczenia, które warto sprawdzić.",
};

export function getPlanNotice(stage: Answers["stage"]): string {
  return planNotices[stage === "planning" || stage === "pregnant" ? stage : "born"];
}
