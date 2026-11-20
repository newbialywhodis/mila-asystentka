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
  variant = "dialog",
}: {
  title: string;
  description?: string;
  trigger: ReactElement;
  children?: ReactNode;
  variant?: "dialog" | "sidebar";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialFocus?: Dialog.Popup.Props["initialFocus"];
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger render={trigger} />
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Viewport className={styles.viewport} data-variant={variant}>
          <Dialog.Popup className={styles.popup} initialFocus={initialFocus}>
            <div className={styles.header}>
              <Dialog.Title className={styles.title}>{title}</Dialog.Title>
              <Dialog.Close
                render={
                  variant === "sidebar" ? (
                    <IconButton icon="sidebarOpen" size="md" label="Zamknij panel boczny" />
                  ) : (
                    <IconButton icon="close" label="Zamknij okno" />
                  )
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
