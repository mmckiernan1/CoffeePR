import type { PilotProfile, PilotUatState } from "@/lib/payroll/pilot-uat";

export const FICTIONAL_PILOT_PROFILE: PilotProfile = {
  businessName: "Juniper Trail Coffee Co.",
  province: "Alberta",
  frequency: "Biweekly",
  employeeCount: 4,
};

export const FICTIONAL_PILOT_STATE: PilotUatState = {
  employees: [
    {
      id: "EMP-0001",
      name: "Avery Chen",
      payType: "Salary",
      rate: 80000,
      rateHistory: [{ effectiveDate: "2024-01-08", rate: 80000 }],
      status: "Active",
      hireDate: "2024-01-08",
      taxSetupComplete: true,
    },
    {
      id: "EMP-0002",
      name: "Noah Williams",
      payType: "Hourly",
      rate: 31,
      rateHistory: [
        { effectiveDate: "2024-05-13", rate: 29.5 },
        { effectiveDate: "2026-08-24", rate: 31 },
      ],
      rateEffectiveDate: "2026-08-24",
      status: "Active",
      hireDate: "2024-05-13",
      taxSetupComplete: true,
      changeNote: "Hourly rate increased during this pay period.",
    },
    {
      id: "EMP-0003",
      name: "Priya Singh",
      payType: "Salary",
      rate: 111000,
      rateHistory: [{ effectiveDate: "2023-09-05", rate: 111000 }],
      status: "Active",
      hireDate: "2023-09-05",
      taxSetupComplete: true,
    },
    {
      id: "EMP-0004",
      name: "Liam Martin",
      payType: "Hourly",
      rate: 29.5,
      rateHistory: [{ effectiveDate: "2025-02-03", rate: 29.5 }],
      status: "Terminating",
      hireDate: "2025-02-03",
      terminationDate: "2026-08-28",
      taxSetupComplete: true,
      changeNote: "Final regular shift was August 28.",
      finalPay: {
        vacationPayCents: 85000,
        overtimePayCents: 0,
        otherTaxablePayCents: 0,
        reimbursementCents: 12000,
      },
    },
  ],
  timesheets: {
    "EMP-0002": { regular: 80, overtime: 2.5, vacation: 0 },
    "EMP-0004": { regular: 64, overtime: 0, vacation: 0 },
  },
  openingBalances: {},
  ready: false,
};

export const FICTIONAL_PILOT_EXPECTATIONS = {
  employeesInRun: 4,
  hourlyEmployees: 2,
  salariedEmployees: 2,
  changedEmployees: ["EMP-0002", "EMP-0004"],
  hourlyRateSplitEmployee: "EMP-0002",
  terminatingEmployee: "EMP-0004",
} as const;
