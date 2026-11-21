"use client";

import { Menu } from "@base-ui/react/menu";
import type { ReactElement, ReactNode } from "react";
import styles from "./DropdownMenu.module.css";

export function DropdownMenu({
  trigger,
  children,
  side = "bottom",
}: {
  trigger: ReactElement;
  children: ReactNode;
  side?: Menu.Positioner.Props["side"];
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} side={side} align="start" sideOffset={4}>
          <Menu.Popup className={styles.popup}>{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function DropdownMenuItem(props: Omit<Menu.Item.Props, "className">) {
  return <Menu.Item {...props} className={styles.item} />;
}
