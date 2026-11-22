import { addDays, addMonths, daysBetween, isoDate, parseDate } from "./dates";
import { indexedRehabilitationBasis, postInsuranceBasis } from "./benefit-parameters";
import { calculateSupplement } from "./prematurity";
import type { Benefit, CaseFacts, FactKey } from "./parent-case";

type Status = "eligible" | "missing" | "ineligible" | "review";
type BenefitDocument = {
  title: string;
  recipient: string;
  source: string;
  deadline?: string;
  href?: string;
  form?: "leave" | "benefit";
};
export type BenefitResult = {
  status: Status;
  reason: string;
  projected?: true;
  demoParametersApplied?: true;
  missing?: FactKey;
  coverageDay?: string;
  period?: { from: string; through: string; days: number };
  rate?: number;
  maximumDays?: number;
  extensionDays?: number;
  extension?: { through: string; workPercent: number; money?: { daily: number; total: number } };
  money?: { basis: number; daily: number; total: number };
  moneyParts?: { from: string; through: string; basis: number; daily: number; days: number }[];
  payer?: "zus" | "employer";
  documents: BenefitDocument[];
  source: string;
};

export type DemoRate = { from: string; parental: number; singleChildWeeks?: number };

const minimumPay = [
  { from: "2024-01-01", through: "2024-06-30", debtLimit: 4242 },
  { from: "2024-07-01", through: "2024-12-31", debtLimit: 4300 },
  { from: "2025-01-01", through: "2025-12-31", debtLimit: 4666 },
  { from: "2026-01-01", through: "2026-12-31", debtLimit: 4806 },
  // Dz.U. 2026 poz. 1213
  { from: "2027-01-01", through: "2027-12-31", debtLimit: 4950 },
];

const maternityWeeks = [20, 31, 33, 35, 37];
const paternityDurations = [7, 14];
function careMaternityDays(from: Date, ageLimits: Date[]) {
  let days = 0;
  while (days < 259) {
    const eligibleChildren = ageLimits.filter((limit) => addDays(from, days) < limit).length;
    if (!eligibleChildren || days >= maternityWeeks[Math.min(eligibleChildren, 5) - 1] * 7) break;
    days++;
  }
  return Math.max(63, days);
}
const rehabDocuments =
  "https://www.zus.pl/swiadczenia/zasilki/swiadczenie-rehabilitacyjne/z-ubezpieczenia-chorobowego/niezbedne-dokumenty";
export function parentalPool(children: number, certificate: boolean, override?: number) {
  return (certificate ? (children === 1 ? 65 : 67) : children === 1 ? (override ?? 41) : 43) * 7;
}

export function benefitMoney(
  basis: number,
  rate: number,
  days: number,
  workPercent = 0,
  employmentPercent = 100,
) {
  const fullDaily = Math.round((Math.round(basis / 30) * rate) / 10_000);
  const daily = fullDaily - Math.round((fullDaily * workPercent) / employmentPercent);
  return { basis, daily, total: daily * days };
}

export function maternityTopUp(
  period: NonNullable<BenefitResult["period"]>,
  month: string,
  afterTax: number,
) {
  const start = parseDate(month + "-01");
  const from = parseDate(period.from);
  const through = parseDate(period.through);
  if (!start || !from || !through || !Number.isSafeInteger(afterTax) || afterTax < 0) return;
  const nextMonth = addMonths(start, 1);
  const first = from > start ? from : start;
  const stop = addDays(through, 1);
  const last = stop < nextMonth ? stop : nextMonth;
  if (last <= first) return;
  const days = daysBetween(first, last);
  const monthDays = daysBetween(start, nextMonth);
  const floor =
    days === monthDays ? 100_000 : Math.ceil((Math.round(100_000 / monthDays) * days) / 10) * 10;
  return { days, floor, topUp: Math.max(0, floor - afterTax) };
}

