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
- Confirm the employee appears in the pay population before payroll review.

### 3. Employee changes
- Change an hourly rate.
- Change a salary.
- Confirm the new rate is visible in the pay population.
- Confirm the change is understandable in plain language before payroll is approved.

### 4. Timesheets
- Enter regular, overtime and vacation hours for each hourly employee.
- Confirm salaried employees do not require timesheet entry.
- Confirm time can be marked ready only after all hourly employees have a valid row.
- Confirm changing time clears the ready state until it is reviewed again.

### 5. Guided payroll
- Changes → Employees → Hours & pay → Review → Approve & pay → Done.
- Confirm Back returns to the prior logical step.
- Confirm progress is retained when opening Employees, Time Entry, detailed Review, Payments or Reports.
- Confirm payroll approval remains the deliberate lock point.

### 6. Employee payment pilot
- Business e-transfer is the visible pilot payment method.
- EFT/bank-file upload controls are hidden during the pilot.
- Confirm the user can see each employee's net pay and record the payment handoff.

### 7. Reports and remittances
- Open payroll register.
- Open employee pay statement.
- Open CRA remittance summary.
- Confirm the owner can get back into the guided flow without losing progress.

## Existing foundation already present

- The main application already keeps editable hourly time-entry state for Noah Williams and Liam Martin and provides an update function for regular, overtime and vacation hours.
- The payroll core blocks approval if hourly time is not marked ready.
- The configuration API includes effective-dated pay-change handling.
- The database schema contains employee hire dates and audit-style previous/new value fields.

## Pilot UAT workspace

Use `/uat` for a focused interactive walkthrough of new hires, rate changes and timesheets. The UAT page is intentionally local preview state and does not claim production persistence.

Use `/guided-payroll` to test the owner-facing six-step payroll experience.

Use `/onboarding` to test the new-customer setup journey.

## Production gates before real client payroll

- Configure Supabase project and production OAuth credentials.
- Turn on the application authentication gate after credentials are verified.
- Persist business workspaces, membership, hires, employee changes and timesheets to the production datastore.
- Confirm authorization so one business cannot access another business's payroll data.
- Run automated build/test/lint and complete desktop/mobile visual walkthrough.
- Add privacy, terms, consent and retention controls appropriate for Canadian payroll data.
- Do not use real SIN, bank, tax or employee information in UAT until those gates are complete.
