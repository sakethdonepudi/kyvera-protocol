import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KYVERA — Identity continuity protocol",
    short_name: "KYVERA",
    description:
      "Independently verify BCH–Nostr identity bindings across rotation and revocation.",
    start_url: "/",
    display: "standalone",
    background_color: "#090B0E",
    theme_color: "#090B0E",
    icons: [
      {
        src: "/brand/kyvera-icon-256.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/brand/kyvera-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
