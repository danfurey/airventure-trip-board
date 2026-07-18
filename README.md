# AirVenture Trip Board

A mobile-first shared schedule for EAA AirVenture 2026. It converts fixed-time overlaps into decision points and lets the group make reversible selections and intentional conflict overrides.

## Version 1.8 — Fast startup

- Shows the bundled schedule immediately instead of blocking on Firebase.
- Restores the last synchronized choices from local browser storage while the live connection starts.
- Replaces cached choices with the current Firestore state as soon as it arrives.
- Keeps Firebase Authentication and Firestore synchronization in the background.
- Prevents edits during the brief authentication handshake.
- Restricts the service worker to same-origin app files so it cannot intercept Firebase requests.
- Uses cached app assets on repeat visits while refreshing them in the background.
- Retains the single shared board, dark theme, timeline, conflict filtering, demonstration exceptions, and overrides.

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
git commit -m "Use one shared trip board"
git push
```

Vercel redeploys automatically after the push.
