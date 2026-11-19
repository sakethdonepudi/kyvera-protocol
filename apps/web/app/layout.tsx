import type { Metadata } from "next";
import "./globals.css";
import { Footer, Header } from "@/components/chrome";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://kyvera-alpha.vercel.app"),
  title: "KYVERA — Identity continuity protocol",
  description:
    "Your keys change. Your identity continues. Cryptographically verify Bitcoin Cash and Nostr identities across wallet rotation, revocation, and decentralized discovery.",
  openGraph: {
    title: "KYVERA — Identity continuity protocol",
    description:
      "Verifiable BCH + Nostr identity lifecycle: rotation, revocation, stale-state and equivocation detection without a central authority.",
    type: "website",
    images: [
      {
        url: "/brand/kyvera-og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "KYVERA — Keys change. Trust continues.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KYVERA — Identity continuity protocol",
    description:
      "Verifiable BCH + Nostr identity lifecycle without a central authority.",
    images: ["/brand/kyvera-og-1200x630.png"],
  },
  other: {
    "kyvera-commit": process.env.NEXT_PUBLIC_KYVERA_COMMIT ?? "dev",
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
