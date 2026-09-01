"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck, Banknote, Building2, CalendarDays, CalendarRange, Check,
  ChevronDown, ChevronRight, Clock3, Download, FileArchive, FilePenLine,
  Database, Eye, FileCode2, FileSpreadsheet, FileText, GitBranch, History, HomeIcon, Landmark, LockKeyhole,
  Layers3, ListChecks, Mail, Menu, Network, Plus, ReceiptText, RefreshCw, Settings2, ShieldCheck,
  Upload, UserMinus, Users, WalletCards,
} from "lucide-react";
import { payrollApiControls, payrollApiResources } from "@/lib/payroll/api-contract";
import { buildAllSectionsCsv, buildSectionCsv, dataExchangeSections, validateSectionCsv } from "@/lib/payroll/csv-data-exchange";
import { allocateDemoNetPay, buildDemoAlbertaCalculation, buildDemoPaymentsCanadaAftFile } from "@/lib/payroll/demo";
import { dollarsToCents, formatCad } from "@/lib/payroll/money";
import { buildBrandedPdf, buildPayrollRegisterPdf } from "@/lib/payroll/pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type View = "home" | "test" | "configuration" | "corrections" | "setup" | "accounts" | "employees" | "departments" | "components" | "time" | "payroll" | "extra" | "holidays" | "calculation" | "history" | "reports" | "remittances" | "documents" | "t4" | "roe" | "data" | "platform";

type PdfReportKind = "register" | "journal" | "remittance" | "statement";

const employees = [
  { initials: "AC", name: "Avery Chen", role: "Operations Manager", email: "avery@example.ca", payType: "Salary", type: "Salary", gross: 3076.92, tax: 588.34, cpp: 177.62, ei: 50.15, other: 120 },
  { initials: "NW", name: "Noah Williams", role: "Field Technician", email: "noah@example.ca", payType: "Hourly", type: "Hourly · 82.5 h", gross: 2632.5, tax: 439.15, cpp: 151.17, ei: 42.91, other: 62.5 },
  { initials: "PS", name: "Priya Singh", role: "Finance Lead", email: "priya@example.ca", payType: "Salary", type: "Salary", gross: 4269.23, tax: 931.44, cpp: 245.87, ei: 69.59, other: 255 },
  { initials: "LM", name: "Liam Martin", role: "Customer Support", email: "liam@example.ca", payType: "Hourly", type: "Hourly · 72.0 h", gross: 2124, tax: 319.12, cpp: 122.24, ei: 34.62, other: 0 },
] as const;

const employeeProfiles: Record<(typeof employees)[number]["name"], { id: string; hireDate: string; department: string; province: string; payRate: string; bank: string; td1: string; pension: string }> = {
  "Avery Chen": { id: "EMP-0001", hireDate: "January 5, 2024", department: "010 · Operations", province: "Alberta", payRate: "$80,000 annual", bank: "RBC •••• 1842", td1: "Federal + Alberta current", pension: "Group RPP · 4%" },
  "Noah Williams": { id: "EMP-0002", hireDate: "January 12, 2026", department: "020 · Field Services", province: "Alberta", payRate: "$30.00 per hour", bank: "ATB •••• 9204", td1: "Federal + Alberta current", pension: "No plan assigned" },
  "Priya Singh": { id: "EMP-0003", hireDate: "May 8, 2023", department: "030 · Finance", province: "Alberta", payRate: "$111,000 annual", bank: "RBC •••• 4471", td1: "Federal + Alberta current", pension: "Group RPP · 5%" },
  "Liam Martin": { id: "EMP-0004", hireDate: "March 3, 2025", department: "040 · Customer Support", province: "Alberta", payRate: "$29.50 per hour", bank: "CIBC •••• 6038", td1: "Federal + Alberta current", pension: "No plan assigned" },
};

const departments = ["010 · Operations", "020 · Field Services", "030 · Finance", "040 · Customer Support", "050 · Administration"] as const;

type PayrollAccount = {
  id: string;
  programAccount: string;
  legalEntity: string;
  remitterType: string;
  status: "Active" | "Draft";
  employeeCount: number;
  nextRun: string;
};

const initialPayrollAccounts: PayrollAccount[] = [
  { id: "PA-0001", programAccount: "••••••••• RP0001", legalEntity: "Prairie North Services Ltd.", remitterType: "Monthly", status: "Active", employeeCount: 4, nextRun: "Run 17 · Sep 4" },
];

