# AirVenture Trip Board

A mobile-first shared schedule for EAA AirVenture 2026. It converts every fixed-time overlap into a **decision point**, lets each traveler vote on events, and allows the group to set a live choice during the trip.

## Version 1.5

- Removes the introductory “Live decision board” and “Complete trip schedule” banners.
- Uses a permanent dark color scheme across Decisions, Schedule, Group, dialogs, and the mobile timeline.
- Retains the v1.4 group-pick and override behavior.

## What is included

- Saturday and Sunday schedules from the provided screenshots
- Mobile decision board for every fixed-time overlap
- Individual **Want it / Maybe / Skip** votes
- Reversible event-level **group picks**, including intentional conflicting overrides
- Live updates across phones when Supabase is connected
- Color-coded, horizontally scrollable timeline inside the Schedule tab
- Conflict-intensity strip showing clear, overlapping, and heavily conflicted periods
- Timeline bars that react to Want it / Maybe / Skip votes and group picks
- Group picks automatically hide overlapping non-demonstration events from the timeline; demonstration events and selected overrides remain visible
- Flexible-window labels for long-running displays
- Installable PWA shell for easier phone access
- Local demo mode when no database is configured

Two screenshot entries had incomplete times and remain marked **TBD**:

- How One Little Rivet Changed My Life
- Mission Marge

## Deploy the visual demo immediately

1. Push this folder to a GitHub repository, or drag the folder/ZIP into Vercel Drop.
2. Import the project in Vercel.
3. Vercel detects Vite automatically. The build command is `npm run build`; the output directory is `dist`.
4. Deploy.

Without Supabase variables, the app works in **Device demo** mode. Votes are stored only in that browser.

## Enable shared live updates

### 1. Create the Supabase project

Create a Supabase project, then open **SQL Editor** and run:

`supabase/schema.sql`

If you already installed v1.3 or earlier, run this migration once instead:

`supabase/migrate-v1.4.sql`

### 2. Enable anonymous users

In Supabase Authentication settings, enable **Anonymous Sign-Ins**. Each phone receives an anonymous user ID without requiring email addresses or passwords.

### 3. Add Vercel environment variables

Copy `.env.example` values into **Vercel → Project Settings → Environment Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TRIP_ID`
- `VITE_TRIP_NAME`

Generate a new UUID for `VITE_TRIP_ID`. Keep it stable after sharing the app because it identifies this trip's data.

### 4. Redeploy

Redeploy the project. The header should show **Live sync**. Send the Vercel URL to the group. Each person enters a name once, then votes and group picks update on all phones.

## Security boundary

This is a low-risk private-trip MVP, not a hardened public product. Anonymous users can join if they possess the trip URL and embedded trip ID. Row Level Security prevents users from editing other people's individual votes, but any trip member can change the group pick. For a larger or public product, add email or passkey authentication and invitation records.

## Edit the schedule

The schedule is in:

`src/data/schedule.js`

Each event supports:

- `flexible: true` for a long drop-in window that should not generate hard decision points
- `anchor: true` for major fixed events such as the air shows
- `pending: true` when the time is not yet confirmed

## Local development

On Windows PowerShell:

```powershell
cd C:\path\to\the\project
npm install
npm run dev
```

Then open the local URL Vite displays, normally `http://localhost:5173`.

The included `package-lock.json` uses the public npm registry. If npm ever reports an inaccessible registry, run:

```powershell
npm config set registry https://registry.npmjs.org/
Remove-Item package-lock.json
npm install
```

Production check:

```bash
npm run build
npm run preview
```

## Group-pick and override behavior (v1.4)

Group picks are reversible and stored by event. Selecting an event grays out conflicting non-demonstration choices in the Decisions tab, but does not disable them. Choosing **Add override** keeps both conflicting group picks active. Both picks remain visible in the Schedule timeline and are marked **OVR**. Unselected conflicting events remain hidden from the timeline, demonstrations remain visible, and **Restore all** clears the current day's selections.

Existing Supabase installations must run `supabase/migrate-v1.4.sql` once so the database can store more than one selected event within the same decision period.
