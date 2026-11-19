import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, SectionLabel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Watch the KYVERA demo",
  description:
    "90-second explainer and three-minute judge walkthrough of the KYVERA identity-continuity protocol.",
};

const videos = [
  {
    id: "explainer",
    title: "90-second explainer",
    description:
      "The problem, the dual-key binding, independent verification, rotation and the difference between historical proof and current authorization.",
    src: "/demo/kyvera-explainer-90s.mp4",
    poster: "/demo/kyvera-explainer-poster.jpg",
    captions: "/demo/kyvera-explainer-90s.vtt",
  },
  {
    id: "judge",
    title: "Three-minute judge walkthrough",
    description:
      "The real product from Create Identity through the five-stage Trust Challenge, merchant rotation, authentication and security boundaries.",
    src: "/demo/kyvera-judge-demo-3min.mp4",
    poster: "/demo/kyvera-judge-poster.jpg",
    captions: "/demo/kyvera-judge-demo-3min.vtt",
  },
];

export default function TutorialPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-5 py-10">
      <div className="max-w-2xl">
        <div className="kicker text-signal">Watch KYVERA</div>
        <h1 className="mt-3 font-display text-[38px] leading-[1.04] tracking-editorial text-ivory sm:text-[50px]">
          Two minutes.
          <br />
          One trust model.
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ivory-dim">
          Recorded from the real application with deterministic demo data. No wallet approval or
          on-chain transaction is simulated.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="accent">narrated</Badge>
          <Badge tone="accent">captions</Badge>
          <Badge tone="neutral">no autoplay</Badge>
          <Badge tone="neutral">demo fixtures</Badge>
        </div>
      </div>

      <div className="mt-7 space-y-6">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden">
            <div className="border-b border-ivory/[0.08] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <SectionLabel>{video.title}</SectionLabel>
                  <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ivory-dim">
                    {video.description}
                  </p>
                </div>
                <a
                  href={video.src}
                  className="font-mono text-[9px] uppercase tracking-[0.12em] text-signal hover:text-signal-bright"
                >
                  Download MP4
                </a>
              </div>
            </div>
            <div className="bg-black">
              <video
                id={video.id}
                className="block aspect-video h-auto w-full"
                controls
                playsInline
                preload="metadata"
                poster={video.poster}
                width={1920}
                height={1080}
                aria-label={`${video.title}. Captions are available.`}
              >
                <source src={video.src} type="video/mp4" />
                <track
                  kind="captions"
                  src={video.captions}
                  srcLang="en"
                  label="English captions"
                  default
                />
                Your browser cannot play this MP4.{" "}
                <a href={video.src} className="underline">
                  Download the video
                </a>
                .
              </video>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>What to look for</SectionLabel>
          <ul className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-ivory-dim">
            <li>◆ Two independent signatures: BCH wallet and Nostr identity.</li>
            <li>◆ The verifier resolves signed records; no KYVERA server decides.</li>
            <li>◆ Wallet A remains historically valid after rotation.</li>
            <li>◆ Wallet A is no longer the current authorized destination.</li>
            <li>◆ A relying party issues a single-use challenge and a short session.</li>
          </ul>
        </Card>
        <Card className="p-5">
          <SectionLabel>What is not shown</SectionLabel>
          <ul className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-ivory-dim">
            <li>◆ No real-wallet approval or signature is fabricated.</li>
            <li>◆ No mainnet transaction, txid or confirmation is simulated.</li>
            <li>◆ Public-relay history completeness is not claimed.</li>
            <li>◆ The demo uses clearly labelled throwaway fixtures.</li>
          </ul>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/challenge" className="text-[12.5px] text-signal hover:text-signal-bright">
          Try the Trust Challenge →
        </Link>
        <Link href="/create" className="text-[12.5px] text-ivory-dim hover:text-ivory">
          Create an identity
        </Link>
        <Link href="/developers" className="text-[12.5px] text-ivory-dim hover:text-ivory">
          Integration guide
        </Link>
      </div>
    </div>
  );
}
