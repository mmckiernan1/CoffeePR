# Comcheq Payroll operating model

## Service paths

| Path | Client responsibility | Comcheq responsibility | Commercial treatment |
| --- | --- | --- | --- |
| Self-serve | Enter and verify setup data, approve payroll, upload EFT, pay CRA | Guided gates, calculations, outputs, records and reminders | Published per-run and per-payment pricing |
| Shoebox assisted setup | Supply available records, answer exceptions, verify and approve | Organize opening records, configure the fictional workspace and support the first run | One-time fee quoted and accepted before work begins |

Comcheq never takes custody of online-banking credentials. The client remains the payment approver in both paths.

## Launch gates

1. Choose service path and confirm responsibilities.
2. Verify legal business identity, province and CRA payroll program account.
3. Verify employee identity, pay terms, tax elections, banking directions and effective dates.
4. Load and reconcile opening year-to-date balances.
5. Configure the bank-specific AFT adapter and remitter schedule.
6. Run a parallel payroll and reconcile employee results, gross-to-net, EFT count and EFT dollars.
7. Obtain explicit client sign-off before production activation.

## Staging workflow test

1. Open Customer setup and select Self-serve or Shoebox.
2. Complete the simulated launch checklist.
3. Open pay run 17, calculate, clear compliance checks, review and approve.
4. Download the generic Payments Canada AFT simulation.
5. Verify that every logical record is 1,464 characters, begins with A/C/Z as expected, and that the Z-record count and amount equal the approved run.
6. Open the configured bank link in a separate tab, but do not upload the simulation file.
7. Choose Pay now or Remind on due date for the CRA obligation, then record the fictional confirmation.
8. Bank and use overtime hours and verify the auditable in/out balance.
9. Confirm that final approval creates exactly one $10 plus $2-per-employee billing charge attempt through the tokenized payment profile.
10. Record a contractor payment separately from employee payroll and export the employee-number/contractor-number sorted year-end working papers.

## Production blockers

- Replace fictional employee bank details and zero client identifiers through controlled setup.
- Implement and certify the client bank's exact AFT profile, transmission wrapper and file-creation sequence.
- Retain bank test acceptance as launch evidence.
- Validate statutory calculations and holiday calendars for the production tax year and jurisdiction.
- Require role-based review and explicit client approval for every released pay run.
- Complete privacy, security, retention, incident-response and support procedures before accepting real payroll data.
- Select a PCI-compliant hosted payment provider. Comcheq must store only its customer/payment-method token and masked label, never raw card or bank details.
- Complete worker-classification and T4A filing rules before treating the contractor working paper as a filing-ready return.

The generic AFT download is deliberately labelled **SIMULATION ONLY — NOT BANK-SUBMITTABLE**. It is a workflow and fixed-record control fixture, not a universal bank file.
