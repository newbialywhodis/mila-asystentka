import type { ComponentPropsWithRef } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { Tooltip } from "./Tooltip";
import styles from "./Button.module.css";

type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"
  | "brand";
type IconButtonSize = "icon-xs" | "icon-sm" | "icon" | "icon-lg";
type ButtonSize = "xs" | "sm" | "default" | "lg" | IconButtonSize;

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  rounded?: boolean;
  icon?: IconName;
};

export function Button({
  children,
  type = "button",
  className,
  variant = "default",
  size = "default",
  rounded,
  icon,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      data-rounded={rounded || undefined}
      className={[styles.button, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
      {icon ? <Icon name={icon} /> : null}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  variant = "secondary",
  size = "default",
  ...props
}: ComponentPropsWithRef<"a"> & {
  href: string;
  variant?: ButtonVariant;
  size?: Exclude<ButtonSize, IconButtonSize>;
}) {
  return (
    <a
      data-variant={variant}
      data-size={size}
      className={[styles.button, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </a>
  );
}

export function IconButton({
  icon,
  label,
  tooltip = label,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: Omit<ButtonProps, "children" | "icon" | "size" | "title"> & {
  icon: IconName;
  label: string;
  tooltip?: string;
  size?: IconButtonSize;
}) {
  return (
    <Tooltip
      label={tooltip}
      trigger={
        <Button aria-label={label} size={size} variant={variant} {...props}>
          <Icon name={icon} />
        </Button>
      }
    />
  );
}
