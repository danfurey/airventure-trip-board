# Update to v2.1 — Firebase connectivity fix

This release changes Firebase startup from passive listeners to an explicit two-step connection:

1. Restore or create the anonymous Firebase session.
2. Perform direct server reads for both shared collections, then keep realtime listeners active.

Additional changes:

- Uses Firestore memory cache because the app already keeps provisional local display data.
- Forces long polling to work around browsers, antivirus software, VPNs, and proxies that buffer Firestore streaming connections.
- Shows the exact connection step and elapsed time.
- Surfaces Firebase error codes for missing rules, missing Firestore, disabled anonymous auth, and network failures.
- Adds a Retry now button that restarts Firestore networking.
- Firebase remains the source of truth; editing stays locked until both server reads are confirmed.

No Firestore rule change is required.
