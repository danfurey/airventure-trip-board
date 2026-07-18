# Update to v2.0

This release makes Firebase connection attempts visible and accurate.

- `Offline` now means the browser actually reports no network connection.
- A slow Firebase connection shows `Still connecting` with elapsed seconds.
- After a previously live connection drops, the badge shows `Reconnecting`.
- The status notice explicitly says Firebase listeners are active and continuing to retry.
- Firebase remains the source of truth; editing stays locked until both Firestore collections receive server-confirmed snapshots.

No Firestore rule changes are required. Keep the existing `.env.local`.
