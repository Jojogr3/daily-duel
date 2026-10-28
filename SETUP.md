# Daily Duel setup checklist

Everything that can be automated is automated. These are the steps that need you, because they involve your identity, payments, legal agreements or a phone in your hand. Do them roughly in this order; the slow ones are flagged.

> **Start these today — they take days to weeks:**
> - **D-U-N-S number** for World Runner Games, LLC (free, from Dun & Bradstreet). Apple *and* Google require it for organization developer accounts.
> - **Apple Developer Program** enrollment as an organization ($99/year) — needs the D-U-N-S number.
> - **Google Play Console** organization account ($25 once) — also needs the D-U-N-S number and identity verification.

---

## 1. Bootstrap the repo (2 minutes)

1. On GitHub, open **Actions → Bootstrap (run once) → Run workflow**.
2. It installs everything at versions matched to the Expo SDK, downloads the word list, runs the tests and commits the results.
3. After it finishes, the **CI** workflow should go green on every push.

## 2. Play it now — no accounts needed

The app runs on an offline backend (bot rivals, local leaderboard) until Firebase is connected.

On your computer (needs Node 22):

```bash
npm install
npm run app          # then scan the QR code with the Expo Go app on your phone
# or
npm run app:web      # plays in a browser
```

In the app, **Settings → Testing tools** lets you simulate Daily Duel+ and replay onboarding.

## 3. Firebase backend (≈30 minutes)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) (e.g. `daily-duel-prod`).
2. Upgrade to the **Blaze** (pay-as-you-go) plan — Cloud Functions require it. The free allowance covers early traffic; set a budget alert at $10.
3. **Build → Firestore Database → Create database** (production mode, `us-central1`).
4. **Build → Authentication → Sign-in method → Anonymous → Enable**.
5. **Project settings → Your apps → Add app → Web**. Copy the config values; you'll need `apiKey`, `authDomain`, `projectId`, `appId` in step 4.
6. Create a deploy key: Google Cloud Console → **IAM & Admin → Service accounts → Create**. Grant: *Editor*, *Cloud Functions Admin*, *Secret Manager Admin*, *Service Account User*, *Firebase Admin*. Then **Keys → Add key → JSON** and download it.
7. In GitHub → **Settings → Secrets and variables → Actions**:
   - Secret `FIREBASE_SERVICE_ACCOUNT` = the whole JSON file's contents.
   - Variable `FIREBASE_PROJECT_ID` = your project ID.
8. Run **Actions → Set backend secrets** (generates the secret puzzle salt), then **Actions → Deploy backend**.

From now on, every change to the backend deploys itself when it lands on `main`, and puzzles for the next 60 days are generated automatically every night.

## 4. Expo / EAS — cloud builds and instant updates (≈15 minutes)

1. Create an account at [expo.dev](https://expo.dev). Create an organization named after the LLC if you like.
2. On your computer: `cd apps/mobile && npx eas-cli@latest init` — this creates the EAS project and prints its ID.
3. **expo.dev → Account settings → Access tokens → Create**. Add it to GitHub as secret `EXPO_TOKEN`.
4. **expo.dev → your project → Environment variables**, for the `production` and `preview` environments, add:
   - `EAS_PROJECT_ID` (from step 2), `EXPO_OWNER` (your Expo account or org name)
   - `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`
   - The RevenueCat and AdMob values from steps 6–7 once you have them.

## 5. App Store Connect and Google Play Console (once accounts are approved)

**Apple** — [appstoreconnect.apple.com](https://appstoreconnect.apple.com):
1. Accept the **Paid Apps agreement**, add bank and tax info (required to sell subscriptions).
2. **Apps → + → New app**: name *Daily Duel*, bundle ID `com.worldrunnergames.dailyduel`.
3. **Subscriptions**: create group *Daily Duel+* with `plus_monthly` ($2.99) and `plus_annual` ($19.99), each with a 7-day free-trial introductory offer.
4. **Users and Access → Integrations → App Store Connect API → Generate key** (App Manager). Then `npx eas-cli credentials` in `apps/mobile` to store it, so builds can upload to TestFlight without you.

**Google** — [play.google.com/console](https://play.google.com/console):
1. Set up a **payments profile** (bank and tax).
2. **Create app** *Daily Duel*, package `com.worldrunnergames.dailyduel`.
3. **Monetize → Subscriptions**: same two products and free trial.
4. Create a Google Cloud service account for uploads per [Expo's guide](https://docs.expo.dev/submit/android/) and upload its key with `npx eas-cli credentials`.
5. Google requires the very first upload to be manual: run **Actions → Release app** (Android), download the `.aab` from expo.dev, and upload it once under *Internal testing*. After that, uploads are automatic.

## 6. RevenueCat — subscriptions (≈20 minutes)

1. Create a project at [revenuecat.com](https://www.revenuecat.com); add the iOS and Android apps (it walks you through store credentials).
2. **Entitlements** → create `plus`; attach both products on both platforms.
3. **Offerings** → `default` with the monthly and annual packages.
4. **API keys**: copy the public iOS and Android keys into EAS env vars `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`. Copy the secret API key into GitHub secret `REVENUECAT_API_KEY`.
5. **Integrations → Webhooks**: URL = your `revenuecatWebhook` function URL (Firebase console → Functions). Make up a long random string for the Authorization header and store the same value as GitHub secret `REVENUECAT_WEBHOOK_AUTH`.
6. Run **Actions → Set backend secrets** again.

## 7. AdMob — ads (≈20 minutes)

1. Create an account at [admob.google.com](https://admob.google.com) and add both apps.
2. Create three ad units per platform: **Banner**, **Interstitial**, **Rewarded**.
3. Put the IDs in EAS env vars (`ADMOB_IOS_APP_ID`, `ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_AD_*`). Until then, Google's test ads are shown.
4. **Privacy & messaging**: create a GDPR consent message (the app already shows it where required).
5. After you have a domain: publish `app-ads.txt` on it (AdMob gives you the line).

## 8. Domain, website and legal

1. Buy a domain (e.g. `dailyduel.app` if available — check first) and connect it in **Firebase → Hosting → Add custom domain**. The site, share-link page and policy pages deploy automatically from `web/public`.
2. Set `EXPO_PUBLIC_LINK_BASE`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL` in EAS env vars, and replace the store links in `web/public/*.html`.
3. Fill in the bracketed parts of `web/public/privacy.html` and `terms.html` and have a lawyer review them. Remove the "Draft" notices.
4. Search the USPTO and both app stores for "Daily Duel" before launch, in case the name is taken.

## 9. Release

- **Test builds:** Actions → **Release app** → profile `preview`. Install from the link on expo.dev.
- **Store builds:** Actions → **Release app** → profile `production`. iOS lands in TestFlight; Android in Internal testing as a draft. Promote to production in each console.
- **Quick fixes:** JavaScript-only changes go out with Actions → **Over-the-air update** → channel `production` — no store review.
- **Weekly report:** once Firebase is connected, a GitHub issue with players, retention and subscribers appears every Monday.

## Costs to expect

| Item | Cost |
| --- | --- |
| Apple Developer Program | $99 / year |
| Google Play Console | $25 once |
| Firebase (Blaze) | $0 at launch; grows with players |
| Expo EAS | Free tier (limited builds/month); Starter plan if you outgrow it |
| RevenueCat | Free until $2.5k monthly tracked revenue |
| Domain | ~$10–20 / year |
