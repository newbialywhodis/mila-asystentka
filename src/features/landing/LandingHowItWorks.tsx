import { formatDate } from "../guide/flow";
import { exampleAnswers, exampleAsOf } from "./exampleCase";
import { ProductPreview } from "./ProductPreview";
import sectionStyles from "./LandingSection.module.css";
import styles from "./LandingHowItWorks.module.css";

export function LandingHowItWorks() {
  return (
    <section
      id="jak-to-dziala"
      className={`${sectionStyles.section} ${styles.section}`}
      aria-labelledby="how-title"
    >
      <div className={sectionStyles.container}>
        <div className={sectionStyles.heading}>
          <h2 id="how-title">Od rozmowy do konkretnego planu.</h2>
          <p>
            Odpowiedz na kilka prostych pytań. Mila pomoże Ci ustalić, jakie świadczenia warto
            sprawdzić, o jakich terminach pamiętać i co zrobić dalej.
          </p>
        </div>
        <figure id="przykladowy-plan" className={styles.example} tabIndex={-1}>
          <ProductPreview />
          <figcaption className={styles.caption}>
            <strong>Przykład · fikcyjne dane</strong>
            Anna pracuje na etacie. Dziecko urodziło się {formatDate(exampleAnswers.birthDate)}, a
            kartę urodzenia sporządzono {formatDate(exampleAnswers.birthCardDate)}. Urodzenie czeka
            na zgłoszenie. Ocena na {formatDate(exampleAsOf)}.
            <span>
              To fragment planu, nie decyzja o świadczeniu. Warunek ubezpieczenia w dniu porodu
              wymaga potwierdzenia. <a href="#zrodla">Poznaj źródła i ograniczenia</a>.
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
