# Firebase setup checklist

Vercel still hosts the website. Firebase only stores and synchronizes the group's names, votes, and selections.

## In Firebase

1. Open your Firebase project.
2. Add a **Web app** if the project does not already have one.
3. Open **Authentication → Sign-in method** and enable **Anonymous**.
4. Open **Firestore Database** and create the database.
5. Open the Firestore **Rules** tab, paste the contents of `firebase/firestore.rules`, and publish.
6. Open **Project settings → Your apps → SDK setup and configuration → Config**.

## In Vercel

Add these environment variables using the matching values from the Firebase config object:

```text
VITE_FIREBASE_API_KEY              = apiKey
VITE_FIREBASE_AUTH_DOMAIN          = authDomain
VITE_FIREBASE_PROJECT_ID           = projectId
VITE_FIREBASE_STORAGE_BUCKET       = storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID  = messagingSenderId
VITE_FIREBASE_APP_ID               = appId
VITE_TRIP_ID                       = 9f1153d5-e0cd-4a8f-8f28-f78da5a6d6e5
VITE_TRIP_NAME                     = AirVenture Weekend 2026
```

Redeploy after saving the variables. The app should show **Live sync** instead of **Device demo**.

Do not place a service-account JSON file, private key, or Firebase Admin credential in Vercel's `VITE_` variables.
