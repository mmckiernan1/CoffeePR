"use client";
import { FICTIONAL_PILOT_PROFILE_KEY } from "@/lib/payroll/pilot-fictional-scenario";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

type PaymentMethod = "Business e-transfer" | "Business cheque";
type PaymentState = { approved: boolean; approvedFingerprint?: string | null; paidEmployeeIds: string[]; references: Record<string, string>; completedAt: string | null };

const paymentKey = "coffee-payroll:pilot-payments";
const paymentMethodKey = "coffee-payroll:pilot-payment-methods";
const emptyPayments: PaymentState = { approved: false, approvedFingerprint: null, paidEmployeeIds: [], references: {}, completedAt: null };
const referenceSaveDelayMs = 650;
const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 });

export default function PilotPaymentsPage() {
  const router = useRouter();
  const [uat, setUat] = useState<PilotUatState>(PILOT_STARTER_STATE);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [payments, setPayments] = useState<PaymentState>(emptyPayments);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethod>>({});
  const [approvalStale, setApprovalStale] = useState(false);
  const [sync, setSync] = useState<"loading" | "workspace" | "device" | "saving">("loading");
  const [completionError, setCompletionError] = useState("");
  const paymentsRef = useRef<PaymentState>(emptyPayments);
  const referenceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    paymentsRef.current = payments;
  }, [payments]);

  useEffect(() => {
    const timers = referenceTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const savedMethods = window.localStorage.getItem(paymentMethodKey);
        if (savedMethods && !cancelled) {
          const parsed = JSON.parse(savedMethods) as Record<string, unknown>;
          const valid = Object.fromEntries(Object.entries(parsed).filter(([, method]) => method === "Business e-transfer" || method === "Business cheque")) as Record<string, PaymentMethod>;
          setPaymentMethods(valid);
        }
      } catch {
        // Keep e-transfer as the default payment method.
      }

      try {
        const workspace = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (workspace.ok) {
          const data = await workspace.json();
          if (!cancelled) { setUat(data.state); setProfile(data.profile); }
        } else {
          const localProfile = window.localStorage.getItem(FICTIONAL_PILOT_PROFILE_KEY);
          if (localProfile && !cancelled) setProfile(JSON.parse(localProfile));
          const raw = window.localStorage.getItem(PILOT_UAT_STORAGE_KEY);
          if (raw && !cancelled) setUat(JSON.parse(raw));
        }

        const paymentResponse = await fetch("/api/pilot/payments", { cache: "no-store" });
        if (paymentResponse.ok) {
          const data = await paymentResponse.json();
          if (!cancelled) {
            paymentsRef.current = data.state;
            setPayments(data.state);
            setApprovalStale(Boolean(data.approvalStale));
            setSync("workspace");
          }
          return;
        }
      } catch {
        // Device fallback below.
      }
      try {
        const raw = window.localStorage.getItem(paymentKey);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as PaymentState;
          paymentsRef.current = parsed;
          setPayments(parsed);
        }
      } catch {
        // Keep empty fictional payment state.
      }
      if (!cancelled) setSync("device");
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const currentFingerprint = useMemo(() => pilotRunFingerprint({
    runKey: PILOT_RUN_KEY,
    ...PILOT_RUN_PERIOD,
    province: profile.province,
    frequency: profile.frequency,
    employees: uat.employees as Array<Record<string, unknown> & { id: string }>,
    timesheets: uat.timesheets,
    openingBalances: uat.openingBalances ?? {},
  }), [uat, profile]);

  const localApprovalStale = sync === "device"
    && payments.approved
    && payments.approvedFingerprint !== currentFingerprint;
  const approvalInvalid = approvalStale || localApprovalStale;
  const displayPayments = localApprovalStale
    ? reconcilePilotLocalApproval(payments, currentFingerprint).state as PaymentState
    : payments;

  const rows = useMemo(() => profile.province === "Alberta"
    ? uat.employees
      .filter(pilotEmployeeIsInRun)
      .map((employee) => ({ employee, net: pilotCalculateEmployee(employee, uat.timesheets, profile.frequency, uat.openingBalances ?? {}).net }))
    : [], [uat.employees, uat.timesheets, uat.openingBalances, profile]);
  const allPaid = rows.length > 0 && rows.every(({ employee }) => displayPayments.paidEmployeeIds.includes(employee.id));
  const allReferences = rows.length > 0 && rows.every(({ employee }) => Boolean(displayPayments.references[employee.id]?.trim()));
  const confirmedCount = rows.filter(({ employee }) => displayPayments.paidEmployeeIds.includes(employee.id) && Boolean(displayPayments.references[employee.id]?.trim())).length;
  const totalNet = rows.reduce((sum, row) => sum + row.net, 0);
  const remainingCount = Math.max(rows.length - confirmedCount, 0);

  function storeLocal(next: PaymentState) {
    paymentsRef.current = next;
    setPayments(next);
    window.localStorage.setItem(paymentKey, JSON.stringify(next));
  }

  function clearReferenceTimers() {
    Object.values(referenceTimers.current).forEach((timer) => clearTimeout(timer));
    referenceTimers.current = {};
  }

  async function save(next: PaymentState) {
    storeLocal(next);
    if (sync === "device") return true;
    setSync("saving");
    try {
      const response = await fetch("/api/pilot/payments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCompletionError(payload.error ?? "The payment checklist could not be saved.");
        return false;
      }
      storeLocal(payload.state);
      setApprovalStale(Boolean(payload.approvalStale));
      setSync("workspace");
      return true;
    } catch {
      setSync("device");
      return false;
    }
  }

  function updatePaymentMethod(id: string, method: PaymentMethod) {
    setPaymentMethods((current) => {
      const next = { ...current, [id]: method };
      window.localStorage.setItem(paymentMethodKey, JSON.stringify(next));
      return next;
    });
  }

  function togglePaid(id: string) {
    setCompletionError("");
    const current = paymentsRef.current;
    const paid = current.paidEmployeeIds.includes(id);
    const hasReference = Boolean(current.references[id]?.trim());
    if (!paid && !hasReference) return;
    void save({ ...current, paidEmployeeIds: paid ? current.paidEmployeeIds.filter((item) => item !== id) : [...current.paidEmployeeIds, id], completedAt: null });
  }

  function updateReference(id: string, value: string) {
    setCompletionError("");
    const current = paymentsRef.current;
    const next = { ...current, references: { ...current.references, [id]: value.slice(0, 120) }, completedAt: null };
    storeLocal(next);
    if (sync === "device") return;

    const existingTimer = referenceTimers.current[id];
    if (existingTimer) clearTimeout(existingTimer);
    setSync("saving");

    referenceTimers.current[id] = setTimeout(async () => {
      try {
        const latest = paymentsRef.current;
        const response = await fetch("/api/pilot/payments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ references: latest.references, completedAt: null }),
        });
        if (!response.ok) throw new Error("save failed");
        const payload = await response.json();
        const merged = { ...payload.state, references: paymentsRef.current.references } as PaymentState;
        storeLocal(merged);
        setApprovalStale(Boolean(payload.approvalStale));
        setSync("workspace");
      } catch {
        setSync("device");
      } finally {
        delete referenceTimers.current[id];
      }
    }, referenceSaveDelayMs);
  }

  async function finishPayroll() {
    setCompletionError("");
    if (!payments.approved || approvalInvalid || !allPaid || !allReferences) return;
    clearReferenceTimers();
    const next = { ...paymentsRef.current, completedAt: new Date().toISOString() };
    const saved = await save(next);
    if (saved) router.push("/uat/complete");
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] px-4 py-7 text-[#1a2930] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1557d8] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#647087]">stress free payroll · pay employees</div></div></div>
          <button onClick={() => router.push("/guided-payroll")} className="px-2 py-2 text-sm font-medium text-[#4c5c68] hover:text-[#1a2930]">Back to payroll</button>
        </header>

        <section className="mt-7 rounded-[28px] border border-[#dde6eb] bg-[#ffffff] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#647087]">Employee payments</p><h1 className="mt-2 text-3xl font-semibold">Pay your employees</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#4c5c68]">Pay each employee by business e-transfer or business cheque. Enter the bank confirmation or cheque number, then mark that employee paid. Coffee Payroll keeps the checklist; it does not move the money.</p></div>
            <div className="text-right"><div className="text-xs text-[#647087]">Total employee payments</div><div className="mt-1 font-mono text-2xl font-bold">{cad.format(totalNet)}</div><div className="mt-1 text-xs text-[#647087]">{confirmedCount} of {rows.length} complete</div></div>
          </div>

          {approvalInvalid && <div className="mt-6 rounded-xl border border-[#e6c566] bg-[#fff8e7] px-4 py-3 text-sm font-semibold text-[#7a5d18]">Payroll changed after approval. Return to Review, confirm the updated numbers and approve again before continuing payments.</div>}
          {!approvalInvalid && !payments.approved && <div className="mt-6 rounded-xl border border-[#e6c566] bg-[#fff8e7] px-4 py-3 text-sm text-[#7a5d18]">This payroll has not been approved yet. Return to the guided payroll and approve it before confirming employee payments.</div>}
          {completionError && <div className="mt-6 rounded-xl border border-[#e6c566] bg-[#fff8e7] px-4 py-3 text-sm font-semibold text-[#7a5d18]">{completionError}</div>}

          <div className="mt-6 space-y-3">
            {rows.map(({ employee, net }, index) => {
              const paid = displayPayments.paidEmployeeIds.includes(employee.id);
              const method = paymentMethods[employee.id] ?? "Business e-transfer";
              const referenceLabel = method === "Business cheque" ? "Cheque number" : "Bank confirmation / reference";
              const hasReference = Boolean(displayPayments.references[employee.id]?.trim());
              const enabled = payments.approved && !approvalInvalid;
              return <div key={employee.id} className={`rounded-2xl border p-4 sm:p-5 ${paid && hasReference ? "border-[#cfe4c5] bg-[#f4faf1]" : "border-[#dde6eb] bg-white"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex items-center gap-2"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${paid && hasReference ? "bg-[#eaf5e4] text-[#5f7d4e]" : "bg-[#edf3ff] text-[#1557d8]"}`}>{paid && hasReference ? "✓" : index + 1}</span><div><div className="font-semibold">{employee.name}</div><div className="mt-0.5 text-xs text-[#647087]">{method}{employee.status === "Terminating" || employee.status === "Terminated" ? ` · final pay${employee.terminationDate ? ` · last day ${employee.terminationDate}` : ""}` : ""}</div></div></div></div>
                  <div className="sm:text-right"><div className="text-xs text-[#647087]">Send exactly</div><div className="font-mono text-xl font-bold">{cad.format(net)}</div></div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[180px_1fr_auto] lg:items-end">
                  <label className="text-xs font-semibold text-[#4c5c68]">Payment method<select disabled={!enabled || paid} value={method} onChange={(e) => updatePaymentMethod(employee.id, e.target.value as PaymentMethod)} className="mt-1.5 w-full rounded-xl border border-[#b4c7cc] bg-white px-3 py-2.5 text-sm font-normal text-[#1a2930] outline-none transition focus:border-[#9fb5d6] disabled:bg-[#f5f7fa]"><option>Business e-transfer</option><option>Business cheque</option></select></label>
                  <label className="text-xs font-semibold text-[#4c5c68]">{referenceLabel}<input disabled={!enabled || paid} value={displayPayments.references[employee.id] ?? ""} onChange={(e) => updateReference(employee.id, e.target.value)} placeholder={method === "Business cheque" ? "Enter cheque number" : "Paste or type the bank confirmation"} className="mt-1.5 w-full rounded-xl border border-[#b4c7cc] bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#9fb5d6] disabled:bg-[#f5f7fa]" /></label>
                  <button disabled={!enabled || (!paid && !hasReference)} onClick={() => togglePaid(employee.id)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${paid ? "border border-[#b9d2a9] bg-white text-[#3f6330]" : "bg-[#1557d8] text-white hover:bg-[#0f47b5]"}`}>{paid ? "✓ Paid" : "Mark paid"}</button>
                </div>

                {!paid && enabled && !hasReference && <p className="mt-2 text-xs text-[#647087]">{method === "Business cheque" ? "Enter the cheque number after the cheque is issued." : "Enter the bank confirmation after you send the e-transfer."} Then “Mark paid” will become available.</p>}
                {paid && hasReference && <p className="mt-2 text-xs font-medium text-[#5f7d4e]">Payment confirmed and recorded.</p>}
              </div>;
            })}
          </div>

          <div className="mt-7 flex flex-wrap items-end justify-between gap-4 border-t border-[#e6edf2] pt-6">
            <div><div className="text-sm font-semibold text-[#1a2930]">{remainingCount === 0 && rows.length > 0 ? "All employee payments are confirmed." : `${remainingCount} ${remainingCount === 1 ? "payment" : "payments"} left to confirm.`}</div><div className="mt-1 text-xs text-[#647087]">{sync === "workspace" ? "Checklist saved to your pilot workspace" : sync === "saving" ? "Saving checklist…" : "Checklist saved on this device"}</div></div>
            <button disabled={!payments.approved || approvalInvalid || !allPaid || !allReferences || sync === "saving"} onClick={finishPayroll} className="rounded-xl bg-[#1557d8] px-5 py-3 font-semibold text-white disabled:opacity-35">{allPaid && allReferences ? "Finish payroll" : `Confirmed ${confirmedCount} of ${rows.length}`}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
