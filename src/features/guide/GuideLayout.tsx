import { createContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import { IconButton } from "../../components/ui/Button";
import type { IconName } from "../../components/ui/Icon";
import styles from "./MilaGuide.module.css";

const sides = ["left", "right"] as const;
type Side = (typeof sides)[number];

const panels = {
  left: { label: "Lewy panel boczny", icon: "sidebar", openIcon: "sidebarOpen" },
  right: { label: "Raport", icon: "sidebarRight", openIcon: "sidebarRightOpen" },
} satisfies Record<Side, { label: string; icon: IconName; openIcon: IconName }>;

type ReportPanelControls = {
  id: string;
  open: boolean;
  onOpen: (trigger: HTMLButtonElement) => void;
};

export const ReportPanelContext = createContext<ReportPanelControls | null>(null);

export function GuideLayout({ children, report }: { children: ReactNode; report: ReactNode }) {
  const id = useId();
  const layout = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<Side, HTMLButtonElement | null>>>({});
  const reportHeading = useRef<HTMLHeadingElement>(null);
  const reportTrigger = useRef<HTMLButtonElement>(null);
  const restoreReportFocus = useRef(false);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [openSides, setOpenSides] = useState<Side[]>([]);
  const [widths, setWidths] = useState<Partial<Record<Side, number>>>({});

  useLayoutEffect(() => {
    const element = layout.current;
    if (!element) return;

    const measure = () => setLayoutWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const compact = layoutWidth < 768;
  const visibleSides = compact ? openSides.slice(-1) : openSides;
  const lastOpen = visibleSides.at(-1);
  const reportOpen = visibleSides.includes("right");
  const reportId = `${id}-right`;
  const maxWidth = Math.floor(
    Math.min(448, layoutWidth * 0.36, compact ? Infinity : (layoutWidth - 320) / 2),
  );
  const minWidth = (side: Side) =>
    side === "right" ? Math.min(248, maxWidth) : Math.min(192, Math.round(maxWidth * 0.65));
  const defaultWidth = (side: Side) =>
    Math.round(
      Math.min(side === "right" ? 400 : 304, layoutWidth * (side === "right" ? 0.36 : 0.33)),
    );
  const limit = (side: Side, width: number) =>
    Math.min(maxWidth, Math.max(minWidth(side), Math.round(width)));
  const panelWidth = (side: Side) => limit(side, widths[side] ?? defaultWidth(side));
  const columnWidth = (side: Side) =>
    visibleSides.includes(side) && !(compact && side === "right") ? panelWidth(side) : 0;

  useLayoutEffect(() => {
    if (reportOpen) {
      reportHeading.current?.focus({ preventScroll: true });
    } else if (restoreReportFocus.current) {
      restoreReportFocus.current = false;
      const trigger = reportTrigger.current;
      trigger?.focus({ preventScroll: true });
      if (document.activeElement !== trigger)
        triggers.current.right?.focus({ preventScroll: true });
    }
  }, [reportOpen]);

  useEffect(() => {
    if (!lastOpen) return;

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (lastOpen === "right") restoreReportFocus.current = true;
      setOpenSides((previous) => (compact ? [] : previous.filter((side) => side !== lastOpen)));
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [compact, lastOpen]);

  function openReport(trigger: HTMLButtonElement) {
    reportTrigger.current = trigger;
    if (reportOpen) {
      reportHeading.current?.focus({ preventScroll: true });
    }
    setOpenSides((previous) =>
      compact ? ["right"] : [...previous.filter((side) => side !== "right"), "right"],
    );
  }

  function closeSidebar(side: Side) {
    if (side === "right") restoreReportFocus.current = true;
    setOpenSides((previous) => (compact ? [] : previous.filter((item) => item !== side)));
  }

  return (
    <main
      ref={layout}
      className={styles.layout}
      data-compact={compact}
      data-report-open={reportOpen}
      // oxlint-disable-next-line react/forbid-dom-props -- CSS variables carry measured widths.
      style={
        {
          "--left-sidebar-width": `${columnWidth("left")}px`,
          "--right-sidebar-width": `${columnWidth("right")}px`,
        } as CSSProperties
      }
    >
      <div className={styles.toolbar}>
        {sides.map((side) => {
          const panel = panels[side];
          const open = visibleSides.includes(side);
          return (
            <IconButton
              key={side}
              ref={(button) => {
                triggers.current[side] = button;
              }}
              icon={open ? panel.openIcon : panel.icon}
              label={`${open ? "Zamknij" : "Otwórz"} ${side === "right" ? "panel raportu" : panel.label.toLowerCase()}`}
              aria-expanded={open}
              aria-controls={`${id}-${side}`}
              onClick={(event) => {
                if (open) {
                  if (side === "right") reportTrigger.current = event.currentTarget;
                  closeSidebar(side);
                } else if (side === "right") {
                  openReport(event.currentTarget);
                } else {
                  setOpenSides((previous) => (compact ? ["left"] : [...previous, "left"]));
                }
              }}
            />
          );
        })}
      </div>
      {sides.map((side) => {
        const open = visibleSides.includes(side);
        const panelId = `${id}-${side}`;
        const { label } = panels[side];
        return (
          <aside
            key={side}
            id={panelId}
            className={styles.sidebar}
            data-side={side}
            data-open={open}
            aria-label={label}
            inert={!open}
          >
            {open && !(compact && side === "right") ? (
              <SidebarResizeHandle
                side={side}
                label={label}
                panelId={panelId}
                width={panelWidth(side)}
                min={minWidth(side)}
                max={maxWidth}
                onResize={(width) => {
                  const next = limit(side, width);
                  setWidths((previous) =>
                    next === limit(side, previous[side] ?? defaultWidth(side))
                      ? previous
                      : { ...previous, [side]: next },
                  );
                }}
                onClose={() => {
                  if (side === "left") triggers.current.left?.focus({ preventScroll: true });
                  closeSidebar(side);
                }}
              />
            ) : null}
            {open && side === "right" ? (
              <>
                <header className={styles.reportHeader}>
                  <h2 ref={reportHeading} tabIndex={-1}>
                    Twój raport
                  </h2>
                </header>
                <div className={styles.reportBody}>{report}</div>
              </>
            ) : null}
          </aside>
        );
      })}
      <ReportPanelContext value={{ id: reportId, open: reportOpen, onOpen: openReport }}>
        {children}
      </ReportPanelContext>
    </main>
  );
}

function SidebarResizeHandle({
  side,
  label,
  panelId,
  width,
  min,
  max,
  onResize,
  onClose,
}: {
  side: Side;
  label: string;
  panelId: string;
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  onClose: () => void;
}) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number }>(null);
  const [dragging, setDragging] = useState(false);
  const direction = side === "left" ? 1 : -1;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
    setDragging(true);
  }

  function resize(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (start?.pointerId !== event.pointerId) return;
    onResize(start.startWidth + (event.clientX - start.startX) * direction);
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowLeft":
        onResize(width - 16 * direction);
        break;
      case "ArrowRight":
        onResize(width + 16 * direction);
        break;
      case "Home":
        onResize(min);
        break;
      case "End":
        onResize(max);
        break;
      case "Enter":
      case "Escape":
        onClose();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div
      className={styles.resizeHandle}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- The separator is a focusable resize control.
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-controls={panelId}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      aria-valuetext={`${width} px`}
      data-dragging={dragging}
      onKeyDown={resizeWithKeyboard}
      onPointerDown={startDrag}
      onPointerMove={resize}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
    />
  );
}
