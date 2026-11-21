import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { ScrollArea } from "../../components/ui/ScrollArea";
import { labels } from "../../engine/parent-case";
import { AttachmentPreview } from "../parent/AttachmentPreview";
import type { AttachedDocument } from "../parent/case-session";
import { CaseTools } from "../parent/CaseTools";
import { ParentThread } from "../parent/ParentThread";
import { StartActions } from "../parent/StartActions";
import type { StartPage } from "../parent/StartActions";
import { useParentWorkspace } from "../parent/useParentWorkspace";
import { SetActionGazeContext } from "./ActionGaze";
import type { ActionGaze } from "./ActionGaze";
import { ChatComposer } from "./ChatComposer";
import { useGuidePanels } from "./GuideLayout";
import styles from "./CaseConversation.module.css";

export type CaseSelection = { id: number; focusComposer: boolean };

export function CaseConversation({
  id,
  selection,
  uploadAllowed,
  input,
  onSummary,
}: {
  id: number;
  selection: CaseSelection | null;
  uploadAllowed: boolean;
  input: RefObject<HTMLTextAreaElement | null>;
  onSummary: (id: number, title: string) => void;
}) {
  const { attachmentOutlet, showAttachments } = useGuidePanels();
  const workspace = useParentWorkspace(uploadAllowed);
  const [startPage, setStartPage] = useState<StartPage>("start");
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const actionGaze = useRef<ActionGaze>({ hovered: null, focused: null });
  const setActionGaze = useCallback(
    (kind: keyof ActionGaze, target: HTMLElement | null, previous?: HTMLElement | null) => {
      if (previous === undefined || actionGaze.current[kind] === previous) {
        actionGaze.current[kind] = target;
      }
    },
    [],
  );
  const scrollport = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  const lastTurn = useRef(workspace.session.turns.at(-1));
  const { turns, benefit } = workspace.session;
  const documents = useMemo(
    () => turns.filter((turn): turn is AttachedDocument => turn.kind === "document"),
    [turns],
  );
  const latestDocument = documents.at(-1);
  const seenDocument = useRef<AttachedDocument>(null);
  const [preview, setPreview] = useState<{
    latest: AttachedDocument;
    attachment: AttachedDocument;
    page: number;
  }>();
  const currentPreview = preview?.latest === latestDocument ? preview : undefined;
  const attachment = currentPreview?.attachment ?? latestDocument;
  const active = selection !== null;
  const isEmpty = turns.length === 0;
  const openingMessage = turns.find((turn) => turn.kind === "user" && !turn.local);
  const title = benefit
    ? labels[benefit]
    : openingMessage?.kind === "user"
      ? openingMessage.text.replace(/\s+/g, " ").slice(0, 68)
      : workspace.benefitTurn?.kind === "chooseBenefit"
        ? "Sprawdź świadczenie"
        : turns.some(({ kind }) => kind === "document")
          ? "Sprawa z PDF"
          : "Sprawa " + id;

  useLayoutEffect(() => {
    if (!isEmpty) onSummary(id, title);
  }, [id, isEmpty, onSummary, title]);

  useLayoutEffect(() => {
    if (!active || !latestDocument || seenDocument.current === latestDocument) return;
    seenDocument.current = latestDocument;
    showAttachments("new-document");
  }, [active, latestDocument, showAttachments]);

  useLayoutEffect(() => {
    const region = scrollport.current;
    const composer = footer.current;
    if (!region || !composer) return;
    const measure = () =>
      region.style.setProperty("--composer-height", `${composer.offsetHeight}px`);
    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(composer, { box: "border-box" });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!selection) {
      actionGaze.current = { hovered: null, focused: null };
    } else if (selection.focusComposer) {
      input.current?.focus({ preventScroll: true });
    }
  }, [input, selection]);

  useLayoutEffect(() => {
    if (!active || workspace.expanded) return;
    const latest = turns.at(-1);
    if (lastTurn.current === latest) return;
    lastTurn.current = latest;
    const region = scrollport.current;
    const target = region?.querySelector<HTMLElement>('[data-chat-current="true"]');
    if (!target || !region) return;
    if (document.activeElement !== input.current) {
      const prompt = target.querySelector<HTMLElement>("[data-chat-focus]") ?? target;
      prompt.focus({ preventScroll: true });
    }
    const { scrollPaddingBlockStart, scrollPaddingBlockEnd } = getComputedStyle(region);
    const available =
      region.clientHeight - parseFloat(scrollPaddingBlockStart) - parseFloat(scrollPaddingBlockEnd);
    if (target.offsetHeight <= available) target.scrollIntoView({ block: "nearest" });
    else
      region.scrollBy({
        top:
          target.getBoundingClientRect().top -
          region.getBoundingClientRect().top -
          parseFloat(scrollPaddingBlockStart),
      });
  }, [active, input, turns, workspace.expanded]);

  function submitQuery(text: string) {
    setQuery("");
    void workspace.send(text);
  }

  function choosePdf() {
    fileInput.current?.click();
  }

  function selectPreview(attachment: AttachedDocument, page = 1) {
    if (latestDocument) setPreview({ latest: latestDocument, attachment, page });
  }

  function showPreview(attachment: AttachedDocument, page?: number) {
    selectPreview(
      attachment,
      page ?? (currentPreview?.attachment === attachment ? currentPreview.page : 1),
    );
    showAttachments("preview");
  }

  return (
    <>
      <div className={styles.conversation} data-empty={isEmpty} hidden={!active}>
        <ScrollArea
          rootClassName={styles.chatScrollArea}
          renderViewport={<section ref={scrollport} />}
          className={styles.scrollport}
          contentClassName={styles.scrollContent}
          aria-label="Sprawa w Mili"
          data-chat
          tabIndex={0}
        >
          <div className={styles.thread} role="log" aria-label="Wiadomości">
            <SetActionGazeContext value={setActionGaze}>
              <ParentThread workspace={workspace} onChoosePdf={choosePdf} onPreview={showPreview} />
            </SetActionGazeContext>
          </div>
          <footer ref={footer} className={styles.footer}>
            {isEmpty ? <h1 className={styles.emptyHeading}>Od czego dziś zaczniemy?</h1> : null}
            <div className={styles.dock}>
              <ChatComposer
                input={input}
                actionGaze={actionGaze}
                query={query}
                onQueryChange={setQuery}
                thinking={workspace.thinking}
                onSend={submitQuery}
                onAttach={choosePdf}
              />
            </div>
          </footer>
          {isEmpty ? (
            <StartActions
              workspace={workspace}
              page={startPage}
              setPage={setStartPage}
              actionGaze={actionGaze}
              onChoosePdf={choosePdf}
            />
          ) : null}
        </ScrollArea>
        <CaseTools workspace={workspace} active={active} />
      </div>
      {active ? (
        <input
          ref={fileInput}
          type="file"
          aria-label="Plik PDF z urządzenia"
          accept=".pdf,application/pdf"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void workspace.attachDocument(file);
          }}
        />
      ) : null}
      {active && attachmentOutlet
        ? createPortal(
            attachment ? (
              <AttachmentPreview
                documents={documents}
                attachment={attachment}
                page={currentPreview?.page ?? 1}
                onPreview={selectPreview}
              />
            ) : (
              <div className={styles.emptyAttachments}>
                <Button variant="outline" onClick={choosePdf}>
                  <Icon name="paperclip" />
                  Dodaj PDF
                </Button>
              </div>
            ),
            attachmentOutlet,
          )
        : null}
    </>
  );
}
