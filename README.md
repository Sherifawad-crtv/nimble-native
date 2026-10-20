# Nimble (native)

React Native / Expo port of [Nimble](https://nimble-coaching.vercel.app), the coaching app.
Same backend (Supabase) as the web app; this repo rebuilds the UI with native primitives
(expo-router, react-native-svg, AsyncStorage) for a real App Store / Play Store / TestFlight
build, while the web app at `Sherifawad-crtv/nimble` keeps running unchanged.

Shared, untouched-in-spirit layers ported straight across: `src/types`, `src/services`,
`src/i18n`, `src/lib` (stats, chart, date, workout math), `src/timer` (the timer engine).
Everything that touched the DOM was rebuilt: the whole `src/ui` kit, every screen, navigation
(expo-router instead of react-router), storage (AsyncStorage instead of localStorage), and
push (Expo push service instead of Web Push, see below).

## Getting started

```sh
npm install
cp .env.example .env          # fill in the real Supabase project + legal URLs
npm start                     # expo start — scan the QR with Expo Go, or press i/a
```

- `npm run ios` / `npm run android` — run on a simulator/device (needs Xcode / Android SDK).
- `npm run typecheck` — `tsc --noEmit`.
- `npm test` — `vitest run` (the platform-agnostic logic: stats, chart math, timer engine).

## Structure

- `app/` — expo-router routes. `(client)` and `(coach)` are tab groups; `workout/`, `timer/`,
  `client/`, `review/`, `builder/`, `program/` are stack pushes from either.
- `src/ui/` — the design system (`Button`, `Card`, `Screen`, `Sheet`, icons, theme tokens, …),
  the native equivalent of the web app's `src/design`.
- `src/components/`, `src/screens/` — feature components and screens, one-to-one with the
  web app's folders of the same names.
- `src/services/`, `src/types/`, `src/i18n/`, `src/lib/`, `src/timer/` — ported unchanged
  (or near enough) from the web app; this is where the actual app logic lives.
- `supabase/functions/` — two edge functions for this app's needs (`delete-account`,
  and a `send-push` that also delivers to native devices). **Not deployed** — see
  `docs/STORE_READINESS.md` before deploying anything to the shared backend.
- `docs/` — `STORE_READINESS.md` (what's left before submitting to either store) and
  `legal/` (drafted privacy policy + terms, not yet hosted anywhere).

## Push notifications

The web app uses Web Push; this app uses Expo's push service. Both write to the same
`push_subscriptions` table, told apart by `p256dh`: a real key for web devices, the literal
string `'expo'` for native ones (with `endpoint` holding the Expo push token and `auth`
holding the platform). The `send-push` edge function in this repo sends to both kinds; see
`docs/STORE_READINESS.md` for how to deploy it.

## What's not done yet

See `docs/STORE_READINESS.md` for the full list — bundle identifiers, EAS project id,
developer accounts, store listings, hosting the legal pages, and a real device/simulator
run (this port has been typechecked and unit-tested, not yet launched).
