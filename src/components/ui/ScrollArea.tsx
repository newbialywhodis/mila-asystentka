import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import type { ComponentPropsWithRef } from "react";
import styles from "./ScrollArea.module.css";

type ScrollAreaProps = ComponentPropsWithRef<"div"> & {
  rootClassName?: string;
  contentClassName?: string;
  renderViewport?: BaseScrollArea.Viewport.Props["render"];
};

export function ScrollArea({
  children,
  className,
  rootClassName,
  contentClassName,
  renderViewport,
  ...viewportProps
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root className={[styles.root, rootClassName].filter(Boolean).join(" ")}>
      <BaseScrollArea.Viewport
        {...viewportProps}
        render={renderViewport}
        className={[styles.viewport, className].filter(Boolean).join(" ")}
      >
        <BaseScrollArea.Content className={contentClassName}>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar className={styles.scrollbar}>
        <BaseScrollArea.Thumb className={styles.thumb} />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  );
}
