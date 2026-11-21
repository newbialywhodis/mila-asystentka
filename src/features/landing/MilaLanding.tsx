import Link from "next/link";
import { ButtonLink } from "../../components/ui/Button";
import { LandingFaq } from "./LandingFaq";
import { LandingHero } from "./LandingHero";
import { LandingSteps } from "./LandingSteps";
import styles from "./MilaLanding.module.css";

export function MilaLanding() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main">
        Przejdź do treści
      </a>
      <header className={`${styles.container} ${styles.header}`}>
        <Link className={styles.brand} href="/" aria-label="Mila — strona główna" translate="no">
          Mila
        </Link>
        <nav className={styles.navigation} aria-label="Nawigacja główna">
          <a className={styles.sectionLink} href="#jak-to-dziala">
            Jak to działa
          </a>
          <a className={styles.sectionLink} href="#pytania">
            Pytania i odpowiedzi
          </a>
          <ButtonLink href="/chat" variant="outline" size="lg">
            Rozpocznij rozmowę
          </ButtonLink>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <LandingHero />
        <LandingSteps />
        <LandingFaq />
        <section
          className={`${styles.container} ${styles.invitation}`}
          aria-labelledby="start-title"
        >
          <div>
            <h2 id="start-title">Zacznij od jednej rozmowy.</h2>
            <p>Resztę poukładacie razem z Milą. W Twoim tempie.</p>
          </div>
          <ButtonLink href="/chat" variant="brand" size="lg">
            Rozpocznij rozmowę
          </ButtonLink>
        </section>
      </main>
      <footer className={`${styles.container} ${styles.footer}`}>
        <p>
          <span className={styles.footerBrand} translate="no">
            Mila
          </span>{" "}
          Przewodnik przyszłej mamy
        </p>
        <p>
          Prototyp na HackNation. Mila pomaga się przygotować; nie zastępuje informacji z urzędu.
        </p>
      </footer>
    </div>
  );
}
