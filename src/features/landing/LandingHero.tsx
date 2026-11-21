import { ButtonLink } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { HeroScene } from "./HeroScene";
import styles from "./LandingHero.module.css";

export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <h1 id="hero-title">
          <span>Mniej formalności.</span> <span>Więcej czasu dla Was.</span>
        </h1>
        <p className={styles.heroDescription}>
          Mila pomoże Ci odnaleźć się w świadczeniach, dokumentach i ważnych terminach związanych z
          narodzinami dziecka.
        </p>
        <div className={styles.heroActions}>
          <ButtonLink href="/chat" variant="brand" size="xl">
            Porozmawiaj z Milą <Icon name="arrow" />
          </ButtonLink>
        </div>
        <p className={styles.reassurance}>Bez zakładania konta.</p>
      </div>
      <HeroScene />
    </section>
  );
}
