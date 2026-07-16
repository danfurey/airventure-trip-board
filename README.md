# AirVenture Trip Board

A mobile-first shared schedule for EAA AirVenture 2026. It converts fixed-time overlaps into decision points, lets each traveler vote, and allows the group to make reversible selections and intentional conflict overrides.

## Version 1.6 — Firebase

- Replaces Supabase with Firebase Authentication and Cloud Firestore.
- Uses anonymous Firebase accounts so friends do not need passwords.
- Synchronizes names, votes, group selections, clears, and overrides across phones in real time.
- Retains local-device demo mode when Firebase is not configured.
- Retains the dark theme, visual timeline, conflict filtering, demonstration exceptions, and override behavior from v1.5.

## Architecture

- **GitHub:** source code
- **Vercel:** website hosting and deployments
- **Firebase Authentication:** anonymous identity for each phone
- **Cloud Firestore:** shared group data and realtime updates

Vercel continues to host the app. Firebase is used only for authentication and shared data.

## Deploy the visual demo immediately

1. Push this folder to GitHub.
2. Import the repository into Vercel.
3. Use the Vite preset, `npm run build`, and output directory `dist`.
4. Deploy.

Without Firebase variables, the app runs in **Device demo** mode. Each browser stores its own votes and selections.

## Enable shared Firebase updates

### 1. Create or select a Firebase project

Open the Firebase console and select the project you want to use. Add a **Web app** to the project. Firebase displays a configuration object containing values such as `apiKey`, `authDomain`, `projectId`, and `appId`.

### 2. Enable Anonymous Authentication

In **Firebase Console → Authentication → Sign-in method**, enable **Anonymous**. Each phone then receives its own persistent anonymous user ID without requiring an email address or password.

### 3. Create Cloud Firestore

In **Firebase Console → Firestore Database**, create the database. For production, select the region nearest the group and do not leave the database in unrestricted test mode.

Open the **Rules** tab and replace the rules with the contents of:

`firebase/firestore.rules`

Then publish the rules.

### 4. Add Vercel environment variables

In the Firebase project settings, find **Your apps → SDK setup and configuration → Config**. Copy the matching values into Vercel:

- `VITE_FIREBASE_API_KEY` ← `apiKey`
- `VITE_FIREBASE_AUTH_DOMAIN` ← `authDomain`
- `VITE_FIREBASE_PROJECT_ID` ← `projectId`
- `VITE_FIREBASE_STORAGE_BUCKET` ← `storageBucket`
- `VITE_FIREBASE_MESSAGING_SENDER_ID` ← `messagingSenderId`
- `VITE_FIREBASE_APP_ID` ← `appId`
- `VITE_TRIP_ID` ← keep `9f1153d5-e0cd-4a8f-8f28-f78da5a6d6e5`, or use another stable UUID
- `VITE_TRIP_NAME` ← `AirVenture Weekend 2026`

The Firebase web configuration identifies the Firebase project; it is not an administrative secret. Security is enforced by Firebase Authentication and Firestore rules. Never put a Firebase Admin private key or service-account JSON in `VITE_` variables.

### 5. Redeploy

Redeploy the Vercel project after adding the variables. The app header should show **Live sync**. Send the Vercel URL to the group.

## Firestore data layout

The app creates these collections automatically after the first person joins:

```text
trips/{tripId}/members/{firebaseUserId}
trips/{tripId}/votes/{firebaseUserId}--{eventId}
trips/{tripId}/groupChoices/{eventId}
```

There is no Supabase-to-Firebase migration included. If the Supabase version was not used by the group yet, no migration is needed.

## Security boundary

This is a private-trip MVP. Anyone with the public trip URL can anonymously join the board. Firestore rules prevent users from editing another person's name or vote, while any authenticated participant can set or clear group choices. For broader public use, add invitations and stronger sign-in.

## Local development

```powershell
cd C:\path\to\the\project
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`. To test shared mode locally, copy `.env.example` to `.env.local` and enter your Firebase web configuration.

Production check:

```powershell
npm run build
npm run preview
```

## Updating GitHub and Vercel

```powershell
git add .
git commit -m "Replace Supabase with Firebase"
git push
```

Vercel automatically redeploys the connected repository after the push.

## Schedule source

Edit events in `src/data/schedule.js`.
