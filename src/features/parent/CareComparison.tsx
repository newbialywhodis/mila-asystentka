import type { ParentWorkspace } from "./useParentWorkspace";
import { personLabel } from "./workspace-session";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { addDays, isoDate, parseDate } from "../../engine/dates";
import {
  caseFactsSchema,
  employmentLabels,
  formatDay,
  formatDays,
  moneyLabel,
} from "../../engine/parent-case";
import type { CaseFacts, FactKey } from "../../engine/parent-case";
import { compareParentalPlans } from "../../engine/parent-plan";
import type { PlanOptions } from "../../engine/parent-plan";
import { MilaMessage } from "../guide/ThreadMessage";
import { fields } from "./case-fields";
import type { CareComparisonTurn } from "./case-session";
import styles from "./CareComparison.module.css";
import { FactControl } from "./FactControl";
import { careComparisonExample } from "./parent-examples";
import cardStyles from "./ParentCard.module.css";

function missingFact(facts: CaseFacts): FactKey | undefined {
  const required: FactKey[] = ["birth", "children", "employment", "insured"];
  if (facts.insured && (facts.employment === "business" || facts.employment === "collaborator"))
    required.push("debt");
  required.push("basis", "careCertificate", "parts");
  if (facts.parts) required.push("usedDays", "otherParentDays");
  if (!facts.averagedRequest && facts.standardRate !== true) required.push("standardRate");
  return required.find(
    (key) => facts[key] === undefined || (key === "standardRate" && !facts[key]),
  );
}

function readOptions(form: HTMLFormElement): PlanOptions | undefined {
  if (!form.matches(":valid")) return;
  const data = new FormData(form);
  const start = data.get("start");
  const employment = caseFactsSchema.shape.employment.safeParse(data.get("otherEmployment"));
  const insured = data.get("otherInsured");
  if (typeof start !== "string" || !employment.success || (insured !== "yes" && insured !== "no"))
    return;
  const otherDebt = data.get("otherDebt");
  const readBalance = (name: string) => {
    const value = data.get(name);
    return typeof value === "string" && value !== "" ? Math.round(Number(value) * 100) : undefined;
  };
  const motherInsured = data.get("motherMaternityInsured");
  const fatherInsured = data.get("fatherMaternityInsured");
  const canCompareMaternity =
    data.get("compareMaternity") === "on" &&
    (motherInsured === "yes" || motherInsured === "no") &&
    (fatherInsured === "yes" || fatherInsured === "no");
  return {
    start,
    weeks: Number(data.get("weeks")),
    otherWeeks: Number(data.get("otherWeeks")),
    otherBasis: Math.round(Number(data.get("otherBasis")) * 100),
    otherEmployment: employment.data,
    otherInsured: insured === "yes",
    otherDebt: otherDebt === "" ? undefined : Math.round(Number(otherDebt) * 100),
    together: data.get("together") === "on",
    workPercent: Number(data.get("work")),
    employmentPercent: Number(data.get("employmentPercent")) || undefined,
    extensionWorkPercent: Number(data.get("extensionWork")),
    maternity: canCompareMaternity
      ? {
          motherDays: Number(data.get("motherMaternityWeeks")) * 7,
          motherInsured: motherInsured === "yes",
          fatherInsured: fatherInsured === "yes",
          motherDebt: readBalance("motherMaternityDebt"),
          fatherDebt: readBalance("fatherMaternityDebt"),
        }
      : undefined,
  };
}

type ComparedPlan = NonNullable<ReturnType<typeof compareParentalPlans>>["standard"];

function summarizePlan(title: string, plan: ComparedPlan) {
  if (plan.firstTotal === undefined || !plan.second.money) {
    return {
      title,
      lines: [
        plan.firstTotal === undefined
          ? "Ty: " + plan.first.reason
          : "Ty: " + moneyLabel(plan.firstTotal),
        "Drugi rodzic: " + plan.second.reason,
      ],
    };
  }
  return {
    title,
    total: moneyLabel(plan.firstTotal + plan.second.money.total) + " brutto",
    lines: [
      `Ty ${moneyLabel(plan.firstTotal)} · druga osoba ${moneyLabel(plan.second.money.total)}.`,
      `Koniec urlopu ${formatDay(plan.last)}.`,
      ...(plan.first.extensionDays
        ? [`Twój urlop wydłuża się o ${formatDays(plan.first.extensionDays)}.`]
        : []),
    ],
  };
}

