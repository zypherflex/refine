import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ink: the brand's primary neutral, from page background to deep sidebar.
        navy: { 950: "#050c18", 900: "#0a1628", 800: "#122338", 700: "#1d3450", 600: "#3a5272", 500: "#5d7393", 400: "#7d90ab", 300: "#a9b7ca", 200: "#d3dce8", 100: "#e6ebf2", 50: "#f5f7fa" },
        // Brand: electric violet, for actions, links, focus and verified states. 600 and darker carry white text.
        brand: { 900: "#2a1470", 800: "#3a1ba3", 700: "#4a22cc", 600: "#5b2ee8", 500: "#7148ff", 400: "#9373ff", 300: "#b8a3ff", 200: "#d8ccff", 100: "#ebe5ff", 50: "#f6f3ff" },
        // Sun: sunset orange, the warm highlight for headlines, badges and calls to action on colour.
        sun: { 700: "#b84a00", 600: "#e45c00", 500: "#ff7a1a", 400: "#ff9a4d", 300: "#ffbd85", 100: "#ffe8d6", 50: "#fff6ee" },
        amber: { 800: "#7a4a05", 700: "#95600a", 600: "#b7791f", 400: "#e2a843", 100: "#fbefd5", 50: "#fdf8ec" },
        risk: { 800: "#8a1c1c", 700: "#a52a2a", 600: "#c23b3b", 100: "#f9dede", 50: "#fdf3f3" },
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["\"Source Serif 4 Variable\"", "\"Source Serif 4\"", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,22,40,0.04), 0 1px 1px rgba(10,22,40,0.03)",
        lift: "0 10px 30px -12px rgba(10,22,40,0.18), 0 2px 6px rgba(10,22,40,0.05)",
      },
      letterSpacing: { eyebrow: "0.14em" },
    },
  },
  plugins: [],
} satisfies Config;
