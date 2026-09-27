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
