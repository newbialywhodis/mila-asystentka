import { normalizeNumericDate, parseDate } from "../../engine/dates";
import type { Benefit, CaseFacts } from "../../engine/parent-case";
import { normalizeGuideText } from "../guide/textInput";
import { validateDocumentRead } from "./case-documents";
import type { DocumentApplication, DocumentCandidate, DocumentRead } from "./case-documents";

export type ScanPage = { number: number; text: string; sparse?: string };

type Application = {
  page: number;
  benefit: Benefit | null;
  from?: string;
  through?: string;
};
export type ScanReference = { page: number; label: string };
const decisionWords =
  /\b(?:decyzj\w*|rozstrzygnieci\w*|przyznano|odmowiono|wyplacono|przyznajaca|odmawiajaca)\b/;

const numericDate = String.raw`\b(?:20\d{2}[ \t./-]+\d{1,2}[ \t./-]+\d{1,2}|\d{1,2}[ \t./-]+\d{1,2}[ \t./-]+20\d{2})\b`;
const datePattern = new RegExp(numericDate, "g");
const fromThrough = new RegExp(
  String.raw`\bod[\s:.]+(?:dnia\s+)?(${numericDate})[\s,]+do[\s:.]+(?:dnia\s+)?(${numericDate})`,
);
const printedPeriod = new RegExp(
  String.raw`^[ \t]*(${numericDate})[ \t]*[-–—][ \t]*(${numericDate})\.?[ \t]*$`,
  "m",
);

function datesIn(text: string) {
  return [...text.matchAll(datePattern)].flatMap(([value]) => {
    const parts = value.split(/[ \t./-]+/);
    const [a, b, c] = parts;
    const iso =
      a.length === 4
        ? `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`
        : normalizeNumericDate(parts.join("-"));
    return iso && parseDate(iso) ? [iso] : [];
  });
}

function unique<T>(values: T[]) {
  const set = new Set(values);
  return set.size === 1 ? values[0] : undefined;
}

function periodIn(text: string, allowPrintedPeriod = false) {
  const interval = fromThrough.exec(text) ?? (allowPrintedPeriod ? printedPeriod.exec(text) : null);
  if (!interval) return;
  const [from] = datesIn(interval[1]);
  const [through] = datesIn(interval[2]);
  if (from && through && from <= through)
    return { from, through, context: text.slice(0, interval.index) };
}

function benefitIn(text: string): Benefit | null {
  if (/uzupelniajac\w* (?:urlop|macierzynsk)/.test(text)) return "supplement";
  if (/ojcowsk/.test(text)) return "paternity";
  if (/rodzicielsk/.test(text)) return "parental";
  if (/urlop\w* macierzynsk/.test(text)) return "maternity";
  if (/zasil\w* chorobow/.test(text)) return "sickness";
  return null;
}

function pageHeader(text: string) {
  return text.split("\n").filter(Boolean).slice(0, 18).join(" ");
}

function dedicatedForm(text: string) {
  const header = pageHeader(text).slice(0, 160);
  return /\bzao\b|\bwniosek o zasilek macierzynski za okres urlopu ojcowsk/.test(header)
    ? "paternity"
    : /\bzur\b|\bwniosek o zasilek macierzynski za okres urlopu rodzicielsk/.test(header)
      ? "parental"
      : null;
}

function applicationsOn(page: ScanPage): Application[] {
  const header = pageHeader(page.text);
  if (
    isCoverageReply(header) ||
    /wniosek o poswiadczenie ubezpieczenia/.test(header) ||
    decisionWords.test(header.slice(0, 160))
  )
    return [];
  const formBenefit = dedicatedForm(page.text);
  const checkedBenefits = [...page.text.matchAll(/(?:\[\s*x\s*\]|☒|☑)\s*([^\n]+)/gi)]
    .map(([, line]) => benefitIn(line))
    .filter((benefit) => benefit !== null);
  const requests: Application[] = [];
  const fields = page.text
    .split(/\b(?:wnioskuj[ea]\s+o|wnosze\s+o|prosze\s+o\s+wyplate|wnioskowany okres)\b/)
    .slice(1);
  for (const field of fields) {
    const period = periodIn(field.slice(0, 190), formBenefit !== null);
    if (!period) continue;
    const { from, through, context } = period;
    const benefit = formBenefit ?? benefitIn(context) ?? unique(checkedBenefits) ?? null;
    requests.push({ page: page.number, from, through, benefit });
  }
  if (requests.length) return requests;

  // These forms have a unique purpose even when the filled dates are unreadable.
  if (!formBenefit || (!startsDedicatedForm(page.text) && !hasRequestScope(page.text))) return [];
  for (const text of [page.text, page.sparse].filter((value) => value !== undefined)) {
    const clause = text.match(/\b(?:zakres wniosku|wnioskuje\s+o|prosze\s+o)\b([\s\S]{0,200})/);
    const period = clause && periodIn(clause[1], true);
    if (period)
      return [
        { page: page.number, benefit: formBenefit, from: period.from, through: period.through },
      ];
  }
  return [{ page: page.number, benefit: formBenefit }];
}

