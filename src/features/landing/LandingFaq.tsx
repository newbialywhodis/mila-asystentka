import { Icon } from "../../components/ui/Icon";
import sectionStyles from "./LandingSection.module.css";
import styles from "./LandingFaq.module.css";

const questions = [
  {
    title: "Co otrzymam po rozmowie?",
    answer:
      "W ciąży i po narodzinach zobaczysz możliwe świadczenia, warunki do sprawdzenia, terminy, zadania i odnośniki do źródeł. Część pozycji będzie wymagała dodatkowych danych. Przy planowaniu ciąży otrzymasz listę tematów do przygotowania. Mila nie wylicza indywidualnej kwoty zasiłku ani nie porównuje podziału opieki między rodzicami.",
  },
  {
    title: "Dla kogo jest obecny prototyp?",
    answer:
      "Rozmowa jest przygotowana dla kobiet planujących ciążę, w ciąży i mam po porodzie. Katalog zawiera też informacje o uprawnieniach drugiego rodzica, ale wywiad nie ma jeszcze osobnych ścieżek dla ojców, adopcji ani pieczy zastępczej.",
  },
  {
    title: "Czy muszę znać wszystkie odpowiedzi? Czy mogę je poprawić?",
    answer:
      "Nie musisz znać wszystkich odpowiedzi. Większość pytań możesz pominąć; wymagane są wybór etapu i sytuacja zawodowa, jeśli pojawi się to pytanie. Przy wcześniejszej odpowiedzi wybierz „Zmień odpowiedź”. Mila uwzględni zmianę w planie i dopyta o brakujące informacje.",
  },
  {
    title: "Czy plan zostanie zapisany?",
    answer:
      "Nie ma trwałego zapisu. Bez zakładania konta korzystasz z rozmowy, planu i listy zadań w bieżącej sesji strony. Po odświeżeniu strony zaczniesz od nowa. Mila nie wysyła przypomnień.",
  },
  {
    title: "Co dzieje się z wpisanymi informacjami?",
    answer:
      "Odpowiedzi z wywiadu i plan pozostają w pamięci strony. Otwarte pytanie może trafić na serwer i, jeśli włączono pomoc AI, do dostawcy modelu przez AI Gateway. Po uruchomieniu odczytu tekst wygenerowanej odpowiedzi może trafić do ElevenLabs. Nie podawaj danych identyfikujących ani dokumentacji medycznej.",
  },
  {
    title: "Czy Mila składa wnioski lub wydaje decyzje?",
    answer:
      "Mila pomaga zrozumieć, co warto zrobić i gdzie szukać szczegółów. Nie wysyła wniosków ani nie wydaje decyzji o świadczeniach. Przed złożeniem dokumentów sprawdź aktualne wymagania w odpowiednim urzędzie.",
  },
];

export function LandingFaq() {
  return (
    <section
      id="pytania"
      className={`${sectionStyles.section} ${styles.faq}`}
      aria-labelledby="faq-title"
    >
      <div className={sectionStyles.heading}>
        <h2 id="faq-title">Zanim zaczniemy</h2>
        <p>Kilka odpowiedzi, które warto mieć na początek.</p>
      </div>
      <div className={styles.questions}>
        {questions.map((question) => (
          <details key={question.title}>
            <summary>
              <span>{question.title}</span>
              <Icon name="chevron" />
            </summary>
            <p>{question.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
