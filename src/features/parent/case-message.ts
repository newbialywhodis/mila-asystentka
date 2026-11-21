import { daysBetween, parseDate } from "../../engine/dates";
import { benefits, casePatchSchema } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey } from "../../engine/parent-case";
import { normalizeGuideText } from "../guide/textInput";
import { periodLengthPattern, readCaseDate, readPeriodLength } from "./case-fields";
import type { CaseGoal } from "./parent-intent";

export type CaseRequest = { benefit: Benefit; goal?: CaseGoal; facts: CaseFacts };
type CaseContext = { asOf: string; benefit?: Benefit | null; pending?: FactKey };

const applicationLead =
  /^(?:jakie dokumenty(?: sa potrzebne| mam przygotowac)?|jakich dokumentow potrzebuje|co (?:musze )?zlozyc|(?:gdzie|jak) (?:mam )?(?:zlozyc|wypelnic) wniosek|chce (?:zlozyc|przygotowac) wniosek) /;
const planningLead =
  /^(?:chce|chcialbym|chcialabym|zamierzam|planuje)(?: jednak)?(?: wziac| wykorzystac| (?:isc|pojsc) na| skorzystac z| sprawdzic| policzyc| obliczyc| wyliczyc| dostac)? /;
const calculationLead =
  /^(?:poprosze|sprawdz(?: mi)?|policz(?: mi)?|oblicz(?: mi)?|zacznij(?:my)?(?: jednak)?|jednak|mam(?= (?:l-?4|zwolnienie)\b)) /;
const personalQuestionLead =
  /^(?:ile (?:dostane|otrzymam)|czy (?:moge wziac|przysluguje mi|mam prawo do)) /;

const benefitNames: Record<Benefit, RegExp> = {
  maternity: /^macierzynsk(?:i|iego|im|ie)$/,
  paternity: /^ojcowsk(?:i|iego|im|ie)$/,
  parental: /^rodzicielsk(?:i|iego|im|ie)$/,
  supplement: /^uzupelniajac(?:y|ego|ym|e) (?:urlop(?:u|ie)? )?macierzynsk(?:i|iego|im|ie)$/,
  sickness: /^(?:chorobow(?:y|ego|ym|e)|l-?4|zwolnieni(?:e|u)(?: lekarski(?:e|m))?) w ciazy$/,
  rehabilitation: /^(?:swiadczeni(?:e|a|u) )?rehabilitacyjn(?:e|ego|ym)(?: w ciazy)?$/,
  careMaternity:
    /^(?:adopcyjn(?:y|ego|ym|e)|(?:macierzynsk(?:i|iego|im|ie) )?po (?:adopcji|przysposobieniu|przyjeciu dziecka na wychowanie))$/,
  lossMaternity: /^(?:macierzynsk(?:i|iego|im|ie) )?po martwym urodzeniu$/,
};

const dateLiteral =
  "(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{4}|\\d{1,2} [a-z]+(?: \\d{4}(?: r\\.?| roku)?)?)";
const datedPeriod = new RegExp("\\bod (" + dateLiteral + ")(?: do (" + dateLiteral + "))?(?= |$)");
const lengthAtStart = new RegExp(
  "^(?:za |na |o |przez )?(?:kolejny |kolejne )?(" + periodLengthPattern + ")(?: |$)",
);
const lengthAtEnd = new RegExp("(?:^| )(?:na |przez |za )?(" + periodLengthPattern + ")$");
const needsPeriod = new Set<Benefit>(["paternity", "parental", "sickness", "rehabilitation"]);

export function readCaseRequest(input: string, context: CaseContext): CaseRequest | undefined {
  const text = normalizeGuideText(input)
    .replace(/[.!?]+$/, "")
    .replace(/\s*,\s*/g, " ")
    .trim();
  const pregnancyLeave = text.match(
    /^jestem w ciazy(?:\.| i)? mam (?:l-?4|zwolnienie(?: lekarskie)?)\b/,
  );
  const message = pregnancyLeave ? "l4 w ciazy" + text.slice(pregnancyLeave[0].length) : text;
  const application = message.match(applicationLead);
  const calculation =
    message.match(planningLead) ??
    message.match(calculationLead) ??
    message.match(personalQuestionLead);
  const lead = application ?? calculation;
  const request = message.slice(lead?.[0].length ?? 0);

  const dates = request.match(datedPeriod);
  const from = dates ? readCaseDate(dates[1], context.asOf) : undefined;
  const through = dates?.[2] && readCaseDate(dates[2], from && from.slice(0, 7) + "-01");
  if (dates && (!from || (dates[2] && (!through || through < from)))) return;

  const undated = dates ? request.replace(dates[0], "").trim() : request;
  const length = undated.match(lengthAtStart) ?? undated.match(lengthAtEnd);
  const subject = length ? undated.replace(length[0], "").trim() : undated;
  const name = subject
    .replace(/^(?:za|na|o|do|z|dla) /, "")
    .replace(/^zasil(?:ek|ku|kiem) (?:macierzynski (?=za ))?(?:za (?:okres )?)?/, "")
    .replace(/^urlop(?:u|ie|em)? /, "");
  const namedBenefit = benefits.find((benefit) => benefitNames[benefit].test(name));
  const periodReply = context.pending === "from" || context.pending === "through";
  const usesCurrentBenefit = !subject && (lead || periodReply) && (length || dates);
  const benefit = namedBenefit ?? (usesCurrentBenefit ? context.benefit : undefined);
  if (!benefit || (length && !needsPeriod.has(benefit))) return;

  const requestedDays = length && readPeriodLength(length[1]);
  if (requestedDays && from && through) {
    const first = parseDate(from);
    const last = parseDate(through);
    if (first && last && daysBetween(first, last) + 1 !== requestedDays) return;
  }
  const facts = casePatchSchema.safeParse({
    ...(from ? { from } : {}),
    ...(through ? { through } : length ? { requestedDays } : {}),
  });
  if (!facts.success) return;
  const goal = application
    ? "application"
    : calculation && namedBenefit
      ? "calculation"
      : undefined;
  return { benefit, goal, facts: facts.data };
}
