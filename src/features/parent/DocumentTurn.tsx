import { getParentCase } from "./case-session";
import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { benefits, formatDay, labels } from "../../engine/parent-case";
import type { Benefit, FactKey } from "../../engine/parent-case";
import { MilaMessage } from "../guide/ThreadMessage";
import type { OpenPdfPreview } from "./AttachmentPreview";
import {
  acceptedDocumentFact,
  documentSuggestions,
  matchesDocumentCoverage,
  matchesDocumentTarget,
} from "./case-documents";
import type {
  DocumentApplication,
  DocumentCandidate,
  DocumentData,
  DocumentRead,
} from "./case-documents";
import { factValue, fields } from "./case-fields";
import type { AttachedDocument, CaseSession } from "./case-session";
import { demoDocumentRead } from "./demo-document";
import type { ScanProgress, ScanRange } from "./local-document";
import type { ScanReference } from "./scan-evidence";
import styles from "./DocumentTurn.module.css";
import { personLabel } from "./workspace-session";

type ReadState =
  | { kind: "reading"; progress?: ScanProgress; cloud?: true }
  | { kind: "scope"; total: number; maxPages: number }
  | { kind: "error"; text: string }
  | {
      kind: "ready";
      read: DocumentRead;
      applications?: DocumentApplication[];
      references?: ScanReference[];
    };

const kindLabels: Record<DocumentRead["kind"], string> = {
  application: "Wniosek",
  payerCertificate: "Zaświadczenie płatnika składek",
  birthRecord: "Akt urodzenia",
  medicalCertificate: "Zaświadczenie medyczne",
  decision: "Rozstrzygnięcie ZUS",
  other: "PDF",
};

const readError =
  "Nie udało mi się odczytać PDF-u. Możesz skorzystać z podglądu i podać dane w rozmowie.";

