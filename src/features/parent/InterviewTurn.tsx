import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { SingleChoice } from "../guide/QuestionControls";
import { MilaMessage } from "../guide/ThreadMessage";
import { employmentLabels } from "../../engine/parent-case";
import { personIdSchema } from "./family-session";
import { interviewQuestionText, interviewQuestions } from "./interview";
import { FactControl } from "./FactControl";
import type { ParentWorkspace } from "./useParentWorkspace";
import { personRoleLabels } from "./workspace-session";
import styles from "./InterviewTurn.module.css";

export const stageOptions = [
  { value: "planning", label: "Planuję ciążę" },
  { value: "pregnant", label: "Jestem w ciąży" },
  { value: "born", label: "Dziecko już się urodziło" },
  { value: "adoption", label: "Adopcja" },
  { value: "foster", label: "Piecza zastępcza" },
  { value: "loss", label: "Strata dziecka" },
];
export function InterviewTurn({ workspace }: { workspace: ParentWorkspace }) {
  const id = useId();
  const [helper, setHelper] = useState(false);
  const { data } = workspace.session;
  const ref = data.interview.active;
  const asking = data.interview.mode === "asking" && ref;
  const text = asking
    ? interviewQuestionText(ref)
    : "Wywiad jest wstrzymany. Możesz wrócić do pytań lub zobaczyć możliwe sprawy.";
  const answer = (value: unknown, label: string) => {
    if (ref) workspace.answerInterview(ref, value, label);
  };
  const controls = (
    <div className={styles.controls}>
      {asking ? (
        <>
          {ref.id === "subject" ? (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={helper}
                  onChange={(e) => setHelper(e.currentTarget.checked)}
                />{" "}
                Pomagam komuś innemu
              </label>
              <div className={styles.actions}>
                {data.persons.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    onClick={() =>
                      answer(
                        {
                          speaker: helper ? "helper" : "self",
                          subject: { kind: "person", personId: p.id },
                        },
                        p.roles.map((r) => personRoleLabels[r]).join(", "),
                      )
                    }
                  >
                    {p.roles.map((r) => personRoleLabels[r]).join(", ")} ·{" "}
                    {data.persons.indexOf(p) + 1}
                  </Button>
                ))}
                {(["birthing", "otherParent", "guardian"] as const).map((role) => (
                  <Button
                    key={role}
                    variant="outline"
                    onClick={() =>
                      answer(
                        {
                          speaker: helper ? "helper" : "self",
                          subject: {
                            kind: "person",
                            personId: personIdSchema.parse(
                              `${data.id}:person:${data.persons.length + 1}`,
                            ),
                            role,
                          },
                        },
                        `${helper ? "Pomagam: " : ""}${personRoleLabels[role]}`,
                      )
                    }
                  >
                    {data.persons.length ? "Dodaj: " : ""}
                    {personRoleLabels[role]}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  onClick={() =>
                    answer(
                      { speaker: helper ? "helper" : "self", subject: { kind: "family" } },
                      "Cała rodzina",
                    )
                  }
                >
                  Cała rodzina
                </Button>
              </div>
              {data.persons.length ? (
                <details>
                  <summary>Popraw rolę istniejącej osoby</summary>
                  {data.persons.map((p, index) => (
                    <fieldset key={p.id}>
                      <legend>Osoba {index + 1}</legend>
                      <div className={styles.actions}>
                        {(["birthing", "otherParent", "guardian"] as const).map((role) => (
                          <Button
                            key={role}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              answer(
                                {
                                  speaker: helper ? "helper" : "self",
                                  subject: { kind: "person", personId: p.id, role },
                                },
                                `Poprawiam rolę osoby ${index + 1}: ${personRoleLabels[role]}`,
                              )
                            }
                          >
                            Ustaw rolę: {personRoleLabels[role]}
                          </Button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </details>
              ) : null}
            </>
          ) : ref.id === "stage" ? (
            <SingleChoice
              labelledBy={id}
              options={stageOptions}
              onAnswer={(value) =>
                answer(value, stageOptions.find((o) => o.value === value)?.label ?? value)
              }
            />
          ) : ref.id === "employment" ? (
            <SingleChoice
              labelledBy={id}
              options={[
                ...Object.entries(employmentLabels).map(([value, label]) => ({ value, label })),
                { value: "notWorking", label: "Nie pracuję" },
                { value: "other", label: "Inna sytuacja" },
              ]}
              onAnswer={(kind) =>
                answer(
                  { kind, titleId: ref.titleId },
                  kind === "notWorking"
                    ? "Nie pracuję"
                    : kind === "other"
                      ? "Inna sytuacja"
                      : (Object.entries(employmentLabels).find(([v]) => v === kind)?.[1] ?? kind),
                )
              }
            />
          ) : ref.id === "need" ? (
            <SingleChoice
              labelledBy={id}
              options={[
                { value: true, label: "Tak" },
                { value: false, label: "Nie" },
              ]}
              onAnswer={(value) => answer(value, value ? "Tak" : "Nie")}
            />
          ) : (
            <>
              <FactControl
                fact={ref.field === "birth" ? "birth" : "dueDate"}
                today={workspace.session.asOf}
                guided={{ promptId: id }}
                onSave={(facts) => {
                  const date = facts.birth ?? facts.dueDate;
                  if (date) answer({ kind: "date", date }, date);
                }}
              />
              {ref.field === "dueDate" ? (
                <SingleChoice
                  labelledBy={id}
                  options={[
                    { value: "early", label: "I trymestr" },
                    { value: "middle", label: "II trymestr" },
                    { value: "late", label: "III trymestr" },
                  ]}
                  onAnswer={(period) =>
                    answer(
                      { kind: "period", period },
                      `${period === "early" ? "I" : period === "middle" ? "II" : "III"} trymestr`,
                    )
                  }
                />
              ) : null}
            </>
          )}
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => workspace.answerInterview(ref, undefined, "Nie wiem", "unknown")}
            >
              Nie wiem
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => workspace.answerInterview(ref, undefined, "Pomiń", "deferred")}
            >
              Pomiń
            </Button>
            <Button size="sm" variant="ghost" onClick={workspace.explainInterview}>
              Dlaczego o to pytasz?
            </Button>
            <Button size="sm" variant="ghost" onClick={workspace.pauseInterview}>
              Przerwij wywiad
            </Button>
          </div>
        </>
      ) : (
        <Button variant="outline" onClick={workspace.resumeInterview}>
          Wznów wywiad
        </Button>
      )}
      <div className={styles.actions}>
        <Button variant="brand" onClick={workspace.showDiscovery}>
          Pokaż możliwe sprawy
        </Button>
        <Button variant="ghost" onClick={workspace.requestBenefit}>
          Wiem, jakie świadczenie sprawdzić
        </Button>
      </div>
      {ref ? <p className={styles.meta}>{interviewQuestions[ref.id].simple}</p> : null}
    </div>
  );
  return (
    <MilaMessage copyText={text} smartComponents={controls}>
      <p id={id} data-chat-focus tabIndex={-1}>
        {text}
      </p>
    </MilaMessage>
  );
}
