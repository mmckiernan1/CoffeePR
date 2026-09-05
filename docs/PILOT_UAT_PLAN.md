# Coffee Payroll pilot UAT plan

## Purpose

Validate the small-business owner journey before real payroll data is used. UAT should be performed with fictional employees only until authentication, workspace persistence and production hosting are configured.

## Core scenarios

### 1. Account and onboarding
- Create account with email/password.
- Confirm social sign-in entry points are available for Google, Microsoft and Apple.
- Complete Business → Payroll → Employees → Ready onboarding.
- Confirm the user lands in a business workspace rather than sharing credentials with another person.

### 2. Hire an employee
- Add a fictional salaried employee.
- Add a fictional hourly employee.
- Confirm the hourly employee is clearly identified as needing hours.
- Confirm the employee persists after navigation/refresh and appears in the guided pay population.

### 3. Employee changes
- Change an hourly rate.
- Change a salary.
- Confirm the new rate persists and is visible in the guided payroll population.
- Confirm the changed amount feeds payroll calculation and detailed Review.

### 4. Timesheets
- Enter regular, overtime and vacation hours for each hourly employee.
- Confirm salaried employees do not require timesheet entry.
- Confirm time can be marked ready only after all hourly employees have a valid row.
- Confirm changing time clears the ready state until it is reviewed again.
- Confirm the saved hours feed the payroll calculation.

### 5. Guided payroll
- Changes → Employees → Hours & pay → Review → Approve & pay → Done.
- Confirm Back returns to the prior logical step.
- Confirm progress is retained when opening Employees, Time Entry, detailed Review, Payments or Reports.
- Confirm payroll approval remains the deliberate lock point.
- Confirm Gross pay, Employee deposits and CRA obligation are calculated from the current UAT hires, rates and timesheets.
- Confirm approval persists when leaving and returning to the guided flow.

### 6. Detailed calculation review
- From guided Review, choose **See payroll details**.
- Confirm `/uat/review` displays every UAT employee with the current salary/rate and entered hours.
- Confirm employee-level Gross, Income tax, CPP, EI and Net pay are visible.
- Return to `/uat`, change one rate or timesheet value, then return to Review and confirm both the employee result and run totals change.
- Confirm a newly added fictional employee is included in the calculation.

### 7. Employee payment pilot
- Business e-transfer is the visible pilot payment method.
- EFT/bank-file upload controls are hidden during the pilot.
- From Approve & pay, open `/uat/payments`.
- Confirm each employee's calculated net pay is shown as the amount to send.
- Record a bank/e-transfer confirmation reference for each employee.
- Mark each employee paid and confirm the checklist persists after navigation/refresh.
- Confirm Coffee Payroll does not mark the payroll complete until the run is approved and every employee is marked paid.

### 8. Completion
- After every employee is marked paid, choose **Finish payroll**.
- Confirm `/uat/complete` shows **You did your payroll.**
- Confirm the completion screen reflects the actual employee payment checklist rather than a manual acknowledgement.
- Confirm reopening the guided payroll shows the run as Approved/Completed.

### 9. Reports and remittances
- Open payroll register.
- Open employee pay statement.
- Open CRA remittance summary.
- Confirm the owner can get back into the guided flow without losing progress.

## Current calculation scope

The integrated UAT flow uses the repository's validated **Alberta regular-periodic** statutory calculation engine. Salary is converted using the pilot pay frequency. Hourly gross pay uses regular hours at straight time, overtime at 1.5×, and vacation hours at the regular hourly rate for this UAT scenario.

Existing fictional employees retain fictional year-to-date balances so CPP, EI and income tax can be exercised realistically. Newly added fictional employees begin with zero year-to-date balances.

The pilot now demonstrates the dependency:

**Hire / change / timesheet → guided payroll population → statutory calculation → employee-level Review → approval → e-transfer checklist → confirmed completion.**

This is still UAT state, not production payroll history. Coffee Payroll records the payment handoff and confirmation reference; the business owner sends the actual e-transfer through their bank.

## Existing foundation already present

- The main application already has editable time-entry handling and approval readiness controls.
- The payroll core blocks approval if hourly time is not marked ready.
- The configuration API includes effective-dated pay-change handling.
- The durable schema contains employee, pay-run, calculation, audit and workspace structures that can replace the pilot snapshot layer before live payroll.

## Pilot UAT workspace

Use `/uat` for new hires, rate changes and timesheets.

Use `/guided-payroll` to test the owner-facing six-step payroll experience using the saved UAT population.

Use `/uat/review` for employee-level calculation verification.

Use `/uat/payments` for the business e-transfer checklist and confirmation references.

Use `/uat/complete` to verify that completion depends on actual UAT payment status.

Use `/onboarding` to test the new-customer setup journey.

## Production gates before real client payroll

- Configure Supabase project and production OAuth credentials.
- Turn on the application authentication gate after credentials are verified.
- Apply the pilot D1 migration in the hosted environment.
- Verify authorization with at least two separate business test accounts so one business cannot access another business's payroll data.
- Replace pilot snapshot/payment persistence with durable transactional employee, effective-dated compensation, time-entry, pay-run and payment-handoff records.
- Ensure production changes write auditable events and approved payroll snapshots are immutable.
- Validate statutory rule packs for every province offered to customers.
- Run automated build/test/lint and complete desktop/mobile visual walkthrough.
- Add privacy, terms, consent, backup/recovery and retention controls appropriate for Canadian payroll data.
- Do not use real SIN, bank, tax or employee information in UAT until those gates are complete.
