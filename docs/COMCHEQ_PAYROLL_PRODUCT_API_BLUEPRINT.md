# Comcheq Payroll product and API blueprint

**Decision baseline:** 30 August 2026  
**Initial jurisdiction:** Alberta  
**Initial market:** Canadian employers with 1–50 employees  
**Bank adapter:** RBC CPA005 Credit (TEST until bank acceptance)

## 1. Executive decision

Comcheq should use **RBC CPA005 Credit** as its first bank-file adapter. RBC supports several input layouts, but CPA005 is the best starting point because it follows the Canadian AFT exchange layout, supports CAD credits to Canadian financial institutions, and keeps the adapter portable enough to add other Canadian bank profiles later.

The adapter is not production-ready merely because it produces a correctly shaped file. Production use requires an RBC-assigned ten-digit client number, an agreed processing centre and transmission profile, unique production file-creation numbers, and RBC acceptance of an onboarding test file.

## 2. Product boundaries

### MVP includes

1. Guided customer setup: legal employer, CRA account, pay schedule, bank profile and opening balances.
2. Employee payroll profiles with effective-dated compensation, statutory elections and Canadian bank instructions.
3. Hourly time entry and a clear readiness gate.
4. Prominently numbered pay runs with a permanent record for each run.
5. Calculation, review, approval, adjustment and reversal controls.
6. Payroll register, RBC CPA005 bank file and employee statements for every approved run.
7. Employer-controlled CRA remittance summaries and payment recording.
8. Calendar-year balancing, T4 slips and CRA T4 XML.
9. Editable ROE drafts generated from approved insurable history, followed by validated ROE XML.
10. A simple GL export and a distinct usage-billing ledger.

### MVP excludes

- Quebec payroll, construction union rules, complex pension plans and advanced HR.
- Trust-account funding, direct movement of employer payroll cash, or direct CRA remittance.
- Public unauthenticated payroll records or browser storage as the system of record.
- Claiming bank, CRA or Service Canada certification before formal test acceptance.

## 3. Architecture principles

| Principle | Required implementation |
|---|---|
| Money is exact | Store all amounts as signed integer cents; round only at named statutory formula boundaries. |
| Rules are effective-dated | Every calculation stores jurisdiction, effective date, version and official source. |
| Runs are auditable | Each employer/year has a monotonically numbered run sequence. Approval creates an immutable snapshot. |
| Corrections preserve history | Never edit an approved run in place; create linked adjustments or reversals. |
| Outputs reconcile | Register net, bank-file total, statement total, remittance liability and GL control accounts must balance. |
| Duties are separated | Payroll, bank, CRA, GL, document and billing ledgers have distinct records linked to the run. |
| Requests are repeat-safe | Creation, calculation, approval and output endpoints require idempotency keys. |
| Tenancy is enforced server-side | Every record is employer-scoped; identity alone never grants access to another employer. |
| Data remains portable | Administrators can export every record section to CSV and import validated CSV batches with stable external keys. |

## 4. Domain model

| Aggregate | Key records | Control notes |
|---|---|---|
| Employer | employer, workspace membership, CRA account, bank profile, pay schedule | Bank credentials encrypted; display only masked values. |
| Employee | employment, compensation, tax elections, bank instruction, status history | Effective-dated rows; SIN encrypted and separately permissioned. |
| Time | time batch, time entry, approval | A run cannot be approved until required hourly inputs are ready. |
| Pay run | run header, calculation snapshot, employee payment, pay components, notices | Unique employer/year/run number; optimistic version on mutable drafts. |
| Output | register, bank export, statement batch, statement | Content checksum and generating snapshot stored with every output. |
| Compliance | remittance liability, remittance payment, T4 slip, T4 summary, ROE | Separate draft, validated, generated and filed/submitted states. |
| Accounting | journal header and lines | Debits must equal credits; source is the approved run snapshot. |
| Billing | usage event and invoice line | One $2.00 event per finalized employee payment; drafts and recalculations are free. |
| Audit | append-only actor/action record | Capture actor, timestamp, employer, object, before/after identifiers and reason. |

## 5. Pay-run lifecycle

`draft → calculated → reviewed → approved → reversed`

- Drafts can be edited without billing.
- Calculation pins the applicable ruleset and produces employee-level components and notices.
- Review requires time readiness, bank-detail completeness, statutory balance checks and no blocking errors.
- Approval is atomic: lock the run, save the snapshot, create audit and billing events, and make outputs available.
- Recalculation after review returns the run to `calculated` and invalidates previews.
- An approved run is never reopened. Corrections use a linked adjustment or reversal.

## 6. Calculation engine

The engine should be a pure service: normalized employer, employee, time, year-to-date and ruleset inputs produce deterministic calculation lines and notices. UI choices do not select untraceable “Option 1/Option 2” modes. Any CRA formula path required by the employee’s facts is chosen internally, stored on the calculation line and included in the audit trail.

### Implemented Alberta 2026 periodic path

