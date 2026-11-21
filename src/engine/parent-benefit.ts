import { addDays, addMonths, daysBetween, isoDate, parseDate } from "./dates";
import { calculateSupplement } from "./prematurity";
import type { Benefit, CaseFacts, FactKey } from "./parent-case";

type Status = "eligible" | "missing" | "ineligible" | "review";
type BenefitDocument = {
  title: string;
  recipient: string;
  source: string;
  deadline?: string;
  href?: string;
};
export type BenefitResult = {
  status: Status;
  reason: string;
  projected?: true;
  missing?: FactKey;
  coverageDay?: string;
  period?: { from: string; through: string; days: number };
  rate?: number;
  maximumDays?: number;
  extensionDays?: number;
  money?: { basis: number; daily: number; total: number };
  payer?: "zus" | "employer";
  documents: BenefitDocument[];
  source: string;
};

export type DemoRate = { from: string; parental: number };

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
const rehabDocuments =
  "https://www.zus.pl/swiadczenia/zasilki/swiadczenie-rehabilitacyjne/z-ubezpieczenia-chorobowego/niezbedne-dokumenty";
export function parentalPool(children: number, certificate: boolean) {
  return (certificate ? (children === 1 ? 65 : 67) : children === 1 ? 41 : 43) * 7;
}

