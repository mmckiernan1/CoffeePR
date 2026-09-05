"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GuidedPayrollRun, type GuidedPayrollEmployee } from "@/components/comcheq";
import { calculateAlbertaPayroll } from "@/lib/payroll/statutory/calculate";
import { dollarsToCents } from "@/lib/payroll/money";

type UatEmployee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  status: "Active" | "New hire";
};

type Timesheet = { regular: number; overtime: number; vacation: number };
type UatState = { employees: UatEmployee[]; timesheets: Record<string, Timesheet>; ready: boolean };
type PilotProfile = { businessName: string; province: string; frequency: string; employeeCount: number };

type CalculatedEmployee = UatEmployee & {
  gross: number;
  tax: number;
  cpp: number;
  cpp2: number;
  ei: number;
  net: number;
  employerCpp: number;
  employerEi: number;
};

const localStorageKey = "coffee-payroll:pilot-uat";

const starterState: UatState = {
  employees: [
    { id: "EMP-0001", name: "Avery Chen", payType: "Salary", rate: 80000, status: "Active" },
    { id: "EMP-0002", name: "Noah Williams", payType: "Hourly", rate: 30, status: "Active" },
    { id: "EMP-0003", name: "Priya Singh", payType: "Salary", rate: 111000, status: "Active" },
    { id: "EMP-0004", name: "Liam Martin", payType: "Hourly", rate: 29.5, status: "Active" },
  ],
  timesheets: {
    "EMP-0002": { regular: 80, overtime: 2.5, vacation: 0 },
    "EMP-0004": { regular: 72, overtime: 0, vacation: 0 },
  },
  ready: false,
};

const baselineYtd: Record<string, { pensionableEarningsCents: number; cppCents: number; cpp2Cents: number; eiCents: number }> = {
  "EMP-0001": { pensionableEarningsCents: 4_923_072, cppCents: 280_000, cpp2Cents: 0, eiCents: 80_000 },
  "EMP-0002": { pensionableEarningsCents: 3_600_000, cppCents: 210_000, cpp2Cents: 0, eiCents: 58_000 },
  "EMP-0003": { pensionableEarningsCents: 6_826_923, cppCents: 390_000, cpp2Cents: 0, eiCents: 111_000 },
  "EMP-0004": { pensionableEarningsCents: 2_900_000, cppCents: 165_000, cpp2Cents: 0, eiCents: 47_000 },
};

function periodsPerYear(frequency: string): 12 | 24 | 26 | 52 {
  if (frequency === "Weekly") return 52;
  if (frequency === "Semi-monthly") return 24;
  if (frequency === "Monthly") return 12;
  return 26;
}

function grossFor(employee: UatEmployee, timesheets: Record<string, Timesheet>, frequency: string) {
  if (employee.payType === "Salary") return employee.rate / periodsPerYear(frequency);
  const row = timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
  return row.regular * employee.rate + row.overtime * employee.rate * 1.5 + row.vacation * employee.rate;
}

function calculateEmployee(employee: UatEmployee, timesheets: Record<string, Timesheet>, frequency: string): CalculatedEmployee {
  const gross = grossFor(employee, timesheets, frequency);
  const ytd = baselineYtd[employee.id] ?? { pensionableEarningsCents: 0, cppCents: 0, cpp2Cents: 0, eiCents: 0 };
  const ppy = periodsPerYear(frequency);
  const result = calculateAlbertaPayroll({
    payDate: "2026-09-04",
    province: "AB",
    incomePath: "regular-periodic",
    payPeriodsPerYear: ppy,
    periodsRemainingIncludingCurrent: Math.max(1, Math.round(ppy * 0.33)),
    cashEarningsCents: dollarsToCents(gross.toFixed(2)),
    federalClaimCents: 1_645_200,
    albertaClaimCents: 2_276_900,
    yearToDate: ytd,
  });

  return {
    ...employee,
    gross,
    tax: result.deductions.incomeTaxCents / 100,
    cpp: result.deductions.cppCents / 100,
    cpp2: result.deductions.cpp2Cents / 100,
    ei: result.deductions.eiCents / 100,
    net: result.netPayCents / 100,
    employerCpp: result.employerContributions.cppCents / 100,
    employerEi: result.employerContributions.eiCents / 100,
  };
}

