import { Dialog } from "@base-ui/react/dialog";
import type { ReactElement, ReactNode } from "react";
import { IconButton } from "./Button";
import styles from "./Sheet.module.css";

export function Sheet({
  title,
  description,
  trigger,
  children,
  open,
  onOpenChange,
  initialFocus,
  finalFocus,
  wide,
  keepMounted,
  side,
  popupClassName,
}: {
  title: string;
  description?: string;
  trigger?: ReactElement;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialFocus?: Dialog.Popup.Props["initialFocus"];
  finalFocus?: Dialog.Popup.Props["finalFocus"];
  wide?: boolean;
  keepMounted?: boolean;
  side?: "left" | "right";
  popupClassName?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger render={trigger} /> : null}
      <Dialog.Portal keepMounted={keepMounted}>
        <Dialog.Backdrop className={styles.backdrop} data-side={side} />
        <Dialog.Viewport className={styles.viewport} data-side={side}>
          <Dialog.Popup
            className={[styles.popup, popupClassName].filter(Boolean).join(" ")}
            aria-modal="true"
            initialFocus={initialFocus}
            finalFocus={finalFocus}
            data-wide={wide}
          >
            <div className={styles.header}>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              <Dialog.Close
                render={
                  <IconButton
                    icon="close"
                    label="Zamknij okno"
                    tooltip={side ? false : undefined}
                  />
                }
              />
            </div>
            {description ? (
              <Dialog.Description className={styles.description}>{description}</Dialog.Description>
            ) : null}
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
