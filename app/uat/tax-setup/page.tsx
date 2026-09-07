"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pilotTaxSetupReady, type PilotUatState } from "@/lib/payroll/pilot-uat";

type ReviewChecks = {
  federalTd1: boolean;
  provincialTd1: boolean;
  cppEi: boolean;
  openingYtd: boolean;
};

const emptyChecks: ReviewChecks = { federalTd1: false, provincialTd1: false, cppEi: false, openingYtd: false };

export default function PilotTaxSetupPage() {
  const router = useRouter();
  const [state, setState] = useState<PilotUatState | null>(null);
  const [notice, setNotice] = useState("Loading tax setup…");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, ReviewChecks>>({});

  useEffect(() => {
    fetch("/api/pilot/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sign in to review employee statutory setup.");
        const payload = await response.json();
        const nextState = payload.state as PilotUatState;
        setState(nextState);
        setChecks(Object.fromEntries(nextState.employees
          .filter((employee) => employee.taxSetupReview)
          .map((employee) => [employee.id, {
            federalTd1: employee.taxSetupReview?.federalTd1 === true,
            provincialTd1: employee.taxSetupReview?.provincialTd1 === true,
            cppEi: employee.taxSetupReview?.cppEi === true,
            openingYtd: employee.taxSetupReview?.openingYtd === true,
          }])));
        setNotice("Review statutory setup for every employee that still needs it. Coffee Payroll will keep approval locked until the required reviews are complete.");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load tax setup."));
  }, []);

  const setupEmployees = useMemo(() => state?.employees.filter((employee) =>
    employee.status === "New hire" || employee.taxSetupComplete === false || Boolean(employee.taxSetupReview)
  ) ?? [], [state]);
  const pending = setupEmployees.filter((employee) => !pilotTaxSetupReady(employee));

  function updateCheck(employeeId: string, key: keyof ReviewChecks, checked: boolean) {
    setChecks((current) => ({
      ...current,
      [employeeId]: { ...(current[employeeId] ?? emptyChecks), [key]: checked },
    }));
  }

  function reviewComplete(employeeId: string) {
    const value = checks[employeeId] ?? emptyChecks;
    return Object.values(value).every(Boolean);
  }

  async function markReviewed(employeeId: string) {
    if (!state) return;
    const employee = state.employees.find((item) => item.id === employeeId);
    if (!employee) return;
    if (!reviewComplete(employeeId)) {
      setNotice(`Finish all four statutory checks for ${employee.name} before marking the setup reviewed.`);
      return;
    }
    setSavingId(employeeId);
    setNotice(`Saving ${employee.name}'s statutory setup review…`);
    const review = { ...(checks[employeeId] ?? emptyChecks), reviewedAt: new Date().toISOString() };
    const nextState: PilotUatState = {
      ...state,
      ready: false,
      employees: state.employees.map((item) => item.id === employeeId ? { ...item, taxSetupComplete: true, taxSetupReview: review } : item),
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
      setNotice(`${employee.name}'s statutory setup checkpoint is complete and the review evidence was saved.`);
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
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Employee statutory setup</div>
          <h1 className="mt-2 text-3xl font-semibold">Get every employee payroll-ready</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#795f4f]">Coffee Payroll asks you to confirm the four items that affect an employee’s payroll setup. This includes new hires and employees brought into Coffee Payroll during initial setup. The pilot keeps the review evidence with the employee record without collecting a SIN or copies of TD1 forms.</p>

          <div className="mt-5 rounded-2xl border border-[#d9e2ce] bg-[#f7fbf4] p-4 text-xs leading-5 text-[#53684a]"><strong>Privacy by design:</strong> keep signed TD1 forms and SIN information in your secure employee records. This checkpoint records only the review confirmations and when the review was completed.</div>

          {setupEmployees.length === 0 ? <div className="mt-6 rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] p-5 text-sm text-[#4f6944]">There are no employees waiting for statutory setup.</div> : <div className="mt-6 space-y-4">{setupEmployees.map((employee) => {
            const ready = pilotTaxSetupReady(employee);
            const value = checks[employee.id] ?? emptyChecks;
            const context = employee.status === "New hire" ? "New hire" : "Employee setup";
            return <article key={employee.id} className={`rounded-2xl border p-5 ${ready ? "border-[#cfe0c2] bg-[#f6fbf2]" : "border-[#e3c39f] bg-white"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-semibold">{employee.name}</div><div className="mt-1 text-xs text-[#826b5a]">{context} · {employee.payType} · hired {employee.hireDate ?? "date not set"}</div>{employee.taxSetupReview?.reviewedAt && <div className="mt-1 text-xs text-[#6d7d62]">Reviewed {new Date(employee.taxSetupReview.reviewedAt).toLocaleString("en-CA")}</div>}</div>{ready && <span className="w-fit rounded-full bg-[#e8efdf] px-3 py-1.5 text-xs font-semibold text-[#3d5a2f]">✓ Statutory setup reviewed</span>}</div>

              {!ready && <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <CheckRow checked={value.federalTd1} onChange={(checked) => updateCheck(employee.id, "federalTd1", checked)} title="Federal TD1 reviewed" detail="Confirm the employee’s federal claim information." />
                <CheckRow checked={value.provincialTd1} onChange={(checked) => updateCheck(employee.id, "provincialTd1", checked)} title="Alberta TD1 reviewed" detail="Confirm the provincial claim information." />
                <CheckRow checked={value.cppEi} onChange={(checked) => updateCheck(employee.id, "cppEi", checked)} title="CPP and EI status reviewed" detail="Confirm whether normal CPP and EI deductions apply." />
                <CheckRow checked={value.openingYtd} onChange={(checked) => updateCheck(employee.id, "openingYtd", checked)} title="Prior payroll reviewed" detail="Confirm opening YTD amounts were entered, or that none apply." />
              </div>}

              {!ready && <button disabled={savingId === employee.id || !reviewComplete(employee.id)} onClick={() => markReviewed(employee.id)} className="mt-5 rounded-xl bg-[#5a321f] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{savingId === employee.id ? "Saving…" : "Complete statutory setup"}</button>}
            </article>;
          })}</div>}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd4] pt-6"><span className="text-sm text-[#795f4f]">{pending.length === 0 ? "All required employee statutory checkpoints are complete." : `${pending.length} employee${pending.length === 1 ? "" : "s"} still need statutory setup.`}</span><button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white">Return to payroll</button></div>
        </section>
      </div>
    </main>
  );
}

function CheckRow({ checked, onChange, title, detail }: { checked: boolean; onChange: (checked: boolean) => void; title: string; detail: string }) {
  return <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${checked ? "border-[#cfe0c2] bg-[#f7fbf4]" : "border-[#eadfd4] bg-[#fffaf5]"}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-[#5a321f]" /><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-[#826b5a]">{detail}</span></span></label>;
}
