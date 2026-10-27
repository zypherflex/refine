# Privacy questionnaire answers

Answers for Google Play's **Data safety** form and the App Store's **App Privacy** labels, matching what the app does today and the public privacy policy (`/privacy`). Re-check them whenever a feature that collects data is added, and have someone accountable for compliance review them before submission.

## Google Play: Data safety

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS only).
**Do you provide a way for users to request that their data is deleted?** Yes: in the app (Account & plan → Delete my account) and at `/delete-account`.

| Data type | Collected | Shared | Optional? | Purposes |
| --- | --- | --- | --- | --- |
| Personal info: Name | Yes | No | Required | Account management, app functionality |
| Personal info: Email address | Yes | No | Required | Account management, app functionality |
| Personal info: Phone number | Yes | No | Optional (SMS or WhatsApp alerts) | App functionality |
| Personal info: Other info (business name, CAC number, licences) | Yes | No | Optional (trade hub) | App functionality, fraud prevention and security |
| Financial info: Purchase history | Yes, website purchases only | No | Optional | Account management |
| Messages: Other in-app messages | Yes | No | Optional | App functionality |
| Photos, videos, files: Files and docs | Yes (research uploads) | No | Optional | App functionality |
| App activity: Other user-generated content (listings, sites, prices, jobs, agreements) | Yes | No | Optional | App functionality |
| Device or other IDs (push notification token) | Yes | No | Optional | App functionality |

Not collected: location, contacts, calendar, photos from the camera, audio, health, web browsing, app interactions for analytics, crash logs through a third-party SDK, advertising ID.

"Shared" means transferred to a third party for its own use. Paystack, the SMS and WhatsApp providers, Dojah, Firebase/APNs and OpenStreetMap act as service providers processing data on RefineryLens's behalf, which Google's form does not count as sharing.

## App Store: App Privacy

**Do you or your third-party partners collect data from this app?** Yes.
**Is any data used to track users?** No. No data is used for tracking, and the app does not use the advertising identifier, so no App Tracking Transparency prompt is needed.

| Category | Data type | Linked to the user | Used for tracking | Purposes |
| --- | --- | --- | --- | --- |
| Contact Info | Name | Yes | No | App Functionality |
| Contact Info | Email Address | Yes | No | App Functionality |
| Contact Info | Phone Number | Yes | No | App Functionality |
| User Content | Emails or Text Messages (business-to-business messages) | Yes | No | App Functionality |
| User Content | Other User Content (listings, sites, prices, jobs, agreements, files) | Yes | No | App Functionality |
| Purchases | Purchase History (website plans) | Yes | No | App Functionality |
| Identifiers | User ID | Yes | No | App Functionality |
| Other Data | Business registration and licence details | Yes | No | App Functionality |
