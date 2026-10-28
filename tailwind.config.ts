import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ink: the brand's primary neutral, from page background to deep sidebar.
        navy: { 950: "#050c18", 900: "#0a1628", 800: "#122338", 700: "#1d3450", 600: "#3a5272", 500: "#5d7393", 400: "#7d90ab", 300: "#a9b7ca", 200: "#d3dce8", 100: "#e6ebf2", 50: "#f5f7fa" },
        // Lens: the single brand accent. Used for actions, focus and verified states.
        teal: { 900: "#073f3d", 800: "#09514e", 700: "#0b6a66", 600: "#0e8580", 500: "#16a39c", 400: "#3fc1b8", 300: "#86ddd5", 100: "#d4f2ee", 50: "#effaf8" },
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
