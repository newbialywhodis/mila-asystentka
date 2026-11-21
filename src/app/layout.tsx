import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TooltipProvider } from "../components/ui/Tooltip";
import "./globals.css";

const title = "Mila: Asystent dla Twoich świadczeń";
const description =
  "Odpowiedz na krótkie pytania i sprawdź możliwe świadczenia, terminy oraz kolejne czynności. Bez konta. Zobacz przykładowy plan i poznaj ograniczenia prototypu.";
// Set only for a verified public deployment; local development has no canonical URL.
const siteUrl = process.env.MILA_SITE_URL;

export const metadata: Metadata = {
  title,
  description,
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  openGraph: {
    title,
    description,
    siteName: "Mila",
    locale: "pl_PL",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <TooltipProvider delay={450}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
