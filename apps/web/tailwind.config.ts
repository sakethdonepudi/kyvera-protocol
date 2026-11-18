import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "rgb(var(--c-950) / <alpha-value>)",
          900: "rgb(var(--c-900) / <alpha-value>)",
          850: "rgb(var(--c-850) / <alpha-value>)",
          800: "rgb(var(--c-800) / <alpha-value>)",
          700: "rgb(var(--c-700) / <alpha-value>)",
        },
        ivory: {
          DEFAULT: "rgb(var(--ivory) / <alpha-value>)",
          dim: "rgb(var(--ivory-dim) / <alpha-value>)",
          muted: "rgb(var(--ivory-muted) / <alpha-value>)",
        },
        signal: {
          DEFAULT: "rgb(var(--signal) / <alpha-value>)",
          bright: "rgb(var(--signal-bright) / <alpha-value>)",
          dim: "rgb(var(--signal-dim) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          bright: "rgb(var(--accent-bright) / <alpha-value>)",
          dim: "rgb(var(--accent-dim) / <alpha-value>)",
          soft: "rgb(var(--accent) / 0.12)",
        },
        // Backward-compatible aliases used by earlier components.
        ink: {
          950: "rgb(var(--c-950) / <alpha-value>)",
          900: "rgb(var(--c-900) / <alpha-value>)",
          850: "rgb(var(--c-850) / <alpha-value>)",
          800: "rgb(var(--c-800) / <alpha-value>)",
          700: "rgb(var(--c-700) / <alpha-value>)",
        },
        muted: "rgb(var(--ivory-muted) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
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
        sm: "8px",
        DEFAULT: "12px",
        md: "14px",
        lg: "18px",
        xl: "22px",
        "2xl": "26px",
        "3xl": "32px",
      },
      letterSpacing: {
        tightest: "-0.035em",
        editorial: "-0.02em",
      },
      boxShadow: {
        hairline: "inset 0 0 0 1px rgba(241,236,223,0.06)",
        lift: "0 24px 80px -48px rgba(0,0,0,0.9)",
        glass: "0 20px 70px -32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      backdropBlur: {
        glass: "20px",
      },
      keyframes: {
        fade: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(10px) scale(0.995)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        sweep: {
          from: { transform: "scaleX(0)", opacity: "0.4" },
          to: { transform: "scaleX(1)", opacity: "1" },
        },
      },
      animation: {
        fade: "fade 180ms ease-out both",
        rise: "rise 360ms cubic-bezier(0.22,1,0.36,1) both",
        pulse: "pulse 2.4s ease-in-out infinite",
        sweep: "sweep 420ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
