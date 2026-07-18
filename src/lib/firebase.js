import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const hasSharedBackend = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
)

export const firebaseProjectId = firebaseConfig.projectId || ''

const app = hasSharedBackend
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const auth = app ? getAuth(app) : null

// The app already keeps a small provisional copy of the board in localStorage.
// Using Firestore's memory cache avoids an IndexedDB/multi-tab layer becoming
// another reason startup can stall. Forced long polling is deliberate here:
// this is a tiny private board, and reliability through Firefox, antivirus,
// corporate proxies, and Vercel is more important than streaming efficiency.
let firestore = null
if (app) {
  try {
    firestore = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
      experimentalLongPollingOptions: { timeoutSeconds: 10 },
      ignoreUndefinedProperties: true,
    })
  } catch (error) {
    // During Vite hot reload, the existing instance may already be initialized.
    // A full browser refresh applies the transport settings above.
    console.warn('Using the existing Firestore instance after hot reload.', error)
    firestore = getFirestore(app)
  }
}

export const db = firestore
