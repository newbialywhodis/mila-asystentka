"use client";

import { PreviewCard } from "@base-ui/react/preview-card";
import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import styles from "./HoverCard.module.css";

export function HoverCard({
  trigger,
  children,
}: {
  trigger: ReactElement<ComponentPropsWithRef<"a">>;
  children: ReactNode;
}) {
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger render={trigger} delay={150} closeDelay={120} />
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          className={styles.positioner}
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={8}
        >
          <PreviewCard.Popup className={styles.popup}>{children}</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
