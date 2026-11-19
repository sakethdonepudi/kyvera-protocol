"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Disclosure, cn } from "./ui";

const VIDEOS = [
  {
    id: "overview",
    label: "Overview",
    title: "The 90-second overview",
    duration: "1:36",
    src: "/demo/kyvera-explainer-90s.mp4",
    poster: "/demo/kyvera-explainer-poster.jpg",
    captions: "/demo/kyvera-explainer-90s.vtt",
  },
  {
    id: "technical",
    label: "Technical demo",
    title: "The three-minute technical demo",
    duration: "3:08",
    src: "/demo/kyvera-judge-demo-3min.mp4",
    poster: "/demo/kyvera-judge-poster.jpg",
    captions: "/demo/kyvera-judge-demo-3min.vtt",
  },
];

export function TutorialCinema() {
  const [active, setActive] = useState(VIDEOS[0]!.id);
  const current = VIDEOS.find((video) => video.id === active) ?? VIDEOS[0]!;

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-12 sm:py-16">
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex rounded-xl border border-ivory/[0.08] bg-black p-1.5">
            <Image
              src="/brand/kyvera-primary-logo.png"
              alt="KYVERA — Keys change. Trust continues."
              width={1774}
              height={887}
              priority
              className="h-auto w-[184px] rounded-lg object-contain"
            />
          </div>
          <h1 className="mt-7 font-display text-[42px] leading-[1.02] tracking-editorial text-ivory sm:text-[58px]">
            See KYVERA in action.
          </h1>
          <p className="mt-3 max-w-md text-[12.5px] leading-relaxed text-ivory-dim">
            Two films, recorded from the real application.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-full border border-ivory/[0.1] bg-ivory/[0.02] p-1">
          {VIDEOS.map((video) => (
            <button
              key={video.id}
              type="button"
              onClick={() => setActive(video.id)}
              aria-pressed={active === video.id}
              className={cn(
                "rounded-full px-4 py-2 text-[12px] transition-colors duration-200",
                active === video.id
                  ? "bg-ivory text-charcoal-950"
                  : "text-ivory-muted hover:text-ivory",
              )}
            >
              {video.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass mt-8 rounded-2xl p-2">
        <div className="overflow-hidden rounded-xl bg-black">
          {VIDEOS.map((video) => (
            <video
              key={video.id}
              id={video.id}
              className={cn("block aspect-video h-auto w-full", active !== video.id && "hidden")}
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
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-ivory-muted">
          <span>
            {current.title} · {current.duration}
          </span>
          <a
            href={current.src}
            className="text-ivory-dim transition-colors hover:text-signal"
          >
            Download MP4
          </a>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Disclosure summary="Demo details">
          Recorded from the deployed application with deterministic demo data. No wallet approval,
          mainnet transaction, txid or payment receipt is simulated. Captions are on by default.
        </Disclosure>
        <div className="flex flex-wrap gap-5 text-[12px]">
          <Link href="/challenge" className="text-signal transition-colors hover:text-signal-bright">
            Try the challenge →
          </Link>
          <Link href="/create" className="text-ivory-muted transition-colors hover:text-ivory">
            Create an identity
          </Link>
        </div>
      </div>
    </div>
  );
}
