"use client";

import { ArrowLeft, Check, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RunPayrollStep = {
  id: string;
  label: string;
  helper: string;
};

export const RUN_PAYROLL_STEPS: readonly RunPayrollStep[] = [
  { id: "changes", label: "Changes", helper: "Anything different?" },
  { id: "employees", label: "Employees", helper: "Who are you paying?" },
  { id: "hours-pay", label: "Hours & pay", helper: "Enter this pay" },
  { id: "review", label: "Review", helper: "Check the results" },
  { id: "approve-pay", label: "Approve & pay", helper: "Confirm and release" },
  { id: "done", label: "Done", helper: "Payroll complete" },
] as const;

type RunPayrollShellProps = {
  currentStep: number;
  completedThrough?: number;
  title?: string;
  detail?: string;
  children: React.ReactNode;
  onStepChange?: (step: number) => void;
  onBack?: () => void;
  onHome: () => void;
};

export function RunPayrollShell({
  currentStep,
  completedThrough = currentStep - 1,
  title,
  detail,
  children,
  onStepChange,
  onBack,
  onHome,
}: RunPayrollShellProps) {
  const safeCurrentStep = Math.min(Math.max(currentStep, 0), RUN_PAYROLL_STEPS.length - 1);
  const activeStep = RUN_PAYROLL_STEPS[safeCurrentStep];
  const nextStep = RUN_PAYROLL_STEPS[safeCurrentStep + 1];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={onHome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7d8797] transition hover:text-[#17428e]"
        >
          <Home className="size-3.5" />
          Main menu
        </button>
        <span className="text-xs font-semibold text-[#7d8797]">
          Step {safeCurrentStep + 1} of {RUN_PAYROLL_STEPS.length}
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#d7e0ec] bg-white shadow-[0_8px_24px_rgba(42,57,82,0.05)]" aria-label="Run payroll progress">
        <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1557d8] text-sm font-bold text-white shadow-sm">
              {safeCurrentStep + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#647087]">
                {activeStep.label}
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.025em] text-[#172033] sm:text-[28px]">
                {title ?? activeStep.helper}
              </h1>
              {detail && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#647087]">{detail}</p>}
            </div>
          </div>
        </div>

        <nav className="border-y border-[#e5ebf4] bg-[#fafbfd] px-3 py-3 sm:px-5" aria-label="Payroll steps">
          <div className="flex items-center overflow-x-auto pb-1 sm:pb-0">
            {RUN_PAYROLL_STEPS.map((step, index) => {
              const complete = index <= completedThrough && index !== safeCurrentStep;
              const active = index === safeCurrentStep;
              const reachable = Boolean(onStepChange) && (index <= safeCurrentStep || index <= completedThrough + 1);

              return (
                <div key={step.id} className="flex min-w-0 shrink-0 items-center sm:flex-1">
                  <button
                    type="button"
                    disabled={!reachable || active}
                    onClick={() => onStepChange?.(index)}
                    aria-current={active ? "step" : undefined}
                    className={`group flex min-w-[92px] flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-center transition sm:min-w-0 sm:flex-1 ${
                      active
                        ? "bg-[#edf3ff]"
                        : reachable
                          ? "hover:bg-white hover:shadow-sm"
                          : "cursor-default"
                    }`}
                  >
                    <span
                      className={`grid size-7 place-items-center rounded-full border text-xs font-bold transition ${
                        complete
                          ? "border-[#b8d5aa] bg-[#eef9e8] text-[#34701d]"
                          : active
                            ? "border-[#1557d8] bg-[#1557d8] text-white"
                            : "border-[#d8e0ea] bg-white text-[#7d8797]"
                      }`}
                    >
                      {complete ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span className={`whitespace-nowrap text-[11px] font-semibold sm:text-xs ${active ? "text-[#17428e]" : complete ? "text-[#47623b]" : "text-[#647087]"}`}>
                      {step.label}
                    </span>
                  </button>
                  {index < RUN_PAYROLL_STEPS.length - 1 && (
                    <div className={`h-px w-3 shrink-0 sm:w-auto sm:flex-1 ${index < safeCurrentStep || index <= completedThrough ? "bg-[#a9c89a]" : "bg-[#dce4ee]"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="p-4 sm:p-6">{children}</div>

        {safeCurrentStep > 0 && safeCurrentStep < RUN_PAYROLL_STEPS.length - 1 && onBack && (
          <div className="flex items-center justify-between gap-3 border-t border-[#e6ebf2] bg-[#fcfdff] px-4 py-3 sm:px-6">
            <Button type="button" variant="ghost" onClick={onBack} className="h-9 px-2 text-sm font-semibold text-[#17428e] hover:bg-[#edf3ff]">
              <ArrowLeft className="size-4" />
              Back
            </Button>
            {nextStep && (
              <span className="inline-flex items-center gap-1 text-xs text-[#7d8797]">
                Next: {nextStep.label}
                <ChevronRight className="size-3.5" />
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