export function benefitMoney(
  basis: number,
  rate: number,
  days: number,
  workPercent = 0,
  employmentPercent = 100,
) {
  const fullDaily = Math.round((Math.round(basis / 30) * rate) / 10_000);
  const daily = Math.round((fullDaily * (employmentPercent - workPercent)) / employmentPercent);
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
  if (
    f.employment === "employee" &&
    benefit !== "sickness" &&
    benefit !== "maternity" &&
    benefit !== "lossMaternity" &&
    benefit !== "rehabilitation"
  ) {
    const lead = benefit === "paternity" ? 7 : benefit === "supplement" ? 22 : 21;
    documents.push({
      title: {
        paternity: "Wniosek o urlop ojcowski",
        parental: "Wniosek o urlop rodzicielski",
        supplement: "Wniosek o uzupełniający urlop macierzyński",
        careMaternity: "Wniosek o urlop na warunkach macierzyńskiego",
      }[benefit],
      recipient: "Pracodawca",
      source: "laborLaw",
      deadline: benefit === "careMaternity" ? undefined : isoDate(addDays(from, -lead)),
    });
  }
  if (benefit === "rehabilitation") {
    documents.push({
      title: "Wniosek ZNp-7 i zaświadczenie o stanie zdrowia OL-9",
      recipient: "ZUS",
      source: "benefitsLaw",
      href: rehabDocuments,
    });
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
      });
  } else {
    if (f.payer === "zus") {
      const historicalForms = {
        maternity: "ZAM",
        paternity: "ZAO",
        parental: "ZUR",
        supplement: "wniosek wraz z zaświadczeniem szpitala",
        careMaternity: "ZAM",
        lossMaternity: "ZAM",
      };
      const form = currentForms ? "ZAM" : historicalForms[benefit];
      documents.push({
        title: "Wniosek o wypłatę (" + form + ")",
        recipient: payer,
        source: currentForms ? "zam" : "maternityDocs",
      });
    }
    documents.push({
      title:
        benefit === "supplement"
          ? "Zaświadczenie szpitala"
          : benefit === "careMaternity"
            ? f.careKind === "adoption"
              ? "Dokument przyjęcia dziecka i potwierdzenie wystąpienia do sądu o przysposobienie"
              : "Postanowienie sądu lub dokument o umieszczeniu w rodzinie zastępczej"
            : benefit === "lossMaternity"
              ? "Dokument potwierdzający martwe urodzenie dziecka"
              : currentForms && (benefit === "maternity" || benefit === "paternity")
                ? "Dane dziecka i drugiego rodzica (urodzenie w Polsce)"
                : "Dokument potwierdzający urodzenie dziecka",
      recipient: payer,
      source: benefit === "supplement" ? "supplement" : "maternityDocs",
    });
  }
  if (f.payer === "zus" && (f.employment === "employee" || f.employment === "contract")) {
    const employee = f.employment === "employee";
    documents.push({
      title: employee ? "Z-3 od pracodawcy" : "Z-3a od płatnika składek",
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
  const dueDate = benefit === "maternity" && !birth ? parseDate(f.dueDate) : undefined;
  const projected = benefit === "maternity" && !birth && (f.birthStage === "expected" || dueDate);
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
  const loss = benefit === "lossMaternity";
  const requested = projected ? undefined : parseDate(f.from);
  const explicitEnd = projected ? undefined : parseDate(f.through);
  const planDays = projected || explicitEnd ? undefined : f.requestedDays;
  if (f.exception)
    return review(
      "Ta sprawa wymaga uwzględnienia szczególnej podstawy lub odrębnego rozstrzygnięcia ZUS.",
    );
  if (!sickness && !rehab && f.birth && f.birth > asOf)
    return need("birth", "Data urodzenia może przypadać najpóźniej dzisiaj.");
  if (benefit === "paternity" && planDays !== undefined && !paternityDurations.includes(planDays))
    return need("requestedDays", "Wpisz 7 dni albo 14 dni ojcowskiego.");
  if (!requested && planDays !== undefined && benefit !== "maternity" && !loss) return need("from");
  if (!sickness && !rehab && !birth && !dueDate) {
    if (projected) return need("dueDate");
    return need(benefit === "maternity" && !f.birthStage ? "birthStage" : "birth");
  }
  if (benefit !== "maternity" && !loss && !requested) return need("from");
  const from = requested ?? birth ?? dueDate;
  if (!from) return need("from");
  if (birth && !sickness && !rehab && from < birth)
    return review("Okres przed porodem wymaga osobnego ustalenia zasad i dat.");
  const coverageDay = isoDate((benefit === "maternity" || loss) && birth ? birth : from);
  if (coverageDay < "2023-04-26")
    return review("Tę datę obejmują wcześniejsze reguły. Sprawdź je w ZUS.");
  if (!f.employment) return { ...need("employment"), coverageDay };
  if (f.insured === undefined) return { ...need("insured"), coverageDay };
  const standardDecision = (reason: string) => ({ ...deny(reason), coverageDay });
  if (!f.insured) {
    if (rehab)
      return review(
        "Świadczenie po ustaniu ubezpieczenia wymaga sprawdzenia odrębnych warunków w ZUS.",
      );
    if (
      !projected &&
      (benefit === "maternity" || loss) &&
      f.employment === "employee" &&
      f.exception === undefined
    )
      return need(
        "exception",
        "W określonych sytuacjach świadczenie może przysługiwać także po ustaniu zatrudnienia.",
      );
    if (benefit === "parental" || benefit === "supplement")
      return review("Sprawdź w ZUS, czy do tego okresu zachowujesz wcześniej nabyte prawo.");
    return standardDecision(
      projected
        ? "Przy założeniu braku ubezpieczenia w dniu porodu podstawowe warunki zasiłku nie będą spełnione. Szczególne okoliczności możesz sprawdzić z ZUS."
        : "W dniu istotnym dla tego świadczenia brak ubezpieczenia chorobowego z podanego tytułu.",
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
    if (f.qualifying === undefined) return need("qualifying");
    if (!f.qualifying)
      return standardDecision(
        "Według podanych danych wymagany okres wyczekiwania jeszcze nie upłynął.",
      );
    if (f.pregnancyProof === undefined) return need("pregnancyProof");
    if (!f.pregnancyProof)
      return review("Do obliczenia stawki dla ciąży potrzebne jest potwierdzenie ciąży.");
    if (f.employment === "employee" && f.employerSickPayEnded !== true) {
      return f.employerSickPayEnded === undefined
        ? need("employerSickPayEnded")
        : review(
            "Najpierw ustal z pracodawcą, które dni obejmuje wynagrodzenie chorobowe i od kiedy zaczyna się zasiłek.",
          );
    }
    if (f.sickDaysUsed === undefined) return need("sickDaysUsed");
  }
  if (rehab) {
    if (f.sickDaysUsed === undefined) return need("sickDaysUsed");
    if (f.sickDaysUsed < 270)
      return review("Sprawdź z ZUS, jaki okres zasiłkowy obowiązuje i kiedy został wyczerpany.");
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
  }

  let extent: number | undefined;
  let cap: number | undefined;
  let rate = 10_000;
  const periodField = planDays === undefined ? "through" : "requestedDays";
  let through = explicitEnd ?? (planDays === undefined ? undefined : addDays(from, planDays - 1));
  const requestedDays = through ? daysBetween(from, through) + 1 : undefined;
  if (requestedDays !== undefined && requestedDays <= 0)
    return need(periodField, "Koniec musi przypadać w dniu rozpoczęcia albo później.");
  if (benefit === "paternity" && birth) {
    if (from >= addMonths(birth, 12) || (through && through >= addMonths(birth, 12))) {
      return standardDecision(
        "W tej sprawie cały okres musi przypadać przed ukończeniem przez dziecko 12 miesięcy.",
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
      return need("from", "Początek tego okresu przypada w dniu martwego urodzenia.");
    if (!f.children) return need("children");
    if (f.children !== 1)
      return review("Przy porodzie mnogim znaczenie ma liczba dzieci, które pozostały przy życiu.");
    extent = 56;
  }
  if (care && birth) {
    if (!f.careKind) return need("careKind");
    if (f.careKind === "professional")
      return standardDecision(
        "Zasiłek z tego tytułu nie przysługuje rodzinie zastępczej zawodowej.",
      );
    if (f.previousCareBenefit === undefined) return need("previousCareBenefit");
    if (f.previousCareBenefit)
      return review("Ustal z ZUS wymiar po odjęciu okresu już wykorzystanego na to dziecko.");
    if (!f.children) return need("children", "Ile dzieci przyjęto jednocześnie na wychowanie?");
    if (f.children > 1)
      return review(
        "Przy jednoczesnym przyjęciu kilkorga dzieci trzeba porównać daty i wiek każdego dziecka.",
      );
    if (f.careKind === "adoption") {
      if (!f.courtApplication) return need("courtApplication");
      if (f.courtApplication > isoDate(from))
        return need(
          "from",
          "Początek okresu musi przypadać w dniu wystąpienia do sądu albo później.",
        );
    }
    if (f.careKind === "foster" && from >= addMonths(birth, 84) && f.schoolDeferral === undefined)
      return need("schoolDeferral");
    const birthdayLimit = addMonths(
      birth,
      (f.careKind === "adoption" ? 14 : f.schoolDeferral ? 10 : 7) * 12,
    );
    if (from >= birthdayLimit)
      return standardDecision(
        "W dniu podanym w sprawie dziecko osiągnęło już granicę wieku dla tego trybu przyjęcia.",
      );
    extent = Math.max(63, Math.min(140, daysBetween(from, birthdayLimit)));
  }
  if (benefit === "parental" && birth) {
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
    const available =
      parentalPool(f.children, f.careCertificate) -
      f.usedDays -
      Math.max(f.otherParentDays, f.soleParent ? 0 : 63);
    cap = Math.max(0, f.reserved ? Math.min(available, Math.max(0, 63 - f.usedDays)) : available);
    if (!cap) return standardDecision("W podanym wariancie dostępny wymiar został wykorzystany.");
    if (from < addDays(birth, maternityWeeks[Math.min(f.children, 5) - 1] * 7)) {
      return review(
        "Sprawdź, kiedy kończy się podstawowy okres macierzyński. Ten przypadek wymaga ustalenia kolejności okresów.",
      );
    }
    const limit = birth.getUTCFullYear() + 6 + "-12-31";
    if (isoDate(from) > limit || (through && isoDate(through) > limit))
      return standardDecision(
        "Okres wykracza poza koniec roku, w którym dziecko kończy sześć lat.",
      );
    rate = demoRate && coverageDay >= demoRate.from ? demoRate.parental : 7000;
  }
  if (benefit === "supplement" && birth) {
    if (!f.children) return need("children");
    if (f.gestationalWeeks === undefined) return need("gestationalWeeks");
    if (!f.birthWeightGrams) return need("birthWeightGrams");
    if (!f.hospitalFrom) return need("hospitalFrom");
    if (!f.hospitalThrough) return need("hospitalThrough");
    if (
      from.getTime() !== addDays(birth, maternityWeeks[Math.min(f.children, 5) - 1] * 7).getTime()
    )
      return review(
        "Uzupełniający okres powinien następować bezpośrednio po ustalonym macierzyńskim. Sprawdź datę końca macierzyńskiego.",
      );
    const supplement = calculateSupplement(
      {
        birthDate: f.birth,
        childrenBorn: f.children,
        gestationalWeeks: f.gestationalWeeks,
        birthWeightGrams: f.birthWeightGrams,
        hospitalized: true,
        hospitalStays: [{ from: f.hospitalFrom, through: f.hospitalThrough }],
      },
      asOf,
    );
    if (supplement.state === "review") return review(supplement.reason);
    if (supplement.state !== "calculated")
      return need("hospitalThrough", "Sprawdź daty rzeczywistego pobytu dziecka w szpitalu.");
    if (supplement.weeks === 0)
      return standardDecision(
        "Podany pobyt nie daje dodatkowych tygodni według reguł hospitalizacji.",
      );
    extent = supplement.weeks * 7;
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
  const rateChoice =
    !projected && (benefit === "maternity" || care || (benefit === "parental" && !f.reserved));
  if (rateChoice && !f.averagedRequest && f.standardRate !== true) return need("standardRate");
  const rateAnchor = care ? from : birth;
  if (rateChoice && rateAnchor && f.averagedRequest) {
    if (f.averagedRequest < isoDate(rateAnchor))
      return need("averagedRequest", "Podaj datę po zdarzeniu rozpoczynającym termin.");
    if (f.averagedRequest <= isoDate(addDays(rateAnchor, 21))) rate = 8150;
  }
  const work = benefit === "parental" ? (f.workPercent ?? 0) : 0;
  if (work > 0 && f.employment !== "employee")
    return review(
      "Przeliczenie łączenia urlopu z pracą dotyczy pracy u pracodawcy udzielającego urlopu.",
    );
  if (work > 0 && f.employmentPercent === undefined) return need("employmentPercent");
  if (f.employmentPercent !== undefined && work > f.employmentPercent)
    return need("workPercent", "Podaj wymiar pracy mieszczący się w Twoim zwykłym etacie.");
  const rule = minimumPay.find(
    ({ from, through }) => from <= coverageDay && coverageDay <= through,
  );
  const basis =
    f.basis ??
    (!rehab &&
    f.employment === "employee" &&
    f.fixedSalary !== undefined &&
    rule &&
    f.fixedSalary >= rule.debtLimit * 100
      ? Math.round(f.fixedSalary * 0.8629)
      : undefined);
  const payer =
    f.employment === "business" || f.employment === "collaborator"
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
        : "Podane dane spełniają warunki tej symulacji.",
    ),
    coverageDay,
    period: { from: isoDate(from), through: isoDate(through), days },
    rate,
    maximumDays: cap,
    extensionDays: work ? Math.floor((days * work) / 100) : undefined,
    money:
      basis === undefined ? undefined : benefitMoney(basis, rate, days, work, f.employmentPercent),
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