`CRA-T4127-2026-AB-v1` is effective from January 1 through December 31, 2026. It implements the regular periodic T4127 path for Alberta salary/hourly remuneration, overtime paid in the earned period, taxable benefits, registered-plan deductions, CPP/CPP2, EI, TD1 claim amounts and the common 12/24/26/52-period schedules. The July 2026 T4127 edition confirms there was no Alberta change. Each province will have its own effective-dated ruleset; Comcheq must not assume that every jurisdiction changes on January 1 or July 1.

The path reconciles to the two published 2026 T4032-AB worked examples: $170.20 period income tax below YMPE and $210.18 above YMPE with CPP2. Boundary tests cover CPP/CPP2/EI maxima, taxable-benefit cash treatment, net-pay identities and effective-date selection. Commission/TD1X, bonus, retroactive, Quebec-transfer and unusual-frequency inputs are blocking unsupported cases until their own source-backed paths are implemented and compared with PDOC.

Initial statutory validation must use the current CRA **T4127 Payroll Deductions Formulas** and comparison cases from the CRA **Payroll Deductions Online Calculator (PDOC)**. Golden cases must cover salary, hourly, overtime, bonus, mid-year hire, TD1 claims, CPP maxima, CPP2 where applicable, EI maxima, negative/zero net protection, vacation pay, taxable benefits and year-to-date reopening scenarios.

## 7. API contract

| Method | Resource | Required control |
|---|---|---|
| POST | `/api/v1/employers` | Identity, authorization and idempotency key |
| POST | `/api/v1/employers/{employerId}/employees` | Effective date and tenant ownership |
| PUT | `/api/v1/pay-runs/{payRunId}/time` | Draft version and readiness state |
| POST | `/api/v1/pay-runs` | Unique employer/year/run number |
| POST | `/api/v1/pay-runs/{payRunId}/calculate` | Ruleset version and idempotency key |
| POST | `/api/v1/pay-runs/{payRunId}/review` | Blocking-notice resolution |
| POST | `/api/v1/pay-runs/{payRunId}/approve` | Reviewer permission, optimistic version and atomic event creation |
| GET | `/api/v1/pay-runs/{payRunId}/register` | Approved snapshot authorization |
| POST | `/api/v1/pay-runs/{payRunId}/bank-files` | Approved snapshot, adapter config and idempotency key |
| POST | `/api/v1/records-of-employment` | Approved insurable history and editable draft version |
| POST | `/api/v1/year-ends/{year}/t4` | Balanced year, current CRA schema and idempotency key |
| GET | `/api/v1/admin/data-exchange/{section}/export` | Administrator role, employer scope and export audit event |
| POST | `/api/v1/admin/data-exchange/{section}/imports/validate` | Administrator role, schema version and dry-run only |
| POST | `/api/v1/admin/data-exchange/{section}/imports/commit` | Validated batch ID, second-person review where sensitive, and idempotency key |

The codebase exposes `/api/v1/openapi`, `/api/v1/health` and a fictional `/api/v1/demo/rbc-cpa005` download. Mutating routes remain a design contract until authenticated tenancy and durable storage are added.

## 8. Administrator CSV data exchange

Comcheq should follow the practical Great Plains pattern: every important record area has a documented CSV export, an import template and a validation-first import path. The initial catalogue covers employer profiles, employees, compensation and tax profiles, bank instructions, pay schedules, opening balances, time entries, pay-run headers, employee pay details, CRA remittances, T4 slips, ROEs, general-ledger entries and usage-billing events.

### Required controls

1. Only an employer administrator can export or import data; sensitive bank and tax values are masked unless a separately authorized migration package is requested.
2. Every file includes stable external identifiers and a schema version. Dates use ISO `YYYY-MM-DD`; money uses signed integer cents.
3. Import is always two-stage: upload and dry-run validation, then explicit commit. Validation reports required headers, duplicate keys, referential errors, row-level failures, balancing differences and proposed creates/updates.
4. A committed batch is idempotent, checksum-protected and fully audited with actor, employer, source filename, row counts, before/after references and error report.
5. Effective-dated employee data creates a new dated row. Approved pay runs, filed T4 slips, submitted ROEs, bank files, GL journals and billing events are never overwritten; migrations append history or create linked corrections.
6. “Export all records” produces one section-discriminated CSV for troubleshooting and portability. Each section also remains independently exportable and importable from its own simpler template.
7. Real imports remain disabled on the public fictional prototype until authenticated tenancy, durable storage, encryption and role separation are operating.

## 9. RBC CPA005 Credit adapter

### File organization

- Optional RBC transmission routing record, selected for TEST or PROD.
- One 1,464-character `A` header logical record.
- One or more 1,464-character `C` logical records, each holding up to six 240-character payment segments.
- One 1,464-character `Z` trailer logical record.
- Numeric fields are unsigned, right-justified and zero-filled. Alphanumeric fields are left-justified and space-filled.

### Required mapping

