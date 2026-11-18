import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "#0A0A08",
          900: "#0F0F0C",
          850: "#14130F",
          800: "#1A1914",
          700: "#24221C",
        },
        ivory: {
          DEFAULT: "#F1ECDF",
          dim: "#D8D1C2",
          muted: "#8F8A7D",
        },
        signal: {
          DEFAULT: "#F05A28",
          bright: "#FF7040",
          dim: "#B6431C",
        },
        accent: {
          DEFAULT: "#5E9C82",
          bright: "#86BCA4",
          dim: "#3C6E59",
          soft: "rgba(94,156,130,0.12)",
        },
        // Backward-compatible aliases used by earlier components.
        ink: {
          950: "#0A0A08",
          900: "#0F0F0C",
          850: "#14130F",
          800: "#1A1914",
          700: "#24221C",
        },
        muted: "#8F8A7D",
        danger: "#C25B4E",
      },
      fontFamily: {
        display: [
          "Iowan Old Style",
          "Palatino Linotype",
          "Palatino",
          "Book Antiqua",
          "Georgia",
          "serif",
        ],
        sans: [
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "ui-sans-serif",
          "system-ui",
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
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "2px",
        "2xl": "2px",
        "3xl": "2px",
      },
      letterSpacing: {
        tightest: "-0.035em",
        editorial: "-0.02em",
      },
      boxShadow: {
        hairline: "inset 0 0 0 1px rgba(241,236,223,0.06)",
        lift: "0 24px 80px -48px rgba(0,0,0,0.9)",
      },
      keyframes: {
        fade: {
          from: { opacity: "0", transform: "translateY(3px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        sweep: {
          from: { transform: "scaleX(0)", opacity: "0.4" },
          to: { transform: "scaleX(1)", opacity: "1" },
        },
      },
      animation: {
        fade: "fade 160ms ease-out both",
        sweep: "sweep 420ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
