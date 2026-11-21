import styles from "./MilaLanding.module.css";

const steps = [
  {
    title: "Opowiedz, na jakim jesteś etapie",
    description:
      "Planujesz ciążę, czekasz na dziecko lub jesteś już mamą? Zacznij od tego, co jest teraz ważne dla Ciebie.",
  },
  {
    title: "Odpowiedz na krótkie pytania",
    description:
      "Mila zapyta o Twoją sytuację i dopasuje kolejne pytania do odpowiedzi. Bez przedzierania się przez długie formularze.",
  },
  {
    title: "Sprawdź swój plan",
    description:
      "Zobacz możliwe świadczenia, ważne terminy i listę formalności. Wróć do odpowiedzi, jeśli zechcesz coś zmienić.",
  },
];

export function LandingSteps() {
  return (
    <section
      id="jak-to-dziala"
      className={`${styles.container} ${styles.stepsSection}`}
      aria-labelledby="steps-title"
    >
      <div className={styles.sectionHeading}>
        <h2 id="steps-title">
          Od „od czego zacząć?”
          <br />
          do „wiem, co dalej”.
        </h2>
        <p>
          Nie musisz znać nazw świadczeń ani urzędowych procedur. Wystarczy, że zaczniesz rozmowę.
        </p>
      </div>
      {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics with list-style: none. */}
      <ol className={styles.steps} role="list">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className={styles.stepNumber} aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
      <div className={styles.sources}>
        <p>W planie znajdziesz odnośniki do źródeł, żeby łatwo sprawdzić szczegóły.</p>
        {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics with list-style: none. */}
        <ul aria-label="Wybrane źródła w katalogu Mili" role="list">
          <li>gov.pl</li>
          <li>ZUS</li>
          <li>Państwowa Inspekcja Pracy</li>
        </ul>
      </div>
    </section>
  );
}
