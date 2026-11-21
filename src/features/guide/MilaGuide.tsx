"use client";

import { createRef, useCallback, useId, useState, useTransition } from "react";
import type { RefObject } from "react";
import { Button } from "../../components/ui/Button";
import { DropdownMenu, DropdownMenuItem } from "../../components/ui/DropdownMenu";
import { Icon } from "../../components/ui/Icon";
import { CaseConversation } from "./CaseConversation";
import type { CaseSelection } from "./CaseConversation";
import { demoProfile } from "./demo-profile";
import { GuideLayout, useGuidePanels } from "./GuideLayout";
import type { CloseMobileCases } from "./GuideLayout";
import styles from "./MilaGuide.module.css";
import type { StartTopic } from "./startTopics";

type GuideCase = { id: number; title?: string; input: RefObject<HTMLTextAreaElement | null> };

export function MilaGuide({
  initialTopics = [],
  loginHref,
  signOutAction,
  uploadAllowed = false,
}: {
  initialTopics?: readonly StartTopic[];
  loginHref?: string;
  signOutAction?: () => Promise<void>;
  uploadAllowed?: boolean;
}) {
  const [conversations, setConversations] = useState<GuideCase[]>(() => [
    { id: 1, input: createRef<HTMLTextAreaElement>() },
  ]);
  const [selection, setSelection] = useState<CaseSelection>({ id: 1, focusComposer: false });
  const history = conversations.filter(({ title }) => title !== undefined).reverse();
  const setCaseSummary = useCallback((id: number, title: string) => {
    setConversations((previous) =>
      previous.map((item) => (item.id === id && item.title !== title ? { ...item, title } : item)),
    );
  }, []);

  function openCase(next: GuideCase, closeMobileCases: CloseMobileCases, focusComposer = false) {
    const focusAfterClose = focusComposer || next.id !== selection.id ? next.input : undefined;
    const mobilePanelClosed = closeMobileCases(focusAfterClose);
    setSelection({ id: next.id, focusComposer: focusComposer && !mobilePanelClosed });
  }

  function openDraft(closeMobileCases: CloseMobileCases) {
    const latest = conversations[conversations.length - 1];
    if (latest.title === undefined) {
      openCase(latest, closeMobileCases, true);
      return;
    }
    const next = { id: latest.id + 1, input: createRef<HTMLTextAreaElement>() };
    setConversations((previous) => [...previous, next]);
    openCase(next, closeMobileCases, true);
  }

  return (
    <GuideLayout
      panelsEnabled={!loginHref}
      cases={
        <CaseHistory
          history={history}
          selected={selection.id}
          onNewCase={openDraft}
          onSelect={openCase}
          signOutAction={signOutAction}
        />
      }
    >
      {conversations.map(({ id, input }) => (
        <CaseConversation
          key={id}
          id={id}
          input={input}
          selection={selection.id === id ? selection : null}
          initialTopics={id === 1 ? initialTopics : undefined}
          loginHref={loginHref}
          uploadAllowed={uploadAllowed}
          onSummary={setCaseSummary}
        />
      ))}
    </GuideLayout>
  );
}

function CaseHistory({
  history,
  selected,
  onNewCase,
  onSelect,
  signOutAction,
}: {
  history: GuideCase[];
  selected: number;
  onNewCase: (closeMobileCases: CloseMobileCases) => void;
  onSelect: (item: GuideCase, closeMobileCases: CloseMobileCases) => void;
  signOutAction?: () => Promise<void>;
}) {
  const { closeMobileCases } = useGuidePanels();
  const headingId = useId();
  return (
    <div className={styles.sidebar}>
      <Button
        className={styles.sidebarOption}
        variant="outline"
        onClick={() => onNewCase(closeMobileCases)}
      >
        <Icon name="circlePlus" />
        Nowa sprawa
      </Button>
      {history.length ? (
        <nav aria-labelledby={headingId} className={styles.history}>
          <h2 id={headingId} className={styles.historyHeading}>
            Historia spraw
          </h2>
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                <Button
                  aria-current={item.id === selected ? "true" : undefined}
                  className={styles.sidebarOption}
                  variant="ghost"
                  onClick={() => onSelect(item, closeMobileCases)}
                >
                  <span className={styles.sidebarOptionLabel} title={item.title}>
                    {item.title}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {signOutAction ? <ProfileMenu signOutAction={signOutAction} /> : null}
    </div>
  );
}

function ProfileMenu({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const [signingOut, startTransition] = useTransition();

  return (
    <div className={styles.profile}>
      <DropdownMenu
        side="top"
        trigger={
          <Button className={styles.sidebarOption} variant="ghost">
            <span className={styles.profileAvatar} aria-hidden="true">
              {demoProfile.initials}
            </span>
            <span className={styles.sidebarOptionLabel}>{demoProfile.name}</span>
            <Icon name="chevron" />
          </Button>
        }
      >
        <DropdownMenuItem disabled={signingOut} onClick={() => startTransition(signOutAction)}>
          Wyloguj się
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  );
}
