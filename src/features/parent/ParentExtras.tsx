import { useState } from "react";
import type { SubmitEvent } from "react";
import { Button, ButtonLink } from "../../components/ui/Button";
import { addDays, isoDate, parseDate } from "../../engine/dates";
import { assessBenefit } from "../../engine/parent-benefit";
import type { DemoRate } from "../../engine/parent-benefit";
import { formatDay, moneyLabel } from "../../engine/parent-case";
import type { Benefit, CaseFacts, FactKey } from "../../engine/parent-case";
import { compareParentalPlans } from "../../engine/parent-plan";
import type { PlanOptions } from "../../engine/parent-plan";
import { fields } from "./case-fields";
import { FactControl } from "./FactControl";
import styles from "./ParentCard.module.css";

export function FamilyPlanner({
  facts,
  asOf,
  demoRate,
  onFacts,
}: {
  facts: CaseFacts;
  asOf: string;
  demoRate?: DemoRate;
  onFacts: (facts: CaseFacts) => void;
}) {
  const [options, setOptions] = useState<PlanOptions>();
  const birth = parseDate(facts.birth);
  const required: FactKey[] = [
    "birth",
    "children",
    "employment",
    "insured",
    "basis",
    "careCertificate",
  ];
  if (!facts.averagedRequest) required.push("standardRate");
  const missing = required.find((key) => facts[key] === undefined);
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const start = data.get("start");
    setOptions({
      start: typeof start === "string" ? start : "",
      weeks: Number(data.get("weeks")),
      otherWeeks: Number(data.get("otherWeeks")),
      otherBasis: Math.round(Number(data.get("otherBasis")) * 100),
      together: data.get("together") === "on",
      workPercent: Number(data.get("work")),
    });
  }
  const comparison = options ? compareParentalPlans(facts, options, asOf, demoRate) : undefined;
  return (
    <section className={styles.card} aria-label="Plan rodzicielski">
      <h2>Podzielcie rodzicielski</h2>
      <p>Porównajcie urlop po kolei z wybranym podziałem i powrotem do pracy.</p>
      <small>
        Wariant zakłada etat i chorobowe drugiego rodzica oraz wykorzystanie wydłużenia bez pracy.
        Podajcie początek po zakończeniu macierzyńskiego, w tym ewentualnego uzupełniającego.
      </small>
      {missing ? (
        <>
          <p>
            {missing === "insured"
              ? "Czy na początku planu będzie Cię obejmować ubezpieczenie chorobowe?"
              : fields[missing].question}
          </p>
          <FactControl key={missing} fact={missing} onSave={onFacts} />
        </>
      ) : (
        <form className={styles.card} onSubmit={submit}>
          <div className={styles.row}>
            <label className={styles.field}>
              Początek
              <input
                name="start"
                type="date"
                defaultValue={birth && facts.children === 1 ? isoDate(addDays(birth, 140)) : ""}
                required
              />
            </label>
            <label className={styles.field}>
              Twoje tygodnie
              <input name="weeks" type="number" min="1" max="67" defaultValue="10" required />
            </label>
            <label className={styles.field}>
              Tygodnie drugiej osoby
              <input name="otherWeeks" type="number" min="1" max="67" defaultValue="9" required />
            </label>
            <label className={styles.field}>
              Podstawa drugiej osoby (zł)
              <input
                name="otherBasis"
                type="number"
                step="0.01"
                min="0.01"
                max="1000000"
                required
              />
            </label>
            <label className={styles.field}>
              Powrót do pracy
              <select name="work">
                <option value="0">Bez pracy</option>
                <option value="25">¼ etatu</option>
                <option value="50">½ etatu</option>
              </select>
            </label>
          </div>
          <label>
            <input name="together" type="checkbox" defaultChecked /> Zacznijcie w tym samym dniu
          </label>
          <Button size="sm" variant="brand" type="submit">
            Porównaj
          </Button>
        </form>
      )}
      {options && !comparison ? (
        <output>Sprawdź podstawy, datę i liczbę tygodni w granicach wspólnej puli.</output>
      ) : null}
      {comparison ? (
        <div className={styles.row} aria-live="polite">
          {Object.entries(comparison).map(([key, plan]) => (
            <div key={key} className={styles.card}>
              <h3>{key === "standard" ? "Po kolei, bez pracy" : "Wasz wariant"}</h3>
              {plan.firstTotal !== undefined && plan.second.money ? (
                <>
                  <p>
                    Ty: {moneyLabel(plan.firstTotal)} · druga osoba:{" "}
                    {moneyLabel(plan.second.money.total)}
                  </p>
                  <p>Razem: {moneyLabel(plan.firstTotal + plan.second.money.total)} brutto</p>
                  <p>Plan kończy się {formatDay(plan.last)}.</p>
                </>
              ) : (
                <p>
                  {plan.first.status === "eligible" && plan.second.status === "eligible"
                    ? "Uzupełnij podstawę lub sposób ustalenia stawki."
                    : [plan.first, plan.second].find((row) => row.status !== "eligible")?.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

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
      {insured ? (
        <p>
          Zaświadczenie o zadłużeniu wykazuje saldo {moneyLabel(demoPaternityWithInsurance.debt)}.
        </p>
      ) : null}
      <Button
        size="sm"
        variant="brand"
        onClick={() =>
          onLoad(insured ? demoPaternityWithInsurance : { ...demoPaternityFacts, insured: false })
        }
      >
        Użyj fikcyjnych danych w rozmowie
      </Button>
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
  const [receipt, setReceipt] = useState(false);
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
              setReceipt(false);
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
      {selected === "usc" ? (
        <>
          <p>Przygotuj demonstracyjne zgłoszenie odpisu skróconego aktu urodzenia.</p>
          <Button size="sm" variant="brand" onClick={() => setReceipt(true)}>
            Symuluj złożenie w USC
          </Button>
          {receipt ? <output>Symulacja zakończona. Adresat: Urząd Stanu Cywilnego.</output> : null}
        </>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onAdmin}>
        Panel administracyjny demo
      </Button>
    </section>
  );
}

const demoParental: CaseFacts = {
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
};

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
    if (typeof from === "string" && parseDate(from) && percent >= 1 && percent <= 100) {
      onChange({ from, parental: Math.round(percent * 100) });
    }
  }

  return (
    <section className={styles.card} aria-label="Panel administracyjny demo">
      <h2>Panel administracyjny demo</h2>
      <p>Symulacja zmiany stawki podstawowej za rodzicielski. Ustawienie działa w tej sesji.</p>
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
        <Button variant="brand" type="submit" size="sm">
          Przelicz przykład
        </Button>
      </form>
      {before && after ? (
        <output>
          Fikcyjny rodzicielski od 2.11.2026. Przed zmianą {moneyLabel(before.total)}, po zmianie{" "}
          {moneyLabel(after.total)}.
        </output>
      ) : null}
      {rate ? (
        <Button variant="ghost" size="sm" onClick={() => onChange()}>
          Przywróć stawkę z przepisów
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
