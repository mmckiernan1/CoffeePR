# Guided payroll integration checklist

- [x] Six-step shell and progress bar
- [x] Quiet main-menu navigation
- [x] Logical Back navigation
- [x] Natural clickable action surfaces
- [x] Plain-language Changes step
- [x] Employee confirmation with subtle hourly cue
- [x] Hours & pay step that defers to existing time entry
- [x] Review step using existing run totals
- [x] Deliberate approval and employee-payment handoff
- [x] Completion state with records access
- [x] Existing payroll engine remains source of truth
- [x] Persist guided progress while visiting Employees, Time Entry, Review or Payments
- [x] Add `CurrentRunBridge` to map the existing run-17 state into the guided component
- [ ] Import `CurrentRunBridge` into `app/page.tsx`
- [ ] Replace only the `view === "payroll"` render with the bridge
- [ ] Keep the existing `PayrollView` as the detailed-review destination
- [ ] Preserve direct deep-navigation for experienced users
- [ ] Build/test on branch
- [ ] Visual review at desktop and mobile widths
- [ ] Merge only after review

## Intended `app/page.tsx` wiring

Add:

```tsx
import { CurrentRunBridge } from "@/components/comcheq";
```

Replace the current `view === "payroll"` render with:

```tsx
{view === "payroll" && (
  <CurrentRunBridge
    approved={approved}
    timeReady={timeReady}
    employees={employees}
    gross={totals.gross}
    net={totals.net}
    remittance={remittance}
    onHome={() => navigate("home")}
    onEmployees={() => navigate("employees")}
    onTime={() => navigate("time")}
    onReview={() => navigate("calculation")}
    onApprove={() => setApprovalOpen(true)}
    onPayments={() => navigate("payments")}
    onReports={() => navigate("reports")}
  />
)}
```

The existing `PayrollView` should remain in the file for detailed payroll review and can later be exposed from the guided Review step or an advanced/deep-navigation route. No payroll calculation, approval, payment, banking, CRA, billing or reporting logic is duplicated in the guided layer.
