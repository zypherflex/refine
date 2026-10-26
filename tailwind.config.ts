import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ink: green-tinted neutrals, from the white page background to the deep forest sidebar.
        ink: { 950: "#03140c", 900: "#082216", 800: "#0f2f20", 700: "#1b4331", 600: "#365a48", 500: "#5a7a69", 400: "#7f998b", 300: "#a6bcb0", 200: "#d0ded6", 100: "#e4eee8", 50: "#f4f9f6" },
        // Brand green: the single accent. Used for actions, focus and verified states.
        brand: { 900: "#053b22", 800: "#064d2c", 700: "#076339", 600: "#087c47", 500: "#0c9a58", 400: "#2fbf78", 300: "#7bdba7", 100: "#d2f2e0", 50: "#ecfaf2" },
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
