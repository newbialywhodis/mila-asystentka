import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { questions } from "../../data/questions";
import type { Field } from "../../types/profile";
import type { Question } from "../../types/catalog";
import { fields } from "./case-fields";
import type { FactKey } from "../../engine/parent-case";
import { MilaMessage } from "../guide/ThreadMessage";
import {
  proposalIsCurrent,
  proposalPerson,
  newPersonRoles,
  currentProposalFact,
  ownershipCorrectionSource,
} from "./fact-proposals";
import { formatDay, labels, employmentLabels } from "../../engine/parent-case";
import type { FactProposal, ProposalSelection } from "./fact-proposals";
import { personRoleLabels, personLabel } from "./workspace-session";
import { moneyFields, zlotyFields, requiresTitleSelection } from "./intent-contract";
import type { IntentField } from "./intent-contract";
import type { ParentWorkspace } from "./useParentWorkspace";
import styles from "./FactProposals.module.css";
import { assistantAliases } from "./case-assistant-context";

const stages = ["planning", "pregnant", "born", "adoption", "foster", "loss"];
const stageLabels = ["Planowanie", "Ciąża", "Narodziny", "Adopcja", "Piecza", "Strata"];
export function proposalLabel(field: IntentField) {
  return field === "stage"
    ? "Sytuacja rodziny"
    : field === "pregnancyPeriod"
      ? "Orientacyjny etap ciąży"
      : field === "need"
        ? "Sprawy zwolnienia w ciąży"
        : field.startsWith("procedure:")
          ? questions[field.slice(10) as Field].label
          : fields[field as FactKey].label;
}
function optionsFor(c: ProposalSelection["candidate"]) {
  if (c.field === "stage") return stages.map((value, i) => ({ value, label: stageLabels[i] }));
  if (c.field === "pregnancyPeriod")
    return ["early", "middle", "late"].map((value, i) => ({
      value,
      label: ["I trymestr", "II trymestr", "III trymestr"][i],
    }));
  if (c.field === "need")
    return [
      { value: true, label: "Tak" },
      { value: false, label: "Nie" },
    ];
  if (c.field.startsWith("procedure:")) {
    const q: Question = questions[c.field.slice(10) as Field];
    return q.options;
  }
  const options = fields[c.field as FactKey].options;
  return c.field === "employment"
    ? [
        ...(options ?? []),
        { value: "notWorking", label: "Nie pracuje" },
        { value: "other", label: "Inna sytuacja" },
      ]
    : options;
}

