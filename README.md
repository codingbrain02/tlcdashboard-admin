# Tech Live Connect — Administration Workspace

The TLC administration app is the private workspace for managing employees and reviewing attendance. It serves Admin and Super Admin roles and shares Supabase Auth, Postgres, Realtime, and the `admin-api` Edge Function with the employee website. No second database is required.

## Projects and local layout

| Project | Production website | Source |
| --- | --- | --- |
| Administration | [tlcdashboard-admin.vercel.app](https://tlcdashboard-admin.vercel.app/) | [codingbrain02/tlcdashboard-admin](https://github.com/codingbrain02/tlcdashboard-admin) |
| Employee and shared backend | [tlcdashboard.vercel.app](https://tlcdashboard.vercel.app/) | [codingbrain02/tlcdashboard](https://github.com/codingbrain02/tlcdashboard) |

Permanent administration folder:

```text
C:\Users\DELL\Documents\Personal Docs\tlcdashboard\tlcdashboard-admin
```

This is an independent Git repository nested inside the employee checkout. Commit/push it separately; the parent ignores this folder. Schema migrations, the Supabase CLI guard, and Edge Function source belong to the [employee/backend repository](https://github.com/codingbrain02/tlcdashboard/blob/main/README.md), not this one.

Shared Supabase project: `fxldcjqqlhnbdrpapadu`.

## Sign-in and permissions

The configured Super Admin signs in with `codingbrain02@gmail.com`. Other admins use a unique username and password created by the Super Admin. Usernames are case-normalized, 3–32 letters/numbers/underscores, and must start with a letter. The backend maps them to internal Auth identifiers, so admins do not need personal email addresses for this login.

New admins must replace their temporary password before entering the workspace. Employee credentials do not grant administrator access. Role/session checks run in the browser, backend, and database; hiding controls is not the only authorization check.

| Capability | Admin | Super Admin |
| --- | --- | --- |
| View organization availability and attendance | Yes | Yes |
| Search/filter employees; view profiles/history | Yes | Yes |
| Create employee accounts | Yes | Yes |
| Terminate, reverse termination, rehire | With confirmation | With confirmation |
| Edit employee details, email, registration/employment dates | No | With review/confirmation |
| Correct attendance | No | With a reason and confirmation |
| Change own password | Yes | Yes |
| Set another Admin's or employee's password | No | Yes |
| View/create other administrators | No | Yes |
| View activity log | No | Yes |

Regular admins cannot read other administrator profiles/attendance or the owner's personal Auth details. The owner is represented as Super Administrator where applicable. Admin/Super Admin accounts have no personal avatars; employee-selected emojis remain visible in employee records.

## Workspace screens

### Overview

Overview shows organization-wide employee availability and paginated attendance. The employee directory lives in its own tab.

| Card | Definition |
| --- | --- |
| Active employees | Enabled, non-terminated employee accounts, excluding administrators |
| On duty | Active employees with an open shift, whether signed in or not |
| Off duty | Active employees without an open shift |

These count people across the organization, not records on the current table page. Active employees equals On duty plus Off duty. The database calculates all three in one snapshot through the service-only `admin_team_availability()` function. Authorized `list-attendance` responses include totals alongside paginated shifts.

The middle card retains its green on-duty indicator. Missing/invalid totals show dashes and retry controls, not misleading zeros. Attendance records remain available if only the summary fails.

The feed distinguishes open, completed, and terminated shifts. Times use the viewing device's local time zone. Account status Active means an enabled account, not necessarily an employee who is clocked in.

### Employees

The directory searches the entire employee dataset through the backend, not just the visible page. Combine these controls:

- Name or employee ID: case-insensitive name fragments, or a complete UUID for exact, case-insensitive ID matching. Partial UUIDs are not ID searches.
- Position: text search across position values.
- Status: all, active, inactive, or terminated.
- Sort: newest first, name ascending/descending, or position ascending/descending.

Typing automatically updates results after a 180 ms debounce; no search button is needed. Stale responses are ignored after filters change. Results use stable ordering and pages of 20.

View profile and attendance opens work/contact information, the stable employee UUID, dates, account status, and paginated attendance history. Returning to Employees keeps the directory's search/filter state. Regular admins cannot edit these details, but retain the confirmed employment actions below.

Super Admin edits show current and proposed values before confirmation. Attendance corrections require a reason. Server-side revisions reject stale reviews, and attendance validation rejects overlapping shifts/multiple open shifts. Employee IDs are not editable.

### Create employee

1. Enter the full name and an unused email.
2. Choose a categorized position. Common virtual-assistant roles are grouped by function; Technology includes Developer. Other / custom position accepts another title.
3. Choose a phone country and enter the required number. The calling code and international formatting are supplied by the input; basic syntax is checked, not ownership or SMS verification.
4. Select Create employee. The server creates Auth/profile records and records the managed creation action.
5. Copy/share the generated temporary password privately before hiding the sign-in-details panel or leaving the view. It is shown once and is not retrievable later.
6. The employee signs in on the employee website and must change the temporary password before opening attendance.

No invitation email is sent. Temporary credentials stay in a separate panel, never an auto-disappearing toast. Duplicate emails/incomplete setup return errors; do not assume a failed request created an account.

### Administrators — Super Admin only

View existing administrator accounts or create one with a unique username. The server generates a temporary password shown once; first-sign-in password setup is mandatory. This screen also offers direct password changes for other admins. Regular admins cannot inspect this directory, create admins, or grant themselves privileges.

### Activity log — Super Admin only

The log covers managed employee creation, termination, reversal, rehire, profile/email/attendance changes, and administrative password operations. Entries contain verified actor, target, server time, reason, and relevant before/after values. Records are paginated and refresh through live/focus updates.

Logs are append-only through the application. They never include passwords/tokens and are not a complete login or infrastructure-traffic log. Events predating logging are not reconstructed or assigned guessed actors.

## Termination, reversal, and rehire

Both roles use Employment status in the employee profile. Every action requires confirmation.

| Action | Required input | Result |
| --- | --- | --- |
| Terminate employee | Reason category; details for Other | Closes an open shift as Terminated, blocks access, synchronizes an Auth sign-in ban |
| Reverse termination | Explanation | Restores the same account and retains its employment start date |
| Rehire employee | New employment start date; optional details | Restores the same account with a new employment start date |

Reasons: Performance, Attendance, Misconduct, Policy violation, End of contract, Redundancy, or Other. There is no automatic reversal deadline; company policy must decide when reversal versus rehire is appropriate.

Prior attendance is kept. Restoration requires fresh sign-in; old sessions and terminated shifts remain closed. Rehire does not reset the password or create a new employee ID.

Database restrictions apply immediately, even before the browser receives its sign-out notification. Offline browsers receive updates after reconnecting; downloaded information cannot be remotely erased. Auth ban/unban failures show a persistent warning and Retry access synchronization. Retry the current status instead of repeatedly terminating/rehiring. Revisions and access generations protect against conflicting administrator actions.

## Passwords, email, and sessions

Change my password lives in the sidebar account area and opens a centered modal. All roles verify the current password and enter/confirm a different 12–128 character password. The current device stays signed in; other sessions are revoked. First-sign-in setup also continues into the workspace without logout.

Super Admin can set another Admin's or employee's password by entering it and selecting Save password. It applies immediately, without a confirmation dialog, Super Admin password prompt, or forced temporary-password step. All target sessions are revoked; the target must sign in again. Share the new password privately. A password change does not stop a shift or reactivate a terminated employee.

Employee email changes apply immediately without verifying the new inbox. Employees must re-enter their current password for self-service email edits; Super Admin email edits use a before/after confirmation. An Auth trigger synchronizes directory email. This intentional policy has recovery risks: a typo or someone else's address can disrupt future access/mail.

Sessions persist/refresh in browser storage. The admin client uses storage key `tlc-admin-auth`, separating it from the employee client on the same origin. Explicit sign-out, revocation, invalid sessions, storage clearing, or Auth settings may require sign-in again. Routine tab switching refreshes access/data without deliberately resetting an already verified workspace to a loading screen.

## Live updates and reliability

Screens subscribe to attendance, employee profile, administrator, or activity-log changes as needed. Overview refreshes its totals/feed when attendance or employee status changes; 250 ms debouncing coalesces bursts. Directory/profile views update contact details, status, and employee emojis.

Focus, reconnect, and periodic refresh recover missed notifications. The visible-page overview/directory fallback runs every minute while disconnected and every five minutes while connected. No fixed millisecond delivery time is guaranteed, and offline browsers cannot receive notifications.

Shifts are server records, not browser timers. Closing the site, signing out, or changing a password does not end a shift. Postgres enforces one open shift per employee; clock-out targets its exact ID. Different users operate through their own sessions, and concurrent edits are validated server-side. These protections do not replace load tests, hosting-limit reviews, or monitoring.

## Local development

Stack: React, TypeScript, Vite, Tailwind CSS, Supabase JS, and country-aware phone inputs. This workspace has been built with Node 24; Vite requires Node `^20.19.0 || >=22.12.0`.

Run from this administration folder:

```powershell
npm ci
npm run dev
```

Open Vite's printed URL. No second Supabase project/login is needed for the frontend.

`vite.config.ts` uses `envDir: '..'`. In the nested layout, public configuration comes from the employee folder's `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://fxldcjqqlhnbdrpapadu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
```

For a separately located clone, supply these in its parent environment file or process/build environment. An environment file only inside this folder is not the configured environment directory. Restart Vite after changes. Missing configuration disables sign-in rather than exposing protected screens.

Never put service-role/secret keys, access tokens, or database passwords in `VITE_` variables, frontend source, or commits.

## Source guide and design conventions

```text
src/
  AdminApp.tsx               Login, access checks, navigation, account creation
  Overview.tsx               Organization cards, attendance feed, directory filters
  EmployeeDetail.tsx         Employee details/editor and attendance history
  EmployeeActions.tsx        Employment actions and Super Admin email editor
  AttendanceEditor.tsx       Confirmed attendance corrections
  ActivityLog.tsx            Super Admin activity history
  PasswordSettings.tsx       Own-password modal
  PasswordReset.tsx          Super Admin direct password form
  ConfirmDialog.tsx          Confirmation/review dialogs
  positions.ts              Categorized employee positions
  EmojiAvatar.tsx            Employee-only emoji display
  supabase.ts                Browser client and persistent admin Auth settings
  SuccessToast.tsx           Root success popup
  successNotifications.ts    Success notification dispatcher
  global.css                Tailwind tokens and workspace component classes
vercel.json                 Production security/no-index headers
vite.config.ts              Plugins and parent environment directory
```

Keep Tailwind tokens and `workspace-*`, `button-*`, and `form-field` classes aligned with the employee repository. The interface uses system fonts, neutral surfaces, a slate navigation rail, indigo actions, and semantic status colors. Navigation collapses below 1024 px; keyboard skip links, visible focus, and reduced-motion support are included.

The logo returns to Overview and refreshes data without reloading the document. Appearance/password controls live in the sidebar account area. Routine successes use `showSuccessToast` and fade after approximately 1.2 seconds, including after a modal closes. Errors, access-sync warnings, and one-time credentials remain visible. Never put credentials in toast messages.

## Verification and deployment

Run before publishing:

```powershell
npm run lint
npm run build
git diff --check
```

Backend tests and release commands live in the [employee/backend guide](https://github.com/codingbrain02/tlcdashboard/blob/main/README.md#verification). This repository has no migration tree. A successful build does not prove hosted Auth, role policies, Realtime, or password revocation.

Use disposable accounts to check both roles: creation/onboarding, name/full-ID search and combined filters, profile/history access, regular-admin editing restrictions, live clock-in/out, terminate/reverse/rehire, own-password session survival, Super Admin target logout, failure/retry paths, narrow screens, and both themes. Attendance pagination must not change global availability totals.

Release order:

1. Review/apply pending migrations through the parent `supabase-project.ps1` and deploy `admin-api` with JWT verification enabled. Team cards require migration `202611030001_team_availability.sql` and its backend response first.
2. Test compatible frontends. Set the public URL/key in each Vercel project's build environment; local parent-folder files are not a cloud configuration mechanism.
3. Build with `npm run build`, output `dist/`. Confirm the intended folder/remote and obtain push approval, then push approved admin changes to this repository. Backend changes need a separate release from the employee repository.
4. Check production deployment and authenticated workflows. Git/Vercel frontend builds do not apply SQL migrations or deploy Edge Functions.

The app uses internal tabs rather than URL routes. `vercel.json` provides CSP, no-index, anti-framing, MIME, referrer, and permissions headers; Vite dev/preview do not emulate them. A custom Supabase domain requires updating CSP `connect-src` in both repositories.

Both sites intentionally exclude private workspaces from search indexing; public SEO belongs elsewhere. Maintain Auth rate limits, disabled public signups, minimum password requirements, RLS/session guards, server-only secrets, and operator monitoring/backup procedures. Do not assume CAPTCHA or MFA exists just because the interface is private.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Supabase not configured | Parent environment file or Vercel public variables; restart/rebuild |
| `email_provider_disabled` | Hosted email/password sign-in must remain enabled; public signup is a separate setting |
| Invalid admin credentials | Assigned username/configured owner email, latest password, temporary-password setup |
| Employee details/cards unavailable | Network, caller role/session, deployed function, pending parent migrations, retry controls |
| Totals show dashes | Unavailable/invalid response, not an empty team |
| Delayed live changes | Realtime connection/publication, network, focus/reconnect recovery, fallback refresh |
| Rehired employee cannot sign in | Latest credentials, enabled email login, fresh sign-in, pending access sync |
| Regular admin cannot edit details | Expected permission boundary; Super Admin makes those edits |
| CLI owner/project mismatch | Correct owner login and parent project guard; never bypass it or share tokens |

Never repair access by disabling RLS/JWT checks or editing Auth tables directly. Preserve audit/history when reverting UI changes, and reverse employment actions explicitly instead of overwriting newer production data with an old backup.
