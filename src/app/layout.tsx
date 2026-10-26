import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RefineryLens · Business opportunities around Dangote", template: "%s · RefineryLens" },
  description: "Independent business intelligence on opportunities around Dangote, for businesses of every size: sourced facts, dated reports and transparent sizing tools.",
  applicationName: "RefineryLens",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#063d24" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
