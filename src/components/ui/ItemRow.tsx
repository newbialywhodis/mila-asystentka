import type { ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import styles from "./ItemRow.module.css";

export function ItemRow({
  title,
  description,
  icon,
  selected,
  onClick,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  selected?: boolean;
  onClick?: () => void;
}) {
  const content: ReactNode = (
    <>
      {icon ? (
        <span className={styles.icon}>
          <Icon name={icon} />
        </span>
      ) : null}
      <span className={styles.copy}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      {onClick ? (
        <span className={styles.trailing}>
          <Icon name={selected ? "circleCheck" : "chevron"} size="sm" />
        </span>
      ) : null}
    </>
  );

  return onClick ? (
    <button type="button" className={styles.action} aria-pressed={selected} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={styles.row}>{content}</div>
  );
}
