import type { Metadata } from "next";
import "./globals.css";
import { Footer, Header } from "@/components/chrome";

export const metadata: Metadata = {
  title: "KYVERA — Identity continuity protocol",
  description:
    "Your keys change. Your identity continues. Cryptographically verify Bitcoin Cash and Nostr identities across wallet rotation, revocation, and decentralized discovery.",
  openGraph: {
    title: "KYVERA — Identity continuity protocol",
    description:
      "Verifiable BCH + Nostr identity lifecycle: rotation, revocation, stale-state and equivocation detection without a central authority.",
    type: "website",
  },
};

const themeScript = `try{var t=localStorage.getItem("kyvera-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-charcoal-950 font-sans antialiased">
        <div className="aurora pointer-events-none fixed inset-x-0 top-0 -z-10 h-[620px]" />
        <div className="grid-surface pointer-events-none fixed inset-0 -z-20 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_58%)]" />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
