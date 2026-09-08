import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1360px" },
    },
    extend: {
      colors: {
        cream: {
          50: "#FDFBF7",
          100: "#F8F3EA",
          200: "#F0E6D6",
          300: "#E4D4BC",
          400: "#D4BC9A",
        },
        chai: {
          50: "#FBF3EA",
          100: "#F4E1C9",
          200: "#E8C296",
          300: "#DBA363",
          400: "#CE8A3C",
          500: "#B9722A",
          600: "#985A21",
          700: "#77461C",
          800: "#57341A",
          900: "#3B2413",
        },
        charcoal: {
          50: "#F5F5F4",
          100: "#E7E5E4",
          300: "#A8A29E",
          500: "#57534E",
          700: "#332F2C",
          800: "#232020",
          900: "#171414",
        },
        circuit: {
          400: "#3DBE8B",
          500: "#20A06E",
          600: "#158055",
        },
        chilli: {
          400: "#E86A5A",
          500: "#D6412D",
          600: "#B02F1E",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(35,32,32,.04), 0 8px 24px -12px rgba(35,32,32,.14)",
        lift: "0 2px 4px rgba(35,32,32,.05), 0 18px 40px -18px rgba(35,32,32,.28)",
      },
      backgroundImage: {
        blueprint:
          "linear-gradient(rgba(185,114,42,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(185,114,42,.07) 1px, transparent 1px)",
      },
      backgroundSize: { blueprint: "28px 28px" },
      keyframes: {
        steam: {
          "0%": { opacity: "0", transform: "translateY(4px) scaleX(1)" },
          "35%": { opacity: ".55" },
          "100%": { opacity: "0", transform: "translateY(-26px) scaleX(1.5)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "none" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        pop: {
          "0%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.28)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        steam: "steam 3.6s ease-out infinite",
        "fade-up": "fade-up .5s cubic-bezier(.22,1,.36,1) both",
        shimmer: "shimmer 1.6s infinite",
        pop: "pop .38s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