function documentsFor(benefit: Benefit, f: CaseFacts, asOf: string, from: Date): BenefitDocument[] {
  const documents: BenefitDocument[] = [];
  const payer = f.payer === "employer" ? "Pracodawca" : "ZUS";
  const currentForms = asOf >= "2026-10-24";
  if (benefit === "pregnancyAfterEmployment") {
    return [
      {
        title: "Wniosek ZAS-55 przez eZUS, pocztą lub w placówce",
        recipient: "ZUS",
        source: "maternityDocs",
        form: "benefit",
        href: "https://www.zus.pl/-/jak-uzyskac-zasilek-w-wysokosci-zasilku-macierzynskiego",
      },
      {
        title:
          "Zaświadczenie o ciąży w okresie zatrudnienia, świadectwo pracy i oświadczenie o niezapewnieniu innego zatrudnienia",
        recipient: "ZUS",
        source: "maternityDocs",
      },
      { title: "Z-3 od płatnika składek", recipient: "ZUS", source: "z3" },
    ];
  }
  if (
    f.employment === "employee" &&
    benefit !== "sickness" &&
    benefit !== "maternity" &&
    benefit !== "lossMaternity" &&
    benefit !== "rehabilitation"
  ) {
    const careApplication = parseDate(
      f.careKind === "adoption" && f.courtApplication && f.courtApplication > (f.careAccepted ?? "")
        ? f.courtApplication
        : f.careAccepted,
    );
    const lead =
      benefit === "paternity" || benefit === "adoptivePaternity"
        ? 7
        : benefit === "supplement"
          ? 22
          : benefit === "maternityTransfer"
            ? 14
            : 21;
    documents.push({
      title: {
        paternity: "Wniosek o urlop ojcowski",
        adoptivePaternity: "Wniosek o urlop ojcowski po przysposobieniu",
        parental: "Wniosek o urlop rodzicielski",
        careParental: "Wniosek o urlop rodzicielski po przyjęciu na wychowanie",
        supplement: "Wniosek o uzupełniający urlop macierzyński",
        careMaternity: "Wniosek o urlop na warunkach macierzyńskiego",
        maternityTransfer: "Wniosek ojca o część urlopu macierzyńskiego",
      }[benefit],
      recipient: "Pracodawca",
      source: "laborLaw",
      form: "leave",
      href: "https://eli.gov.pl/eli/DU/2025/322/ogl",
      deadline:
        benefit === "careMaternity"
          ? careApplication && isoDate(addDays(careApplication, 7))
          : benefit === "maternityTransfer" &&
              f.transferReason !== "return" &&
              f.transferReason !== "incapacity"
            ? undefined
            : isoDate(addDays(from, -lead)),
    });
  }
  if (benefit === "rehabilitation") {
    documents.push({
      title: "Wniosek ZNp-7 i zaświadczenie o stanie zdrowia OL-9",
      recipient: "ZUS",
      source: "benefitsLaw",
      href: rehabDocuments,
      form: "benefit",
    });
    if (f.employment === "employee" && f.rehabUsed === 0) {
      documents.push({
        title: "OL-10 od pracodawcy, jeśli niezdolność powstała w okresie ubezpieczenia",
        recipient: "ZUS",
        source: "benefitsLaw",
        href: rehabDocuments,
      });
    }
    if (f.insured === false || (f.employmentEnded && f.employmentEnded < isoDate(from))) {
      documents.push({
        title: "Z-10 po ustaniu tytułu, jeśli nie złożono go wcześniej lub dane się zmieniły",
        recipient: "ZUS",
        source: "benefitsLaw",
        href: "https://www.zus.pl/-/jak-uzyskac-swiadczenie-rehabilitacyjne-po-ustaniu-tytulu-ubezpieczenia",
      });
    }
  } else if (benefit === "sickness") {
    documents.push({
      title: "e-ZLA z kodem B lub potwierdzeniem ciąży",
      recipient: payer,
      source: "sicknessDocs",
    });
    if (f.payer === "zus")
      documents.push({
        title: "Wniosek o zasiłek chorobowy (ZAS-53), gdy potrzebny",
        recipient: "ZUS",
        source: "sicknessDocs",
        form: "benefit",
      });
    if (f.insured === false || (f.employmentEnded && f.employmentEnded < isoDate(from))) {
      documents.push({
        title: "Z-10: oświadczenie o prawie po ustaniu tytułu ubezpieczenia",
        recipient: "ZUS",
        source: "sicknessDocs",
      });
    }
  } else {
    if (f.payer === "zus") {
      const historicalForms = {
        maternity: "ZAM",
        paternity: "ZAO",
        adoptivePaternity: "ZAO",
        parental: "ZUR",
        careParental: "ZUR",
        supplement: "wniosek wraz z zaświadczeniem szpitala",
        careMaternity: "ZAM",
        lossMaternity: "ZAM",
        maternityTransfer: "ZAM",
      };
      const form = currentForms ? "ZAM" : historicalForms[benefit];
      documents.push({
        title: "Wniosek o wypłatę (" + form + ")",
        recipient: payer,
        source: currentForms ? "zam" : "maternityDocs",
        form: "benefit",
        deadline:
          f.employment !== "employee" && (benefit === "parental" || benefit === "careParental")
            ? isoDate(addDays(from, -1))
            : undefined,
      });
    } else {
      documents.push({
        title: "Wniosek o wypłatę zasiłku do płatnika",
        recipient: payer,
        source: "maternityDocs",
        form: "benefit",
      });
    }
    documents.push({
      title:
        benefit === "supplement"
          ? "Zaświadczenie szpitala"
          : benefit === "adoptivePaternity"
            ? "Prawomocne postanowienie o przysposobieniu i oświadczenie o wcześniejszym ojcowskim"
            : benefit === "careMaternity" || benefit === "careParental"
              ? f.careKind === "adoption"
                ? "Dokument przyjęcia dziecka i potwierdzenie wystąpienia do sądu o przysposobienie"
                : "Postanowienie sądu lub dokument o umieszczeniu w rodzinie zastępczej"
              : benefit === "lossMaternity"
                ? f.childDeath === f.birth
                  ? "Dokument potwierdzający martwe urodzenie dziecka"
                  : "Odpis aktu zgonu dziecka"
                : benefit === "maternity" && (f.birth === undefined || isoDate(from) < f.birth)
                  ? "Zaświadczenie o przewidywanej dacie porodu i dane dziecka po porodzie"
                  : currentForms && (benefit === "maternity" || benefit === "paternity")
                    ? "Dane dziecka i drugiego rodzica (urodzenie w Polsce)"
                    : "Dokument potwierdzający urodzenie dziecka",
      recipient: payer,
      source: benefit === "supplement" ? "supplement" : "maternityDocs",
    });
    if (benefit === "parental" || benefit === "careParental") {
      documents.push({
        title:
          "Informacja o częściach rodzicielskiego i okresie wykorzystanym przez drugiego rodzica",
        recipient: payer,
        source: "maternityDocs",
      });
      if (f.careCertificate) {
        documents.push({
          title: "Zaświadczenie zgodne z ustawą Za życiem",
          recipient: payer,
          source: "maternityDocs",
        });
      }
      if (f.employment === "employee" && f.workPercent) {
        documents.push({
          title: "Wniosek o łączenie urlopu rodzicielskiego z pracą",
          recipient: "Pracodawca",
          source: "laborLaw",
          deadline: isoDate(addDays(from, -21)),
        });
      }
    }
    if (benefit === "supplement" && f.supplementCare) {
      documents.push({
        title:
          f.careKind === "adoption"
            ? "Dokument przyjęcia na wychowanie i potwierdzenie wniosku do sądu o przysposobienie"
            : "Dokument umieszczenia dziecka w rodzinie zastępczej",
        recipient: payer,
        source: "maternityDocs",
      });
    }
    if (benefit === "maternityTransfer") {
      const evidence = {
        return: "Oświadczenie matki o rezygnacji i potwierdzenie końca jej urlopu lub wypłaty",
        incapacity:
          "Orzeczenie o niezdolności do samodzielnej egzystencji i dokumenty dotyczące okresu pobranego przez matkę",
        hospital:
          "Zaświadczenie o pobycie matki w szpitalu i potwierdzenie przerwania jej urlopu lub wypłaty",
        death: "Dowód zgonu matki i dokumenty dotyczące wykorzystanego przez nią okresu",
        abandonment:
          "Oświadczenie o porzuceniu dziecka i dokumenty dotyczące wykorzystanego przez matkę okresu",
        newEmployment:
          "Potwierdzenie podjęcia przez matkę zatrudnienia w wymiarze co najmniej połowy etatu",
      };
      if (f.transferReason)
        documents.push({
          title: evidence[f.transferReason],
          recipient: payer,
          source: "maternityDocs",
        });
    }
    if ((benefit === "maternity" || benefit === "lossMaternity") && f.insured === false) {
      documents.push({
        title:
          f.termination === "extended"
            ? "Świadectwo pracy potwierdzające przedłużenie umowy do porodu"
            : f.termination === "unlawful"
              ? "Zaświadczenie o ciąży w czasie zatrudnienia i prawomocny wyrok sądu"
              : "Zaświadczenie o ciąży w czasie zatrudnienia i dokument potwierdzający powód ustania zatrudnienia",
        recipient: "ZUS",
        source: "maternityDocs",
      });
    }
  }
  if (f.payer === "zus" && (f.employment === "employee" || f.employment === "contract")) {
    const employee = f.employment === "employee";
    documents.push({
      title:
        (employee ? "Z-3 od pracodawcy" : "Z-3a od płatnika składek") +
        (benefit === "rehabilitation" ? ", jeśli ZUS potrzebuje danych od płatnika" : ""),
      recipient: "ZUS",
      source: employee ? "z3" : "z3a",
    });
  }
  return documents;
}