export function FactProposals({
  proposal,
  workspace,
}: {
  proposal: FactProposal;
  workspace: ParentWorkspace;
}) {
  const { session } = workspace;
  const assessment = session.data.assessments.find((a) => a.id === session.activeAssessmentId);
  const active = workspace.active && proposalIsCurrent(session, proposal);
  const [rows, setRows] = useState<ProposalSelection[]>(() =>
    proposal.candidates.map((candidate, index) => {
      const person = proposalPerson(session, candidate);
      const known = session.data.persons.find((p) => p.id === person);
      const employment = proposal.candidates.flatMap((c, i) =>
        c.field === "employment" &&
        c.value !== "notWorking" &&
        c.value !== "other" &&
        c.person === candidate.person
          ? [i]
          : [],
      );
      return {
        index,
        candidate,
        person,
        explicitlyConfirmed: candidate.certainty === "stated",
        title: !requiresTitleSelection(candidate.field)
          ? ""
          : candidate.title === "selected"
            ? (assistantAliases(session).title?.id ?? "")
            : !known?.titles.length && employment.length === 1
              ? `new:${employment[0]}`
              : "",
      };
    }),
  );
  const [inputs, setInputs] = useState(() =>
    proposal.candidates.map((c) =>
      String(
        moneyFields.includes(c.field) && typeof c.value === "number" ? c.value / 100 : c.value,
      ),
    ),
  );
  const [selected, setSelected] = useState(() =>
    proposal.candidates.map((c) => c.certainty === "stated"),
  );
  const [error, setError] = useState<string>();
  function edit(index: number, patch: Partial<ProposalSelection>) {
    setRows((previous) => previous.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  const card = active ? (
    <form
      className={styles.card}
      aria-label="Propozycje informacji"
      onSubmit={(event) => {
        event.preventDefault();
        setError(
          workspace.confirmFactProposal(
            proposal,
            rows.filter((_, index) => selected[index]),
          ),
        );
      }}
    >
      {assessment ? (
        <p>
          Zakres sprawy:{" "}
          {assessment.kind === "calculator"
            ? labels[assessment.benefit]
            : assessment.kind === "procedure"
              ? (assessment.result?.result.procedure.title ?? "bieżąca formalność")
              : "porównanie"}{" "}
          · ocena na {formatDay(assessment.asOf)}.
        </p>
      ) : null}
      {rows.map((row, index) => {
        const { candidate: c } = row;
        const options = optionsFor(c);
        const person = session.data.persons.find((p) => p.id === row.person);
        const monetary = moneyFields.includes(c.field);
        const current = currentProposalFact(session, row);
        const previousOwner = ownershipCorrectionSource(session, proposal, row);
        return (
          <fieldset key={index} className={styles.row}>
            <legend>{proposalLabel(c.field)}</legend>
            {c.evidence ? <p>Fragment wypowiedzi: „{c.evidence}”</p> : null}
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={selected[index]}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setSelected((previous) =>
                    previous.map((value, i) => (i === index ? checked : value)),
                  );
                  edit(index, { explicitlyConfirmed: checked });
                }}
              />
              {c.certainty === "tentative"
                ? "Przypuszczenie — potwierdzam tę informację"
                : "Zapisz tę informację"}
            </label>
            {current?.state === "confirmed" ? (
              <p>
                Obecnie:{" "}
                {monetary && typeof current.value === "number"
                  ? `${current.value / 100} zł`
                  : (options?.find((o) => o.value === current.value)?.label ??
                    String(current.value))}
                . Zakres:{" "}
                {current.validTime.kind === "day"
                  ? formatDay(current.validTime.day)
                  : current.validTime.kind === "period"
                    ? `${formatDay(current.validTime.from)} – ${formatDay(current.validTime.through)}`
                    : "bez podanego dnia lub okresu"}
                .{" "}
                {current.source.kind === "pdf"
                  ? `Potwierdzone z PDF-u, strona ${current.source.page}. `
                  : ""}
                Zmiana wymaga zatwierdzenia; osoba i okres mają znaczenie.
              </p>
            ) : null}
            <label>
              Wartość{monetary || zlotyFields.includes(c.field) ? " (zł)" : ""}
              {options?.length ? (
                <select
                  aria-label="Wartość"
                  value={String(c.value)}
                  onChange={(e) => {
                    const value = options.find((o) => String(o.value) === e.target.value)?.value;
                    if (value !== undefined)
                      edit(index, {
                        candidate: { ...c, value },
                        withdrawPrevious: false,
                        ...(c.field === "employment" &&
                        (value === "notWorking" || value === "other")
                          ? { title: person?.titles.length === 1 ? person.titles[0].id : "" }
                          : {}),
                      });
                  }}
                >
                  {options.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={
                    monetary || zlotyFields.includes(c.field) ? "Wartość (zł)" : "Wartość"
                  }
                  value={inputs[index]}
                  onChange={(event) => {
                    const input = event.target.value;
                    setInputs((previous) =>
                      previous.map((value, i) => (i === index ? input : value)),
                    );
                    const numeric = typeof proposal.candidates[index].value === "number";
                    const number = /^\d+(?:[.,]\d{1,2})?$/.test(input.trim())
                      ? Number(input.trim().replace(",", "."))
                      : undefined;
                    edit(index, {
                      withdrawPrevious: false,
                      candidate: {
                        ...c,
                        value: numeric
                          ? number === undefined
                            ? ""
                            : monetary
                              ? Math.round(number * 100)
                              : number
                          : input,
                      },
                    });
                  }}
                  inputMode={
                    typeof proposal.candidates[index].value === "number" ? "decimal" : undefined
                  }
                  maxLength={180}
                />
              )}
            </label>
            {c.scope !== "family" && selected[index] ? (
              <>
                <label>
                  Osoba
                  <select
                    aria-label="Osoba"
                    value={row.person}
                    onChange={(e) =>
                      edit(index, { person: e.target.value, title: "", withdrawPrevious: false })
                    }
                  >
                    <option value="">Wskaż osobę</option>
                    {session.data.persons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {personLabel(session, p.id)}
                      </option>
                    ))}
                    {newPersonRoles.map((r) => (
                      <option key={r} value={`new:${r}`}>
                        Nowa osoba: {personRoleLabels[r]}
                      </option>
                    ))}
                  </select>
                </label>
                {requiresTitleSelection(c.field) &&
                !(
                  c.field === "employment" &&
                  (c.value === "notWorking" || c.value === "other") &&
                  !person?.titles.length
                ) ? (
                  <label>
                    Tytuł ubezpieczenia
                    <select
                      aria-label="Tytuł ubezpieczenia"
                      value={row.title}
                      onChange={(e) => edit(index, { title: e.target.value })}
                    >
                      <option value="">Nieustalony / nie dotyczy</option>
                      {person?.titles.map((t, i) => (
                        <option key={t.id} value={t.id}>
                          Tytuł {i + 1}:{" "}
                          {t.employment?.state === "confirmed"
                            ? employmentLabels[t.employment.value]
                            : "do ustalenia"}
                        </option>
                      ))}
                      {rows
                        .filter(
                          (r) =>
                            r.candidate.field === "employment" &&
                            r.candidate.value !== "notWorking" &&
                            r.candidate.value !== "other" &&
                            r.person === row.person,
                        )
                        .map((r) => (
                          <option key={r.index} value={`new:${r.index}`}>
                            Nowy tytuł: propozycja {r.index + 1}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : (
              <p>
                {c.scope === "family"
                  ? "Zakres: rodzina / bieżące dziecko."
                  : "Ta informacja pozostaje niepotwierdzona."}
              </p>
            )}
            {selected[index] && previousOwner ? (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={row.withdrawPrevious ?? false}
                  onChange={(e) => edit(index, { withdrawPrevious: e.target.checked })}
                />
                Wycofaj poprzednią informację o pracy:{" "}
                {personLabel(session, previousOwner.personId)} (
                {previousOwner.fact.validTime.kind === "day"
                  ? formatDay(previousOwner.fact.validTime.day)
                  : previousOwner.fact.validTime.kind === "period"
                    ? `${formatDay(previousOwner.fact.validTime.from)} – ${formatDay(previousOwner.fact.validTime.through)}`
                    : "bez podanego okresu"}
                ). Bez tego zaznaczenia poprzednia odpowiedź pozostanie przy tej osobie.
              </label>
            ) : null}
            {selected[index] &&
            ((c.scope === "person" && c.field !== "need") || c.validTime.kind !== "undated") ? (
              <details open={c.field === "insured" || c.validTime.kind !== "undated"}>
                <summary>
                  Dzień lub okres:{" "}
                  {c.validTime.kind === "undated" ? "nie podano" : "do sprawdzenia"}
                </summary>
                <label>
                  Zakres czasowy
                  <select
                    value={c.validTime.kind}
                    onChange={(e) =>
                      edit(index, {
                        candidate: {
                          ...c,
                          validTime:
                            e.target.value === "day"
                              ? { kind: "day", day: "" }
                              : e.target.value === "period"
                                ? { kind: "period", from: "", through: "" }
                                : { kind: "undated" },
                        },
                      })
                    }
                  >
                    <option value="undated">Nie podano dnia ani okresu</option>
                    <option value="day">Konkretny dzień</option>
                    <option value="period">Okres od–do</option>
                  </select>
                </label>
                {c.validTime.kind === "day" ? (
                  <label>
                    Dzień
                    <input
                      type="date"
                      value={c.validTime.day}
                      onChange={(e) =>
                        edit(index, {
                          candidate: { ...c, validTime: { kind: "day", day: e.target.value } },
                        })
                      }
                    />
                  </label>
                ) : c.validTime.kind === "period" ? (
                  <>
                    <label>
                      Od
                      <input
                        type="date"
                        value={c.validTime.from}
                        onChange={(e) => {
                          if (c.validTime.kind === "period")
                            edit(index, {
                              candidate: {
                                ...c,
                                validTime: { ...c.validTime, from: e.target.value },
                              },
                            });
                        }}
                      />
                    </label>
                    <label>
                      Do
                      <input
                        type="date"
                        value={c.validTime.through}
                        onChange={(e) => {
                          if (c.validTime.kind === "period")
                            edit(index, {
                              candidate: {
                                ...c,
                                validTime: { ...c.validTime, through: e.target.value },
                              },
                            });
                        }}
                      />
                    </label>
                  </>
                ) : null}
              </details>
            ) : null}
            {c.field === "insured" && c.validTime.kind === "undated" ? (
              <p>
                Bez dnia lub okresu ta informacja nie potwierdzi ubezpieczenia. Możesz jej teraz nie
                zaznaczać.
              </p>
            ) : null}
          </fieldset>
        );
      })}
      {error ? <p role="alert">{error}</p> : null}
      <div className={styles.actions}>
        <Button type="submit" variant="brand" size="sm">
          Potwierdź wybrane dane
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => workspace.rejectFactProposal(proposal)}
        >
          Odrzuć propozycje
        </Button>
      </div>
      <p>
        Zapiszę tylko zaznaczone informacje. Jeśli któraś wymaga uzupełnienia, najpierw pokażę błąd;
        cały wybrany zestaw poczeka na poprawkę.
      </p>
    </form>
  ) : (
    <p>Propozycja zakończona lub nieaktualna. Dane zapisano wyłącznie po zatwierdzeniu.</p>
  );
  return (
    <MilaMessage copyText={proposal.text} speechToken={null} smartComponents={card}>
      <p tabIndex={-1} data-chat-focus>
        {proposal.text}
      </p>
    </MilaMessage>
  );
}
