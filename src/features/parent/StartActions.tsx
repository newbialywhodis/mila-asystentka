import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import type { IconName } from "../../components/ui/Icon";
import { warsawToday } from "../../engine/dates";
import type { ActionGaze } from "../guide/ActionGaze";
import type { StartTopic } from "../guide/startTopics";
import { careComparisonLabel } from "./case-message";
import { AdminCard, SimulationCard } from "./ParentExtras";
import { caseExamples } from "./parent-examples";
import type { ParentWorkspace } from "./useParentWorkspace";
import styles from "./StartActions.module.css";

export type StartPage = "start" | "examples" | "services" | "rules";
type Action = { label: string; icon: IconName; onClick: () => void };

const headings = {
  start: "Rozpocznij sprawę",
  examples: "Wybierz przykładową sprawę",
  services: "Symulacje usług",
  rules: "Panel administracyjny demo",
};

export function StartActions({
  workspace,
  page,
  topics = [],
  actionGaze,
  setPage,
  onChoosePdf,
}: {
  workspace: ParentWorkspace;
  page: StartPage;
  topics?: readonly StartTopic[];
  actionGaze: RefObject<ActionGaze>;
  setPage: (page: StartPage) => void;
  onChoosePdf: () => void;
}) {
  const previousPage = useRef(page);
  const section = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    section.current?.focus();
  }, [page]);

  const actionList: Action[] =
    page === "examples"
      ? [
          ...caseExamples.map(({ benefit, facts, label }) => ({
            label,
            icon: "answers" as const,
            onClick: () => workspace.load(benefit, facts, label),
          })),
          { label: "Przykładowy PDF", icon: "contract", onClick: workspace.attachDemoDocument },
          { label: "Symulacje usług", icon: "layers", onClick: () => setPage("services") },
        ]
      : [
          {
            label: "Sprawdź, co może Ci przysługiwać",
            icon: "sparkles",
            onClick: workspace.startInterview,
          },
          {
            label: "Wiem, jakie świadczenie sprawdzić",
            icon: "tasks",
            onClick: workspace.requestBenefit,
          },
          {
            label: careComparisonLabel,
            icon: "work",
            onClick: () => workspace.compareCare(),
          },
          ...(topics.length
            ? [
                {
                  label: "Zobacz plan formalności",
                  icon: "calendar" as const,
                  onClick: () => workspace.open("formalities", "Zobacz plan formalności"),
                },
              ]
            : []),
          { label: "Wypróbuj przykład", icon: "sparkles", onClick: () => setPage("examples") },
          {
            label: "Sprawdź sprawę z PDF-u",
            icon: "paperclip",
            onClick: onChoosePdf,
          },
          {
            label: "Potrzebuję wsparcia",
            icon: "question",
            onClick: () => workspace.open("support", "Potrzebuję wsparcia"),
          },
        ];

  return (
    <section ref={section} tabIndex={-1} aria-label={headings[page]} className={styles.actions}>
      <div key={page} className={styles.page}>
        {page !== "start" ? (
          <div className={styles.toolbar}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (page === "rules") setPage("services");
                else if (page === "services") setPage("examples");
                else setPage("start");
              }}
            >
              <Icon name="back" />
              Wróć
            </Button>
            {page === "examples" ? <h2>{headings[page]}</h2> : null}
          </div>
        ) : null}
        {page === "services" ? (
          <SimulationCard
            onLoad={(benefit, facts) =>
              workspace.load(benefit, facts, "Użyj fikcyjnych danych", "Symulacja usługi")
            }
            onAdmin={() => setPage("rules")}
          />
        ) : page === "rules" ? (
          <AdminCard
            rate={workspace.session.demoRate}
            asOf={workspace.session.asOf || warsawToday()}
            onChange={workspace.setDemoRate}
          />
        ) : (
          <ActionList actions={actionList} actionGaze={page === "start" ? actionGaze : undefined} />
        )}
      </div>
    </section>
  );
}

function ActionList({
  actions,
  actionGaze,
}: {
  actions: Action[];
  actionGaze?: RefObject<ActionGaze>;
}) {
  const [highlight, setHighlight] = useState({ index: 0, visible: false, moving: false });

  return (
    <div
      className={styles.list}
      onPointerLeave={() => setHighlight((previous) => ({ ...previous, visible: false }))}
    >
      <div
        className={styles.highlight}
        aria-hidden="true"
        data-visible={highlight.visible}
        data-moving={highlight.moving}
        // oxlint-disable-next-line react/forbid-dom-props -- Position the shared highlight within the list.
        style={
          { "--action-count": actions.length, "--action-index": highlight.index } as CSSProperties
        }
      />
      {actions.map(({ label, icon, onClick }, index) => (
        <Button
          key={label}
          className={styles.action}
          variant="ghost"
          size="lg"
          onClick={onClick}
          onPointerEnter={(event) => {
            if (event.pointerType === "touch") return;
            if (actionGaze) actionGaze.current.hovered = event.currentTarget;
            setHighlight((previous) => ({ index, visible: true, moving: previous.visible }));
          }}
          onPointerLeave={() => {
            if (actionGaze) actionGaze.current.hovered = null;
          }}
          onFocus={(event) => {
            if (actionGaze) actionGaze.current.focused = event.currentTarget;
          }}
          onBlur={() => {
            if (actionGaze) actionGaze.current.focused = null;
          }}
        >
          <Icon name={icon} />
          <span>{label}</span>
        </Button>
      ))}
    </div>
  );
}
