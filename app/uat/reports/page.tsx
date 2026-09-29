"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FICTIONAL_PILOT_PROFILE_KEY } from "@/lib/payroll/pilot-fictional-scenario";
import { reconcilePilotLocalApproval } from "@/lib/payroll/pilot-local-payment-state";
import { pilotRunFingerprint } from "@/lib/payroll/pilot-run-fingerprint";
import {
  PILOT_RUN_KEY,
  PILOT_RUN_PERIOD,
  PILOT_STARTER_STATE,
  PILOT_UAT_STORAGE_KEY,
  pilotCalculateEmployee,
  pilotEmployeeIsInRun,
  type PilotProfile,
  type PilotUatState,
} from "@/lib/payroll/pilot-uat";

type PaymentState = {
  approved: boolean;
  approvedFingerprint?: string | null;
  paidEmployeeIds: string[];
  references: Record<string, string>;
  completedAt: string | null;
};

const paymentKey = "coffee-payroll:pilot-payments";
const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default function PilotReportsPage() {
  const router = useRouter();
  const [state, setState] = useState<PilotUatState>(PILOT_STARTER_STATE);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [payments, setPayments] = useState<PaymentState>({ approved: false, approvedFingerprint: null, paidEmployeeIds: [], references: {}, completedAt: null });
  const [source, setSource] = useState("Loading payroll record…");
  const [workspaceConnected, setWorkspaceConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [workspaceResponse, paymentResponse] = await Promise.all([
          fetch("/api/pilot/workspace", { cache: "no-store" }),
          fetch("/api/pilot/payments", { cache: "no-store" }),
        ]);
        if (workspaceResponse.ok) {
          const payload = await workspaceResponse.json();
          if (!cancelled) { setState(payload.state); setProfile(payload.profile); setSource("Pilot workspace"); setWorkspaceConnected(true); }
        } else {
          throw new Error("device mode");
        }
        if (paymentResponse.ok) {
          const payload = await paymentResponse.json();
          if (!cancelled) setPayments(payload.state);
        }
        return;
      } catch {
        try {
          const raw = window.localStorage.getItem(PILOT_UAT_STORAGE_KEY);
          const localProfile = window.localStorage.getItem(FICTIONAL_PILOT_PROFILE_KEY);
          const localPayments = window.localStorage.getItem(paymentKey);
          if (raw && !cancelled) setState(JSON.parse(raw));
          if (localProfile && !cancelled) setProfile(JSON.parse(localProfile));
          if (localPayments && !cancelled) setPayments(JSON.parse(localPayments));
          if (!cancelled) setSource("Saved on this device");
        } catch {
          if (!cancelled) setSource("Fictional starter record");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentFingerprint = useMemo(() => pilotRunFingerprint({
    runKey: PILOT_RUN_KEY,
    ...PILOT_RUN_PERIOD,
    province: profile.province,
    frequency: profile.frequency,
    employees: state.employees as Array<Record<string, unknown> & { id: string }>,
    timesheets: state.timesheets,
    openingBalances: state.openingBalances ?? {},
  }), [state, profile]);

  const localApprovalStale = !workspaceConnected
    && payments.approved
    && payments.approvedFingerprint !== currentFingerprint;
  const displayPayments = localApprovalStale
    ? reconcilePilotLocalApproval(payments, currentFingerprint).state as PaymentState
    : payments;

  const rows = useMemo(() => profile.province === "Alberta"
    ? state.employees
      .filter(pilotEmployeeIsInRun)
      .map((employee) => pilotCalculateEmployee(employee, state.timesheets, profile.frequency, state.openingBalances ?? {}))
    : [], [state, profile]);

  const totals = useMemo(() => rows.reduce((sum, row) => ({
    gross: sum.gross + row.gross,
    tax: sum.tax + row.incomeTax,
    cpp: sum.cpp + row.cpp + row.cpp2,
    ei: sum.ei + row.ei,
    net: sum.net + row.net,
  }), { gross: 0, tax: 0, cpp: 0, ei: 0, net: 0 }), [rows]);

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · reports</div></div></div>
          <button onClick={() => router.push(displayPayments.completedAt ? "/uat/complete" : "/guided-payroll")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Back</button>
        </header>

        <section className="mt-7 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Payroll record</p>
          <h1 className="mt-2 text-3xl font-semibold">Run 18 register</h1>
          <p className="mt-2 text-sm text-[#795f4f]">{profile.businessName} · August 16–29, 2026 · Pay September 4, 2026 · {source}</p>
          <p className="mt-1 text-xs text-[#967663]">{PILOT_RUN_KEY}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Summary label="Gross" value={totals.gross} />
            <Summary label="Income tax" value={totals.tax} />
            <Summary label="CPP" value={totals.cpp} />
            <Summary label="EI" value={totals.ei} />
            <Summary label="Employee payments" value={totals.net} accent />
          </div>

          {localApprovalStale && <div className="mt-6 rounded-xl border border-[#d89b6c] bg-[#fff0dc] px-4 py-3 text-sm font-semibold text-[#75451f]">Payroll changed after approval. Previous payment confirmations are hidden until the updated payroll is reviewed and approved again.</div>}

          <div className="mt-7 space-y-3">
            {rows.map((row) => {
              const paid = displayPayments.paidEmployeeIds.includes(row.id);
              const reference = displayPayments.references[row.id]?.trim();
              return <article key={row.id} className="rounded-2xl border border-[#e2d4c8] bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{row.name}</h2><p className="mt-1 text-xs text-[#806858]">{row.payType}{row.status === "Terminating" ? " · Leaving" : ""}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#806858]">Employee payment</p><p className="mt-1 font-mono text-lg font-bold">{cad.format(row.net)}</p></div></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5"><Cell label="Gross" value={cad.format(row.gross)} /><Cell label="Tax" value={cad.format(row.incomeTax)} /><Cell label="CPP" value={cad.format(row.cpp + row.cpp2)} /><Cell label="EI" value={cad.format(row.ei)} /><Cell label="Reimbursement" value={cad.format(row.reimbursement)} /></div>
                {(paid || reference) && <div className="mt-4 rounded-xl bg-[#f7fbf4] px-3 py-2 text-xs text-[#5f7654]">{paid ? "✓ Payment confirmed" : "Payment reference entered"}{reference ? ` · Ref: ${reference}` : ""}</div>}
              </article>;
            })}
          </div>

          <div className="mt-7 rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] p-4 text-sm leading-6 text-[#4f6944]"><strong>Fictional UAT report.</strong> This device-local view lets you verify the payroll register and payment evidence without opening the full production application.</div>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? "border-[#b9cef2] bg-[#edf3ff]" : "border-[#e2d4c8] bg-white"}`}><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#806858]">{label}</p><p className={`mt-2 font-mono text-lg font-bold ${accent ? "text-[#1557d8]" : ""}`}>{cad.format(value)}</p></div>;
}

function Cell({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#806858]">{label}</p><p className="mt-1 font-medium text-[#4f4037]">{value}</p></div>;
}
