import { FamilyIllustration } from "./FamilyIllustration";
import styles from "./FamilyHug.module.css";

/** Decorative, self-contained SVG animation; the embrace plays once on mount. */
export function FamilyHug() {
  return (
    <div className={styles.family} aria-hidden="true">
      <FamilyIllustration />
    </div>
  );
}
