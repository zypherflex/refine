import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native Android and iOS apps for Google Play and the App Store. The apps load the live RefineryLens site (a server-
 * rendered Next.js app), so web, Android and iPhone share one codebase; native plugins add push notifications,
 * sharing, the Android back button, the splash screen and status bar. See mobile/README.md.
 *
 * Set CAP_SERVER_URL to the production HTTPS address before `npx cap sync`. The app ID cannot change once published.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://app.refinerylens.ng";
const host = new URL(serverUrl).host;

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID ?? "ng.refinerylens.app",
  appName: "RefineryLens",
  // Shown only if the site cannot be reached when the app starts.
  webDir: "mobile/www",
  server: {
    url: `${serverUrl.replace(/\/$/, "")}/hub?source=app`,
    // Only the RefineryLens site loads inside the app; every other link opens in the phone's browser.
    allowNavigation: [host],
    errorPath: "offline.html",
  },
  android: { allowMixedContent: false, backgroundColor: "#ffffff" },
  ios: { contentInset: "automatic", backgroundColor: "#ffffff", limitsNavigationsToAppBoundDomains: true },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: false, backgroundColor: "#ffffff", showSpinner: false, androidScaleType: "CENTER_INSIDE" },
    StatusBar: { style: "LIGHT", backgroundColor: "#ffffff", overlaysWebView: false },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
