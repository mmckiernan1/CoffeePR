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
- [x] Persist guided progress while visiting Employees, Time Entry, Review or Payments
- [x] Add `CurrentRunBridge` to map existing run-17 data into the guided component
- [x] Route `Open pay run 17`, `Current run`, and the Pay run 17 workflow tile into the guided experience
- [x] Connect guided Employees, Time Entry, Review, Payments, and Reports actions back to the existing workspaces
- [x] Preserve the existing detailed payroll screen as the Review workspace
- [x] Preserve direct deep-navigation for experienced users outside the normal current-run entry points
- [ ] Run full build/test in an environment with repository dependencies available
- [ ] Visual review at desktop and mobile widths
- [ ] Merge only after review

## Integration approach

The guided experience is activated at the application shell through `PayrollRouteBridge`. This keeps the very large existing `app/page.tsx` payroll implementation unchanged while the new experience is reviewed.

Normal current-payroll entry points open `/guided-payroll`. Guided actions can hand off to the existing single-page workspaces through a temporary `workspace` query parameter; the bridge selects the existing workspace and immediately cleans the URL.

This approach is intentionally reversible and keeps the existing payroll engine, approval dialog, time entry, employee management, payment workspace, reporting, CRA calculations, banking controls, and detailed payroll screens intact while the guided UX is evaluated.

A later cleanup can replace this bridge with direct `app/page.tsx` composition once the guided UX is accepted and the large page is broken into smaller route-level components.
