import styles from "./MilaLanding.module.css";

const steps = [
  {
    title: "Podaj kilka informacji o sobie",
    description:
      "Wybierz etap: planowanie ciąży, ciąża lub okres po narodzinach. Na etapie planowania otrzymasz listę tematów do przygotowania.",
  },
  {
    title: "Odpowiedz na krótkie pytania",
    description:
      "Kolejne pytania zależą od Twoich odpowiedzi. Większość możesz pominąć — potrzebne są wybór etapu i, jeśli padnie to pytanie, sytuacja zawodowa.",
  },
  {
    title: "Sprawdź plan i kolejny krok",
    description:
      "Zobacz możliwe świadczenia, terminy i zadania. Możesz poprawić wcześniejsze odpowiedzi; Mila uwzględni zmianę i zapyta o brakujące informacje.",
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
        <h2 id="steps-title">Jak to działa</h2>
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
    </section>
  );
}
