import { useId, useState } from "react";
import { employmentLabels } from "../../engine/parent-case";
import { Button } from "../../components/ui/Button";
import { SingleChoice } from "../guide/QuestionControls";
import { MilaMessage } from "../guide/ThreadMessage";
import { confirmedValue, personIdSchema, titleIdSchema } from "./family-session";
import type { PersonRole } from "./family-session";
import { stageOptions } from "./InterviewTurn";
import type { ParentWorkspace } from "./useParentWorkspace";
import { personLabel, personRoleLabels } from "./workspace-session";
import styles from "./InterviewTurn.module.css";

export function ScopeTurn({ workspace }: { workspace: ParentWorkspace }) {
  const id = useId();
  const s = workspace.session;
  const subject = s.scopeTarget?.subject ?? s.data.navigation.activeSubject;
  const [selected, setSelected] = useState(
    subject?.kind === "person" ? String(subject.personId) : "",
  );
  const [role, setRole] = useState<PersonRole>("birthing");
  const [helper, setHelper] = useState(s.data.navigation.speaker?.kind === "helper");
  const [father, setFather] = useState(false);
  const [title, setTitle] = useState(
    subject?.kind === "person" ? String(subject.titleId ?? "") : "",
  );
  const [related, setRelated] = useState(String(s.scopeTarget?.relatedPersonId ?? ""));
  const person = s.data.persons.find((p) => p.id === selected);
  const text = "Kogo i jakiego tytułu dotyczy ta sprawa?";
  return (
    <MilaMessage
      copyText={text}
      smartComponents={
        <div className={styles.controls}>
          <label>
            <input
              type="checkbox"
              checked={helper}
              onChange={(e) => setHelper(e.currentTarget.checked)}
            />{" "}
            Pomagam komuś innemu
          </label>
          <label className={styles.field}>
            Osoba
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.currentTarget.value);
                setTitle("");
                setFather(false);
              }}
            >
              <option value="">Dodaj osobę</option>
              {s.data.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(s, p.id)}
                </option>
              ))}
            </select>
          </label>
          {!person ? (
            <SingleChoice
              labelledBy={id}
              options={(["birthing", "otherParent", "guardian"] as const).map((value) => ({
                value,
                label: personRoleLabels[value],
              }))}
              selected={role}
              onAnswer={setRole}
            />
          ) : null}
          {person?.titles.length ? (
            <label className={styles.field}>
              Tytuł ubezpieczenia
              <select
                value={title || (person.titles.length === 1 ? person.titles[0].id : "")}
                onChange={(e) => setTitle(e.currentTarget.value)}
                required
              >
                <option value="">Wybierz tytuł</option>
                <option value="new">Dodaj inny tytuł ubezpieczenia</option>
                {person.titles.map((t, i) => (
                  <option key={t.id} value={t.id}>
                    {t.employment?.state === "confirmed"
                      ? employmentLabels[t.employment.value]
                      : "Nieustalony tytuł"}{" "}
                    · {i + 1}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className={styles.meta}>
              Jeżeli brakuje tytułu, kalkulator zapyta o zatrudnienie tej osoby.
            </p>
          )}
          {person?.roles.includes("otherParent") || (!person && role === "otherParent") ? (
            <label>
              <input
                type="checkbox"
                checked={father}
                onChange={(e) => setFather(e.currentTarget.checked)}
              />{" "}
              Potwierdzam, że sprawdzanie dotyczy ojca dziecka
            </label>
          ) : null}
          {s.data.persons.some((p) => p.id !== selected) ? (
            <label className={styles.field}>
              Powiązana druga osoba (gdy potrzebna)
              <select value={related} onChange={(e) => setRelated(e.currentTarget.value)}>
                <option value="">Bez wskazania</option>
                {s.data.persons
                  .filter((p) => p.id !== selected)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {personLabel(s, p.id)}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <details className={styles.details}>
            <summary>
              Sytuacja rodziny:{" "}
              {confirmedValue(s.data.family.loss)
                ? "strata"
                : (stageOptions.find(
                    (o) =>
                      o.value ===
                      (confirmedValue(s.data.family.stage) === "receivingCare"
                        ? confirmedValue(s.data.family.event.kind)
                        : confirmedValue(s.data.family.stage)),
                  )?.label ?? "nieustalona")}{" "}
              — potwierdź lub popraw
            </summary>
            <SingleChoice
              labelledBy={id}
              options={stageOptions}
              onAnswer={workspace.setScopeStage}
            />
          </details>
          <div className={styles.actions}>
            <Button
              variant="brand"
              disabled={Boolean(person && person.titles.length > 1 && !title)}
              onClick={() =>
                workspace.selectScope({
                  personId: person ? personIdSchema.parse(selected) : undefined,
                  role,
                  helper,
                  father,
                  titleId:
                    title === "new"
                      ? titleIdSchema.parse(`${selected}:title:${s.data.contextRevision + 1}`)
                      : title
                        ? titleIdSchema.parse(title)
                        : undefined,
                  newTitle: title === "new",
                  relatedPersonId: related ? personIdSchema.parse(related) : undefined,
                })
              }
            >
              Potwierdź zakres i kontynuuj
            </Button>
            <Button variant="ghost" onClick={workspace.showDiscovery}>
              Wróć do dopasowanych spraw
            </Button>
          </div>
        </div>
      }
    >
      <p id={id} data-chat-focus tabIndex={-1}>
        {text}
      </p>
    </MilaMessage>
  );
}
