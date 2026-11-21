import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import styles from "./SidebarResizeHandle.module.css";

export function SidebarResizeHandle({
  panelId,
  side,
  label,
  width,
  min,
  max,
  onResize,
  onCommit,
  onClose,
}: {
  panelId: string;
  side: "left" | "right";
  label: string;
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  onCommit: (width: number) => void;
  onClose: () => void;
}) {
  const drag = useRef<{ pointer: number; startX: number; startWidth: number; width: number }>(null);
  const [dragging, setDragging] = useState(false);
  const direction = side === "left" ? 1 : -1;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, startX: event.clientX, startWidth: width, width };
    setDragging(true);
  }

  function resize(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    current.width = current.startWidth + direction * (event.clientX - current.startX);
    onResize(current.width);
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    drag.current = null;
    onCommit(current.width);
    setDragging(false);
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowLeft":
        onCommit(width - direction * 16);
        break;
      case "ArrowRight":
        onCommit(width + direction * 16);
        break;
      case "Home":
        onCommit(min);
        break;
      case "End":
        onCommit(max);
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
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Focusable resizing separator.
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-controls={panelId}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      aria-valuetext={width + " px"}
      data-dragging={dragging}
      data-side={side}
      onKeyDown={resizeWithKeyboard}
      onPointerDown={startDrag}
      onPointerMove={resize}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
    />
  );
}
