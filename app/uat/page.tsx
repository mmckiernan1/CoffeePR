"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PILOT_STARTER_STATE,
  PILOT_UAT_STORAGE_KEY,
  pilotChangeSummary,
  pilotEmployeeIsInRun,
  type PilotUatState,
} from "@/lib/payroll/pilot-uat";

type SaveMode = "loading" | "workspace" | "device" | "resetting" | "error";
type PilotProfile = { businessName: string; province: string; frequency: string; employeeCount: number };

const cards = [
  {
    title: "Changes",
    detail: "Test hires, pay changes, terminations, extra pay, leaves and review notes.",
    action: "Open Changes",
    href: "/uat/lifecycle",
    step: "Step 1",
  },
  {
    title: "Hours & pay",
    detail: "Enter only the hours that need attention for hourly employees.",
    action: "Open Hours & pay",
    href: "/uat/time",
    step: "Step 3",
  },
  {
    title: "Review",
    detail: "Confirm who is being paid, funding required and anything unusual.",
    action: "Open Review",
    href: "/uat/review",
    step: "Step 4",
  },
  {
    title: "Approve & pay",
    detail: "Test the business e-transfer checklist and payment completion gate.",
    action: "Open Payments",
    href: "/uat/payments",
    step: "Step 5",
  },
] as const;

export default function PilotUatPage() {
  const router = useRouter();
  const [state, setState] = useState<PilotUatState>(PILOT_STARTER_STATE);
  const [profile, setProfile] = useState<PilotProfile>({ businessName: "My business", province: "Alberta", frequency: "Biweekly", employeeCount: 4 });
  const [mode, setMode] = useState<SaveMode>("loading");
  const [notice, setNotice] = useState("Loading your pilot workspace…");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/pilot/workspace", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (!cancelled) {
            setState(payload.state);
            setProfile(payload.profile);
            setMode("workspace");
            setNotice("This is your test hub. Employee changes now live in the same guided workflow used by Run Payroll.");
          }
          return;
        }
      } catch {
        // Device fallback below.
      }

      try {
        const raw = window.localStorage.getItem(PILOT_UAT_STORAGE_KEY);
        if (raw && !cancelled) setState(JSON.parse(raw));
      } catch {
        // Keep fictional starter state.
      }

      if (!cancelled) {
        setMode("device");
        setNotice("Workspace sync is unavailable, so the fictional pilot state is being read from this device.");
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const includedEmployees = useMemo(() => state.employees.filter(pilotEmployeeIsInRun), [state.employees]);
  const changedEmployees = useMemo(() => state.employees.filter((employee) => pilotChangeSummary(employee)), [state.employees]);
  const hourlyEmployees = useMemo(() => includedEmployees.filter((employee) => employee.payType === "Hourly"), [includedEmployees]);

  async function resetPilot() {
    setMode("resetting");
    setNotice("Resetting the fictional payroll scenario…");
    window.localStorage.setItem(PILOT_UAT_STORAGE_KEY, JSON.stringify(PILOT_STARTER_STATE));
    setState(PILOT_STARTER_STATE);

    try {
      const response = await fetch("/api/pilot/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetState: true }),
      });
      if (!response.ok) throw new Error("workspace reset unavailable");
      const payload = await response.json();
      setState(payload.state);
      setProfile(payload.profile ?? profile);
      setMode("workspace");
      setNotice("The fictional payroll scenario has been reset and is ready to test again.");
    } catch {
      setMode("device");
      setNotice("The local fictional scenario was reset. Workspace reset can be retried after sync is available.");
    }
  }

  const sourceLabel = mode === "workspace"
    ? "Workspace synced"
    : mode === "resetting"
      ? "Resetting…"
      : mode === "loading"
        ? "Loading…"
        : mode === "error"
          ? "Needs attention"
          : "Saved on this device";

  return (
    <main className="min-h-screen bg-[#f4eadf] px-4 py-7 text-[#332118] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5a321f] text-xl text-white">☕</div>
            <div>
              <div className="text-2xl font-semibold">Coffee Payroll</div>
              <div className="text-[10px] tracking-[0.3em] text-[#846755]">stress free payroll · pilot test hub</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push("/")} className="rounded-xl border border-[#d6c6b8] bg-[#fffaf5] px-4 py-2 text-sm font-semibold">Main menu</button>
            <button onClick={() => router.push("/guided-payroll")} className="rounded-xl bg-[#5a321f] px-4 py-2 text-sm font-semibold text-white">Run payroll</button>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e0c7ad] bg-[#fff6ec] px-5 py-4 text-sm text-[#714a32]">
          <span>{notice}</span>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold">{profile.businessName} · {sourceLabel}</span>
        </div>

        <section className="mt-6 rounded-[28px] border border-[#decdbd] bg-[#fffaf5] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#967663]">Pilot workspace</div>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Test the real payroll journey</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#795f4f]">The old duplicate hire and pay-change forms are gone. Use the same Changes, Hours, Review and Payments screens that the owner journey uses, so UAT now tests the product we actually intend to ship.</p>
            </div>
            <button onClick={resetPilot} disabled={mode === "resetting"} className="rounded-xl border border-[#d6c6b8] bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Reset fictional scenario</button>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#e2d4c8] bg-white p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#806858]">In this payroll</div><div className="mt-2 text-3xl font-semibold">{includedEmployees.length}</div><div className="mt-1 text-sm text-[#795f4f]">employees included</div></div>
            <div className="rounded-2xl border border-[#e2d4c8] bg-white p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#806858]">Need hours</div><div className="mt-2 text-3xl font-semibold">{hourlyEmployees.length}</div><div className="mt-1 text-sm text-[#795f4f]">hourly employees</div></div>
            <div className={`rounded-2xl border p-5 ${changedEmployees.length ? "border-[#e3c39f] bg-[#fff8ee]" : "border-[#d7e5ce] bg-[#f7fbf4]"}`}><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#806858]">Changes</div><div className="mt-2 text-3xl font-semibold">{changedEmployees.length}</div><div className="mt-1 text-sm text-[#795f4f]">employees flagged</div></div>
            <div className={`rounded-2xl border p-5 ${state.ready ? "border-[#d7e5ce] bg-[#f7fbf4]" : "border-[#e3c39f] bg-[#fff8ee]"}`}><div className="text-xs font-bold uppercase tracking-[0.14em] text-[#806858]">Hours status</div><div className="mt-2 text-lg font-semibold">{state.ready ? "Ready" : "Needs review"}</div><div className="mt-2 text-sm text-[#795f4f]">for Run 17</div></div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <button key={card.href} onClick={() => router.push(card.href)} className="rounded-[24px] border border-[#decdbd] bg-[#fffaf5] p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#967663]">{card.step}</div>
              <h2 className="mt-2 text-2xl font-semibold">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#795f4f]">{card.detail}</p>
              <div className="mt-5 text-sm font-semibold text-[#6c432e]">{card.action} →</div>
            </button>
          ))}
        </section>

        <div className="mt-5 rounded-2xl border border-[#d7e5ce] bg-[#f7fbf4] px-5 py-4 text-sm leading-6 text-[#4f6944]">
          <strong>UAT principle:</strong> test the same path the owner uses. Technical setup and calculation evidence can stay underneath the product, while the pilot journey remains simple and clickable.
        </div>
      </div>
    </main>
  );
}
