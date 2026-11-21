import styles from "./MilaLanding.module.css";

export function LandingPrivacy() {
  return (
    <section
      id="dane"
      tabIndex={-1}
      className={`${styles.container} ${styles.privacy}`}
      aria-labelledby="data-title"
    >
      <h2 id="data-title">Twoje informacje w prototypie</h2>
      <div className={styles.trustContent}>
        <div>
          <h3>Profil demonstracyjny</h3>
          <p>
            Logowanie demonstracyjne uruchamia fikcyjny profil. Przeglądarka zapamiętuje wybór w
            pliku cookie sesji. Odpowiedzi, plan i odhaczone zadania są przechowywane w pamięci
            strony. Po odświeżeniu rozmowa zaczyna się od nowa. Tematy wybrane na stronie głównej są
            przekazywane w adresie rozmowy.
          </p>
        </div>
        <div>
          <h3>Kiedy dane mogą trafić do innych usług?</h3>
          <p>
            Jeśli otwarte pytanie wymaga pomocy AI, trafia na serwer Mili. Gdy ta funkcja jest
            włączona, treść pytania, nazwa bieżącego kroku i oznaczenia źródeł z poprzedniej
            odpowiedzi mogą trafić przez AI Gateway do dostawcy modelu. Pełny zestaw odpowiedzi z
            wywiadu nie jest dołączany automatycznie.
          </p>
          <p>
            Odczyt uruchamiasz przyciskiem. Mila korzysta z gotowych nagrań, a przy włączonej
            usłudze ElevenLabs przesyła jej tekst wygenerowanej odpowiedzi do odczytania. W
            niektórych przypadkach korzysta z syntezy mowy przeglądarki, która zależy od Twojego
            urządzenia i może używać usług sieciowych.
          </p>
        </div>
      </div>
      <p className={styles.scopeNote}>
        Do demonstracji używaj fikcyjnych danych. Nie wpisuj PESEL, danych kontaktowych ani
        dokumentacji medycznej — nie są potrzebne do tej rozmowy.
      </p>
    </section>
  );
}
