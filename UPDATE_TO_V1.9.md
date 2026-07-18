# Update to v1.9 — Firebase-authoritative fast start

This version keeps the schedule fast without making local storage a competing source of truth.

## Behavior

- The static schedule renders immediately.
- Last-saved choices may appear provisionally while Firebase connects.
- Firestore listeners include metadata updates and distinguish cache snapshots from server snapshots.
- An empty cache-only snapshot does not erase provisional choices.
- The first server-backed snapshots for both `votes` and `groupChoices` replace the provisional state, including valid empty collections.
- Editing remains locked until both Firebase collections have been confirmed by the server.
- After live sync, choices update optimistically and Firestore remains authoritative.
- Firestore IndexedDB persistence is enabled with multi-tab support when the browser supports it.
- Statuses are `Connecting`, `Cached`, `Live sync`, `Saving`, `Offline`, and `Sync error`.

## Install

Replace the project files while retaining `.env.local`, then run:

```powershell
npm install
npm run dev
```

After testing:

```powershell
git add .
git commit -m "Make Firebase authoritative without blocking startup"
git push
```

After Vercel deploys, hard-refresh once to replace the old service worker.
