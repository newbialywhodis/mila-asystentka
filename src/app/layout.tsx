import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TooltipProvider } from "../components/ui/Tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mila – przewodnik przyszłego rodzica",
  description: "Ułóż swój plan świadczeń, terminów i formalności z Milą.",
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
