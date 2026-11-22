import styles from "./LoadingIndicator.module.css";

export function LoadingIndicator({ children }: { children: string }) {
  return (
    <span className={styles.indicator}>
      <span className={styles.dots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {children}
    </span>
  );
}
