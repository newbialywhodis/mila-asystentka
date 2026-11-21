import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect, RedirectType } from "next/navigation";
import { Icon } from "../../../components/ui/Icon";
import { demoProfile, demoProfileCookie } from "../../../features/guide/demo-profile";
import { parseStartTopics, topicChatHref } from "../../../features/guide/startTopics";
import banner from "./banner-desktop-2x.webp";
import coatOfArms from "./herb-polski.webp";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Logowanie demonstracyjne — Mila",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { topics } = await searchParams;
  const chatHref = topicChatHref(parseStartTopics(topics));

  async function signIn() {
    "use server";
    const cookieStore = await cookies();
    cookieStore.set(demoProfileCookie, demoProfile.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/chat",
    });
    redirect(chatHref, RedirectType.replace);
  }

  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="login-title">
        <header className={styles.header}>
          <div className={styles.brand}>
            <Image src={coatOfArms} alt="Herb Polski" className={styles.coatOfArms} unoptimized />
            <span className={styles.wordmark}>Mila</span>
            <span className={styles.badge}>Tryb demo</span>
          </div>
          <Link href={chatHref} className={styles.backLink}>
            <Icon name="back" size="sm" />
            Wróć do rozmowy
          </Link>
        </header>
        <h1 id="login-title">Zaloguj się do Mili</h1>
        <p className={styles.intro}>
          W trybie demonstracyjnym możesz korzystać z Mili bez podawania swoich danych.
        </p>
        <div className={styles.choices}>
          <form action={signIn}>
            <button type="submit" className={styles.tile}>
              <span className={styles.tileIcon}>
                <Icon name="shield" />
              </span>
              <span className={styles.tileText}>
                <strong>Kontynuuj z profilem demo</strong>
                <span>Otwórz rozmowę jako {demoProfile.name}.</span>
              </span>
              <span className={styles.tileArrow}>
                <Icon name="chevron" />
              </span>
            </button>
          </form>
          <a className={styles.tile} href="https://login.gov.pl/">
            <span className={styles.tileIcon}>
              <Icon name="contract" />
            </span>
            <span className={styles.tileText}>
              <strong>Oficjalny serwis login.gov.pl</strong>
              <span>Przejdź do rządowej strony logowania do e-usług.</span>
            </span>
            <span className={styles.tileArrow}>
              <Icon name="arrowUpRight" />
            </span>
          </a>
        </div>
      </section>
      <aside className={styles.banner} aria-labelledby="banner-title">
        <Image
          src={banner}
          alt="Telefon z przykładowym powiadomieniem do potwierdzenia w aplikacji mObywatel"
          fill
          preload
          sizes="(max-width: 48rem) calc(100vw - 2rem), 50vw"
          className={styles.bannerImage}
        />
        <div className={styles.bannerCopy}>
          <h2 id="banner-title">Powiadomienia w aplikacji mObywatel</h2>
          <p>Profil zaufany pozwala potwierdzać operacje za pomocą powiadomień w aplikacji.</p>
          <a href="https://www.gov.pl/web/login/jak-korzystac" className={styles.bannerLink}>
            Jak działa login.gov.pl
            <Icon name="arrowUpRight" size="sm" />
          </a>
        </div>
      </aside>
    </main>
  );
}
