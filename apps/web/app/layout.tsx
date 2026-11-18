import type { Metadata } from "next";
import "./globals.css";
import { Footer, Header } from "@/components/chrome";

export const metadata: Metadata = {
  title: "KYVERA — Identity continuity protocol",
  description:
    "Keys change. Trust shouldn't disappear. KYVERA makes Bitcoin Cash and Nostr identity transitions independently verifiable — binding, rotation, revocation and conflict detection.",
  openGraph: {
    title: "KYVERA — Identity continuity protocol",
    description:
      "Verifiable BCH + Nostr identity lifecycle: rotation, revocation, stale-state and equivocation detection without a central authority.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-charcoal-950 font-sans antialiased">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(240,90,40,0.07),transparent_58%)]" />
        <div className="pointer-events-none fixed inset-0 -z-20 opacity-[0.35] grid-surface [mask-image:linear-gradient(to_bottom,black,transparent_55%)]" />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
