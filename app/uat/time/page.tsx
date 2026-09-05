"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  name: string;
  payType: "Salary" | "Hourly";
  rate: number;
  status: "Active" | "New hire" | "Terminating" | "Terminated";
};
type Timesheet = { regular: number; overtime: number; vacation: number };
type WorkspaceState = { employees: Employee[]; timesheets: Record<string, Timesheet>; ready: boolean };
type SaveMode = "loading" | "workspace" | "saving" | "device" | "error";

const storageKey = "coffee-payroll:pilot-uat";

export default function GuidedTimeEntryPage() {
  const router = useRouter();
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [businessName, setBusinessName] = useState("My business");
  const [mode, setMode] = useState<SaveMode>("loading");
  const [notice, setNotice] = useState("Loading this payroll’s hours…");
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hourly = useMemo(() => state?.employees.filter((employee) => employee.payType === "Hourly" && employee.status !== "Terminated") ?? [], [state]);
  const salaryCount = useMemo(() => state?.employees.filter((employee) => employee.payType === "Salary" && employee.status !== "Terminated").length ?? 0, [state]);
  const completeRows = useMemo(() => hourly.filter((employee) => {
    const row = state?.timesheets[employee.id];
    return Boolean(row && row.regular >= 0 && row.overtime >= 0 && row.vacation >= 0);
  }).length, [hourly, state]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (!response.ok) throw new Error("workspace unavailable");
        const payload = await response.json();
        if (cancelled) return;
        setState(payload.state);
        setBusinessName(payload.profile?.businessName ?? "My business");
        setMode("workspace");
        setNotice("Only the people who need hours are shown here.");
      } catch {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (raw && !cancelled) setState(JSON.parse(raw));
        } catch { /* starter state is supplied by the workspace elsewhere */ }
        if (!cancelled) {
          setMode("device");
          setNotice("Hours are being saved on this device for now.");
        }
      } finally {
        hydrated.current = true;
      }
    }
    load();
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    if (!hydrated.current || !state) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    if (mode === "device" || mode === "error" || mode === "loading") return;
    if (timer.current) clearTimeout(timer.current);
    setMode("saving");
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/pilot/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!response.ok) throw new Error("save failed");
        setMode("workspace");
      } catch {
        setMode("error");
        setNotice("The workspace save needs attention. Your latest hours remain saved on this device.");
      }
    }, 500);
  }, [state, mode]);

  function updateTime(id: string, field: keyof Timesheet, value: string) {
    const number = Number(value);
    setState((current) => current ? {
      ...current,
      ready: false,
      timesheets: {
        ...current.timesheets,
        [id]: { ...(current.timesheets[id] ?? { regular: 0, overtime: 0, vacation: 0 }), [field]: Number.isFinite(number) && number >= 0 ? number : 0 },
      },
    } : current);
    setNotice("Hours changed. Coffee Payroll will recalculate before review.");
  }

  function markReady() {
    if (!state || completeRows !== hourly.length) return;
    setState({ ...state, ready: true });
    setNotice("Hours and pay are ready. You can continue to payroll review.");
  }

  if (!state) return <main className="min-h-screen bg-[#f4eadf] px-4 py-8 text-[#332118]"><div className="mx-auto max-w-4xl rounded-2xl border border-[#decdbd] bg-[#fffaf5] p-6">{notice}</div></main>;

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div><div><div className="text-2xl font-semibold">Coffee Payroll</div><div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · hours & pay</div></div></div>
          <button onClick={() => router.push("/guided-payroll")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Back to payroll</button>
        </header>

        <section className="mt-7 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Step 3 · Hours & pay</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-3xl font-semibold">{hourly.length === 0 ? "No hours to enter this pay" : `Only ${hourly.length} ${hourly.length === 1 ? "person needs" : "people need"} hours this pay`}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#795f4f]">{salaryCount > 0 ? `${salaryCount} salaried ${salaryCount === 1 ? "employee is" : "employees are"} already carried forward automatically. ` : ""}Enter regular, overtime and vacation hours only for the hourly employees below.</p></div>
            <div className="rounded-2xl bg-[#f3e6da] px-4 py-3 text-right"><div className="text-xs text-[#806858]">{businessName}</div><div className="mt-1 text-sm font-semibold">{state.ready ? "✓ Hours ready" : `${completeRows} of ${hourly.length} checked`}</div></div>
          </div>

          <div className="mt-6 space-y-4">
            {hourly.map((employee) => {
              const row = state.timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
              return <div key={employee.id} className="rounded-2xl border border-[#e2d4c8] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">{employee.name}</div><div className="mt-1 text-xs text-[#806858]">Hourly · ${employee.rate.toFixed(2)}/hr{employee.status === "New hire" ? " · New hire" : employee.status === "Terminating" ? " · Leaving" : ""}</div></div><span className="rounded-full bg-[#fff8e7] px-3 py-1 text-xs font-semibold text-[#725a22]">Hours needed</span></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(["regular", "overtime", "vacation"] as const).map((field) => <label key={field} className="text-xs font-semibold text-[#745948]">{field === "regular" ? "Regular hours" : field === "overtime" ? "Overtime hours" : "Vacation hours"}<input value={row[field]} onChange={(event) => updateTime(employee.id, field, event.target.value)} type="number" min="0" step="0.25" className="mt-1.5 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5 text-base font-normal" /></label>)}
                </div>
              </div>;
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-[#d8e5ce] bg-[#f7fbf4] px-5 py-4 text-sm text-[#4f6944]">Regular salary and the payroll setup you already confirmed carry forward automatically. You only need to touch the exceptions.</div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd4] pt-5">
            <span className="text-xs text-[#806858]">{mode === "workspace" ? "Saved to your pilot workspace" : mode === "saving" ? "Saving hours…" : mode === "device" ? "Saved on this device" : mode === "error" ? "Workspace save needs attention" : "Loading…"}</span>
            <button onClick={state.ready ? () => router.push("/guided-payroll") : markReady} disabled={completeRows !== hourly.length} className="rounded-xl bg-[#5a321f] px-5 py-3 font-semibold text-white disabled:opacity-35">{state.ready ? "Continue to review" : "Yes, hours are complete"}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
