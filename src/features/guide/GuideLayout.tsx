import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ComponentProps, CSSProperties, ReactNode, RefObject } from "react";
import { ButtonLink, IconButton } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { SidebarResizeHandle } from "./SidebarResizeHandle";
import {
  readPanelPreferences,
  readPanelSnapshot,
  subscribeToPanelPreferences,
  updatePanelPreferences,
} from "./panel-preferences";
import styles from "./GuideLayout.module.css";

const desktopBreakpoint = 768;
const minimumChatWidth = 340;
const minimumCasesWidth = 176;
const minimumAttachmentsWidth = 240;

const panels = {
  cases: {
    side: "left",
    title: "Sprawy",
    closedIcon: "sidebar",
    openIcon: "sidebarOpen",
    openLabel: "Otwórz listę spraw",
    closeLabel: "Zamknij listę spraw",
    resizeLabel: "Zmień szerokość panelu spraw",
  },
  attachments: {
    side: "right",
    title: "Załączniki",
    closedIcon: "sidebarRight",
    openIcon: "sidebarRightOpen",
    openLabel: "Otwórz załączniki",
    closeLabel: "Zamknij załączniki",
    resizeLabel: "Zmień szerokość panelu załączników",
  },
} as const;

export type CloseMobileCases = (focus?: RefObject<HTMLElement | null>) => boolean;
type GuidePanels = {
  closeMobileCases: CloseMobileCases;
  attachmentOutlet: HTMLDivElement | null;
  showAttachments: (reason: "new-document" | "preview") => void;
};
const GuidePanelsContext = createContext<GuidePanels | null>(null);

export function useGuidePanels() {
  const controls = useContext(GuidePanelsContext);
  if (!controls) throw new Error("Guide panels require GuideLayout.");
  return controls;
}

function clampWidth(width: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(width)));
}

