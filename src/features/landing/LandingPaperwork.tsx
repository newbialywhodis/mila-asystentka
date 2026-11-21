import { ButtonLink } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { PaperworkScene } from "./PaperworkScene";
import sectionStyles from "./LandingSection.module.css";
import styles from "./LandingPaperwork.module.css";

export function LandingPaperwork() {
  return (
    <section
      className={`${sectionStyles.section} ${styles.section}`}
      aria-labelledby="paperwork-title"
    >
      <div className={sectionStyles.container}>
        <div className={sectionStyles.heading}>
          <h2 id="paperwork-title">Formalności nie muszą być skomplikowane.</h2>
          <p>
            Zamiast samodzielnie szukać informacji w wielu miejscach, zacznij od jednej rozmowy z
            Milą.
          </p>
        </div>
        <PaperworkScene />
        <div className={sectionStyles.action}>
          <ButtonLink href="/chat" variant="brand" size="xl">
            Zacznij z Milą <Icon name="arrow" />
          </ButtonLink>
        </div>
        <p className={styles.note}>Ty podejmujesz kolejne kroki. Mila pomaga je uporządkować.</p>
      </div>
    </section>
  );
}
