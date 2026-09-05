"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pilotTaxSetupReady, type PilotUatState } from "@/lib/payroll/pilot-uat";

export default function PilotTaxSetupPage() {
  const router = useRouter();
  const [state, setState] = useState<PilotUatState | null>(null);
  const [notice, setNotice] = useState("Loading tax setup…");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pilot/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sign in to review new-hire tax setup.");
        const payload = await response.json();
        setState(payload.state);
        setNotice("Review each new hire before payroll approval.");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load tax setup."));
  }, []);

  const newHires = useMemo(() => state?.employees.filter((employee) => employee.status === "New hire") ?? [], [state]);
  const pending = newHires.filter((employee) => !pilotTaxSetupReady(employee));

  async function markReviewed(employeeId: string) {
    if (!state) return;
    const employee = state.employees.find((item) => item.id === employeeId);
    if (!employee) return;
    setSavingId(employeeId);
    setNotice(`Saving ${employee.name}'s tax setup review…`);
    const nextState: PilotUatState = {
      ...state,
      ready: false,
      employees: state.employees.map((item) => item.id === employeeId ? { ...item, taxSetupComplete: true } : item),
    };
    try {
      const response = await fetch("/api/pilot/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: nextState }),
      });
      if (!response.ok) throw new Error("Unable to save tax setup review.");
      const payload = await response.json();
      setState(payload.state);
      setNotice(`${employee.name}'s pilot tax setup has been reviewed.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save tax setup review.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · tax setup</div></div></div>
          <button onClick={() => router.push("/guided-payroll")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Back to payroll</button>
        </header>

        <div className="mt-6 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] px-5 py-4 text-sm text-[#714a32]">{notice}</div>

        <section className="mt-6 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">New hire checkpoint</div>
          <h1 className="mt-2 text-3xl font-semibold">Tax setup before approval</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#795f4f]">Coffee Payroll will not approve a payroll containing a new hire until their tax setup has been reviewed. In this pilot, this checkpoint confirms that TD1 information and any opening year-to-date amounts were reviewed. It does not replace the full production tax-setup workflow.</p>

          {newHires.length === 0 ? <div className="mt-6 rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] p-5 text-sm text-[#4f6944]">There are no new hires in this payroll.</div> : <div className="mt-6 space-y-3">{newHires.map((employee) => {
            const ready = pilotTaxSetupReady(employee);
            return <div key={employee.id} className={`rounded-2xl border p-5 ${ready ? "border-[#cfe0c2] bg-[#f6fbf2]" : "border-[#e3c39f] bg-white"}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{employee.name}</div><div className="mt-1 text-xs text-[#826b5a]">New hire · {employee.payType} · hired {employee.hireDate ?? "date not set"}</div></div>{ready ? <span className="rounded-full bg-[#e8efdf] px-3 py-1.5 text-xs font-semibold text-[#3d5a2f]">✓ Tax setup reviewed</span> : <button disabled={savingId === employee.id} onClick={() => markReviewed(employee.id)} className="rounded-xl bg-[#5a321f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{savingId === employee.id ? "Saving…" : "Mark tax setup reviewed"}</button>}</div></div>;
          })}</div>}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd4] pt-6"><span className="text-sm text-[#795f4f]">{pending.length === 0 ? "All new-hire tax setup checkpoints are complete." : `${pending.length} new hire${pending.length === 1 ? "" : "s"} still need tax setup review.`}</span><button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Return to payroll</button></div>
        </section>
      </div>
    </main>
  );
}