function startsDedicatedForm(text: string) {
  return (
    /\bstrona\s*1\s*z\s*[2-9]\b/.test(text.slice(-240)) ||
    /\bwniosek o zasilek macierzynski za okres urlopu (?:ojcowsk|rodzicielsk)/.test(
      pageHeader(text).slice(0, 160),
    ) ||
    (/\bwniosek\b/.test(pageHeader(text).slice(0, 160)) &&
      /\b(?:twoje dane|dane wnioskodawcy|dane platnika skladek)\b/.test(text))
  );
}

function hasRequestScope(text: string) {
  return /\bzakres wniosku\b/.test(text.slice(0, 350));
}

function isContinuation(previous: ScanPage, current: ScanPage) {
  const form = dedicatedForm(previous.text);
  if (!form || previous.number + 1 !== current.number || form !== dedicatedForm(current.text))
    return false;
  return (
    startsDedicatedForm(previous.text) &&
    !startsDedicatedForm(current.text) &&
    hasRequestScope(current.text)
  );
}

export function isBirthRecord(text: string) {
  return /\bodpis\b[^\n]{0,25}\baktu urodzenia\b/.test(text);
}

function birthOn(text: string, birthRecord = false) {
  // On applications the same unqualified label can refer to the applicant or payer.
  const label = birthRecord ? "data urodzenia(?: dziecka)?" : "data urodzenia dziecka";
  const matches = [
    ...text.matchAll(
      new RegExp(String.raw`\b${label}\b[ \t]*[:.-]?[ \t]*([^\n]*)(?:\n([\d./ -]+)(?=\n|$))?`, "g"),
    ),
  ];
  const labeled = matches.flatMap(([, line, below]) => datesIn(line || below || ""));
  if (labeled.length || !birthRecord || !isBirthRecord(text.slice(0, 180))) return unique(labeled);
  // The place field follows the child's date on a shortened birth certificate.
  // Sparse OCR can retain the value on its own line while dropping its label.
  const beforePlace = text.slice(0, 600).match(/(?:^|\n)([\d. /-]+)\n\s*miejsce urodze\w*/);
  return beforePlace ? unique(datesIn(beforePlace[1])) : undefined;
}

function employmentOn(text: string): CaseFacts["employment"] {
  const phrase = text.match(/\b(?:tytul(?: ubezpieczenia)?|zatrudnienie)\s*:\s*([^\n]+)/)?.[1];
  if (!phrase) return;
  if (/\bumow\w* o prac/.test(phrase)) return "employee";
  if (/\bumow\w* zlecen/.test(phrase)) return "contract";
  if (/\bosob\w* wspolprac/.test(phrase)) return "collaborator";
  if (/\bdzialalnos\w*/.test(phrase)) return "business";
}

function isCoverageReply(text: string) {
  return /\bodpowiedz\s+na\s+wniosek\b[\s\S]{0,85}\b(?:poswiadcz\w*|potwierdz\w*)\s+ubezpieczen/.test(
    text,
  );
}

function decisionOn({ number, text }: ScanPage): DocumentRead["decisions"][number] | undefined {
  const order = text.match(
    /^decyzja\b[\s\S]{0,900}?\bpostanawia\s*:(?:\s*postanawia\s*:)?\s*[-–—]?\s*((?:przyznac (?:zasilek|prawo do zasilku)|odmowic (?:prawa do|przyznania|wyplaty) zasilku|wyplacic zasilek)\b[^\n]*(?:\n[^\n]+)?)/m,
  )?.[1];
  const refused =
    Boolean(order?.startsWith("odmowic")) ||
    /^(?:w sprawie )?odmowiono (?:prawa do )?zasilku\b|^zostala wydana decyzja odmawiajaca prawa do zasilku\b/m.test(
      text,
    );
  const granted =
    Boolean(order?.startsWith("przyznac")) ||
    /^(?:w sprawie )?przyznano zasilek\b|^zasilek przyznano[.!]?$/m.test(text);
  const paid =
    Boolean(order?.startsWith("wyplacic")) ||
    /^(?:w sprawie )?wyplacono zasilek\b|^zasilek wyplacono[.!]?$/m.test(text);
  const statuses: DocumentRead["decisions"][number]["status"][] = [];
  if (refused) statuses.push("refused");
  if (granted) statuses.push("granted");
  if (paid) statuses.push("paid");
  const status = unique(statuses);
  if (!status) return;
  const period = order && periodIn(order);
  return {
    status,
    page: number,
    from: period ? period.from : null,
    through: period ? period.through : null,
  };
}

