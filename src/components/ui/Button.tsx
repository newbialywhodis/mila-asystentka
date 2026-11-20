import type { ComponentPropsWithoutRef, ComponentPropsWithRef } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { Tooltip } from "./Tooltip";
import styles from "./Button.module.css";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "quiet" | "outline";
  icon?: IconName;
};

export function Button({
  children,
  type = "button",
  className,
  variant = "primary",
  icon,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
      {icon ? <Icon name={icon} size="sm" /> : null}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  tooltip = label,
  size = "icon-sm",
  shape = "circle",
  variant = "quiet",
  className,
  ...props
}: Omit<ComponentPropsWithRef<"button">, "title"> & {
  icon: IconName;
  label: string;
  tooltip?: string;
  size?: "icon-xs" | "icon-sm" | "icon" | "icon-lg";
  shape?: "rounded" | "circle";
  variant?: "primary" | "quiet";
}) {
  return (
    <Tooltip
      label={tooltip}
      trigger={
        <button
          type="button"
          aria-label={label}
          className={[styles.iconButton, className].filter(Boolean).join(" ")}
          data-size={size}
          data-shape={shape}
          data-variant={variant}
          {...props}
        >
          <Icon name={icon} />
        </button>
      }
    />
  );
}
