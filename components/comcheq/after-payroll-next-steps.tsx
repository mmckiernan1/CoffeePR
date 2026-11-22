"use client";

import { ArrowRight, BookOpen, FileText, Landmark } from "lucide-react";

type AfterPayrollNextStepsProps = {
  onOpenStatements: () => void;
  onOpenCra: () => void;
  onOpenRegister: () => void;
  craAmount?: number;
};

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function AfterPayrollNextSteps({
  onOpenStatements,
  onOpenCra,
  onOpenRegister,
  craAmount,
}: AfterPayrollNextStepsProps) {
  const tasks = [
    {
      number: "1",
      icon: FileText,
      title: "Give employees their pay statements",
      description: "Open each statement and choose Print / Save PDF. Coffee Payroll does not email them in this pilot.",
      action: "Open pay statements",
      onClick: onOpenStatements,
    },
    {
      number: "2",
      icon: Landmark,
      title: "Take care of the CRA remittance",
      description: "Income tax, CPP and EI still need to be remitted. Your due date depends on your CRA remitter type; this pilot neither schedules nor sends the remittance.",
      action: "Review CRA calculation",
      onClick: onOpenCra,
    },
    {
      number: "3",
      icon: BookOpen,
      title: "Keep your payroll records",
      description: "Save the register and payment references for your business records. This fictional test keeps its payroll history in your browser, not a permanent production archive.",
      action: "Open payroll register",
      onClick: onOpenRegister,
    },
  ] as const;

  return (
    <section aria-label="What to do after payroll" className="mt-7 rounded-2xl border border-[#decdbd] bg-[#fffaf5] p-5 text-left sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#795f4f]">What comes next?</p>
      <h2 className="mt-1 text-2xl font-semibold text-[#332118]">Three things to wrap up</h2>
      <p className="mt-2 text-sm leading-6 text-[#795f4f]">
        Your payroll is complete. Coffee Payroll recorded your employee payment confirmations, but these follow-ups still need your attention.
      </p>
      {typeof craAmount === "number" && Number.isFinite(craAmount) && (
        <p className="mt-4 rounded-xl border border-[#e5d1bd] bg-white px-4 py-3 text-sm text-[#5a321f]">
          <strong>CRA amount calculated for this run: {money.format(craAmount)}.</strong> This is an amount to remit, not a payment made by Coffee Payroll.
        </p>
      )}
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {tasks.map((task) => (
          <article key={task.number} className="flex flex-col rounded-2xl border border-[#decdbd] bg-white p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f7efe6] font-bold text-[#5a321f]" aria-label={`Next step ${task.number}`}>{task.number}</span>
              <task.icon aria-hidden="true" className="size-5 text-[#5a321f]" />
            </div>
            <h3 className="mt-3 text-lg font-semibold text-[#332118]">{task.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#795f4f]">{task.description}</p>
            <button
              type="button"
              onClick={task.onClick}
              className="mt-4 inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[#b9cef2] bg-[#edf3ff] px-3 py-2 text-sm font-semibold text-[#1557d8] transition hover:border-[#1557d8] hover:bg-[#e2edff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1557d8]"
            >
              {task.action} <ArrowRight className="size-4 shrink-0" />
            </button>
          </article>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-[#795f4f]">
        <strong>Fictional test only:</strong> no money has been transferred, no CRA remittance has been made, and no statements have been delivered automatically.
      </p>
    </section>
  );
}
