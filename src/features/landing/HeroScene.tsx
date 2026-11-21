import Image from "next/image";
import styles from "./LandingHero.module.css";

export function HeroScene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.panorama}>
        <Image
          className={styles.office}
          src="/illustrations/registry-office.svg"
          alt=""
          width={480}
          height={430}
          loading="eager"
        />
        <Image
          className={styles.home}
          src="/illustrations/family-home.svg"
          alt=""
          width={480}
          height={430}
          loading="eager"
        />
        <Image
          className={styles.stroller}
          src="/illustrations/stroller.svg"
          alt=""
          width={240}
          height={230}
          loading="eager"
        />
        <Image
          className={styles.parent}
          src="/illustrations/parent-and-baby.svg"
          alt=""
          width={210}
          height={340}
          loading="eager"
        />
        <Image
          className={styles.mila}
          src="/illustrations/mila.svg"
          alt=""
          width={180}
          height={160}
          loading="eager"
        />
      </div>
    </div>
  );
}
