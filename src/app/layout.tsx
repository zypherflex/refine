import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import { ServiceWorker } from "@/components/AppInstall";
import { NativeBridge } from "@/components/native/NativeBridge";

export const metadata: Metadata = {
  title: { default: "RefineryLens · Nigeria's trade hub for fuel and gas", template: "%s · RefineryLens" },
  description: "Today's fuel and gas prices, verified sellers, buyers, delivery partners and refineries, and independent research on Nigeria's fuel and gas businesses.",
  applicationName: "RefineryLens",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  // Installed on iPhone and iPad from Safari's Share → Add to Home Screen; opens full screen.
  appleWebApp: { capable: true, title: "RefineryLens", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen font-sans">
        {children}
        <ServiceWorker />
        <NativeBridge />
      </body>
    </html>
  );
}