function scanReferences(
  pages: ScanPage[],
  applicationPages: Set<number>,
  decisionPages: Set<number>,
): ScanReference[] {
  return pages.flatMap(({ number, text, sparse }) => {
    const header = text.slice(0, 350);
    const label =
      isBirthRecord(header) || (sparse && isBirthRecord(sparse.slice(0, 250)))
        ? "Akt urodzenia"
        : /\bpo[ds]wiadcz\w*\s+ubezpieczen|okres podlegania/.test(text)
          ? "Informacja o ubezpieczeniu"
          : /\bskladniki wynagrodzenia|wynagrodzenie miesieczne|podstawa wymiaru zasilku/.test(text)
            ? "Wynagrodzenie lub podstawa"
            : /\b(?:z[ -]+3[ab]?|zas[ -]+12)\b/.test(header)
              ? "Zaświadczenie płatnika"
              : decisionPages.has(number) || decisionWords.test(header.slice(0, 160))
                ? "Rozstrzygnięcie do porównania"
                : applicationPages.has(number)
                  ? "Wniosek o świadczenie"
                  : undefined;
    return label ? [{ page: number, label }] : [];
  });
}

function insuranceOn(text: string, day: string) {
  if (!isCoverageReply(text)) return;
  const statements = text.split("\n").flatMap((line) => {
    const scope = line.match(/\b(?:w dniu|na dzien)\s+([^\n]+)/)?.[1];
    if (!scope || unique(datesIn(scope)) !== day) return [];
    if (
      /\bnie\s+(?:(?:zostal\w*|byl\w*|jest)\s+obj\w*|podleg\w*)\s+ubezpieczen\w*\s+chorobow/.test(
        line,
      )
    )
      return [false];
    if (
      /\b(?:podlegal\w* ubezpieczeniu|(?:byl\w*|zostal\w*|jest) objet\w* ubezpieczeniem) chorobow/.test(
        line,
      )
    )
      return [true];
    return [];
  });
  return unique(statements);
}

function noVoluntaryRegistrationOn(text: string, day: string) {
  if (!isCoverageReply(text)) return false;
  const dateOfCheck = text.match(/\bna date badania,?\s*tj\.?\s*([^\n]+)/)?.[1];
  return (
    Boolean(dateOfCheck && unique(datesIn(dateOfCheck)) === day) &&
    /^notatka ubs\s*\n\s*brak zgloszenia do dobrowolnego ubezpieczenia chorobowego[.!]?$/m.test(
      text,
    )
  );
}

function isContractCoverageRequest(text: string, app?: Application) {
  if (
    !app?.from ||
    !app.through ||
    isCoverageReply(text) ||
    !/\bwniosek o poswiadczenie ubezpieczenia chorobowego\b/.test(text) ||
    !/\btytulu\s+04\s*11\b/.test(text)
  )
    return false;
  const dates = datesIn(text);
  return dates.includes(app.from) && dates.includes(app.through);
}

function hasMatchingClaimPeriod(text: string, app: Application | undefined) {
  const claim = text.match(/\broszczeni\w* o [^\n]{1,90}\bza okres\s*:?([^\n]*)/)?.[1];
  const period = claim && periodIn(claim.trim(), true);
  return Boolean(period && period.from === app?.from && period.through === app.through);
}

function basisOn(text: string) {
  const matches = text.matchAll(
    /\b(?:ustalona\s+(?:miesieczna\s+)?podstawa|ustalono\s+(?:miesieczna\s+)?podstawe)\s+wymiaru\s+zasilku\s*(?:wynosi\s+|w wysokosci\s+|[:-]\s*)?((?:\d{1,3}(?:[ .]\d{3})+|\d{1,12}))[,.](\d{2})\s*(?:zl\b|pln\b)/g,
  );
  return unique(
    [...matches].map(
      ([, amount, cents]) => Number(amount.replace(/[ .]/g, "")) * 100 + Number(cents),
    ),
  );
}

