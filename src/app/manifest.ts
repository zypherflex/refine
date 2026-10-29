import type { MetadataRoute } from "next";

/** Web app manifest: lets phones and desktops install RefineryLens as an app. It opens on today's prices for households and visitors, and on the trade hub for businesses. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RefineryLens",
    short_name: "RefineryLens",
    description: "Fuel and gas prices near you, cooking gas refills to your door, and Nigeria's trade hub for fuel and gas businesses.",
    id: "/hub",
    start_url: "/?source=app",
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
      { name: "Today's prices", url: "/today", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Order gas", url: "/order", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Price board", url: "/hub/prices", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Gas network", url: "/hub/gas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Inbox", url: "/hub/inbox", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
