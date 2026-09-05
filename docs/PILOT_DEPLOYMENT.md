# Coffee Payroll pilot deployment guide

## Recommended pilot stack

Coffee Payroll already uses the Cloudflare Vite plugin and a D1 binding named `DB`, so the lowest-friction pilot deployment is:

- **Application hosting:** Cloudflare
- **Database:** Cloudflare D1
- **Authentication:** Supabase Auth
- **Domain:** `coffeepayroll.ca` if registered/available, with `app.coffeepayroll.ca` for the payroll application
- **Customer billing:** PayPal Business for the pilot
- **Employee payments:** business e-transfer checklist only; EFT/bank-file functionality remains hidden during pilot UAT

GETUS can still be used as the domain registrar or DNS/communications provider if desired. The application itself should stay on the platform that already matches the code and D1 binding unless we deliberately re-platform later.

## Before putting the pilot online

### 1. Supabase

Create one Supabase project for the Coffee Payroll pilot.

Configure:
- Email/password authentication
- Google OAuth
- Microsoft/Azure OAuth
- Apple OAuth when the Apple developer credentials are available

Add the production site/callback URLs after the live host name is known.

Set these application environment variables on the host:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
COFFEE_PAYROLL_AUTH_REQUIRED=true
```

Never commit the real values to GitHub.

### 2. Cloudflare D1

Create or select the production/pilot D1 database and bind it to the application as:

```text
DB
```

The code already expects that binding.

Apply every repository migration in order, including the pilot workspace/UAT migration added on the feature branch. Do this first against a pilot database, not a database holding live payroll records.

### 3. Deploy the feature branch to a preview environment

Deploy `chat/run-payroll-shell` before merging to `main`.

Validate these routes in the hosted preview:

- `/login`
- `/onboarding`
- `/uat`
- `/guided-payroll`
- `/uat/review`
- `/uat/payments`
- `/uat/complete`

Use fictional employee information only.

### 4. Domain

Preferred layout:

```text
coffeepayroll.ca       marketing / welcome site
app.coffeepayroll.ca   secure payroll application
```

For the first pilot it is acceptable for both to point to the same application, with the root page acting as the landing page. They can be separated later.

### 5. Authentication gate

Only set `COFFEE_PAYROLL_AUTH_REQUIRED=true` after:

1. email/password sign-in works,
2. at least Google and Microsoft sign-in have been tested,
3. the callback URL returns to Coffee Payroll correctly,
4. sign-out clears the session,
5. two separate test accounts cannot see one another's business workspace.

### 6. Pilot UAT

Run the complete owner journey:

```text
Create account
→ Create business
→ Add hire / make change
→ Enter timesheets
→ Mark time ready
→ Review payroll
→ Approve payroll
→ Send business e-transfers
→ Record confirmation references
→ Mark every employee paid
→ You did your payroll
```

Refresh and navigate away during the test to confirm that workspace state survives normally.

## Production gates before real payroll

The pilot snapshot persistence is suitable for UAT, but live payroll should not begin until:

- pilot snapshots are replaced with the durable employee, effective-dated compensation, time-entry, pay-run and payment tables;
- approved payroll snapshots are immutable;
- changes and approvals write audit events;
- privacy/terms/data-retention material is published;
- backup/recovery procedures are tested;
- authorization isolation is tested with multiple businesses;
- statutory rules are validated for every province offered to customers;
- CI, build, lint and core tests pass;
- mobile and desktop UAT are complete.

## Pilot release sequence

1. Keep PR #1 in draft while CI and hosted preview are being verified.
2. Create Supabase project and host environment variables.
3. Create/bind D1 pilot database and apply migrations.
4. Deploy feature branch preview.
5. Complete two-account security UAT and the full payroll journey.
6. Resolve any visual/mobile issues.
7. Merge to `main` only after the pilot passes.
8. Connect the final Coffee Payroll domain.
9. Invite the first pilot business using fictional or parallel-test data before any live processing.
