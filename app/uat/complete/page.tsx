"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentState = { approved: boolean; paidEmployeeIds: string[]; references: Record<string, string>; completedAt: string | null };
type UatEmployee = { id: string; name: string; payType: "Salary" | "Hourly"; rate: number; status: "Active" | "New hire" };
type UatState = { employees: UatEmployee[]; timesheets: Record<string, { regular: number; overtime: number; vacation: number }>; ready: boolean };
type PilotProfile = { businessName: string; province: string; frequency: string; employeeCount: number };

const paymentKey = "coffee-payroll:pilot-payments";
const uatKey = "coffee-payroll:pilot-uat";

export default function PilotCompletePage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentState>({ approved: false, paidEmployeeIds: [], references: {}, completedAt: null });
  const [uat, setUat] = useState<UatState | null>(null);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [paymentResponse, workspaceResponse] = await Promise.all([
          fetch("/api/pilot/payments", { cache: "no-store" }),
          fetch("/api/pilot/workspace", { cache: "no-store" }),
        ]);
        if (paymentResponse.ok) {
          const data = await paymentResponse.json();
          if (!cancelled) setPayments(data.state);
        } else {
          const raw = window.localStorage.getItem(paymentKey);
          if (raw && !cancelled) setPayments(JSON.parse(raw));
        }
        if (workspaceResponse.ok) {
          const data = await workspaceResponse.json();
          if (!cancelled) { setUat(data.state); setProfile(data.profile); }
        } else {
          const raw = window.localStorage.getItem(uatKey);
          if (raw && !cancelled) setUat(JSON.parse(raw));
        }
      } catch {
        try {
          const payRaw = window.localStorage.getItem(paymentKey);
          const uatRaw = window.localStorage.getItem(uatKey);
          if (payRaw && !cancelled) setPayments(JSON.parse(payRaw));
          if (uatRaw && !cancelled) setUat(JSON.parse(uatRaw));
        } catch {
          // Keep safe empty state.
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const employeeCount = uat?.employees.length ?? 0;
  const paidCount = useMemo(() => {
    if (!uat) return payments.paidEmployeeIds.length;
    return uat.employees.filter((employee) => payments.paidEmployeeIds.includes(employee.id)).length;
  }, [uat, payments]);
  const complete = Boolean(payments.approved && payments.completedAt && employeeCount > 0 && paidCount === employeeCount);

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-10 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll</div></div></div>

        <section className="mt-8 rounded-[30px] border border-[#decdbd] bg-[#fffaf5] p-7 text-center shadow-[0_24px_70px_rgba(72,42,24,0.12)] sm:p-10">
          {complete ? (
            <>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#e8efdf] text-4xl text-[#3d5a2f]">✓</div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight">You did your payroll.</h1>
              <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-[#745948]">{profile.businessName}’s Run 17 is approved and every employee payment has been confirmed.</p>
              <div className="mx-auto mt-7 grid max-w-xl gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#e2d5c9] bg-white p-4"><div className="text-xs text-[#856f60]">Employees</div><div className="mt-1 text-2xl font-bold">{employeeCount}</div></div>
                <div className="rounded-2xl border border-[#cfe0c2] bg-[#f6fbf2] p-4"><div className="text-xs text-[#5e7651]">Paid</div><div className="mt-1 text-2xl font-bold text-[#3d5a2f]">{paidCount}</div></div>
                <div className="rounded-2xl border border-[#e2d5c9] bg-white p-4"><div className="text-xs text-[#856f60]">Status</div><div className="mt-1 text-lg font-bold">Complete</div></div>
              </div>
              <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-[#806858]">Coffee Payroll has recorded the UAT payment checklist and references. The business owner remains in control of the actual e-transfers through their bank.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3"><button onClick={() => router.push("/?workspace=reports")} className="rounded-xl border border-[#d6c6b8] bg-white px-5 py-3 font-semibold">Reports & statements</button><button onClick={() => router.push("/")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Back to main menu</button></div>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f3e6da] text-3xl">…</div>
              <h1 className="mt-6 text-3xl font-semibold">Payroll is not finished yet</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#745948]">Approval and every employee payment must be confirmed before Coffee Payroll marks the run complete.</p>
              <div className="mt-7 flex justify-center"><button onClick={() => router.push("/uat/payments")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Return to employee payments</button></div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