export function DocumentTurn({
  document,
  session,
  active,
  onPreview,
  onContinue,
  onPrepare,
}: {
  document: AttachedDocument;
  session: CaseSession;
  active: boolean;
  onPreview: OpenPdfPreview;
  onContinue: (data?: DocumentData) => void;
  onPrepare: (benefit: Benefit) => void;
}) {
  const { file, mode } = document;
  const documentNumber =
    session.turns.filter((turn) => turn.kind === "document").indexOf(document) + 1;
  const [state, setState] = useState<ReadState>(() =>
    mode === "demo" ? { kind: "ready", read: demoDocumentRead } : { kind: "reading" },
  );
  const [chosenBenefit, setChosenBenefit] = useState<Benefit>(session.benefit ?? "maternity");
  const [attempt, setAttempt] = useState(0);
  const [range, setRange] = useState<ScanRange>();
  const [application, setApplication] = useState("");
  const [choices, setChoices] = useState<Partial<Record<string, DocumentCandidate | null>>>({});
  const choiceKey = (key: FactKey) =>
    `${session.activeAssessmentId ?? "none"}:${session.data.contextRevision}:${key}`;
  const controller = useRef<AbortController>(null);
  const completedRead = useRef(mode === "demo");
  const prompt = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!active || mode === "demo" || completedRead.current) return;
    const request = new AbortController();
    controller.current = request;
    async function scan() {
      setState({ kind: "reading" });
      try {
        const { scanLocalDocument } = await import("./local-document");
        const result = await scanLocalDocument(
          file,
          request.signal,
          (progress) => {
            if (!request.signal.aborted) setState({ kind: "reading", progress });
          },
          range,
        );
        if (!request.signal.aborted) {
          completedRead.current = result.kind !== "scope";
          setState(
            result.kind === "scope"
              ? result
              : {
                  kind: "ready",
                  read: result.fallback,
                  applications: result.applications,
                  references: result.references,
                },
          );
        }
      } catch (error) {
        if (!request.signal.aborted) {
          const text =
            error instanceof Error && error.message.startsWith("Odczyt lokalny obsługuje")
              ? error.message
              : readError;
          setState({ kind: "error", text });
        }
      } finally {
        if (controller.current === request) controller.current = null;
      }
    }
    void scan();
    return () => controller.current?.abort();
  }, [active, attempt, file, mode, range]);

  const applications = state.kind === "ready" ? state.applications : undefined;
  const choosingApplication = Boolean(applications && applications.length > 1);
  const read =
    state.kind !== "ready"
      ? undefined
      : choosingApplication
        ? application === ""
          ? undefined
          : applications?.[Number(application)]?.read
        : (applications?.[0]?.read ?? state.read);
  const benefit = read?.requestedBenefit ?? null;
  const mismatch = Boolean(benefit && session.benefit && benefit !== session.benefit);
  const facts = getParentCase(session).facts;
  const suggestions =
    active && read && !mismatch ? documentSuggestions(read, facts, session.asOf) : [];
  const targetReady =
    session.documentTargets[document.documentId || document.preview] ===
      session.activeAssessmentId && Boolean(session.activeAssessmentId);
  const draft: DocumentData = {
    target: session.data.assessments.find((a) => a.id === session.activeAssessmentId)?.target,
    benefit,
    facts: {},
    sources: {},
    baseRevision: session.data.contextRevision,
    assessmentId: session.activeAssessmentId,
  };
  const rows = suggestions.map((entries) => {
    const { key } = entries[0];
    const existing = facts[key];
    const conflict = entries.length > 1 || existing !== undefined;
    const selected = Object.hasOwn(choices, choiceKey(key))
      ? choices[choiceKey(key)]
      : conflict
        ? null
        : entries[0];
    return { key, entries, existing, conflict, selected };
  });
  let skippedScope = false;
  for (const { key, selected } of rows) {
    if (selected && !matchesDocumentTarget(selected, draft.target, document.documentId)) {
      skippedScope = true;
      continue;
    }
    if (selected && !selected.coverage) {
      const { facts, source } = acceptedDocumentFact(
        key,
        selected.value,
        selected.page,
        documentNumber,
      );
      Object.assign(draft.facts, facts);
      Object.assign(draft.sources, source);
    }
  }
  const coverageFacts = { ...facts, ...draft.facts };
  const coverageBenefit = benefit ?? session.benefit;
  let skippedCoverage = false;
  for (const { key, selected } of rows) {
    if (!selected?.coverage) continue;
    if (!matchesDocumentTarget(selected, draft.target, document.documentId)) {
      skippedScope = true;
      continue;
    }
    if (!matchesDocumentCoverage(selected, coverageBenefit, coverageFacts)) {
      skippedCoverage = true;
      continue;
    }
    const { facts, source } = acceptedDocumentFact(
      key,
      selected.value,
      selected.page,
      documentNumber,
    );
    Object.assign(draft.facts, facts);
    Object.assign(draft.sources, source);
  }
  const hasFacts = Object.keys(draft.facts).length > 0;
  const useDocument =
    targetReady && read && !mismatch && (hasFacts || (benefit && !session.benefit));
  const text = active
    ? promptText(
        state,
        choosingApplication && application === "",
        mismatch,
        rows.length,
        useDocument ? benefit : null,
      )
    : "";

  const card = (
    <section className={styles.card} aria-label="Załącznik PDF">
      <div className={styles.file}>
        <span className={styles.fileIcon}>
          <Icon name="contract" />
        </span>
        <div className={styles.fileText}>
          <span className={styles.fileName} title={file.name}>
            {file.name}
          </span>
          <span className={styles.caption}>
            {mode === "demo" ? "Fikcyjny dokument" : kindLabels[read?.kind ?? "other"]}
            {" · PDF " + documentNumber}
          </span>
        </div>
        <Button
          onClick={() => onPreview(document)}
          variant="ghost"
          size="sm"
          aria-label={`Podgląd PDF ${file.name}`}
        >
          Podgląd <Icon name="sidebarRight" />
        </Button>
      </div>
      {active && state.kind === "reading" && state.progress ? (
        <div className={styles.progress}>
          <progress
            aria-label="Postęp odczytu stron"
            value={state.progress.done}
            max={state.progress.total}
          />
          <span>
            {state.progress.done} / {state.progress.total} stron
          </span>
        </div>
      ) : null}
      {active && state.kind === "scope" ? (
        <ScanScope
          total={state.total}
          maxPages={state.maxPages}
          onChoose={(next) => {
            setChoices({});
            setApplication("");
            completedRead.current = false;
            setRange(next);
          }}
        />
      ) : null}
      {active && choosingApplication && applications ? (
        <label className={styles.resolve}>
          Wniosek do sprawdzenia
          <select
            value={application}
            onChange={(event) => {
              setApplication(event.currentTarget.value);
              setChoices({});
            }}
          >
            <option value="">Wybierz wniosek</option>
            {applications.map(({ page, read }, index) => {
              const from = read.candidates.find(({ key }) => key === "from")?.value;
              return (
                <option key={index} value={index}>
                  {read.requestedBenefit ? labels[read.requestedBenefit] : "Wniosek"}
                  {typeof from === "string" ? ` · od ${formatDay(from)}` : ""}
                  {` · s. ${page}`}
                </option>
              );
            })}
          </select>
        </label>
      ) : benefit ? (
        <p className={styles.benefit}>{labels[benefit]}</p>
      ) : null}
      {active && !targetReady ? (
        <div className={styles.actions}>
          <label>
            Świadczenie z dokumentu{" "}
            <select
              value={benefit ?? chosenBenefit}
              onChange={(e) => {
                const selected = benefits.find((b) => b === e.currentTarget.value);
                if (selected) setChosenBenefit(selected);
              }}
            >
              {benefits.map((b) => (
                <option key={b} value={b}>
                  {labels[b]}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" onClick={() => onPrepare(benefit ?? chosenBenefit)}>
            Wybierz osobę i cel danych z PDF-u
          </Button>
        </div>
      ) : null}
      {targetReady && rows.length ? (
        <p className={styles.caption}>
          Cel potwierdzenia:{" "}
          {personLabel(
            session,
            draft.target?.subject.kind === "person" ? draft.target.subject.personId : undefined,
          )}
          . Tytuł:{" "}
          {draft.target?.subject.kind === "person" && draft.target.subject.titleId
            ? "wybrany w tej sprawie"
            : "nieustalony"}
          . Każda wartość dotyczy wskazanego celu; identyczna liczba nie potwierdza osoby ani
          okresu.
        </p>
      ) : null}
      {targetReady && rows.length ? (
        <ul className={styles.facts}>
          {rows.map(({ key, entries, existing, conflict, selected }) => (
            <li key={key}>
              {conflict ? (
                <label className={styles.resolve}>
                  <span>{fields[key].label}</span>
                  <select
                    value={selected ? entries.indexOf(selected) : ""}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setChoices((previous) => ({
                        ...previous,
                        [choiceKey(key)]: value === "" ? null : entries[Number(value)],
                      }));
                    }}
                  >
                    <option value="">
                      {existing === undefined
                        ? "Pomiń rozbieżność"
                        : `Zachowaj obecną wartość (${factValue(key, existing)})`}
                    </option>
                    {entries.map((entry, index) => (
                      <option key={index} value={entries.indexOf(entry)}>
                        {factValue(key, entry.value)} · s. {entry.page}
                        {entry.coverage ? ` · na ${formatDay(entry.coverage.day)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label
                  className={styles.fact}
                  aria-label={`${fields[key].label}, ${factValue(key, entries[0].value)}`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected)}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setChoices((previous) => ({
                        ...previous,
                        [choiceKey(key)]: checked ? entries[0] : null,
                      }));
                    }}
                  />
                  <span className={styles.factText}>
                    <span className={styles.factLabel}>{fields[key].label}</span>
                    <strong>{factValue(key, entries[0].value)}</strong>
                    {entries[0].coverage ? (
                      <span className={styles.factLabel}>
                        na {formatDay(entries[0].coverage.day)}
                      </span>
                    ) : null}
                  </span>
                </label>
              )}
              <div className={styles.pages}>
                {[...new Set(entries.map(({ page }) => page))].map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={styles.page}
                    onClick={() => onPreview(document, page)}
                    aria-label={`${fields[key].label}, strona ${page} PDF`}
                  >
                    s. {page}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {!active ? (
        <Button size="sm" variant="ghost" onClick={() => onPrepare(benefit ?? chosenBenefit)}>
          Sprawdź ponownie dane z tego PDF-u
        </Button>
      ) : null}
      {active ? (
        <div className={styles.actions}>
          {state.kind === "error" ? (
            <Button size="sm" variant="outline" onClick={() => setAttempt(attempt + 1)}>
              Ponów odczyt
            </Button>
          ) : null}
          {range && state.kind !== "reading" && state.kind !== "scope" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setChoices({});
                setApplication("");
                completedRead.current = false;
                setRange(undefined);
              }}
            >
              Wybierz inne strony
            </Button>
          ) : null}
          {useDocument ? (
            <Button size="sm" variant="brand" onClick={() => onContinue(draft)}>
              {hasFacts ? "Potwierdź i użyj danych" : "Sprawdź świadczenie"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={useDocument ? "ghost" : "outline"}
            onClick={() => onContinue()}
          >
            {state.kind === "reading" ? "Pomiń odczyt i podaj dane" : "Podam dane w rozmowie"}
          </Button>
        </div>
      ) : null}
      {skippedCoverage ? (
        <p className={styles.caption}>
          Chorobowe można przenieść razem z potwierdzoną datą i tytułem z poświadczenia.
        </p>
      ) : null}
      {skippedScope ? (
        <p className={styles.caption}>
          Pominięto propozycje z innej osoby, tytułu lub okresu. Wybierz właściwy cel przed ich
          zatwierdzeniem.
        </p>
      ) : null}
      {state.kind === "ready" && state.references?.length ? (
        <details className={styles.decisions}>
          <summary>Strony do sprawdzenia ręcznie</summary>
          <ul>
            {state.references.map(({ page, label }) => (
              <li key={page}>
                <button
                  type="button"
                  className={styles.page}
                  onClick={() => onPreview(document, page)}
                >
                  {label} · s. {page}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {read?.decisions.length ? (
        <details className={styles.decisions}>
          <summary>Rozstrzygnięcia w PDF-ie</summary>
          <ul>
            {read.decisions.map(({ status, from, through, page }, index) => (
              <li key={index}>
                {{ granted: "Przyznano", refused: "Odmówiono", paid: "Wypłacono" }[status]}
                {from && through ? ` · ${formatDay(from)} – ${formatDay(through)}` : ""}
                {" · "}
                <button
                  type="button"
                  className={styles.page}
                  onClick={() => onPreview(document, page)}
                >
                  s. {page}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );

  if (!text) return card;
  return (
    <MilaMessage copyText={active ? text : ""} smartComponents={card}>
      <p ref={prompt} tabIndex={-1} data-chat-focus aria-live={active ? "polite" : undefined}>
        {text}
      </p>
    </MilaMessage>
  );
}

function promptText(
  state: ReadState,
  choosingApplication: boolean,
  mismatch: boolean,
  suggestions: number,
  benefit: Benefit | null,
) {
  if (state.kind === "reading")
    return state.cloud ? "Odczytuję PDF z AI…" : "Odczytuję PDF na tym urządzeniu…";
  if (state.kind === "scope")
    return `Ten PDF ma ${state.total} stron. Wybierz strony wniosku i załączników, które chcesz odczytać.`;
  if (state.kind === "error") return state.text;
  if (choosingApplication) return "Znalazłam kilka wniosków. Wybierz ten, który chcesz sprawdzić.";
  if (mismatch) return "Ten wniosek dotyczy innego świadczenia. Możesz użyć go w nowej sprawie.";
  if (suggestions)
    return "Sprawdź propozycje. Przy każdej wartości możesz otworzyć jej stronę w PDF-ie.";
  if (benefit) return "Rozpoznałam świadczenie. Sprawdzimy je po uzupełnieniu danych w rozmowie.";
  if (state.kind === "ready" && state.read.kind === "decision")
    return "W tym pliku jest rozstrzygnięcie. Możesz porównać je z wynikiem obliczeń.";
  return "Z tego PDF-u nie mam nowych danych do obliczeń. Możesz skorzystać z podglądu.";
}

function ScanScope({
  total,
  maxPages,
  onChoose,
}: {
  total: number;
  maxPages: number;
  onChoose: (range: ScanRange) => void;
}) {
  const [error, setError] = useState("");

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const from = Number(form.get("from"));
    const through = Number(form.get("through"));
    if (through < from || through - from + 1 > maxPages) {
      setError(`Podaj strony w kolejności od początku do końca, do ${maxPages} stron naraz.`);
      return;
    }
    onChoose({ from, through });
  }

  return (
    <form onSubmit={submit} className={styles.scope}>
      <label>
        Od strony
        <input type="number" name="from" min="1" max={total} defaultValue="1" required />
      </label>
      <label>
        Do strony
        <input
          type="number"
          name="through"
          min="1"
          max={total}
          defaultValue={Math.min(total, 10)}
          required
        />
      </label>
      <Button variant="brand" size="sm" type="submit">
        Odczytaj strony
      </Button>
      {total <= maxPages ? (
        <Button size="sm" variant="ghost" onClick={() => onChoose("all")}>
          Odczytaj całość
        </Button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
