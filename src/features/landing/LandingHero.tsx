import { ButtonLink } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { PlanPreview } from "./PlanPreview";
import styles from "./MilaLanding.module.css";

export function LandingHero() {
  return (
    <section className={`${styles.container} ${styles.hero}`} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <p className={styles.introduction}>Poznaj Milę, przewodniczkę przyszłej mamy</p>
        <h1 id="hero-title">
          Więcej spokoju.
          <br />
          Mniej formalności.
        </h1>
        <p className={styles.heroDescription}>
          Przygotowujesz się na dziecko? Mila pomoże Ci poukładać świadczenia, terminy i sprawy do
          załatwienia. Krok po kroku, z uwagą na Twoją sytuację.
        </p>
        <div className={styles.heroActions}>
          <ButtonLink href="/chat" variant="brand" size="lg">
            Rozpocznij rozmowę
          </ButtonLink>
          <p className={styles.reassurance}>
            <Icon name="check" size="sm" /> Bez zakładania konta
          </p>
        </div>
      </div>
      <PlanPreview />
    </section>
  );
}
