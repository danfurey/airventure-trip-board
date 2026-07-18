# Firebase setup checklist

Vercel hosts the website. Firebase stores and synchronizes one shared board. There are no display names, user profiles, or join screen.

## In Firebase

1. Open the Firebase project.
2. Register a **Web app**.
3. Open **Authentication → Sign-in method** and enable **Anonymous**. This runs silently in the browser and does not create visible accounts in the app.
4. Open **Firestore Database** and create the database.
5. Open the Firestore **Rules** tab, paste the contents of `firebase/firestore.rules`, and publish.
6. Open **Project settings → Your apps → SDK setup and configuration → Config**.

## Local `.env.local` and Vercel

Add these environment variables using the matching values from the Firebase config object:

```text
VITE_FIREBASE_API_KEY=Firebase apiKey
VITE_FIREBASE_AUTH_DOMAIN=Firebase authDomain
VITE_FIREBASE_PROJECT_ID=Firebase projectId
VITE_FIREBASE_STORAGE_BUCKET=Firebase storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=Firebase messagingSenderId
VITE_FIREBASE_APP_ID=Firebase appId
VITE_TRIP_ID=9f1153d5-e0cd-4a8f-8f28-f78da5a6d6e5
VITE_TRIP_NAME=AirVenture Weekend 2026
```

Redeploy after saving the Vercel variables. The app should show **Live sync**.