export function GuideLayout({
  cases,
  children,
  panelsEnabled,
}: {
  cases: ReactNode;
  children: ReactNode;
  panelsEnabled: boolean;
}) {
  const layout = useRef<HTMLDivElement>(null);
  const casesToggle = useRef<HTMLButtonElement>(null);
  const attachmentsToggle = useRef<HTMLButtonElement>(null);
  const casesFocus = useRef<RefObject<HTMLElement | null>>(null);
  const previewOpener = useRef<HTMLElement>(null);
  const snapshot = useSyncExternalStore(subscribeToPanelPreferences, readPanelSnapshot, () => null);
  const preferences = useMemo(() => readPanelPreferences(snapshot), [snapshot]);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [casesDragWidth, setCasesDragWidth] = useState<number>();
  const [attachmentsDragWidth, setAttachmentsDragWidth] = useState<number>();
  const [desktopAttachmentsOpen, setDesktopAttachmentsOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<keyof typeof panels | null>(null);
  const [attachmentOutlet, setAttachmentOutlet] = useState<HTMLDivElement | null>(null);
  const compact = layoutWidth > 0 && layoutWidth < desktopBreakpoint;
  const casesOpen =
    panelsEnabled && (compact ? mobilePanel === "cases" : (preferences?.open ?? false));
  const attachmentsOpen =
    panelsEnabled && (compact ? mobilePanel === "attachments" : desktopAttachmentsOpen);
  const panelBudget = layoutWidth - minimumChatWidth;
  const maxCasesWidth = Math.max(
    0,
    Math.min(448, panelBudget - (desktopAttachmentsOpen ? minimumAttachmentsWidth : 0)),
  );
  const minCasesWidth = Math.min(minimumCasesWidth, maxCasesWidth);
  const casesWidth = clampWidth(
    casesDragWidth ?? preferences?.width ?? Math.max(224, Math.min(layoutWidth * 0.25, 304)),
    minCasesWidth,
    maxCasesWidth,
  );
  const maxAttachmentsWidth = Math.max(
    0,
    Math.min(760, panelBudget - (casesOpen ? casesWidth : 0)),
  );
  const minAttachmentsWidth = Math.min(minimumAttachmentsWidth, maxAttachmentsWidth);
  const attachmentsWidth = clampWidth(
    attachmentsDragWidth ?? preferences?.attachmentWidth ?? Math.min(500, layoutWidth * 0.4),
    minAttachmentsWidth,
    maxAttachmentsWidth,
  );

  useLayoutEffect(() => {
    const element = layout.current;
    if (!element) return;
    let previousCompact = false;
    const measure = () => {
      const width = element.clientWidth;
      const nextCompact = width > 0 && width < desktopBreakpoint;
      if (previousCompact !== nextCompact) {
        setMobilePanel(null);
        setCasesDragWidth(undefined);
        setAttachmentsDragWidth(undefined);
        previousCompact = nextCompact;
      }
      setLayoutWidth(width);
    };
    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const setCasesOpen = useCallback(
    (open: boolean) => {
      if (compact) {
        if (open) casesFocus.current = null;
        setMobilePanel(open ? "cases" : null);
        return;
      }
      updatePanelPreferences({ open });
      if (!open) {
        setCasesDragWidth(undefined);
        casesToggle.current?.focus();
      }
    },
    [compact],
  );

  const setAttachmentsOpen = useCallback(
    (open: boolean) => {
      if (compact) {
        if (open) previewOpener.current = null;
        setMobilePanel(open ? "attachments" : null);
        return;
      }
      setDesktopAttachmentsOpen(open);
      if (!open) {
        setAttachmentsDragWidth(undefined);
        attachmentsToggle.current?.focus();
      }
    },
    [compact],
  );

  useEffect(() => {
    if (compact || (!casesOpen && !attachmentsOpen)) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector('[role="dialog"][data-open]')
      )
        return;
      if (attachmentsOpen) setAttachmentsOpen(false);
      else setCasesOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [compact, casesOpen, attachmentsOpen, setCasesOpen, setAttachmentsOpen]);

  const closeMobileCases = useCallback<CloseMobileCases>(
    (focus) => {
      if (!compact || mobilePanel !== "cases") return false;
      casesFocus.current = focus ?? null;
      setMobilePanel(null);
      return true;
    },
    [compact, mobilePanel],
  );

  const showAttachments = useCallback(
    (reason: "new-document" | "preview") => {
      if (!panelsEnabled) return;
      if (compact) {
        if (reason === "new-document") return;
        const opener = document.activeElement;
        previewOpener.current =
          opener instanceof HTMLElement && opener !== document.body ? opener : null;
        setMobilePanel("attachments");
        return;
      }
      setDesktopAttachmentsOpen(true);
      if (reason === "preview") attachmentsToggle.current?.focus({ preventScroll: true });
    },
    [compact, panelsEnabled],
  );
  const controls = useMemo(
    () => ({ closeMobileCases, attachmentOutlet, showAttachments }),
    [closeMobileCases, attachmentOutlet, showAttachments],
  );

  return (
    <GuidePanelsContext value={controls}>
      <div
        ref={layout}
        className={styles.layout}
        inert={panelsEnabled && compact && mobilePanel !== null}
        data-compact={compact || undefined}
        data-panels-enabled={panelsEnabled}
        data-sidebar-open={!compact && casesOpen}
        data-attachments-open={!compact && attachmentsOpen}
        // oxlint-disable-next-line react/forbid-dom-props -- Apply the measured panel widths to the grid.
        style={
          layoutWidth && !compact
            ? ({
                "--sidebar-width": `${casesWidth}px`,
                "--attachment-width": `${attachmentsWidth}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <a className={styles.skipLink} href="#chat-main">
          Przejdź do rozmowy
        </a>
        <ButtonLink
          className={styles.homeLink}
          href="/"
          variant="ghost"
          size="sm"
          aria-label="Mila — strona główna"
          translate="no"
        >
          Mila
        </ButtonLink>
        <GuidePanel
          enabled={panelsEnabled}
          panel={panels.cases}
          toggle={casesToggle}
          compact={compact}
          open={casesOpen}
          onOpenChange={setCasesOpen}
          finalFocus={() => casesFocus.current?.current ?? casesToggle.current ?? true}
          resize={{
            width: casesWidth,
            min: minCasesWidth,
            max: maxCasesWidth,
            onResize: setCasesDragWidth,
            onCommit: (width) => {
              setCasesDragWidth(undefined);
              updatePanelPreferences({ width: clampWidth(width, minCasesWidth, maxCasesWidth) });
            },
          }}
        >
          {cases}
        </GuidePanel>
        <main id="chat-main" className={styles.content} tabIndex={-1}>
          {children}
        </main>
        <GuidePanel
          enabled={panelsEnabled}
          panel={panels.attachments}
          toggle={attachmentsToggle}
          compact={compact}
          open={attachmentsOpen}
          onOpenChange={setAttachmentsOpen}
          finalFocus={() =>
            (previewOpener.current?.isConnected && previewOpener.current) ||
            attachmentsToggle.current ||
            true
          }
          resize={{
            width: attachmentsWidth,
            min: minAttachmentsWidth,
            max: maxAttachmentsWidth,
            onResize: setAttachmentsDragWidth,
            onCommit: (width) => {
              setAttachmentsDragWidth(undefined);
              updatePanelPreferences({
                attachmentWidth: clampWidth(width, minAttachmentsWidth, maxAttachmentsWidth),
              });
            },
          }}
        >
          <div className={styles.attachmentOutlet} ref={setAttachmentOutlet} />
        </GuidePanel>
      </div>
    </GuidePanelsContext>
  );
}

function GuidePanel({
  enabled,
  panel,
  toggle,
  compact,
  open,
  onOpenChange,
  finalFocus,
  resize,
  children,
}: {
  enabled: boolean;
  panel: (typeof panels)[keyof typeof panels];
  toggle: RefObject<HTMLButtonElement | null>;
  compact: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus: ComponentProps<typeof Sheet>["finalFocus"];
  resize: Pick<
    ComponentProps<typeof SidebarResizeHandle>,
    "width" | "min" | "max" | "onResize" | "onCommit"
  >;
  children: ReactNode;
}) {
  const id = useId();
  if (!enabled) return null;
  return (
    <>
      <IconButton
        ref={toggle}
        className={panel.side === "left" ? styles.casesToggle : styles.attachmentsToggle}
        icon={open ? panel.openIcon : panel.closedIcon}
        label={open ? panel.closeLabel : panel.openLabel}
        aria-expanded={open}
        aria-haspopup={compact ? "dialog" : undefined}
        aria-controls={compact ? undefined : id}
        onClick={() => onOpenChange(!open)}
      />
      {compact ? (
        <Sheet
          title={panel.title}
          side={panel.side}
          popupClassName={panel.side === "left" ? styles.casesSheet : styles.attachmentsSheet}
          open={open}
          onOpenChange={onOpenChange}
          finalFocus={finalFocus}
        >
          {children}
        </Sheet>
      ) : (
        <div className={styles.panelSlot} data-side={panel.side}>
          <aside id={id} className={styles.panel} aria-label={panel.title} inert={!open}>
            {panel.side === "left" || open ? children : null}
          </aside>
          {open && resize.max > 0 ? (
            <SidebarResizeHandle
              {...resize}
              panelId={id}
              side={panel.side}
              label={panel.resizeLabel}
              onClose={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      )}
    </>
  );
}
