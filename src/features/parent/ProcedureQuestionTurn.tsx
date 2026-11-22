import { discoveryDefinitions, procedureIdSchema } from "../../data/discovery";
import type { Field } from "../../types/profile";
import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { questions } from "../../data/questions";
import { documents } from "../../data/references";
import type { Question } from "../../types/catalog";
import { SingleChoice } from "../guide/QuestionControls";
import { ReportSourceLink } from "../guide/ReportSourceLink";
import { MilaMessage } from "../guide/ThreadMessage";
import { FactControl } from "./FactControl";
import type { ParentWorkspace } from "./useParentWorkspace";
import { procedureProjection } from "./workspace-session";
import styles from "./InterviewTurn.module.css";

export function ProcedureQuestionTurn({ workspace }: { workspace: ParentWorkspace }) {
  const id = useId();
  const [why, setWhy] = useState(false);
  const [instructions, setInstructions] = useState(
    workspace.session.procedureInstructions ?? false,
  );
  const p = procedureProjection(workspace.session);
  if (!p) return null;
  const field = workspace.session.procedureQuestion;
  const q: Question | undefined = field ? questions[field] : undefined;
  const result = p.result;
  const text =
    q?.label ?? "Sprawdź instrukcję i wymagane dokumenty. To ocena katalogowa, nie decyzja urzędu.";
  return (
    <MilaMessage
      copyText={text}
      smartComponents={
        <div className={styles.controls}>
          <h3>{result.procedure.title}</h3>
          {field && q ? (
            <>
              {q.hint ? <p>{q.hint}</p> : null}
              {q.options ? (
                <SingleChoice
                  labelledBy={id}
                  options={q.options.map((o) => ({ ...o, value: String(o.value) }))}
                  onAnswer={(v) =>
                    workspace.saveProcedure(
                      field,
                      q.options?.find((o) => String(o.value) === v)?.value,
                    )
                  }
                />
              ) : q.input === "hospital" ? (
                <FactControl
                  fact="hospitalRanges"
                  onSave={(facts) =>
                    workspace.saveProcedure(
                      field,
                      facts.hospitalRanges?.split(",").map((range) => {
                        const [from, through] = range.split("/");
                        return { from, through };
                      }),
                    )
                  }
                />
              ) : (
                <form
                  className={styles.field}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = new FormData(e.currentTarget).get("value");
                    if (typeof value === "string")
                      workspace.saveProcedure(field, q.input === "number" ? Number(value) : value);
                  }}
                >
                  <label htmlFor={`${id}-input`}>{q.label}</label>
                  <input
                    id={`${id}-input`}
                    name="value"
                    type={q.input === "date" ? "date" : "number"}
                    min={q.min}
                    max={q.max}
                    step={q.integer ? "1" : "any"}
                    required
                  />
                  <Button type="submit" variant="brand">
                    Potwierdź odpowiedź
                  </Button>
                </form>
              )}
              <div className={styles.actions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => workspace.saveProcedure(field, undefined, "unknown")}
                >
                  Nie wiem
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => workspace.saveProcedure(field, undefined, "deferred")}
                >
                  Pomiń
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWhy(!why)}>
                  Dlaczego o to pytasz?
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setInstructions(!instructions)}>
                  Pokaż instrukcję już teraz
                </Button>
              </div>
              {why ? (
                <p>
                  {q.hint ??
                    "Ta informacja jest potrzebna do sprawdzenia warunków lub terminu tej formalności w katalogu. Możesz ją pominąć; brak pozostanie jawny."}
                </p>
              ) : null}
            </>
          ) : null}
          {!q || instructions ? (
            <section className={styles.card}>
              <p>{result.procedure.summary}</p>
              {result.reasons.map((r) => (
                <p key={r.id}>{r.text}</p>
              ))}
              <ol>
                {result.procedure.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {result.documents.length ? (
                <ul>
                  {result.documents.map((d) => (
                    <li key={d.id}>{documents[d.id]?.title ?? d.id}</li>
                  ))}
                </ul>
              ) : null}
              {result.deadlines.map((d) => (
                <p key={d.id}>
                  {d.title}: {d.date ?? "termin wymaga danych"}. {d.consequence}
                </p>
              ))}
              {result.procedure.sources.map((source) => (
                <ReportSourceLink key={source} sourceId={source} />
              ))}
            </section>
          ) : null}
          <details>
            <summary>Popraw dane tej formalności</summary>
            <div className={styles.actions}>
              {(Object.keys(p.projection.value) as Field[]).map((f) => (
                <Button
                  key={f}
                  variant="ghost"
                  size="sm"
                  onClick={() => workspace.editProcedure(f)}
                >
                  {questions[f].label}
                </Button>
              ))}
            </div>
          </details>
          <div className={styles.actions}>
            {discoveryDefinitions[
              procedureIdSchema.parse(p.assessment.procedureId)
            ].additionalActions.map((action, i) => (
              <Button key={i} variant="outline" onClick={() => workspace.destination(action)}>
                Sprawdź powiązany zasiłek w kalkulatorze
              </Button>
            ))}
          </div>
          <Button variant="outline" onClick={workspace.showDiscovery}>
            Wróć do dopasowanych spraw
          </Button>
        </div>
      }
    >
      <p id={id} data-chat-focus tabIndex={-1}>
        {text}
      </p>
    </MilaMessage>
  );
}
