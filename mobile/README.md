# RefineryLens on Google Play and the App Store

The Android and iPhone apps are [Capacitor](https://capacitorjs.com) shells around the live RefineryLens site. They load
`CAP_SERVER_URL` (the production site) inside a native app and add what a website cannot do on its own: push
notifications, the phone's share sheet, the Android back button, a native splash screen and status bar, an offline
banner, and links that open in the app. Web, Android and iPhone therefore share one codebase: deploy the website and
both apps update, without a store release, except when native code or settings change.

| Item | Where |
| --- | --- |
| App settings (ID, server address, plugins) | `capacitor.config.ts` |
| Android project | `android/` (open in Android Studio) |
| iOS project | `ios/App/App.xcodeproj` (open in Xcode on a Mac) |
| Bridge between the site and the apps | `src/components/native/` |
| Push notifications (server) | `src/server/connect/push.ts`, `src/server/services/alert-push.ts` |
| Icon and splash source art | `mobile/assets/` (regenerate with `node mobile/scripts/native-assets.cjs public/icon.svg mobile/assets`, then `npx capacitor-assets generate --assetPath mobile/assets --iconBackgroundColor "#4a22cc" --splashBackgroundColor "#ffffff" --splashBackgroundColorDark "#0b1530"`) |
| Store text and privacy answers | `mobile/store/listing.md`, `mobile/store/privacy-answers.md` |
| Store screenshots and feature graphic | `mobile/store/screenshots/` (retake with `mobile/scripts/store-screenshots.cjs`) |
| Cloud builds | `.github/workflows/mobile-android.yml`, `.github/workflows/mobile-ios.yml` |

App ID / bundle ID: **`ng.refinerylens.app`**. It cannot change after the first store release; change it now in
`capacitor.config.ts`, `android/app/build.gradle` and the Xcode project if you want a different one.

## What you need first

1. **The website live on HTTPS** at its permanent address, with the production database, `SESSION_SECRET` and
   `APP_URL` set. Installing, push and app links all require HTTPS.
2. **Accounts:** a [Google Play developer account](https://play.google.com/console) (one-off US$25) and an
   [Apple Developer Program](https://developer.apple.com/programs/) membership (US$99 a year). Enrol as an
   organisation (needs a D-U-N-S number) so the store shows the company name.
3. **A Firebase project** (free) for Android push, and an **APNs key** for iPhone push.
4. **A Mac with Xcode**, or the GitHub Actions iOS workflow, to build the iPhone app.
5. **A support email**, set as `SUPPORT_EMAIL` on the site so the privacy and deletion pages show it.

## 1. Point the apps at your site

Set the production address wherever you build:

```bash
export CAP_SERVER_URL=https://app.yourdomain.ng
npx cap sync
```

If the domain is not `app.refinerylens.ng`, also replace that host in:

- `android/app/src/main/res/values/strings.xml` (`app_link_host`)
- `ios/App/App/App.entitlements` (`applinks:` entry)
- `ios/App/App/Info.plist` (`WKAppBoundDomains`)

## 2. Push notifications

**Android (Firebase Cloud Messaging)**

1. In the Firebase console, add an Android app with package `ng.refinerylens.app`.
2. Download `google-services.json`. For local builds put it at `android/app/google-services.json`; for GitHub Actions
   store it base64-encoded as the secret `GOOGLE_SERVICES_JSON_BASE64`. It is git-ignored.
3. Project settings → Service accounts → Generate new private key. Put the JSON (or its base64) in the site's
   environment as `FCM_SERVICE_ACCOUNT_JSON`.

**iPhone (Apple Push Notification service)**

1. In the Apple Developer account, Keys → create a key with *Apple Push Notifications service (APNs)*. Download the
   `.p8` file once.
2. Set on the site: `APNS_KEY_P8` (the file's contents; `\n` for line breaks is fine), `APNS_KEY_ID`, `APNS_TEAM_ID`,
   `APNS_BUNDLE_ID=ng.refinerylens.app`, and `APNS_PRODUCTION=true` for App Store and TestFlight builds (`false` only
   for apps run from Xcode).

The worker (`npm run worker`) sends trade hub alerts to every phone a user turned notifications on for, and deletes
tokens the push services report as gone. Administration shows whether each platform is configured.

## 3. App links

So that `https://<site>/hub/...` links open the app:

- **Android:** after the first upload, Play Console → *App integrity* shows the app signing key's SHA-256
  fingerprint. Set `ANDROID_CERT_SHA256` on the site (comma-separate several, e.g. upload and app signing keys).
  The site then serves `/.well-known/assetlinks.json`.
- **iPhone:** set `APPLE_TEAM_ID` on the site; it serves `/.well-known/apple-app-site-association`. Enable
  *Associated Domains* and *Push Notifications* for the App ID in the Apple Developer account.

## 4. Build Android

**In GitHub Actions:** add the secrets listed at the top of `.github/workflows/mobile-android.yml`
(`CAP_SERVER_URL`, `GOOGLE_SERVICES_JSON_BASE64`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), then Actions → *Mobile - Android build* → Run workflow. It produces a
debug APK (install it on a phone to try the app) and a signed `.aab` for Play.

Create the upload keystore once and keep it safe (losing it means asking Google to reset the upload key):

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks   # paste into ANDROID_KEYSTORE_BASE64
```

**On your computer:** install Android Studio, then `npx cap open android` and use *Build → Generate Signed Bundle*.

## 5. Build iPhone

**In GitHub Actions:** add `CAP_SERVER_URL`, `APPLE_TEAM_ID` and an App Store Connect API key (`ASC_KEY_ID`,
`ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`; Users and Access → Integrations → App Store Connect API, role *App Manager*),
then Actions → *Mobile - iOS build* → Run workflow. It builds, signs with automatic signing and uploads to TestFlight.
Without the key it only checks that the project compiles.

**On a Mac:** `npx cap open ios`, choose your team under *Signing & Capabilities*, then *Product → Archive →
Distribute App → App Store Connect*.

## 6. Store listings

1. **Google Play Console:** create the app, then fill *Store listing* from `mobile/store/listing.md`, *Data safety*
   from `mobile/store/privacy-answers.md`, *App content* (privacy policy URL `https://<site>/privacy`, account
   deletion URL `https://<site>/delete-account`, content rating questionnaire, target audience 18+, no ads), and
   *App access* with the reviewer account. New personal developer accounts must run a closed test with at least 12
   testers for 14 days before production; organisation accounts are exempt.
2. **App Store Connect:** create the app with bundle ID `ng.refinerylens.app`, fill the listing and *App Privacy*
   from the same files, add the review notes and reviewer account from `listing.md`, pick the TestFlight build and
   submit.
3. **Screenshots:** the files in `mobile/store/screenshots/` were taken from the demo data. Retake them from the
   production site once it has real listings:
   `BASE_URL=https://<site> STORE_SHOT_EMAIL=... STORE_SHOT_PASSWORD=... node mobile/scripts/store-screenshots.cjs mobile/store/screenshots public/icon.svg`.

## Store rules this app is built around

- **Not just a website:** Apple rejects apps that only wrap a site (guideline 4.2). The apps add push notifications,
  the native share sheet, the Android back button, native splash and status bar, an offline banner and app links.
- **No in-app purchases:** paid plans are bought with Paystack on the website only. Inside the apps the buy buttons are
  replaced with "Plans are managed on the RefineryLens website" and no price or link, because both stores require
  their own billing for digital purchases made in an app (Apple 3.1.1, Google Play Payments policy). If you later want
  to sell plans in the apps, they must use Apple In-App Purchase and Google Play Billing.
- **Gas orders are physical goods paid on delivery** (cash or transfer to the rider), which both stores allow outside
  their billing (Apple 3.1.3(e), Google Play Payments policy). The app never takes payment for an order.
- **Account deletion** in the app (Apple 5.1.1(v)) and a public deletion page (Google Play).
- **Privacy policy** at `/privacy`; notification permission is asked only when the user turns notifications on.
- **Private data stays off the phone:** cookies are excluded from Android backups, and sign-out removes the phone's
  push token.

## Releasing updates

- **Website changes** reach both apps immediately; no store review needed.
- **This release changes the start page** (`capacitor.config.ts` now opens `/?source=app`, which sends households and
  visitors to today's prices and business accounts to the trade hub), so ship new Android and iPhone builds with it.
- **Native changes** (new plugin, icon, permissions, `capacitor.config.ts`): run `npx cap sync`, raise the version
  (`version_name` input in the workflows; build numbers come from the run number) and submit new builds.
