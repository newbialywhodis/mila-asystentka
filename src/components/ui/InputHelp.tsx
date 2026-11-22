"use client";

import { Popover } from "@base-ui/react/popover";
import { IconButton } from "./Button";
import styles from "./InputHelp.module.css";

export function InputHelp({
  id,
  text,
  className,
}: {
  id: string;
  text: string;
  className?: string;
}) {
  return (
    <>
      <span id={id} hidden>
        {text}
      </span>
      <Popover.Root>
        <Popover.Trigger
          openOnHover
          delay={200}
          render={
            <IconButton
              className={className}
              icon="question"
              label="Co wpisać?"
              size="icon"
              tooltip={false}
            />
          }
        />
        <Popover.Portal>
          <Popover.Positioner
            className={styles.positioner}
            align="end"
            sideOffset={6}
            collisionPadding={8}
          >
            <Popover.Popup
              className={styles.popup}
              aria-label="Co wpisać w tym polu"
              initialFocus={(interaction) => interaction === "keyboard"}
            >
              <Popover.Description>{text}</Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
