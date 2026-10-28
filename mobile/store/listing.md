# Store listing text

Copy these into Google Play Console and App Store Connect. Character limits are noted; every field below fits.

## Shared

- **App name:** RefineryLens (Google Play: up to 30 characters; App Store: up to 30)
- **Category:** Lifestyle on Google Play; on the App Store, Lifestyle with Business as secondary. Most people install it for prices and cooking gas; businesses find the trade hub inside.
- **Content rating:** Everyone / 4+. The app has user-to-user messaging between businesses and public, nameless station reports, which both questionnaires ask about; answer yes to user-generated content, with reporting, hiding by administrators and suspension available.
- **Support URL:** your site, e.g. `https://app.refinerylens.ng/`
- **Privacy policy URL:** `https://<your site>/privacy`
- **Account deletion URL (Google Play):** `https://<your site>/delete-account`

## Google Play

**Short description** (80 characters max)

> Fuel and cooking gas prices near you, gas refills to your door, CNG savings.

**Full description** (4,000 characters max)

> Know the price before you buy. RefineryLens shows what people paid for petrol, diesel, kerosene, cooking gas and CNG in your state today, at named filling stations and gas shops, and helps you never run out of cooking gas.
>
> TODAY'S PRICES NEAR YOU
> Petrol, diesel, kerosene, cooking gas per kg, 12.5 kg refills and CNG, for all 36 states and the FCT. Each figure is the median of what at least three different people paid in the last three days, so one wrong report cannot mislead you.
>
> STATIONS AND GAS SHOPS
> See who is selling now, how long the queue is, and the latest prices at each place. Report what you paid in seconds. Warn your neighbours about short measure or overcharging; repeated problems show on the station's page.
>
> NEVER RUN OUT OF COOKING GAS
> Log your refills and RefineryLens works out how long your cylinder lasts, then reminds you a few days before it runs out.
>
> GAS REFILLS TO YOUR DOOR
> Order from sellers RefineryLens has verified. The seller confirms the price, you follow the rider live on a map with an arrival time, and you pay in cash or by transfer when the gas arrives, or securely online.
>
> SEND GAS HOME FROM ABROAD
> Living in the UK, US, Canada or elsewhere? Order a full cylinder for your family in Nigeria, see the total in naira and US dollars, pay by card, and get an alert when it is delivered.
>
> SHOULD YOU CONVERT TO CNG?
> Put in how far you drive and today's prices to see your monthly saving on a car, bus or keke, and how fast a conversion pays for itself.
>
> FOR FUEL AND GAS BUSINESSES
> A trade hub for depots, marketers, refill plants, hauliers and refineries: state price medians, verified suppliers, a map of the gas network, delivery jobs with quotes, regular supply agreements, private business messages, home-delivery orders from households, and live GPS tracking of your drivers and trucks.
>
> RefineryLens is free for households; paying online adds a small service fee, which RefineryLens Plus removes. Prices are reports from the public and sellers, not promises from any seller. RefineryLens is not affiliated with NNPC, Dangote or any company listed.

**Graphics:** `mobile/store/screenshots/android-phone/*.png` (1080 × 1920), feature graphic `mobile/store/screenshots/feature-graphic-1024x500.png`, app icon `mobile/store/screenshots/app-icon-1024.png` (resize to 512 × 512 for the Play listing).

## App Store

**Subtitle** (30 characters max)

> Fuel & gas prices near you

**Promotional text** (170 characters max)

> Today's fuel and cooking gas prices in your state, reminders before your gas runs out, and refills from verified sellers. Send gas to family in Nigeria from abroad.

**Keywords** (100 characters max, comma separated)

> fuel price,petrol,cooking gas,LPG,refill,diesel,kerosene,CNG,filling station,Nigeria,Lagos,Abuja

**Description:** use the Google Play full description above.

**Screenshots:** `mobile/store/screenshots/ios-6.7/*.png` (1290 × 2796, the 6.7-inch iPhone size App Store Connect accepts for all iPhones).

## App Review notes (App Store) and app access (Google Play)

Both stores need a working sign-in to review the app. Create two reviewer accounts on the production site: a household account, and a business account with a profile (seller and buyer roles) and some listings. Then give:

> Sign in with: reviewer@<your domain> / <password>
>
> The app opens on Today's prices, which work without signing in. The tabs at the bottom are Today, Stations (report a price, queue or problem at a station), My gas (cylinder tracker and refill reminders), Order gas (refill from verified sellers, paid in cash or transfer to the rider on delivery: physical goods, so no in-app purchase) and CNG savings. The business trade hub is under "Business hub" for business accounts.
>
> Household reviewer account: reviewer-home@<your domain> / <password> (create it with "Me and my home" and a state with sellers).
>
> Location is requested only on the driver page (opened from a driver link a business sends), when the driver taps "Start sharing my location". To see it: sign in as the business reviewer, open Home gas orders, accept an order, create a driver link and open it. The customer then sees the driver on a live map on the order page.
>
> User-generated content (Guideline 1.2): every public station report has "Flag this report", and every station has "Something wrong with this place?". A report flagged by three different people is hidden until reviewed. Administrators review flags under Administration → Station reports, can hide or restore content, and can stop an account from reporting. Station reports are published without names, and business messages are private between the two businesses, with reporting and suspension on the trade hub.
>
> Push notifications are requested only when the user taps "Turn on notifications" under Account & plan.
>
> No digital goods are sold in the app. Paid plans exist only on the website and the app shows no prices or purchase links for them.
>
> Account deletion: Account & plan → Privacy and your data → Delete my account.
