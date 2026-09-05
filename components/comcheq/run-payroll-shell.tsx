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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onHome}
          className="h-9 px-2 text-[#647087] hover:bg-[#edf3ff] hover:text-[#17428e]"
        >
          <Home className="size-4" />
          Back to main menu
        </Button>
        <p className="text-xs font-medium text-[#647087]">
          Step {safeCurrentStep + 1} of {RUN_PAYROLL_STEPS.length}
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#dce4f0] bg-white" aria-label="Run payroll progress">
        <div className="border-b border-[#e5ebf4] px-4 py-4 sm:px-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1557d8]">Run payroll</p>
          <div className="mt-1 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[#172033]">{title ?? activeStep.label}</h1>
              <p className="mt-1 text-sm text-[#647087]">{detail ?? activeStep.helper}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[#e5ebf4] sm:grid-cols-3 xl:grid-cols-6">
          {RUN_PAYROLL_STEPS.map((step, index) => {
            const complete = index <= completedThrough && index !== safeCurrentStep;
            const active = index === safeCurrentStep;
            const reachable = Boolean(onStepChange) && (index <= safeCurrentStep || index <= completedThrough + 1);

            return (
              <button
                key={step.id}
                type="button"
                disabled={!reachable || active}
                onClick={() => onStepChange?.(index)}
                aria-current={active ? "step" : undefined}
                className={`min-w-0 bg-white px-3 py-3 text-left transition sm:px-4 ${
                  active
                    ? "bg-[#edf3ff] shadow-[inset_0_-3px_0_#1557d8]"
                    : reachable
                      ? "hover:bg-[#f7f9fd]"
                      : "cursor-default"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      complete
                        ? "bg-[#eef9e8] text-[#34701d]"
                        : active
                          ? "bg-[#1557d8] text-white"
                          : "bg-[#f1f4f9] text-[#647087]"
                    }`}
                  >
                    {complete ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span className={`truncate text-sm font-semibold ${active ? "text-[#17428e]" : "text-[#172033]"}`}>{step.label}</span>
                </div>
                <p className="mt-1.5 truncate pl-9 text-[11px] text-[#647087]">{step.helper}</p>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5">{children}</div>
      </section>

      {safeCurrentStep > 0 && safeCurrentStep < RUN_PAYROLL_STEPS.length - 1 && onBack && (
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="border-[#c9d5e6] bg-white text-[#17428e]">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <span className="inline-flex items-center gap-1 text-xs text-[#647087]">
            {activeStep.label}
            <ChevronRight className="size-3.5" />
            {RUN_PAYROLL_STEPS[safeCurrentStep + 1]?.label}
          </span>
        </div>
      )}
    </div>
  );
}
