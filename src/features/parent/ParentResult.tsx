import { useState } from "react";
import { Button, ButtonLink } from "../../components/ui/Button";
import { sources } from "../../data/sources";
import { formatDay, formatDays, labels, moneyLabel } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey, FactSource } from "../../engine/parent-case";
import type { BenefitResult } from "../../engine/parent-benefit";
import { maternityTopUp } from "../../engine/parent-benefit";
import { factValue, fields } from "./case-fields";
import { FactControl } from "./FactControl";
import styles from "./ParentCard.module.css";

function resultHeadline(result: BenefitResult) {
  return {
    eligible: result.projected ? "Prawo do zasiłku w prognozie" : "Warunki spełnione",
    missing: "Uzupełnij dane",
    ineligible: result.projected
      ? "Warunki niespełnione w prognozie"
      : "Brak prawa w podanej sytuacji",
    review: "Sprawdź tę sytuację z ZUS",
  }[result.status];
}

function documentLine(step: BenefitResult["documents"][number]) {
  return [step.title, step.recipient, step.deadline && "do " + formatDay(step.deadline)]
    .filter(Boolean)
    .join(" · ");
}

export function assessmentCopyText(
  message: string,
  benefit: Benefit,
  result: BenefitResult,
  showDocuments: boolean,
) {
  const { period, money, documents } = result;
  const nextStep = documents[0];
  return [
    message,
    [labels[benefit], resultHeadline(result)].join(" · "),
    result.status !== "missing" && result.reason !== message && result.reason,
    period &&
      `${result.projected ? "Przewidywany okres" : "Okres wypłaty"} ${formatDay(period.from)} – ${formatDay(period.through)} (${formatDays(period.days)}).`,
    money &&
      `${result.projected ? "Szacunkowa kwota brutto" : "Łączna kwota brutto"} ${moneyLabel(money.total + (result.extension?.money?.total ?? 0))}.`,
    showDocuments
      ? documents.map(documentLine).join("\n")
      : nextStep && "Następny krok: " + documentLine(nextStep),
  ]
    .filter(Boolean)
    .join("\n");
}

