"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GuidedPayrollRun, type GuidedPayrollEmployee } from "@/components/comcheq";

const sourceEmployees = [
  { name: "Avery Chen", role: "Operations Manager", payType: "Salary", gross: 3076.92, tax: 588.34, cpp: 177.62, ei: 50.15, other: 120 },
  { name: "Noah Williams", role: "Field Technician", payType: "Hourly", gross: 2632.5, tax: 439.15, cpp: 151.17, ei: 42.91, other: 62.5 },
  { name: "Priya Singh", role: "Finance Lead", payType: "Salary", gross: 4269.23, tax: 931.44, cpp: 245.87, ei: 69.59, other: 255 },
  { name: "Liam Martin", role: "Customer Support", payType: "Hourly", gross: 2124, tax: 319.12, cpp: 122.24, ei: 34.62, other: 0 },
] as const;

export default function GuidedPayrollPreviewPage() {
  const router = useRouter();
  const [approved, setApproved] = useState(false);
  const [timeReady, setTimeReady] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const totals = useMemo(() => sourceEmployees.reduce((result, employee) => {
    const net = employee.gross - employee.tax - employee.cpp - employee.ei - employee.other;
    return {
      gross: result.gross + employee.gross,
      tax: result.tax + employee.tax,
      cpp: result.cpp + employee.cpp,
      ei: result.ei + employee.ei,
      net: result.net + net,
    };
  }, { gross: 0, tax: 0, cpp: 0, ei: 0, net: 0 }), []);

  const remittance = totals.tax + totals.cpp * 2 + totals.ei * 2.4;
  const employees: GuidedPayrollEmployee[] = sourceEmployees.map((employee) => ({
    name: employee.name,
    payType: employee.payType,
    detail: employee.payType === "Hourly" ? `${employee.role} · enter hours for this pay` : `${employee.role} · regular salary continues`,
    netPay: employee.gross - employee.tax - employee.cpp - employee.ei - employee.other,
  }));

  function show(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-[#172033]">
      <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-7 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce4f0] bg-white px-4 py-3 text-xs text-[#647087]">
          <div><strong className="text-[#172033]">Guided payroll preview</strong><span className="ml-2">Run 17 · August 16–31 · Pay date September 4, 2026</span></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setTimeReady((value) => !value)} className="rounded-lg border border-[#c9d5e6] bg-white px-3 py-2 font-semibold text-[#17428e]">Time: {timeReady ? "Ready" : "Needs work"}</button>
            <button type="button" onClick={() => setApproved(false)} className="rounded-lg border border-[#c9d5e6] bg-white px-3 py-2 font-semibold text-[#17428e]">Reset approval</button>
          </div>
        </div>

        {notice && <div className="mb-4 rounded-xl border border-[#b9cef2] bg-[#edf3ff] px-4 py-3 text-sm font-medium text-[#17428e]">{notice}</div>}

        <GuidedPayrollRun
          approved={approved}
          timeReady={timeReady}
          employees={employees}
          gross={totals.gross}
          net={totals.net}
          remittance={remittance}
          fee={18}
          onHome={() => router.push("/")}
          onOpenEmployees={() => show("Employee workspace handoff")}
          onOpenTime={() => show("Time-entry workspace handoff")}
          onOpenReview={() => show("Detailed payroll review handoff")}
          onApprove={() => setApproved(true)}
          onOpenPayments={() => show("Employee-payment workspace handoff")}
          onOpenReports={() => show("Reports & statements handoff")}
        />
      </div>
    </main>
  );
}
