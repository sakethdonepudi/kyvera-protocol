import type { Metadata } from "next";
import "./globals.css";
import { Footer, Header } from "@/components/chrome";

export const metadata: Metadata = {
  title: "KYVERA — Identity. Proven.",
  description:
    "Cryptographically verifiable identity lifecycle for Bitcoin Cash and Nostr. Distinguishes a valid historical proof from the currently authorized payment identity.",
  openGraph: {
    title: "KYVERA — Identity. Proven.",
    description:
      "BCH + Nostr identity binding with rotation, revocation and independent verification.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 font-sans antialiased">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(61,220,151,0.10),transparent_62%)]" />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
