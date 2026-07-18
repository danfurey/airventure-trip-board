# Update to v1.7

This version uses one shared board.

- No display-name field
- No Join button
- No visible accounts or profiles
- No Group tab
- Everyone sees and edits the same preferences and group picks
- Anonymous Firebase Authentication remains enabled silently only to secure Firestore access

After copying these files over the existing project:

```powershell
npm install
npm run dev
```

Then publish the revised rules from `firebase/firestore.rules` in Firebase Console → Firestore Database → Rules.

Push to GitHub:

```powershell
git add .
git commit -m "Use one shared trip board"
git push
```
