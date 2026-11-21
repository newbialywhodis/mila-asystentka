import { FamilyHug } from "./animations/FamilyHug";
import sectionStyles from "./LandingSection.module.css";
import styles from "./LandingFamilyHug.module.css";

export function LandingFamilyHug() {
  return (
    <section
      className={`${sectionStyles.section} ${styles.section}`}
      aria-labelledby="family-hug-title"
    >
      <div className={sectionStyles.heading}>
        <h2 id="family-hug-title">Więcej miejsca na to, co ważne.</h2>
        <p>Mila pomaga uporządkować formalności, żeby łatwiej było skupić się na codzienności.</p>
      </div>
      <div className={styles.illustration}>
        <FamilyHug />
      </div>
    </section>
  );
}
