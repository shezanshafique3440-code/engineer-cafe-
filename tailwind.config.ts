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
      /**
       * Every palette entry resolves through a CSS variable so the whole site
       * can be re-skinned from one `data-theme` attribute on <html> — no
       * rebuild, no per-component change. The triplets live in globals.css.
       */
      colors: {
        cream: {
          50: "rgb(var(--c-cream-50) / <alpha-value>)",
          100: "rgb(var(--c-cream-100) / <alpha-value>)",
          200: "rgb(var(--c-cream-200) / <alpha-value>)",
          300: "rgb(var(--c-cream-300) / <alpha-value>)",
          400: "rgb(var(--c-cream-400) / <alpha-value>)",
        },
        chai: {
          50: "rgb(var(--c-chai-50) / <alpha-value>)",
          100: "rgb(var(--c-chai-100) / <alpha-value>)",
          200: "rgb(var(--c-chai-200) / <alpha-value>)",
          300: "rgb(var(--c-chai-300) / <alpha-value>)",
          400: "rgb(var(--c-chai-400) / <alpha-value>)",
          500: "rgb(var(--c-chai-500) / <alpha-value>)",
          600: "rgb(var(--c-chai-600) / <alpha-value>)",
          700: "rgb(var(--c-chai-700) / <alpha-value>)",
          800: "rgb(var(--c-chai-800) / <alpha-value>)",
          900: "rgb(var(--c-chai-900) / <alpha-value>)",
        },
        charcoal: {
          50: "rgb(var(--c-charcoal-50) / <alpha-value>)",
          100: "rgb(var(--c-charcoal-100) / <alpha-value>)",
          300: "rgb(var(--c-charcoal-300) / <alpha-value>)",
          500: "rgb(var(--c-charcoal-500) / <alpha-value>)",
          700: "rgb(var(--c-charcoal-700) / <alpha-value>)",
          800: "rgb(var(--c-charcoal-800) / <alpha-value>)",
          900: "rgb(var(--c-charcoal-900) / <alpha-value>)",
        },
        circuit: {
          400: "rgb(var(--c-circuit-400) / <alpha-value>)",
          500: "rgb(var(--c-circuit-500) / <alpha-value>)",
          600: "rgb(var(--c-circuit-600) / <alpha-value>)",
        },
        chilli: {
          400: "rgb(var(--c-chilli-400) / <alpha-value>)",
          500: "rgb(var(--c-chilli-500) / <alpha-value>)",
          600: "rgb(var(--c-chilli-600) / <alpha-value>)",
        },
        /**
         * Cards and inputs. Pure white on the light themes, a raised dark
         * panel on the dark ones — which is why it is a token and not
         * `bg-white`. Plain `text-white` stays real white: it only ever sits
         * on a saturated accent, where light text is right in every theme.
         */
        surface: "rgb(var(--c-surface) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(var(--c-shadow) / .04), 0 8px 24px -12px rgb(var(--c-shadow) / .14)",
        lift: "0 2px 4px rgb(var(--c-shadow) / .05), 0 18px 40px -18px rgb(var(--c-shadow) / .28)",
      },
      backgroundImage: {
        blueprint:
          "linear-gradient(rgb(var(--c-blueprint) / var(--c-blueprint-alpha)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-blueprint) / var(--c-blueprint-alpha)) 1px, transparent 1px)",
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