export default function GuidedPayrollPreviewPage() {
  const router = useRouter();
  const [approved, setApproved] = useState(false);
  const [state, setState] = useState<UatState>(starterState);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [loadedFrom, setLoadedFrom] = useState<"loading" | "workspace" | "device">("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadPilot() {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (cancelled) return;
          setState(payload.state);
          setProfile(payload.profile);
          setLoadedFrom("workspace");
          return;
        }
      } catch {
        // Fall through to the device copy used by UAT before hosted auth/storage is configured.
      }

      try {
        const raw = window.localStorage.getItem(localStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as UatState;
          if (Array.isArray(parsed.employees) && parsed.timesheets) setState(parsed);
        }
      } catch {
        // Starter fictional data remains available for preview.
      }
      if (!cancelled) setLoadedFrom("device");
    }

    loadPilot();
    return () => { cancelled = true; };
  }, []);

  const calculated = useMemo(() => {
    if (profile.province !== "Alberta") return [] as CalculatedEmployee[];
    return state.employees.map((employee) => calculateEmployee(employee, state.timesheets, profile.frequency));
  }, [state, profile]);

  const totals = useMemo(() => calculated.reduce((result, employee) => ({
    gross: result.gross + employee.gross,
    tax: result.tax + employee.tax,
    cpp: result.cpp + employee.cpp + employee.cpp2,
    ei: result.ei + employee.ei,
    net: result.net + employee.net,
    employerCpp: result.employerCpp + employee.employerCpp,
    employerEi: result.employerEi + employee.employerEi,
  }), { gross: 0, tax: 0, cpp: 0, ei: 0, net: 0, employerCpp: 0, employerEi: 0 }), [calculated]);

  const remittance = totals.tax + totals.cpp + totals.employerCpp + totals.ei + totals.employerEi;
  const employees: GuidedPayrollEmployee[] = calculated.map((employee) => {
    const row = state.timesheets[employee.id];
    const detail = employee.payType === "Hourly"
      ? `${employee.status === "New hire" ? "New hire · " : ""}${row?.regular ?? 0} regular · ${row?.overtime ?? 0} OT · $${employee.rate.toFixed(2)}/hr`
      : `${employee.status === "New hire" ? "New hire · " : ""}$${employee.rate.toLocaleString("en-CA")}/yr · regular salary carries forward`;
    return { name: employee.name, payType: employee.payType, detail, netPay: employee.net };
  });

  const openWorkspace = (workspace: "employees" | "time" | "payments" | "reports") => {
    if (workspace === "employees" || workspace === "time") {
      router.push("/uat");
      return;
    }
    router.push(`/?workspace=${workspace}`);
  };

  const supported = profile.province === "Alberta";

  return (
    <main className="min-h-screen bg-[#f4eadf] text-[#332118]">
      <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-7 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#decdbd] bg-[#fffaf5] px-4 py-3 text-xs text-[#795f4f]">
          <div>
            <strong className="text-[#332118]">{profile.businessName} · Run payroll</strong>
            <span className="ml-2">Run 17 · August 16–31 · Pay date September 4, 2026</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-[#d6c6b8] bg-white px-3 py-2 font-semibold text-[#6b4a36]">{loadedFrom === "workspace" ? "UAT workspace synced" : loadedFrom === "device" ? "Using saved UAT on this device" : "Loading UAT…"}</span>
            <span className={`rounded-lg px-3 py-2 font-semibold ${state.ready ? "bg-[#e8efdf] text-[#3d5a2f]" : "bg-[#f3e6da] text-[#7b543d]"}`}>Time: {state.ready ? "Ready" : "Needs work"}</span>
            {approved && <span className="rounded-lg bg-[#e8efdf] px-3 py-2 font-semibold text-[#3d5a2f]">Approved</span>}
          </div>
        </div>

        {!supported && (
          <div className="mb-5 rounded-xl border border-[#e2b999] bg-[#fff6ec] px-4 py-3 text-sm text-[#714a32]">
            This pilot calculation engine is currently validated for Alberta. Change the pilot province to Alberta before running calculation UAT.
          </div>
        )}

        {supported && (
          <GuidedPayrollRun
            runKey="2026-17-pilot"
            approved={approved}
            timeReady={state.ready}
            employees={employees}
            gross={totals.gross}
            net={totals.net}
            remittance={remittance}
            fee={18}
            onHome={() => router.push("/")}
            onOpenEmployees={() => openWorkspace("employees")}
            onOpenTime={() => openWorkspace("time")}
            onOpenReview={() => router.push("/uat/review")}
            onApprove={() => setApproved(true)}
            onOpenPayments={() => openWorkspace("payments")}
            onOpenReports={() => openWorkspace("reports")}
          />
        )}
      </div>
    </main>
  );
}
