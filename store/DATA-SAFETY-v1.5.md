# Data safety notes: DRAFT for v1.5.0 (Nut & Bolt Sort)

Draft for John to review before filling in **Play Console → App content → Data safety**. The full form walkthrough is in `play-console-answers.md` §10. This page lists only what v1.5.0 changes. It is not legal advice; check it against Google's current form wording.

## What the app itself stores
- Game progress, coins, owned skins, daily-reward state, achievements and settings are kept **only on the device** (localStorage keys `nutboltsort.*`).
- The developer has no server, no account system, and no analytics SDK. Nothing above is sent to the developer.

## Third-party SDKs (unchanged from earlier versions)
- **Google Mobile Ads (AdMob)** with UMP consent: collects the advertising ID, approximate location from IP, app interactions and diagnostics for advertising, analytics and fraud prevention. Declare these as **collected and shared** (see §10 of `play-console-answers.md`).

## New in v1.5.0
| Feature | Data | Declare? |
|---|---|---|
| **In-app review** (Google Play In-App Review API, `@capacitor-community/in-app-review`) | Google Play shows its own rating sheet. The app never sees the rating or review text. Locally it stores only the time of the last prompt (`nutboltsort.review.v1`). | No new data types. |
| **Play Games cloud save** (scaffolding, **OFF**: `CLOUD_CONFIG.ENABLED = false`) | Not active in this build, so nothing is sent. | Nothing to declare now. |

## When cloud save is switched ON later (do this before releasing that build)
- The game-progress snapshot (progress, coins, owned cosmetics, achievements) is stored in the player's **Google Play Games Saved Games**, which is linked to their Google account.
- In the Data safety form, review **App activity → Other user-generated content / In-app actions**: data is *collected*, *not shared*, purpose **App functionality**, encrypted in transit (yes, via Google APIs).
- The user can delete it from Play Games settings. Also mention cloud save in `PRIVACY.md` / privacy.html.

## Other answers that stay the same
- Encrypted in transit: Yes (all SDK traffic is HTTPS).
- Users can request deletion: on-device data is removed by **Settings → Reset progress** or by uninstalling.
- Target audience: 13+. No data collected from children.
