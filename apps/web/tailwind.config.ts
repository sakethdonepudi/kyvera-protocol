import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050807",
          900: "#080c0b",
          850: "#0b1110",
          800: "#0e1513",
          700: "#141d1b",
        },
        accent: {
          DEFAULT: "#3ddc97",
          bright: "#5ef2b2",
          dim: "#1f8f66",
          soft: "rgba(61,220,151,0.12)",
        },
        muted: "#8ea4a0",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,220,151,0.18), 0 16px 60px -24px rgba(61,220,151,0.35)",
      },
      keyframes: {
        fade: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fade: "fade 180ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
