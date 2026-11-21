import { Icon } from "../../components/ui/Icon";
import Image from "next/image";
import { formatDate } from "../guide/flow";
import { exampleAllowance, exampleRegistration } from "./exampleCase";
import styles from "./PaperworkScene.module.css";

export function PaperworkScene() {
  const date = exampleRegistration.deadlines[0].date;
  return (
    <figure className={styles.scene} aria-labelledby="paperwork-caption">
      <svg className={styles.connection} viewBox="0 0 1160 410" fill="none" aria-hidden="true">
        <path d="M288 248c75 93 170 75 198 7m183-22c38-87 105-111 174-83" />
        <path d="m477 258 10-7 3 14m343-127 12 13-18 3" />
      </svg>
      <picture className={styles.chaos}>
        <source media="(max-width: 600px)" srcSet="/illustrations/paperwork-chaos-mobile.svg" />
        <Image
          src="/illustrations/paperwork-chaos.svg"
          width="430"
          height="350"
          alt=""
          loading="lazy"
        />
      </picture>
      <div className={styles.mila}>
        <p>Poukładamy to razem.</p>
        <Image src="/illustrations/mila.svg" alt="" width="180" height="160" loading="lazy" />
      </div>
      <div className={styles.order}>
        <Image
          className={styles.calendar}
          src="/illustrations/plan-calendar.svg"
          alt=""
          width="144"
          height="150"
          loading="lazy"
        />
        <div className={styles.paper}>
          <p className={styles.exampleLabel}>Przykładowy plan</p>
          <h3>Po kolei, w swoim tempie.</h3>
          <div className={styles.task}>
            <span className={styles.checkbox} aria-hidden="true" />
            <div>
              <p>{exampleRegistration.procedure.title}</p>
              {date ? <span>Do {formatDate(date)}</span> : null}
            </div>
          </div>
          <div className={styles.task}>
            <span className={styles.checkbox} aria-hidden="true" />
            <div>
              <p>Sprawdź dokumenty do wniosku</p>
              <span>Lista czynności i źródła</span>
            </div>
          </div>
        </div>
        <div className={styles.benefit}>
          <Icon name="contract" size="sm" />
          <div>
            <p>{exampleAllowance.procedure.title}</p>
            <span>Warunki do potwierdzenia</span>
          </div>
        </div>
      </div>
      <figcaption id="paperwork-caption" className={styles.caption}>
        Od rozproszonych spraw do listy kolejnych kroków. Ilustracja przedstawia przykładowy plan,
        nie załatwione formalności.
      </figcaption>
    </figure>
  );
}
