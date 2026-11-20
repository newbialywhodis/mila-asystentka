"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ComponentPropsWithRef, ReactElement } from "react";
import styles from "./Tooltip.module.css";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  label,
  trigger,
}: {
  label: string;
  trigger: ReactElement<ComponentPropsWithRef<"button">>;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        render={trigger}
        id={trigger.props.id}
        disabled={trigger.props.disabled}
      />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner className={styles.positioner} sideOffset={7}>
          <TooltipPrimitive.Popup className={styles.popup}>{label}</TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
