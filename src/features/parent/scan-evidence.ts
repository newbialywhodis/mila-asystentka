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

const numericDate =
  /\b(?:20\d{2}[ \t./-]+\d{1,2}[ \t./-]+\d{1,2}|\d{1,2}[ \t./-]+\d{1,2}[ \t./-]+20\d{2})\b/g;

function datesIn(text: string) {
  return [...text.matchAll(numericDate)].flatMap(([value]) => {
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

function benefitIn(text: string): Benefit | null {
  if (/uzupelniajac\w* (?:urlop|macierzynsk)/.test(text)) return "supplement";
  if (/ojcowsk/.test(text)) return "paternity";
  if (/rodzicielsk/.test(text)) return "parental";
  if (/urlop\w* macierzynsk/.test(text)) return "maternity";
  if (/zasil\w* chorobow/.test(text)) return "sickness";
  return null;
}

function applicationsOn(page: ScanPage): Application[] {
  const header = page.text.split("\n").filter(Boolean).slice(0, 18).join(" ");
  if (
    isCoverageReply(header) ||
    /wniosek o poswiadczenie ubezpieczenia|\b(?:decyzja|adnotacja o rozstrzygnieciu)\b/.test(header)
  )
    return [];
  const requests: Application[] = [];
  const fields = page.text.split(/\b(?:wnioskuje\s+o|wnosze\s+o|wnioskowany okres)\b/).slice(1);
  for (const field of fields) {
    const window = field.slice(0, 190);
    const interval = window.match(/\bod[\s:]+([^\n]{4,30}?)\s+do[\s:]+([^\n]{4,32})/);
    const from = interval && datesIn(interval[1])[0];
    const through = interval && datesIn(interval[2])[0];
    if (!from || !through || through < from) continue;
    const context = window.slice(0, interval.index);
    const explicitChoice = page.text.match(/(?:\[\s*x\s*\]|☒|☑)\s*([^\n]+)/i)?.[1];
    const formBenefit = /\bzao\b/.test(header)
      ? "paternity"
      : /\bzur\b/.test(header)
        ? "parental"
        : null;
    const benefit =
      benefitIn(context) ?? (explicitChoice ? benefitIn(explicitChoice) : formBenefit);
    requests.push({ page: page.number, from, through, benefit });
  }
  if (requests.length) return requests;

  // These forms have a unique purpose even when the filled dates are unreadable.
  const benefit =
    /\bzao\b.*\bwniosek\b|\bwniosek o zasilek macierzynski za okres urlopu ojcowsk/.test(header)
      ? "paternity"
      : /\bzur\b.*\bwniosek\b|\bwniosek o zasilek macierzynski za okres urlopu rodzicielsk/.test(
            header,
          )
        ? "parental"
        : null;
  return benefit ? [{ page: page.number, benefit }] : [];
}

export function isBirthRecord(text: string) {
  return /\bodpis\b[^\n]{0,25}\baktu urodzenia\b/.test(text);
}

function birthOn(text: string) {
  const matches = [
    ...text.matchAll(
      /\bdata urodzenia(?: dziecka)?[ \t]*[:.-]?[ \t]*([^\n]*)(?:\n([\d./ -]+)(?=\n|$))?/g,
    ),
  ];
  const labeled = matches.flatMap(([, line, below]) => datesIn(line || below || ""));
  if (labeled.length || !isBirthRecord(text.slice(0, 180))) return unique(labeled);
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

function basisOn(text: string) {
  const matches = text.matchAll(
    /\bustalona\s+(?:miesieczna\s+)?podstawa\s+wymiaru\s+zasilku\s*[:-]?\s*([0-9][0-9 ]{0,11}[,.]\d{2})\s*(?:zl\b|pln\b)/g,
  );
  return unique(
    [...matches].map(([, value]) =>
      Math.round(Number(value.replaceAll(" ", "").replace(",", ".")) * 100),
    ),
  );
}

export function readScanPages(rawPages: ScanPage[]): {
  applications: DocumentApplication[];
  fallback: DocumentRead;
} {
  const normalizeLines = (text: string) => text.split("\n").map(normalizeGuideText).join("\n");
  const pages = rawPages.map(({ number, text, sparse }) => ({
    number,
    text: normalizeLines(text),
    sparse: sparse ? normalizeLines(sparse) : undefined,
  }));
  const recognized = pages.flatMap(applicationsOn);
  const applications = recognized.filter(
    (app, index) =>
      !recognized
        .slice(0, index)
        .some(
          (other) =>
            other.page === app.page &&
            other.benefit === app.benefit &&
            other.from === app.from &&
            other.through === app.through,
        ) &&
      (app.from || !recognized.some((other) => other.from && other.page === app.page)),
  );

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
      for (const { number, text, sparse } of pages) {
        if (isBirthRecord(text)) {
          candidate("birth", birthOn(text) ?? (sparse ? birthOn(sparse) : undefined), number);
        }
        if (isCoverageReply(text)) candidate("employment", employmentOn(text), number);
        if (
          app?.from &&
          app.through &&
          /\bwniosek o poswiadczenie ubezpieczenia/.test(text) &&
          /\btytulu\s+04\s*11\b/.test(text) &&
          datesIn(text).includes(app.from) &&
          datesIn(text).includes(app.through)
        )
          candidate("employment", "contract", number);
        if (!/\b(?:decyzja|rozstrzygniecie|przyznano|odmowiono|wyplacono)\b/.test(text)) {
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
        if (!day || !employment) continue;
        const insured = insuranceOn(text, day);
        if (insured !== undefined)
          candidates.push({
            key: "insured",
            value: insured,
            page: number,
            coverage: { day, employment },
          });
      }
    }

    return (
      validateDocumentRead({
        kind: app ? "application" : "other",
        requestedBenefit: app?.benefit ?? null,
        candidates: candidates.slice(0, 48),
        decisions: [],
      }) ?? { kind: "other", requestedBenefit: null, candidates: [], decisions: [] }
    );
  }

  return {
    applications: applications.map((app) => ({ page: app.page, read: evidence(app) })),
    fallback: evidence(),
  };
}
