import { notFound } from "next/navigation";
import { Button } from "../../components/ui/Button";
import { FamilyHug } from "../../features/landing/animations/FamilyHug";
import styles from "../../features/landing/animations/Preview.module.css";

export default function AnimationPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className={styles.preview}>
      <h1>Blisko siebie</h1>
      <p>Podgląd rodzinnego uścisku Mili.</p>
      <div className={styles.stage}>
        <FamilyHug />
      </div>
      {/* A native GET reloads the document and restarts CSS without client state. */}
      <form action="/animation-preview" method="get">
        <Button type="submit" variant="link" size="lg">
          Obejrzyj ponownie
        </Button>
      </form>
    </main>
  );
}
