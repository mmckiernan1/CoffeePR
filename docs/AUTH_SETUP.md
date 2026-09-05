# Coffee Payroll authentication setup

Coffee Payroll uses Supabase Auth for the pilot login layer. The app code supports:

- Google sign-in
- Microsoft sign-in through Azure / Microsoft Entra ID
- Apple sign-in
- Email + password sign-up and sign-in

The login UI lives at `/login`. Social OAuth callbacks return through `/auth/callback`, where the short-lived browser session is verified server-side before Coffee Payroll stores HttpOnly session cookies.

## Pilot Supabase project selected

The connected Supabase account already contains one healthy Canadian project, so Coffee Payroll will use it for the pilot rather than create a second paid project.

- Region: `ca-central-1`
- Project ref: `vwpkuawtkxuschxythth`
- API URL: `https://vwpkuawtkxuschxythth.supabase.co`

The real publishable key belongs in the deployment environment. It should not be committed to GitHub even though publishable keys are intended for application use.

## Why Supabase Auth for the pilot

It supports the four login methods Coffee Payroll needs without requiring us to build password storage or identity-provider plumbing ourselves. It also gives us a path to MFA and row-level authorization later as real client data is introduced.

## One-time hosted-project setup

1. Use the selected Supabase pilot project.
2. Set the application environment values `SUPABASE_URL` and `SUPABASE_ANON_KEY` on the eventual preview/production host.
3. Keep email/password enabled and require email confirmation before production payroll use.
4. In Supabase **Authentication → URL Configuration**, set the final Site URL once the hosted preview/domain is known.
5. Add these redirect URLs during the pilot:
   - `http://localhost:3000/auth/callback` for local testing
   - the hosted preview origin plus `/auth/callback`
   - `https://app.coffeepayroll.ca/auth/callback` once the final domain is connected
6. Configure the social providers in Supabase:
   - Google
   - Azure (Microsoft)
   - Apple
7. Each provider requires its own developer credentials for production. Supabase receives those credentials; Coffee Payroll does not store them in source code.

## Provider callback registered with Google / Microsoft / Apple

The OAuth provider itself should redirect back to Supabase, not directly to Coffee Payroll. For the selected hosted project, the provider callback is:

`https://vwpkuawtkxuschxythth.supabase.co/auth/v1/callback`

After Supabase completes OAuth, it redirects the browser to Coffee Payroll's allowed `/auth/callback` URL.

## Provider notes

### Google
Create an OAuth web client in Google Cloud and register the Supabase callback URL above. Then enable Google in Supabase and paste the Google client ID/secret there.

### Microsoft
Create an application in Microsoft Entra ID. Supabase labels this provider `Azure`; Coffee Payroll presents it to customers as `Microsoft`. Register the same Supabase callback URL as a Web redirect URI, then store the Entra client ID/secret in Supabase.

### Apple
A production Sign in with Apple setup requires an Apple Developer account, Services ID, key, Team ID and Key ID. Apple can be added after Google and Microsoft without blocking the first pilot.

## Current safety state

The login routes are present on the feature branch, but the existing app is not yet globally locked behind them. This is intentional: do not make the pilot inaccessible until email/password plus at least Google and Microsoft have been tested from the hosted preview.

After credentials and redirect URLs are configured and tested, the next auth gate should:

1. turn `COFFEE_PAYROLL_AUTH_REQUIRED=true` on the host;
2. send unauthenticated visitors to `/login`;
3. create/load the Coffee Payroll business workspace after first signup;
4. associate users to businesses through memberships/roles rather than shared credentials;
5. add MFA before production payroll data is accepted.

## Session design

- Passwords are handled by Supabase, not Coffee Payroll.
- Access and refresh tokens are stored as secure HttpOnly cookies by Coffee Payroll server routes.
- Social tokens returned to the browser are immediately posted to the server for verification and the URL fragment is cleared.
- The person/account identity is kept separate from the business workspace so one person can later manage more than one company or invite a bookkeeper/payroll helper.

## Release test

Before enabling the authentication gate, test two separate accounts end-to-end. Account A must never be able to load Account B's Coffee Payroll workspace, employees, UAT state or payment confirmations.
