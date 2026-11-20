"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { warsawToday } from "../../engine/dates";
import { ChatComposer } from "./ChatComposer";
import {
  appendHelp,
  cancelRevision,
  getEditableAnswers,
  initialConversation,
  resolveHelp,
  reviseAnswer,
  submitAnswer,
} from "./conversation";
import { getPeriod, getProfile, guideQuestions } from "./flow";
import type { Answer, QuestionId } from "./flow";
import { GuideHelpReply } from "./GuideHelp";
import { findHelpAnswer, missingHelpAnswer } from "./helpAnswers";
import type { HelpAnswer } from "./helpAnswers";
import type { MascotReaction } from "./MilaMascot";
import type { PlanSection } from "./PlanNavigation";
import { PlanTurn } from "./PlanTurn";
import { QuestionTurn } from "./QuestionTurn";
import { readTextAnswer } from "./textInput";
import { UserMessage } from "./ThreadMessage";
import styles from "./MilaGuide.module.css";

type MessageLocation = { key: string; scrollOnly?: boolean };

export function MilaGuide() {
  const [conversation, setConversation] = useState(initialConversation);
  const [asOf, setAsOf] = useState("");
  const [section, setSection] = useState<PlanSection>();
  const [checked, setChecked] = useState<string[]>([]);
  const [reaction, setReaction] = useState<MascotReaction>();
  const scrollport = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  const nextHelpId = useRef(0);
  const nextLocation = useRef<MessageLocation>(undefined);

  const { answers, messages, prompt, revision } = conversation;
  const activeIndex = revision ?? prompt;
  const active = messages[activeIndex];
  const context = active.kind === "question" ? active.question : undefined;
  const ready = active.kind === "plan";
  const profile = useMemo(() => getProfile(answers), [answers]);
  const period = getPeriod(answers.pregnancyTiming);
  const editable = getEditableAnswers(conversation);
  const thinking = messages.some((message) => message.kind === "help" && !message.exchange.answer);

  useEffect(() => {
    if (!reaction) return;
    const timeout = setTimeout(
      () => setReaction(undefined),
      reaction.kind === "smile" ? 1150 : 450,
    );
    return () => clearTimeout(timeout);
  }, [reaction]);

  useLayoutEffect(() => {
    const region = scrollport.current;
    const composer = footer.current;
    if (!region || !composer) return;

    const updateScrollPadding = () => {
      region.style.setProperty("--composer-height", `${composer.offsetHeight}px`);
    };

    updateScrollPadding();
    const observer = new ResizeObserver(updateScrollPadding);
    observer.observe(composer, { box: "border-box" });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const location = nextLocation.current;
    nextLocation.current = undefined;
    if (location) moveToMessage(scrollport.current, location);
  }, [conversation, section]);

  function continueConversation() {
    moveToMessage(scrollport.current, { key: "continue" });
  }

  function answer(index: number, value: Answer, text?: string, date = asOf || warsawToday()) {
    const updated = submitAnswer(conversation, index, value, text);
    if (updated === conversation) return;
    nextLocation.current = { key: "continue", scrollOnly: text !== undefined };
    if (!asOf) setAsOf(date);
    if (updated.answers.stage !== answers.stage) setChecked([]);
    setSection(undefined);
    setConversation((previous) =>
      previous === conversation ? updated : submitAnswer(previous, index, value, text),
    );
    setReaction({ kind: updated.messages[updated.prompt].kind === "plan" ? "smile" : "nod" });
  }

  function edit(question: QuestionId) {
    nextLocation.current = { key: "continue" };
    setConversation((previous) => reviseAnswer(previous, question));
  }

  function cancelEdit() {
    nextLocation.current = { key: "continue" };
    setConversation(cancelRevision);
  }

  function send(text: string) {
    const date = asOf || warsawToday();
    const reply = context ? readTextAnswer(context, text, date, profile.birthDate) : undefined;
    if (reply && "value" in reply) {
      answer(activeIndex, reply.value, text, date);
    } else {
      void ask(text, reply ? { text: reply.clarification } : undefined);
    }
  }

  async function ask(question: string, clarification?: HelpAnswer) {
    const id = nextHelpId.current++;
    const known = clarification ?? findHelpAnswer(question, context);
    const key = `help-${id}`;
    nextLocation.current = { key, scrollOnly: true };
    setConversation((previous) => appendHelp(previous, { id, question, answer: known }));
    if (known) {
      setReaction({ kind: "blink" });
      return;
    }
    setReaction(undefined);

    let reply: HelpAnswer = missingHelpAnswer;
    try {
      const response = await fetch("/api/guide-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context }),
        signal: AbortSignal.timeout(7500),
      });
      if (response.ok) reply = await response.json();
    } catch {
      reply = { text: "Nie mogę teraz sprawdzić odpowiedzi. Spróbuj wysłać pytanie ponownie." };
    }
    const region = scrollport.current;
    if (
      region &&
      region.scrollHeight - region.scrollTop - region.clientHeight <= 40 &&
      region.querySelector(`[data-chat-focus="${key}"]`)?.closest("[data-chat-scroll]")
        ?.nextElementSibling === null
    ) {
      nextLocation.current ??= { key, scrollOnly: true };
    }
    setConversation((previous) => resolveHelp(previous, id, reply));
  }

  function openPlan() {
    const location = { key: "plan" };
    if (section) {
      moveToMessage(scrollport.current, location);
    } else {
      nextLocation.current = location;
      setSection("timeline");
    }
  }

  function closePlan() {
    nextLocation.current = { key: "plan-trigger" };
    setSection(undefined);
  }

  function toggleTask(id: string) {
    setChecked((previous) =>
      previous.includes(id) ? previous.filter((task) => task !== id) : [...previous, id],
    );
  }

  return (
    <main className={styles.layout}>
      <div className={styles.toolbar}>
        <Sheet
          variant="sidebar"
          title="Panel boczny"
          trigger={<IconButton icon="sidebar" size="md" label="Otwórz panel boczny" />}
        />
      </div>
      <section
        ref={scrollport}
        className={styles.scrollport}
        aria-label="Rozmowa z Milą"
        data-chat
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Region przewijany klawiaturą.
        tabIndex={0}
      >
        <div className={styles.thread} role="log" aria-label="Wiadomości">
          {messages.map((message, index) => {
            switch (message.kind) {
              case "question":
                return (
                  <QuestionTurn
                    key={`question-${index}-${message.question}`}
                    id={message.question}
                    text={message.text}
                    previousAnswer={message.previousAnswer}
                    asOf={asOf}
                    birthDate={profile.birthDate}
                    onAnswer={index === activeIndex ? (value) => answer(index, value) : undefined}
                    onCancel={index === revision ? cancelEdit : undefined}
                  />
                );
              case "answer":
                return (
                  <UserMessage
                    key={`answer-${index}`}
                    question={guideQuestions[message.question].label}
                    onEdit={
                      editable.get(message.question) === index &&
                      !(revision !== undefined && message.question === context)
                        ? () => edit(message.question)
                        : undefined
                    }
                  >
                    {message.text}
                  </UserMessage>
                );
              case "help":
                return (
                  <GuideHelpReply
                    key={`help-${message.exchange.id}`}
                    exchange={message.exchange}
                    onContinue={
                      context && index === messages.length - 1 ? continueConversation : undefined
                    }
                  />
                );
              case "plan":
                return (
                  <PlanTurn
                    key={`plan-${index}`}
                    stage={message.stage}
                    profile={profile}
                    period={period}
                    asOf={asOf}
                    interests={answers.planInterests}
                    controls={
                      index === activeIndex
                        ? {
                            section,
                            checked,
                            onOpen: openPlan,
                            onClose: closePlan,
                            onSectionChange: setSection,
                            onToggle: toggleTask,
                          }
                        : undefined
                    }
                  />
                );
            }
          })}
        </div>
        <footer ref={footer} className={styles.footer}>
          <div className={styles.dock}>
            <ChatComposer
              reaction={reaction}
              thinking={thinking}
              onSend={send}
              awaitingAnswer={Boolean(context)}
              onOpenPlan={ready ? openPlan : undefined}
            />
          </div>
        </footer>
      </section>
    </main>
  );
}

function moveToMessage(region: HTMLElement | null, { key, scrollOnly }: MessageLocation) {
  const target = region?.querySelector<HTMLElement>(`[data-chat-focus="${key}"]`);
  if (!target || !region) return;
  if (!scrollOnly) target.focus({ preventScroll: true });
  if (key === "plan") {
    target.scrollIntoView({ block: "start" });
    return;
  }
  const turn = target.closest<HTMLElement>("[data-chat-scroll]");
  const { scrollPaddingBlockStart, scrollPaddingBlockEnd } = getComputedStyle(region);
  const availableHeight =
    region.clientHeight - parseFloat(scrollPaddingBlockStart) - parseFloat(scrollPaddingBlockEnd);
  const visible = turn && turn.offsetHeight <= availableHeight ? turn : target;
  visible.scrollIntoView({ block: "nearest" });
}