const priorRuns = [
  { run: 16, period: "Aug 1–15, 2026", payDate: "Aug 21, 2026", gross: 11846.4, net: 8302.17, status: "Approved" },
  { run: 15, period: "Jul 16–31, 2026", payDate: "Aug 7, 2026", gross: 11218.73, net: 7910.64, status: "Approved" },
  { run: 14, period: "Jul 1–15, 2026", payDate: "Jul 24, 2026", gross: 12104.52, net: 8468.31, status: "Approved" },
  { run: 13, period: "Jun 16–30, 2026", payDate: "Jul 10, 2026", gross: 11086.92, net: 7835.72, status: "Approved" },
] as const;

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 });

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function reportFile(kind: PdfReportKind, employeeName = "Noah Williams") {
  if (kind === "statement") {
    const employee = employees.find((item) => item.name === employeeName) ?? employees[1];
    const profiles: Record<string, { regularHours: string; overtimeHours: string; wageRate: string; overtimeRate: string; regular: number; overtime: number; vacation: number }> = {
      "Avery Chen": { regularHours: "86.67", overtimeHours: "0.00", wageRate: "$3,076.92 / period", overtimeRate: "Not applicable", regular: 3076.92, overtime: 0, vacation: 0 },
      "Noah Williams": { regularHours: "80.00", overtimeHours: "2.50", wageRate: "$30.00 / hour", overtimeRate: "$45.00 / hour", regular: 2400, overtime: 112.5, vacation: 120 },
      "Priya Singh": { regularHours: "86.67", overtimeHours: "0.00", wageRate: "$4,269.23 / period", overtimeRate: "Not applicable", regular: 4269.23, overtime: 0, vacation: 0 },
      "Liam Martin": { regularHours: "72.00", overtimeHours: "0.00", wageRate: "$29.50 / hour", overtimeRate: "$44.25 / hour", regular: 2124, overtime: 0, vacation: 0 },
    };
    const profile = profiles[employee.name];
    const net = employee.gross - employee.tax - employee.cpp - employee.ei - employee.other;
    return {
      title: `${employee.name} pay statement`,
      filename: `comcheq-pay-run-17-${employee.name.toLowerCase().replaceAll(" ", "-")}-statement.pdf`,
      bytes: buildBrandedPdf({
        clientName: "Prairie North Services Ltd.",
        title: "Pay statement",
        subtitle: "Confidential employee earnings statement",
        metadata: [
          { label: "Employee", value: employee.name },
          { label: "Statement period", value: "August 16-31, 2026" },
          { label: "Pay date", value: "September 4, 2026" },
          { label: "Pay run", value: "17 of 26" },
          { label: "Regular wage rate", value: profile.wageRate },
          { label: "Overtime rate", value: profile.overtimeRate },
        ],
        sections: [
          { title: "Hours and earnings paid", rows: [
            { label: "Regular hours worked", detail: profile.wageRate, value: profile.regularHours },
            { label: "Overtime hours worked", detail: profile.overtimeRate, value: profile.overtimeHours },
            { label: "Hours taken off in lieu of overtime", detail: "Current period", value: "0.00" },
            { label: "Regular wages / salary", detail: "Earnings", value: currency.format(profile.regular) },
            { label: "Overtime pay", detail: "Earnings", value: currency.format(profile.overtime) },
            { label: "Vacation pay", detail: "Earnings", value: currency.format(profile.vacation) },
            { label: "General holiday pay", detail: "Earnings", value: "$0.00" },
            { label: "Gross earnings", detail: "Current period", value: currency.format(employee.gross), emphasis: true },
          ] },
          { title: "Deductions and reasons", rows: [
            { label: "Income tax", detail: "Statutory deduction", value: currency.format(employee.tax) },
            { label: "Canada Pension Plan", detail: "Statutory deduction", value: currency.format(employee.cpp) },
            { label: "Employment Insurance", detail: "Statutory deduction", value: currency.format(employee.ei) },
            { label: "Registered pension / other", detail: "Employee-authorized", value: currency.format(employee.other) },
            { label: "Net pay", detail: "Direct deposit", value: currency.format(net), emphasis: true },
          ] },
        ],
        footer: "Electronic statement provided through confidential employee access with view, download and print capability.",
      }),
    };
  }

  if (kind === "journal") {
    return {
      title: "General ledger journal",
      filename: "comcheq-pay-run-17-general-ledger-journal.pdf",
      bytes: buildBrandedPdf({
        clientName: "Prairie North Services Ltd.", title: "General ledger journal", subtitle: "Pay run 17 - accountant-ready posting summary",
        metadata: [{ label: "Pay period", value: "August 16-31, 2026" }, { label: "Pay date", value: "September 4, 2026" }, { label: "Journal reference", value: "PAY-2026-017" }, { label: "Status", value: "Preview" }],
        sections: [{ title: "Journal entries", rows: [
          { label: "5000 Payroll expense", detail: "Debit", value: "$12,102.65" },
          { label: "5010 Employer CPP expense", detail: "Debit", value: "$696.90" },
          { label: "5020 Employer EI expense", detail: "Debit", value: "$276.18" },
          { label: "2100 Income tax payable", detail: "Credit", value: "$2,278.05" },
          { label: "2110 CPP payable", detail: "Credit", value: "$1,393.80" },
          { label: "2120 EI payable", detail: "Credit", value: "$473.45" },
          { label: "2200 Other deductions payable", detail: "Credit", value: "$437.50" },
          { label: "1000 Payroll bank clearing", detail: "Credit", value: "$8,492.93" },
          { label: "Balanced journal", detail: "Debits = credits", value: "$13,075.73", emphasis: true },
        ] }], footer: "Fictional preview. Account mappings are client-controlled and exportable to CSV for the accountant.",
      }),
    };
  }

  if (kind === "remittance") {
    return {
      title: "CRA remittance summary",
      filename: "comcheq-pay-run-17-cra-remittance-summary.pdf",
      bytes: buildBrandedPdf({
        clientName: "Prairie North Services Ltd.", title: "CRA remittance summary", subtitle: "Employer-controlled payment obligation",
        metadata: [{ label: "Pay run", value: "17 of 26" }, { label: "Due date", value: "September 15, 2026" }, { label: "Remitter frequency", value: "Monthly" }, { label: "Status", value: "Calculated" }],
        sections: [{ title: "Current obligation", rows: [
          { label: "Income tax withheld", detail: "Employee deductions", value: "$2,278.05" },
          { label: "CPP - employee and employer", detail: "Combined payable", value: "$1,393.80" },
          { label: "EI - employee and employer", detail: "Combined payable", value: "$473.45" },
          { label: "Total CRA remittance", detail: "Run 17", value: "$4,145.30", emphasis: true },
        ] }], footer: "Comcheq calculates and records the obligation; the client retains control of CRA payment and confirmation.",
      }),
    };
  }

  return {
    title: "Payroll register",
    filename: "comcheq-pay-run-17-payroll-register.pdf",
    bytes: buildPayrollRegisterPdf({
      clientName: "Prairie North Services Ltd.", period: "August 16-31, 2026", payDate: "September 4, 2026", runLabel: "17 of 26",
      employees: employees.map((employee) => ({
        employeeNumber: employeeProfiles[employee.name].id,
        employeeName: employee.name,
        regularHours: employee.name === "Noah Williams" ? "80.00" : employee.name === "Liam Martin" ? "72.00" : "86.67",
        overtimeHours: employee.name === "Noah Williams" ? "2.50" : "0.00",
        gross: currency.format(employee.gross), incomeTax: currency.format(employee.tax), cpp: currency.format(employee.cpp), ei: currency.format(employee.ei), otherDeductions: currency.format(employee.other),
        netPay: currency.format(employee.gross - employee.tax - employee.cpp - employee.ei - employee.other),
      })),
      grossTotal: "$12,102.65", deductionTotal: "$3,609.72", netTotal: "$8,492.93",
    }),
  };
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [calculatedAt, setCalculatedAt] = useState("Calculated 2 minutes ago");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roeOpen, setRoeOpen] = useState(false);
  const [roeEmployeeName, setRoeEmployeeName] = useState("Noah Williams");
  const [approved, setApproved] = useState(false);
  const [statementsSent, setStatementsSent] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; filename: string; url: string } | null>(null);
  const [timeReady, setTimeReady] = useState(true);
  const [roeSavedAt, setRoeSavedAt] = useState("Edited Aug 29, 2026");
  const [roeReason, setRoeReason] = useState("A00");
  const [roeLastDay, setRoeLastDay] = useState("2026-08-28");
  const [roeHours, setRoeHours] = useState("412.50");
  const [roeComments, setRoeComments] = useState("Seasonal project completed.");
  const [dataSectionId, setDataSectionId] = useState("employees");
  const [importResult, setImportResult] = useState<{ filename: string; valid: boolean; rowCount: number; errors: string[]; warnings: string[] } | null>(null);
  const [payrollAccounts, setPayrollAccounts] = useState<PayrollAccount[]>(initialPayrollAccounts);
  const [timeEntries, setTimeEntries] = useState({
    "Noah Williams": { regular: "80.00", overtime: "2.50", vacation: "0.00" },
    "Liam Martin": { regular: "72.00", overtime: "0.00", vacation: "8.00" },
  });

  const totals = useMemo(() => employees.reduce((result, employee) => {
    const tax = employee.tax;
    const net = employee.gross - tax - employee.cpp - employee.ei - employee.other;
    return { gross: result.gross + employee.gross, tax: result.tax + tax, cpp: result.cpp + employee.cpp, ei: result.ei + employee.ei, other: result.other + employee.other, net: result.net + net };
  }, { gross: 0, tax: 0, cpp: 0, ei: 0, other: 0, net: 0 }), []);
  const employerEi = totals.ei * 1.4;
  const employerCost = totals.gross + totals.cpp + employerEi;
  const remittance = totals.tax + totals.cpp * 2 + totals.ei + employerEi;

  function navigate(next: View) {
    setView(next);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function recalculate() {
    setCalculatedAt("Recalculated just now");
    setApproved(false);
    setStatementsSent(false);
  }

  function payrollRows() {
    return [...employees].sort((left, right) => employeeProfiles[left.name].id.localeCompare(employeeProfiles[right.name].id, "en-CA", { numeric: true })).map((employee) => {
      const tax = employee.tax;
      const net = employee.gross - tax - employee.cpp - employee.ei - employee.other;
      return [employee.name, employee.type, employee.gross, tax, employee.cpp, employee.ei, employee.other, net];
    });
  }

  function downloadRegister(run = 17) {
    const csv = [["Pay run", "Employee", "Pay type", "Gross", "Tax", "CPP", "EI", "Other", "Net pay"], ...payrollRows().map((row) => [run, ...row])]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadText(`comcheq-pay-run-${run}-register.csv`, csv, "text/csv;charset=utf-8");
  }

  function downloadBankFile(run = 17) {
    const currentNetCents = employees.map((employee) => dollarsToCents(employee.gross - employee.tax - employee.cpp - employee.ei - employee.other));
    const historicalTotal = priorRuns.find((item) => item.run === run)?.net ?? totals.net;
    const paymentCents = run === 17 ? currentNetCents : allocateDemoNetPay(dollarsToCents(historicalTotal), currentNetCents);
    const file = buildDemoPaymentsCanadaAftFile(run, paymentCents.map((amount) => amount / 100));
    downloadText(`comcheq-payments-canada-aft-simulation-pay-run-${run}.txt`, file.content, "text/plain;charset=us-ascii");
  }

  function downloadRoePreview() {
    downloadText(`comcheq-roe-${roeEmployeeName.toLowerCase().replaceAll(" ", "-")}-draft.txt`, [
      "COMCHEQ ROE DRAFT — NOT FOR SUBMISSION", `Employee: ${roeEmployeeName}`,
      `Last day worked: ${roeLastDay}`, `Reason code: ${roeReason}`,
      `Total insurable hours: ${roeHours}`, `Comments: ${roeComments}`,
      "Insurable earnings by pay period: generated from approved Comcheq pay-run history",
    ].join("\n"));
  }

  function openRoe(employeeName = "Noah Williams") {
    setRoeEmployeeName(employeeName);
    setRoeOpen(true);
  }

  function updateTime(employee: keyof typeof timeEntries, field: "regular" | "overtime" | "vacation", value: string) {
    setTimeEntries((current) => ({ ...current, [employee]: { ...current[employee], [field]: value } }));
    setTimeReady(false);
    setApproved(false);
  }

  function downloadDataSection(sectionId: string, template = false) {
    const section = dataExchangeSections.find((item) => item.id === sectionId)!;
    downloadText(`comcheq-${section.id}-${template ? "template" : "export"}.csv`, buildSectionCsv(section, template), "text/csv;charset=utf-8");
  }

  async function validateDataImport(file: File, sectionId: string) {
    const section = dataExchangeSections.find((item) => item.id === sectionId)!;
    const result = validateSectionCsv(section, await file.text());
    setImportResult({ filename: file.name, ...result });
  }

  function openPdf(kind: PdfReportKind, employeeName?: string) {
    const report = reportFile(kind, employeeName);
    const url = URL.createObjectURL(new Blob([report.bytes as BlobPart], { type: "application/pdf" }));
    setPdfPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { title: report.title, filename: report.filename, url };
    });
  }

  function downloadPdf(kind: PdfReportKind, employeeName?: string) {
    const report = reportFile(kind, employeeName);
    const url = URL.createObjectURL(new Blob([report.bytes as BlobPart], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = report.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadJournalCsv() {
    const rows = [
      ["journal_reference", "pay_date", "account", "description", "debit", "credit"],
      ["PAY-2026-017", "2026-09-04", "5000", "Payroll expense", "12102.65", "0.00"],
      ["PAY-2026-017", "2026-09-04", "5010", "Employer CPP expense", "696.90", "0.00"],
      ["PAY-2026-017", "2026-09-04", "5020", "Employer EI expense", "276.18", "0.00"],
      ["PAY-2026-017", "2026-09-04", "2100", "Income tax payable", "0.00", "2278.05"],
      ["PAY-2026-017", "2026-09-04", "2110", "CPP payable", "0.00", "1393.80"],
      ["PAY-2026-017", "2026-09-04", "2120", "EI payable", "0.00", "473.45"],
      ["PAY-2026-017", "2026-09-04", "2200", "Other deductions payable", "0.00", "437.50"],
      ["PAY-2026-017", "2026-09-04", "1000", "Payroll bank clearing", "0.00", "8492.93"],
    ];
    downloadText("comcheq-pay-run-17-general-ledger-journal.csv", rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#2f2447]">
      <header className="sticky top-0 z-40 border-b border-[#ded6e8] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-4 sm:px-7">
          <button type="button" onClick={() => navigate("home")} className="flex items-center gap-3 text-left">
            <div className="grid size-10 place-items-center rounded-xl bg-[#e00087] text-sm font-bold text-white shadow-[0_8px_20px_rgba(224,0,135,0.2)]">Cq</div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7757e8]">Comcheq Payroll</p><p className="text-sm font-semibold">Prairie North Services Ltd.</p></div>
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-[#ded6e8] bg-white px-3 py-2 text-xs text-[#655b73] md:flex"><ShieldCheck className="size-4 text-[#00a29a]" />Fictional Alberta employer</div>
          <div className="grid size-9 place-items-center rounded-full bg-[#ddf8f4] text-xs font-bold text-[#0f6f74]">MM</div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1480px]">
        <aside className="hidden w-[232px] shrink-0 border-r border-[#ded6e8] bg-white/75 px-3 py-5 backdrop-blur lg:sticky lg:top-[73px] lg:flex lg:h-[calc(100vh-73px)] lg:flex-col">
          <DeepNavigation view={view} onNavigate={navigate} />
        </aside>

        <div className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:py-8">
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[#ded6e8] bg-white px-3 py-2.5 shadow-sm lg:hidden">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#847990]">Workspace</p><p className="text-sm font-semibold">{viewLabel(view)}</p></div>
            <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(true)} className="border-[#d2c7e1] bg-white"><Menu className="size-4" />Menu</Button>
          </div>

          {view === "home" && <HomeDashboard approved={approved} timeReady={timeReady} onNavigate={navigate} />}
          {view === "test" && <GuidedPayrollTestView />}
          {view === "configuration" && <ConfigurationCentreView />}
          {view === "corrections" && <CorrectionsView />}
          {view === "setup" && <SetupView onAccounts={() => navigate("accounts")} />}
          {view === "accounts" && <PayrollAccountsView accounts={payrollAccounts} onAccountsChange={setPayrollAccounts} />}
          {view === "employees" && <EmployeesView onCreateRoe={openRoe} onViewStatement={(employeeName) => openPdf("statement", employeeName)} />}
          {view === "departments" && <DepartmentsView />}
          {view === "components" && <PayComponentsView />}
          {view === "time" && <TimeView entries={timeEntries} ready={timeReady} onChange={updateTime} onReady={() => setTimeReady(true)} onPayroll={() => navigate("payroll")} />}
          {view === "payroll" && <PayrollView totals={totals} employerCost={employerCost} remittance={remittance} calculatedAt={calculatedAt} approved={approved} statementsSent={statementsSent} onHolidays={() => navigate("holidays")} onExtra={() => navigate("extra")} onHistory={() => navigate("history")} onReports={() => navigate("reports")} onStatement={() => openPdf("statement")} onApprove={() => setApprovalOpen(true)} onRecalculate={recalculate} onBankFile={() => downloadBankFile()} onStatements={() => setStatementsSent(true)} />}
          {view === "extra" && <ExtraRunView onBack={() => navigate("payroll")} />}
          {view === "holidays" && <StatHolidaysView onPayroll={() => navigate("payroll")} />}
          {view === "history" && <HistoryView approved={approved} currentGross={totals.gross} currentNet={totals.net} onBack={() => navigate("payroll")} onRegister={downloadRegister} onBankFile={downloadBankFile} />}
          {view === "reports" && <ReportsView onOpenPdf={openPdf} onDownloadPdf={downloadPdf} onRegisterCsv={() => downloadRegister()} onJournalCsv={downloadJournalCsv} />}
          {view === "remittances" && <RemittancesView remittance={remittance} />}
          {view === "data" && <DataExchangeView sectionId={dataSectionId} importResult={importResult} onSectionChange={(sectionId) => { setDataSectionId(sectionId); setImportResult(null); }} onExport={downloadDataSection} onExportAll={() => downloadText("comcheq-all-records-export.csv", buildAllSectionsCsv(), "text/csv;charset=utf-8")} onImport={validateDataImport} />}
          {(view === "documents" || view === "t4" || view === "roe") && <DocumentsView focus={view === "t4" ? "t4" : view === "roe" ? "roe" : "all"} roeSavedAt={roeSavedAt} onEditRoe={() => openRoe("Noah Williams")} onRoePreview={downloadRoePreview} />}

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-[#ded6e8] pt-5 text-xs text-[#746a80] sm:flex-row"><span>Comcheq Payroll · Your payroll, your bank, your data</span><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />Alberta tables effective January 1, 2026</span></footer>
        </div>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[86%] border-[#ded6e8] bg-[#faf8ff] p-0 sm:max-w-[320px]">
          <SheetHeader className="border-b border-[#ded6e8] bg-white px-5 py-5 text-left"><SheetTitle className="text-[#2f2447]">Comcheq workspace</SheetTitle><SheetDescription>Select an area of payroll.</SheetDescription></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4"><DeepNavigation view={view} onNavigate={navigate} /></div>
        </SheetContent>
      </Sheet>

      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="border-[#ded6e8] bg-[#ffffff] sm:max-w-[540px]">
          <DialogHeader><DialogTitle className="text-xl text-[#2f2447]">Approve pay run 17?</DialogTitle><DialogDescription className="leading-6 text-[#746a80]">Approval locks the run and creates its permanent register, bank file and employee statements. Corrections require a linked adjustment or reversal.</DialogDescription></DialogHeader>
          <div className="my-2 rounded-xl border border-[#ded6e8] bg-white p-4"><div className="flex items-center justify-between border-b border-[#eae3f0] pb-3 text-sm"><span className="text-[#746a80]">AFT simulation control total</span><strong className="font-mono text-[#6d4aff]">{currency.format(totals.net)}</strong></div><div className="flex items-center justify-between pt-3 text-sm"><span className="text-[#746a80]">CRA remittance obligation</span><strong className="font-mono">{currency.format(remittance)}</strong></div></div>
          <div className="rounded-xl bg-[#fff6df] p-3 text-xs leading-5 text-[#725a22]">The current bank export is a fictional TEST file. Production approval remains blocked until RBC supplies the client number and accepts the onboarding test file.</div>
          <DialogFooter><Button variant="outline" onClick={() => setApprovalOpen(false)} className="border-[#d2c7e1] bg-white">Keep as draft</Button><Button onClick={() => { setApproved(true); setApprovalOpen(false); }} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">Approve fictional pay run</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roeOpen} onOpenChange={setRoeOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#ded6e8] bg-[#ffffff] sm:max-w-[680px]">
          <DialogHeader><DialogTitle className="text-xl text-[#2f2447]">Edit Record of Employment</DialogTitle><DialogDescription className="leading-6 text-[#746a80]">{roeEmployeeName} · Draft ROE. Approved pay-run history supplies the insurable earnings by pay period.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="First day worked"><Input value="2026-01-12" readOnly className="bg-[#f6f2f8]" /></Field><Field label="Last day for which paid"><Input type="date" value={roeLastDay} onChange={(event) => setRoeLastDay(event.target.value)} /></Field><Field label="Reason for issuing ROE"><Select value={roeReason} onValueChange={setRoeReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A00">A00 · Shortage of work</SelectItem><SelectItem value="E00">E00 · Quit</SelectItem><SelectItem value="M00">M00 · Dismissal</SelectItem><SelectItem value="D00">D00 · Illness or injury</SelectItem><SelectItem value="F00">F00 · Maternity</SelectItem></SelectContent></Select></Field><Field label="Total insurable hours"><Input inputMode="decimal" value={roeHours} onChange={(event) => setRoeHours(event.target.value)} /></Field><Field label="Final pay period ending"><Input value="2026-08-31" readOnly className="bg-[#f6f2f8]" /></Field><Field label="Total insurable earnings"><Input value="$13,742.50" readOnly className="bg-[#f6f2f8]" /></Field></div>
          <div className="rounded-xl border border-[#ded6e8] bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Insurable earnings by pay period</p><p className="mt-1 text-xs text-[#746a80]">26 periods drawn from numbered approved runs; five most recent shown.</p></div><Badge className="border-0 bg-[#dcfce7] text-[#0f766e]">Balanced</Badge></div><div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">{["$2,632.50", "$2,575.00", "$2,640.00", "$2,512.50", "$2,525.00"].map((amount, index) => <div key={amount + index} className="rounded-lg bg-[#f7f4fa] px-2 py-2"><span className="block text-[10px] text-[#847990]">P{index + 1}</span><strong className="mt-1 block font-mono text-[11px]">{amount}</strong></div>)}</div></div>
          <Field label="Comments"><Textarea value={roeComments} onChange={(event) => setRoeComments(event.target.value)} className="min-h-20" /></Field>
          <div className="rounded-xl bg-[#fff6df] p-3 text-xs leading-5 text-[#725a22]">Prototype only. Final ROE validation, XML export and Service Canada submission certification remain production work.</div>
          <DialogFooter><Button variant="outline" onClick={downloadRoePreview} className="border-[#d2c7e1] bg-white"><Download className="size-4" />Download draft</Button><Button onClick={() => { setRoeSavedAt("Edited just now"); setRoeOpen(false); }} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">Save ROE draft</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pdfPreview)} onOpenChange={(open) => { if (!open) { if (pdfPreview) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); } }}>
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-[980px] flex-col gap-0 overflow-hidden border-[#ded6e8] bg-white p-0">
          <DialogHeader className="border-b border-[#ded6e8] bg-[#fcfaff] px-5 py-4 text-left">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><DialogTitle className="text-lg text-[#2f2447]">{pdfPreview?.title}</DialogTitle><DialogDescription className="mt-1">PDF preview · view, download or print from the viewer.</DialogDescription></div>{pdfPreview && <a href={pdfPreview.url} download={pdfPreview.filename} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#6d4aff] px-4 text-sm font-medium text-white hover:bg-[#5934d1]"><Download className="size-4" />Download PDF</a>}</div>
          </DialogHeader>
          {pdfPreview && <iframe title={`${pdfPreview.title} PDF preview`} src={pdfPreview.url} className="min-h-0 flex-1 bg-[#f1edf5]" />}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function HomeDashboard({ approved, timeReady, onNavigate }: { approved: boolean; timeReady: boolean; onNavigate: (view: View) => void }) {
  return <>
    <PageHeading eyebrow="2026 payroll year" title="Payroll overview" description="Everything needed to prepare, run and retain Canadian payroll in one compact workflow." />
    <section className="mb-6 grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-[#c7b8ed] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><Badge className="border-0 bg-[#eee9ff] text-[#5b35c7]">Self-serve</Badge><h2 className="mt-4 text-lg font-semibold">I’m ready to run payroll</h2><p className="mt-2 text-sm leading-6 text-[#655b73]">Follow guided checks, load your employee records and control every approval, bank upload and remittance.</p></div><ListChecks className="size-6 shrink-0 text-[#6d4aff]" /></div><Button onClick={() => onNavigate("setup")} className="mt-5 w-full bg-[#6d4aff] text-white hover:bg-[#5934d1]">Start guided setup<ChevronRight className="size-4" /></Button></article>
      <article className="rounded-2xl border border-[#f0b9da] bg-[#fff5fb] p-5"><div className="flex items-start justify-between gap-4"><div><Badge className="border-0 bg-[#fce7f3] text-[#a21caf]">Shoebox option</Badge><h2 className="mt-4 text-lg font-semibold">Set it up with me</h2><p className="mt-2 text-sm leading-6 text-[#655b73]">Send the records you have. For a separately confirmed setup fee, Comcheq organizes the opening data and supports your first run.</p></div><FileArchive className="size-6 shrink-0 text-[#d946ef]" /></div><Button onClick={() => onNavigate("setup")} variant="outline" className="mt-5 w-full border-[#dca8ca] bg-white text-[#8d1769]">See assisted setup<ChevronRight className="size-4" /></Button></article>
    </section>
    <section className="mb-6 rounded-2xl bg-[#e00087] p-5 text-white shadow-[0_18px_45px_rgba(224,0,135,0.18)] sm:p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5"><RunNumber value="17" light /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">August 16–31</h2><Badge className="border-0 bg-white/12 text-white hover:bg-white/12">17 of 26</Badge></div><p className="mt-1 text-sm text-[#eee9ff]">Pay date September 4, 2026 · {approved ? "Approved" : "Ready for review"}</p></div></div>
        <Button onClick={() => onNavigate("payroll")} className="h-11 bg-[#c7f36b] text-[#202024] hover:bg-white">Open pay run 17<ChevronRight className="size-4" /></Button>
      </div>
    </section>
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#655b73]">Workflow</h2><span className="text-xs text-[#847990]">Compact view</span></div>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <WorkflowTile step="01" title="Customer setup" detail="Business, CRA, banking and remittance schedule" status="7 of 7 ready" icon={<Settings2 />} onClick={() => onNavigate("setup")} />
      <WorkflowTile step="02" title="Configuration" detail="Dated changes, component rules and opening balances" status="Alberta active" icon={<GitBranch />} onClick={() => onNavigate("configuration")} />
      <WorkflowTile step="03" title="People & contractors" detail="Employees, lifecycle changes and simple T4A tracking" status="Client managed" icon={<Users />} onClick={() => onNavigate("employees")} />
      <WorkflowTile step="04" title="Time entry" detail="2 hourly employees in this run" status={timeReady ? "Ready" : "Changes to save"} icon={<Clock3 />} onClick={() => onNavigate("time")} warn={!timeReady} />
      <WorkflowTile step="05" title="Pay run 17" detail="Calculate, review notices and approve" status={approved ? "Approved" : "Draft"} icon={<WalletCards />} onClick={() => onNavigate("payroll")} accent />
      <WorkflowTile step="06" title="Corrections" detail="Underpayments, reversals and rejected EFTs" status="Extra EFT ready" icon={<RefreshCw />} onClick={() => onNavigate("corrections")} />
      <WorkflowTile step="07" title="Reports & statements" detail="View PDF, export CSV and prepare bank file" status={approved ? "Available" : "Preview ready"} icon={<FileText />} onClick={() => onNavigate("reports")} />
      <WorkflowTile step="08" title="Records & year-end" detail="Pay history, T4 slips and editable ROEs" status="1 ROE draft" icon={<FileArchive />} onClick={() => onNavigate("documents")} />
    </section>
    <section className="mt-6 grid gap-4 rounded-2xl border border-[#ded6e8] bg-white p-5 lg:grid-cols-[1fr_360px]"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#d946ef]">Things to review</p><div className="mt-3 flex items-start gap-3 rounded-xl bg-[#fff8e7] p-4"><CalendarDays className="mt-0.5 size-5 shrink-0 text-[#9a6d08]" /><div><h2 className="text-sm font-semibold">Labour Day eligibility</h2><p className="mt-1 text-xs leading-5 text-[#725a22]">One employee attendance record needs confirmation before the next payroll.</p><Button variant="link" onClick={() => onNavigate("holidays")} className="mt-1 h-auto p-0 text-xs text-[#a21caf]">Review calculation<ChevronRight className="size-3.5" /></Button></div></div></div><div className="border-t border-[#eae3f0] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#d946ef]">Important dates</p><div className="mt-3 space-y-3"><div><p className="text-xs font-semibold">September 4, 2026</p><p className="mt-1 text-[11px] text-[#746a80]">Run 17 pay date · client releases EFT</p></div><div><p className="text-xs font-semibold">September 7, 2026</p><p className="mt-1 text-[11px] text-[#746a80]">Labour Day · Alberta general holiday</p></div><div><p className="text-xs font-semibold">September 15, 2026</p><p className="mt-1 text-[11px] text-[#746a80]">CRA monthly remittance due</p></div></div></div></section>
    <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_310px]">
      <div className="rounded-2xl border border-[#ded6e8] bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Payroll year position</h2><p className="mt-1 text-xs text-[#746a80]">Every approved run remains individually numbered and retrievable.</p></div><Button variant="outline" size="sm" onClick={() => onNavigate("history")} className="border-[#ded6e8] bg-white">View history</Button></div><div className="mt-5 flex items-center gap-1.5" aria-label="17 of 26 scheduled payroll runs reached">{Array.from({ length: 26 }, (_, index) => <span key={index} className={`h-3 min-w-1 flex-1 rounded-full ${index < 16 ? "bg-[#48b9ae]" : index === 16 ? "bg-[#6d4aff]" : "bg-[#e9e3f1]"}`} />)}</div><div className="mt-2 flex justify-between text-[11px] text-[#847990]"><span>Run 1 · January</span><strong className="text-[#6d4aff]">Run 17 current</strong><span>Run 26 · December</span></div></div>
      <div className="rounded-2xl border border-[#ded6e8] bg-[#ffffff] p-5"><p className="text-xs font-medium text-[#746a80]">Projected automatic billing</p><p className="mt-2 font-mono text-2xl font-bold">$18.00</p><p className="mt-2 text-xs leading-5 text-[#746a80]">$10.00 base fee + 4 employee payments × $2.00. Charged once when the run is approved; drafts and recalculations remain free.</p></div>
    </section>
  </>;
}

function SetupView({ onAccounts }: { onAccounts: () => void }) {
  const [servicePath, setServicePath] = useState<"self-serve" | "shoebox">("self-serve");
  const [completedTasks, setCompletedTasks] = useState(() => new Set([0, 1]));
  const launchTasks = [
    ["Choose service path", "Confirm self-serve or assisted onboarding", "Client"],
    ["Confirm business & CRA", "Validate legal identity and payroll program account", servicePath === "shoebox" ? "Comcheq + client" : "Client"],
    ["Provide employee records", "Pay rates, TD1 elections, banking and balances", servicePath === "shoebox" ? "Comcheq organizes" : "Client"],
    ["Configure AFT", "Generate the simulation file and confirm bank procedure", "Client"],
    ["Run parallel payroll", "Compare gross-to-net and control totals", "Comcheq + client"],
    ["Approve launch", "Client signs off before any production payment", "Client"],
  ] as const;
  function toggleTask(index: number) {
    setCompletedTasks((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  }
  const cards = [
    ["Business profile", "Legal name, address and Alberta jurisdiction", "Complete", Building2],
    ["CRA payroll accounts", "RP0001 active · account workspace ready", "Complete", ReceiptText],
    ["Pay schedule", "Biweekly · 26 scheduled runs", "Complete", CalendarRange],
    ["Remittance profile", "Monthly threshold · next due Sep 15", "Reminder ready", CalendarDays],
    ["Bank file", "Payments Canada AFT · simulation only", "Test ready", Landmark],
    ["Employee setup", "4 active payroll profiles", "Complete", Users],
    ["Opening balances", "2026 prior payroll and YTD history", "Balanced", History],
  ] as const;
  return <>
    <PageHeading eyebrow="Customer setup" title="Prairie North Services Ltd." description="A guided setup that moves from business identity to the first parallel payroll." />
    <section className="mb-6 grid gap-4 lg:grid-cols-2"><button type="button" onClick={() => setServicePath("self-serve")} className={`rounded-2xl border p-5 text-left transition ${servicePath === "self-serve" ? "border-[#6d4aff] bg-[#f4f0ff] ring-2 ring-[#6d4aff]/15" : "border-[#ded6e8] bg-white"}`}><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6d4aff]">Self-serve</p><h2 className="mt-2 font-semibold">Guided client setup</h2><p className="mt-1 text-xs leading-5 text-[#746a80]">Client enters and verifies the records; Comcheq supplies gates, calculations and output controls.</p></button><button type="button" onClick={() => setServicePath("shoebox")} className={`rounded-2xl border p-5 text-left transition ${servicePath === "shoebox" ? "border-[#d946ef] bg-[#fff5fb] ring-2 ring-[#d946ef]/15" : "border-[#ded6e8] bg-white"}`}><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b42385]">Shoebox option</p><h2 className="mt-2 font-semibold">Assisted setup and first-run support</h2><p className="mt-1 text-xs leading-5 text-[#746a80]">Comcheq organizes supplied records for a quoted fee; the client still verifies and approves all payments.</p></button></section>
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="border-b border-[#eae3f0] bg-[#faf8ff] px-5 py-4"><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Staging launch checklist</h2><p className="mt-1 text-xs text-[#746a80]">Click each task to simulate the client handoff and identify the next operating gate.</p></div><Badge className="border-0 bg-[#eee9ff] text-[#5b35c7]">{completedTasks.size} of {launchTasks.length}</Badge></div></div><div className="divide-y divide-[#eee8f3]">{launchTasks.map(([title, detail, owner], index) => <button key={title} type="button" onClick={() => toggleTask(index)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-[#fcfaff]"><Checkbox checked={completedTasks.has(index)} className="mt-0.5" /><span className="min-w-0 flex-1"><span className={`block text-sm font-medium ${completedTasks.has(index) ? "text-[#746a80] line-through" : "text-[#2f2447]"}`}>{title}</span><span className="mt-1 block text-xs text-[#847990]">{detail}</span></span><Badge variant="outline" className="shrink-0 border-[#d8c9f4] text-[#655b73]">{owner}</Badge></button>)}</div></section>
    <section className="mb-6 rounded-2xl border border-[#c7b8ed] bg-[#e9f7f6] p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0b8d88]">Setup complete</p><h2 className="mt-1 text-xl font-semibold">7 of 7 required steps ready</h2><p className="mt-1 text-sm text-[#655b73]">The remittance threshold now drives due dates and optional calendar reminders.</p></div><div className="grid size-14 place-items-center rounded-full bg-[#6d4aff] text-white"><Check className="size-6" /></div></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([title, detail, status, Icon], index) => <article key={title} className="rounded-2xl border border-[#ded6e8] bg-white p-5"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff]"><Icon className="size-5" /></span><Badge className="border-0 bg-[#dcfce7] text-[#0f766e]">{status}</Badge></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a8da9]">Step {String(index + 1).padStart(2, "0")}</p><h2 className="mt-1 font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-[#746a80]">{detail}</p>{title === "CRA payroll accounts" && <Button variant="outline" size="sm" onClick={onAccounts} className="mt-4 w-full border-[#cdbfe4] bg-white text-[#5b35c7]">Manage accounts<ChevronRight className="size-4" /></Button>}{title === "Bank file" && <a href="/api/v1/demo/payments-canada-aft" download className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#cdbfe4] bg-white px-3 text-sm font-medium text-[#5b35c7] hover:bg-[#f7f3ff]"><Download className="size-4" />Download test AFT</a>}</article>)}</section>
    <section className="mt-6 rounded-2xl border border-[#f2c879] bg-[#fff8e7] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#9a6d08]" /><div><h2 className="text-sm font-semibold text-[#624a16]">Production gate</h2><p className="mt-1 text-xs leading-5 text-[#725a22]">The generic file uses fictional accounts, a zero client number and TEST controls. It is for workflow rehearsal only. Production requires the client’s bank-specific specifications, assigned identifiers, prenotification/testing and explicit client approval.</p></div></div></section>
  </>;
}

function PayrollAccountsView({ accounts, onAccountsChange }: { accounts: PayrollAccount[]; onAccountsChange: React.Dispatch<React.SetStateAction<PayrollAccount[]>> }) {
  const [selectedAccount, setSelectedAccount] = useState<PayrollAccount | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [rpSuffix, setRpSuffix] = useState("0002");
  const [legalEntity, setLegalEntity] = useState("Prairie North Services Ltd.");
  const [remitterType, setRemitterType] = useState("Monthly");

  function addDraftAccount() {
    const suffix = rpSuffix.replace(/\D/g, "").padStart(4, "0").slice(-4);
    const account: PayrollAccount = {
      id: `PA-${String(accounts.length + 1).padStart(4, "0")}`,
      programAccount: `••••••••• RP${suffix}`,
      legalEntity,
      remitterType,
      status: "Draft",
      employeeCount: 0,
      nextRun: "Not scheduled",
    };
    onAccountsChange((current) => [...current, account]);
    setSelectedAccount(account);
    setAddOpen(false);
  }

  function exportAccounts() {
    const rows = [["payroll_account_id", "program_account_masked", "legal_entity", "remitter_type", "status", "employee_count"], ...accounts.map((account) => [account.id, account.programAccount, account.legalEntity, account.remitterType, account.status, account.employeeCount])];
    downloadText("comcheq-payroll-accounts.csv", rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  return <>
    <PageHeading eyebrow="Customer setup · Account scope" title="CRA payroll accounts" description="Keep every employee, pay run, remittance, ROE, bank file and year-end record attached to the correct BN payroll program account." action={<Button onClick={() => setAddOpen(true)} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]"><Plus className="size-4" />Add payroll account</Button>} />
    <section className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryCard label="Legal entities" value="1" note="Employer workspace" icon={<Building2 />} accent /><SummaryCard label="Payroll accounts" value={String(accounts.length)} note={`${accounts.filter((account) => account.status === "Active").length} active · ${accounts.filter((account) => account.status === "Draft").length} draft`} icon={<ReceiptText />} /><SummaryCard label="Assigned employees" value="4" note="All assigned to RP0001" icon={<Users />} /></section>
    <section className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="flex flex-col justify-between gap-3 border-b border-[#eae3f0] bg-[#faf8ff] px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Account register</h2><p className="mt-1 text-xs text-[#746a80]">Program-account suffixes are visible; the business number remains masked in the working view.</p></div><Button variant="outline" size="sm" onClick={exportAccounts} className="border-[#cdbfe4] bg-white"><Download className="size-4" />Export CSV</Button></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="min-w-[190px] px-5">Payroll account</TableHead><TableHead className="min-w-[230px]">Legal entity</TableHead><TableHead>Remitter</TableHead><TableHead>Employees</TableHead><TableHead>Next run</TableHead><TableHead>Status</TableHead><TableHead className="pr-5 text-right">Details</TableHead></TableRow></TableHeader><TableBody>{accounts.map((account) => <TableRow key={account.id} className="cursor-pointer" onClick={() => setSelectedAccount(account)}><TableCell className="px-5 py-4"><p className="font-mono text-sm font-semibold text-[#5b35c7]">{account.programAccount}</p><p className="mt-1 text-[10px] text-[#847990]">{account.id}</p></TableCell><TableCell className="text-sm font-medium">{account.legalEntity}</TableCell><TableCell className="text-sm">{account.remitterType}</TableCell><TableCell className="font-mono text-sm">{account.employeeCount}</TableCell><TableCell className="text-xs text-[#746a80]">{account.nextRun}</TableCell><TableCell><Badge className={`border-0 ${account.status === "Active" ? "bg-[#dcfce7] text-[#0f766e]" : "bg-[#fff0ce] text-[#7a5d18]"}`}>{account.status}</Badge></TableCell><TableCell className="pr-5 text-right"><Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedAccount(account); }}><Eye className="size-4" />View</Button></TableCell></TableRow>)}</TableBody></Table></div></section>
    <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_330px]"><div className="rounded-2xl border border-[#ded6e8] bg-white p-5"><div className="flex items-center gap-2"><GitBranch className="size-4 text-[#6d4aff]" /><h2 className="font-semibold">Account-scoped record chain</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniStep number="1" title="Employment" detail="Employee assignment and effective dates" /><MiniStep number="2" title="Payroll" detail="Run numbering, CRA and bank controls" /><MiniStep number="3" title="Compliance" detail="ROE, T4 and retained audit evidence" /></div></div><aside className="rounded-2xl bg-gradient-to-br from-[#5633b7] to-[#117d83] p-5 text-white"><ShieldCheck className="size-5" /><h2 className="mt-4 font-semibold">Separation by design</h2><p className="mt-2 text-xs leading-5 text-[#f3efff]">Adding a second account does not mix its employees, remittances, bank totals, documents or billing events with RP0001.</p></aside></section>

    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="border-[#ded6e8] bg-[#faf8ff] sm:max-w-[560px]"><DialogHeader><DialogTitle>Add CRA payroll account</DialogTitle><DialogDescription>Create a session-only draft. Activation will later require administrator approval and CRA account verification.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="Legal entity"><Input value={legalEntity} onChange={(event) => setLegalEntity(event.target.value)} /></Field><Field label="RP suffix"><div className="flex"><span className="inline-flex items-center rounded-l-md border border-r-0 border-[#d2c7e1] bg-[#f1edf5] px-3 font-mono text-sm">RP</span><Input inputMode="numeric" maxLength={4} value={rpSuffix} onChange={(event) => setRpSuffix(event.target.value)} className="rounded-l-none font-mono" /></div></Field><Field label="Remitter type"><Select value={remitterType} onValueChange={setRemitterType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Monthly">Monthly</SelectItem><SelectItem value="Quarterly">Quarterly</SelectItem><SelectItem value="Threshold 1">Threshold 1 accelerated</SelectItem><SelectItem value="Threshold 2">Threshold 2 accelerated</SelectItem></SelectContent></Select></Field><DetailCell label="Initial state" value="Draft · no employees assigned" /></div><DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)} className="border-[#d2c7e1] bg-white">Cancel</Button><Button onClick={addDraftAccount} disabled={!legalEntity.trim() || !rpSuffix.trim()} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">Create draft account</Button></DialogFooter></DialogContent></Dialog>

    <Sheet open={Boolean(selectedAccount)} onOpenChange={(open) => { if (!open) setSelectedAccount(null); }}><SheetContent side="right" className="w-full overflow-y-auto border-[#ded6e8] bg-[#faf8ff] p-0 sm:max-w-[560px]">{selectedAccount && <><SheetHeader className="border-b border-[#ded6e8] bg-white px-6 py-6 text-left"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#6d4aff] to-[#00a9a5] text-white"><ReceiptText className="size-5" /></span><div><SheetTitle>{selectedAccount.programAccount}</SheetTitle><SheetDescription className="mt-1">{selectedAccount.legalEntity} · {selectedAccount.id}</SheetDescription></div></div></SheetHeader><div className="space-y-4 p-5"><section className="grid gap-3 sm:grid-cols-2"><DetailCell label="Status" value={selectedAccount.status} /><DetailCell label="Remitter type" value={selectedAccount.remitterType} /><DetailCell label="Employees" value={String(selectedAccount.employeeCount)} /><DetailCell label="Next pay run" value={selectedAccount.nextRun} /></section><section className="rounded-2xl border border-[#ded6e8] bg-white p-4"><h3 className="text-sm font-semibold">Record ownership</h3><div className="mt-3 space-y-3 text-xs text-[#655b73]">{["Employee assignments", "Numbered pay runs", "CRA remittances", "RBC bank-file controls", "ROE and T4 records", "$2 finalized-payment billing events"].map((item) => <div key={item} className="flex items-center gap-2"><BadgeCheck className="size-4 text-[#00a29a]" />{item}</div>)}</div></section>{selectedAccount.status === "Draft" && <div className="rounded-xl border border-[#d8c9f4] bg-[#f3eeff] p-3 text-xs leading-5 text-[#5e506f]">Draft accounts cannot run payroll. Production activation will require verified CRA details, a pay schedule, remittance settings, bank controls and administrator approval.</div>}</div></>}</SheetContent></Sheet>
  </>;
}

function DepartmentsView() {
  const [rows, setRows] = useState([
    { code: "010", description: "Operations", employees: 1, status: "Active" },
    { code: "020", description: "Field Services", employees: 1, status: "Active" },
    { code: "030", description: "Finance", employees: 1, status: "Active" },
    { code: "040", description: "Customer Support", employees: 1, status: "Active" },
    { code: "050", description: "Administration", employees: 0, status: "Active" },
  ]);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("060");
  const [description, setDescription] = useState("");
  return <><PageHeading eyebrow="Company structure" title="Departments" description="Create numerical departments with plain-language descriptions for employee assignment, costing and reporting." action={<Button onClick={() => setOpen(true)} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]"><Plus className="size-4" />Add department</Button>} /><section className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryCard label="Active departments" value={String(rows.length)} note="Numerical structure" icon={<Building2 />} accent /><SummaryCard label="Assigned employees" value={String(rows.reduce((sum, row) => sum + row.employees, 0))} note="Across all departments" icon={<Users />} /><SummaryCard label="Unassigned departments" value={String(rows.filter((row) => row.employees === 0).length)} note="Available for future use" icon={<Layers3 />} /></section><section className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="border-b border-[#eae3f0] bg-[#faf8ff] px-5 py-4"><h2 className="font-semibold">Department list</h2><p className="mt-1 text-xs text-[#746a80]">Codes remain stable so historical payroll and accounting reports retain their meaning.</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="px-5">Code</TableHead><TableHead>Description</TableHead><TableHead>Employees</TableHead><TableHead>Status</TableHead><TableHead className="pr-5 text-right">Action</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.code}><TableCell className="px-5 py-4"><span className="rounded-lg bg-[#f4f0ff] px-2.5 py-1.5 font-mono text-sm font-bold text-[#6d4aff]">{row.code}</span></TableCell><TableCell className="font-medium">{row.description}</TableCell><TableCell className="font-mono text-sm">{row.employees}</TableCell><TableCell><Badge className="border-0 bg-[#dcfce7] text-[#0f766e]">{row.status}</Badge></TableCell><TableCell className="pr-5 text-right"><Button variant="ghost" size="sm" onClick={() => { setCode(row.code); setDescription(row.description); setOpen(true); }}><FilePenLine className="size-4" />Edit</Button></TableCell></TableRow>)}</TableBody></Table></div></section><Dialog open={open} onOpenChange={setOpen}><DialogContent className="border-[#ded6e8] bg-[#faf8ff] sm:max-w-[520px]"><DialogHeader><DialogTitle>{rows.some((row) => row.code === code) ? "Edit department" : "Add department"}</DialogTitle><DialogDescription>Use a unique numerical code and a description clients will recognize immediately.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-[140px_1fr]"><Field label="Department code"><Input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="font-mono" /></Field><Field label="Description"><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Project Services" /></Field></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)} className="border-[#d2c7e1] bg-white">Cancel</Button><Button disabled={!code || !description.trim()} onClick={() => { setRows((current) => current.some((row) => row.code === code) ? current.map((row) => row.code === code ? { ...row, description: description.trim() } : row) : [...current, { code, description: description.trim(), employees: 0, status: "Active" }]); setDescription(""); setCode(String(Number(code || 50) + 10).padStart(3, "0")); setOpen(false); }} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">Save department</Button></DialogFooter></DialogContent></Dialog></>;
}

function EmployeesView({ onCreateRoe, onViewStatement }: { onCreateRoe: (employeeName: string) => void; onViewStatement: (employeeName: string) => void }) {
  const [selectedEmployee, setSelectedEmployee] = useState<(typeof employees)[number] | null>(null);
  const [newHireOpen, setNewHireOpen] = useState(false);
  const [newHire, setNewHire] = useState({ firstName: "", lastName: "", email: "", startDate: "2026-09-08", payType: "Hourly", payRate: "", department: "010 · Operations", position: "", vacationMethod: "Accrue hours", vacationRate: "4.00" });
  const [savedHire, setSavedHire] = useState<{ name: string; email: string; startDate: string; payType: string; payRate: string; department: string; position: string } | null>(null);
  const [statusByName, setStatusByName] = useState<Record<string, string>>({});
  const [eventEmployee, setEventEmployee] = useState<(typeof employees)[number] | null>(null);
  const [eventType, setEventType] = useState("Transfer department");
  const [eventDepartment, setEventDepartment] = useState("030 · Finance");
  const [eventValue, setEventValue] = useState("");
  const [leaveReason, setLeaveReason] = useState("Medical");
  const [discontinueSalary, setDiscontinueSalary] = useState("N/A");
  const [eventSaved, setEventSaved] = useState<string | null>(null);
  const [departmentByName, setDepartmentByName] = useState<Record<string, string>>({});
  const [positionByName, setPositionByName] = useState<Record<string, string>>({});
  const [payRateByName, setPayRateByName] = useState<Record<string, string>>({});
  const [offboardingEmployee, setOffboardingEmployee] = useState<(typeof employees)[number] | null>(null);
  const [offboardingReason, setOffboardingReason] = useState("A00");
  const [lastDay, setLastDay] = useState("2026-08-28");
  const [finalPayMethod, setFinalPayMethod] = useState("period-end");
  const [offboardingSavedFor, setOffboardingSavedFor] = useState<string | null>(null);
  const [checks, setChecks] = useState({ notice: true, balances: true, property: false, access: false });

  const addDays = (date: Date, days: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
  const formatDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  const lastDayDate = new Date(`${lastDay}T00:00:00Z`);
  const payPeriodEnd = lastDayDate.getUTCDate() <= 15 ? new Date(Date.UTC(lastDayDate.getUTCFullYear(), lastDayDate.getUTCMonth(), 15)) : new Date(Date.UTC(lastDayDate.getUTCFullYear(), lastDayDate.getUTCMonth() + 1, 0));
  const periodDeadline = addDays(payPeriodEnd, 10);
  const employmentDeadline = addDays(lastDayDate, 31);
  const roeDeadline = addDays(payPeriodEnd, 5);
  const readyCount = Object.values(checks).filter(Boolean).length;

  function startOffboarding(employee: (typeof employees)[number]) {
    setSelectedEmployee(null);
    setOffboardingEmployee(employee);
  }

  function startEvent(employee: (typeof employees)[number], type = "Transfer department") {
    setSelectedEmployee(null);
    setEventEmployee(employee);
    setEventType(type);
    setEventValue("");
  }

  function saveEmployeeEvent(employee: (typeof employees)[number]) {
    if (eventType === "Transfer department") setDepartmentByName((current) => ({ ...current, [employee.name]: eventDepartment }));
    if (eventType === "Pay rate change") setPayRateByName((current) => ({ ...current, [employee.name]: eventValue.startsWith("$") ? eventValue : `$${eventValue}` }));
    if (eventType === "Position change") setPositionByName((current) => ({ ...current, [employee.name]: eventValue }));
    if (eventType === "Leave of absence") setStatusByName((current) => ({ ...current, [employee.name]: "On leave" }));
    setEventSaved(`${eventType} saved for ${employee.name}`);
    setEventEmployee(null);
  }

  return <>
    <PageHeading eyebrow="People & lifecycle" title="Employees" description="Hire people, update employment status and manage payroll details without contacting support." action={<Button onClick={() => setNewHireOpen(true)} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]"><Plus className="size-4" />Add employee</Button>} />
    <section className="mb-4 grid gap-3 sm:grid-cols-3"><SummaryCard label="Active employees" value={savedHire ? "5" : "4"} note="Client-managed payroll profiles" icon={<Users />} accent /><SummaryCard label="Payroll account" value="RP0001" note="Account-scoped assignments" icon={<ReceiptText />} /><SummaryCard label="Lifecycle drafts" value={String((offboardingSavedFor ? 1 : 0) + (savedHire ? 1 : 0))} note={savedHire ? `${savedHire.name} onboarding` : offboardingSavedFor ? `${offboardingSavedFor} offboarding` : "No pending changes"} icon={<UserMinus />} /></section>
    <section className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="min-w-[240px] px-5">Employee</TableHead><TableHead>Pay type</TableHead><TableHead>Payroll setup</TableHead><TableHead>Employment</TableHead><TableHead className="pr-5 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{employees.map((employee) => <TableRow key={employee.name} className="cursor-pointer" onClick={() => setSelectedEmployee(employee)}><TableCell className="px-5 py-4"><EmployeeIdentity employee={employee} /></TableCell><TableCell className="text-sm">{employee.payType}</TableCell><TableCell><Badge className="border-0 bg-[#dcfce7] text-[#0f766e]">Complete</Badge></TableCell><TableCell>{offboardingSavedFor === employee.name ? <Badge className="border-0 bg-[#fff0ce] text-[#7a5d18]">Offboarding draft</Badge> : <span className="text-sm">{statusByName[employee.name] ?? "Active"}</span>}</TableCell><TableCell className="pr-5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedEmployee(employee); }}><Eye className="size-4" />View</Button><Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); startOffboarding(employee); }}><UserMinus className="size-4" />Offboard</Button></div></TableCell></TableRow>)}{savedHire && <TableRow><TableCell className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#eee9ff] text-xs font-bold text-[#0f6f74]">{savedHire.name.split(" ").map((part) => part[0]).join("")}</span><div><p className="text-sm font-semibold">{savedHire.name}</p><p className="text-xs text-[#746a80]">{savedHire.email}</p></div></div></TableCell><TableCell>{savedHire.payType}</TableCell><TableCell><Badge className="border-0 bg-[#fff0ce] text-[#7a5d18]">Onboarding</Badge></TableCell><TableCell>Starts {savedHire.startDate}</TableCell><TableCell className="pr-5 text-right text-xs text-[#746a80]">Complete TD1 & banking</TableCell></TableRow>}</TableBody></Table></div></section>

    <Sheet open={Boolean(selectedEmployee)} onOpenChange={(open) => { if (!open) setSelectedEmployee(null); }}>
      <SheetContent side="right" className="w-full overflow-y-auto border-[#ded6e8] bg-[#faf8ff] p-0 sm:max-w-[620px]">
        {selectedEmployee && <><SheetHeader className="border-b border-[#ded6e8] bg-white px-6 py-6 text-left"><div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#6d4aff] to-[#00a9a5] font-mono text-sm font-bold text-white">{selectedEmployee.initials}</span><div><div className="flex flex-wrap items-center gap-2"><SheetTitle className="text-xl text-[#2f2447]">{selectedEmployee.name}</SheetTitle><Badge className="border-0 bg-[#dcfce7] text-[#0f6f74]">{statusByName[selectedEmployee.name] ?? "Active"}</Badge></div><SheetDescription className="mt-1">{positionByName[selectedEmployee.name] ?? selectedEmployee.role} · {employeeProfiles[selectedEmployee.name].id}</SheetDescription></div></div></SheetHeader>
          <Tabs defaultValue="employment" className="p-5"><TabsList className="grid w-full grid-cols-4 bg-[#eee9ff]"><TabsTrigger value="employment">Employment</TabsTrigger><TabsTrigger value="payroll">Payroll</TabsTrigger><TabsTrigger value="history">History</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger></TabsList>
            <TabsContent value="employment" className="mt-4 space-y-4"><section className="grid gap-3 sm:grid-cols-2">{[["Employee ID", employeeProfiles[selectedEmployee.name].id], ["Hire date", employeeProfiles[selectedEmployee.name].hireDate], ["Department", departmentByName[selectedEmployee.name] ?? employeeProfiles[selectedEmployee.name].department], ["Province", employeeProfiles[selectedEmployee.name].province], ["Pay type", selectedEmployee.payType], ["Payroll account", "RP0001"]].map(([label, value]) => <DetailCell key={label} label={label} value={value} />)}</section><section className="rounded-2xl border border-[#ded6e8] bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Document an employee event</h3><p className="mt-1 text-xs leading-5 text-[#746a80]">Choose what happened. Comcheq will show only the fields needed for that event.</p></div><CalendarRange className="size-5 text-[#6d4aff]" /></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{["Transfer department", "Pay rate change", "Position change", "Leave of absence", "Termination"].map((event) => <button type="button" key={event} onClick={() => event === "Termination" ? startOffboarding(selectedEmployee) : startEvent(selectedEmployee, event)} className="flex items-center justify-between rounded-xl border border-[#ded6e8] bg-[#fcfaff] px-3 py-3 text-left text-xs font-semibold transition hover:border-[#b9a4f2] hover:bg-[#f4f0ff]"><span>{event}</span><ChevronRight className="size-4 text-[#8c7b9c]" /></button>)}</div>{eventSaved && <div className="mt-4 rounded-xl bg-[#e9f7f6] p-3 text-xs text-[#0f6f74]"><BadgeCheck className="mr-2 inline size-4" />{eventSaved}</div>}</section></TabsContent>
            <TabsContent value="payroll" className="mt-4 space-y-4"><section className="grid gap-3 sm:grid-cols-2"><DetailCell label="Pay rate" value={payRateByName[selectedEmployee.name] ?? employeeProfiles[selectedEmployee.name].payRate} /><DetailCell label="Bank profile" value={employeeProfiles[selectedEmployee.name].bank} /><DetailCell label="TD1 setup" value={employeeProfiles[selectedEmployee.name].td1} /><DetailCell label="Pension" value={employeeProfiles[selectedEmployee.name].pension} /></section><section className="rounded-2xl border border-[#ded6e8] bg-white p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Current run 17</h3><p className="mt-1 text-xs text-[#746a80]">August 16-31, 2026</p></div><strong className="font-mono text-lg text-[#6d4aff]">{currency.format(selectedEmployee.gross - selectedEmployee.tax - selectedEmployee.cpp - selectedEmployee.ei - selectedEmployee.other)}</strong></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><DetailCell label="Gross" value={currency.format(selectedEmployee.gross)} /><DetailCell label="Tax" value={currency.format(selectedEmployee.tax)} /><DetailCell label="CPP + EI" value={currency.format(selectedEmployee.cpp + selectedEmployee.ei)} /></div></section><VacationSetup key={selectedEmployee.name} hireDate={employeeProfiles[selectedEmployee.name].hireDate} /></TabsContent>
            <TabsContent value="history" className="mt-4 space-y-3">{priorRuns.slice(0, 3).map((run, index) => <article key={run.run} className="flex items-center justify-between rounded-2xl border border-[#ded6e8] bg-white p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f4f0ff] font-mono text-sm font-bold text-[#6d4aff]">{run.run}</span><div><p className="text-sm font-semibold">{run.period}</p><p className="mt-0.5 text-xs text-[#746a80]">Paid {run.payDate}</p></div></div><div className="text-right"><p className="font-mono text-sm font-semibold">{currency.format(selectedEmployee.gross * (1 - index * 0.018))}</p><p className="text-[10px] uppercase tracking-[0.1em] text-[#0f766e]">Approved</p></div></article>)}</TabsContent>
            <TabsContent value="documents" className="mt-4 space-y-3"><button type="button" onClick={() => onViewStatement(selectedEmployee.name)} className="flex w-full items-center gap-3 rounded-2xl border border-[#ded6e8] bg-white p-4 text-left hover:border-[#b9a4f2]"><span className="grid size-10 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff]"><FileText className="size-5" /></span><span className="flex-1"><strong className="block text-sm">Pay statement</strong><span className="mt-1 block text-xs text-[#746a80]">View run 17 PDF</span></span><ChevronRight className="size-4" /></button><button type="button" onClick={() => onCreateRoe(selectedEmployee.name)} className="flex w-full items-center gap-3 rounded-2xl border border-[#ded6e8] bg-white p-4 text-left hover:border-[#b9a4f2]"><span className="grid size-10 place-items-center rounded-xl bg-[#e9f7f6] text-[#0f6f74]"><FilePenLine className="size-5" /></span><span className="flex-1"><strong className="block text-sm">Record of Employment</strong><span className="mt-1 block text-xs text-[#746a80]">Create or edit from approved history</span></span><ChevronRight className="size-4" /></button></TabsContent>
          </Tabs></>}
      </SheetContent>
    </Sheet>

    <Dialog open={Boolean(eventEmployee)} onOpenChange={(open) => { if (!open) setEventEmployee(null); }}><DialogContent className="max-h-[92vh] overflow-y-auto border-[#ded6e8] bg-[#faf8ff] sm:max-w-[700px]">{eventEmployee && <><DialogHeader><DialogTitle>{eventType}</DialogTitle><DialogDescription>{eventEmployee.name} · Record the effective-dated change. Previously approved payroll remains unchanged.</DialogDescription></DialogHeader><div className="grid gap-2 sm:grid-cols-5">{["Transfer department", "Pay rate change", "Position change", "Leave of absence", "Termination"].map((event) => <button type="button" key={event} onClick={() => { if (event === "Termination") { setEventEmployee(null); startOffboarding(eventEmployee); } else { setEventType(event); setEventValue(""); } }} className={`rounded-xl border p-2 text-center text-[10px] font-semibold leading-4 ${eventType === event ? "border-[#6d4aff] bg-[#eee9ff] text-[#5b35c7]" : "border-[#ded6e8] bg-white text-[#746a80]"}`}>{event}</button>)}</div><section className="mt-2 grid gap-4 rounded-2xl border border-[#ded6e8] bg-white p-4 sm:grid-cols-2"><Field label="Effective date"><Input type="date" defaultValue="2026-09-01" /></Field>{eventType === "Transfer department" && <Field label="New department"><Select value={eventDepartment} onValueChange={setEventDepartment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{departments.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent></Select></Field>}{eventType === "Pay rate change" && <Field label="New pay rate"><Input inputMode="decimal" placeholder="Enter hourly rate or annual salary" value={eventValue} onChange={(event) => setEventValue(event.target.value)} /></Field>}{eventType === "Position change" && <Field label="New position title"><Input placeholder="Enter position" value={eventValue} onChange={(event) => setEventValue(event.target.value)} /></Field>}{eventType === "Leave of absence" && <><Field label="Leave reason"><Select value={leaveReason} onValueChange={setLeaveReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Medical", "Personal", "School", "WCB", "Maternity", "Paternity", "Suspension"].map((reason) => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}</SelectContent></Select></Field><Field label="Discontinue salary"><Select value={discontinueSalary} onValueChange={setDiscontinueSalary}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="N/A">N/A</SelectItem></SelectContent></Select></Field><Field label="Expected return (optional)"><Input type="date" /></Field></>}</section><div className="rounded-xl border border-[#c7b8ed] bg-[#f3eeff] p-3 text-xs leading-5 text-[#5e506f]">{eventType === "Transfer department" ? `Move payroll costing and reporting to ${eventDepartment} from the effective date.` : eventType === "Leave of absence" ? `${leaveReason} leave · Discontinue salary: ${discontinueSalary}.` : "The new value becomes effective on the selected date and is retained in employee history."}</div><DialogFooter><Button variant="outline" onClick={() => setEventEmployee(null)} className="border-[#d2c7e1] bg-white">Cancel</Button><Button disabled={(eventType === "Pay rate change" || eventType === "Position change") && !eventValue.trim()} onClick={() => saveEmployeeEvent(eventEmployee)} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">Save employee event</Button></DialogFooter></>}</DialogContent></Dialog>

    <Dialog open={Boolean(offboardingEmployee)} onOpenChange={(open) => { if (!open) setOffboardingEmployee(null); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#ded6e8] bg-[#faf8ff] sm:max-w-[820px]">
        {offboardingEmployee && <><DialogHeader><DialogTitle className="text-xl text-[#2f2447]">Offboard {offboardingEmployee.name}</DialogTitle><DialogDescription>Guided Alberta final-pay, ROE, access and record-retention workflow. Nothing is finalized until reviewed.</DialogDescription></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-4">{[["1", "Employment", true], ["2", "Final pay", checks.balances], ["3", "ROE", checks.property], ["4", "Close access", checks.access]].map(([step, label, complete]) => <div key={String(step)} className={`rounded-xl border p-3 ${complete ? "border-[#a8ddd6] bg-[#e9f7f6]" : "border-[#ded6e8] bg-white"}`}><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#81758f]">Step {step}</span><p className="mt-1 text-xs font-semibold">{label}</p></div>)}</div>
          <section className="grid gap-3 rounded-2xl border border-[#ded6e8] bg-white p-4 sm:grid-cols-3"><Field label="Reason"><Select value={offboardingReason} onValueChange={setOffboardingReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="A00">A00 · Shortage of work</SelectItem><SelectItem value="E00">E00 · Quit</SelectItem><SelectItem value="M00">M00 · Dismissal</SelectItem><SelectItem value="N00">N00 · Leave of absence</SelectItem></SelectContent></Select></Field><Field label="Last day worked"><Input type="date" value={lastDay} onChange={(event) => setLastDay(event.target.value)} /></Field><Field label="Final-pay timing"><Select value={finalPayMethod} onValueChange={setFinalPayMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="period-end">10 days after period end</SelectItem><SelectItem value="last-day">31 days after last day</SelectItem></SelectContent></Select></Field></section>
          <section className="grid gap-4 lg:grid-cols-[1fr_290px]"><div className="rounded-2xl border border-[#ded6e8] bg-white p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Final earnings audit</h3><p className="mt-1 text-xs text-[#746a80]">Wages and every outstanding entitlement stay itemized.</p></div><Badge className="border-0 bg-[#fff0ce] text-[#7a5d18]">Review</Badge></div><div className="mt-4 space-y-2 text-sm">{[["Regular wages", "$2,400.00"], ["Banked overtime", "$0.00"], ["Vacation pay owed", "$684.20"], ["General holiday pay", "$0.00"], ["Termination pay", "$0.00"]].map(([label, value]) => <div key={label} className="flex justify-between border-b border-[#ece7f3] py-2"><span className="text-[#746a80]">{label}</span><strong className="font-mono">{value}</strong></div>)}<div className="flex justify-between pt-2"><strong>Gross final earnings</strong><strong className="font-mono text-[#6d4aff]">$3,084.20</strong></div></div></div><div className="rounded-2xl bg-gradient-to-br from-[#5f3bd6] to-[#00a9a5] p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e8ddff]">Deadlines</p><p className="mt-3 text-xs text-[#efeaff]">Selected final-pay deadline</p><p className="mt-1 font-mono text-lg font-bold">{formatDate(finalPayMethod === "period-end" ? periodDeadline : employmentDeadline)}</p><div className="my-4 h-px bg-white/20" /><p className="text-xs text-[#efeaff]">Electronic ROE due</p><p className="mt-1 font-mono text-lg font-bold">{formatDate(roeDeadline)}</p><p className="mt-3 text-[11px] leading-4 text-[#efeaff]">Semi-monthly deadline: five calendar days after the pay period ends.</p></div></section>
          <section className="rounded-2xl border border-[#ded6e8] bg-white p-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Completion checklist</h3><p className="mt-1 text-xs text-[#746a80]">{readyCount} of 4 controls ready</p></div><ListChecks className="size-5 text-[#00a29a]" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{([{ key: "notice", label: "Written notice / resignation retained" }, { key: "balances", label: "Final earnings and deductions reviewed" }, { key: "property", label: "ROE reason and separation payments checked" }, { key: "access", label: "Company access and property return scheduled" }] as const).map((item) => <label key={item.key} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#faf8ff] p-3 text-xs leading-5"><Checkbox checked={checks[item.key]} onCheckedChange={(checked) => setChecks((current) => ({ ...current, [item.key]: Boolean(checked) }))} className="mt-0.5" /><span>{item.label}</span></label>)}</div></section>
          <div className="rounded-xl border border-[#d8c9f4] bg-[#f3eeff] p-3 text-xs leading-5 text-[#5e506f]">Alberta permits final earnings within 10 calendar days after the pay period ends or 31 calendar days after the last day. Comcheq keeps both dates visible and retains the selected method with the audit record. <a href="https://www.alberta.ca/employment-standards-termination-and-lay-off" target="_blank" rel="noreferrer" className="font-semibold text-[#5b35c7] hover:underline">Review Alberta requirements</a></div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => onCreateRoe(offboardingEmployee.name)} className="border-[#cdbfe4] bg-white"><FilePenLine className="size-4" />Open ROE draft</Button><Button onClick={() => { setOffboardingSavedFor(offboardingEmployee.name); setOffboardingEmployee(null); }} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">Save offboarding draft</Button></DialogFooter></>}
      </DialogContent>
    </Dialog>

    <Dialog open={newHireOpen} onOpenChange={setNewHireOpen}><DialogContent className="max-h-[92vh] overflow-y-auto border-[#ded6e8] bg-[#faf8ff] sm:max-w-[760px]"><DialogHeader><DialogTitle>Add a new employee</DialogTitle><DialogDescription>Create the employment, department, pay and vacation setup in one guided draft.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="First name"><Input value={newHire.firstName} onChange={(event) => setNewHire((current) => ({ ...current, firstName: event.target.value }))} /></Field><Field label="Last name"><Input value={newHire.lastName} onChange={(event) => setNewHire((current) => ({ ...current, lastName: event.target.value }))} /></Field><Field label="Email"><Input type="email" value={newHire.email} onChange={(event) => setNewHire((current) => ({ ...current, email: event.target.value }))} /></Field><Field label="Start date"><Input type="date" value={newHire.startDate} onChange={(event) => setNewHire((current) => ({ ...current, startDate: event.target.value }))} /></Field><Field label="Department"><Select value={newHire.department} onValueChange={(value) => setNewHire((current) => ({ ...current, department: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{departments.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent></Select></Field><Field label="Position"><Input value={newHire.position} onChange={(event) => setNewHire((current) => ({ ...current, position: event.target.value }))} placeholder="Position title" /></Field><Field label="Pay type"><Select value={newHire.payType} onValueChange={(value) => setNewHire((current) => ({ ...current, payType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Hourly">Hourly</SelectItem><SelectItem value="Salary">Salary</SelectItem></SelectContent></Select></Field><Field label={newHire.payType === "Hourly" ? "Hourly rate" : "Annual salary"}><Input inputMode="decimal" placeholder={newHire.payType === "Hourly" ? "30.00" : "75000.00"} value={newHire.payRate} onChange={(event) => setNewHire((current) => ({ ...current, payRate: event.target.value }))} /></Field><Field label="Vacation method"><Select value={newHire.vacationMethod} onValueChange={(value) => setNewHire((current) => ({ ...current, vacationMethod: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Accrue hours">Accrue hours</SelectItem><SelectItem value="Pay each cheque">Pay each cheque</SelectItem></SelectContent></Select></Field><Field label="Vacation percentage"><Input inputMode="decimal" value={newHire.vacationRate} onChange={(event) => setNewHire((current) => ({ ...current, vacationRate: event.target.value }))} /></Field></div><div className="rounded-xl border border-[#c7b8ed] bg-[#f3eeff] p-3 text-xs leading-5 text-[#5e506f]">The statutory minimum is checked against the start date. Banking and TD1 details remain the only outstanding onboarding items.</div><DialogFooter><Button variant="outline" onClick={() => setNewHireOpen(false)} className="border-[#d2c7e1] bg-white">Cancel</Button><Button disabled={!newHire.firstName.trim() || !newHire.lastName.trim() || !newHire.email.trim() || !newHire.payRate.trim() || !newHire.position.trim()} onClick={() => { setSavedHire({ name: `${newHire.firstName.trim()} ${newHire.lastName.trim()}`, email: newHire.email.trim(), startDate: newHire.startDate, payType: newHire.payType, payRate: newHire.payRate, department: newHire.department, position: newHire.position.trim() }); setNewHireOpen(false); }} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">Save onboarding draft</Button></DialogFooter></DialogContent></Dialog>
  </>;
}

function VacationSetup({ hireDate }: { hireDate: string }) {
  const [method, setMethod] = useState("Accrue hours");
  const hire = new Date(hireDate);
  const fiveYearDate = new Date(hire);
  fiveYearDate.setFullYear(hire.getFullYear() + 5);
  const minimum = fiveYearDate <= new Date("2026-09-01") ? 6 : 4;
  const [enteredRate, setEnteredRate] = useState(minimum.toFixed(2));
  const entered = Number(enteredRate);
  const applied = Number.isFinite(entered) ? Math.max(minimum, entered) : minimum;
  const nextReview = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(fiveYearDate);
  return <section className="rounded-2xl border border-[#c7b8ed] bg-[#fbf9ff] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Vacation setup</h3><p className="mt-1 text-xs leading-5 text-[#746a80]">The statutory minimum is derived from the employee’s start date and updates automatically.</p></div><Badge className="border-0 bg-[#e9f7f6] text-[#0f6f74]">{minimum.toFixed(2)}% minimum</Badge></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Payment method"><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Accrue hours">Accrue hours for future time off</SelectItem><SelectItem value="Pay each cheque">Pay vacation on each cheque</SelectItem></SelectContent></Select></Field><Field label="Vacation percentage"><Input inputMode="decimal" value={enteredRate} onChange={(event) => setEnteredRate(event.target.value)} /></Field></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><DetailCell label="Rate applied" value={`${applied.toFixed(2)}%`} /><DetailCell label={minimum === 4 ? "Automatic increase review" : "Statutory service level"} value={minimum === 4 ? nextReview : "Five years or more"} /></div><div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-[#655b73]">{method === "Accrue hours" ? "Vacation hours accrue each pay period. Approved vacation time automatically reduces the employee’s available balance." : "Vacation pay is calculated at the applied percentage and paid with every cheque; no hours balance is maintained."}</div>{Number.isFinite(entered) && entered < minimum && <p className="mt-3 text-[11px] font-semibold text-[#9a6d08]">The entered rate is below the statutory minimum, so Comcheq applies {minimum.toFixed(2)}%.</p>}<p className="mt-3 text-[11px] leading-4 text-[#847990]">A higher client-entered rate is preserved when the statutory minimum increases.</p></section>;
}

type PayComponent = { name: string; category: string; method: string; value: string; tax: string };

function PayComponentsView() {
  const [items, setItems] = useState<PayComponent[]>([
    { name: "Regular earnings", category: "Earning", method: "Rate", value: "Employee rate", tax: "Taxable" },
    { name: "Car allowance", category: "Allowance", method: "Dollar", value: "$375.00", tax: "Taxable" },
    { name: "Group benefits", category: "Benefit", method: "Imported dollar", value: "Monthly import", tax: "Mixed" },
    { name: "Employee pension", category: "Deduction", method: "Percentage", value: "4.00%", tax: "Registered" },
  ]);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<PayComponent>({ name: "", category: "Earning", method: "Dollar", value: "", tax: "Taxable" });
  const [importedFile, setImportedFile] = useState<string | null>(null);

  return <>
    <PageHeading eyebrow="Company setup" title="Pay components" description="Define straightforward earnings, allowances, benefits and deductions using a dollar value, rate or percentage." action={<Button onClick={() => setAddOpen(true)} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]"><Plus className="size-4" />Add component</Button>} />
    <section className="mb-5 grid gap-3 sm:grid-cols-4"><SummaryCard label="Earnings" value={String(items.filter((item) => item.category === "Earning").length)} note="Rates and flat amounts" icon={<Banknote />} accent /><SummaryCard label="Allowances" value={String(items.filter((item) => item.category === "Allowance").length)} note="Taxable or non-taxable" icon={<WalletCards />} /><SummaryCard label="Benefits" value={String(items.filter((item) => item.category === "Benefit").length)} note="Import-first values" icon={<Upload />} /><SummaryCard label="Deductions" value={String(items.filter((item) => item.category === "Deduction").length)} note="Dollar or percentage" icon={<Layers3 />} /></section>
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="flex flex-col justify-between gap-3 border-b border-[#eae3f0] bg-[#faf8ff] px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Company definitions</h2><p className="mt-1 text-xs text-[#746a80]">Simple, effective-dated rules that your payroll team controls.</p></div><label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#cdbfe4] bg-white px-3 text-sm font-medium text-[#5b35c7]"><Upload className="size-4" />{importedFile ? "Benefits imported" : "Import benefit amounts"}<input type="file" accept=".csv,.xlsx" className="sr-only" onChange={(event) => setImportedFile(event.target.files?.[0]?.name ?? null)} /></label></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="px-5">Name</TableHead><TableHead>Category</TableHead><TableHead>Calculation</TableHead><TableHead>Value</TableHead><TableHead>Tax treatment</TableHead><TableHead className="pr-5">Status</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={`${item.category}-${item.name}`}><TableCell className="px-5 py-4 font-medium">{item.name}</TableCell><TableCell>{item.category}</TableCell><TableCell className="text-sm text-[#746a80]">{item.method}</TableCell><TableCell className="font-mono text-sm">{item.value}</TableCell><TableCell className="text-sm">{item.tax}</TableCell><TableCell className="pr-5"><Badge className="border-0 bg-[#dcfce7] text-[#0f766e]">Active</Badge></TableCell></TableRow>)}</TableBody></Table></div></section>
    <section className="grid gap-4 lg:grid-cols-[1fr_330px]"><div className="rounded-2xl border border-[#ded6e8] bg-white p-5"><div className="flex items-center gap-2"><Upload className="size-4 text-[#6d4aff]" /><h2 className="font-semibold">Monthly benefit import</h2></div><p className="mt-2 text-sm leading-6 text-[#746a80]">Load the provider’s employee-level dollar deductions and adjustments for the month. Comcheq validates employee IDs, dates and totals before applying them to payroll.</p>{importedFile && <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#e9f7f6] p-3 text-xs text-[#0f6f74]"><BadgeCheck className="size-4" /><strong>{importedFile}</strong> ready for validation</div>}</div><aside className="rounded-2xl bg-gradient-to-br from-[#5633b7] to-[#117d83] p-5 text-white"><LockKeyhole className="size-5" /><h2 className="mt-4 font-semibold">Intentionally simple</h2><p className="mt-2 text-xs leading-5 text-[#f3efff]">No benefit-plan calculation engine. Use transparent dollar amounts, rates, percentages or provider-supplied monthly values.</p></aside></section>
    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="border-[#ded6e8] bg-[#faf8ff] sm:max-w-[620px]"><DialogHeader><DialogTitle>Add pay component</DialogTitle><DialogDescription>Create a simple company-controlled earning, allowance, benefit or deduction.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="Name"><Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Category"><Select value={draft.category} onValueChange={(value) => setDraft((current) => ({ ...current, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Earning", "Allowance", "Benefit", "Deduction"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field><Field label="Calculation"><Select value={draft.method} onValueChange={(value) => setDraft((current) => ({ ...current, method: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Dollar">Fixed dollar</SelectItem><SelectItem value="Rate">Hourly / unit rate</SelectItem><SelectItem value="Percentage">Percentage</SelectItem><SelectItem value="Imported dollar">Imported dollar</SelectItem></SelectContent></Select></Field><Field label="Value"><Input placeholder={draft.method === "Percentage" ? "4.00%" : "375.00"} value={draft.value} onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))} /></Field><Field label="Tax treatment"><Select value={draft.tax} onValueChange={(value) => setDraft((current) => ({ ...current, tax: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Taxable">Taxable</SelectItem><SelectItem value="Non-taxable">Non-taxable</SelectItem><SelectItem value="Registered">Registered deduction</SelectItem><SelectItem value="Mixed">Provider-defined / mixed</SelectItem></SelectContent></Select></Field><DetailCell label="Effective date" value="Next open pay run" /></div><DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)} className="border-[#d2c7e1] bg-white">Cancel</Button><Button disabled={!draft.name.trim() || !draft.value.trim()} onClick={() => { setItems((current) => [...current, draft]); setDraft({ name: "", category: "Earning", method: "Dollar", value: "", tax: "Taxable" }); setAddOpen(false); }} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">Add component</Button></DialogFooter></DialogContent></Dialog>
  </>;
}

function ExtraRunView({ onBack }: { onBack: () => void }) {
  const [employeeName, setEmployeeName] = useState("Noah Williams");
  const [hours, setHours] = useState("4.00");
  const [rate, setRate] = useState("30.00");
  const [reason, setReason] = useState("Underpayment correction");
  const [approved, setApproved] = useState(false);
  const gross = Math.max(0, Number(hours) || 0) * Math.max(0, Number(rate) || 0);
  const estimatedNet = gross * 0.72;
  function downloadExtraEft() {
    downloadText("comcheq-extra-run-18-eft-test.txt", ["COMCHEQ EXTRA RUN EFT — TEST", "Run: 18", `Employee: ${employeeName}`, `Reason: ${reason}`, `Gross: ${gross.toFixed(2)}`, `Estimated net control: ${estimatedNet.toFixed(2)}`, "Client uploads this file directly to its bank."].join("\n"));
  }
  return <>
    <PageHeading eyebrow="Off-cycle payroll" title="Extra run" description="Correct an underpayment in a few steps, create the EFT file and send it directly to your bank." action={<Button variant="outline" onClick={onBack} className="border-[#d2c7e1] bg-white">Back to regular run</Button>} />
    <section className="mb-5 rounded-2xl bg-gradient-to-br from-[#6d4aff] via-[#8066ef] to-[#00a9a5] p-5 text-white sm:p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><RunNumber value="18" light /><div><Badge className="border-0 bg-white/15 text-white">Extra run</Badge><h2 className="mt-2 text-xl font-semibold">One employee correction</h2><p className="mt-1 text-sm text-[#eee9ff]">No manual cheque required</p></div></div><div className="rounded-2xl bg-white/12 p-4 text-right"><p className="text-xs text-[#eee9ff]">Run fee</p><p className="mt-1 font-mono text-2xl font-bold">$12.00</p><p className="text-[11px] text-[#eee9ff]">$10 base + 1 × $2 transaction</p></div></div></section>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="rounded-2xl border border-[#ded6e8] bg-white p-5"><div className="flex items-center gap-2"><WalletCards className="size-5 text-[#6d4aff]" /><h2 className="font-semibold">Enter the correction</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Employee"><Select value={employeeName} onValueChange={(value) => { setEmployeeName(value); setApproved(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.name} value={employee.name}>{employee.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Reason"><Select value={reason} onValueChange={(value) => { setReason(value); setApproved(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Underpayment correction">Underpayment correction</SelectItem><SelectItem value="Missed hours">Missed hours</SelectItem><SelectItem value="Late adjustment">Late adjustment</SelectItem></SelectContent></Select></Field><Field label="Hours"><Input type="number" min="0" step="0.25" value={hours} onChange={(event) => { setHours(event.target.value); setApproved(false); }} /></Field><Field label="Hourly rate"><Input type="number" min="0" step="0.01" value={rate} onChange={(event) => { setRate(event.target.value); setApproved(false); }} /></Field></div><div className="mt-5 grid gap-3 rounded-2xl bg-[#f7f4fa] p-4 sm:grid-cols-3"><DetailCell label="Gross correction" value={currency.format(gross)} /><DetailCell label="Estimated net" value={currency.format(estimatedNet)} /><DetailCell label="Pay date" value="Next banking day" /></div><div className="mt-5 flex flex-col justify-between gap-3 border-t border-[#eae3f0] pt-5 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-[#746a80]">Final statutory deductions calculate when the run is reviewed.</p><Button disabled={gross <= 0 || approved} onClick={() => setApproved(true)} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]">{approved ? "Extra run approved" : "Calculate and approve"}</Button></div></section><aside className="space-y-4"><section className="rounded-2xl border border-[#ded6e8] bg-white p-5"><h2 className="font-semibold">EFT bank file</h2><p className="mt-2 text-xs leading-5 text-[#746a80]">Once approved, download the bank file and upload it through your normal business-banking process.</p><Button onClick={downloadExtraEft} disabled={!approved} className="mt-5 w-full bg-[#00a9a5] text-white hover:bg-[#0b8d88]"><Landmark className="size-4" />Generate EFT file</Button></section><section className="rounded-2xl border border-[#c7b8ed] bg-[#f3eeff] p-5"><ShieldCheck className="size-5 text-[#6d4aff]" /><h2 className="mt-3 font-semibold">You keep control</h2><p className="mt-2 text-xs leading-5 text-[#655b73]">Comcheq prepares the payroll outputs. Your company releases the bank file and pays its own remittances.</p></section></aside></div>
  </>;
}

function TimeView({ entries, ready, onChange, onReady, onPayroll }: { entries: Record<string, { regular: string; overtime: string; vacation: string }>; ready: boolean; onChange: (employee: "Noah Williams" | "Liam Martin", field: "regular" | "overtime" | "vacation", value: string) => void; onReady: () => void; onPayroll: () => void }) {
  return <>
    <PageHeading eyebrow="Pay run 17 · Input" title="Enter hourly time" description="August 16–31, 2026. Salaried employees flow to payroll automatically." action={<Button onClick={onPayroll} variant="outline" className="border-[#d2c7e1] bg-white">Open pay run<ChevronRight className="size-4" /></Button>} />
    <section className="mb-4 grid gap-3 sm:grid-cols-3"><SummaryCard label="Hourly employees" value="2" note="Require time review" icon={<Users />} /><SummaryCard label="Regular hours" value="152.00" note="Current pay period" icon={<Clock3 />} accent /><SummaryCard label="Overtime hours" value="2.50" note="Paid at configured rate" icon={<Clock3 />} /></section>
    <section className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="border-b border-[#eae3f0] px-5 py-4"><h2 className="font-semibold">Time entries</h2><p className="mt-1 text-xs text-[#746a80]">Save the period as ready before final payroll approval.</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="min-w-[230px] px-5">Employee</TableHead><TableHead className="min-w-[130px]">Regular</TableHead><TableHead className="min-w-[130px]">Overtime</TableHead><TableHead className="min-w-[130px]">Vacation</TableHead><TableHead className="pr-5">Status</TableHead></TableRow></TableHeader><TableBody>{(["Noah Williams", "Liam Martin"] as const).map((name) => { const employee = employees.find((item) => item.name === name)!; return <TableRow key={name}><TableCell className="px-5 py-4"><EmployeeIdentity employee={employee} /></TableCell>{(["regular", "overtime", "vacation"] as const).map((field) => <TableCell key={field}><Input type="number" step="0.25" min="0" value={entries[name][field]} onChange={(event) => onChange(name, field, event.target.value)} className="h-9 w-28 font-mono" aria-label={`${name} ${field} hours`} /></TableCell>)}<TableCell className="pr-5"><Badge className={`border-0 ${ready ? "bg-[#dcfce7] text-[#0f766e]" : "bg-[#fff0ce] text-[#7a5d18]"}`}>{ready ? "Ready" : "Changed"}</Badge></TableCell></TableRow>; })}</TableBody></Table></div><div className="flex flex-col justify-between gap-3 border-t border-[#eae3f0] bg-[#fcfaff] px-5 py-4 sm:flex-row sm:items-center"><p className="text-xs text-[#746a80]">All changes are included when pay run 17 is recalculated.</p><Button onClick={onReady} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]" disabled={ready}>{ready ? "Time marked ready" : "Save and mark ready"}</Button></div></section>
  </>;
}

const albertaHolidays2026 = [
  ["New Year’s Day", "January 1, 2026"], ["Alberta Family Day", "February 16, 2026"], ["Good Friday", "April 3, 2026"], ["Victoria Day", "May 18, 2026"], ["Canada Day", "July 1, 2026"], ["Labour Day", "September 7, 2026"], ["Thanksgiving Day", "October 12, 2026"], ["Remembrance Day", "November 11, 2026"], ["Christmas Day", "December 25, 2026"],
] as const;

function StatHolidaysView({ onPayroll }: { onPayroll: () => void }) {
  const [periodMethod, setPeriodMethod] = useState("holiday");
  const [absenceAuthorized, setAbsenceAuthorized] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [optional, setOptional] = useState<Record<string, boolean>>({ "Heritage Day": true, "National Day for Truth and Reconciliation": false, "Boxing Day": false });
  const employeeResults = [
    { name: "Avery Chen", schedule: "Monday–Friday", workdays: 126, regular: "Yes", worked: "No", result: "Salary continues", amount: 0, status: "Ready", evidence: "Salaried employee · Labour Day is a regular Monday workday." },
    { name: "Noah Williams", schedule: "Irregular", workdays: 86, regular: "Yes · 7 of 9", worked: "No", result: "Average daily wage", amount: 240, status: "Ready", evidence: "$4,800 eligible wages ÷ 20 days worked = $240.00." },
    { name: "Priya Singh", schedule: "Monday–Friday", workdays: 131, regular: "Yes", worked: "No", result: "Salary continues", amount: 0, status: "Ready", evidence: "Salaried employee · full salary continues for the regular workday." },
    { name: "Liam Martin", schedule: "Irregular", workdays: 95, regular: "Yes · 6 of 9", worked: "No", result: absenceAuthorized ? "Average daily wage" : "Attendance review", amount: absenceAuthorized ? 235 : 0, status: absenceAuthorized ? "Ready" : "Review", evidence: absenceAuthorized ? "$4,700 eligible wages ÷ 20 days worked = $235.00. Absence consent retained." : "Absent on the first scheduled day after the holiday. Employer consent must be confirmed." },
  ];
  const selected = employeeResults.find((item) => item.name === selectedName) ?? null;
  const total = employeeResults.reduce((sum, item) => sum + item.amount, 0);
  return <><PageHeading eyebrow="Alberta employment standards" title="Stat Holiday Centre" description="Load Alberta holidays, test eligibility from payroll history and add the correct earning to payroll." action={<Button onClick={onPayroll} variant="outline" className="border-[#d2c7e1] bg-white">Back to payroll<ChevronRight className="size-4" /></Button>} /><section className="mb-6 overflow-hidden rounded-2xl border border-[#f5b4d4] bg-white shadow-[0_16px_45px_rgba(192,38,211,0.08)]"><div className="flex flex-col justify-between gap-4 bg-gradient-to-r from-[#c026d3] via-[#db2777] to-[#0f9f9a] p-5 text-white sm:flex-row sm:items-center"><div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-white/15"><CalendarDays className="size-7" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Next general holiday</p><h2 className="mt-1 text-2xl font-semibold">Labour Day</h2><p className="mt-1 text-sm text-white/85">Monday, September 7, 2026</p></div></div><div className="rounded-2xl bg-white/12 px-5 py-4 text-right"><p className="text-xs text-white/80">Additional holiday pay</p><p className="mt-1 font-mono text-2xl font-bold">{currency.format(total)}</p><p className="text-[11px] text-white/80">{absenceAuthorized ? "4 calculations ready" : "3 ready · 1 review"}</p></div></div><div className="grid gap-px bg-[#eae3f0] sm:grid-cols-3"><div className="bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#847990]">Eligibility</p><p className="mt-2 text-lg font-semibold">30 workdays</p><p className="mt-1 text-xs text-[#746a80]">Within the preceding 12 months</p></div><div className="bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#847990]">Irregular schedules</p><p className="mt-2 text-lg font-semibold">5 of 9 test</p><p className="mt-1 text-xs text-[#746a80]">Checked for the holiday weekday</p></div><div className="bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#847990]">Average wage method</p><Select value={periodMethod} onValueChange={setPeriodMethod}><SelectTrigger className="mt-2 min-h-11 bg-white text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="holiday">4 weeks before holiday</SelectItem><SelectItem value="pay-period">4 weeks ending with prior pay period</SelectItem></SelectContent></Select></div></div></section><section className="mb-6 overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="flex flex-col justify-between gap-3 border-b border-[#eae3f0] bg-[#faf8ff] px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Labour Day eligibility</h2><p className="mt-1 text-xs text-[#746a80]">Every conclusion is traceable to schedule, attendance and approved payroll history.</p></div><Badge className={`w-fit border-0 ${absenceAuthorized ? "bg-[#dcfce7] text-[#0f766e]" : "bg-[#fff0ce] text-[#7a5d18]"}`}>{absenceAuthorized ? "All ready" : "1 item to review"}</Badge></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="min-w-[220px] px-5">Employee</TableHead><TableHead>Workdays</TableHead><TableHead>Regular day</TableHead><TableHead>Worked</TableHead><TableHead>Result</TableHead><TableHead className="text-right">Holiday pay</TableHead><TableHead className="pr-5 text-right">Evidence</TableHead></TableRow></TableHeader><TableBody>{employeeResults.map((item) => <TableRow key={item.name}><TableCell className="px-5 py-4"><button type="button" onClick={() => setSelectedName(item.name)} className="text-left"><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-[#746a80]">{item.schedule}</p></button></TableCell><TableCell className="font-mono text-sm">{item.workdays}</TableCell><TableCell className="text-sm">{item.regular}</TableCell><TableCell className="text-sm">{item.worked}</TableCell><TableCell><Badge className={`border-0 ${item.status === "Ready" ? "bg-[#e9f7f6] text-[#0f6f74]" : "bg-[#fff0ce] text-[#7a5d18]"}`}>{item.result}</Badge></TableCell><TableCell className="text-right font-mono font-semibold">{item.amount ? currency.format(item.amount) : item.result === "Salary continues" ? "Included" : "Pending"}</TableCell><TableCell className="pr-5 text-right"><Button variant="ghost" size="sm" onClick={() => setSelectedName(item.name)}><Eye className="size-4" />View</Button></TableCell></TableRow>)}</TableBody></Table></div></section><section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="border-b border-[#eae3f0] px-5 py-4"><h2 className="font-semibold">2026 Alberta general holidays</h2><p className="mt-1 text-xs text-[#746a80]">Nine statutory dates load automatically for Alberta employees.</p></div><div className="grid gap-px bg-[#eae3f0] sm:grid-cols-2">{albertaHolidays2026.map(([name, date]) => <div key={name} className={`flex items-center justify-between gap-3 bg-white p-4 ${name === "Labour Day" ? "ring-2 ring-inset ring-[#f0abfc]" : ""}`}><div><p className="text-sm font-semibold">{name}</p><p className="mt-1 text-xs text-[#746a80]">{date}</p></div>{name === "Labour Day" ? <Badge className="border-0 bg-[#fdf2f8] text-[#a21caf]">Next</Badge> : <BadgeCheck className="size-4 text-[#00a29a]" />}</div>)}</div></div><aside className="rounded-2xl border border-[#ded6e8] bg-white p-5"><h2 className="font-semibold">Optional employer holidays</h2><p className="mt-1 text-xs leading-5 text-[#746a80]">Recognized optional days follow the same holiday-pay rules.</p><div className="mt-4 space-y-3">{Object.entries(optional).map(([name, checked]) => <label key={name} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#faf8ff] p-3"><Checkbox checked={checked} onCheckedChange={(value) => setOptional((current) => ({ ...current, [name]: Boolean(value) }))} className="mt-0.5" /><span><strong className="block text-xs">{name}</strong><span className="mt-1 block text-[11px] text-[#746a80]">{checked ? "Recognized by employer" : "Not recognized"}</span></span></label>)}</div><a href="https://www.alberta.ca/alberta-general-holidays" target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center text-xs font-semibold text-[#a21caf] hover:underline">Alberta Employment Standards source<ChevronRight className="ml-1 size-4" /></a></aside></section><Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedName(null); }}><SheetContent side="right" className="w-full overflow-y-auto border-[#ded6e8] bg-[#faf8ff] p-0 sm:max-w-[560px]">{selected && <><SheetHeader className="border-b border-[#ded6e8] bg-white px-6 py-6 text-left"><SheetTitle>{selected.name}</SheetTitle><SheetDescription>Labour Day eligibility evidence</SheetDescription></SheetHeader><div className="space-y-4 p-5"><section className="grid gap-3 sm:grid-cols-2"><DetailCell label="Workdays in 12 months" value={String(selected.workdays)} /><DetailCell label="Regular Monday" value={selected.regular} /><DetailCell label="Worked holiday" value={selected.worked} /><DetailCell label="Result" value={selected.result} /></section><section className="rounded-2xl border border-[#ded6e8] bg-white p-4"><h3 className="text-sm font-semibold">Why Comcheq chose this result</h3><p className="mt-2 text-xs leading-6 text-[#655b73]">{selected.evidence}</p></section>{selected.name === "Liam Martin" && !absenceAuthorized && <section className="rounded-2xl border border-[#efd99f] bg-[#fff8e7] p-4"><h3 className="text-sm font-semibold text-[#725a22]">Attendance confirmation required</h3><p className="mt-2 text-xs leading-5 text-[#725a22]">Liam was absent on Tuesday, September 8. Confirm that the employer consented to the absence.</p><Button onClick={() => setAbsenceAuthorized(true)} className="mt-4 w-full bg-[#6d4aff] text-white hover:bg-[#5934d1]"><Check className="size-4" />Confirm authorized absence</Button></section>}<div className="rounded-xl bg-[#e9f7f6] p-3 text-xs leading-5 text-[#0f6f74]">Calculation period: {periodMethod === "holiday" ? "the four weeks immediately before the holiday" : "the four weeks ending with the prior pay period"}.</div></div></>}</SheetContent></Sheet></>;
}

function PayrollView({ totals, employerCost, remittance, calculatedAt, approved, statementsSent, onHolidays, onExtra, onHistory, onReports, onStatement, onApprove, onRecalculate, onBankFile, onStatements }: { totals: { gross: number; tax: number; cpp: number; ei: number; other: number; net: number }; employerCost: number; remittance: number; calculatedAt: string; approved: boolean; statementsSent: boolean; onHolidays: () => void; onExtra: () => void; onHistory: () => void; onReports: () => void; onStatement: () => void; onApprove: () => void; onRecalculate: () => void; onBankFile: () => void; onStatements: () => void }) {
  const [reminderActive, setReminderActive] = useState(true);
  const runFee = 18;
  const totalFunding = totals.net + remittance + runFee;
  return <>
    <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="flex items-center gap-4"><RunNumber value="17" /><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-[-0.035em]">Run payroll</h1><Badge className={approved ? "border-0 bg-[#dcfce7] text-[#0f766e]" : "border-[#ded6e8] bg-white text-[#746a80]"}>{approved ? "Approved" : "Draft"}</Badge></div><p className="mt-2 text-sm text-[#746a80]">Run 17 of 26 · August 16–31 · Pay date September 4, 2026</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11 border-[#d2c7e1] bg-white" onClick={onExtra}><Plus className="size-4" />Extra run</Button><Button variant="outline" className="h-11 border-[#d2c7e1] bg-white" onClick={onHistory}><History className="size-4" />Pay-run history</Button><Button className="h-11 bg-[#6d4aff] px-5 text-white hover:bg-[#5934d1] disabled:bg-[#a99bc4]" onClick={onApprove} disabled={approved}>{approved ? "Payroll approved" : "Review and approve"}<ChevronRight className="size-4" /></Button></div>
    </div>
    <section className="mb-6 grid overflow-hidden rounded-2xl border border-[#ded6e8] bg-white shadow-[0_12px_40px_rgba(109,74,255,0.06)] sm:grid-cols-3"><ScheduleItem icon={<CalendarRange />} label="Pay period" value="Aug 16–31, 2026" /><ScheduleItem icon={<CalendarDays />} label="Pay date" value="Friday, Sep 4" divided /><ScheduleItem icon={<WalletCards />} label="Year position" value="Run 17 of 26" divided /></section>
    <section className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-[#f5b4d4] bg-gradient-to-r from-[#fdf2f8] to-[#e9f7f6] p-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#6d4aff] text-white"><CalendarDays className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Labour Day · September 7, 2026</h2><Badge className="border-0 bg-[#fff0ce] text-[#7a5d18]">Next run</Badge></div><p className="mt-1 text-xs leading-5 text-[#655b73]">3 employee calculations ready · 1 attendance item requires review.</p></div></div><Button onClick={onHolidays} variant="outline" className="border-[#f0abfc] bg-white text-[#a21caf]">Review stat holiday<ChevronRight className="size-4" /></Button></section>
    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Gross payroll" value={currency.format(totals.gross)} note="4 employee payments" icon={<Banknote />} /><SummaryCard label="Net payroll" value={currency.format(totals.net)} note="Bank-file control total" icon={<Landmark />} accent /><SummaryCard label="CRA remittance" value={currency.format(remittance)} note="Tax, CPP and EI obligations" icon={<Building2 />} /><SummaryCard label="Employer cost" value={currency.format(employerCost)} note="Gross plus employer CPP and EI" icon={<Users />} /></section>
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#c7b8ed] bg-white shadow-[0_14px_40px_rgba(109,74,255,0.07)]"><div className="flex flex-col justify-between gap-3 border-b border-[#e3dcf0] bg-[#faf8ff] px-5 py-4 sm:flex-row sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7757e8]">Preliminary pay funding</p><h2 className="mt-1 font-semibold">What your company will release and pay</h2></div><Badge className="w-fit border-0 bg-[#fff0ce] text-[#7a5d18]">Before approval</Badge></div><div className="grid gap-px bg-[#eae3f0] sm:grid-cols-2 xl:grid-cols-4"><FundingCell label="Employee deposits" value={currency.format(totals.net)} note="4 EFT transactions · pay Sep 4" icon={<Landmark />} /><FundingCell label="CRA remittance" value={currency.format(remittance)} note="Monthly remitter · due Sep 15" icon={<Building2 />} /><FundingCell label="Comcheq fees" value={currency.format(runFee)} note="$10 run + 4 × $2 transactions" icon={<ReceiptText />} /><FundingCell label="Total cash requirement" value={currency.format(totalFunding)} note="Deposits + remittance + fees" icon={<WalletCards />} accent /></div><div className="flex flex-col justify-between gap-3 border-t border-[#eae3f0] bg-[#fcfaff] px-5 py-4 sm:flex-row sm:items-center"><div className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 text-[#00a29a]" /><div><p className="text-xs font-semibold">CRA remittance due September 15, 2026</p><p className="mt-1 text-[11px] text-[#746a80]">Based on the monthly remittance threshold confirmed during onboarding.</p></div></div><Button variant="outline" size="sm" onClick={() => setReminderActive((current) => !current)} className="border-[#cdbfe4] bg-white">{reminderActive ? <><BadgeCheck className="size-4 text-[#00a29a]" />Calendar reminder active</> : <><CalendarDays className="size-4" />Add calendar reminder</>}</Button></div></section>
    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><OutputTile title="Reports" detail="Register, journals, PDF and CSV" icon={<FileSpreadsheet />} status="Open" onClick={onReports} /><OutputTile title="Payments Canada AFT simulation" detail="Fixed-width test export for workflow rehearsal" icon={<Landmark />} status={approved ? "SIM ready" : "After approval"} onClick={onBankFile} disabled={!approved} /><OutputTile title="View pay statement" detail="Alberta-ready employee PDF" icon={<Eye />} status="PDF" onClick={onStatement} /><OutputTile title="Email statements" detail="4 confidential PDF statements" icon={<Mail />} status={statementsSent ? "Queued" : approved ? "Ready" : "After approval"} onClick={onStatements} disabled={!approved || statementsSent} /></section>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
      <section className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white shadow-[0_18px_55px_rgba(109,74,255,0.07)]"><div className="flex flex-col gap-3 border-b border-[#eae3f0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="font-semibold">Employee calculations</h2><Badge variant="secondary" className="bg-[#f4f0ff] text-[#655b73]">4 ready</Badge></div><p className="mt-1 text-xs text-[#746a80]">{calculatedAt} · Statutory deductions checked</p></div><Button variant="outline" size="sm" className="border-[#ded6e8] bg-white" onClick={onRecalculate}><RefreshCw className="size-4" />Recalculate</Button></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="min-w-[245px] px-5">Employee</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">CPP</TableHead><TableHead className="text-right">EI</TableHead><TableHead className="text-right">Other</TableHead><TableHead className="pr-5 text-right">Net pay</TableHead></TableRow></TableHeader><TableBody>{employees.map((employee) => { const net = employee.gross - employee.tax - employee.cpp - employee.ei - employee.other; return <TableRow key={employee.name}><TableCell className="px-5 py-4"><EmployeeIdentity employee={employee} /></TableCell><MoneyCell value={employee.gross} /><MoneyCell value={employee.tax} muted /><MoneyCell value={employee.cpp} muted /><MoneyCell value={employee.ei} muted /><MoneyCell value={employee.other} muted /><TableCell className="pr-5 text-right font-mono text-sm font-semibold text-[#6d4aff]">{currency.format(net)}</TableCell></TableRow>; })}<TableRow className="bg-[#f6f2ff] hover:bg-[#f6f2ff]"><TableCell className="px-5 py-4 text-sm font-semibold">Payroll total</TableCell><MoneyCell value={totals.gross} strong /><MoneyCell value={totals.tax} strong /><MoneyCell value={totals.cpp} strong /><MoneyCell value={totals.ei} strong /><MoneyCell value={totals.other} strong /><TableCell className="pr-5 text-right font-mono text-sm font-bold text-[#6d4aff]">{currency.format(totals.net)}</TableCell></TableRow></TableBody></Table></div></section>
      <aside className="space-y-4"><section className="rounded-2xl bg-gradient-to-br from-[#6d4aff] via-[#8066ef] to-[#00a9a5] p-5 text-white"><div className="flex items-center justify-between"><div className="grid size-9 place-items-center rounded-xl bg-white/10"><BadgeCheck className="size-5" /></div><Badge className="border-0 bg-[#c7f36b] text-[#173a34]">{approved ? "5 of 5 complete" : "4 of 5 complete"}</Badge></div><h2 className="mt-5 text-lg font-semibold">Run readiness</h2><div className="mt-5 space-y-4 text-sm"><Checklist label="Time entries ready" complete /><Checklist label="Employee calculations" complete /><Checklist label="Statutory limits checked" complete /><Checklist label="Bank totals reconciled" complete /><Checklist label="Payroll approval" complete={approved} /></div></section><section className="rounded-2xl border border-[#ded6e8] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-[#746a80]">{approved ? "Confirmed billing" : "Projected billing"}</p><p className="mt-1 font-mono text-xl font-bold">$18.00</p></div><div className="grid size-10 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff]"><LockKeyhole className="size-5" /></div></div><p className="mt-3 text-xs leading-5 text-[#746a80]">$10.00 base fee + 4 employee payments × $2.00. Previewing and recalculating remain free.</p></section></aside>
    </div>
  </>;
}

function HistoryView({ approved, currentGross, currentNet, onBack, onRegister, onBankFile }: { approved: boolean; currentGross: number; currentNet: number; onBack: () => void; onRegister: (run: number) => void; onBankFile: (run: number) => void }) {
  const runs = [{ run: 17, period: "Aug 16–31, 2026", payDate: "Sep 4, 2026", gross: currentGross, net: currentNet, status: approved ? "Approved" : "Draft" }, ...priorRuns];
  return <><PageHeading eyebrow="2026 payroll year" title="Numbered pay-run history" description="Inputs, calculations, approvals and outputs remain linked to each individual run." action={<Button variant="outline" onClick={onBack} className="border-[#d2c7e1] bg-white">Back to run 17</Button>} /><section className="mb-4 rounded-2xl border border-[#c7b8ed] bg-[#e9f7f6] p-4"><div className="flex items-start gap-3"><FileArchive className="mt-0.5 size-5 text-[#0b8d88]" /><div><h2 className="text-sm font-semibold">Permanent run record</h2><p className="mt-1 text-xs leading-5 text-[#655b73]">Production retains each confirmed register, bank-file control total, statement batch, approval and audit trail for at least the required record-retention period.</p></div></div></section><section className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="px-5">Run</TableHead><TableHead className="min-w-[180px]">Pay period</TableHead><TableHead>Pay date</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net</TableHead><TableHead>Status</TableHead><TableHead className="pr-5 text-right">Outputs</TableHead></TableRow></TableHeader><TableBody>{runs.map((run) => <TableRow key={run.run}><TableCell className="px-5 py-4"><span className={`grid size-10 place-items-center rounded-xl font-mono text-sm font-bold ${run.run === 17 ? "bg-[#6d4aff] text-white" : "bg-[#f4f0ff] text-[#6d4aff]"}`}>{run.run}</span></TableCell><TableCell className="text-sm font-medium">{run.period}</TableCell><TableCell className="text-sm text-[#746a80]">{run.payDate}</TableCell><MoneyCell value={run.gross} /><MoneyCell value={run.net} /><TableCell><Badge className={`border-0 ${run.status === "Approved" ? "bg-[#dcfce7] text-[#0f766e]" : "bg-[#f1edf5] text-[#746a80]"}`}>{run.status}</Badge></TableCell><TableCell className="pr-5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => onRegister(run.run)}><FileSpreadsheet className="size-4" /><span className="sr-only">Register</span></Button><Button variant="ghost" size="sm" onClick={() => onBankFile(run.run)} disabled={run.status !== "Approved"}><Landmark className="size-4" /><span className="sr-only">Bank file</span></Button><Button variant="ghost" size="sm" disabled={run.status !== "Approved"}><Mail className="size-4" /><span className="sr-only">Statements</span></Button></div></TableCell></TableRow>)}</TableBody></Table></div></section></>;
}

function ReportsView({ onOpenPdf, onDownloadPdf, onRegisterCsv, onJournalCsv }: { onOpenPdf: (kind: PdfReportKind, employeeName?: string) => void; onDownloadPdf: (kind: PdfReportKind, employeeName?: string) => void; onRegisterCsv: () => void; onJournalCsv: () => void }) {
  const [employeeName, setEmployeeName] = useState("Noah Williams");
  return <>
    <PageHeading eyebrow="Pay run 17 · Outputs" title="Reports & statements" description="View printable PDFs in Comcheq, or export structured files for the client’s accountant and standalone records." />
    <section className="mb-5 grid gap-3 sm:grid-cols-3"><SummaryCard label="Current pay run" value="17 of 26" note="August 16-31, 2026" icon={<WalletCards />} accent /><SummaryCard label="Report formats" value="PDF + CSV" note="View, print and exchange" icon={<FileText />} /><SummaryCard label="Statement access" value="Confidential" note="Employee view and print" icon={<ShieldCheck />} /></section>
    <section className="mb-5 rounded-2xl border border-[#8fcfc9] bg-gradient-to-r from-[#e9f7f6] to-[#f4f0ff] p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#6d4aff] text-white"><ReceiptText className="size-5" /></span><div><h2 className="font-semibold">Employee pay statements</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#655b73]">Includes the Alberta-required statement period, regular and overtime hours, wage rates, separately listed earnings, deduction reasons and time taken in lieu.</p></div></div><div className="flex flex-col gap-2 sm:flex-row"><Select value={employeeName} onValueChange={setEmployeeName}><SelectTrigger className="w-full border-[#cdbfe4] bg-white sm:w-[210px]"><SelectValue /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.name} value={employee.name}>{employee.name}</SelectItem>)}</SelectContent></Select><Button onClick={() => onOpenPdf("statement", employeeName)} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]"><Eye className="size-4" />View PDF</Button><Button variant="outline" onClick={() => onDownloadPdf("statement", employeeName)} className="border-[#cdbfe4] bg-white"><Download className="size-4" />PDF</Button></div></div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white">
      <div className="border-b border-[#eae3f0] px-5 py-4"><h2 className="font-semibold">Pay-run report library</h2><p className="mt-1 text-xs text-[#746a80]">PDF is designed for viewing and retention; CSV preserves rows for accounting and troubleshooting.</p></div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="min-w-[230px] px-5">Report</TableHead><TableHead className="min-w-[250px]">Purpose</TableHead><TableHead>Status</TableHead><TableHead className="pr-5 text-right">Formats</TableHead></TableRow></TableHeader><TableBody>
        <ReportRow title="Payroll register" detail="Employee calculations and run totals" status="Preview" onView={() => onOpenPdf("register")} onPdf={() => onDownloadPdf("register")} onCsv={onRegisterCsv} />
        <ReportRow title="General ledger journal" detail="Balanced accountant posting summary" status="Preview" onView={() => onOpenPdf("journal")} onPdf={() => onDownloadPdf("journal")} onCsv={onJournalCsv} />
        <ReportRow title="CRA remittance summary" detail="Tax, CPP and EI obligation" status="Calculated" onView={() => onOpenPdf("remittance")} onPdf={() => onDownloadPdf("remittance")} />
        <ReportRow title="Employee pay statements" detail="Four confidential statement PDFs" status="4 ready" onView={() => onOpenPdf("statement", employeeName)} onPdf={() => onDownloadPdf("statement", employeeName)} />
      </TableBody></Table></div>
    </section>
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#c7b8ed] bg-[#fbf9ff] p-4 text-xs leading-5 text-[#655b73]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0b8d88]" /><p>Electronic Alberta statements must remain confidential and employees must be able to view and print them. This prototype provides the viewer and PDF download; production access will be employee-authenticated. <a href="https://www.alberta.ca/payment-earnings" target="_blank" rel="noreferrer" className="font-semibold text-[#6d4aff] hover:underline">Alberta pay-statement requirements</a></p></div>
  </>;
}

function ReportRow({ title, detail, status, onView, onPdf, onCsv }: { title: string; detail: string; status: string; onView: () => void; onPdf: () => void; onCsv?: () => void }) {
  return <TableRow><TableCell className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff]"><FileText className="size-4" /></span><span className="text-sm font-semibold">{title}</span></div></TableCell><TableCell className="text-xs leading-5 text-[#746a80]">{detail}</TableCell><TableCell><Badge className="border-0 bg-[#e9f7f6] text-[#0f6f74]">{status}</Badge></TableCell><TableCell className="pr-5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={onView}><Eye className="size-4" />View</Button><Button variant="ghost" size="sm" onClick={onPdf}><Download className="size-4" />PDF</Button>{onCsv && <Button variant="ghost" size="sm" onClick={onCsv}><FileSpreadsheet className="size-4" />CSV</Button>}</div></TableCell></TableRow>;
}

function RemittancesView({ remittance }: { remittance: number }) {
  return <><PageHeading eyebrow="Employer-controlled" title="CRA remittances" description="Comcheq calculates and records the obligation; the client controls the payment." /><section className="grid gap-3 sm:grid-cols-3"><SummaryCard label="Next remittance" value={currency.format(remittance)} note="Run 17 tax, CPP and EI" icon={<Building2 />} accent /><SummaryCard label="Due date" value="Sep 15" note="Monthly remitter schedule" icon={<CalendarDays />} /><SummaryCard label="2026 remitted" value="$74,218.42" note="Runs 1–16 recorded" icon={<BadgeCheck />} /></section><section className="mt-6 rounded-2xl border border-[#ded6e8] bg-white p-5"><h2 className="font-semibold">Remittance workflow</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniStep number="1" title="Confirm pay run" detail="Lock statutory liabilities" /><MiniStep number="2" title="Download summary" detail="Client payment instructions" /><MiniStep number="3" title="Record payment" detail="Reference and paid date" /></div></section></>;
}

function CalculationEvidenceView() {
  const calculation = buildDemoAlbertaCalculation();
  const figures = [
    ["Gross remuneration", formatCad(calculation.remunerationCents), "Weekly cash earnings"],
    ["Income tax", formatCad(calculation.deductions.incomeTaxCents), "Federal + Alberta"],
    ["CPP", formatCad(calculation.deductions.cppCents), "2026 first ceiling"],
    ["EI", formatCad(calculation.deductions.eiCents), "Employee premium"],
    ["Net pay", formatCad(calculation.netPayCents), "After $80 registered plan"],
  ] as const;
  return <>
    <PageHeading eyebrow="Statutory engine" title="Alberta calculation evidence" description="A compact audit view for the employee-fact-selected 2026 regular periodic formula path." action={<a href="/api/v1/demo/alberta-calculation" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d2c7e1] bg-white px-4 text-sm font-medium text-[#35284b] hover:bg-[#f4f0ff]"><FileCode2 className="size-4" />View JSON evidence</a>} />
    <section className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#6d4aff] via-[#8066ef] to-[#00a9a5] p-5 text-white shadow-[0_18px_45px_rgba(109,74,255,0.2)] sm:p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">CRA-T4127-2026-AB-v1</h2><Badge className="border-0 bg-[#c7f36b] text-[#173a34]">2 official examples matched</Badge></div><p className="mt-2 max-w-2xl text-sm leading-6 text-[#f1ecff]">Effective January 1–December 31, 2026. The July CRA edition confirms no Alberta change, so every result keeps one pinned rule reference for the year.</p></div><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/12"><BadgeCheck className="size-7" /></span></div>
    </section>
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{figures.map(([label, value, note], index) => <article key={label} className={`rounded-2xl border p-4 ${index === figures.length - 1 ? "border-[#b39df0] bg-[#f1edff]" : "border-[#ded6e8] bg-white"}`}><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#746a80]">{label}</p><p className={`mt-2 font-mono text-xl font-bold ${index === figures.length - 1 ? "text-[#6d4aff]" : "text-[#35284b]"}`}>{value}</p><p className="mt-1 text-[11px] leading-4 text-[#847990]">{note}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="border-b border-[#eae3f0] px-5 py-4"><h2 className="font-semibold">Calculation audit</h2><p className="mt-1 text-xs text-[#746a80]">Fictional $1,300 weekly employee with an $80 registered-plan deduction.</p></div><div className="grid gap-px bg-[#eae3f0] sm:grid-cols-2"><AuditCell label="Path selected" value="Regular periodic" note="Chosen from employee facts; no user-facing formula toggle" /><AuditCell label="Annual taxable income" value={formatCad(calculation.annualTaxableIncomeCents)} note="Gross less additional CPP and registered plan, annualized" /><AuditCell label="Federal annual tax" value={formatCad(calculation.taxEvidence.annualFederalTaxCents)} note="2026 federal brackets and credits" /><AuditCell label="Alberta annual tax" value={formatCad(calculation.taxEvidence.annualAlbertaTaxCents)} note="2026 Alberta brackets, credits and supplemental credit" /></div></div>
      <aside className="space-y-4"><section className="rounded-2xl border border-[#c7b8ed] bg-[#e9f7f6] p-5"><div className="flex items-center gap-2 text-[#0f6f74]"><ShieldCheck className="size-5" /><h2 className="font-semibold">Validated now</h2></div><ul className="mt-4 space-y-2 text-xs leading-5 text-[#655b73]"><li>• Salary and hourly regular-periodic pay</li><li>• Overtime paid in the earned period</li><li>• Taxable benefits and registered-plan deductions</li><li>• CPP, CPP2 and EI ceilings with YTD balances</li><li>• Common 12, 24, 26 and 52-period schedules</li></ul></section><section className="rounded-2xl border border-[#efd99f] bg-[#fff8e7] p-5"><h2 className="text-sm font-semibold text-[#6a5015]">Blocked until validated</h2><p className="mt-2 text-xs leading-5 text-[#725a22]">Bonus, commission/TD1X, retroactive pay, Quebec transfers and unusual frequencies cannot silently fall through this path.</p></section></aside>
    </section>
  </>;
}

function AuditCell({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#847990]">{label}</p><p className="mt-2 font-mono text-sm font-semibold text-[#35284b]">{value}</p><p className="mt-1 text-xs leading-5 text-[#746a80]">{note}</p></div>;
}

function DataExchangeView({ sectionId, importResult, onSectionChange, onExport, onExportAll, onImport }: {
  sectionId: string;
  importResult: { filename: string; valid: boolean; rowCount: number; errors: string[]; warnings: string[] } | null;
  onSectionChange: (sectionId: string) => void;
  onExport: (sectionId: string, template?: boolean) => void;
  onExportAll: () => void;
  onImport: (file: File, sectionId: string) => void;
}) {
  const section = dataExchangeSections.find((item) => item.id === sectionId)!;
  const previewRows = section.records.slice(0, 4);
  return <>
    <PageHeading eyebrow="Administrator tools" title="CSV data exchange" description="Export, troubleshoot and migrate every Comcheq record area with documented CSV templates and a validation-first import process." action={<Button onClick={onExportAll} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]"><FileArchive className="size-4" />Export all records</Button>} />
    <section className="mb-5 rounded-2xl border border-[#bba6f1] bg-gradient-to-br from-[#f1edff] via-white to-[#e5fbf9] p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#6d4aff] text-white"><ShieldCheck className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Administrator-only migration control</h2><Badge className="border-0 bg-[#c7f36b] text-[#173a34]">Great Plains-style workflow</Badge></div><p className="mt-1 max-w-3xl text-xs leading-5 text-[#655b73]">Imports are parsed, mapped and validated before commit. Every committed batch receives an audit ID, row counts and an error report. Approved payroll, filed slips and submitted ROEs remain append-only.</p></div></div><div className="flex gap-2"><Button variant="outline" onClick={() => onExport(section.id, true)} className="border-[#d2c7e1] bg-white"><FileText className="size-4" />Template</Button><Button variant="outline" onClick={() => onExport(section.id)} className="border-[#d2c7e1] bg-white"><Download className="size-4" />Export section</Button></div></div>
    </section>
    <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-[#ded6e8] bg-white p-4"><label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#847990]" htmlFor="data-section">Record section</label><Select value={sectionId} onValueChange={onSectionChange}><SelectTrigger id="data-section" className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent>{dataExchangeSections.map((item) => <SelectItem key={item.id} value={item.id}>{item.area} · {item.label}</SelectItem>)}</SelectContent></Select><div className="mt-5 rounded-xl bg-[#f7f4fa] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#847990]">Import rule</p><p className="mt-2 text-xs leading-5 text-[#655b73]">{section.importRule}</p></div><div className="mt-4 space-y-2 text-xs text-[#746a80]"><div className="flex justify-between"><span>Primary key</span><strong className="font-mono text-[#35284b]">{section.primaryKey}</strong></div><div className="flex justify-between"><span>Export rows</span><strong className="font-mono text-[#35284b]">{section.records.length}</strong></div><div className="flex justify-between"><span>Required fields</span><strong className="font-mono text-[#35284b]">{section.columns.filter((column) => column.required).length}</strong></div></div></aside>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="flex flex-col justify-between gap-3 border-b border-[#eae3f0] px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">{section.label}</h2><p className="mt-1 text-xs text-[#746a80]">{section.description}</p></div><Badge className="w-fit border-0 bg-[#e9f7f6] text-[#0f6f74]">{section.columns.length} mapped columns</Badge></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]">{section.columns.slice(0, 5).map((column) => <TableHead key={column.key} className={column.key === section.primaryKey ? "min-w-[180px] px-5" : "min-w-[140px]"}>{column.label}{column.required && <span className="ml-1 text-[#6d4aff]">*</span>}</TableHead>)}</TableRow></TableHeader><TableBody>{previewRows.map((record, rowIndex) => <TableRow key={String(record[section.primaryKey] ?? rowIndex)}>{section.columns.slice(0, 5).map((column, columnIndex) => <TableCell key={column.key} className={`whitespace-nowrap text-xs ${columnIndex === 0 ? "px-5 font-mono font-medium text-[#35284b]" : "text-[#655b73]"}`}>{record[column.key] === null ? "—" : String(record[column.key])}</TableCell>)}</TableRow>)}</TableBody></Table></div>{section.columns.length > 5 && <div className="border-t border-[#eae3f0] px-5 py-3 text-[11px] text-[#847990]">Preview shows 5 of {section.columns.length} columns. The CSV contains the complete schema.</div>}</section>
        <section className="rounded-2xl border border-[#ded6e8] bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Validate an import</h2><p className="mt-1 text-xs leading-5 text-[#746a80]">Choose a {section.label.toLowerCase()} CSV. This public prototype validates locally and does not store the file.</p></div><label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#6d4aff] px-4 text-sm font-medium text-white transition hover:bg-[#5934d1]"><Upload className="size-4" />Choose CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file, section.id); event.currentTarget.value = ""; }} /></label></div>
          {importResult ? <div className={`mt-4 rounded-xl border p-4 ${importResult.valid ? "border-[#9ad8cb] bg-[#e9f7f6]" : "border-[#efd99f] bg-[#fff8e7]"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><BadgeCheck className={`size-5 ${importResult.valid ? "text-[#0b8d88]" : "text-[#9a6d08]"}`} /><strong className="text-sm">{importResult.valid ? "Validation passed" : "Validation needs attention"}</strong></div><span className="font-mono text-xs text-[#655b73]">{importResult.filename} · {importResult.rowCount} rows</span></div>{[...importResult.errors, ...importResult.warnings].length > 0 && <ul className="mt-3 space-y-1 text-xs leading-5 text-[#725a22]">{[...importResult.errors, ...importResult.warnings].slice(0, 5).map((message) => <li key={message}>• {message}</li>)}</ul>}<div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3 text-xs"><span className="text-[#746a80]">Commit is disabled in the fictional public prototype.</span><Button size="sm" disabled>Commit import</Button></div></div> : <div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniStep number="1" title="Select template" detail="Start from the exact section schema" /><MiniStep number="2" title="Dry-run validate" detail="Check headers, keys, rows and balances" /><MiniStep number="3" title="Review and commit" detail="Administrator approval creates an audit batch" /></div>}
        </section>
      </div>
    </section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="border-b border-[#eae3f0] px-5 py-4"><h2 className="font-semibold">Complete section catalogue</h2><p className="mt-1 text-xs text-[#746a80]">Every listed section has both a data export and an import template.</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="px-5">Area</TableHead><TableHead className="min-w-[220px]">Section</TableHead><TableHead>Rows</TableHead><TableHead className="min-w-[260px]">Import behaviour</TableHead><TableHead className="pr-5 text-right">CSV</TableHead></TableRow></TableHeader><TableBody>{dataExchangeSections.map((item) => <TableRow key={item.id}><TableCell className="px-5 text-xs text-[#746a80]">{item.area}</TableCell><TableCell><button type="button" onClick={() => onSectionChange(item.id)} className="text-left text-sm font-semibold text-[#6d4aff] hover:underline">{item.label}</button></TableCell><TableCell className="font-mono text-xs">{item.records.length}</TableCell><TableCell className="text-xs leading-5 text-[#746a80]">{item.importRule}</TableCell><TableCell className="pr-5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => onExport(item.id, true)}><FileText className="size-4" /><span className="sr-only">Download {item.label} template</span></Button><Button variant="ghost" size="sm" onClick={() => onExport(item.id)}><Download className="size-4" /><span className="sr-only">Export {item.label}</span></Button></div></TableCell></TableRow>)}</TableBody></Table></div></section>
  </>;
}

function PlatformView() {
  const foundations = [
    { title: "Integer money", detail: "Every calculation, control total and billing event uses cents, never floating-point dollars.", icon: Banknote },
    { title: "Numbered state machine", detail: "Draft → calculated → reviewed → approved. Approved runs can only be adjusted or reversed.", icon: GitBranch },
    { title: "Effective-dated rules", detail: "The Alberta 2026 regular-periodic engine pins its version, effective dates, official source and selected path.", icon: CalendarRange },
    { title: "Separated ledgers", detail: "Payroll, bank, CRA, GL, statements and $2 billing events stay linked but independently auditable.", icon: Database },
  ] as const;
  const growthModules = [
    { title: "Payroll accounts", detail: "Employees, remittances, runs and ROEs are assigned to a specific CRA BN payroll account rather than a single employer-wide field.", status: "Workspace live", icon: ReceiptText },
    { title: "Absence ledger", detail: "Effective-dated leave events can feed paid hours, unpaid interruptions, balances and ROE decisions without rewriting time entry.", status: "Designed next", icon: CalendarRange },
    { title: "Pay components", detail: "Versioned earning and deduction definitions support taxable benefits, bonuses, garnishments, loans and employer contributions.", status: "Extensible", icon: Layers3 },
    { title: "Pension plans", detail: "Plan membership, employee and employer formulas, limits and T4 pension adjustments remain independently auditable.", status: "Future module", icon: Network },
  ] as const;
  return <>
    <PageHeading eyebrow="Product foundation" title="Canadian payroll API & controls" description="A production-minded core under the compact workflow. Authenticated D1 persistence now protects fictional administrator records while public visitors remain read-only." />
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#bba6f1] bg-gradient-to-br from-[#f1edff] via-white to-[#e5fbf9] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#6d4aff] text-white"><FileCode2 className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Payments Canada AFT simulation</h2><Badge className="border-0 bg-[#fff0ce] text-[#7a5d18]">NOT BANK-SUBMITTABLE</Badge></div><p className="mt-2 max-w-2xl text-sm leading-6 text-[#655b73]">Standard-005-style rehearsal export with 1,464-character A/C/Z records, payroll code 200 and independently balanced payment-count and dollar controls.</p></div></div>
        <a href="/api/v1/demo/payments-canada-aft" download className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#6d4aff] px-4 text-sm font-medium text-white transition hover:bg-[#5934d1]"><Download className="size-4" />Download simulation file</a>
      </div>
      <div className="mt-5 grid gap-2 text-xs sm:grid-cols-3"><div className="rounded-xl bg-white/80 p-3"><strong className="block text-[#35284b]">Format</strong><span className="mt-1 block text-[#746a80]">Standard 005 · CAD · fictional data</span></div><div className="rounded-xl bg-white/80 p-3"><strong className="block text-[#35284b]">Control</strong><span className="mt-1 block text-[#746a80]">A header · C payments · Z trailer</span></div><div className="rounded-xl bg-white/80 p-3"><strong className="block text-[#35284b]">Production gate</strong><span className="mt-1 block text-[#746a80]">Bank adapter and accepted certification file</span></div></div>
      <div className="mt-3 grid gap-2 rounded-xl border border-[#d7caec] bg-white/70 p-3 text-xs sm:grid-cols-4"><div><strong className="block text-[#35284b]">1 · Bank profile</strong><span className="mt-1 block text-[#746a80]">Obtain assigned identifiers</span></div><div><strong className="block text-[#35284b]">2 · Adapter</strong><span className="mt-1 block text-[#746a80]">Apply bank-specific transmission rules</span></div><div><strong className="block text-[#35284b]">3 · Certify</strong><span className="mt-1 block text-[#746a80]">Submit representative bank test file</span></div><div><strong className="block text-[#35284b]">4 · Accept</strong><span className="mt-1 block text-[#746a80]">Retain bank acceptance as evidence</span></div></div>
    </section>
    <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{foundations.map(({ title, detail, icon: Icon }) => <article key={title} className="rounded-2xl border border-[#ded6e8] bg-white p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff]"><Icon className="size-5" /></span><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-[#746a80]">{detail}</p></article>)}</section>
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="flex flex-col justify-between gap-3 border-b border-[#eae3f0] bg-[#faf8ff] px-5 py-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><Network className="size-4 text-[#6d4aff]" /><h2 className="font-semibold">Modular growth map</h2></div><p className="mt-1 text-xs text-[#746a80]">Add capabilities beside the payroll core; do not overload employee or pay-run records.</p></div><Badge className="w-fit border-0 bg-[#e9f7f6] text-[#0f6f74]">Account-scoped architecture</Badge></div><div className="grid gap-px bg-[#eae3f0] sm:grid-cols-2 xl:grid-cols-4">{growthModules.map(({ title, detail, status, icon: Icon }) => <article key={title} className="bg-white p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff]"><Icon className="size-5" /></span><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-[#746a80]">{detail}</p><Badge className="mt-4 border-0 bg-[#f1edff] text-[#5b35c7]">{status}</Badge></article>)}</div></section>
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="border-b border-[#eae3f0] px-5 py-4"><div className="flex items-center gap-2"><FileCode2 className="size-4 text-[#6d4aff]" /><h2 className="font-semibold">Versioned API contract</h2></div><p className="mt-1 text-xs text-[#746a80]">The OpenAPI design contract is available at <span className="font-mono text-[#6d4aff]">/api/v1/openapi</span>.</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="px-5">Method</TableHead><TableHead className="min-w-[270px]">Resource</TableHead><TableHead className="min-w-[270px]">Control purpose</TableHead><TableHead className="pr-5">Status</TableHead></TableRow></TableHeader><TableBody>{payrollApiResources.slice(0, 8).map((resource) => <TableRow key={resource.method + resource.path}><TableCell className="px-5"><Badge className="border-0 bg-[#e9f7f6] font-mono text-[#0f6f74]">{resource.method}</Badge></TableCell><TableCell className="font-mono text-xs text-[#35284b]">{resource.path}</TableCell><TableCell className="text-xs leading-5 text-[#746a80]">{resource.purpose}</TableCell><TableCell className="pr-5"><Badge className="border-0 bg-[#f1edf5] text-[#746a80]">Contract</Badge></TableCell></TableRow>)}</TableBody></Table></div></div>
      <aside className="space-y-4"><section className="rounded-2xl bg-gradient-to-br from-[#5633b7] to-[#117d83] p-5 text-white"><div className="flex items-center gap-2"><ShieldCheck className="size-5" /><h2 className="font-semibold">Mandatory controls</h2></div><div className="mt-4 space-y-3">{payrollApiControls.map((control) => <div key={control} className="flex items-start gap-2 text-xs leading-5 text-[#f3efff]"><Check className="mt-0.5 size-3.5 shrink-0 text-[#c7f36b]" /><span>{control}</span></div>)}</div></section><section className="rounded-2xl border border-[#efd99f] bg-[#fff8e7] p-5"><h2 className="text-sm font-semibold text-[#6a5015]">Production gates</h2><ol className="mt-3 space-y-2 text-xs leading-5 text-[#725a22]"><li>1. Expand employer membership and role administration</li><li>2. Add backup and restore testing</li><li>3. Complete PDOC regression and non-periodic paths</li><li>4. Obtain RBC onboarding test acceptance</li><li>5. Validate CRA T4 and Service Canada ROE XML</li></ol></section></aside>
    </section>
  </>;
}

function ConfigurationCentreView() {
  const [salaryEffectiveDate, setSalaryEffectiveDate] = useState("2026-08-01");
  const [oldSalary, setOldSalary] = useState("80000");
  const [newSalary, setNewSalary] = useState("84000");
  const [affectedPeriods, setAffectedPeriods] = useState("2");
  const [changeStatus, setChangeStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [changeError, setChangeError] = useState("");
  const [openingStatus, setOpeningStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [componentSaved, setComponentSaved] = useState(false);
  const [componentFlags, setComponentFlags] = useState({ taxable: true, pensionable: true, insurable: true, vacationable: false, holidayAverage: true });
  const retroCents = Math.max(0, (Math.round((Number(newSalary) || 0) * 100 / 24) - Math.round((Number(oldSalary) || 0) * 100 / 24)) * (Number(affectedPeriods) || 0));
  const retroAmount = retroCents / 100;
  const salaryChangeValid = /^20\d{2}-\d{2}-\d{2}$/.test(salaryEffectiveDate) && Number(newSalary) > 0 && Number(oldSalary) > 0 && Number(affectedPeriods) >= 0;

  const saveSalaryChange = async () => {
    if (!salaryChangeValid) return;
    setChangeStatus("saving"); setChangeError("");
    const periods = [
      { id: "RUN-15", periodStart: "2026-08-01", periodEnd: "2026-08-15", paidSalaryCents: Math.round(Number(oldSalary) * 100 / 24) },
      { id: "RUN-16", periodStart: "2026-08-16", periodEnd: "2026-08-31", paidSalaryCents: Math.round(Number(oldSalary) * 100 / 24) },
    ].slice(0, Math.max(0, Math.min(2, Number(affectedPeriods) || 0)));
    try {
      const response = await fetch("/api/v1/configuration", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_salary_change", employeeId: "EMP-0001", effectiveDate: salaryEffectiveDate, previousAnnualSalaryCents: Math.round(Number(oldSalary) * 100), newAnnualSalaryCents: Math.round(Number(newSalary) * 100), prorationBasis: "workdays", closedPeriods: periods }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The dated change could not be saved.");
      setChangeStatus("saved");
    } catch (error) { setChangeError(error instanceof Error ? error.message : "The dated change could not be saved."); setChangeStatus("error"); }
  };

  const saveOpeningBalance = async () => {
    setOpeningStatus("saving");
    try {
      const response = await fetch("/api/v1/configuration", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_opening_balance", employeeId: "EMP-0001", taxYear: 2026, asOfDate: "2026-08-31", taxableEarningsCents: 7864050, pensionableEarningsCents: 7485000, insurableEarningsCents: 7220000, incomeTaxCents: 1493218, cppCents: 344261, cpp2Cents: 0, eiCents: 81242, vacationHoursHundredths: 6400, vacationDollarsCents: 192000, sourceReference: "Prior provider conversion control" }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Opening balances could not be saved.");
      setOpeningStatus("saved");
    } catch { setOpeningStatus("error"); }
  };

  return <>
    <PageHeading eyebrow="Configuration foundation" title="Configuration centre" description="Client-friendly setup backed by effective dates, reproducible history and Alberta payroll rules." action={<Badge className="border-0 bg-[#ddf8f4] px-3 py-2 text-[#0f6f74]"><ShieldCheck className="mr-1 size-3.5" />Alberta active</Badge>} />

    <Tabs defaultValue="effective" className="space-y-5">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-[#ded6e8] bg-white p-1">
        <TabsTrigger value="effective">Effective dates</TabsTrigger><TabsTrigger value="components">Pay components</TabsTrigger><TabsTrigger value="migration">Opening balances</TabsTrigger><TabsTrigger value="approvals">Controls</TabsTrigger><TabsTrigger value="provinces">Provinces</TabsTrigger>
      </TabsList>

      <TabsContent value="effective" className="space-y-5">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
          <article className="rounded-2xl border border-[#ded6e8] bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><TestStepHeading icon={<History />} title="Effective-dated salary change" detail="The old salary remains attached to prior payrolls. Comcheq calculates the missed difference and adds it to the selected correction run." /><Badge className="border-0 bg-[#fce7f3] text-[#a21caf]">Avery Chen</Badge></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Effective date"><Input type="date" min="2026-01-01" max="2035-12-31" value={salaryEffectiveDate} onChange={(event) => { setSalaryEffectiveDate(event.target.value); setChangeStatus("idle"); }} /></Field><Field label="Pay frequency"><Input value="Semi-monthly · 24 periods" readOnly className="bg-[#f6f2f8]" /></Field><Field label="Previous annual salary"><Input inputMode="decimal" value={oldSalary} onChange={(event) => { setOldSalary(event.target.value); setChangeStatus("idle"); }} /></Field><Field label="New annual salary"><Input inputMode="decimal" value={newSalary} onChange={(event) => { setNewSalary(event.target.value); setChangeStatus("idle"); }} /></Field><Field label="Closed periods affected"><Input inputMode="numeric" value={affectedPeriods} onChange={(event) => { setAffectedPeriods(event.target.value); setChangeStatus("idle"); }} /></Field><Field label="Position"><Input value="Operations Manager" readOnly className="bg-[#f6f2f8]" /></Field></div>
            <div className="mt-5 rounded-xl border border-[#e7d6e1] bg-[#fff7fb] p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a21caf]">Automatic retroactive earning</p><p className="mt-1 text-sm text-[#655b73]">({currency.format(Number(newSalary) || 0)} − {currency.format(Number(oldSalary) || 0)}) ÷ 24 × {Number(affectedPeriods) || 0} periods</p></div><strong className="font-mono text-2xl text-[#a21caf]">{currency.format(retroAmount)}</strong></div></div>
            <div className="mt-5 flex flex-wrap gap-3"><Button disabled={!salaryChangeValid || changeStatus === "saving"} onClick={saveSalaryChange} className="bg-[#d72d91] text-white hover:bg-[#b91c77]"><Check className="size-4" />{changeStatus === "saving" ? "Saving…" : "Save dated change"}</Button><Button variant="outline" className="border-[#d2c7e1] bg-white"><Eye className="size-4" />Preview calculation</Button></div>
            {changeStatus === "saved" && <div className="mt-4 rounded-xl bg-[#effcf9] p-4 text-sm leading-6 text-[#0f6f74]"><strong>Change stored permanently.</strong> The new salary takes effect August 1, 2026. A {currency.format(retroAmount)} retroactive earning will be proposed on the September 18 payroll and remain separately identified.</div>}
            {changeStatus === "error" && <div className="mt-4 rounded-xl bg-[#fff0f0] p-4 text-sm leading-6 text-[#9f2929]"><strong>Change not saved.</strong> {changeError}</div>}
          </article>

          <aside className="space-y-4">
            <article className="rounded-2xl border border-[#ded6e8] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#847990]">Employment timeline</p><div className="mt-5 space-y-0"><TimelineEvent date="Jan 5, 2024" title="Hired" detail="Operations · $76,000" /><TimelineEvent date="Jan 1, 2026" title="Salary change" detail="$80,000 annual" /><TimelineEvent date="Aug 1, 2026" title="Proposed change" detail={`${currency.format(Number(newSalary) || 0)} annual`} active /></div></article>
            <article className="rounded-2xl border border-[#efd99f] bg-[#fff8e7] p-5"><div className="flex gap-3"><LockKeyhole className="mt-0.5 size-5 shrink-0 text-[#8a6515]" /><div><h2 className="text-sm font-semibold text-[#6a5015]">History is never overwritten</h2><p className="mt-2 text-xs leading-5 text-[#725a22]">Approved runs retain the exact rate, position, department and rule version used when they were calculated.</p></div></div></article>
          </aside>
        </section>
      </TabsContent>

      <TabsContent value="components" className="space-y-5">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><article className="rounded-2xl border border-[#ded6e8] bg-white p-5 sm:p-6"><TestStepHeading icon={<Layers3 />} title="Component rule card" detail="Clients answer ordinary payroll questions. Support staff retain access to the detailed calculation mapping and rule version." />
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Component name"><Input value="Accommodation allowance" readOnly className="bg-[#f6f2f8]" /></Field><Field label="Calculation"><Select defaultValue="dollar"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dollar">Fixed dollar amount</SelectItem><SelectItem value="rate">Rate × units</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent></Select></Field><Field label="Default amount"><Input defaultValue="3000.00" inputMode="decimal" /></Field><Field label="Frequency"><Select defaultValue="monthly"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="every">Every pay run</SelectItem><SelectItem value="selected">Selected runs</SelectItem><SelectItem value="once">One time</SelectItem></SelectContent></Select></Field></div>
          <div className="mt-6 overflow-hidden rounded-xl border border-[#ded6e8]"><div className="border-b border-[#eae3f0] bg-[#fcfaff] px-4 py-3"><h3 className="text-sm font-semibold">Payroll treatment</h3></div>{([
            ["taxable", "Subject to income tax", "Include in taxable income"], ["pensionable", "CPP pensionable", "Include in CPP earnings"], ["insurable", "EI insurable", "Include in EI earnings"], ["vacationable", "Vacationable", "Earn vacation pay on this amount"], ["holidayAverage", "General holiday average", "Include in Alberta average daily wage"],
          ] as const).map(([key, label, detail]) => <label key={key} className="flex cursor-pointer items-center gap-3 border-b border-[#eee8f2] px-4 py-3 last:border-b-0"><Checkbox checked={componentFlags[key]} onCheckedChange={(checked) => { setComponentFlags((current) => ({ ...current, [key]: checked === true })); setComponentSaved(false); }} /><span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><span className="text-xs text-[#847990]">{detail}</span></span><Badge className={`border-0 ${componentFlags[key] ? "bg-[#ddf8f4] text-[#0f6f74]" : "bg-[#f1edf5] text-[#746a80]"}`}>{componentFlags[key] ? "Yes" : "No"}</Badge></label>)}</div>
          <Button onClick={() => setComponentSaved(true)} className="mt-5 bg-[#d72d91] text-white hover:bg-[#b91c77]">Save component rules</Button>{componentSaved && <p className="mt-3 text-sm text-[#0f766e]">Saved as rule version 3, effective September 1, 2026.</p>}
        </article><aside className="space-y-4"><article className="rounded-2xl border border-[#ded6e8] bg-white p-5"><h2 className="font-semibold">Simple benefit imports</h2><p className="mt-2 text-sm leading-6 text-[#746a80]">Benefit providers supply monthly employee and employer dollar amounts. Comcheq imports those values without recreating complex carrier calculations.</p><Button variant="outline" className="mt-4 w-full border-[#d2c7e1] bg-white"><Upload className="size-4" />Import benefit values</Button></article><article className="rounded-2xl bg-gradient-to-br from-[#4a1742] to-[#0f7775] p-5 text-white"><ShieldCheck className="size-5" /><h2 className="mt-3 font-semibold">Support-only evidence</h2><p className="mt-2 text-xs leading-5 text-[#f7eaf3]">Tax-table versions, intermediate values and calculation traces remain hidden from clients while plain-language explanations stay available.</p></article></aside></section>
      </TabsContent>

      <TabsContent value="migration" className="space-y-5">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><article className="rounded-2xl border border-[#ded6e8] bg-white p-5 sm:p-6"><TestStepHeading icon={<Upload />} title="Mid-year opening balances" detail="Bring a client onto Comcheq without losing payroll history or overstating CPP, EI and income tax deductions." />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><OpeningBalance label="YTD gross earnings" value="78,640.50" /><OpeningBalance label="Tax deducted" value="14,932.18" /><OpeningBalance label="CPP contributions" value="3,442.61" /><OpeningBalance label="EI premiums" value="812.42" /><OpeningBalance label="Pensionable earnings" value="74,850.00" /><OpeningBalance label="Insurable earnings" value="72,200.00" /><OpeningBalance label="Vacation hours" value="64.00" hours /><OpeningBalance label="Vacation dollars" value="1,920.00" /><OpeningBalance label="Prior approved runs" value="16" runs /></div>
          <div className="mt-6 flex flex-wrap gap-3"><Button variant="outline" className="border-[#d2c7e1] bg-white"><FileSpreadsheet className="size-4" />Download migration template</Button><Button variant="outline" className="border-[#d2c7e1] bg-white"><Upload className="size-4" />Import client balances</Button><Button disabled={openingStatus === "saving"} onClick={saveOpeningBalance} className="bg-[#d72d91] text-white hover:bg-[#b91c77]"><BadgeCheck className="size-4" />{openingStatus === "saving" ? "Validating…" : "Validate opening totals"}</Button></div>
          {openingStatus === "saved" && <div className="mt-5 rounded-xl bg-[#effcf9] p-4 text-sm leading-6 text-[#0f6f74]"><strong>Opening balance stored.</strong> Avery’s conversion record reconciles to the prior provider control totals. CPP and EI remaining maximums can now be calculated from the statutory ledger.</div>}
          {openingStatus === "error" && <div className="mt-5 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#9f2929]">Opening balances require an authenticated payroll role before they can be stored.</div>}
        </article><aside className="space-y-4"><article className="rounded-2xl border border-[#ded6e8] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#847990]">Conversion sequence</p><ol className="mt-4 space-y-3 text-sm text-[#655b73]">{["Import employees and components", "Load YTD and vacation balances", "Reconcile provider control totals", "Run a free parallel payroll", "Approve the first live run"].map((item, index) => <li key={item} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#fce7f3] text-xs font-bold text-[#a21caf]">{index + 1}</span><span>{item}</span></li>)}</ol></article><article className="rounded-2xl border border-[#c7b8ed] bg-[#f4f0ff] p-5"><h2 className="font-semibold">Free conversion parallel</h2><p className="mt-2 text-sm leading-6 text-[#655b73]">Compare one Comcheq draft against the previous provider before any employee or bank file is finalized.</p></article></aside></section>
      </TabsContent>

      <TabsContent value="approvals" className="space-y-5">
        <section className="grid gap-5 lg:grid-cols-2"><article className="rounded-2xl border border-[#ded6e8] bg-white p-5"><TestStepHeading icon={<ShieldCheck />} title="Approval roles" detail="Small clients can use one approver; growing organizations can separate preparation and final release." /><div className="mt-5 space-y-3"><RoleCard role="Payroll administrator" person="Morgan Martin" permissions="Prepare, calculate, import and correct" /><RoleCard role="Payroll approver" person="Avery Chen" permissions="Approve runs and release client bank file" /><RoleCard role="Accountant" person="External accountant" permissions="Read reports and export journal entries" /><RoleCard role="Comcheq support" person="Assigned support team" permissions="Calculation evidence and assisted recovery" support /></div></article>
          <article className="rounded-2xl border border-[#ded6e8] bg-white p-5"><TestStepHeading icon={<ListChecks />} title="Pre-approval controls" detail="The client sees actionable explanations; detailed calculation evidence remains available to support." /><div className="mt-5 space-y-3"><ControlCheck label="Employee banking complete" /><ControlCheck label="No negative net pay" /><ControlCheck label="Alberta holiday questions resolved" /><ControlCheck label="Effective-dated changes included" /><ControlCheck label="EFT control total equals deposits" /><ControlCheck label="CRA obligation calculated" /></div><div className="mt-5 rounded-xl bg-[#fff8e7] p-4 text-xs leading-5 text-[#725a22]">Approval locks the numbered run. Later corrections create linked entries rather than rewriting payroll history.</div></article></section>
      </TabsContent>

      <TabsContent value="provinces" className="space-y-5">
        <section className="rounded-2xl border border-[#ded6e8] bg-white p-5 sm:p-6"><TestStepHeading icon={<Landmark />} title="Canadian jurisdiction roadmap" detail="Alberta is the launch jurisdiction. Additional provinces and territories will use the same versioned rule framework; Quebec is outside the planned product scope." /><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ProvinceCard code="AB" name="Alberta" status="Active" active /><ProvinceCard code="BC" name="British Columbia" status="Planned" /><ProvinceCard code="SK" name="Saskatchewan" status="Planned" /><ProvinceCard code="MB" name="Manitoba" status="Planned" /><ProvinceCard code="ON" name="Ontario" status="Planned" /><ProvinceCard code="NB" name="New Brunswick" status="Planned" /><ProvinceCard code="NS" name="Nova Scotia" status="Planned" /><ProvinceCard code="PE" name="Prince Edward Island" status="Planned" /><ProvinceCard code="NL" name="Newfoundland and Labrador" status="Planned" /><ProvinceCard code="YT" name="Yukon" status="Planned" /><ProvinceCard code="NT" name="Northwest Territories" status="Planned" /><ProvinceCard code="NU" name="Nunavut" status="Planned" /><ProvinceCard code="QC" name="Quebec" status="Out of scope" excluded /></div><div className="mt-6 rounded-xl border border-[#ded6e8] bg-[#fcfaff] p-4 text-sm leading-6 text-[#655b73]"><strong className="text-[#35284b]">Jurisdiction is explicit:</strong> employee residence, work location, province of employment for tax purposes and employment-standards jurisdiction are stored separately.</div></section>
      </TabsContent>
    </Tabs>
  </>;
}

function CorrectionsView() {
  const [reason, setReason] = useState("underpayment");
  const [employee, setEmployee] = useState("Noah Williams");
  const [hours, setHours] = useState("8.00");
  const [rate, setRate] = useState("30.00");
  const [effectiveDate, setEffectiveDate] = useState("2026-08-31");
  const [calculated, setCalculated] = useState(false);
  const [approved, setApproved] = useState(false);
  const [persistStatus, setPersistStatus] = useState<"idle" | "saving" | "error">("idle");
  const gross = Math.max(0, (Number(hours) || 0) * (Number(rate) || 0));
  const deductions = gross * 0.214;
  const net = gross - deductions;
  const fee = 12;

  const downloadCorrectionEft = () => downloadText("comcheq-correction-run-X001-eft-test.txt", ["COMCHEQ CORRECTION EFT — TEST ONLY", `Employee: ${employee}`, "Correction run: X001", "Pay date: 2026-09-02", `Deposit: ${net.toFixed(2)}`, `Reason: ${reason}`].join("\n"), "text/plain;charset=us-ascii");
  const approveCorrection = async () => {
    setPersistStatus("saving");
    try {
      const employeeId = employees.find((item) => item.name === employee)?.name === "Avery Chen" ? "EMP-0001" : employees.find((item) => item.name === employee)?.name === "Noah Williams" ? "EMP-0002" : employees.find((item) => item.name === employee)?.name === "Priya Singh" ? "EMP-0003" : "EMP-0004";
      const createResponse = await fetch("/api/v1/configuration", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_correction", employeeId, correctionType: reason, effectiveDate, payDate: "2026-09-02", grossCents: Math.round(gross * 100), deductionsCents: Math.round(deductions * 100), explanation: `Client-created ${reason} associated with run 17` }) });
      const created = await createResponse.json() as { correctionRunId?: string; error?: string };
      if (!createResponse.ok || !created.correctionRunId) throw new Error(created.error || "Correction draft could not be stored.");
      const approveResponse = await fetch("/api/v1/configuration", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve_correction", correctionRunId: created.correctionRunId }) });
      const result = await approveResponse.json() as { error?: string };
      if (!approveResponse.ok) throw new Error(result.error || "Correction could not be approved.");
      setApproved(true); setPersistStatus("idle");
    } catch { setPersistStatus("error"); }
  };

  return <>
    <PageHeading eyebrow="Exception workflow" title="Corrections & recovery" description="Correct an employee without a manual cheque, while preserving the original numbered payroll and its audit history." action={<Badge className="border-0 bg-[#fce7f3] px-3 py-2 text-[#a21caf]">Extra EFT run · $12.00</Badge>} />
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
      <article className="rounded-2xl border border-[#ded6e8] bg-white p-5 sm:p-6">
        <TestStepHeading icon={<RefreshCw />} title="Create a linked correction" detail="Choose what happened. Comcheq proposes the safest correction path and links it to the affected employee and payroll date." />
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Correction type"><Select value={reason} onValueChange={(value) => { setReason(value); setCalculated(false); setApproved(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="underpayment">Employee underpayment</SelectItem><SelectItem value="overpayment">Employee overpayment</SelectItem><SelectItem value="rejected">Rejected EFT deposit</SelectItem><SelectItem value="reversal">Reverse incorrect payment</SelectItem><SelectItem value="prior">Prior-period adjustment</SelectItem><SelectItem value="zero">Zero-net adjustment</SelectItem></SelectContent></Select></Field><Field label="Employee"><Select value={employee} onValueChange={setEmployee}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{employees.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Original effective date"><Input type="date" min="2026-01-01" max="2035-12-31" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></Field><Field label="Linked pay run"><Input value="Run 17 · September 4, 2026" readOnly className="bg-[#f6f2f8]" /></Field><Field label="Missed hours"><Input inputMode="decimal" value={hours} onChange={(event) => { setHours(event.target.value); setCalculated(false); setApproved(false); }} /></Field><Field label="Hourly rate"><Input inputMode="decimal" value={rate} onChange={(event) => { setRate(event.target.value); setCalculated(false); setApproved(false); }} /></Field></div>
        <div className="mt-5 rounded-xl bg-[#fff8e7] p-4 text-sm leading-6 text-[#725a22]"><strong>Recommended path:</strong> Create extra run X001, calculate statutory deductions, generate one EFT deposit and preserve the original payroll unchanged.</div>
        <div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => { setCalculated(true); setApproved(false); setPersistStatus("idle"); }} className="bg-[#d72d91] text-white hover:bg-[#b91c77]"><ReceiptText className="size-4" />Calculate correction</Button>{calculated && !approved && <Button disabled={persistStatus === "saving"} onClick={approveCorrection} className="bg-[#00a29a] text-white hover:bg-[#087f7a]"><LockKeyhole className="size-4" />{persistStatus === "saving" ? "Approving…" : "Approve extra run"}</Button>}</div>
        {persistStatus === "error" && <div className="mt-4 rounded-xl bg-[#fff0f0] p-4 text-sm text-[#9f2929]">The correction requires an authenticated payroll role before it can be stored and approved.</div>}
        {approved && <div className="mt-5 rounded-xl bg-[#effcf9] p-4"><div className="flex items-start gap-3"><BadgeCheck className="mt-0.5 size-5 text-[#00a29a]" /><div><h2 className="font-semibold text-[#0f6f74]">Correction run X001 approved</h2><p className="mt-1 text-sm leading-6 text-[#347b78]">The correction is locked and linked to run 17. The client can send the test EFT to its bank without changing the original payroll.</p><Button onClick={downloadCorrectionEft} className="mt-3 bg-[#d72d91] text-white hover:bg-[#b91c77]"><Download className="size-4" />Download correction EFT</Button></div></div></div>}
      </article>

      <aside className="space-y-4"><article className="rounded-2xl border border-[#ded6e8] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#847990]">Correction totals</p><div className="mt-4 space-y-3"><FundingLine label="Gross adjustment" value={gross} /><FundingLine label="Estimated deductions" value={deductions} /><FundingLine label="Employee deposit" value={net} accent /><FundingLine label="Comcheq fee" value={fee} /><div className="border-t border-[#ded6e8] pt-3"><FundingLine label="Client cash required" value={net + fee} strong /></div></div><Badge className={`mt-4 border-0 ${approved ? "bg-[#ddf8f4] text-[#0f6f74]" : calculated ? "bg-[#fff0ce] text-[#7a5d18]" : "bg-[#f1edf5] text-[#746a80]"}`}>{approved ? "Approved" : calculated ? "Preliminary" : "Not calculated"}</Badge></article>
        <article className="rounded-2xl border border-[#ded6e8] bg-white p-5"><h2 className="font-semibold">Recovery paths</h2><div className="mt-4 space-y-3 text-xs leading-5 text-[#655b73]"><p><strong>Rejected EFT:</strong> correct banking and reissue the same net deposit.</p><p><strong>Overpayment:</strong> record recovery terms without silently reducing future pay.</p><p><strong>Reversal:</strong> reverse the original payment and create a replacement entry.</p><p><strong>Negative net:</strong> stop approval and move collectible balances to recovery.</p></div></article>
      </aside>
    </section>
  </>;
}

function TimelineEvent({ date, title, detail, active = false }: { date: string; title: string; detail: string; active?: boolean }) { return <div className="relative flex gap-3 pb-5 last:pb-0"><div className="flex flex-col items-center"><span className={`mt-1 size-3 rounded-full ${active ? "bg-[#d72d91] ring-4 ring-[#f9c5e4]" : "bg-[#00a29a]"}`} /><span className="mt-1 h-full w-px bg-[#ded6e8] last:hidden" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#847990]">{date}</p><p className="mt-1 text-sm font-semibold">{title}</p><p className="text-xs text-[#746a80]">{detail}</p></div></div>; }
function OpeningBalance({ label, value, hours = false, runs = false }: { label: string; value: string; hours?: boolean; runs?: boolean }) { return <Field label={label}><div className="relative"><Input defaultValue={value} inputMode="decimal" className="pr-16" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#847990]">{hours ? "hours" : runs ? "runs" : "CAD"}</span></div></Field>; }
function RoleCard({ role, person, permissions, support = false }: { role: string; person: string; permissions: string; support?: boolean }) { return <div className={`rounded-xl border p-4 ${support ? "border-[#c9e8e5] bg-[#effcf9]" : "border-[#ded6e8] bg-white"}`}><div className="flex items-center justify-between gap-3"><strong className="text-sm">{role}</strong><Badge className={`border-0 ${support ? "bg-[#00a29a] text-white" : "bg-[#f1edf5] text-[#655b73]"}`}>{support ? "Support only" : "Client"}</Badge></div><p className="mt-1 text-xs font-medium text-[#655b73]">{person}</p><p className="mt-2 text-xs text-[#847990]">{permissions}</p></div>; }
function ControlCheck({ label }: { label: string }) { return <div className="flex items-center gap-3 rounded-xl border border-[#ded6e8] px-4 py-3"><span className="grid size-6 place-items-center rounded-full bg-[#ddf8f4] text-[#0f6f74]"><Check className="size-3.5" /></span><span className="text-sm font-medium">{label}</span><Badge className="ml-auto border-0 bg-[#ddf8f4] text-[#0f6f74]">Passed</Badge></div>; }
function ProvinceCard({ code, name, status, active = false, excluded = false }: { code: string; name: string; status: string; active?: boolean; excluded?: boolean }) { return <article className={`rounded-xl border p-4 ${active ? "border-[#59cfc7] bg-[#effcf9]" : excluded ? "border-[#ded6e8] bg-[#f6f3f7] opacity-70" : "border-[#ded6e8] bg-white"}`}><div className="flex items-start justify-between gap-2"><span className={`grid size-10 place-items-center rounded-xl font-mono text-sm font-bold ${active ? "bg-[#00a29a] text-white" : "bg-[#f1edf5] text-[#655b73]"}`}>{code}</span><Badge className={`border-0 ${active ? "bg-[#ddf8f4] text-[#0f6f74]" : excluded ? "bg-[#e9e4eb] text-[#746a80]" : "bg-[#fce7f3] text-[#a21caf]"}`}>{status}</Badge></div><h3 className="mt-3 text-sm font-semibold">{name}</h3></article>; }

function GuidedPayrollTestView() {
  const [stage, setStage] = useState(0);
  const [periodStart, setPeriodStart] = useState("2026-09-01");
  const [periodEnd, setPeriodEnd] = useState("2026-09-15");
  const [payDate, setPayDate] = useState("2026-09-18");
  const [regularHours, setRegularHours] = useState("80.00");
  const [overtimeHours, setOvertimeHours] = useState("2.50");
  const [absenceAuthorized, setAbsenceAuthorized] = useState(false);

  const dateIsValid = (value: string) => /^20(2[6-9]|3[0-5])-\d{2}-\d{2}$/.test(value);
  const inputsValid = [periodStart, periodEnd, payDate].every(dateIsValid) && Number(regularHours) >= 0 && Number(overtimeHours) >= 0;
  const formattedPayDate = dateIsValid(payDate)
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${payDate}T00:00:00Z`))
    : "Enter a date from 2026 to 2035";
  const complete = (index: number) => stage > index;
  const active = (index: number) => stage === index;

  const amounts = { gross: 2872.50, tax: 489.15, cpp: 165, ei: 46.82, other: 62.50, net: 2109.03, cra: 931.52, fee: 12, total: 3052.55 };
  const reset = () => {
    setStage(0); setPeriodStart("2026-09-01"); setPeriodEnd("2026-09-15"); setPayDate("2026-09-18");
    setRegularHours("80.00"); setOvertimeHours("2.50"); setAbsenceAuthorized(false);
  };
  const downloadEft = () => downloadText("comcheq-guided-test-eft.txt", [
    "COMCHEQ CPA005 TEST FILE — NOT FOR PRODUCTION", "Client: Prairie North Services Ltd.",
    "Pay run: E2E-001", `Pay date: ${payDate}`, "Employee: Noah Williams", "Account: ATB •••• 9204", `Deposit: ${amounts.net.toFixed(2)}`,
  ].join("\n"), "text/plain;charset=us-ascii");
  const downloadRegister = () => downloadText("comcheq-guided-test-register.csv", [
    "run,employee,department,regular_hours,overtime_hours,holiday_pay,gross,tax,cpp,ei,other,net",
    `E2E-001,Noah Williams,020 Field Services,${regularHours},${overtimeHours},240.00,2872.50,489.15,165.00,46.82,62.50,2109.03`,
  ].join("\n"), "text/csv;charset=utf-8");
  const downloadRemittance = () => downloadText("comcheq-guided-test-remittance.txt", [
    "COMCHEQ REMITTANCE SUMMARY", "Prairie North Services Ltd. · ••••••••• RP0001", "Remitter frequency: Monthly",
    "Due date: October 15, 2026", "Income tax: $489.15", "CPP (employee + employer): $330.00", "EI (employee + employer): $112.37", "Total CRA obligation: $931.52",
    "Client pays CRA directly. Comcheq does not withdraw or hold these funds.",
  ].join("\n"));

  const steps = [
    ["1", "Employer", "Account and schedule"], ["2", "Employee", "Pay profile"], ["3", "Payroll inputs", "Dates and hours"],
    ["4", "Stat holiday", "Eligibility evidence"], ["5", "Preliminary", "Review totals"], ["6", "Approve", "Lock and export"],
  ];

  return <>
    <PageHeading eyebrow="Client test workspace" title="Run a payroll from start to finish" description="A connected, guided test of the client experience. No funds move, and every exported file is clearly marked as test data." action={<Button variant="outline" onClick={reset} className="border-[#d2c7e1] bg-white"><RefreshCw className="size-4" />Reset test</Button>} />

    <div className="mb-5 flex flex-wrap items-center gap-2">
      <Badge className="border-0 bg-[#ddf8f4] text-[#0f6f74]"><ShieldCheck className="mr-1 size-3.5" />Client-controlled banking</Badge>
      <Badge className="border-0 bg-[#fce7f3] text-[#a21caf]">No advance withdrawal</Badge>
      <Badge className="border-0 bg-[#f1edf5] text-[#655b73]">Fictional test data</Badge>
    </div>

    <section className="mb-6 grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Test progress">
      {steps.map(([number, title, detail], index) => <div key={title} className={`rounded-xl border p-3 transition ${active(index) ? "border-[#e24aa5] bg-[#fff0f8] ring-2 ring-[#f9c5e4]" : complete(index) ? "border-[#9adbd4] bg-[#effcf9]" : "border-[#ded6e8] bg-white"}`}>
        <div className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${complete(index) ? "bg-[#00a29a] text-white" : active(index) ? "bg-[#d72d91] text-white" : "bg-[#eee8f5] text-[#746a80]"}`}>{complete(index) ? <Check className="size-3.5" /> : number}</span><strong className="text-xs">{title}</strong></div>
        <p className="mt-2 text-[11px] text-[#847990]">{detail}</p>
      </div>)}
    </section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-2xl border border-[#ded6e8] bg-white p-5 sm:p-6">
        {stage === 0 && <div><TestStepHeading icon={<Building2 />} title="Confirm employer setup" detail="The information collected during onboarding controls the payroll schedule and CRA reminder dates." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><TestFact label="Legal employer" value="Prairie North Services Ltd." /><TestFact label="CRA payroll account" value="••••••••• RP0001" /><TestFact label="Pay frequency" value="Semi-monthly · 24 runs" /><TestFact label="Remittance threshold" value="Monthly remitter" /></div>
          <div className="mt-5 rounded-xl bg-[#fff7e5] p-4 text-sm leading-6 text-[#725a22]"><strong>Calendar reminder:</strong> September deductions are due to CRA on October 15, 2026.</div>
          <Button onClick={() => setStage(1)} className="mt-6 bg-[#d72d91] text-white hover:bg-[#b91c77]">Confirm employer setup<ChevronRight className="size-4" /></Button>
        </div>}

        {stage === 1 && <div><TestStepHeading icon={<Users />} title="Review the employee" detail="The client owns new-hire details, departments, pay settings and lifecycle changes." />
          <div className="mt-5 rounded-2xl border border-[#ded6e8] p-5"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#fce7f3] font-bold text-[#a21caf]">NW</span><div><h2 className="font-semibold">Noah Williams</h2><p className="mt-1 text-sm text-[#746a80]">Field Technician · 020 Field Services</p></div><Badge className="ml-auto border-0 bg-[#dcfce7] text-[#0f766e]">Active</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><TestFact label="Pay rate" value="$30.00 per hour" /><TestFact label="Vacation" value="4% paid each cheque" /><TestFact label="Province" value="Alberta" /><TestFact label="Deposit account" value="ATB •••• 9204" /></div></div>
          <Button onClick={() => setStage(2)} className="mt-6 bg-[#d72d91] text-white hover:bg-[#b91c77]">Confirm employee profile<ChevronRight className="size-4" /></Button>
        </div>}

        {stage === 2 && <div><TestStepHeading icon={<Clock3 />} title="Enter payroll dates and hours" detail="Dates use a fixed four-digit year range, with a full-date confirmation to prevent silent calendar errors." />
          <div className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="Period starts"><Input type="date" min="2026-01-01" max="2035-12-31" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></Field><Field label="Period ends"><Input type="date" min="2026-01-01" max="2035-12-31" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></Field><Field label="Pay date"><Input type="date" min="2026-01-01" max="2035-12-31" value={payDate} onChange={(event) => setPayDate(event.target.value)} /></Field></div>
          <p className={`mt-2 text-xs ${dateIsValid(payDate) ? "text-[#0f766e]" : "text-[#b42318]"}`}>Pay date: <strong>{formattedPayDate}</strong></p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Regular hours"><Input inputMode="decimal" value={regularHours} onChange={(event) => setRegularHours(event.target.value)} /></Field><Field label="Overtime hours"><Input inputMode="decimal" value={overtimeHours} onChange={(event) => setOvertimeHours(event.target.value)} /></Field></div>
          {!inputsValid && <p className="mt-3 text-sm text-[#b42318]">Use dates from 2026 through 2035 and enter non-negative hours.</p>}
          <Button disabled={!inputsValid} onClick={() => setStage(3)} className="mt-6 bg-[#d72d91] text-white hover:bg-[#b91c77]">Save payroll inputs<ChevronRight className="size-4" /></Button>
        </div>}

        {stage === 3 && <div><TestStepHeading icon={<CalendarDays />} title="Resolve Labour Day eligibility" detail="The system has loaded Alberta holidays and surfaced the evidence behind the result." />
          <div className="mt-5 rounded-2xl border border-[#ded6e8] p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a21caf]">Monday, September 7, 2026</p><h2 className="mt-1 text-lg font-semibold">Labour Day</h2></div><Badge className="w-fit border-0 bg-[#fff0ce] text-[#7a5d18]">Needs attendance answer</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><TestFact label="Prior employment" value="30+ workdays · passed" /><TestFact label="Schedule test" value="5 of prior 9 · passed" /><TestFact label="Holiday pay" value="$240.00 average day" /></div></div>
          <div className="mt-4 flex w-full items-center gap-3 rounded-xl border border-[#ded6e8] p-4 hover:bg-[#fcfaff]"><Checkbox id="guided-absence" checked={absenceAuthorized} onCheckedChange={(checked) => setAbsenceAuthorized(checked === true)} /><label htmlFor="guided-absence" className="min-w-0 flex-1 cursor-pointer text-left"><strong className="block text-sm">Absence was authorized</strong><span className="mt-1 block text-xs text-[#746a80]">Noah did not work his scheduled shift after the holiday; the manager approved the absence.</span></label></div>
          <Button disabled={!absenceAuthorized} onClick={() => setStage(4)} className="mt-6 bg-[#d72d91] text-white hover:bg-[#b91c77]">Confirm authorized absence<ChevronRight className="size-4" /></Button>
        </div>}

        {stage === 4 && <div><TestStepHeading icon={<ReceiptText />} title="Review preliminary payroll" detail="Employee deposits, government remittances and Comcheq fees are separated before approval." />
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#ded6e8]"><Table><TableBody><MoneyRow label="Regular earnings" value={2400} /><MoneyRow label="Overtime earnings" value={112.5} /><MoneyRow label="Vacation pay" value={120} /><MoneyRow label="Labour Day pay" value={240} /><MoneyRow label="Gross earnings" value={amounts.gross} strong /><MoneyRow label="Income tax, CPP, EI and other" value={amounts.gross - amounts.net} /><MoneyRow label="Employee EFT deposit" value={amounts.net} strong /></TableBody></Table></div>
          <Button onClick={() => setStage(5)} className="mt-6 bg-[#d72d91] text-white hover:bg-[#b91c77]">Calculate preliminary payroll<ChevronRight className="size-4" /></Button>
        </div>}

        {stage === 5 && <div><TestStepHeading icon={<LockKeyhole />} title="Approve and create outputs" detail="Approval locks this fictional run, creates its audit record and enables the client-controlled files." />
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#fff0f8] to-[#e9f7f6] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[#00a29a]" /><div><h2 className="font-semibold">Ready to approve</h2><p className="mt-1 text-sm leading-6 text-[#655b73]">One employee · one EFT transaction · $10.00 base fee + $2.00 transaction fee. Comcheq does not collect payroll or remittance funds.</p></div></div></div>
          <Button onClick={() => setStage(6)} className="mt-6 bg-[#d72d91] text-white hover:bg-[#b91c77]"><LockKeyhole className="size-4" />Approve test payroll</Button>
        </div>}

        {stage === 6 && <div><div className="grid size-14 place-items-center rounded-2xl bg-[#00a29a] text-white"><Check className="size-7" /></div><h2 className="mt-5 text-2xl font-semibold">End-to-end test complete</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#746a80]">Run E2E-001 is locked. Download the test bank file, payroll register and CRA obligation summary below.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><Button onClick={downloadEft} className="h-auto min-h-24 flex-col bg-[#d72d91] py-4 text-white hover:bg-[#b91c77]"><Download className="size-5" /><span>Download EFT test file</span><small className="font-normal opacity-80">$2,109.03 deposit</small></Button><Button variant="outline" onClick={downloadRegister} className="h-auto min-h-24 flex-col border-[#d2c7e1] bg-white py-4"><FileSpreadsheet className="size-5" /><span>Download register</span><small className="font-normal text-[#746a80]">CSV payroll detail</small></Button><Button variant="outline" onClick={downloadRemittance} className="h-auto min-h-24 flex-col border-[#d2c7e1] bg-white py-4"><Landmark className="size-5" /><span>Download remittance</span><small className="font-normal text-[#746a80]">Client pays CRA</small></Button></div>
        </div>}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-2xl border border-[#ded6e8] bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#847990]">Preliminary funding</p><div className="mt-4 space-y-3"><FundingLine label="Employee deposit" value={amounts.net} accent /><FundingLine label="CRA obligation" value={amounts.cra} /><FundingLine label="Comcheq fee" value={amounts.fee} /><div className="border-t border-[#ded6e8] pt-3"><FundingLine label="Total cash required" value={amounts.total} strong /></div></div><p className="mt-4 rounded-lg bg-[#effcf9] p-3 text-xs leading-5 text-[#0f6f74]">You send the EFT file to your bank and pay CRA directly by the due date.</p></div>
        <div className="rounded-2xl border border-[#ded6e8] bg-white p-5"><div className="flex items-center gap-2"><CalendarDays className="size-4 text-[#d72d91]" /><h2 className="text-sm font-semibold">Important dates</h2></div><div className="mt-4 space-y-4 text-sm"><div><p className="text-xs text-[#847990]">Employee pay date</p><strong>{formattedPayDate}</strong></div><div><p className="text-xs text-[#847990]">CRA remittance due</p><strong>October 15, 2026</strong></div></div></div>
      </aside>
    </section>
  </>;
}

function TestStepHeading({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fce7f3] text-[#a21caf] [&>svg]:size-5">{icon}</span><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-[#746a80]">{detail}</p></div></div>;
}

function TestFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f8f5fa] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#847990]">{label}</p><p className="mt-1 text-sm font-semibold text-[#35284b]">{value}</p></div>;
}

function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <TableRow className={strong ? "bg-[#fcf3f9]" : ""}><TableCell className={`px-4 ${strong ? "font-semibold" : "text-[#655b73]"}`}>{label}</TableCell><TableCell className={`px-4 text-right font-mono tabular-nums ${strong ? "font-bold text-[#a21caf]" : ""}`}>{currency.format(value)}</TableCell></TableRow>;
}

function FundingLine({ label, value, accent = false, strong = false }: { label: string; value: number; accent?: boolean; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className={`text-sm ${strong ? "font-semibold text-[#35284b]" : "text-[#746a80]"}`}>{label}</span><strong className={`font-mono tabular-nums ${strong ? "text-lg" : "text-sm"} ${accent ? "text-[#a21caf]" : "text-[#35284b]"}`}>{currency.format(value)}</strong></div>;
}

function DocumentsView({ focus, roeSavedAt, onEditRoe, onRoePreview }: { focus: "all" | "t4" | "roe"; roeSavedAt: string; onEditRoe: () => void; onRoePreview: () => void }) {
  const heading = focus === "t4"
    ? { eyebrow: "Year-end centre", title: "T4 slips & year-end", description: "Balance the calendar year, preview employee slips and prepare the CRA filing package." }
    : focus === "roe"
      ? { eyebrow: "Employment records", title: "Records of Employment", description: "Create, edit, validate and retain ROEs from approved numbered pay-run history." }
      : { eyebrow: "Compliance centre", title: "Year-end & employment records", description: "T4 slips draw from the calendar-year record; ROEs draw from approved numbered pay runs." };
  return <><PageHeading {...heading} /><section className="grid gap-4 lg:grid-cols-2"><article className={`rounded-2xl border bg-white p-5 ${focus === "t4" ? "border-[#b39df0] ring-4 ring-[#eee9ff]" : "border-[#ded6e8]"}`}><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff]"><FileText className="size-5" /></span><Badge className="border-0 bg-[#f1edf5] text-[#746a80]">2026 preparation</Badge></div><h2 className="mt-5 text-lg font-semibold">T4 slips</h2><p className="mt-1 text-sm leading-6 text-[#746a80]">Four projected employee slips. Generation opens after the final calendar-year pay run is approved and year-to-date balances pass validation.</p><div className="mt-4 rounded-xl bg-[#f7f4fa] p-3 text-xs text-[#746a80]"><strong className="text-[#35284b]">Year-end sequence:</strong> balance → preview → correct → generate slips and CRA XML → email statements.</div><Button variant="outline" className="mt-4 w-full border-[#d2c7e1] bg-white"><FileSpreadsheet className="size-4" />Review 2026 balances</Button></article><article className={`rounded-2xl border bg-[#e9f7f6] p-5 ${focus === "roe" ? "border-[#4fc9c0] ring-4 ring-[#dff7f5]" : "border-[#c7b8ed]"}`}><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-[#6d4aff] text-white"><FilePenLine className="size-5" /></span><Badge className="border-0 bg-white text-[#0f6f74]">1 draft</Badge></div><h2 className="mt-5 text-lg font-semibold">Records of Employment</h2><p className="mt-1 text-sm leading-6 text-[#655b73]">Create, validate, edit, preview and amend ROEs using the employee’s approved pay-run history.</p><Button onClick={onEditRoe} className="mt-4 w-full bg-[#6d4aff] text-white hover:bg-[#5934d1]"><Plus className="size-4" />Create or edit ROE</Button><p className="mt-3 text-xs text-[#746a80]">Drafts are free. A finalized ROE transaction is billed at $2.00.</p></article></section><section className="mt-6 overflow-hidden rounded-2xl border border-[#ded6e8] bg-white"><div className="border-b border-[#eae3f0] px-5 py-4"><h2 className="font-semibold">ROE drafts and submissions</h2></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#fcfaff] hover:bg-[#fcfaff]"><TableHead className="px-5">Employee</TableHead><TableHead>Reason</TableHead><TableHead>Last day</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="pr-5 text-right">Actions</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell className="px-5 py-4 font-medium">Noah Williams</TableCell><TableCell className="text-sm">A00 · Shortage of work</TableCell><TableCell className="text-sm">Aug 28, 2026</TableCell><TableCell><Badge className="border-0 bg-[#fff0ce] text-[#7a5d18]">Draft</Badge></TableCell><TableCell className="text-xs text-[#746a80]">{roeSavedAt}</TableCell><TableCell className="pr-5"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={onRoePreview} className="border-[#ded6e8]"><Download className="size-4" />Draft</Button><Button size="sm" onClick={onEditRoe} className="bg-[#6d4aff] text-white hover:bg-[#5934d1]"><FilePenLine className="size-4" />Edit</Button></div></TableCell></TableRow></TableBody></Table></div></section><div className="mt-4 rounded-xl bg-[#fff6df] p-3 text-xs leading-5 text-[#725a22]">This prototype demonstrates the workflow only. T4 and ROE files are not yet certified for CRA or Service Canada submission.</div></>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7757e8]">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#746a80]">{description}</p></div>{action}</div>;
}

function RunNumber({ value, light = false }: { value: string; light?: boolean }) {
  return <div className={`grid size-20 shrink-0 place-items-center rounded-2xl shadow-sm ${light ? "bg-white text-[#6d4aff]" : "bg-[#6d4aff] text-white"}`}><div className="text-center"><span className={`block text-[10px] font-bold uppercase tracking-[0.18em] ${light ? "text-[#78688d]" : "text-[#ded2ff]"}`}>Pay run</span><strong className="font-mono text-4xl tracking-[-0.08em]">{value}</strong></div></div>;
}

function WorkflowTile({ step, title, detail, status, icon, onClick, accent = false, warn = false }: { step: string; title: string; detail: string; status: string; icon: React.ReactNode; onClick: () => void; accent?: boolean; warn?: boolean }) {
  return <button type="button" onClick={onClick} className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(109,74,255,0.12)] ${accent ? "border-[#b9a4f2] bg-[#eee9ff]" : "border-[#ded6e8] bg-white"}`}><div className="flex items-start justify-between"><span className={`grid size-10 place-items-center rounded-xl [&>svg]:size-5 ${accent ? "bg-[#6d4aff] text-white" : "bg-[#f4f0ff] text-[#6d4aff]"}`}>{icon}</span><span className="text-[10px] font-bold tracking-[0.14em] text-[#9a8da9]">{step}</span></div><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#746a80]">{detail}</p><div className="mt-4 flex items-center justify-between"><Badge className={`border-0 ${warn ? "bg-[#fff0ce] text-[#7a5d18]" : accent ? "bg-white text-[#0f6f74]" : "bg-[#f4f0ff] text-[#655b73]"}`}>{status}</Badge><ChevronRight className="size-4 text-[#9d90ab] transition group-hover:translate-x-0.5" /></div></button>;
}

function OutputTile({ title, detail, icon, status, onClick, disabled = false }: { title: string; detail: string; icon: React.ReactNode; status: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="flex items-center gap-3 rounded-2xl border border-[#ded6e8] bg-white p-4 text-left transition enabled:hover:border-[#b9a4f2] enabled:hover:bg-[#fbf9ff] disabled:cursor-not-allowed disabled:opacity-55"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff] [&>svg]:size-5">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block truncate text-xs text-[#746a80]">{detail}</span></span><Badge className="border-0 bg-[#f4f0ff] text-[#655b73]">{status}</Badge></button>;
}

function viewLabel(view: View) {
  const labels: Record<View, string> = {
    home: "Payroll overview",
    test: "Guided end-to-end test",
    configuration: "Configuration centre",
    corrections: "Corrections & recovery",
    setup: "Customer setup",
    accounts: "CRA payroll accounts",
    employees: "Employees",
    departments: "Departments",
    components: "Pay components",
    time: "Time entry",
    payroll: "Pay run 17",
    extra: "Extra run",
    holidays: "Stat holidays",
    calculation: "Calculation evidence",
    history: "Pay-run history",
    reports: "Reports & statements",
    remittances: "CRA remittances",
    documents: "Compliance centre",
    t4: "T4 & year-end",
    roe: "Records of Employment",
    data: "CSV data exchange",
    platform: "API & controls",
  };
  return labels[view];
}

function DeepNavigation({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  return <div className="flex h-full min-h-0 flex-col">
    <nav className="space-y-2" aria-label="Payroll workspace">
      <NavigationItem icon={<HomeIcon />} label="Overview" active={view === "home"} onClick={() => onNavigate("home")} />
      <NavigationItem icon={<ListChecks />} label="Guided test" meta="E2E" active={view === "test"} onClick={() => onNavigate("test")} />
      <NavigationGroup label="People">
        <NavigationItem icon={<Users />} label="Employees" active={view === "employees"} onClick={() => onNavigate("employees")} nested />
        <NavigationItem icon={<Building2 />} label="Departments" active={view === "departments"} onClick={() => onNavigate("departments")} nested />
        <NavigationItem icon={<Layers3 />} label="Pay components" active={view === "components"} onClick={() => onNavigate("components")} nested />
        <NavigationItem icon={<Clock3 />} label="Time entry" active={view === "time"} onClick={() => onNavigate("time")} nested />
      </NavigationGroup>
      <NavigationGroup label="Payroll">
        <NavigationItem icon={<WalletCards />} label="Current run" meta="17" active={view === "payroll"} onClick={() => onNavigate("payroll")} nested />
        <NavigationItem icon={<Plus />} label="Extra run" active={view === "extra"} onClick={() => onNavigate("extra")} nested />
        <NavigationItem icon={<RefreshCw />} label="Corrections" active={view === "corrections"} onClick={() => onNavigate("corrections")} nested />
        <NavigationItem icon={<CalendarDays />} label="Stat holidays" meta="9" active={view === "holidays"} onClick={() => onNavigate("holidays")} nested />
        <NavigationItem icon={<History />} label="Pay-run history" active={view === "history"} onClick={() => onNavigate("history")} nested />
        <NavigationItem icon={<FileText />} label="Reports & statements" active={view === "reports"} onClick={() => onNavigate("reports")} nested />
      </NavigationGroup>
      <NavigationGroup label="Compliance">
        <NavigationItem icon={<FileArchive />} label="Compliance centre" active={view === "documents"} onClick={() => onNavigate("documents")} nested />
        <NavigationItem icon={<Building2 />} label="CRA remittances" active={view === "remittances"} onClick={() => onNavigate("remittances")} nested />
        <NavigationItem icon={<FileText />} label="T4 & year-end" active={view === "t4"} onClick={() => onNavigate("t4")} nested />
        <NavigationItem icon={<FilePenLine />} label="ROE forms" meta="1" active={view === "roe"} onClick={() => onNavigate("roe")} nested />
      </NavigationGroup>
      <NavigationGroup label="Company">
        <NavigationItem icon={<Settings2 />} label="Configuration centre" active={view === "configuration"} onClick={() => onNavigate("configuration")} nested />
        <NavigationItem icon={<Settings2 />} label="Customer setup" active={view === "setup"} onClick={() => onNavigate("setup")} nested />
        <NavigationItem icon={<ReceiptText />} label="Payroll accounts" active={view === "accounts"} onClick={() => onNavigate("accounts")} nested />
        <NavigationItem icon={<FileSpreadsheet />} label="CSV data exchange" active={view === "data"} onClick={() => onNavigate("data")} nested />
      </NavigationGroup>
    </nav>
    <div className="mt-auto pt-5">
      <div className="rounded-2xl border border-[#ded3f4] bg-gradient-to-br from-[#f5f1ff] to-[#e6fbfb] p-3.5">
        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6e55a6]">Usage billing</span><LockKeyhole className="size-3.5 text-[#159d9a]" /></div>
        <p className="mt-2 font-mono text-lg font-bold text-[#5b35c7]">$10 + $2</p>
        <p className="mt-0.5 text-[11px] leading-4 text-[#746a80]">Per run + each finalized transaction. Drafts stay free.</p>
      </div>
    </div>
  </div>;
}

function NavigationGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <Collapsible defaultOpen className="group/nav rounded-xl">
    <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#847990] transition hover:bg-[#f3effb] hover:text-[#6d4aff]">
      {label}<ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-0.5 space-y-0.5 border-l border-[#e5ddee] pl-2">
      {children}
    </CollapsibleContent>
  </Collapsible>;
}

function NavigationItem({ icon, label, meta, active, nested = false, onClick }: { icon: React.ReactNode; label: string; meta?: string; active: boolean; nested?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${nested ? "" : "mb-1"} ${active ? "bg-[#eee9ff] text-[#6d4aff] shadow-[inset_3px_0_0_#6d4aff]" : "text-[#655b73] hover:bg-[#f3effb] hover:text-[#4c2d93]"}`}>
    <span className={`grid size-7 shrink-0 place-items-center rounded-lg [&>svg]:size-4 ${active ? "bg-white text-[#6d4aff] shadow-sm" : "bg-[#f2eef7] text-[#806f91] group-hover:bg-white"}`}>{icon}</span>
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {meta && <span className={`grid min-w-6 place-items-center rounded-md px-1.5 py-1 font-mono text-[10px] font-bold ${active ? "bg-[#6d4aff] text-white" : "bg-[#eee8f5] text-[#7b6c89]"}`}>{meta}</span>}
  </button>;
}

function ScheduleItem({ icon, label, value, divided = false }: { icon: React.ReactNode; label: string; value: string; divided?: boolean }) {
  return <div className={`flex items-center gap-3 px-5 py-4 ${divided ? "border-t border-[#eae3f0] sm:border-l sm:border-t-0" : ""}`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f4f0ff] text-[#6d4aff] [&>svg]:size-4.5">{icon}</span><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#746a80]">{label}</p><p className="mt-1 text-sm font-semibold text-[#35284b]">{value}</p></div></div>;
}

function SummaryCard({ label, value, note, icon, accent = false }: { label: string; value: string; note: string; icon: React.ReactNode; accent?: boolean }) {
  return <article className={`rounded-2xl border p-5 ${accent ? "border-[#c7b8ed] bg-[#e9f7f6]" : "border-[#ded6e8] bg-[#ffffff]"}`}><div className="flex items-center justify-between"><p className="text-xs font-medium text-[#746a80]">{label}</p><span className={`[&>svg]:size-4 ${accent ? "text-[#00a29a]" : "text-[#847990]"}`}>{icon}</span></div><p className="mt-3 font-mono text-2xl font-bold tracking-[-0.04em] tabular-nums">{value}</p><p className="mt-1 text-xs text-[#847990]">{note}</p></article>;
}

function FundingCell({ label, value, note, icon, accent = false }: { label: string; value: string; note: string; icon: React.ReactNode; accent?: boolean }) {
  return <div className={`p-5 ${accent ? "bg-[#eee9ff]" : "bg-white"}`}><div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-xl ${accent ? "bg-[#6d4aff] text-white" : "bg-[#f4f0ff] text-[#6d4aff]"}`}>{icon}</span><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#847990]">{label}</span></div><p className={`mt-4 font-mono text-xl font-bold ${accent ? "text-[#5b35c7]" : "text-[#35284b]"}`}>{value}</p><p className="mt-1 text-[11px] leading-4 text-[#746a80]">{note}</p></div>;
}

function MoneyCell({ value, muted = false, strong = false }: { value: number; muted?: boolean; strong?: boolean }) {
  return <TableCell className={`text-right font-mono text-sm tabular-nums ${strong ? "font-semibold text-[#2f2447]" : muted ? "text-[#746a80]" : "font-medium"}`}>{currency.format(value)}</TableCell>;
}

function Checklist({ label, complete = false }: { label: string; complete?: boolean }) {
  return <div className="flex items-center gap-3"><span className={`grid size-5 place-items-center rounded-full ${complete ? "bg-[#6ee7d8] text-[#0e4b59]" : "border border-white/35 text-transparent"}`}><BadgeCheck className="size-3.5" /></span><span className={complete ? "text-white" : "text-[#e7ddf7]"}>{label}</span></div>;
}

function EmployeeIdentity({ employee }: { employee: (typeof employees)[number] }) {
  return <div className="flex items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eee9ff] text-xs font-bold text-[#0f6f74]">{employee.initials}</div><div><p className="text-sm font-semibold">{employee.name}</p><p className="mt-0.5 text-xs text-[#746a80]">{employee.role} · {employee.email}</p></div></div>;
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e3dbef] bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#81758f]">{label}</p><p className="mt-1.5 text-xs font-semibold text-[#2f2447]">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#655b73]">{label}</span>{children}</label>;
}

function MiniStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="rounded-xl bg-[#f7f4fa] p-4"><span className="grid size-7 place-items-center rounded-lg bg-[#6d4aff] font-mono text-xs font-bold text-white">{number}</span><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-[#746a80]">{detail}</p></div>;
}
