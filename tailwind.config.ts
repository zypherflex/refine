import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ink: navy-tinted neutrals, from the white page background to Atlantic navy (#0b1530), the structural colour of
        // the brand. Electric violet is the accent for actions, links and verified states; sunset orange highlights; white is the page.
        ink: { 950: "#0b1530", 900: "#111c3a", 800: "#1b2748", 700: "#2b3a60", 600: "#45557c", 500: "#66759a", 400: "#8b97b6", 300: "#b3bdd3", 200: "#d5dbe9", 100: "#e7ebf4", 50: "#f4f6fb" },
        // Atlantic navy ramp, more saturated than ink, for navy fills and data marks.
        navy: { 950: "#0b1530", 900: "#111e42", 800: "#182a5a", 700: "#22387a", 600: "#2e4a9b", 500: "#4766be", 400: "#6f8ad6", 300: "#a3b4e6", 200: "#cbd5f2", 100: "#e4e9f8", 50: "#f3f5fc" },
        // Brand: electric violet, for actions, links, focus and verified states. 600 and darker carry white text.
        brand: { 900: "#2a1470", 800: "#3a1ba3", 700: "#4a22cc", 600: "#5b2ee8", 500: "#7148ff", 400: "#9373ff", 300: "#b8a3ff", 200: "#d8ccff", 100: "#ebe5ff", 50: "#f6f3ff" },
        // Sun: sunset orange, the warm highlight for headings, badges and calls to action on colour. Use 700 for small text.
        sun: { 700: "#b84a00", 600: "#e45c00", 500: "#ff7a1a", 400: "#ff9a4d", 300: "#ffbd85", 100: "#ffe8d6", 50: "#fff6ee" },
        amber: { 800: "#7a4a05", 700: "#95600a", 600: "#b7791f", 400: "#e2a843", 100: "#fbefd5", 50: "#fdf8ec" },
        risk: { 800: "#8a1c1c", 700: "#a52a2a", 600: "#c23b3b", 100: "#f9dede", 50: "#fdf3f3" },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["\"Source Serif 4 Variable\"", "\"Source Serif 4\"", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,21,48,0.05), 0 1px 1px rgba(11,21,48,0.03)",
        lift: "0 12px 32px -12px rgba(11,21,48,0.22), 0 2px 6px rgba(11,21,48,0.06)",
      },
      letterSpacing: { eyebrow: "0.14em" },
    },
  },
  plugins: [],
} satisfies Config;
