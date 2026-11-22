import { useState } from "react";
import type { SubmitEvent } from "react";
import { Button, ButtonLink } from "../../components/ui/Button";
import { parseDate } from "../../engine/dates";
import { assessBenefit } from "../../engine/parent-benefit";
import type { DemoRate } from "../../engine/parent-benefit";
import { formatDay, moneyLabel } from "../../engine/parent-case";
import type { Benefit, CaseFacts } from "../../engine/parent-case";
import styles from "./ParentCard.module.css";

const demoPaternityFacts = {
  birth: "2026-08-12",
  from: "2026-11-02",
  through: "2026-11-08",
  employment: "business",
  paternityUsed: "none",
} satisfies CaseFacts;

const demoPaternityWithInsurance = {
  ...demoPaternityFacts,
  insured: true,
  debt: 0,
  basis: 600_000,
  payer: "zus",
} satisfies CaseFacts;

function ZusSimulation({ onLoad }: { onLoad: (facts: CaseFacts) => void }) {
  const [insured, setInsured] = useState(true);
  const [variant, setVariant] = useState("0");
  const [certificate, setCertificate] = useState(false);
  const [questionSent, setQuestionSent] = useState(false);
  const debt = Number(variant);
  return (
    <>
      <p>
        Fikcyjne dane osoby prowadzącej działalność gospodarczą. Stan na{" "}
        {formatDay(demoPaternityFacts.from)} r.
      </p>
      <label className={styles.field}>
        Ubezpieczenie chorobowe
        <select
          value={insured ? "insured" : "uninsured"}
          onChange={(event) => setInsured(event.currentTarget.value === "insured")}
        >
          <option value="insured">Aktywne ubezpieczenie</option>
          <option value="uninsured">Brak ubezpieczenia</option>
        </select>
      </label>
      <details>
        <summary>Dane na koncie ubezpieczonego</summary>
        <dl className={styles.values}>
          <div>
            <dt>Tytuł</dt>
            <dd>Działalność gospodarcza</dd>
          </div>
          <div>
            <dt>Chorobowe</dt>
            <dd>{insured ? "Aktywne" : "Brak"}</dd>
          </div>
          <div>
            <dt>Podstawa zasiłku</dt>
            <dd>{insured ? moneyLabel(demoPaternityWithInsurance.basis) : "Brak danych"}</dd>
          </div>
        </dl>
      </details>
      {insured ? (
        <div className={styles.card}>
          <h3>Zaświadczenie o zadłużeniu w dniu powstania prawa</h3>
          <label className={styles.field}>
            Fikcyjne saldo
            <select
              value={variant}
              onChange={(event) => {
                setVariant(event.currentTarget.value);
                setCertificate(false);
              }}
            >
              <option value="0">0,00 zł</option>
              <option value="4806">48,06 zł</option>
              <option value="4807">48,07 zł</option>
            </select>
          </label>
          <Button size="sm" variant="outline" onClick={() => setCertificate(true)}>
            Wystaw zaświadczenie demo
          </Button>
          {certificate ? (
            <output>
              Saldo na {formatDay(demoPaternityFacts.from)} r. wynosi {moneyLabel(debt)}.
            </output>
          ) : null}
        </div>
      ) : null}
      <Button
        size="sm"
        variant="brand"
        onClick={() =>
          onLoad(
            insured
              ? { ...demoPaternityWithInsurance, debt }
              : { ...demoPaternityFacts, insured: false },
          )
        }
      >
        Użyj fikcyjnych danych w rozmowie
      </Button>
      <details>
        <summary>Zadaj pytanie w eZUS</summary>
        <form
          className={styles.card}
          onSubmit={(event) => {
            event.preventDefault();
            const question = new FormData(event.currentTarget).get("question");
            if (typeof question === "string" && question.trim()) setQuestionSent(true);
          }}
        >
          <label className={styles.field}>
            Pytanie demonstracyjne
            <input
              name="question"
              required
              maxLength={250}
              onChange={() => setQuestionSent(false)}
            />
          </label>
          <Button size="sm" variant="outline" type="submit">
            Zarejestruj pytanie demo
          </Button>
          {questionSent ? (
            <output>
              Pytanie zarejestrowane w symulacji. Status demonstracyjny: oczekuje na odpowiedź.
            </output>
          ) : null}
        </form>
      </details>
    </>
  );
}

