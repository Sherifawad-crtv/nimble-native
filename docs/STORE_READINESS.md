# Store readiness checklist

This repo is a from-scratch React Native (Expo) port of the Nimble web app, sharing its
logic (types, services, i18n, stats, timer engine) and rebuilding the UI with native
primitives. It is not deployed anywhere yet. This checklist is what's left before it can
go to TestFlight / App Store Connect / Google Play.

## Not yet done by this port (needs a human)

These need accounts, credentials, or decisions only you can make:

- [ ] **Bundle identifiers.** `app.json` uses placeholder `app.nimble.coaching` for both
      `ios.bundleIdentifier` and `android.package`. Change both to the identifier you'll
      register (they must match your Apple/Google developer accounts).
- [ ] **EAS project.** `app.json` → `extra.eas.projectId` is `REPLACE_WITH_EAS_PROJECT_ID`.
      Run `eas init` (after `npm i -g eas-cli` and `eas login`) to create the project and
      fill this in, or let `eas build` prompt you the first time.
- [ ] **Apple Developer Program account** ($99/yr) and **Google Play Console account**
      ($25 one-time). Required to submit to either store.
- [ ] **App Store Connect listing**: name, subtitle, description, keywords, category,
      age rating (the content is fitness coaching — expect 4+), support URL, marketing URL,
      screenshots per device size, app privacy "nutrition label" (see below).
- [ ] **Google Play listing**: short/long description, category, content rating
      questionnaire, Data Safety form (see below), screenshots, feature graphic.
- [ ] **Push credentials**: `eas build` will generate APNs keys and FCM/Expo push
      credentials for you on first build — just follow the prompts, don't do this by hand.
- [ ] **Hosting for the legal pages.** `docs/legal/privacy.md` and `docs/legal/terms.md`
      are drafted but not hosted anywhere. Publish them at real URLs (e.g. as
      `/privacy` and `/terms` pages on the existing web app, or any static host) and set
      `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL` to those URLs before building.
      Both stores require a working privacy policy URL to submit.
- [ ] **Support contact.** Set `EXPO_PUBLIC_SUPPORT_EMAIL`, and fill in the `[fill in...]`
      placeholders in the legal docs.
- [ ] **Review demo accounts.** Both stores' reviewers need a way in. Either enable sign-up
      with no invite friction for a seeded demo coach + client, or give the reviewer
      credentials for a real account in the review notes field.
- [ ] **Backend changes** (see below) must be deployed to the *same* Supabase project the
      web app uses, since this app and the web app share one backend. Do this deliberately,
      with the web app's maintainer's sign-off — it's shared infrastructure.

## Backend changes this port needs (written, not deployed)

Two edge functions are added/changed here under `supabase/functions/`. They are **not**
deployed — deploying them affects the shared backend the web app also uses, so that should
be a deliberate step, not something done silently as part of this port:

- **`delete-account`** (new): lets a signed-in user delete their own account. A coach's
  deletion also deletes every client in their workspace, since the workspace can't exist
  without its coach. Required by both App Store and Play Store policy (an app that creates
  accounts must let someone delete theirs from inside the app).
- **`send-push`** (modified): now delivers to native devices (Expo push tokens, stored with
  `p256dh = 'expo'`) via Expo's push API, alongside the existing web-push devices. The web
  app's own push subscriptions are untouched and keep working exactly as before.

To deploy: copy both functions' folders over the ones in the web app's `supabase/functions/`
directory (they're drop-in replacements/additions) and run
`supabase functions deploy delete-account send-push` against the shared project, or use the
Supabase MCP tooling. Do this only when you're ready — the native app's delete-account
screen and push registration will simply fail gracefully (a toast error) until it's live.

## Compliance already in place in the app

- **Account deletion**: Settings → Account → Delete Account, with a confirm dialog
  (`src/components/AccountSettings.tsx`). Calls the `delete-account` function above.
- **Privacy/terms links**: shown in Settings (`src/lib/links.ts`, `AccountSettings.tsx`).
- **AI disclosure**: the in-app coach assistant is named and described in `assistant.*`
  strings, and nothing it proposes is saved without the coach confirming.
- **No non-exempt encryption**: `ios.config.usesNonExemptEncryption: false` set, which skips
  App Store Connect's export-compliance question on each build.
- **iOS privacy manifest**: `ios.privacyManifests` declares the few "required reason" APIs
  Expo's own modules touch (UserDefaults, file timestamps, boot time, disk space) — required
  since 2024 for any app using those APIs transitively through a dependency.
- **Android permissions**: only `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK` (push + the
  rest-timer screen staying awake); `blockedPermissions` turns off everything RN/Expo's
  default modules would otherwise request but this app doesn't use.
- **Background modes**: `remote-notification` only, for push delivery.

## App privacy / Data Safety answers (for the store listings)

Based on what's actually collected (see `docs/legal/privacy.md`):

| Data type | Collected? | Linked to identity? | Purpose |
|---|---|---|---|
| Name, email | Yes | Yes | Account creation, coach/client identification |
| User content (workouts, results, comments) | Yes | Yes | App functionality |
| Device ID / push token | Yes | Yes | Push notifications |
| Crash data | Yes | No | App functionality (diagnostics) |
| Precise/coarse location | No | — | — |
| Contacts, photos, browsing history | No | — | — |
| Payment info | No | — | — |

No data is shared with third parties for advertising. Supabase (hosting) and Resend
(transactional email) are processors, not data recipients for marketing purposes.

## Before building

- [ ] `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set to the real
      (shared) Supabase project — same one the web app uses.
- [ ] `EXPO_PUBLIC_WEB_URL` set (used for anything that still needs to deep-link to the web
      app, if applicable).
- [ ] `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL` set to
      real, live values (see above).
- [ ] `npx tsc --noEmit` and `npx vitest run` both pass (they do, as of this port).
- [ ] A real device or simulator run — this port has only been typechecked and
      Metro-bundled, never launched on an actual iOS/Android runtime. Run
      `npx expo run:ios` / `npx expo run:android` (needs a Mac for iOS) or
      `eas build --profile development` before trusting it further.

## Build & submit (once the above is done)

```sh
npm i -g eas-cli
eas login
eas init                      # creates the EAS project, fills in app.json's projectId
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

`eas.json` already has `development` / `preview` / `production` profiles configured.
