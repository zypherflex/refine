import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ink: Atlantic navy carries the structure (sidebar, header bands, headings). 950 is Atlantic navy, 800 is Navy 800,
        // 50 is Mist (panels and table headers).
        ink: { 950: "#0b1530", 900: "#111e40", 800: "#182a5a", 700: "#2a3a66", 600: "#475477", 500: "#677290", 400: "#8d96ae", 300: "#b4bbcd", 200: "#d5dae6", 100: "#e6e9f2", 50: "#f3f5fc" },
        // Brand: electric violet, for actions, links, focus and verified businesses. 600 and darker carry white text.
        brand: { 900: "#2a1470", 800: "#3a1ba3", 700: "#4a22cc", 600: "#5b2ee8", 500: "#7148ff", 400: "#9373ff", 300: "#b8a3ff", 200: "#d8ccff", 100: "#ebe5ff", 50: "#f6f3ff" },
        // Sun: sunset orange, the warm highlight for eyebrows, badges and calls to action on colour. Small text uses 700.
        sun: { 700: "#b84a00", 600: "#e45c00", 500: "#ff7a1a", 400: "#ff9a4d", 300: "#ffbd85", 200: "#ffd9b8", 100: "#ffe8d6", 50: "#fff6ee" },
        // Signal amber: warnings only, never decoration.
        amber: { 800: "#7a4a05", 700: "#95600a", 600: "#b7791f", 400: "#e2a843", 100: "#fbefd5", 50: "#fdf8ec" },
        risk: { 800: "#8a1c1c", 700: "#a52a2a", 600: "#c23b3b", 100: "#f9dede", 50: "#fdf3f3" },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["\"JetBrains Mono Variable\"", "\"JetBrains Mono\"", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        serif: ["\"Source Serif 4 Variable\"", "\"Source Serif 4\"", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,21,48,0.04), 0 1px 1px rgba(11,21,48,0.03)",
        lift: "0 10px 30px -12px rgba(11,21,48,0.18), 0 2px 6px rgba(11,21,48,0.05)",
      },
      letterSpacing: { eyebrow: "0.14em" },
    },
  },
  plugins: [],
} satisfies Config;
