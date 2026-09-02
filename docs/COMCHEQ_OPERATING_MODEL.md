# Comcheq Payroll operating model

## Service paths

| Path | Client responsibility | Comcheq responsibility | Commercial treatment |
| --- | --- | --- | --- |
| Self-serve | Enter and verify setup data, approve payroll, release employee payments, pay CRA | Guided gates, calculations, payment instructions, outputs, records and reminders | Published per-run and per-payment pricing |
| Shoebox assisted setup | Supply available records, answer exceptions, verify and approve | Organize opening records, configure the fictional workspace and support the first run | One-time fee quoted and accepted before work begins |

Comcheq never takes custody of online-banking credentials. The client remains the payment approver in both paths.

## Client-controlled employee payments

An approved pay run may combine EFT bank-file deposits, business e-transfers and business cheques. Approval locks each employee's net pay but does not mark the employee paid. The client must confirm the EFT count and control total, record a unique bank reference for an e-transfer, or record a cheque number. Comcheq retains the outstanding/paid status and produces a payment-reconciliation record without storing banking passwords, e-transfer security answers or confidential details in a transfer message.

Extra runs use the same separation of calculation, approval and payment. A missed shift can be calculated on the pay date, approved as a linked correction, paid directly and retained with its own statement and client evidence.

## Launch gates

1. Choose service path and confirm responsibilities.
2. Verify legal business identity, province and CRA payroll program account.
3. Verify employee identity, pay terms, tax elections, banking directions and effective dates.
4. Load and reconcile opening year-to-date balances.
5. Configure the bank-specific AFT adapter and remitter schedule.
6. Run a parallel payroll and reconcile employee results, gross-to-net, EFT count and EFT dollars.
7. Obtain explicit client sign-off before production activation.

## Staging workflow test

The public **Guided test** is the shortest complete rehearsal. It now carries one fictional employee through employer and employee confirmation, regular and paid overtime inputs, overtime-bank movements, statutory-holiday evidence, preliminary calculation, approval and automatic billing. After approval it requires the client to confirm the EFT control total before continuing, then records either a CRA test-payment confirmation or a due-date reminder. The final screen exposes the locked run, closing overtime-bank balance, one billing result and the selected CRA action.

1. Open the secure workspace at **Start here** and select Self-service or Shoebox setup.
2. Review the six readiness controls; each control links to its working area instead of relying on a manual completion claim.
3. Open pay run 17, calculate, clear compliance checks, review and approve.
4. Open **Pay employees**, review the mixed EFT/e-transfer/cheque instructions and confirm that their total equals approved net payroll.
5. Record a unique fictional e-transfer confirmation and cheque number, then download the generic Payments Canada AFT simulation for the remaining employees.
6. Verify that every logical record is 1,464 characters, begins with A/C/Z as expected, and that the Z-record count and amount equal the approved run.
7. Confirm the fictional EFT batch count, amount and bank reference, then export the payment reconciliation.
8. Choose Pay now or Remind on due date for the CRA obligation, then record the fictional confirmation.
9. Bank and use overtime hours and verify the auditable in/out balance.
10. Confirm that final approval creates exactly one $10 plus $2-per-employee billing charge attempt through the tokenized payment profile.
11. Run a missed-hours extra payroll and complete its e-transfer handoff.
12. Record a contractor payment separately from employee payroll and export the employee-number/contractor-number sorted year-end working papers.

The client-facing navigation opens Start here, Pay runs, OT bank and Contractors first. Payroll accounts, detailed payroll setup, offboarding and the audit trail remain authenticated working areas and continue to enforce role checks on every write.

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
