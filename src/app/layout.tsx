import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RefineryLens · Independent refinery research", template: "%s · RefineryLens" },
  description: "Independent investor research on refinery businesses. Understand the change. Examine the evidence. Reassess your investment thesis.",
  applicationName: "RefineryLens",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a1628" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
