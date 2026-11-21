import sectionStyles from "./LandingSection.module.css";
import styles from "./LandingFaq.module.css";

const questions = [
  {
    title: "Co otrzymam po rozmowie z Milą?",
    answer: [
      "Mila pomoże Ci sprawdzić warunki świadczenia, okres, terminy i potrzebne dokumenty. Gdy podasz dane do obliczeń, oszacuje kwotę i pozwoli porównać warianty podziału opieki.",
      "Możesz też otworzyć plan formalności z zadaniami i odnośnikami do źródeł.",
    ],
  },
  {
    title: "Dla kogo jest Mila?",
    answer: [
      "Mila jest dla osób planujących ciążę i dla rodziców, którzy sprawdzają swoje uprawnienia. Obejmuje też sprawy ojców, rodziców adopcyjnych i rodzin zastępczych.",
    ],
  },
  {
    title: "Czy muszę znać wszystkie odpowiedzi?",
    answer: [
      "Jeśli brakuje Ci informacji, wybierz „Nie wiem”, gdy pojawi się ta opcja. Mila pokaże, jakie dane uzupełnić, aby dokończyć obliczenie.",
      "Dane możesz poprawić w rozmowie lub w podglądzie danych sprawy.",
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
      "Mila odczytuje PDF w przeglądarce. Jeśli w danej wersji dostępny jest odczyt w chmurze, plik trafia do zewnętrznej usługi dopiero po wybraniu tej opcji i potwierdzeniu wysyłki.",
      "Wiadomości wpisane w rozmowie mogą trafić do dostawcy modelu przez AI Gateway, jeśli włączono pomoc AI. Po uruchomieniu odczytu głosowego tekst odpowiedzi może trafić do ElevenLabs.",
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
