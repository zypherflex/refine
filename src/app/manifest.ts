import type { MetadataRoute } from "next";

/** Web app manifest: lets phones and desktops install RefineryLens as an app that opens full screen on the trade hub. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RefineryLens",
    short_name: "RefineryLens",
    description: "Buy, sell and deliver fuel and gas in Nigeria: verified businesses, state prices, delivery jobs and the gas network.",
    id: "/hub",
    start_url: "/hub?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Price board", url: "/hub/prices", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Gas network", url: "/hub/gas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Delivery jobs", url: "/hub/jobs", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Inbox", url: "/hub/inbox", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
