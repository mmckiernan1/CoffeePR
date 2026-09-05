# Comcheq guided payroll components

These components are presentation/orchestration only.

To integrate with the current application, map the existing `app/page.tsx` state and callbacks into `GuidedPayrollRun`:

- `approved` → current run approval state
- `timeReady` → existing time-entry readiness state
- `employees` → existing employee rows, reduced to name/pay type/detail/net pay
- `gross`, `net`, `remittance`, `fee` → existing run totals
- `onOpenEmployees` → navigate to existing Employees view
- `onOpenTime` → navigate to existing Time entry view
- `onOpenReview` → navigate to existing Pay run calculation/review view
- `onApprove` → existing approval action
- `onOpenPayments` → existing Pay employees view
- `onOpenReports` → existing Reports & statements view

The main application remains the source of truth. Do not duplicate payroll calculations or payment state inside these components.
