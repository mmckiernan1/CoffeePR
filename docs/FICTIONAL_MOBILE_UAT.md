# Isolated Juniper Trail Coffee Co. fictional UAT — desktop and mobile

The latest review branch is `chat/uat-foundation-print-theme` (draft PR #4).
It includes printable fictional registers/statements and the warm Coffee Payroll
espresso/cream/latte visual standard, with cobalt actions and green successes.

The UAT package uses a **separate** Worker name,
`coffee-payroll-fictional-uat`, and deliberately has **no D1 binding,
migrations, production routes or public preview URLs**. It stores fictional test
progress in the browser; clearing browser data removes that test run.

## Run the current review branch locally — no Cloudflare deployment

On Martin's Windows development machine, in the CoffeePR repository:

```powershell
git fetch origin
git switch chat/uat-foundation-print-theme
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-fictional-uat.ps1
```

If the branch is not present locally, use
`git switch --track origin/chat/uat-foundation-print-theme` instead of
`git switch chat/uat-foundation-print-theme`. The PowerShell script requires
a clean working tree. It builds the isolated fictional package, verifies that
it contains no production bindings, and starts a **local-only** server.

Visit `http://127.0.0.1:8787/uat/fictional`. For responsive QA, use browser
developer tools at narrow mobile widths. The local run does not publish
anything to Cloudflare.

**Do not use `scripts/deploy-closed-fictional-uat.ps1` for this review.**
That legacy deployment script currently requires the older
`chat/uat-cobalt-cheque` branch. Do not deploy or enable public URLs, migrate
D1 or merge anything merely to complete this desktop review.

## Future hosted iPhone UAT — blocked until Access protection is verified

A genuine iPhone/Safari test may follow the local review, but only on the
**separate** `coffee-payroll-fictional-uat` Worker after its Cloudflare
Access protection is configured for Martin's **one exact email address** with
One-time PIN, covering **all traffic**. Verify unauthenticated requests are
blocked before allowing any workers.dev route. Keep preview URLs off, the
production `coffee-payroll` Worker unchanged, and D1 unbound. The current
review does **not** authorize publishing or changing Access.

## Desktop print check

On the latest review branch, from the fictional run print/save the register
and each individual pay statement. Verify ID, gross, tax, CPP, EI, net pay,
any reimbursement and payment evidence; check page breaks and margins.
Every document must clearly identify itself as **fictional demonstration
material**. The app does not email statements or send employee payments.

## iPhone test script

Run the scenario as the owner of Juniper Trail Coffee Co. Do not try to diagnose
problems while testing; note what you expected, what happened, and whether you
knew what to do next.

### Start

- Open `/uat/fictional`.
- Confirm the page feels like Coffee Payroll: warm espresso/cream/latte surfaces,
  cobalt primary actions and green success states, with the original cup mark.
- Tap **Load fictional test**, then **Start Run Payroll**.
- Pass: the next action is obvious without zooming or horizontal scrolling.

### Changes

Expected attention items:

- **Noah Williams** — hourly rate changed during the pay period.
- **Liam Martin** — leaving employee with a $120 reimbursement on final pay.
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
- Noah has 80 regular hours and 2.5 overtime hours. Enter **40 regular at
  $29.50** before August 24, then **40 regular + 2.5 overtime at $31.00**
  from August 24.
- Liam has 64 regular hours at $29.50 plus a **$120 reimbursement**.
- The first validated UAT intentionally excludes an accrued-vacation payout
  because that payment requires the CRA bonus/irregular-payment withholding
  path, which remains a separate production gate.
- **Hours look right** should save and continue without requiring a
  second confirmation click. Approval must remain blocked until hours are confirmed.

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
- both Business e-transfer and Business cheque are available per employee;
- switching payment method clears the prior bank reference or cheque number;
- an e-transfer requires a bank confirmation, while a cheque requires a cheque number;
- a payment cannot be treated as complete until the required confirmation is
  recorded.

### Done

Pass only after all fictional employee payments are confirmed.

The completion screen should clearly distinguish:

- payroll numbers approved;
- employees paid;
- payroll complete.

## Run 18 answer key

For the fictional inputs above, the validated periodic calculation should show:

| Employee | Taxable gross | Income tax | CPP | EI | Employee payment |
| --- | ---: | ---: | ---: | ---: | ---: |
| Avery Chen | $3,076.92 | $530.09 | $175.07 | $50.15 | $2,321.61 |
| Noah Williams | $2,536.25 | $374.23 | $142.90 | $41.34 | $1,977.78 |
| Priya Singh | $4,269.23 | $890.11 | $246.01 | $13.07 | $3,120.04 |
| Liam Martin | $1,888.00 | $220.23 | $104.33 | $30.77 | $1,652.67 |

Liam's employee payment includes the $120 reimbursement after statutory
deductions; the reimbursement is not part of taxable gross.

Expected controls:

- Taxable gross: **$11,770.40**
- Employee payments: **$9,072.10**
- CRA obligation including employer CPP/EI: **$3,676.08**
- Coffee Payroll fee: **$18.00**
- Money to have ready: **$12,766.18**

## Feedback shorthand

When reporting an issue, use whichever label fits best:

- **BUG** — something is wrong or fails.
- **CONFUSING** — it works, but you did not know what to do or why.
- **MOBILE** — cramped, hard to tap/read, zooming or horizontal scrolling.
- **VISUAL** — does not feel consistent with the warm espresso/cream/latte,
  cobalt-action and green-success Coffee Payroll theme.
- **CALC** — amount, rate, deduction, final pay or statutory result looks wrong.
- **ENHANCEMENT** — works correctly, but there is a better/faster way.

A useful note can be as short as:
`MOBILE — Review — Noah card — rate split is too dense to read comfortably.`
