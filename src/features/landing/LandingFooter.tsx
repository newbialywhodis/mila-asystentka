import Link from "next/link";
import styles from "./LandingFooter.module.css";

function FooterNavigation({
  title,
  id,
  items,
}: {
  title: string;
  id: string;
  items: readonly { label: string; href?: string }[];
}) {
  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className={styles.heading}>
        {title}
      </h2>
      <ul className={styles.links}>
        {items.map(({ label, href }) => (
          <li key={label}>
            {href ? (
              <Link className={styles.link} href={href}>
                {label}
              </Link>
            ) : (
              <span className={styles.placeholder} title="W przygotowaniu">
                {label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.information}>
          <section className={styles.identity} aria-labelledby="footer-mila">
            <h2 id="footer-mila" className={styles.heading} translate="no">
              Mila
            </h2>
            <p className={styles.description}>
              Twój przewodnik po świadczeniach, formalnościach i macierzyństwie.
            </p>
            <p id="o-projekcie" className={styles.project}>
              Niezależny prototyp na HackNation.
            </p>
          </section>
          <FooterNavigation
            title="Odkryj"
            id="footer-discover"
            items={[
              { label: "Jak to działa", href: "#jak-to-dziala" },
              { label: "Tematy rozmowy", href: "#tematy" },
              { label: "Przykładowy plan", href: "#przykladowy-plan" },
              { label: "Porozmawiaj z Milą", href: "/chat" },
            ]}
          />
          <FooterNavigation
            title="Przydatne"
            id="footer-useful"
            items={[
              { label: "Świadczenia", href: "#topic-benefits" },
              { label: "Formalności", href: "#paperwork-title" },
              { label: "Terminy i dokumenty", href: "#topic-deadlines" },
              { label: "Pytania i odpowiedzi", href: "#pytania" },
            ]}
          />
          <FooterNavigation
            title="Informacje"
            id="footer-information"
            items={[
              { label: "O projekcie", href: "#o-projekcie" },
              { label: "Kontakt" },
              { label: "Prywatność" },
              { label: "Regulamin" },
            ]}
          />
        </div>
        <div className={styles.wordmarkFrame} aria-hidden="true">
          <span className={styles.wordmark} translate="no">
            Mila
          </span>
        </div>
      </div>
    </footer>
  );
}
