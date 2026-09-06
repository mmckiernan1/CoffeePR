"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pilotHourlyRateForSegment, pilotHourlyRateSegmentDates } from "@/lib/payroll/pilot-hourly-rate-split";
import {
  PILOT_RUN_PERIOD,
  PILOT_STARTER_STATE,
  PILOT_UAT_STORAGE_KEY,
  pilotHourlyRateSplitNeeded,
  pilotHourlyRateSplitReady,
  type PilotTimesheet,
  type PilotUatEmployee,
  type PilotUatState,
} from "@/lib/payroll/pilot-uat";

type SaveMode = "loading" | "workspace" | "saving" | "device" | "error";

export default function GuidedTimeEntryPage() {
  const router = useRouter();
  const [state, setState] = useState<PilotUatState | null>(null);
  const [businessName, setBusinessName] = useState("My business");
  const [mode, setMode] = useState<SaveMode>("loading");
  const [notice, setNotice] = useState("Loading this payroll’s hours…");
  const hydrated = useRef(false);
  const cloudSave = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hourly = useMemo(() => state?.employees.filter((employee) => employee.payType === "Hourly" && employee.status !== "Terminated") ?? [], [state]);
  const salaryCount = useMemo(() => state?.employees.filter((employee) => employee.payType === "Salary" && employee.status !== "Terminated").length ?? 0, [state]);
  const completeRows = useMemo(() => hourly.filter((employee) => {
    const row = state?.timesheets[employee.id];
    return Boolean(row && row.regular >= 0 && row.overtime >= 0 && row.vacation >= 0 && pilotHourlyRateSplitReady(employee, row));
  }).length, [hourly, state]);
  const splitCount = useMemo(() => hourly.filter(pilotHourlyRateSplitNeeded).length, [hourly]);

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
        cloudSave.current = true;
        setMode("workspace");
        setNotice("Only the people who need hours are shown here.");
      } catch {
        let next = PILOT_STARTER_STATE;
        try {
          const raw = window.localStorage.getItem(PILOT_UAT_STORAGE_KEY);
          if (raw) next = JSON.parse(raw) as PilotUatState;
        } catch { /* use fictional fallback */ }
        if (!cancelled) {
          setState(next);
          cloudSave.current = false;
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
    window.localStorage.setItem(PILOT_UAT_STORAGE_KEY, JSON.stringify(state));
    if (!cloudSave.current) return;
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
        cloudSave.current = false;
        setMode("error");
        setNotice("The workspace save needs attention. Your latest hours remain saved on this device.");
      }
    }, 500);
  }, [state]);

  function updateTime(id: string, field: keyof Pick<PilotTimesheet, "regular" | "overtime" | "vacation">, value: string) {
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

  function splitRows(employee: PilotUatEmployee, row: PilotTimesheet) {
    const dates = pilotHourlyRateSegmentDates(employee, PILOT_RUN_PERIOD);
    const existing = row.rateSplits ?? [];
    return dates.map((effectiveFrom) => existing.find((item) => item.effectiveFrom === effectiveFrom) ?? { effectiveFrom, regular: 0, overtime: 0, vacation: 0 });
  }

  function updateSplitTime(employee: PilotUatEmployee, effectiveFrom: string, field: "regular" | "overtime" | "vacation", value: string) {
    const number = Number(value);
    setState((current) => {
      if (!current) return current;
      const row = current.timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
      const splits = splitRows(employee, row).map((item) => item.effectiveFrom === effectiveFrom
        ? { ...item, [field]: Number.isFinite(number) && number >= 0 ? number : 0 }
        : item);
      const totals = splits.reduce((result, item) => ({
        regular: result.regular + item.regular,
        overtime: result.overtime + item.overtime,
        vacation: result.vacation + item.vacation,
      }), { regular: 0, overtime: 0, vacation: 0 });
      return {
        ...current,
        ready: false,
        timesheets: { ...current.timesheets, [employee.id]: { ...totals, rateSplits: splits } },
      };
    });
    setNotice("Split hours changed. Coffee Payroll will apply each rate to the hours in its effective segment.");
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

          {splitCount > 0 && <div className="mt-5 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] px-5 py-4 text-sm leading-6 text-[#714a32]"><strong>{splitCount} hourly employee{splitCount === 1 ? " has" : "s have"} a rate change during this pay period.</strong> Their hours are split below so Coffee Payroll can pay the hours before and after the change at the correct rates.</div>}

          <div className="mt-6 space-y-4">
            {hourly.map((employee) => {
              const row = state.timesheets[employee.id] ?? { regular: 0, overtime: 0, vacation: 0 };
              const needsSplit = pilotHourlyRateSplitNeeded(employee);
              const segments = needsSplit ? splitRows(employee, row) : [];
              return <div key={employee.id} className="rounded-2xl border border-[#e2d4c8] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">{employee.name}</div><div className="mt-1 text-xs text-[#806858]">Hourly · ${employee.rate.toFixed(2)}/hr{employee.status === "New hire" ? " · New hire" : employee.status === "Terminating" ? " · Leaving" : ""}</div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${needsSplit ? "bg-[#fff0dc] text-[#75451f]" : "bg-[#fff8e7] text-[#725a22]"}`}>{needsSplit ? "Rate changed this pay" : "Hours needed"}</span></div>

                {!needsSplit ? <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(["regular", "overtime", "vacation"] as const).map((field) => <label key={field} className="text-xs font-semibold text-[#745948]">{field === "regular" ? "Regular hours" : field === "overtime" ? "Overtime hours" : "Vacation hours"}<input value={row[field]} onChange={(event) => updateTime(employee.id, field, event.target.value)} type="number" min="0" step="0.25" className="mt-1.5 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5 text-base font-normal" /></label>)}
                </div> : <div className="mt-4 space-y-3">{segments.map((segment, index) => {
                  const rate = pilotHourlyRateForSegment(employee, segment.effectiveFrom);
                  const nextDate = segments[index + 1]?.effectiveFrom;
                  return <div key={segment.effectiveFrom} className="rounded-xl border border-[#eadfd4] bg-[#fffaf5] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold">{index === 0 && nextDate ? `Before ${new Date(`${nextDate}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}` : `From ${new Date(`${segment.effectiveFrom}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`}</div><div className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#6b4a36]">${rate.toFixed(2)}/hr</div></div><div className="mt-3 grid gap-3 sm:grid-cols-3">{(["regular", "overtime", "vacation"] as const).map((field) => <label key={field} className="text-xs font-semibold text-[#745948]">{field === "regular" ? "Regular hours" : field === "overtime" ? "Overtime hours" : "Vacation hours"}<input value={segment[field]} onChange={(event) => updateSplitTime(employee, segment.effectiveFrom, field, event.target.value)} type="number" min="0" step="0.25" className="mt-1.5 w-full rounded-xl border border-[#d8c8ba] bg-white px-3 py-2.5 text-base font-normal" /></label>)}</div></div>;
                })}</div>}
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
