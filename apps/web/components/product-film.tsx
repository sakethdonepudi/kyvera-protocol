"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "./ui";

const FULL_FILM = "/demo/kyvera-v5-product-film.mp4";
const PREVIEW = "/demo/kyvera-v5-preview.mp4";
const POSTER = "/demo/kyvera-v5-poster.webp";
const CAPTIONS = "/demo/kyvera-v5-product-film.vtt";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function FilmModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      videoRef.current?.pause();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="KYVERA product film"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="glass-strong w-full max-w-[1120px] overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-ivory/[0.08] px-4 py-3">
          <div className="text-[11.5px] font-medium text-ivory">KYVERA in action</div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-ivory/15 px-3 py-1.5 text-[11px] text-ivory-muted transition-colors hover:border-ivory/40 hover:text-ivory"
          >
            Close
          </button>
        </div>
        <div className="bg-black">
          <video
            ref={videoRef}
            className="block aspect-video h-auto w-full"
            controls
            autoPlay
            playsInline
            preload="metadata"
            poster={POSTER}
            width={1920}
            height={1080}
            aria-label="KYVERA product film. Captions are available."
          >
            <source src={FULL_FILM} type="video/mp4" />
            <track kind="captions" src={CAPTIONS} srcLang="en" label="English captions" default />
            Your browser cannot play this MP4.{" "}
            <a href={FULL_FILM} className="underline">
              Download the film
            </a>
            .
          </video>
        </div>
      </div>
    </div>
  );
}

export function FilmPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduced) {
      video.pause();
      return;
    }
    video.muted = true;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [reduced]);

  return (
    <div>
      <div className="glass overflow-hidden rounded-2xl p-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block w-full overflow-hidden rounded-xl bg-black text-left"
          aria-label="Play the KYVERA product film"
        >
          <video
            ref={videoRef}
            data-testid="film-preview"
            className="block aspect-video h-auto w-full object-cover"
            src={PREVIEW}
            poster={POSTER}
            muted
            loop
            playsInline
            preload="none"
            width={1280}
            height={720}
            aria-hidden="true"
            tabIndex={-1}
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/45 via-transparent to-transparent">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-ivory/30 bg-charcoal-950/55 text-[18px] text-ivory backdrop-blur-md transition-transform duration-200 group-hover:scale-[1.04]">
              ▶
            </span>
          </span>
          <span className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-ivory/15 bg-charcoal-950/55 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ivory-dim backdrop-blur-md">
            The film · 2:00
          </span>
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-signal px-4 py-2.5 text-[12.5px] font-semibold text-charcoal-950 transition-colors duration-200 hover:bg-signal-bright"
        >
          Watch the film
          <span aria-hidden="true">→</span>
        </button>
        <span className="text-[10.5px] text-ivory-muted">
          Silent preview · full narration and captions open on demand
        </span>
      </div>
      {open
        ? createPortal(<FilmModal onClose={() => setOpen(false)} />, document.body)
        : null}
    </div>
  );
}

export function FilmPlayer({ className }: { className?: string }) {
  return (
    <div className={cn("glass rounded-2xl p-2", className)}>
      <video
        className="block aspect-video h-auto w-full rounded-xl bg-black"
        controls
        playsInline
        preload="metadata"
        poster={POSTER}
        width={1920}
        height={1080}
        aria-label="KYVERA v5 product film. Captions are available."
      >
        <source src={FULL_FILM} type="video/mp4" />
        <track kind="captions" src={CAPTIONS} srcLang="en" label="English captions" default />
        Your browser cannot play this MP4.{" "}
        <a href={FULL_FILM} className="underline">
          Download the film
        </a>
        .
      </video>
    </div>
  );
}