export function assessBenefit(
  benefit: Benefit,
  f: CaseFacts,
  asOf: string,
  demoRate?: DemoRate,
): BenefitResult {
  const birth = parseDate(f.birth);
  const beforeBirth = benefit === "pregnancyAfterEmployment";
  const transfer = benefit === "maternityTransfer";
  const employmentEnded = parseDate(f.employmentEnded);
  const dueDate = benefit === "maternity" && !birth ? parseDate(f.dueDate) : undefined;
  const projected =
    (benefit === "maternity" || beforeBirth) &&
    !birth &&
    (f.birthStage === "expected" || f.birthStage === "expectedEarly" || Boolean(f.dueDate));
  const projection = projected ? ({ projected: true } as const) : {};
  const source =
    benefit === "sickness" ? "sickness" : benefit === "supplement" ? "supplement" : "benefitsLaw";
  const result = (status: Status, reason: string, missing?: FactKey): BenefitResult => ({
    status,
    reason,
    missing,
    documents: [],
    source,
    ...projection,
  });
  const need = (field: FactKey, reason = "Potrzebuję jeszcze jednej informacji.") =>
    result("missing", reason, field);
  const review = (reason: string) => result("review", reason);
  const deny = (reason: string) => result("ineligible", reason);
  const sickness = benefit === "sickness";
  const rehab = benefit === "rehabilitation";
  const care = benefit === "careMaternity";
  const adoptivePaternity = benefit === "adoptivePaternity";
  const paternity = benefit === "paternity" || adoptivePaternity;
  const careParental = benefit === "careParental";
  const parental = benefit === "parental" || careParental;
  const loss = benefit === "lossMaternity";
  const requested = parseDate(f.from);
  if (benefit === "maternity" && dueDate && f.birthStage === "expectedEarly" && !requested)
    return need(
      "from",
      "Podaj planowany początek, maksymalnie sześć tygodni przed przewidywaną datą porodu.",
    );
  const explicitEnd = projected ? undefined : parseDate(f.through);
  const planDays = projected || explicitEnd ? undefined : f.requestedDays;
  if (f.exception)
    return review(
      "Ta sprawa wymaga uwzględnienia szczególnej podstawy lub odrębnego rozstrzygnięcia ZUS.",
    );
  if (!sickness && !rehab && f.birth && f.birth > asOf)
    return need("birth", "Data urodzenia może przypadać najpóźniej dzisiaj.");
  if (paternity && planDays !== undefined && !paternityDurations.includes(planDays))
    return need("requestedDays", "Wpisz 7 dni albo 14 dni ojcowskiego.");
  if (!requested && planDays !== undefined && benefit !== "maternity" && !loss) return need("from");
  if (!sickness && !rehab && !beforeBirth && !birth && !dueDate) {
    if (projected) return need("dueDate");
    return need(benefit === "maternity" && !f.birthStage ? "birthStage" : "birth");
  }
  if (benefit !== "maternity" && !loss && !beforeBirth && !transfer && !requested)
    return need("from");
  let legalEnd: Date | undefined;
  let transferStart: Date | undefined;
  if (beforeBirth) {
    if (!f.employment) return need("employment");
    if (f.employment !== "employee")
      return deny("To świadczenie przysługuje po ustaniu umowy o pracę.");
    if (!f.termination) return need("termination");
    if (f.termination !== "employerClosed") {
      return deny(
        "Zasiłek do dnia poprzedzającego poród wymaga śmierci, upadłości lub likwidacji pracodawcy. Po urodzeniu dziecka można osobno sprawdzić prawo do macierzyńskiego.",
      );
    }
    if (!employmentEnded) return need("employmentEnded");
    if (f.alternativeEmployment === undefined) return need("alternativeEmployment");
    if (f.alternativeEmployment)
      return deny(
        "Zapewniono inne zatrudnienie, więc warunek tego świadczenia nie jest spełniony.",
      );
    if (f.pregnancyProof === undefined)
      return need(
        "pregnancyProof",
        "Potrzebne jest zaświadczenie potwierdzające ciążę w czasie zatrudnienia.",
      );
    if (!f.pregnancyProof) return review("Potwierdź z lekarzem stan ciąży w okresie zatrudnienia.");
    if (!birth && !f.birthStage && !f.dueDate) return need("birthStage");
    const delivery = birth ?? parseDate(f.dueDate);
    if (!delivery) return need(projected ? "dueDate" : "birth");
    if (delivery <= addDays(employmentEnded, 1))
      return deny("Między ustaniem zatrudnienia a porodem nie ma dni objętych tym świadczeniem.");
    legalEnd = addDays(delivery, -1);
  }
  if (transfer && birth) {
    if (!f.transferReason) return need("transferReason");
    const voluntary = f.transferReason === "return" || f.transferReason === "hospital";
    const jobStart = f.transferReason === "newEmployment";
    const insuredMother = jobStart ? false : voluntary || f.motherInsured;
    if (insuredMother === undefined) return need("motherInsured");
    if (!f.children) return need("children");
    const totalDays = maternityWeeks[Math.min(f.children, 5) - 1] * 7;
    const motherBefore = insuredMother ? f.motherDaysBeforeBirth : 0;
    const motherAfter = insuredMother ? f.motherDaysAfterBirth : 0;
    if (motherBefore === undefined) return need("motherDaysBeforeBirth");
    if (motherAfter === undefined) return need("motherDaysAfterBirth");
    if (jobStart) {
      if (f.motherJobPercent === undefined) return need("motherJobPercent");
      if (f.motherJobPercent < 50)
        return deny(
          "W tym trybie matka musi podjąć zatrudnienie w wymiarze co najmniej połowy etatu.",
        );
    }
    const minimum = f.transferReason === "return" ? 98 : f.transferReason === "death" ? 0 : 56;
    if (insuredMother && motherAfter < minimum)
      return deny(
        `Przejęcie z tej przyczyny wymaga co najmniej ${minimum} dni macierzyńskiego matki po porodzie.`,
      );
    if (motherBefore + motherAfter >= totalDays)
      return deny("Wykorzystano już cały podstawowy okres macierzyńskiego.");
    const next = addDays(birth, motherAfter);
    const anchored =
      !insuredMother ||
      f.transferReason === "hospital" ||
      f.transferReason === "death" ||
      f.transferReason === "abandonment" ||
      f.transferReason === "incapacity";
    const event = parseDate(f.transferEvent);
    if (anchored && !event) return need("transferEvent");
    if (
      anchored &&
      event &&
      ((event < birth && f.transferReason !== "incapacity") || isoDate(event) > asOf)
    )
      return need("transferEvent", "Podaj datę zdarzenia od dnia urodzenia do dziś.");
    let first =
      anchored && event
        ? addDays(event, f.transferReason === "hospital" || jobStart ? 0 : 1)
        : next;
    if (!insuredMother && f.transferReason === "incapacity" && first < birth) first = birth;
    if (insuredMother && (first > next || (f.transferReason === "death" && first < next)))
      return need(
        "motherDaysAfterBirth",
        "Podana liczba dni pozostawia lukę przed zdarzeniem. Sprawdź faktycznie wykorzystany okres.",
      );
    transferStart = insuredMother ? next : first;
    legalEnd = addDays(birth, totalDays - motherBefore - 1);
    const motherJobEnds = jobStart ? parseDate(f.motherJobEnds) : undefined;
    if (motherJobEnds && motherJobEnds < transferStart)
      return need(
        "motherJobEnds",
        "Koniec zatrudnienia musi przypadać w dniu jego rozpoczęcia albo później.",
      );
    if (motherJobEnds && motherJobEnds < legalEnd) legalEnd = motherJobEnds;
    if (f.transferReason === "hospital") {
      const hospitalEnd = parseDate(f.transferThrough);
      if (!hospitalEnd) return need("transferThrough");
      if (hospitalEnd < transferStart)
        return deny("Pobyt matki w szpitalu skończył się przed dniem możliwego przejęcia.");
      if (hospitalEnd < legalEnd) legalEnd = hospitalEnd;
    }
    if (transferStart > legalEnd)
      return deny("Zdarzenie przypada po zakończeniu podstawowego okresu macierzyńskiego.");
    if (requested && requested.getTime() !== transferStart.getTime())
      return need(
        "from",
        "Początek musi pokrywać się z dniem przejęcia: " + isoDate(transferStart) + ".",
      );
  }
  let from =
    beforeBirth && employmentEnded
      ? addDays(employmentEnded, 1)
      : (transferStart ?? requested ?? birth ?? dueDate);
  if (!from) return need("from");
  const startsBeforeBirth = benefit === "maternity" && from < (birth ?? dueDate ?? from);
  if (f.birthStage === "expectedEarly" && dueDate && from >= dueDate)
    return need(
      "from",
      "Przy wcześniejszym macierzyńskim początek musi przypadać przed przewidywanym porodem.",
    );
  if (startsBeforeBirth) {
    const certified = dueDate ?? parseDate(f.certifiedDueDate);
    if (!certified) return need("certifiedDueDate");
    if (from < addDays(certified, -42))
      return need(
        "from",
        "Macierzyński może rozpocząć się najwcześniej sześć tygodni przed przewidywaną datą porodu.",
      );
  }
  if (birth && !sickness && !rehab && !beforeBirth && !startsBeforeBirth && from < birth)
    return review("Okres przed porodem wymaga osobnego ustalenia zasad i dat.");
  const coverageDay = isoDate(
    beforeBirth && employmentEnded
      ? employmentEnded
      : ((benefit === "maternity" && !startsBeforeBirth) || loss) && birth
        ? birth
        : from,
  );
  if (coverageDay < "2023-04-26")
    return review("Tę datę obejmują wcześniejsze reguły. Sprawdź je w ZUS.");
  if (!f.employment) return { ...need("employment"), coverageDay };
  if (f.insured === undefined) return { ...need("insured"), coverageDay };
  const standardDecision = (reason: string) => ({ ...deny(reason), coverageDay });
  let postEmployment = false;
  const afterInsurance =
    (sickness || rehab) && (f.insured === false || (employmentEnded && from > employmentEnded));
  if (!f.insured) {
    if (
      !projected &&
      (benefit === "maternity" || loss) &&
      f.employment === "employee" &&
      f.exception !== false
    ) {
      if (!f.termination) return { ...need("termination"), coverageDay };
      if (f.termination !== "ordinary") {
        if (!employmentEnded) return { ...need("employmentEnded"), coverageDay };
        if (
          !birth ||
          (f.termination === "extended"
            ? employmentEnded.getTime() !== birth.getTime()
            : employmentEnded >= birth)
        )
          return {
            ...need("employmentEnded", "Sprawdź relację między końcem umowy a datą porodu."),
            coverageDay,
          };
        if (f.termination !== "extended") {
          if (f.pregnancyProof === undefined)
            return {
              ...need(
                "pregnancyProof",
                "Potrzebne jest potwierdzenie ciąży w okresie zatrudnienia.",
              ),
              coverageDay,
            };
          if (!f.pregnancyProof)
            return { ...review("Ustal, czy ciąża trwała w dniu końca zatrudnienia."), coverageDay };
        }
        postEmployment = true;
      }
    }
    if (parental || benefit === "supplement")
      return review("Sprawdź w ZUS, czy do tego okresu zachowujesz wcześniej nabyte prawo.");
    if (!postEmployment && !afterInsurance)
      return standardDecision(
        projected
          ? "Przy założeniu braku ubezpieczenia w dniu porodu podstawowe warunki zasiłku nie będą spełnione. Szczególne okoliczności możesz sprawdzić z ZUS."
          : "W dniu istotnym dla tego świadczenia brak ubezpieczenia chorobowego z podanego tytułu.",
      );
  }
  if (transfer) {
    if (f.personalCare === undefined) return { ...need("personalCare"), coverageDay };
    if (!f.personalCare)
      return standardDecision(
        "Przejęcie wymaga osobistej opieki i skorzystania z urlopu lub przerwania działalności zarobkowej.",
      );
  }
  if (f.employment === "business" || f.employment === "collaborator") {
    const rule = minimumPay.find(
      ({ from, through }) => from <= coverageDay && coverageDay <= through,
    );
    if (!rule) return review("Na ten dzień kalkulator potrzebuje właściwego progu zadłużenia.");
    if (f.debt === undefined) return need("debt");
    if (f.debt > rule.debtLimit) {
      if (!f.debtPaid)
        return standardDecision(
          "Zadłużenie w dniu powstania prawa przekracza 1% minimalnego wynagrodzenia. Sprawdź saldo i warunki spłaty w ZUS.",
        );
      const incurred = parseDate(coverageDay);
      if (!incurred || f.debtPaid < coverageDay || f.debtPaid > asOf)
        return review("Sprawdź datę i skuteczność całkowitej spłaty zadłużenia.");
      if (f.debtPaid > isoDate(addMonths(incurred, 6)))
        return review(
          "Przy spłacie po sześciu miesiącach ZUS powinien ustalić ewentualny dalszy okres wypłaty.",
        );
    }
  }
  if (sickness) {
    const waitingDays = f.employment === "employee" ? 30 : 90;
    if (f.qualifying === undefined && f.qualifyingDays === undefined) return need("qualifying");
    if (
      f.qualifying === undefined &&
      f.qualifyingDays !== undefined &&
      f.qualifyingDays < waitingDays
    ) {
      if (f.waitingException === undefined) return need("waitingException");
      if (!f.waitingException)
        return standardDecision(
          `Wymagany okres wyczekiwania wynosi ${waitingDays} dni. Podana liczba go nie osiąga.`,
        );
    }
    if (f.qualifying === false)
      return standardDecision(
        "Według podanych danych wymagany okres wyczekiwania jeszcze nie upłynął.",
      );
    if (f.pregnancyProof === undefined) return need("pregnancyProof");
    if (!f.pregnancyProof)
      return review("Do obliczenia stawki dla ciąży potrzebne jest potwierdzenie ciąży.");
    if (afterInsurance) {
      if (!employmentEnded) return need("employmentEnded");
      if (from <= employmentEnded)
        return need(
          "employmentEnded",
          "W dniu wskazanego początku umowa już nie trwała. Sprawdź daty.",
        );
      const illness = parseDate(f.illnessStart);
      if (!illness || illness > from) return need("illnessStart");
      if (f.postInsuranceExcluded === undefined) return need("postInsuranceExcluded");
      if (f.postInsuranceExcluded)
        return standardDecision(
          "Podane wyłączenie z art. 13 uniemożliwia wypłatę po ustaniu ubezpieczenia z tego tytułu.",
        );
      if (illness > employmentEnded) {
        if (illness > addDays(employmentEnded, 14)) {
          if (f.lateOnsetCode === undefined) return need("lateOnsetCode");
          if (!f.lateOnsetCode || illness > addMonths(employmentEnded, 3))
            return standardDecision("Niezdolność powstała zbyt późno po ustaniu ubezpieczenia.");
        }
        const sickThrough =
          explicitEnd ?? (planDays === undefined ? undefined : addDays(from, planDays - 1));
        if (!sickThrough) return need("through");
        if (daysBetween(illness, sickThrough) + 1 < 30)
          return standardDecision(
            "Niezdolność powstała po ustaniu ubezpieczenia i trwała krócej niż 30 dni.",
          );
      }
      postEmployment = true;
    }
    if (f.employment === "employee" && !afterInsurance && f.employerSickPayEnded !== true) {
      if (f.employerSickPayEnded === undefined) return need("employerSickPayEnded");
      if (f.sickPayDaysRemaining === undefined) return need("sickPayDaysRemaining");
      if (f.sickPayDaysRemaining > 0) {
        const end =
          explicitEnd ?? (planDays === undefined ? undefined : addDays(from, planDays - 1));
        if (!end) return need("through");
        from = addDays(from, f.sickPayDaysRemaining);
        if (from > end)
          return standardDecision(
            "Podany okres obejmuje wynagrodzenie chorobowe od pracodawcy. Zasiłek chorobowy jeszcze się nie rozpoczyna.",
          );
        legalEnd = end;
      }
    }
    if (f.sickDaysUsed === undefined) return need("sickDaysUsed");
  }
  if (rehab) {
    if (afterInsurance) {
      if (!employmentEnded) return need("employmentEnded");
      if (from <= employmentEnded)
        return need("employmentEnded", "Sprawdź datę ustania ubezpieczenia przed tym okresem.");
      postEmployment = true;
    }
    if (f.sickDaysUsed === undefined) return need("sickDaysUsed");
    if (f.sickDaysUsed < 270 && f.sickPeriodExhausted === undefined)
      return need("sickPeriodExhausted");
    if (f.sickDaysUsed < 270 && f.sickPeriodExhausted === false)
      return standardDecision("Świadczenie rehabilitacyjne wymaga wyczerpania okresu zasiłkowego.");
    if (f.rehabExcluded === true)
      return standardDecision("Podane wyłączenie uniemożliwia przyznanie tego świadczenia.");
    if (f.rehabMedical === undefined) return need("rehabMedical");
    if (!f.rehabMedical) {
      return {
        ...review(
          "Lekarz orzecznik ZUS musi potwierdzić dalszą niezdolność do pracy i rokowanie odzyskania zdolności.",
        ),
        documents: documentsFor(benefit, f, asOf, from),
      };
    }
    if (f.pregnancyProof === undefined) return need("pregnancyProof");
    if (!f.pregnancyProof)
      return {
        ...review("Stawkę dla ciąży trzeba udokumentować zaświadczeniem lekarskim."),
        documents: documentsFor(benefit, f, asOf, from),
      };
    if (f.rehabUsed === undefined) return need("rehabUsed");
    if (f.rehabExcluded === undefined) return need("rehabExcluded");
  }

  let extent: number | undefined;
  let cap: number | undefined;
  let rate = 10_000;
  const periodField = planDays === undefined ? "through" : "requestedDays";
  let through = explicitEnd ?? (planDays === undefined ? undefined : addDays(from, planDays - 1));
  if (sickness) {
    if (legalEnd) through = legalEnd;
    if (birth && from >= birth)
      return standardDecision(
        "Chorobowe w ciąży kończy się przed porodem. Sprawdź macierzyński od dnia porodu.",
      );
    if (birth && through && through >= birth) through = addDays(birth, -1);
  }
  const requestedDays = through ? daysBetween(from, through) + 1 : undefined;
  if (requestedDays !== undefined && requestedDays <= 0)
    return need(periodField, "Koniec musi przypadać w dniu rozpoczęcia albo później.");
  if (legalEnd && !sickness) {
    extent = daysBetween(from, legalEnd) + 1;
    if (beforeBirth) through = legalEnd;
  }
  if (paternity && birth) {
    const adoptionFinal = parseDate(f.adoptionFinal);
    if (adoptivePaternity && !adoptionFinal) return need("adoptionFinal");
    if (adoptivePaternity && adoptionFinal && (adoptionFinal < birth || from < adoptionFinal))
      return need(
        "adoptionFinal",
        "Prawomocne przysposobienie musi nastąpić po urodzeniu, najpóźniej w dniu rozpoczęcia ojcowskiego.",
      );
    const ageLimit = addMonths(birth, adoptivePaternity ? 168 : 12);
    const adoptionLimit =
      adoptivePaternity && adoptionFinal ? addDays(addMonths(adoptionFinal, 12), 1) : ageLimit;
    const limit = ageLimit < adoptionLimit ? ageLimit : adoptionLimit;
    if (from >= limit || (through && through >= limit)) {
      return standardDecision(
        adoptivePaternity
          ? "Cały okres musi przypadać przed 14. urodzinami dziecka i w ciągu 12 miesięcy od prawomocnego przysposobienia."
          : "W tej sprawie cały okres musi przypadać przed ukończeniem przez dziecko 12 miesięcy.",
      );
    }
    if (f.paternityUsed === undefined) return need("paternityUsed");
    cap = f.paternityUsed === "none" ? 14 : f.paternityUsed === "week" ? 7 : 0;
    if (!cap) return standardDecision("Wykorzystano już pełny wymiar ojcowskiego.");
    if (
      requestedDays !== undefined &&
      (!paternityDurations.includes(requestedDays) || requestedDays > cap)
    ) {
      return need(
        periodField,
        cap === 7
          ? "Został Ci tydzień ojcowskiego. Podaj okres obejmujący 7 dni."
          : "Podaj pełny tydzień albo dwa tygodnie w granicach pozostałego wymiaru.",
      );
    }
  }
  if (benefit === "maternity") {
    if (!f.children) return need("children");
    extent = maternityWeeks[Math.min(f.children, 5) - 1] * 7;
    if (birth && from > birth)
      return review(
        "Rozpoczęcie po dniu porodu wymaga sprawdzenia wcześniejszych okresów i osoby uprawnionej.",
      );
  }
  if (loss && birth) {
    if (from.getTime() !== birth.getTime())
      return need("from", "Początek tego okresu przypada w dniu porodu.");
    if (!f.children) return need("children");
    const death = parseDate(f.childDeath);
    if (!death || death < birth || isoDate(death) > asOf)
      return need("childDeath", "Podaj datę od dnia porodu do dziś.");
    if (f.children > 1 && f.survivingChildren === undefined) return need("survivingChildren");
    const survivors = f.children === 1 ? 0 : (f.survivingChildren ?? 0);
    if (survivors >= f.children)
      return need(
        "survivingChildren",
        "Liczba dzieci pozostałych przy życiu musi być mniejsza niż liczba dzieci urodzonych.",
      );
    const lived = daysBetween(birth, death);
    if (lived >= maternityWeeks[Math.min(f.children, 5) - 1] * 7)
      return standardDecision("Zdarzenie nastąpiło po zakończeniu podstawowego macierzyńskiego.");
    const survivingExtent = survivors ? maternityWeeks[Math.min(survivors, 5) - 1] * 7 : 0;
    extent = Math.max(survivingExtent, lived < 56 && !survivors ? 56 : 0, lived + 8);
  }
  let parentalAgeLimit: string | undefined;
  let careAnchor: Date | undefined;
  let carePool: number | undefined;
  if ((care || careParental) && birth) {
    if (!f.careKind) return need("careKind");
    if (f.careKind === "professional")
      return standardDecision(
        "Zasiłek z tego tytułu nie przysługuje rodzinie zastępczej zawodowej.",
      );
    if (!f.children) return need("children", "Ile dzieci przyjęto jednocześnie na wychowanie?");
    if (f.children > 1 && f.sameCareAgeLimit === undefined) return need("sameCareAgeLimit");
    const mixed = f.children > 1 && f.sameCareAgeLimit === false;
    if (mixed && f.careChildren?.length !== f.children)
      return need(
        "careChildren",
        "Potrzebna jest data i informacja o odroczeniu dla każdego przyjętego dziecka.",
      );
    const accepted = parseDate(f.careAccepted);
    if (!accepted || accepted < birth || isoDate(accepted) > asOf)
      return need("careAccepted", "Podaj datę przyjęcia dziecka od urodzenia do dziś.");
    careAnchor = accepted;
    if (f.careKind === "adoption") {
      if (!f.courtApplication) return need("courtApplication");
      const courtApplication = parseDate(f.courtApplication);
      if (courtApplication && courtApplication > careAnchor) careAnchor = courtApplication;
    }
    if (careAnchor > from)
      return need(
        "from",
        "Początek okresu musi przypadać w dniu przyjęcia dziecka oraz po złożeniu wymaganego wniosku do sądu.",
      );
    if (care && daysBetween(careAnchor, from) > 21 && f.employment === "employee")
      return review(
        "Sprawdź skuteczność wniosku o urlop rozpoczynający się później niż 21 dni od przyjęcia na wychowanie lub złożenia wniosku do sądu.",
      );
    const regularMaternityDays = maternityWeeks[Math.min(f.children, 5) - 1] * 7;
    if (
      !mixed &&
      f.careKind === "foster" &&
      addDays(careAnchor, regularMaternityDays) > addMonths(birth, 84) &&
      f.schoolDeferral === undefined
    )
      return need("schoolDeferral");
    const childLimits = mixed
      ? (f.careChildren ?? []).flatMap(({ birth, schoolDeferral }) => {
          const born = parseDate(birth);
          return born && accepted && born <= accepted
            ? [addMonths(born, (f.careKind === "adoption" ? 14 : schoolDeferral ? 10 : 7) * 12)]
            : [];
        })
      : Array.from({ length: f.children }, () =>
          addMonths(birth, (f.careKind === "adoption" ? 14 : f.schoolDeferral ? 10 : 7) * 12),
        );
    if (childLimits.length !== f.children)
      return need(
        "careChildren",
        "Sprawdź, czy każde dziecko urodziło się najpóźniej w dniu przyjęcia na wychowanie.",
      );
    const anchor = careAnchor;
    const ageLimits = childLimits
      .filter((limit) => anchor < limit)
      .sort((a, b) => a.getTime() - b.getTime());
    const birthdayLimit = ageLimits.at(-1);
    if (!birthdayLimit)
      return standardDecision(
        "W dniu podanym w sprawie dziecko osiągnęło już granicę wieku dla tego trybu przyjęcia.",
      );
    const maternityDays = careMaternityDays(care ? from : careAnchor, ageLimits);
    if (care) {
      if (f.previousCareBenefit === undefined) return need("previousCareBenefit");
      if (f.previousCareBenefit && f.previousCareDays === undefined)
        return need("previousCareDays");
      extent = maternityDays - (f.previousCareBenefit ? (f.previousCareDays ?? 0) : 0);
      if (extent < 1)
        return standardDecision("Wcześniej wykorzystany okres wyczerpuje wymiar zasiłku.");
    } else {
      if (f.careCertificate === undefined) return need("careCertificate");
      const youngerChildren = ageLimits.filter((limit) => from < limit).length;
      const plannedEnd = through;
      if (
        mixed &&
        youngerChildren > 1 &&
        plannedEnd &&
        ageLimits.some((limit) => from < limit && limit <= plannedEnd)
      )
        return review(
          "W trakcie wybranego rodzicielskiego zmienia się liczba dzieci w wymaganym wieku. Ten konkretny podział okresów trzeba potwierdzić z ZUS.",
        );
      const normalPool = parentalPool(youngerChildren || ageLimits.length, f.careCertificate);
      const reduced = maternityDays === 63;
      carePool = reduced ? (f.careCertificate ? 62 : 38) * 7 : normalPool;
      parentalAgeLimit = reduced ? undefined : isoDate(addDays(birthdayLimit, -1));
    }
  }
  if (parental && birth) {
    if (f.parts === undefined) return need("parts");
    if (f.parts >= 5)
      return standardDecision(
        "Oboje rodzice wykorzystali już pięć części. Kolejna część przekracza wspólny limit.",
      );
    if (!f.children) return need("children");
    if (f.careCertificate === undefined) return need("careCertificate");
    if (f.usedDays === undefined) return need("usedDays");
    if (f.otherParentDays === undefined) return need("otherParentDays");
    if (f.soleParent === undefined) return need("soleParent");
    if (f.reserved === undefined) return need("reserved");
    const override =
      demoRate && coverageDay >= demoRate.from ? demoRate.singleChildWeeks : undefined;
    const available =
      (carePool ?? parentalPool(f.children, f.careCertificate, override)) -
      f.usedDays -
      Math.max(f.otherParentDays, f.soleParent ? 0 : 63);
    cap = Math.max(0, f.reserved ? Math.min(available, Math.max(0, 63 - f.usedDays)) : available);
    if (!cap) return standardDecision("W podanym wariancie dostępny wymiar został wykorzystany.");
    const presumedStart = addDays(birth, maternityWeeks[Math.min(f.children, 5) - 1] * 7);
    const actualEnd = parseDate(f.maternityEnd);
    if (!careParental && from < presumedStart && !actualEnd && f.motherInsured !== false) {
      if (f.motherInsured === undefined)
        return need(
          "motherInsured",
          "Ten początek jest wcześniejszy niż standardowy koniec macierzyńskiego.",
        );
      return need("maternityEnd", "Podaj rzeczywisty ostatni dzień macierzyńskiego.");
    }
    if (actualEnd && from <= actualEnd)
      return need(
        "from",
        "Początek rodzicielskiego musi przypadać po wskazanym okresie macierzyńskiego.",
      );
    if (!careParental) parentalAgeLimit = birth.getUTCFullYear() + 6 + "-12-31";
    if (
      parentalAgeLimit &&
      (isoDate(from) > parentalAgeLimit || (through && isoDate(through) > parentalAgeLimit))
    )
      return standardDecision(
        careParental
          ? "Okres wykracza poza granicę wieku dziecka dla tej formy opieki."
          : "Okres wykracza poza koniec roku, w którym dziecko kończy sześć lat.",
      );
    rate = demoRate && coverageDay >= demoRate.from ? demoRate.parental : 7000;
  }
  if (benefit === "supplement" && birth) {
    if (coverageDay < "2025-03-19")
      return standardDecision("Uzupełniający macierzyński obowiązuje od 19 marca 2025 r.");
    if (f.supplementCare === undefined) return need("supplementCare");
    let accepted: Date | undefined;
    if (f.supplementCare) {
      if (!f.careKind) return need("careKind");
      if (f.careKind === "professional")
        return standardDecision("To świadczenie nie przysługuje zawodowej rodzinie zastępczej.");
      accepted = parseDate(f.careAccepted);
      if (!accepted || accepted < birth || accepted >= from || isoDate(accepted) > asOf)
        return need("careAccepted", "Podaj datę przyjęcia od urodzenia do dnia przed urlopem.");
      if (f.careKind === "adoption") {
        const court = parseDate(f.courtApplication);
        if (!court || court < birth || court >= from || isoDate(court) > asOf)
          return need("courtApplication");
      }
      const ageLimit = addMonths(
        birth,
        (f.careKind === "adoption" ? 14 : f.schoolDeferral ? 10 : 7) * 12,
      );
      if (accepted >= ageLimit) {
        if (
          f.careKind === "foster" &&
          f.schoolDeferral === undefined &&
          accepted < addMonths(birth, 120)
        )
          return need("schoolDeferral");
        return standardDecision("Dziecko osiągnęło granicę wieku dla tego trybu przyjęcia.");
      }
    }
    if (!f.children) return need("children");
    if (f.children > 1 && f.combinedHospitalEvidence === undefined)
      return need("combinedHospitalEvidence");
    if (f.children > 1 && f.combinedHospitalEvidence === false)
      return review(
        "Potrzebne są najniższa masa urodzeniowa oraz pobyty najdłużej hospitalizowanego dziecka.",
      );
    if (f.gestationalWeeks === undefined) return need("gestationalWeeks");
    if (!f.birthWeightGrams) return need("birthWeightGrams");
    const stays = f.hospitalRanges?.split(",").flatMap((entry) => {
      const [start, end, excess] = entry.trim().split("/");
      const from = start?.trim();
      const through = end?.trim();
      return excess === undefined && parseDate(from) && parseDate(through)
        ? [{ from, through }]
        : [];
    });
    if (stays && stays.length !== f.hospitalRanges?.split(",").length)
      return need("hospitalRanges", "Sprawdź format wszystkich okresów pobytu.");
    if (!stays && !f.hospitalFrom) return need("hospitalFrom");
    if (!stays && !f.hospitalThrough) return need("hospitalThrough");
    const precedingEnd = parseDate(f.maternityEnd);
    if (accepted && !precedingEnd) return need("maternityEnd");
    if (
      from.getTime() !==
      (precedingEnd
        ? addDays(precedingEnd, 1)
        : addDays(birth, maternityWeeks[Math.min(f.children, 5) - 1] * 7)
      ).getTime()
    )
      return need(
        "maternityEnd",
        "Uzupełniający okres powinien następować bezpośrednio po ustalonym macierzyńskim. Sprawdź datę końca macierzyńskiego.",
      );
    const hospitalStays =
      stays ??
      (f.hospitalFrom && f.hospitalThrough
        ? [{ from: f.hospitalFrom, through: f.hospitalThrough }]
        : []);
    if (
      hospitalStays.some(
        ({ from, through }) => from < isoDate(birth) || through < from || through > asOf,
      )
    )
      return need(stays ? "hospitalRanges" : "hospitalThrough", "Sprawdź daty pobytu w szpitalu.");
    const placementDay = accepted && isoDate(accepted);
    if (
      placementDay &&
      hospitalStays.some(({ from, through }) => from <= placementDay && through > placementDay)
    )
      return review(
        "Pobyt rozpoczął się przed przyjęciem dziecka lub w dniu przyjęcia. Ustal z ZUS, którą część pobytu można uwzględnić.",
      );
    const applicableStays = placementDay
      ? hospitalStays.filter(({ from }) => from > placementDay)
      : hospitalStays;
    if (!applicableStays.length)
      return standardDecision("Brakuje pobytu w szpitalu po przyjęciu dziecka na wychowanie.");
    const supplement = calculateSupplement(
      {
        birthDate: f.birth,
        childrenBorn: f.children,
        gestationalWeeks: f.gestationalWeeks,
        birthWeightGrams: f.birthWeightGrams,
        hospitalized: true,
        hospitalStays: applicableStays,
      },
      asOf,
      f.combinedHospitalEvidence,
    );
    if (supplement.state === "review") return review(supplement.reason);
    if (supplement.state !== "calculated")
      return need(
        stays ? "hospitalRanges" : "hospitalThrough",
        "Sprawdź daty rzeczywistego pobytu dziecka w szpitalu.",
      );
    if (supplement.weeks === 0)
      return standardDecision(
        "Podany pobyt nie daje dodatkowych tygodni według reguł hospitalizacji.",
      );
    extent = supplement.weeks * 7;
    if (requestedDays !== undefined && requestedDays !== extent)
      return need(
        periodField,
        `Uzupełniający macierzyński przysługuje jednorazowo w wymiarze ${extent} dni.`,
      );
  }
  if (sickness) {
    cap = 270 - (f.sickDaysUsed ?? 0);
    if (!cap)
      return review(
        "Okres zasiłkowy został wyczerpany. Sprawdź warunki świadczenia rehabilitacyjnego.",
      );
  }
  if (rehab) {
    cap = 360 - (f.rehabUsed ?? 0);
    if (!cap) return standardDecision("Wykorzystano już 360 dni świadczenia rehabilitacyjnego.");
  }
  if (extent) {
    cap = extent;
    through ??= addDays(from, extent - 1);
  }
  if (!through) return { ...need("through"), coverageDay, maximumDays: cap };
  if ((sickness || rehab) && !afterInsurance && employmentEnded && through > employmentEnded) {
    return need(
      periodField,
      "Sprawdź oddzielnie okres do ustania ubezpieczenia i okres po ustaniu. Dla drugiego okresu obowiązują odrębne warunki i ograniczenie podstawy.",
    );
  }
  if (rehab && birth && through >= birth) {
    if (from >= birth) return review("Sprawdź z ZUS stawkę i prawo po porodzie.");
    return need(periodField, "Skróć okres do dnia przed porodem, aby obliczyć stawkę w ciąży.");
  }
  const days = daysBetween(from, through) + 1;
  if (cap !== undefined && days > cap)
    return {
      ...need(
        periodField,
        "Okres przekracza dostępny wymiar. Skróć go lub sprawdź wcześniej wykorzystane dni.",
      ),
      coverageDay,
      maximumDays: cap,
    };
  if (!sickness && !projected && f.documentDate && f.documentDate > asOf)
    return review("Data wniosku przypada po dacie oceny.");
  const rateChoice = !projected && (benefit === "maternity" || care || (parental && !f.reserved));
  if (rateChoice && !f.averagedRequest && f.standardRate !== true) return need("standardRate");
  const rateAnchor = careAnchor ?? birth;
  if (rateChoice && rateAnchor && f.averagedRequest) {
    if (f.averagedRequest < isoDate(rateAnchor))
      return need("averagedRequest", "Podaj datę po zdarzeniu rozpoczynającym termin.");
    if (f.averagedRequest <= isoDate(addDays(rateAnchor, 21))) {
      if (parental && from >= addMonths(rateAnchor, 12)) {
        if (f.parentalInFirstYear === undefined) return need("parentalInFirstYear");
        if (f.parentalInFirstYear) rate = 8150;
      } else {
        rate = 8150;
      }
    }
  }
  const work = parental ? (f.workPercent ?? 0) : 0;
  const extensionWork = work > 0 ? (f.extensionWorkPercent ?? 0) : 0;
  if (work > 0 && f.employment !== "employee")
    return review(
      "Przeliczenie łączenia urlopu z pracą dotyczy pracy u pracodawcy udzielającego urlopu.",
    );
  if (work > 0 && f.employmentPercent === undefined) return need("employmentPercent");
  if (f.employmentPercent !== undefined && work > f.employmentPercent)
    return need("workPercent", "Podaj wymiar pracy mieszczący się w Twoim zwykłym etacie.");
  if (f.employmentPercent !== undefined && extensionWork > f.employmentPercent)
    return need(
      "extensionWorkPercent",
      "Podaj wymiar pracy mieszczący się w Twoim zwykłym etacie.",
    );
  const extensionDays = Math.floor((Math.floor((days * work) / 100) * 100) / (100 - extensionWork));
  const extensionEnd = addDays(through, extensionDays);
  if (extensionDays && parentalAgeLimit && isoDate(extensionEnd) > parentalAgeLimit)
    return need(
      "extensionWorkPercent",
      "Wydłużenie wykracza poza granicę wieku dziecka. Skróć planowany okres lub zmień wymiar pracy w wydłużeniu.",
    );
  const rule = minimumPay.find(
    ({ from, through }) => from <= coverageDay && coverageDay <= through,
  );
  const firstRehabDay = rehab && f.rehabUsed ? parseDate(f.rehabStart) : from;
  if (
    rehab &&
    f.basis === undefined &&
    f.rehabSickBasis &&
    (!firstRehabDay || firstRehabDay >= from) &&
    f.rehabUsed
  )
    return need("rehabStart", "Podaj pierwszy dzień wcześniejszego okresu tego świadczenia.");
  const indexedBasis =
    rehab && f.rehabSickBasis && firstRehabDay
      ? indexedRehabilitationBasis(f.rehabSickBasis, firstRehabDay)
      : undefined;
  const basis =
    f.basis ??
    indexedBasis ??
    (!rehab &&
    f.employment === "employee" &&
    f.fixedSalary !== undefined &&
    rule &&
    f.fixedSalary >= rule.debtLimit * 100
      ? Math.round(f.fixedSalary * 0.8629)
      : undefined);
  const fromDay = isoDate(from);
  const throughDay = isoDate(through);
  const capped =
    afterInsurance && basis !== undefined
      ? postInsuranceBasis(fromDay, throughDay, basis)
      : undefined;
  if (afterInsurance && basis !== undefined && !capped)
    return review(
      "Dla części okresu brakuje zweryfikowanego limitu podstawy po ustaniu ubezpieczenia. Sprawdź daty i limit ZUS.",
    );
  const moneyParts = capped?.map(({ from, through, basis }) => {
    const days = daysBetween(new Date(from), new Date(through)) + 1;
    const { daily } = benefitMoney(basis, rate, days);
    return { from, through, basis, daily, days };
  });
  const money = moneyParts?.length
    ? {
        basis: moneyParts[0].basis,
        daily: moneyParts[0].daily,
        total: moneyParts.reduce((sum, part) => sum + part.daily * part.days, 0),
      }
    : basis === undefined
      ? undefined
      : benefitMoney(basis, rate, days, work, f.employmentPercent);
  const payer =
    beforeBirth || postEmployment || f.employment === "business" || f.employment === "collaborator"
      ? "zus"
      : (f.payer ??
        (f.insuredHeadcount === undefined
          ? undefined
          : f.insuredHeadcount > 20
            ? "employer"
            : "zus"));
  return {
    ...result(
      "eligible",
      projected
        ? "Przy podanych założeniach spełnisz podstawowe warunki zasiłku. Sprawdź je ponownie po porodzie."
        : rehab && f.basis === undefined && f.rehabSickBasis && indexedBasis === undefined
          ? "Brakuje wskaźnika waloryzacji dla tego kwartału. Podaj podstawę świadczenia ustaloną przez płatnika."
          : "Podane dane spełniają warunki tej symulacji.",
    ),
    coverageDay,
    demoParametersApplied: parental && demoRate && coverageDay >= demoRate.from ? true : undefined,
    period: { from: fromDay, through: throughDay, days },
    rate,
    maximumDays: cap,
    extensionDays: work ? extensionDays : undefined,
    extension: extensionDays
      ? {
          through: isoDate(extensionEnd),
          workPercent: extensionWork,
          money:
            basis === undefined
              ? undefined
              : benefitMoney(basis, rate, extensionDays, extensionWork, f.employmentPercent),
        }
      : undefined,
    money,
    moneyParts: moneyParts && moneyParts.length > 1 ? moneyParts : undefined,
    missing: basis === undefined ? "basis" : payer ? undefined : "payer",
    payer,
    documents: payer
      ? documentsFor(
          benefit,
          { ...f, payer },
          projected ? coverageDay : (f.documentDate ?? asOf),
          from,
        )
      : [],
  };
}
