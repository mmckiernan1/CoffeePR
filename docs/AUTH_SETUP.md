# Coffee Payroll authentication setup

Coffee Payroll uses Supabase Auth for the pilot login layer. The app code supports:

- Google sign-in
- Microsoft sign-in through Azure / Microsoft Entra ID
- Apple sign-in
- Email + password sign-up and sign-in

The login UI lives at `/login`. Social OAuth callbacks return through `/auth/callback`, where the short-lived browser session is verified server-side before Coffee Payroll stores HttpOnly session cookies.

## Why Supabase Auth for the pilot

It supports the four login methods Coffee Payroll needs without requiring us to build password storage or identity-provider plumbing ourselves. It also gives us a path to MFA and row-level authorization later as real client data is introduced.

## One-time Supabase setup

1. Create a Supabase project for Coffee Payroll.
2. Copy the project URL and publishable/anon key into your deployment environment as `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. In Supabase Authentication settings, keep email/password enabled and require email confirmation for production.
4. Add the Coffee Payroll production URL to the allowed redirect URLs. During local development also allow the local app URL.
5. Configure these social providers in Supabase:
   - Google
   - Azure (Microsoft)
   - Apple
6. Each provider requires its own developer credentials for production. Supabase receives those credentials; Coffee Payroll does not store them in source code.

## Provider notes

### Google
Create an OAuth web client in Google Cloud and use the callback URL Supabase provides.

### Microsoft
Create an application in Microsoft Entra ID. Supabase labels this provider `Azure`; Coffee Payroll presents it to customers as `Microsoft`.

### Apple
A production Sign in with Apple setup requires an Apple Developer account, Services ID, key, Team ID and Key ID.

## Current safety state

The new login routes are present on the feature branch, but the existing app is not yet globally locked behind them. This is intentional: we should not make the current pilot inaccessible until the Supabase project and at least email/password plus one social provider have been tested.

After credentials are configured and tested, the next auth commit should:

1. add app-wide route protection;
2. send unauthenticated visitors to `/login`;
3. create a Coffee Payroll business workspace after first signup;
4. associate users to businesses through memberships/roles rather than sharing credentials;
5. add MFA before production payroll data is accepted.

## Session design

- Passwords are handled by Supabase, not Coffee Payroll.
- Access and refresh tokens are stored as secure HttpOnly cookies by Coffee Payroll server routes.
- Social tokens returned to the browser are immediately posted to the server for verification and the URL fragment is cleared.
- The person/account identity is kept separate from the business workspace so one person can later manage more than one company or invite a bookkeeper/payroll helper.
