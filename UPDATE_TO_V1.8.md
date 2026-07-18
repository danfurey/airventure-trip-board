# Update to v1.8

This release removes the blocking Firebase startup screen. The schedule renders immediately, while Firebase connects in the background. Existing shared selections appear from local cache first and are replaced by the current Firestore state when synchronization completes.

After replacing the project files:

```powershell
npm install
npm run dev
```

Push to GitHub to trigger the Vercel deployment:

```powershell
git add .
git commit -m "Speed up Firebase startup"
git push
```

After deployment, perform one hard refresh so the v1.8 service worker replaces the older cache.
