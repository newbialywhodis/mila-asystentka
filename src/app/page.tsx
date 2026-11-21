import type { Metadata } from "next";
import { MilaLanding } from "../features/landing/MilaLanding";

export const metadata: Metadata = process.env.MILA_SITE_URL
  ? { alternates: { canonical: "/" } }
  : {};

export default function Home() {
  return <MilaLanding />;
}
