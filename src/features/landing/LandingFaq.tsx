import { Icon } from "../../components/ui/Icon";
import styles from "./MilaLanding.module.css";

const questions = [
  {
    title: "Czy Mila jest dla mnie, jeśli dopiero planuję ciążę?",
    answer:
      "Tak. Rozmowę możesz zacząć już na etapie planowania, w czasie ciąży lub po narodzinach dziecka. Mila dobierze pytania do wybranego etapu.",
  },
  {
    title: "Co znajdę w swoim planie?",
    answer:
      "Plan zbiera świadczenia, które mogą pasować do Twojej sytuacji, ważne terminy i sprawy do załatwienia. Znajdziesz w nim także odnośniki do oficjalnych źródeł i informacje o warunkach, które trzeba sprawdzić.",
  },
  {
    title: "Czy muszę zakładać konto?",
    answer:
      "Nie. Możesz od razu rozpocząć rozmowę. Odpowiedzi i plan są dostępne w bieżącej sesji — po odświeżeniu strony rozmowa zacznie się od nowa.",
  },
  {
    title: "Czy Mila załatwi formalności za mnie?",
    answer:
      "Mila pomaga zrozumieć, co warto zrobić i gdzie szukać szczegółów. Nie wysyła wniosków ani nie wydaje decyzji o świadczeniach. Przed złożeniem dokumentów sprawdź aktualne wymagania w odpowiednim urzędzie.",
  },
];

export function LandingFaq() {
  return (
    <section
      id="pytania"
      className={`${styles.container} ${styles.faq}`}
      aria-labelledby="faq-title"
    >
      <div className={styles.faqIntroduction}>
        <h2 id="faq-title">Zanim zaczniemy</h2>
        <p>Kilka odpowiedzi, które warto mieć na początek.</p>
      </div>
      <div className={styles.questions}>
        {questions.map((question) => (
          <details key={question.title}>
            <summary>
              {question.title}
              <Icon name="chevron" />
            </summary>
            <p>{question.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
