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
            W zwykłej rozmowie swobodny tekst i krótki fragment bieżącej wymiany mogą trafić przez
            AI Gateway do dostawcy modelu. Kontekst zawiera klucze pól i anonimowe aliasy; pełne
            dane rodziny ani wyniki kalkulatora nie są dołączane automatycznie. Propozycje AI
            wymagają Twojego potwierdzenia.
          </p>
          <p>
            Odczyt uruchamiasz przyciskiem. Mila korzysta z gotowych nagrań, a przy włączonej
            usłudze ElevenLabs przesyła jej wyłącznie sprawdzone, ogólne odpowiedzi katalogowe. W
            niektórych przypadkach korzysta z syntezy mowy przeglądarki, która zależy od Twojego
            urządzenia i może używać usług sieciowych.
          </p>
          <p>
            Dodanie własnego PDF-u włącza tryb lokalny do końca tej rozmowy, również po zamknięciu
            podglądu i zmianie sprawdzanego świadczenia. Tekst rozmowy, pliki, OCR, fakty i wyniki
            nie są wtedy wysyłane do AI. Przygotowane tematy pomocy wysyłają tylko identyfikator
            ogólnego tematu. Indywidualnych wyjaśnień i kwot nie przekazujemy do syntezy mowy.
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