export function ResultCard({
  benefit,
  result,
  insured,
  futureCoverage,
  showTopUp,
  showReason = true,
}: {
  benefit: Benefit;
  result: BenefitResult;
  insured?: boolean;
  futureCoverage: boolean;
  showTopUp?: boolean;
  showReason?: boolean;
}) {
  const { period, money, documents: steps } = result;
  const total = money && money.total + (result.extension?.money?.total ?? 0);
  return (
    <section className={styles.result} aria-label="Wynik sprawdzenia">
      <h3 className={styles.resultHeadline}>{resultHeadline(result)}</h3>
      {showReason && result.status !== "missing" ? <p>{result.reason}</p> : null}
      {result.demoParametersApplied ? (
        <p className={styles.muted}>Wynik uwzględnia parametry demonstracyjne.</p>
      ) : null}
      {insured !== undefined && result.coverageDay ? (
        <p>
          Na {formatDay(result.coverageDay)}{" "}
          <strong>
            {futureCoverage
              ? insured
                ? "zakładamy ubezpieczenie chorobowe"
                : "zakładamy brak ubezpieczenia chorobowego"
              : insured
                ? "potwierdzono ubezpieczenie chorobowe"
                : "brak ubezpieczenia chorobowego"}
          </strong>{" "}
          z podanego tytułu.
        </p>
      ) : null}
      {result.projected && period && benefit === "maternity" ? (
        <p className={styles.muted}>
          Prognoza opiera się na przewidywanej dacie porodu i podstawowej stawce 100%.
        </p>
      ) : null}
      {period ? (
        <dl className={styles.resultNumbers}>
          <div>
            <dt>{result.projected ? "Przewidywany okres" : "Okres wypłaty"}</dt>
            <dd>
              <strong>{formatDays(period.days)}</strong>
              <span>
                {formatDay(period.from)} – {formatDay(period.through)}
              </span>
            </dd>
          </div>
          <div>
            <dt>{result.projected ? "Szacunkowa kwota brutto" : "Łączna kwota brutto"}</dt>
            <dd>
              {total !== undefined ? (
                <strong>{moneyLabel(total)}</strong>
              ) : (
                "Do obliczenia po podaniu podstawy"
              )}
              {result.rate !== undefined ? (
                <span>
                  Stawka {new Intl.NumberFormat("pl-PL").format(result.rate / 100)}% podstawy
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : null}
      {result.extension && result.extensionDays ? (
        <p>
          Wydłużenie o {formatDays(result.extensionDays)} do {formatDay(result.extension.through)}.{" "}
          {result.extension.workPercent
            ? `Praca na ${result.extension.workPercent}% etatu.`
            : "Bez pracy w tym okresie."}
        </p>
      ) : null}
      {result.payer ? (
        <p>Wypłaca {result.payer === "zus" ? "ZUS" : "pracodawca lub płatnik składek"}.</p>
      ) : period ? (
        <p>Do uzupełnienia: kto wypłaca zasiłek.</p>
      ) : null}
      {money || result.coverageDay || steps.length ? (
        <details>
          <summary>Jak to ustaliłam</summary>
          {result.coverageDay && insured === undefined ? (
            <p>Dzień oceny ubezpieczenia: {formatDay(result.coverageDay)}.</p>
          ) : null}
          {result.moneyParts?.map(({ from, through, basis, daily, days }) => (
            <p key={from}>
              {formatDay(from)} – {formatDay(through)}. Podstawa {moneyLabel(basis)}. Kwota dzienna{" "}
              {moneyLabel(daily)} × {formatDays(days)}.
            </p>
          ))}
          {money && period && !result.moneyParts ? (
            <p>
              Podstawa {moneyLabel(money.basis)}. Kwota dzienna {moneyLabel(money.daily)} ×{" "}
              {formatDays(period.days)}.
            </p>
          ) : null}
          {result.extension?.money && result.extensionDays ? (
            <p>
              Wydłużenie: {moneyLabel(result.extension.money.daily)} ×{" "}
              {formatDays(result.extensionDays)}.
            </p>
          ) : null}
          <a href={sources[result.source]?.url} target="_blank" rel="noreferrer">
            Podstawa i zasady ZUS
          </a>
        </details>
      ) : null}
      {result.coverageDay ? (
        <details>
          <summary>Co może zmienić prawo lub kwotę</summary>
          <p>
            Ustanie umowy, zlecenia lub działalności może zakończyć ubezpieczenie chorobowe. Zmiana
            etatu albo składników pensji może zmienić podstawę zasiłku.
          </p>
          <p>
            ZUS może sprawdzić, czy zatrudnienie lub działalność rzeczywiście były wykonywane. Może
            też ustalić inną podstawę, jeśli zakwestionuje zmianę wynagrodzenia. Przy sporze poproś
            ZUS o ustalenie prawa i podstawy dla Twojej sprawy.
          </p>
          <a href={sources.pregnancy?.url} target="_blank" rel="noreferrer">
            Ochrona zatrudnienia w PIP
          </a>
        </details>
      ) : null}
      {period &&
      showTopUp &&
      !result.projected &&
      (benefit === "maternity" || benefit === "parental" || benefit === "supplement") ? (
        <TopUp period={period} />
      ) : null}
    </section>
  );
}

function TopUp({ period }: { period: NonNullable<BenefitResult["period"]> }) {
  const [month, setMonth] = useState(period.from.slice(0, 7));
  const [net, setNet] = useState("");
  const value =
    net === "" ? undefined : maternityTopUp(period, month, Math.round(Number(net) * 100));
  return (
    <details>
      <summary>Sprawdź podwyższenie niskiego zasiłku</summary>
      <p>
        Podaj kwotę po zaliczce na podatek za dni zasiłku w wybranym miesiącu. Jeśli zasiłek
        przysługuje z kilku tytułów, wpisz ich sumę.
      </p>
      <div className={styles.row}>
        <label className={styles.field}>
          Miesiąc
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className={styles.field}>
          Razem po zaliczce (zł)
          <input
            type="number"
            min="0"
            step="0.01"
            value={net}
            onChange={(event) => setNet(event.target.value)}
          />
        </label>
      </div>
      {value ? (
        <output>
          Za {value.days} dni podwyższenie wynosi {moneyLabel(value.topUp)}. Próg za ten okres to{" "}
          {moneyLabel(value.floor)}.
        </output>
      ) : null}
      <p>
        <a
          href="https://www.zus.pl/pl/swiadczenia/zasilki/zasilek-macierzynski/wysokosc"
          target="_blank"
          rel="noreferrer"
        >
          Zasady podwyższenia w ZUS
        </a>
      </p>
    </details>
  );
}

export function CaseFactsList({
  facts,
  sources: origins,
  onChange,
}: {
  facts: CaseFacts;
  sources: Partial<Record<FactKey, FactSource>>;
  onChange: (facts: CaseFacts) => void;
}) {
  const [selected, setSelected] = useState<FactKey>(facts.dueDate ? "dueDate" : "birth");
  return (
    <section className={styles.card} aria-label="Dane sprawy">
      <h2>Dane sprawy</h2>
      <label className={styles.field}>
        Wybierz daną
        <select value={selected} onChange={(event) => setSelected(event.target.value as FactKey)}>
          {(Object.keys(fields) as FactKey[]).map((key) => (
            <option key={key} value={key}>
              {fields[key].label}
            </option>
          ))}
        </select>
      </label>
      {facts[selected] !== undefined ? (
        <p>
          {factValue(selected, facts[selected])}{" "}
          <small>
            · {origins[selected]?.label}
            {origins[selected]?.page ? " · strona " + origins[selected]?.page : ""}
          </small>
        </p>
      ) : (
        <p className={styles.muted}>Czeka na uzupełnienie.</p>
      )}
      <FactControl
        key={selected}
        fact={selected}
        childrenCount={facts.children}
        onSave={onChange}
      />
      {facts[selected] !== undefined ? (
        <Button variant="ghost" size="sm" onClick={() => onChange({ [selected]: undefined })}>
          Usuń tę daną
        </Button>
      ) : null}
    </section>
  );
}

export function NextSteps({ benefit, result }: { benefit: Benefit; result: BenefitResult }) {
  const [draft, setDraft] = useState(false);
  const [formIndex, setFormIndex] = useState(0);
  const [applicant, setApplicant] = useState("");
  const [child, setChild] = useState("");
  const [notes, setNotes] = useState("");
  const period = result.period;
  const steps = result.documents;
  const forms = steps.filter(({ form }) => form);
  const first = forms[formIndex] ?? forms[0];
  const action = first?.form === "leave" ? "udzielenie urlopu" : "wypłatę świadczenia";
  const lastDay = result.extension?.through ?? period?.through;
  const draftText =
    period && first && lastDay && !result.projected
      ? [
          "Szkic demonstracyjny",
          first.title,
          "Adresat: " + first.recipient,
          "Wnioskodawca: " + applicant.trim(),
          child.trim() && "Dziecko: " + child.trim(),
          "Dotyczy: " + labels[benefit],
          `Wnoszę o ${action} za okres od ${formatDay(period.from)} do ${formatDay(lastDay)}.`,
          notes.trim() && "Oświadczenia lub informacje dodatkowe: " + notes.trim(),
          ...steps
            .filter((step) => !step.form && step.recipient === first.recipient)
            .map(({ title }) => "Do przygotowania: " + title),
        ]
          .filter(Boolean)
          .join("\n")
      : undefined;
  return (
    <section className={styles.result} aria-label="Dokumenty i dalsze kroki">
      <h3 className={styles.resultHeadline}>
        {result.projected ? "Dokumenty do przygotowania po porodzie" : "Dokumenty i dalsze kroki"}
      </h3>
      {steps.length ? (
        <ul className={styles.list}>
          {steps.map((step) => (
            <li key={step.title}>
              <a href={step.href ?? sources[step.source]?.url} target="_blank" rel="noreferrer">
                {step.title}
              </a>{" "}
              · {step.recipient}
              {step.deadline ? " · do " + formatDay(step.deadline) : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>Uzupełnij dane świadczenia, żeby zobaczyć właściwe dokumenty.</p>
      )}
      {steps.length ? (
        <p className={styles.muted}>
          {steps.some(({ form }) => form === "leave")
            ? "Wniosek o urlop złóż u pracodawcy w formie papierowej lub elektronicznej. "
            : ""}
          {steps.some(({ form, recipient }) => form === "benefit" && recipient === "ZUS")
            ? "Wniosek do ZUS możesz złożyć przez eZUS, w placówce lub pocztą. "
            : ""}
          {result.payer === "employer" && benefit !== "rehabilitation"
            ? "Dokumenty do wypłaty złóż u płatnika wskazanego w wyniku."
            : ""}
          {benefit === "rehabilitation"
            ? "ZUS zaleca złożyć wniosek co najmniej 6 tygodni przed końcem zasiłku chorobowego. Po ocenie medycznej ZUS wydaje decyzję i wskazuje płatnika."
            : ""}
        </p>
      ) : null}
      {draftText ? (
        <Button size="sm" variant="outline" onClick={() => setDraft(!draft)}>
          {draft ? "Ukryj szkic" : "Przygotuj szkic wniosku"}
        </Button>
      ) : null}
      {draft && draftText && first ? (
        <div className={styles.card}>
          <h3>Wypełnij wniosek demonstracyjny</h3>
          <label className={styles.field}>
            Rodzaj wniosku
            <select
              value={formIndex}
              onChange={(event) => setFormIndex(Number(event.currentTarget.value))}
            >
              {forms.map(({ title }, index) => (
                <option key={title} value={index}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.row}>
            <label className={styles.field}>
              Imię i nazwisko wnioskodawcy
              <input
                value={applicant}
                onChange={(event) => setApplicant(event.currentTarget.value)}
                maxLength={100}
              />
            </label>
            <label className={styles.field}>
              Imię i nazwisko dziecka, jeśli dotyczy
              <input
                value={child}
                onChange={(event) => setChild(event.currentTarget.value)}
                maxLength={100}
              />
            </label>
          </div>
          <label className={styles.field}>
            Oświadczenia lub informacje dodatkowe
            <input
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              maxLength={400}
            />
          </label>
          <p>
            Adresat: {first.recipient}. Dotyczy: {labels[benefit]}.
          </p>
          {period && lastDay ? (
            <p>
              Okres od {formatDay(period.from)} do {formatDay(lastDay)}.
            </p>
          ) : null}
          <ButtonLink
            href={first.href ?? sources[first.source]?.url ?? "https://www.zus.pl"}
            target="_blank"
            rel="noreferrer"
            size="sm"
          >
            Otwórz oficjalną instrukcję
          </ButtonLink>
          {applicant.trim() ? (
            <a
              href={"data:text/plain;charset=utf-8," + encodeURIComponent(draftText)}
              download="mila-szkic-wniosku.txt"
            >
              Pobierz szkic
            </a>
          ) : (
            <p className={styles.muted}>Wpisz imię i nazwisko wnioskodawcy, żeby pobrać szkic.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