export function SimulationCard({
  onLoad,
  onAdmin,
}: {
  onLoad: (benefit: Benefit, facts: CaseFacts) => void;
  onAdmin: () => void;
}) {
  const [selected, setSelected] = useState<"zus" | "usc" | "medical">();
  return (
    <section className={styles.card} aria-label="Symulacja usług">
      <h2>Usługi demonstracyjne</h2>
      <p className={styles.muted}>Symulacja. Pokazuje fikcyjne dane i potwierdzenia.</p>
      <div className={styles.actions}>
        {(
          [
            { key: "zus", label: "eZUS" },
            { key: "medical", label: "e-ZLA" },
            { key: "usc", label: "Odpis aktu" },
          ] as const
        ).map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={selected === key ? "secondary" : "outline"}
            onClick={() => {
              setSelected(key);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {selected === "zus" ? <ZusSimulation onLoad={(facts) => onLoad("paternity", facts)} /> : null}
      {selected === "medical" ? (
        <>
          <p>Zwolnienie demonstracyjne od 2 do 15 listopada 2026 r. Kod B.</p>
          <Button
            size="sm"
            variant="brand"
            onClick={() =>
              onLoad("sickness", {
                from: "2026-11-02",
                through: "2026-11-15",
                employment: "contract",
                insured: true,
                basis: 600_000,
                payer: "zus",
                pregnancyProof: true,
                qualifying: true,
                sickDaysUsed: 0,
              })
            }
          >
            Sprawdź chorobowy z tych danych
          </Button>
        </>
      ) : null}
      {selected === "usc" ? <UscSimulation /> : null}
      <Button size="sm" variant="ghost" onClick={onAdmin}>
        Panel administracyjny demo
      </Button>
    </section>
  );
}

function UscSimulation() {
  const [receipt, setReceipt] = useState("");
  return (
    <form
      className={styles.card}
      onChange={() => setReceipt("")}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setReceipt(data.get("copy") === "full" ? "zupełny" : "skrócony");
      }}
    >
      <h3>Odpis aktu urodzenia</h3>
      <p>Użyj fikcyjnych danych na potrzeby symulacji.</p>
      <div className={styles.row}>
        <label className={styles.field}>
          Rodzaj odpisu
          <select name="copy">
            <option value="short">Skrócony</option>
            <option value="full">Zupełny</option>
          </select>
        </label>
        <label className={styles.field}>
          Imię i nazwisko dziecka
          <input name="child" required maxLength={100} defaultValue="Aleksandra Kowalska" />
        </label>
        <label className={styles.field}>
          Data urodzenia dziecka
          <input name="birth" type="date" required defaultValue={demoPaternityFacts.birth} />
        </label>
        <label className={styles.field}>
          Miejsce urodzenia dziecka
          <input name="place" required maxLength={100} defaultValue="Bydgoszcz" />
        </label>
      </div>
      <Button size="sm" variant="brand" type="submit">
        Symuluj złożenie w USC
      </Button>
      {receipt ? (
        <output>Dyspozycja demo przyjęta przez USC. Wybrany odpis: {receipt}.</output>
      ) : null}
    </form>
  );
}

const demoParental = {
  birth: "2026-03-01",
  from: "2026-11-02",
  through: "2026-11-08",
  employment: "employee",
  insured: true,
  basis: 600_000,
  children: 1,
  standardRate: true,
  careCertificate: false,
  parts: 0,
  usedDays: 0,
  otherParentDays: 0,
  soleParent: false,
  reserved: false,
  payer: "zus",
} satisfies CaseFacts;

export function AdminCard({
  rate,
  onChange,
  asOf,
}: {
  rate?: DemoRate;
  onChange: (rate?: DemoRate) => void;
  asOf: string;
}) {
  const before = assessBenefit("parental", demoParental, asOf).money;
  const after = assessBenefit("parental", demoParental, asOf, rate).money;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = data.get("from");
    const percent = Number(data.get("rate"));
    const singleChildWeeks = Number(data.get("weeks"));
    if (
      typeof from === "string" &&
      parseDate(from) &&
      percent >= 1 &&
      percent <= 100 &&
      Number.isInteger(singleChildWeeks) &&
      singleChildWeeks >= 18 &&
      singleChildWeeks <= 67
    ) {
      onChange({ from, parental: Math.round(percent * 100), singleChildWeeks });
    }
  }

  return (
    <section className={styles.card} aria-label="Panel administracyjny demo">
      <h2>Panel administracyjny demo</h2>
      <p>
        Symulacja zmiany stawki podstawowej lub wspólnego wymiaru przy jednym dziecku bez
        zaświadczenia „Za życiem”. Ustawienie działa w tej sprawie.
      </p>
      <form className={styles.row} onSubmit={submit}>
        <label className={styles.field}>
          Stawka (%)
          <input
            name="rate"
            type="number"
            min="1"
            max="100"
            step="0.01"
            defaultValue={(rate?.parental ?? 7000) / 100}
            required
          />
        </label>
        <label className={styles.field}>
          Obowiązuje od
          <input name="from" type="date" defaultValue={rate?.from ?? "2026-11-01"} required />
        </label>
        <label className={styles.field}>
          Tygodnie rodzicielskiego przy jednym dziecku
          <input
            name="weeks"
            type="number"
            min="18"
            max="67"
            defaultValue={rate?.singleChildWeeks ?? 41}
            required
          />
        </label>
        <Button variant="brand" type="submit" size="sm">
          Przelicz przykład
        </Button>
      </form>
      {before && after ? (
        <output>
          Fikcyjny rodzicielski od 2.11.2026. Przed zmianą {moneyLabel(before.total)}, po zmianie{" "}
          {moneyLabel(after.total)}. Wspólna pula po zmianie{" "}
          {rate && rate.from <= demoParental.from ? (rate.singleChildWeeks ?? 41) : 41} tygodni.
        </output>
      ) : null}
      {rate ? (
        <Button variant="ghost" size="sm" onClick={() => onChange()}>
          Przywróć parametry z przepisów
        </Button>
      ) : null}
      <a
        href="https://www.zus.pl/pl/swiadczenia/zasilki/zasilek-macierzynski/wysokosc"
        target="_blank"
        rel="noreferrer"
      >
        Źródło stawki obowiązującej
      </a>
    </section>
  );
}

