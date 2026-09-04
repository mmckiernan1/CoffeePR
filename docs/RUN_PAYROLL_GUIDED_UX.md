# Run Payroll guided experience

The regular payroll path is intentionally separate from the broader Comcheq administration menu.

## Product promise

A small-business owner should be able to complete payroll by answering ordinary questions in sequence and finish with the confidence that they did their own payroll.

## Six-step path

1. **Changes** — Anything different since the last payroll?
2. **Employees** — Who are you paying?
3. **Hours & pay** — Enter only what changed this period.
4. **Review** — Check the important results in plain language.
5. **Approve & pay** — Deliberately lock the run and release employee payments.
6. **Done** — Confirm completion and surface the records and CRA follow-up.

## Interaction rules

- Make the whole natural action surface clickable.
- Keep the current step and `Step X of 6` visible with the working area.
- Completed steps receive a quiet checkmark.
- Back moves to the previous logical step; it never means start over.
- Back to main menu remains low-profile secondary navigation.
- Salaried employees carry forward without unnecessary data entry.
- Hourly employees receive a subtle `Hourly · hours needed` cue.
- Payroll jargon belongs behind details rather than in the primary path.
- Approval remains deliberate and preserves the existing locked payroll and audit controls.
- The completion state should clearly communicate: payroll is done, employees are accounted for, CRA is accounted for, and records are available.

## Architecture

`RunPayrollShell` owns navigation and progress presentation only. `GuidedPayrollRun` orchestrates the six client-facing steps. Existing Comcheq payroll views, calculations, approval, payment handoff, reporting, remittance and billing remain the source of truth and are reached through callbacks; the guided layer must not create a second payroll engine.
