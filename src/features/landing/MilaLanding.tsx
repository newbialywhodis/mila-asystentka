import Link from 'next/link'
import localFont from 'next/font/local'
import { LandingFaq } from './LandingFaq'
import { LandingFooter } from './LandingFooter'
import { LandingFamilyHug } from './LandingFamilyHug'
import { LandingHero } from './LandingHero'
import { LandingTopics } from './LandingTopics'
import { LandingHowItWorks } from './LandingHowItWorks'
import { LandingPaperwork } from './LandingPaperwork'
import styles from './MilaLanding.module.css'

const landingFont = localFont({
  src: './fonts/Manrope-Variable.ttf',
  display: 'swap',
  weight: '400 800',
})

export function MilaLanding() {
  return (
    <div className={`${styles.page} ${landingFont.className}`}>
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
          <a className={styles.sectionLink} href="#przykladowy-plan">
            Przykładowy plan
          </a>
          <a className={styles.sectionLink} href="#pytania">
            Pytania i odpowiedzi
          </a>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <LandingHero />
        <LandingTopics />
        <LandingHowItWorks />
        <LandingFaq />
        <LandingPaperwork />
        <LandingFamilyHug />
      </main>
      <LandingFooter />
    </div>
  )
}
