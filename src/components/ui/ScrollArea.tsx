import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import type { ComponentPropsWithRef, Ref } from "react";
import styles from "./ScrollArea.module.css";

type ScrollAreaProps = ComponentPropsWithRef<"div"> & {
  rootClassName?: string;
  contentClassName?: string;
  contentRef?: Ref<HTMLDivElement>;
  renderViewport?: BaseScrollArea.Viewport.Props["render"];
  horizontal?: boolean;
};

export function ScrollArea({
  children,
  className,
  rootClassName,
  contentClassName,
  contentRef,
  renderViewport,
  horizontal,
  ...viewportProps
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root className={[styles.root, rootClassName].filter(Boolean).join(" ")}>
      <BaseScrollArea.Viewport
        {...viewportProps}
        render={renderViewport}
        className={[styles.viewport, className].filter(Boolean).join(" ")}
      >
        <BaseScrollArea.Content ref={contentRef} className={contentClassName}>
          {children}
        </BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar className={styles.scrollbar}>
        <BaseScrollArea.Thumb className={styles.thumb} />
      </BaseScrollArea.Scrollbar>
      {horizontal ? (
        <>
          <BaseScrollArea.Scrollbar className={styles.scrollbar} orientation="horizontal">
            <BaseScrollArea.Thumb className={styles.thumb} />
          </BaseScrollArea.Scrollbar>
          <BaseScrollArea.Corner />
        </>
      ) : null}
    </BaseScrollArea.Root>
  );
}