| CPA005 field | Comcheq source | Rule |
|---|---|---|
| Client number | Employer bank adapter | Ten digits: six assigned by RBC plus four subsidiary digits. |
| File creation number | Bank-export sequence | `TEST` for test files; four numeric digits for production and different from the previous nine. |
| Creation/payment date | Export/run dates | RBC `0YYDDD` format. |
| Processing centre | RBC onboarding profile | Five-digit RBC centre; Calgary is `00390`. |
| Transaction code | Payment purpose | `200` Payroll Deposit by default. |
| Amount | Approved employee net | Ten numeric digits in cents; must match the approved register. |
| Destination routing | Employee bank instruction | `0` + three-digit institution + five-digit transit. |
| Account number | Employee bank instruction | One to twelve significant digits; left-justified, not zero-filled. |
| Customer name | Employee legal name | Mandatory, maximum 30 characters; never silently abbreviate. |
| Client name | Employer legal name | Mandatory, maximum 30 characters. |
| Trailer controls | Approved payment set | Fourteen-digit total cents and eight-digit payment count. |

### Adapter acceptance tests

1. Every logical record is exactly 1,464 characters.
2. Record counters start at one and increment through the trailer.
3. More than six payments creates another `C` logical record.
4. Trailer payment count and amount equal the parsed payment segments.
5. Production rejects the all-zero demo client number and `TEST` file number.
6. Canadian institution, transit and account lengths are enforced.
7. A fixture accepted by RBC is retained as a golden file after onboarding.
8. Bank-export attempts are idempotent and retained against the approved snapshot.

## 10. T4 and ROE

T4 slips must be generated from the complete calendar-year ledger, not from editable employee current-state fields. The year-end process balances employee boxes, the T4 Summary, CRA remittance liabilities and filed amendments. Output must validate against the current CRA T4 XML and T619 specifications before filing.

ROEs must remain editable while draft. Insurable hours and earnings by pay period are derived from approved run history, while human-editable fields such as reason code, last day paid and comments carry draft-version controls. Generation must validate against Service Canada’s current ROE Web XML schema. Amendments create a new linked version; submitted records are never overwritten.

## 11. Security and persistence gate

The current public site must not store real employer or employee data. Production activation requires:

1. Signed-in identity plus explicit server-side employer membership and role checks.
2. Durable relational storage with append-only migrations, backups and restore tests.
3. Encryption and least-privilege access for SINs, bank instructions and tax identifiers.
4. No sensitive values in URLs, analytics, client logs or general audit detail.
5. Signed, expiring document downloads and retention/deletion policies.
6. Separation of preparer, reviewer and administrator roles, with an emergency access procedure.
7. Monitoring for duplicate approvals, duplicate bank files, changed bank instructions and abnormal exports.
8. CSV import batches are staged outside live ledgers, scanned, size-limited and committed transactionally only after validation.

## 12. Delivery sequence

| Phase | Deliverable | Exit gate |
|---|---|---|
| 1. Foundation | Domain types, integer money, state machine, API contract, RBC TEST adapter | Automated unit and balance tests pass. |
| 2. Calculation | Alberta rules engine with effective-dated T4127 inputs | CRA/PDOC golden cases reconcile within defined rounding rules. |
| 3. Durable workflow | Authenticated tenancy, database schema, audit ledger, numbered history and administrator CSV staging | Security review, import rollback and migration/restore tests pass. |
| 4. Outputs | Register, statements, GL and RBC production configuration | RBC accepts onboarding test file; outputs reconcile. |
| 5. Compliance | Remittances, T4 and editable ROE generation | Current CRA and Service Canada schemas validate; expert review passes. |
| 6. Pilot | Two or three Alberta employers in parallel payroll | At least two clean parallel cycles per employer and documented sign-off. |

## 13. Source register

- Payments Canada rules and standards: https://www.payments.ca/systems-services/rules-documentation
- Payments Canada ISO 20022 and AFT coexistence: https://www.payments.ca/payment-resources/iso-20022
- RBC input formats: https://www.rbcroyalbank.com/ach/cid-212260.html
- RBC CPA005 Credit File Format, version 10: https://www.rbcroyalbank.com/ach/file-451770.pdf
- RBC non-restricted CPA transaction codes: https://www.rbcroyalbank.com/ach/file-450194.pdf
- CRA T4127 Payroll Deductions Formulas: https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas.html
- CRA Payroll Deductions Online Calculator: https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/payroll-deductions-online-calculator.html
- CRA T4 XML specifications: https://www.canada.ca/en/revenue-agency/services/e-services/filing-information-returns-electronically-t4-t5-other-types-returns-overview/xml-specs.html
- CRA T619 electronic transmittal specification: https://www.canada.ca/en/revenue-agency/services/e-services/filing-information-returns-electronically-t4-t5-other-types-returns-overview/t619-2026.html
- Service Canada ROE Web and XML resources: https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-roe.html
- Service Canada ROE XML schema appendix: https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-roe/user-requirements/appendix-d.html
