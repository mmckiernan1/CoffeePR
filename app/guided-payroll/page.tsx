"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GuidedPayrollRun, type GuidedPayrollEmployee } from "@/components/comcheq";
import {
  PILOT_STARTER_STATE,
  PILOT_UAT_STORAGE_KEY,
  pilotCalculateEmployee,
  pilotChangeSummary,
  pilotEmployeeIsInRun,
  pilotTaxSetupReady,
  type PilotProfile,
  type PilotUatState,
} from "@/lib/payroll/pilot-uat";

type PaymentState = { approved: boolean; paidEmployeeIds: string[]; references: Record<string, string>; completedAt: string | null };

const paymentStorageKey = "coffee-payroll:pilot-payments";
const emptyPayments: PaymentState = { approved: false, paidEmployeeIds: [], references: {}, completedAt: null };

export default function GuidedPayrollPreviewPage() {
  const router = useRouter();
  const [state, setState] = useState<PilotUatState>(PILOT_STARTER_STATE);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [payments, setPayments] = useState<PaymentState>(emptyPayments);
  const [loadedFrom, setLoadedFrom] = useState<"loading" | "workspace" | "device">("loading");
  const [approvalError, setApprovalError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPilot() {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (!cancelled) {
            setState(payload.state);
            setProfile(payload.profile);
            setLoadedFrom("workspace");
          }
        } else {
          throw new Error("workspace unavailable");
        }
      } catch {
        try {
          const raw = window.localStorage.getItem(PILOT_UAT_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as PilotUatState;
            if (Array.isArray(parsed.employees) && parsed.timesheets) setState(parsed);
          }
        } catch {
          // Starter fictional data remains available for preview.
        }
        if (!cancelled) setLoadedFrom("device");
      }

      try {
        const paymentResponse = await fetch("/api/pilot/payments", { cache: "no-store" });
        if (paymentResponse.ok) {
          const payload = await paymentResponse.json();
          if (!cancelled) setPayments(payload.state);
        } else {
          const raw = window.localStorage.getItem(paymentStorageKey);
          if (raw && !cancelled) setPayments(JSON.parse(raw));
        }
      } catch {
        try {
          const raw = window.localStorage.getItem(paymentStorageKey);
          if (raw && !cancelled) setPayments(JSON.parse(raw));
        } catch {
          // Keep clean payment state.
        }
      }
    }

    loadPilot();
    return () => { cancelled = true; };
  }, []);

  const includedEmployees = useMemo(() => state.employees.filter(pilotEmployeeIsInRun), [state.employees]);
  const lifecycleChanges = useMemo(() => state.employees.filter((employee) => pilotChangeSummary(employee)), [state.employees]);
  const pendingTaxSetup = useMemo(() => includedEmployees.filter((employee) => !pilotTaxSetupReady(employee)), [includedEmployees]);

  const calculated = useMemo(() => {
    if (profile.province !== "Alberta") return [];
    return includedEmployees.map((employee) => pilotCalculateEmployee(employee, state.timesheets, profile.frequency));
  }, [includedEmployees, state.timesheets, profile]);

  const totals = useMemo(() => calculated.reduce((result, employee) => ({
    gross: result.gross + employee.gross,
    tax: result.tax + employee.incomeTax,
    cpp: result.cpp + employee.cpp + employee.cpp2,
    ei: result.ei + employee.ei,
    net: result.net + employee.net,
    employerCpp: result.employerCpp + employee.employerCpp,
    employerEi: result.employerEi + employee.employerEi,
  }), { gross: 0, tax: 0, cpp: 0, ei: 0, net: 0, employerCpp: 0, employerEi: 0 }), [calculated]);

  const remittance = totals.tax + totals.cpp + totals.employerCpp + totals.ei + totals.employerEi;
  const employees: GuidedPayrollEmployee[] = calculated.map((employee) => {
    const row = state.timesheets[employee.id];
    const lifecycle = pilotChangeSummary(employee);
    const finalPayTotal = (employee.finalPay?.vacationPay ?? 0) + (employee.finalPay?.overtimePay ?? 0) + (employee.finalPay?.otherTaxablePay ?? 0) + (employee.finalPay?.reimbursement ?? 0);
    const ordinary = employee.payType === "Hourly"
      ? `${row?.regular ?? 0} regular · ${row?.overtime ?? 0} OT · $${employee.rate.toFixed(2)}/hr`
      : `$${employee.rate.toLocaleString("en-CA")}/yr · regular salary carries forward`;
    const detail = [lifecycle, ordinary, finalPayTotal > 0 ? `Final-pay items $${finalPayTotal.toFixed(2)}` : ""].filter(Boolean).join(" · ");
    return {
      id: employee.id,
      name: employee.name,
      payType: employee.payType,
      detail,
      netPay: employee.net,
      status: employee.status,
      changeLabel: lifecycle || undefined,
      needsAttention: Boolean(lifecycle),
    };
  });

  const openWorkspace = (workspace: "employees" | "time" | "review" | "payments" | "reports") => {
    if (workspace === "employees") return router.push("/uat/lifecycle");
    if (workspace === "time") return router.push("/uat/time");
    if (workspace === "review") return router.push("/uat/review");
    if (workspace === "payments") return router.push("/uat/payments");
    router.push(`/?workspace=${workspace}`);
  };

  async function approvePayroll() {
    setApprovalError("");
    if (pendingTaxSetup.length > 0) {
      setApprovalError("New-hire tax setup needs to be reviewed before this payroll can be approved.");
      router.push("/uat/tax-setup");
      return;
    }
    try {
      const response = await fetch("/api/pilot/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true, completedAt: null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPayments((current) => ({ ...current, approved: false, completedAt: null }));
        setApprovalError(payload.error ?? "Payroll could not be approved yet.");
        if (payload.code === "NEW_HIRE_TAX_SETUP_REQUIRED") router.push("/uat/tax-setup");
        return;
      }
      setPayments(payload.state);
      window.localStorage.setItem(paymentStorageKey, JSON.stringify(payload.state));
    } catch {
      setPayments((current) => ({ ...current, approved: false, completedAt: null }));
      setApprovalError("Approval could not be saved. Try again when the workspace connection is available.");
    }
  }

  const supported = profile.province === "Alberta";
  const paymentsComplete = Boolean(payments.approved && payments.completedAt);

  return (
    <main className="min-h-screen bg-[#f4eadf] text-[#332118]">
      <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-7 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#decdbd] bg-[#fffaf5] px-4 py-3 text-xs text-[#795f4f]">
          <div>
            <strong className="text-[#332118]">{profile.businessName} · Run payroll</strong>
            <span className="ml-2">Run 17 · August 16–31 · Pay date September 4, 2026</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-[#d6c6b8] bg-white px-3 py-2 font-semibold text-[#6b4a36]">{loadedFrom === "workspace" ? "Workspace synced" : loadedFrom === "device" ? "Saved on this device" : "Loading payroll…"}</span>
            {lifecycleChanges.length > 0 && <button onClick={() => router.push("/uat/lifecycle")} className="rounded-lg bg-[#fff0dc] px-3 py-2 font-semibold text-[#7b4b23]">{lifecycleChanges.length} employee change{lifecycleChanges.length === 1 ? "" : "s"}</button>}
            <span className={`rounded-lg px-3 py-2 font-semibold ${state.ready ? "bg-[#e8efdf] text-[#3d5a2f]" : "bg-[#f3e6da] text-[#7b543d]"}`}>Hours: {state.ready ? "Ready" : "Needs work"}</span>
            {payments.approved && <span className="rounded-lg bg-[#e8efdf] px-3 py-2 font-semibold text-[#3d5a2f]">Approved</span>}
            {paymentsComplete && <button onClick={() => router.push("/uat/complete")} className="rounded-lg bg-[#5a321f] px-3 py-2 font-semibold text-white">Completed</button>}
          </div>
        </div>

        {pendingTaxSetup.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2b999] bg-[#fff6ec] px-4 py-3 text-sm text-[#714a32]">
            <div><strong>{pendingTaxSetup.length} new hire{pendingTaxSetup.length === 1 ? " needs" : "s need"} tax setup review before approval.</strong><div className="mt-1 text-xs">Coffee Payroll will keep approval locked until the checkpoint is complete.</div></div>
            <button onClick={() => router.push("/uat/tax-setup")} className="rounded-lg bg-[#5a321f] px-4 py-2 text-xs font-semibold text-white">Review tax setup</button>
          </div>
        )}

        {approvalError && <div className="mb-5 rounded-xl border border-[#d89b6c] bg-[#fff0dc] px-4 py-3 text-sm font-semibold text-[#75451f]">{approvalError}</div>}

        {!supported && (
          <div className="mb-5 rounded-xl border border-[#e2b999] bg-[#fff6ec] px-4 py-3 text-sm text-[#714a32]">
            Coffee Payroll&apos;s current calculation pack is validated for Alberta. Change the business province to Alberta before running this payroll.
          </div>
        )}

        {supported && (
          <GuidedPayrollRun
            runKey="2026-17-pilot"
            approved={payments.approved}
            paymentsComplete={paymentsComplete}
            timeReady={state.ready}
            employees={employees}
            net={totals.net}
            remittance={remittance}
            fee={18}
            onHome={() => router.push("/")}
            onOpenEmployees={() => openWorkspace("employees")}
            onOpenTime={() => openWorkspace("time")}
            onOpenReview={() => openWorkspace("review")}
            onApprove={approvePayroll}
            onOpenPayments={() => openWorkspace("payments")}
            onOpenReports={() => openWorkspace("reports")}
          />
        )}
      </div>
    </main>
  );
}
