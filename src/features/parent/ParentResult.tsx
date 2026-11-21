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
  const headline = {
    eligible: result.projected ? "Prawo do zasiłku w prognozie" : "Warunki spełnione",
    missing: "Uzupełnij dane",
    ineligible: result.projected
      ? "Warunki niespełnione w prognozie"
      : "Brak prawa w podanej sytuacji",
    review: "Sprawdź tę sytuację z ZUS",
  }[result.status];
  return (
    <section className={styles.result} aria-label="Wynik sprawdzenia">
      <h3 className={styles.resultHeadline}>{headline}</h3>
      {showReason && result.status !== "missing" ? <p>{result.reason}</p> : null}
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
      {result.projected && period ? (
        <p className={styles.muted}>
          Prognoza zakłada początek zasiłku w dniu porodu i podstawową stawkę 100%.
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
              {money ? (
                <strong>{moneyLabel(money.total)}</strong>
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
      {result.extensionDays !== undefined ? (
        <p>
          Wydłużenie o {result.extensionDays} pełnych dni przy wykorzystaniu wydłużenia bez pracy.
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
          {money && period ? (
            <p>
              Podstawa {moneyLabel(money.basis)}. Kwota dzienna {moneyLabel(money.daily)} ×{" "}
              {formatDays(period.days)}.
            </p>
          ) : null}
          <a href={sources[result.source]?.url} target="_blank" rel="noreferrer">
            Podstawa i zasady ZUS
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
      <FactControl key={selected} fact={selected} onSave={onChange} />
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
  const period = result.period;
  const steps = result.documents;
  const first = steps[0];
  const draftText =
    period && first && !result.projected
      ? "Szkic demonstracyjny\n\nAdresat: " +
        first.recipient +
        "\nDotyczy: " +
        labels[benefit] +
        "\n\nWnoszę o " +
        (first.title.startsWith("Wniosek o urlop") ? "udzielenie urlopu" : "wypłatę świadczenia") +
        " za okres od " +
        formatDay(period.from) +
        " do " +
        formatDay(period.through) +
        "."
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
      {draftText ? (
        <Button size="sm" variant="outline" onClick={() => setDraft(!draft)}>
          {draft ? "Ukryj szkic" : "Przygotuj szkic wniosku"}
        </Button>
      ) : null}
      {draft && draftText && first ? (
        <div className={styles.card}>
          <h3>Szkic demonstracyjny</h3>
          <p>
            Adresat: {first.recipient}. Dotyczy: {labels[benefit]}.
          </p>
          <p>{draftText.split("\n\n").at(-1)}</p>
          <ButtonLink
            href={first.href ?? sources[first.source]?.url ?? "https://www.zus.pl"}
            target="_blank"
            rel="noreferrer"
            size="sm"
          >
            Otwórz oficjalną instrukcję
          </ButtonLink>
          <a
            href={"data:text/plain;charset=utf-8," + encodeURIComponent(draftText)}
            download="mila-szkic-wniosku.txt"
          >
            Pobierz szkic
          </a>
        </div>
      ) : null}
    </section>
  );
}
