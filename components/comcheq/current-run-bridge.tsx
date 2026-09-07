"use client";

import { GuidedPayrollRun, type GuidedPayrollEmployee } from "@/components/comcheq/guided-payroll-run";

type CurrentRunEmployee = {
  name: string;
  role: string;
  payType: string;
  gross: number;
  tax: number;
  cpp: number;
  ei: number;
  other: number;
};

type CurrentRunBridgeProps = {
  approved: boolean;
  timeReady: boolean;
  employees: readonly CurrentRunEmployee[];
  gross: number;
  net: number;
  remittance: number;
  onHome: () => void;
  onEmployees: () => void;
  onTime: () => void;
  onReview: () => void;
  onApprove: () => void;
  onPayments: () => void;
  onReports: () => void;
};

export function CurrentRunBridge({
  approved,
  timeReady,
  employees,
  gross,
  net,
  remittance,
  onHome,
  onEmployees,
  onTime,
  onReview,
  onApprove,
  onPayments,
  onReports,
}: CurrentRunBridgeProps) {
  const guidedEmployees: GuidedPayrollEmployee[] = employees.map((employee) => ({
    name: employee.name,
    payType: employee.payType,
    detail: `${employee.role} · ${employee.payType === "Hourly" ? "Enter this period's hours" : "Regular salary carries forward"}`,
    netPay: employee.gross - employee.tax - employee.cpp - employee.ei - employee.other,
  }));

  return (
    <GuidedPayrollRun
      runKey="2026-17"
      approved={approved}
      timeReady={timeReady}
      employees={guidedEmployees}
      gross={gross}
      net={net}
      remittance={remittance}
      fee={18}
      onHome={onHome}
      onOpenEmployees={onEmployees}
      onOpenTime={onTime}
      onOpenReview={onReview}
      onApprove={onApprove}
      onOpenPayments={onPayments}
      onOpenReports={onReports}
    />
  );
}
