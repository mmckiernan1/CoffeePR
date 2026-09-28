# Isolated Juniper Trail Coffee Co. mobile UAT

The `chat/run-payroll-shell` branch builds a separate Worker named
`coffee-payroll-fictional-uat`. It has no D1 binding and never runs migrations.
The Worker returns 404 for application/API routes outside the fictional UAT
journey. Payroll progress and payment confirmations remain in the iPhone's
browser storage; use fictional references only. Clearing Safari website data
will erase this test run.

## Prepare the bundle

```sh
npm ci
npm run build:fictional-uat
```

The generated `dist/server/wrangler.json` has `workers_dev: false`,
`preview_urls: false`, no routes, no D1 binding, and Worker-first assets.
Do not substitute the production `coffee-payroll` Worker or its D1 database.

## Protected publication

1. Authenticate to the existing Coffee Payroll Cloudflare account.
2. Deploy the isolated Worker using
   `npx wrangler deploy --config dist/server/wrangler.json`. At this stage it
   has no public endpoint.
3. In Zero Trust > Access > Applications, protect the **entire isolated
   Worker** with an Allow policy for Martin's verified email and One-time PIN.
   Check that production and preview URLs are both covered by that policy.
4. Only after the policy is active, enable its `workers.dev` route in the
   Cloudflare dashboard and update `workers_dev` in the generated config to
   `true` before any future redeploy. Verify a signed-out private Safari tab
   receives the Access sign-in screen before any application content or assets.
5. Sign in on the iPhone and open `/uat/fictional`. Tap **Load fictional test**,
   then **Start Run Payroll**. The scenario is device-local by design.

Keep `workers_dev: false` if Access has not been confirmed. Never apply
`drizzle/0013`–`0015` as part of this preview. Never merge this branch to
`main` to publish the preview.


## iPhone test script

Run the scenario as the owner of Juniper Trail Coffee Co. Do not try to diagnose
problems while testing; note what you expected, what happened, and whether you
knew what to do next.

### Start

- Open `/uat/fictional`.
- Confirm the page feels like Coffee Payroll: warm coffee-shop surfaces,
  espresso branding, cobalt primary actions and green success states.
- Tap **Load fictional test**, then **Start Run Payroll**.
- Pass: the next action is obvious without zooming or horizontal scrolling.

### Changes

Expected attention items:

- **Noah Williams** — hourly rate changed during the pay period.
- **Liam Martin** — leaving employee/final pay.
- **Avery Chen** and **Priya Singh** — no special change.

Pass: exactly the employees needing attention stand out and the wording explains
why without payroll jargon.

### Employees

Expected population: **4 employees**.

- Avery Chen — salary
- Noah Williams — hourly
- Priya Singh — salary
- Liam Martin — hourly/leaving

Pass: all four are visible and tappable. Salary employees show their carried
forward pay and **No time entry required** where appropriate.

### Hours & pay

Expected:

- Avery and Priya require no time entry.
- Noah has 80 regular hours and 2.5 overtime hours, with the mid-period rate
  change split correctly.
- Liam has 64 regular hours plus the fictional final-pay items.
- **Yes, hours are complete** should save and continue without requiring a
  second confirmation click.

Pass: the iPhone page does not require side-to-side scrolling and it is obvious
which employees require action.

### Review

Pass:

- all four employees are represented;
- employee gross, deductions and net pay are understandable;
- Noah's split-rate calculation is explainable;
- Liam's final pay is visible;
- on iPhone, calculation detail appears as stacked employee cards rather than a
  desktop-width table;
- **This payroll looks right** is the obvious next action.

### Approve & pay

Pass:

- approval confirms the payroll numbers only;
- the screen does **not** imply that approval sent money;
- employee payments are confirmed separately;
- Business e-transfer/reference wording is understandable;
- a payment cannot be treated as complete until the required confirmation is
  recorded.

### Done

Pass only after all fictional employee payments are confirmed.

The completion screen should clearly distinguish:

- payroll numbers approved;
- employees paid;
- payroll complete.

## Feedback shorthand

When reporting an issue, use whichever label fits best:

- **BUG** — something is wrong or fails.
- **CONFUSING** — it works, but you did not know what to do or why.
- **MOBILE** — cramped, hard to tap/read, zooming or horizontal scrolling.
- **VISUAL** — does not feel consistent with the Coffee Payroll coffee-shop
  theme.
- **CALC** — amount, rate, deduction, final pay or statutory result looks wrong.
- **ENHANCEMENT** — works correctly, but there is a better/faster way.

A useful note can be as short as:
`MOBILE — Review — Noah card — rate split is too dense to read comfortably.`
