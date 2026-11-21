import sectionStyles from "./LandingSection.module.css";
import styles from "./LandingFaq.module.css";

const questions = [
  {
    title: "Co otrzymam po rozmowie z Milą?",
    answer: [
      "W ciąży i po narodzinach zobaczysz możliwe świadczenia, warunki do sprawdzenia, terminy, zadania i odnośniki do źródeł. Część pozycji będzie wymagała dodatkowych danych. Przy planowaniu ciąży otrzymasz listę tematów do przygotowania.",
      "Mila nie wylicza indywidualnej kwoty zasiłku ani nie porównuje podziału opieki między rodzicami.",
    ],
  },
  {
    title: "Dla kogo jest Mila?",
    answer: [
      "Obecny prototyp jest przygotowany dla kobiet planujących ciążę, w ciąży i mam po porodzie.",
      "Katalog zawiera też informacje o uprawnieniach drugiego rodzica, ale wywiad nie ma jeszcze osobnych ścieżek dla ojców, adopcji ani pieczy zastępczej.",
    ],
  },
  {
    title: "Czy muszę znać wszystkie odpowiedzi?",
    answer: [
      "Nie musisz znać wszystkich odpowiedzi. Większość pytań możesz pominąć; wymagane są wybór etapu i sytuacja zawodowa, jeśli pojawi się to pytanie.",
      "Aby poprawić wcześniejszą odpowiedź, wybierz przy niej „Zmień odpowiedź”. Mila uwzględni zmianę w planie i dopyta o brakujące informacje.",
    ],
  },
  {
    title: "Czy Mila zapisuje moją rozmowę?",
    answer: [
      "Nie ma trwałego zapisu rozmowy ani planu. Bez zakładania konta korzystasz z rozmowy, planu i listy zadań w bieżącej sesji strony.",
      "Po odświeżeniu strony zaczniesz od nowa. Mila nie wysyła przypomnień.",
    ],
  },
  {
    title: "Co dzieje się z moimi danymi?",
    answer: [
      "Odpowiedzi z wywiadu i plan pozostają w pamięci strony. Otwarte pytanie może trafić na serwer i, jeśli włączono pomoc AI, do dostawcy modelu przez AI Gateway. Po uruchomieniu odczytu tekst wygenerowanej odpowiedzi może trafić do ElevenLabs.",
      "Nie podawaj danych identyfikujących ani dokumentacji medycznej.",
    ],
  },
  {
    title: "Czy Mila może złożyć za mnie wniosek?",
    answer: [
      "Nie. Mila pomaga zrozumieć, co warto zrobić i gdzie szukać szczegółów. Nie wysyła wniosków ani nie wydaje decyzji o świadczeniach.",
      "Przed złożeniem dokumentów sprawdź aktualne wymagania w odpowiedniej instytucji, np. w ZUS lub urzędzie gminy.",
    ],
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
        <h2 id="faq-title">Masz pytania?</h2>
        <p>Tutaj znajdziesz najważniejsze odpowiedzi.</p>
      </div>
      <div className={styles.questions}>
        {questions.map((question) => (
          <details key={question.title} name="mila-faq">
            <summary>
              <span>{question.title}</span>
              <span className={styles.indicator} aria-hidden="true" />
            </summary>
            <div className={styles.answer}>
              {question.answer.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