export function SupportCard({ onStillbirth }: { onStillbirth: () => void }) {
  return (
    <section className={styles.card} aria-label="Wsparcie">
      <h2>Wsparcie w trudnej sytuacji</h2>
      <p>Możesz skorzystać z pomocy bez odpowiadania na pytania o swoją sytuację.</p>
      <Button size="sm" variant="outline" onClick={onStillbirth}>
        Sprawdź zasiłek po martwym urodzeniu
      </Button>
      <div className={styles.actions}>
        <ButtonLink
          size="sm"
          href="https://naglesami.org.pl/telefon-wsparcia-zaloba/"
          target="_blank"
          rel="noreferrer"
        >
          Wsparcie w żałobie
        </ButtonLink>
        <ButtonLink
          size="sm"
          href="https://wczesniak.pl/grupy-wsparcia/"
          target="_blank"
          rel="noreferrer"
        >
          Wsparcie po wcześniactwie
        </ButtonLink>
        <ButtonLink
          size="sm"
          href="https://gajusz.org.pl/jak-pomagamy/hospicjum-perinatalne/pomoc/"
          target="_blank"
          rel="noreferrer"
        >
          Hospicjum perinatalne
        </ButtonLink>
      </div>
      <a
        href="https://www.zus.pl/pl/swiadczenia/zasilki/zasilek-macierzynski/niezbedne-dokumenty"
        target="_blank"
        rel="noreferrer"
      >
        Dokumenty i formalności w ZUS
      </a>
    </section>
  );
}
