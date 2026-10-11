"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FICTIONAL_PILOT_PROFILE, FICTIONAL_PILOT_PROFILE_KEY } from "@/lib/payroll/pilot-fictional-scenario";
import { pilotReportReadiness } from "@/lib/payroll/pilot-report-readiness";
import {
  PILOT_RUN_PERIOD,
  PILOT_STARTER_STATE,
  PILOT_UAT_STORAGE_KEY,
  pilotCalculateEmployee,
  pilotEmployeeIsInRun,
  type PilotProfile,
  type PilotUatState,
} from "@/lib/payroll/pilot-uat";

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const paymentStorageKey = "coffee-payroll:pilot-payments";

type PaymentEvidence = { approved: boolean; approvedFingerprint?: string | null; paidEmployeeIds: string[]; references: Record<string, string> };

export default function FictionalPayStatementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("employee");
  const [state, setState] = useState<PilotUatState>(PILOT_STARTER_STATE);
  const [profile, setProfile] = useState<PilotProfile>(FICTIONAL_PILOT_PROFILE);
  const [payments, setPayments] = useState<PaymentEvidence>({ approved: false, approvedFingerprint: null, paidEmployeeIds: [], references: {} });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [workspaceResponse, paymentResponse] = await Promise.all([
          fetch("/api/pilot/workspace", { cache: "no-store" }),
          fetch("/api/pilot/payments", { cache: "no-store" }),
        ]);
        if (workspaceResponse.ok) {
          const data = await workspaceResponse.json();
          if (!cancelled) { setState(data.state); setProfile(data.profile); }
          if (paymentResponse.ok) {
            const data = await paymentResponse.json();
            if (!cancelled) setPayments(data.state);
          }
          return;
        }
      } catch { /* isolated UAT uses local browser storage */ }
      try {
        const saved = window.localStorage.getItem(PILOT_UAT_STORAGE_KEY);
        const savedProfile = window.localStorage.getItem(FICTIONAL_PILOT_PROFILE_KEY);
        const savedPayments = window.localStorage.getItem(paymentStorageKey);
        if (!cancelled) {
          if (saved) setState(JSON.parse(saved));
          if (savedProfile) setProfile(JSON.parse(savedProfile));
          if (savedPayments) setPayments(JSON.parse(savedPayments));
        }
      } catch { /* show starter fictional records only */ }
      finally { if (!cancelled) setLoaded(true); }
    }
    void load().finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const reportReadiness = useMemo(() => pilotReportReadiness(state, profile, payments), [state, profile, payments]);
  const canPrint = loaded && reportReadiness.ready;
  const employee = useMemo(() => state.employees.find((person) => person.id === employeeId && pilotEmployeeIsInRun(person)), [state.employees, employeeId]);
  const row = useMemo(() => canPrint && employee && profile.province === "Alberta"
    ? pilotCalculateEmployee(employee, state.timesheets, profile.frequency, state.openingBalances ?? {})
    : null, [employee, state, profile, canPrint]);
  const paid = Boolean(employeeId && payments.paidEmployeeIds.includes(employeeId));
  const reference = employeeId ? payments.references[employeeId] : null;
  const deductions = row ? row.incomeTax + row.cpp + row.cpp2 + row.ei : 0;

  return (
    <main className="min-h-screen bg-[#f7efe6] px-4 py-8 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.push("/uat/reports")} className="rounded-xl border border-[#decdbd] bg-[#fffdf9] px-4 py-2 text-sm font-semibold">Back to register</button>
          <button type="button" onClick={() => window.print()} disabled={!row} className="rounded-xl bg-[#1557d8] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Print / Save PDF</button>
        </div>

        {!loaded ? <div className="rounded-2xl bg-[#fffdf9] p-6">Loading fictional statement…</div>
        : !canPrint ? <div role="alert" className="rounded-2xl border border-[#decdbd] bg-[#fffdf9] p-6"><h1 className="font-semibold">Pay statement not ready</h1><p className="mt-2 text-sm text-[#795f4f]">{reportReadiness.message}</p><button type="button" onClick={() => router.push(reportReadiness.action === "hours" ? "/uat/time" : "/guided-payroll")} className="mt-4 rounded-xl bg-[#1557d8] px-4 py-2 text-sm font-semibold text-white">Return to payroll</button></div>
        : !row ? <div className="rounded-2xl bg-[#fffdf9] p-6">This employee was not found in the selected fictional payroll.</div>
        : <section className="print-document rounded-[28px] border border-[#decdbd] bg-[#fffdf9] p-6 shadow-sm sm:p-9">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#decdbd] pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#967663]">Coffee Payroll · Fictional UAT</p>
              <h1 className="mt-2 text-3xl font-semibold">Pay statement</h1>
              <p className="mt-1 text-sm text-[#795f4f]">{profile.businessName}</p>
            </div>
            <div className="text-right text-sm">
              <p><strong>Employee:</strong> {row.name}</p>
              <p className="mt-1"><strong>Employee ID:</strong> {row.id}</p>
              <p className="mt-1"><strong>Pay date:</strong> {PILOT_RUN_PERIOD.payDate}</p>
            </div>
          </header>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-xs uppercase tracking-wide text-[#967663]">Pay period</p><p className="mt-1 font-semibold">{PILOT_RUN_PERIOD.periodStart} to {PILOT_RUN_PERIOD.periodEnd}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-[#967663]">Pay basis</p><p className="mt-1 font-semibold">{row.payType}{row.status === "Terminating" ? " · Final pay review" : ""}</p></div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <h2 className="border-b border-[#decdbd] pb-2 text-lg font-semibold">This pay</h2>
            <Line label="Gross earnings" value={row.gross} />
            <Line label="Income tax" value={-row.incomeTax} />
            <Line label="CPP" value={-(row.cpp + row.cpp2)} />
            <Line label="EI" value={-row.ei} />
            <Line label="Non-taxable reimbursement" value={row.reimbursement} />
            <div className="flex items-center justify-between border-t-2 border-[#5a321f] pt-4 text-lg font-bold"><span>Net pay</span><span>{money.format(row.net)}</span></div>
            <p className="text-xs text-[#795f4f]">Gross {money.format(row.gross)} less statutory deductions {money.format(deductions)}{row.reimbursement ? `, plus ${money.format(row.reimbursement)} reimbursement` : ""}.</p>
          </div>

          <div className="mt-7 rounded-xl border border-[#decdbd] bg-[#fffaf5] p-4 text-xs">
            <strong>Payment:</strong> {paid ? "Confirmed" : "Not confirmed"}{paid && reference ? ` · Reference ${reference}` : ""}
          </div>
          <footer className="mt-7 border-t border-[#decdbd] pt-4 text-xs leading-5 text-[#795f4f]">
            Fictional demonstration statement only. Not a production pay statement or proof of an actual payment.
            Additional employment-standards fields and year-to-date balances must be validated before production use.
          </footer>
        </section>}
        {row && <p className="no-print mt-4 text-sm text-[#795f4f]">Choose “Save as PDF” in your browser’s Print menu to save a copy. Email delivery is not enabled for this fictional test.</p>}
      </div>
    </main>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-4"><span>{label}</span><span className="font-mono font-semibold">{value < 0 ? `(${money.format(-value)})` : money.format(value)}</span></div>;
}