const assumptions =
  "Potwierdź ubezpieczenie każdego rodzica na dzień rozpoczęcia jego części urlopu w obu porównywanych wariantach.";

function MaternityComparisonFields() {
  const [active, setActive] = useState(false);
  return (
    <fieldset className={cardStyles.card}>
      <legend>Podstawowy macierzyński</legend>
      <label>
        <input
          type="checkbox"
          name="compareMaternity"
          checked={active}
          onChange={(event) => setActive(event.currentTarget.checked)}
        />
        Porównaj także przejęcie części przez ojca
      </label>
      {active ? (
        <div className={styles.grid}>
          <p>
            W tym porównaniu pierwsza osoba to matka, a druga to ojciec. Opiekę zaczynacie od
            porodu.
          </p>
          <label className={cardStyles.field}>
            Tygodnie matki po porodzie
            <input
              name="motherMaternityWeeks"
              type="number"
              min="14"
              max="37"
              defaultValue="14"
              required
            />
          </label>
          {[
            {
              name: "mother",
              date: "Chorobowe matki w dniu porodu",
              debt: "Saldo matki w dniu porodu (zł)",
            },
            {
              name: "father",
              date: "Chorobowe ojca w dniu przejęcia",
              debt: "Saldo ojca w dniu przejęcia (zł)",
            },
          ].map(({ name, date, debt }) => (
            <div key={name}>
              <label className={cardStyles.field}>
                {date}
                <select name={name + "MaternityInsured"} defaultValue="" required>
                  <option value="" disabled>
                    Wybierz
                  </option>
                  <option value="yes">Potwierdzone</option>
                  <option value="no">Brak</option>
                </select>
              </label>
              <label className={cardStyles.field}>
                {debt}
                <input
                  name={name + "MaternityDebt"}
                  type="number"
                  min="0"
                  max="1000000"
                  step=".01"
                  placeholder="Przy działalności"
                />
              </label>
            </div>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}

const questions: Partial<Record<FactKey, string>> = {
  basis: "Z jakiej kwoty liczą Twój zasiłek?",
  insured: "Czy w dniu rozpoczęcia urlopu będziesz mieć ubezpieczenie chorobowe?",
  debt: "Ile zaległych składek będziesz mieć na początku urlopu?",
  parts: "Ile osobnych okresów tego urlopu wykorzystaliście do tej pory?",
  standardRate: "Czy złożyliście wniosek o stawkę 81,5%?",
};

const hints: Partial<Record<FactKey, string>> = {
  basis:
    "Szukaj w dokumentach kwoty opisanej jako „podstawa wymiaru zasiłku”. Możesz o nią zapytać kadry albo ZUS.",
  parts: "Jeśli żadne z Was nie korzystało jeszcze z rodzicielskiego, wpisz 0.",
};

function WorkSelect({
  value,
  name = "work",
  onChange,
}: {
  value: number;
  name?: "work" | "extensionWork";
  onChange?: (value: number) => void;
}) {
  return (
    <label className={cardStyles.field}>
      {name === "work" ? "Praca w trakcie urlopu" : "Praca w trakcie wydłużenia"}
      <select
        name={name}
        defaultValue={value}
        onChange={onChange && ((event) => onChange(Number(event.currentTarget.value)))}
      >
        <option value="0">Bez pracy</option>
        <option value="25">Ćwierć etatu</option>
        <option value="50">Pół etatu</option>
      </select>
    </label>
  );
}

export function CareComparison({
  turn,
  workspace,
}: {
  turn: CareComparisonTurn;
  workspace?: ParentWorkspace;
}) {
  const titleId = useId();
  const subjects =
    workspace?.session.data.persons.flatMap((p) =>
      p.titles.map((t) => ({
        value: `${p.id}/${t.id}`,
        label: `${personLabel(workspace.session, p.id)} · ${t.employment?.state === "confirmed" ? employmentLabels[t.employment.value] : "Nieustalony tytuł"}`,
        target: {
          eventId: workspace.session.data.family.event.id,
          subject: { kind: "person" as const, personId: p.id, titleId: t.id },
          childIds: workspace.session.data.family.children.map((c) => c.id),
        },
      })),
    ) ?? [];
  const [firstSubject, setFirstSubject] = useState("");
  const [secondSubject, setSecondSubject] = useState("");
  const [savedComparison, setSavedComparison] = useState<string>();
  const [draftRevision, setDraftRevision] = useState(
    turn.baseRevision ?? workspace?.session.data.contextRevision ?? 0,
  );
  const staleDraft = Boolean(workspace && workspace.session.data.contextRevision !== draftRevision);
  const promptId = useId();
  const hintId = promptId + "-hint";
  const [personal, setPersonal] = useState(false);
  const [example, setExample] = useState<PlanOptions>(() => ({
    ...careComparisonExample.options,
    workPercent: turn.workPercent ?? careComparisonExample.options.workPercent,
  }));
  const [facts, setFacts] = useState(turn.facts);
  const [options, setOptions] = useState<PlanOptions>();
  const [useAveragedRate, setUseAveragedRate] = useState(false);
  const prompt = useRef<HTMLParagraphElement>(null);
  const focusNext = useRef(false);
  const missing = missingFact(facts);
  const field = missing === "standardRate" && useAveragedRate ? "averagedRequest" : missing;
  const hint = field && hints[field];

  useLayoutEffect(() => {
    if (focusNext.current) {
      prompt.current?.focus();
      focusNext.current = false;
    }
  }, [field, personal]);

  const birth = parseDate(facts.birth);
  const activeOptions = personal ? options : example;
  const comparison =
    activeOptions && (!personal || (!missing && !staleDraft))
      ? compareParentalPlans(
          personal ? facts : careComparisonExample.facts,
          activeOptions,
          personal ? turn.asOf : careComparisonExample.asOf,
          personal ? turn.demoRate : undefined,
        )
      : undefined;
  const results = comparison && [
    summarizePlan("Po kolei, bez pracy", comparison.standard),
    summarizePlan("Wasz wariant", comparison.adjusted),
  ];
  const exampleText = `Dane przykładowe. Przyjmujemy ${example.weeks} tygodni dla Ciebie i ${example.otherWeeks} dla drugiego rodzica.`;
  const exampleAmounts = `Przykładowe kwoty do obliczeń to ${moneyLabel(careComparisonExample.facts.basis)} i ${moneyLabel(example.otherBasis)}.`;
  const copyText =
    results && activeOptions
      ? [
          personal ? turn.text : [exampleText, exampleAmounts].join(" "),
          `Początek ${formatDay(activeOptions.start)}. Podział tygodni ${activeOptions.weeks} i ${activeOptions.otherWeeks}.`,
          `Wasz wariant: ${activeOptions.workPercent ? `praca na ${activeOptions.workPercent}% etatu` : "bez pracy"}, ${activeOptions.together ? "wspólny początek urlopu" : "urlop po kolei"}.`,
          assumptions,
          ...results.map(({ title, total, lines }) =>
            [title, total, ...lines].filter(Boolean).join("\n"),
          ),
        ].join("\n\n")
      : turn.text;

  function save(patch: CaseFacts) {
    focusNext.current = true;
    setFacts((previous) => ({ ...previous, ...patch }));
  }

  function selectMode(next: boolean) {
    focusNext.current = true;
    setPersonal(next);
  }

  const card = (
    <div className={cardStyles.turnControls}>
      <section className={cardStyles.card} aria-labelledby={titleId}>
        <h2 id={titleId}>Jak podzielić urlop rodzicielski?</h2>
        {!personal ? (
          <>
            <p ref={prompt} tabIndex={-1}>
              {exampleText}
            </p>
            <div className={cardStyles.row}>
              <WorkSelect
                value={example.workPercent}
                onChange={(workPercent) => setExample((previous) => ({ ...previous, workPercent }))}
              />
              <WorkSelect
                name="extensionWork"
                value={example.extensionWorkPercent ?? 0}
                onChange={(extensionWorkPercent) =>
                  setExample((previous) => ({ ...previous, extensionWorkPercent }))
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={example.together}
                  onChange={(event) => {
                    const together = event.currentTarget.checked;
                    setExample((previous) => ({ ...previous, together }));
                  }}
                />{" "}
                Zacznijcie w tym samym dniu
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(example.maternity)}
                  onChange={(event) => {
                    const maternity = event.currentTarget.checked
                      ? { motherDays: 98, motherInsured: true, fatherInsured: true }
                      : undefined;
                    setExample((previous) => ({ ...previous, maternity }));
                  }}
                />
                Pokaż przejęcie części macierzyńskiego przez ojca
              </label>
            </div>
          </>
        ) : null}
        <div className={styles.personal} hidden={!personal}>
          {workspace ? (
            <div className={styles.grid}>
              <p>
                Formularz jest szkicem. Aby zapisać potwierdzony wariant, wskaż obie osoby i ich
                tytuły.
              </p>
              {[
                { label: "Pierwsza osoba i tytuł", value: firstSubject, set: setFirstSubject },
                { label: "Druga osoba i tytuł", value: secondSubject, set: setSecondSubject },
              ].map((control) => (
                <label key={control.label} className={cardStyles.field}>
                  {control.label}
                  <select
                    value={control.value}
                    onChange={(e) => control.set(e.currentTarget.value)}
                  >
                    <option value="">Wybierz</option>
                    {subjects.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <Button size="sm" variant="ghost" onClick={workspace.resumeInterview}>
                Uzupełnij dane osób w wywiadzie
              </Button>
            </div>
          ) : null}
          {staleDraft ? (
            <p>
              Dane rodziny zmieniły się od otwarcia szkicu. Otwórz nowe porównanie, aby użyć
              aktualnych danych.
            </p>
          ) : null}
          {staleDraft && workspace ? (
            <Button variant="outline" onClick={() => workspace.compareCare()}>
              Otwórz nowe porównanie
            </Button>
          ) : null}
          {field ? (
            <>
              <p id={promptId} ref={personal ? prompt : undefined} tabIndex={-1}>
                {questions[field] ?? fields[field].question}
              </p>
              {hint ? (
                <p id={hintId} className={cardStyles.muted}>
                  {hint}
                </p>
              ) : null}
              {field === "standardRate" ? (
                <div className={cardStyles.actions}>
                  <Button variant="outline" size="sm" onClick={() => save({ standardRate: true })}>
                    Nie, użyj zwykłej stawki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      focusNext.current = true;
                      setUseAveragedRate(true);
                    }}
                  >
                    Tak, podam datę wniosku
                  </Button>
                </div>
              ) : (
                <FactControl
                  key={field}
                  fact={field}
                  label={
                    field === "basis"
                      ? "Kwota z dokumentu (zł)"
                      : field === "parts"
                        ? "Liczba okresów"
                        : undefined
                  }
                  today={turn.asOf}
                  onSave={save}
                  guided={{ promptId, hintId: hint ? hintId : undefined, submitLabel: "Dalej" }}
                />
              )}
              {field === "averagedRequest" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    focusNext.current = true;
                    setUseAveragedRate(false);
                  }}
                >
                  Wróć do wyboru stawki
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <p ref={personal ? prompt : undefined} tabIndex={-1}>
                Ustalcie, od kiedy i na ile tygodni chcecie wziąć urlop.
              </p>
              <form
                className={styles.form}
                onChange={(event) => setOptions(readOptions(event.currentTarget))}
                onSubmit={(event) => {
                  event.preventDefault();
                  const options = readOptions(event.currentTarget);
                  setOptions(options);
                  const first = subjects.find((s) => s.value === firstSubject);
                  const second = subjects.find((s) => s.value === secondSubject);
                  if (
                    workspace &&
                    options &&
                    first &&
                    second &&
                    first.target.subject.personId !== second.target.subject.personId
                  ) {
                    const revision = workspace.confirmComparison(
                      facts,
                      options,
                      first.target,
                      second.target,
                      draftRevision,
                    );
                    if (revision !== undefined) {
                      setDraftRevision(revision);
                      setSavedComparison(workspace.session.data.id);
                    }
                  }
                }}
              >
                <div className={styles.grid}>
                  <label className={cardStyles.field}>
                    Początek urlopu
                    <input
                      name="start"
                      type="date"
                      defaultValue={
                        birth && facts.children === 1 ? isoDate(addDays(birth, 140)) : ""
                      }
                      required
                    />
                  </label>
                  <label className={cardStyles.field}>
                    Twoje tygodnie
                    <input name="weeks" type="number" min="1" max="67" defaultValue="10" required />
                  </label>
                  <label className={cardStyles.field}>
                    Tygodnie drugiej osoby
                    <input
                      name="otherWeeks"
                      type="number"
                      min="1"
                      max="67"
                      defaultValue="9"
                      required
                    />
                  </label>
                  <label className={cardStyles.field}>
                    Podstawa zasiłku drugiej osoby (zł)
                    <input
                      aria-describedby={hintId}
                      name="otherBasis"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="1000000"
                      required
                    />
                  </label>
                  <label className={cardStyles.field}>
                    Tytuł ubezpieczenia drugiej osoby
                    <select name="otherEmployment" defaultValue="" required>
                      <option value="" disabled>
                        Wybierz
                      </option>
                      {Object.entries(employmentLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={cardStyles.field}>
                    Chorobowe drugiej osoby
                    <select name="otherInsured" defaultValue="" required>
                      <option value="" disabled>
                        Wybierz
                      </option>
                      <option value="yes">Potwierdzone</option>
                      <option value="no">Brak</option>
                    </select>
                  </label>
                  <label className={cardStyles.field}>
                    Zadłużenie drugiej osoby przy działalności (zł)
                    <input name="otherDebt" type="number" min="0" max="1000000" step="0.01" />
                  </label>
                  <label className={cardStyles.field}>
                    Twój zwykły wymiar etatu (%)
                    <input
                      name="employmentPercent"
                      type="number"
                      min="1"
                      max="100"
                      defaultValue={facts.employmentPercent}
                      placeholder="np. 100"
                    />
                  </label>
                  <WorkSelect value={example.workPercent} />
                  <WorkSelect name="extensionWork" value={example.extensionWorkPercent ?? 0} />
                </div>
                <p id={hintId} className={cardStyles.muted}>
                  Drugą kwotę też znajdziecie w dokumentach pod nazwą „podstawa wymiaru zasiłku”.
                </p>
                <label>
                  <input name="together" type="checkbox" defaultChecked /> Zacznijcie w tym samym
                  dniu
                </label>
                <MaternityComparisonFields />
                <Button type="submit" variant="outline" size="sm">
                  Przelicz warianty
                </Button>
              </form>
            </>
          )}
        </div>
        <div aria-live="polite" className={styles.grid}>
          {personal && options && !results ? (
            <p>Sprawdź datę i liczbę tygodni w granicach wspólnej puli.</p>
          ) : null}
          {results?.map(({ title, total, lines }) => (
            <section key={title} className={styles.variant}>
              <h3>{title}</h3>
              {total ? <p className={styles.total}>{total}</p> : null}
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </section>
          ))}
        </div>
        {comparison?.fullMaternity && comparison.splitMaternity ? (
          <div aria-live="polite" className={styles.grid}>
            {[
              {
                title: "Macierzyński w całości dla matki",
                benefits: [{ label: "Matka", result: comparison.fullMaternity }],
              },
              {
                title: "Macierzyński dzielony z ojcem",
                benefits: [
                  { label: "Matka", result: comparison.splitMaternity.mother },
                  { label: "Ojciec", result: comparison.splitMaternity.father },
                ],
              },
            ].map(({ title, benefits }) => (
              <section key={title} className={styles.variant}>
                <h3>{title}</h3>
                {benefits.map(({ label, result }) => (
                  <p key={label}>
                    {label} ·{" "}
                    {result.period && result.money
                      ? `${formatDays(result.period.days)} · ${moneyLabel(result.money.total)} brutto · od ${formatDay(result.period.from)}`
                      : result.reason}
                  </p>
                ))}
              </section>
            ))}
          </div>
        ) : null}
        {savedComparison &&
        workspace?.session.data.assessments.findLast((a) => a.kind === "comparison")?.result
          ?.state === "stale" ? (
          <p>
            Poprzednio zapisane porównanie jest nieaktualne po zmianie danych. Przelicz wariant dla
            aktualnych odpowiedzi.
          </p>
        ) : null}
        <div className={cardStyles.actions}>
          <Button
            variant={personal ? "outline" : "brand"}
            size="sm"
            onClick={() => selectMode(!personal)}
          >
            {personal ? "Wróć do przykładu" : "Przelicz na moich danych"}
          </Button>
        </div>
        {!personal || !field ? (
          <details>
            <summary>Założenia porównania</summary>
            {!personal ? <p>{exampleAmounts}</p> : null}
            <p className={cardStyles.muted}>{assumptions}</p>
            {personal && facts !== turn.facts ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  focusNext.current = true;
                  setOptions(undefined);
                  setUseAveragedRate(false);
                  setFacts(turn.facts);
                }}
              >
                Zacznij obliczenie od nowa
              </Button>
            ) : null}
          </details>
        ) : null}
      </section>
    </div>
  );
  return (
    <MilaMessage copyText={copyText} smartComponents={card}>
      <p tabIndex={-1} data-chat-focus>
        {turn.text}
      </p>
    </MilaMessage>
  );
}
