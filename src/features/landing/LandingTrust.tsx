import { sources } from "../../data/sources";
import version from "../../data/version.json";
import { formatDate } from "../guide/flow";
import styles from "./MilaLanding.module.css";

const selectedSources = ["maternityDocs", "birth", "pregnancy"];

export function LandingTrust() {
  return (
    <section
      id="zrodla"
      className={`${styles.container} ${styles.trust}`}
      aria-labelledby="sources-title"
    >
      <div className={styles.sectionHeading}>
        <h2 id="sources-title">Plan z wyjaśnieniem i źródłami</h2>
        <p>
          Mila porównuje Twoje odpowiedzi z zapisanymi zasadami katalogu. Wskazuje pasujące sprawy,
          brakujące informacje i terminy, które można ustalić z podanych dat.
        </p>
      </div>
      <div className={styles.trustContent}>
        <div>
          <p>
            Dobór planu opiera się na regułach. Opcjonalna pomoc AI odpowiada na otwarte pytania;
            nie rozstrzyga, czy otrzymasz świadczenie. Odpowiedź AI może zawierać błąd — sprawdź ją
            w podanym źródle.
          </p>
          <p>
            Data weryfikacji katalogu:{" "}
            <time dateTime={version.verifiedAt}>{formatDate(version.verifiedAt)}</time>. To data
            sprawdzenia materiałów w tej wersji, a nie gwarancja aktualności wszystkich przepisów.
            Przed złożeniem wniosku potwierdź wymagania we właściwej instytucji.
          </p>
        </div>
        <div>
          <h3>Wybrane źródła z katalogu</h3>
          <ul className={styles.sourceLinks}>
            {selectedSources.map((id) => (
              <li key={id}>
                <a href={sources[id].url}>
                  {sources[id].authority}: {sources[id].title}
                </a>
              </li>
            ))}
          </ul>
          <p>W swoim planie znajdziesz odnośniki do źródeł dotyczących poszczególnych spraw.</p>
        </div>
      </div>
      <p className={styles.scopeNote}>
        Prototyp dla kobiet planujących ciążę, w ciąży i mam po porodzie. Pokazuje warunki do
        sprawdzenia; nie wylicza Twojej kwoty zasiłku.
      </p>
      <p className={styles.demoNotice}>
        Mila to niezależny projekt demonstracyjny na HackNation, przygotowany w odpowiedzi na
        wyzwanie ZUS. Nie jest usługą ZUS, nie ma integracji z jego systemami ani oficjalnej
        rekomendacji tej instytucji.
      </p>
    </section>
  );
}