export function readScanPages(rawPages: ScanPage[]): {
  applications: DocumentApplication[];
  fallback: DocumentRead;
  references: ScanReference[];
} {
  const normalizeLines = (text: string) => text.split("\n").map(normalizeGuideText).join("\n");
  const pages = rawPages.map(({ number, text, sparse }) => ({
    number,
    text: normalizeLines(text),
    sparse: sparse ? normalizeLines(sparse) : undefined,
  }));
  const byPage = pages.map((page) =>
    applicationsOn(page).filter(
      (app, index, samePage) =>
        samePage.findIndex(
          (other) =>
            other.benefit === app.benefit &&
            other.from === app.from &&
            other.through === app.through,
        ) === index,
    ),
  );
  const continued = new Set<Application>();
  for (let index = 1; index < pages.length; index++) {
    const first = byPage[index - 1];
    const second = byPage[index];
    if (
      first.length !== 1 ||
      second.length !== 1 ||
      !isContinuation(pages[index - 1], pages[index])
    )
      continue;
    const [start] = first;
    const [end] = second;
    if (start.benefit !== end.benefit) continue;
    if (start.from && end.from && (start.from !== end.from || start.through !== end.through))
      continue;
    continued.add(start.from && !end.from ? end : start);
  }
  const applications = byPage.flat().filter((app) => !continued.has(app));
  const decisions = pages
    .flatMap((page) => {
      const decision = decisionOn(page);
      return decision ? [decision] : [];
    })
    .slice(0, 12);

  function evidence(app?: Application): DocumentRead {
    const candidates: DocumentCandidate[] = [];
    const candidate = (
      key: DocumentCandidate["key"],
      value: DocumentCandidate["value"] | undefined,
      page: number,
    ) => {
      if (value !== undefined) candidates.push({ key, value, page });
    };
    const appPage = pages.find(({ number }) => number === app?.page);
    if (app && appPage) {
      candidate("from", app.from, app.page);
      candidate("through", app.through, app.page);
    }
    if (app && appPage && applications.filter(({ page }) => page === app.page).length === 1) {
      candidate("birth", birthOn(appPage.text), app.page);
      candidate("employment", employmentOn(appPage.text), app.page);
      if (
        app.benefit === "paternity" &&
        /(?:dotychczas wykorzystan\w* urlop ojcowski\s*:\s*[0o]\s+tygodni|nie korzystal\w* dotychczas z urlopu ojcowskiego)/.test(
          appPage.text,
        )
      )
        candidate("paternityUsed", "none", app.page);
    }

    // Without a per-person match, supporting pages can be suggested only for a single request.
    if (applications.length <= 1) {
      const contractRequests = new Set<number>();
      for (const { number, text, sparse } of pages) {
        const birthDates = [text, sparse].flatMap((reading) => {
          if (!reading || !isBirthRecord(reading.slice(0, 350))) return [];
          const birth = birthOn(reading, true);
          return birth ? [birth] : [];
        });
        candidate("birth", unique(birthDates), number);
        if (isCoverageReply(text)) candidate("employment", employmentOn(text), number);
        if (isContractCoverageRequest(text, app)) {
          if (hasMatchingClaimPeriod(text, app)) contractRequests.add(number);
          candidate("employment", "contract", number);
        }
        if (!decisionWords.test(text)) {
          candidate("basis", basisOn(text), number);
          const payer = text.match(/\bplatnik zasilku\s*:\s*([^\n]+)/)?.[1];
          if (payer && /\bzus\b|zaklad ubezpieczen spolecznych/.test(payer))
            candidate("payer", "zus", number);
        }
      }
      const day =
        app?.benefit === "maternity"
          ? unique(
              candidates.filter(({ key }) => key === "birth").map(({ value }) => String(value)),
            )
          : app?.benefit
            ? app.from
            : undefined;
      for (const { number, text } of pages) {
        const employment = employmentOn(text);
        if (!day) continue;
        const insured = employment ? insuranceOn(text, day) : undefined;
        const absentRegistration =
          (!employment || employment === "contract") &&
          contractRequests.has(number - 1) &&
          noVoluntaryRegistrationOn(text, day);
        if (absentRegistration && insured !== true) {
          candidates.push({
            key: "insured",
            value: false,
            page: number,
            coverage: { day, employment: "contract" },
          });
        } else if (!absentRegistration && employment && insured !== undefined) {
          candidates.push({
            key: "insured",
            value: insured,
            page: number,
            coverage: { day, employment },
          });
        }
      }
    }

    return (
      validateDocumentRead({
        kind: app ? "application" : decisions.length && !candidates.length ? "decision" : "other",
        requestedBenefit: app?.benefit ?? null,
        candidates: candidates.slice(0, 48),
        decisions,
      }) ?? { kind: "other", requestedBenefit: null, candidates: [], decisions: [] }
    );
  }

  return {
    applications: applications.map((app) => ({ page: app.page, read: evidence(app) })),
    fallback: evidence(),
    references: scanReferences(
      pages,
      new Set(byPage.flat().map(({ page }) => page)),
      new Set(decisions.map(({ page }) => page)),
    ),
  };
}
