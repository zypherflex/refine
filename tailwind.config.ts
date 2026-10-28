import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ink: navy-tinted neutrals, from the white page background to Atlantic navy (#0b1530), the structural colour of
        // the brand. Deep blue is the accent for actions, links and verified states; amber marks highlights; white is the page.
        ink: { 950: "#0b1530", 900: "#111c3a", 800: "#1b2748", 700: "#2b3a60", 600: "#45557c", 500: "#66759a", 400: "#8b97b6", 300: "#b3bdd3", 200: "#d5dbe9", 100: "#e7ebf4", 50: "#f4f6fb" },
        // Atlantic navy ramp, more saturated than ink, for navy fills and data marks.
        navy: { 950: "#0b1530", 900: "#111e42", 800: "#182a5a", 700: "#22387a", 600: "#2e4a9b", 500: "#4766be", 400: "#6f8ad6", 300: "#a3b4e6", 200: "#cbd5f2", 100: "#e4e9f8", 50: "#f3f5fc" },
        // Brand deep blue: the main accent. Used for actions, focus and verified states.
        brand: { 900: "#0b2266", 800: "#0f2f8a", 700: "#1339ad", 600: "#1a47d1", 500: "#2f5fe8", 400: "#5b82f0", 300: "#96b0f6", 100: "#dce5fd", 50: "#eef3fe" },
        // Amber: the warm second accent for highlights and the brand band. 500 and lighter are for dark backgrounds.
        amber: { 800: "#7a4a05", 700: "#95600a", 600: "#b7791f", 500: "#f5a524", 400: "#f7b84b", 300: "#fbd38a", 100: "#fbefd5", 50: "#fdf8ec" },
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
