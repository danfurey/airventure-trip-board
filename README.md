# AirVenture Trip Board

A mobile-first shared schedule for EAA AirVenture 2026. It converts fixed-time overlaps into decision points and lets the group make reversible selections and intentional conflict overrides.

## Version 2.2 — schedule-only decision flow

- Removes the separate Decisions tab and bottom navigation.
- Uses the Schedule timeline as the primary decision interface.
- Renames `Want it` to `Attend`.
- Selecting **Attend** immediately becomes the shared group choice and removes conflicting non-protected events from the timeline.
- Keeps existing conflict overrides active; grayed events in the full schedule can be restored with **Override & attend**.
- Grays conflicting events in the full schedule without disabling them.
- Keeps demonstrations, flexible displays, and air shows visible during conflicts.
- Places air shows in the featured lanes at the top of the timeline while retaining their blue Air Show color.
- Treats flexible displays and air shows as non-blocking windows, so attending them does not erase the rest of the day.
- Saves the Attend/Maybe/Skip decision and the active group choice in one atomic Firestore batch.

## Version 2.1 — Firebase connection visibility

- Shows the bundled schedule immediately instead of blocking on Firebase.
- Shows last-saved selections only as provisional data while Firebase connects.
- Enables Firestore persistent cache with multi-tab support when the browser supports it.
- Uses snapshot metadata to distinguish cache results from server-confirmed results.
- Does not let an empty cache-only snapshot erase previously saved selections.
- Treats the first server-backed snapshots for both collections as authoritative, including valid empty collections.
- Keeps editing locked until Firebase confirms the current shared state.
- Uses optimistic updates only after live synchronization is established.
- Shows clear `Connecting`, `Cached`, `Live sync`, `Saving`, `Offline`, and `Sync error` states.
- Restricts the service worker to same-origin app files so it cannot intercept Firebase requests.
- Retains the single shared board, dark theme, timeline, conflict filtering, demonstration exceptions, and overrides.


## Version 2.1 — Firebase connectivity fix

- Uses a direct Firestore server probe instead of waiting indefinitely for listener metadata.
- Uses deterministic anonymous sign-in through `authStateReady()` and `signInAnonymously()`.
- Forces Firestore long polling for compatibility with Firefox, antivirus software, VPNs, and buffering proxies.
- Uses memory cache; localStorage is only a provisional display until Firebase confirms the server state.
- Shows the current connection step, elapsed time, Firebase error code, and a manual Retry now control.
- Firebase remains authoritative and editing stays locked until server data is confirmed.

## Architecture

- **GitHub:** source code
- **Vercel:** website hosting and deployments
- **Firebase Authentication:** silent anonymous connection for browser security
- **Cloud Firestore:** one shared set of preferences and group selections

Vercel continues to host the app. Firebase stores only the shared board state.

## Firebase setup

1. Register a Firebase Web app.
2. Enable **Authentication → Anonymous**.
3. Create **Cloud Firestore**.
4. Paste and publish `firebase/firestore.rules`.
5. Add the Firebase web configuration to `.env.local` and Vercel.

Required variables:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_TRIP_ID=9f1153d5-e0cd-4a8f-8f28-f78da5a6d6e5
VITE_TRIP_NAME=AirVenture Weekend 2026
```

Do not put Firebase Admin credentials, service-account JSON, or private keys in `VITE_` variables.

## Shared data layout

```text
trips/{tripId}/votes/shared-board--{eventId}
trips/{tripId}/groupChoices/{eventId}
```

## Local development

```powershell
npm install
npm run dev
```

## Updating GitHub and Vercel

```powershell
git add .
git commit -m "Use schedule-only decision flow"
git push
```

Vercel redeploys automatically after the push.


## Version 2.3 — Schedule and map tabs

- Restores two navigation tabs: Schedule and Map.
- Embeds the official AirVenture visitor map directly in the app.
- Adds map zoom controls and a scrollable mobile map viewport.
- Removes the extra timeline and conflict instruction text requested for the schedule view.
