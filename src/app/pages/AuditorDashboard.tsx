import { useMemo, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Clock3,
  Download,
  FileText,
  LineChart as LineChartIcon,
  Lock,
  PieChart as PieChartIcon,
  Printer,
  ShieldCheck,
  ShieldAlert,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AuditLogDto } from "../services/auditService";
import type { ComplianceStatusItem } from "../services/complianceService";
import { exportCsv } from "../services/exportService";
import { normalizeComplianceStatus } from "../constants/statuses";
import type { CollectionsReportResponse, DelinquencyReportResponse, PropertiesReportResponse } from "../services/reportService";
import type { PaymentDto } from "../services/paymentService";

type AuditorDashboardProps = {
  loading: boolean;
  errorMessage: string | null;
  collectionsReport: CollectionsReportResponse | null;
  delinquencyReport: DelinquencyReportResponse | null;
  propertiesReport: PropertiesReportResponse | null;
  paymentHistory: PaymentDto[];
  auditLogs: AuditLogDto[];
  complianceItems: ComplianceStatusItem[];
};

type MetricCardProps = {
  title: string;
  value: string;
  description: string;
  icon: ElementType;
  trendLabel: string;
  trendTone: "positive" | "negative" | "neutral";
  iconColor?: "blue" | "emerald" | "amber" | "red" | "slate";
};

type SectionCardProps = {
  title: string;
  subtitle: string;
  icon: ElementType;
  children: React.ReactNode;
};

type BadgeTone = "emerald" | "amber" | "red" | "slate" | "blue";

const CHART_COLORS = ["#0f172a", "#475569", "#94a3b8", "#10b981", "#f59e0b", "#ef4444"];
const EMPTY_MESSAGES = {
  riskFlags: "No active audit risk flags are available right now.",
  activities: "No recent auditor-visible activity has been recorded yet.",
  transactions: "No recent financial transactions are available.",
  alerts: "No open audit alerts are present at the moment.",
  chart: "Live data will appear here once the API returns records.",
};

function formatCurrency(value: number) {
  return `₱ ${value.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function normalizeAction(action: string) {
  const normalized = action.trim().toLowerCase();

  if (normalized.includes("login")) {
    return "Login";
  }

  if (normalized.includes("payment")) {
    return normalized.includes("edit") || normalized.includes("update") ? "Payment Edited" : "Payment Recorded";
  }

  if (normalized.includes("assessment")) {
    return normalized.includes("edit") || normalized.includes("update") ? "Assessment Modified" : "Assessment Review";
  }

  if (normalized.includes("property")) {
    return normalized.includes("edit") || normalized.includes("update") ? "Property Edited" : "Property Registered";
  }

  if (normalized.includes("role")) {
    return "User Role Change";
  }

  if (normalized.includes("report")) {
    return "Report Generated";
  }

  return action;
}

function moduleFromAction(action: string) {
  const normalized = action.toLowerCase();

  if (normalized.includes("payment")) return "Payment Management";
  if (normalized.includes("assessment")) return "Tax Calculation";
  if (normalized.includes("property")) return "Property Registry";
  if (normalized.includes("role")) return "User Management";
  if (normalized.includes("report")) return "Reporting";
  if (normalized.includes("login")) return "Authentication";
  if (normalized.includes("compliance")) return "Compliance";

  return "Audit Trail";
}

function toneForSeverity(severity: string): BadgeTone {
  const normalized = severity.trim().toLowerCase();

  if (normalized.includes("high") || normalized.includes("critical")) return "red";
  if (normalized.includes("medium") || normalized.includes("warning")) return "amber";
  if (normalized.includes("low")) return "blue";

  return "slate";
}

function toneClasses(tone: BadgeTone) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "amber":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "red":
      return "bg-red-50 text-red-700 border-red-200";
    case "blue":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function iconColorClasses(color?: "blue" | "emerald" | "amber" | "red" | "slate") {
  switch (color) {
    case "emerald":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "amber":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "red":
      return "bg-red-100 text-red-700 border-red-200";
    case "blue":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function MetricCard({ title, value, description, icon: Icon, trendLabel, trendTone, iconColor = "slate" }: MetricCardProps) {
  const trendClass = trendTone === "positive"
    ? "text-emerald-700"
    : trendTone === "negative"
      ? "text-red-600"
      : "text-slate-500";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border p-3 ${iconColorClasses(iconColor)}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
          <p className={`mt-2 text-xs font-medium ${trendClass}`}>{trendLabel}</p>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children }: SectionCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
        <Icon className="mt-0.5 h-4 w-4 text-slate-700" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }: { icon: ElementType; title: string; message: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <div className="rounded-full border border-slate-200 bg-white p-3 text-slate-500 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-800">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-6 text-slate-500">{message}</p>
    </div>
  );
}

function SkeletonBlock({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <SkeletonBlock className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-3">
                <SkeletonBlock className="h-3 w-28" />
                <SkeletonBlock className="h-8 w-24" />
                <SkeletonBlock className="h-3 w-40" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-5 w-52" />
          <div className="mt-6 space-y-4">
            <SkeletonBlock className="h-64 w-full" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SkeletonBlock className="h-5 w-48" />
          <div className="mt-6 space-y-4">
            <SkeletonBlock className="h-64 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function findRelatedProcessor(payment: PaymentDto, auditLogs: AuditLogDto[]) {
  const paymentPin = payment.propertyPin?.toLowerCase() ?? String(payment.propertyId);
  const relatedLog = [...auditLogs]
    .reverse()
    .find((log) => {
      const action = log.action.toLowerCase();
      const description = (log.description ?? "").toLowerCase();
      const entity = `${log.entityName ?? ""} ${log.entityId ?? ""}`.toLowerCase();
      return action.includes("payment") && (description.includes(paymentPin) || entity.includes(paymentPin) || description.includes(payment.ownerName?.toLowerCase() ?? ""));
    });

  return relatedLog?.performedByUsername?.trim() || "Treasury Desk";
}

function buildMonthlyCollectionData(collectionsReport: CollectionsReportResponse | null) {
  if (!collectionsReport?.labels?.length) {
    return [];
  }

  return collectionsReport.labels.map((label, index) => ({
    name: label,
    value: Number(collectionsReport.datasets[0]?.data[index] ?? 0),
  }));
}

function buildRevenueTrend(paymentHistory: PaymentDto[]) {
  if (paymentHistory.length === 0) {
    return [];
  }

  const buckets = new Map<string, number>();

  paymentHistory.forEach((payment) => {
    const date = new Date(payment.paymentDateUtc ?? payment.dueDateUtc ?? "");
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) ?? 0) + Number(payment.amountPaid));
  });

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([key, value]) => ({
      name: new Date(`${key}-01T00:00:00`).toLocaleString("en-PH", { month: "short" }),
      value,
    }));
}

function buildPaymentStatusData(paymentHistory: PaymentDto[]) {
  if (paymentHistory.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();

  paymentHistory.forEach((payment) => {
    const status = normalizeComplianceStatus(payment.status);
    const normalized = status === "Compliant" ? "Paid" : status === "Late" ? "Overdue" : "Pending";
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return ["Paid", "Pending", "Overdue"].map((status) => ({
    name: status,
    value: counts.get(status) ?? 0,
  })).filter((entry) => entry.value > 0);
}

function buildComplianceDistribution(complianceItems: ComplianceStatusItem[]) {
  if (complianceItems.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();

  complianceItems.forEach((item) => {
    const status = normalizeComplianceStatus(item.status);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });

  return ["Compliant", "Late", "Unpaid"].map((status) => ({
    name: status,
    value: counts.get(status) ?? 0,
  })).filter((entry) => entry.value > 0);
}

function buildRiskFlags(auditLogs: AuditLogDto[]) {
  if (auditLogs.length === 0) {
    return [];
  }

  const suspicious = auditLogs
    .filter((log) => {
      const action = log.action.toLowerCase();
      return !log.succeeded
        || action.includes("login")
        || (action.includes("payment") && (action.includes("edit") || action.includes("update")))
        || (action.includes("property") && (action.includes("edit") || action.includes("update")))
        || action.includes("role")
        || action.includes("delete");
    })
    .slice(0, 6)
    .map((log) => {
      const action = normalizeAction(log.action);
      const severity = !log.succeeded
        ? "High"
        : action === "User Role Change" || action === "Payment Edited" || action === "Assessment Modified"
          ? "Medium"
          : "Low";

      return {
        logId: `LOG-${String(log.id).padStart(4, "0")}`,
        user: log.performedByUsername?.trim() || "System",
        timestamp: log.timestamp || log.createdAtUtc,
        severity,
        status: !log.succeeded ? "Pending review" : "Investigating",
        module: moduleFromAction(log.action),
        details: log.description?.trim() || normalizeAction(log.action),
      };
    });

  return suspicious;
}

function buildAuditActivities(auditLogs: AuditLogDto[]) {
  if (auditLogs.length === 0) {
    return [];
  }

  return [...auditLogs]
    .sort((left, right) => (right.createdAtUtc ?? "").localeCompare(left.createdAtUtc ?? ""))
    .slice(0, 6)
    .map((log) => ({
      user: log.performedByUsername?.trim() || "System",
      action: normalizeAction(log.action),
      timestamp: log.createdAtUtc,
      module: moduleFromAction(log.action),
    }));
}

function buildTransactions(paymentHistory: PaymentDto[], auditLogs: AuditLogDto[]) {
  if (paymentHistory.length === 0) {
    return [];
  }

  return [...paymentHistory]
    .sort((left, right) => (right.paymentDateUtc ?? "").localeCompare(left.paymentDateUtc ?? ""))
    .slice(0, 6)
    .map((payment) => ({
      orNumber: payment.officialReceiptNumber ?? payment.referenceNumber ?? `PAY-${String(payment.id).padStart(4, "0")}`,
      taxpayer: `${payment.ownerName ?? "Unknown taxpayer"} · ${payment.propertyPin ?? String(payment.propertyId)}`,
      amount: Number(payment.amountPaid),
      status: normalizeComplianceStatus(payment.status),
      processedBy: findRelatedProcessor(payment, auditLogs),
      date: payment.paymentDateUtc ?? payment.dueDateUtc ?? new Date().toISOString(),
    }));
}

function buildAlerts(auditFlags: Array<{ severity: string; status: string }>, paymentHistory: PaymentDto[], delinquencyReport: DelinquencyReportResponse | null) {
  const unresolvedIssues = auditFlags.filter((flag) => flag.status.toLowerCase().includes("pending") || flag.status.toLowerCase().includes("invest")).length;
  const suspiciousModifications = auditFlags.filter((flag) => toneForSeverity(flag.severity) !== "blue").length;
  const overduePayments = delinquencyReport?.summary.unpaidCount ?? paymentHistory.filter((payment) => normalizeComplianceStatus(payment.status) !== "Compliant").length;

  const liveAlerts = [
    {
      title: `${unresolvedIssues} unresolved audit issue${unresolvedIssues === 1 ? "" : "s"}`,
      description: "Review the newest risk flags and mark verified items for closure.",
      severity: unresolvedIssues > 0 ? "High" : "Low",
    },
    {
      title: `${suspiciousModifications} suspicious modification${suspiciousModifications === 1 ? "" : "s"}`,
      description: "Look for repeated edits in assessment and payment records.",
      severity: suspiciousModifications > 0 ? "Medium" : "Low",
    },
    {
      title: `${overduePayments} overdue payment record${overduePayments === 1 ? "" : "s"}`,
      description: "Cross-check delinquency details before filing the audit summary.",
      severity: overduePayments > 0 ? "Medium" : "Low",
    },
  ];

  return liveAlerts.some((alert) => Number(alert.title.split(" ")[0]) > 0)
    ? liveAlerts
    : [];
}

export default function AuditorDashboard({
  loading: _loading,
  errorMessage,
  collectionsReport,
  delinquencyReport,
  propertiesReport,
  paymentHistory,
  auditLogs,
  complianceItems,
}: AuditorDashboardProps) {
  const navigate = useNavigate();

  const totalProperties = propertiesReport?.summary.totalProperties
    ?? complianceItems.length
    ?? 0;

  const totalTaxCollected = collectionsReport?.summary.totalCollected
    ?? paymentHistory.reduce((sum, payment) => sum + Number(payment.amountPaid), 0);

  const pendingPayments = delinquencyReport?.summary.unpaidCount
    ?? paymentHistory.filter((payment) => normalizeComplianceStatus(payment.status) !== "Compliant").length;

  const complianceTotals = useMemo(() => {
    const counts = complianceItems.reduce<Record<"Compliant" | "Late" | "Unpaid", number>>((acc, item) => {
      const status = normalizeComplianceStatus(item.status);
      acc[status] += 1;
      return acc;
    }, { Compliant: 0, Late: 0, Unpaid: 0 });

    const total = Math.max(complianceItems.length, 0);
    const rate = total > 0 ? (counts.Compliant / total) * 100 : 0;

    return { counts, total, rate };
  }, [complianceItems]);

  const monthlyCollection = useMemo(() => buildMonthlyCollectionData(collectionsReport), [collectionsReport]);
  const revenueTrend = useMemo(() => buildRevenueTrend(paymentHistory), [paymentHistory]);
  const paymentStatus = useMemo(() => buildPaymentStatusData(paymentHistory), [paymentHistory]);
  const complianceDistribution = useMemo(() => buildComplianceDistribution(complianceItems), [complianceItems]);
  const riskFlags = useMemo(() => buildRiskFlags(auditLogs), [auditLogs]);
  const activities = useMemo(() => buildAuditActivities(auditLogs), [auditLogs]);
  const transactions = useMemo(() => buildTransactions(paymentHistory, auditLogs), [paymentHistory, auditLogs]);
  const alerts = useMemo(() => buildAlerts(riskFlags, paymentHistory, delinquencyReport), [riskFlags, paymentHistory, delinquencyReport]);

  const failedLoginCount = riskFlags.filter((flag) => flag.module === "Authentication").length;
  const editedPaymentsCount = riskFlags.filter((flag) => flag.module === "Payment Management").length;
  const modifiedAssessmentsCount = riskFlags.filter((flag) => flag.module === "Tax Calculation" || flag.module === "Property Registry").length;
  const suspiciousActivitiesCount = riskFlags.length;
  const auditRiskFlagsCount = riskFlags.filter((flag) => toneForSeverity(flag.severity) === "red" || toneForSeverity(flag.severity) === "amber").length;

  const metricCards: MetricCardProps[] = [
    {
      title: "Total Properties",
      value: totalProperties.toLocaleString(),
      description: "Properties visible to audit review",
      icon: Building2,
      trendLabel: totalProperties > 0 ? "+ live registry sync" : "No registry data yet",
      trendTone: totalProperties > 0 ? "positive" : "neutral",
      iconColor: "blue",
    },
    {
      title: "Total Tax Collected",
      value: formatCurrency(totalTaxCollected),
      description: "Aggregated from live payment records",
      icon: Wallet,
      trendLabel: totalTaxCollected > 0 ? "Trending with live collections" : "Awaiting payment data",
      trendTone: totalTaxCollected > 0 ? "positive" : "neutral",
      iconColor: "emerald",
    },
    {
      title: "Pending Payments",
      value: pendingPayments.toLocaleString(),
      description: "Accounts requiring follow-up",
      icon: Clock3,
      trendLabel: pendingPayments > 0 ? "Needs verification" : "No outstanding balances",
      trendTone: pendingPayments > 0 ? "negative" : "positive",
      iconColor: "amber",
    },
    {
      title: "Compliance Rate",
      value: formatPercent(complianceTotals.rate),
      description: "Share of compliant properties",
      icon: ShieldCheck,
      trendLabel: complianceTotals.rate >= 85 ? "Above audit threshold" : "Below audit target",
      trendTone: complianceTotals.rate >= 85 ? "positive" : "negative",
      iconColor: "emerald",
    },
    {
      title: "Audit Risk Flags",
      value: auditRiskFlagsCount.toLocaleString(),
      description: "Warnings and critical items",
      icon: ShieldAlert,
      trendLabel: auditRiskFlagsCount > 0 ? "Requires audit attention" : "No active risk flags",
      trendTone: auditRiskFlagsCount > 0 ? "negative" : "positive",
      iconColor: "red",
    },
    {
      title: "Suspicious Activities",
      value: suspiciousActivitiesCount.toLocaleString(),
      description: "Failed logins and unusual edits",
      icon: AlertTriangle,
      trendLabel: `${failedLoginCount} logins, ${editedPaymentsCount} payment edits, ${modifiedAssessmentsCount} assessment changes`,
      trendTone: suspiciousActivitiesCount > 0 ? "negative" : "neutral",
      iconColor: "red",
    },
  ];

  const quickActions = [
    { label: "View Audit Trail", icon: FileText, path: "/app/audit" },
    { label: "Generate Compliance Report", icon: ShieldCheck, path: "/app/compliance" },
    { label: "View Delinquency Report", icon: TrendingDown, path: "/app/reporting" },
    { label: "Generate Barangay Summary", icon: Building2, path: "/app/reporting" },
    { label: "Export PDF", icon: Printer, onClick: () => window.print() },
    {
      label: "Export Excel",
      icon: Download,
      onClick: () => {
        exportCsv(
          `auditor-dashboard-export-${new Date().toISOString().slice(0, 10)}.csv`,
          ["OR Number", "Taxpayer / Property", "Amount", "Status", "Processed By", "Date"],
          transactions.map((row) => [row.orNumber, row.taxpayer, row.amount, row.status, row.processedBy, formatDateTime(row.date)]),
        );
      },
    },
  ];

  if (_loading) {
    return <LoadingState />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Internal Auditor Dashboard</p>
            <h1 className="mt-2 text-slate-900 tracking-tight">TaxSync Audit and Compliance Command Center</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Read-only monitoring for transparency, financial review, audit trail tracking, and suspicious activity detection.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/app/audit")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" /> View Audit Trail
            </button>
            <button
              onClick={() => navigate("/app/reporting")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
            >
              <BarChart3 className="h-4 w-4" /> Open Reports
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-800">Unable to load part of the auditor dashboard</p>
            <p className="text-xs text-red-600">{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((card) => (
          <MetricCard key={card.title} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Financial Monitoring" subtitle="Monthly collections, trend movement, payment health, and compliance mix" icon={BarChart3}>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-900">Monthly Tax Collection</p>
              </div>
              {monthlyCollection.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyCollection} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#0f172a" radius={[8, 8, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={BarChart3} title="No monthly collections" message={EMPTY_MESSAGES.chart} />
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-900">Revenue Trends</p>
              </div>
              {revenueTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="value" stroke="#475569" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={LineChartIcon} title="No revenue trend data" message={EMPTY_MESSAGES.chart} />
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-900">Paid vs Unpaid Taxes</p>
              </div>
              {paymentStatus.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentStatus} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3}>
                        {paymentStatus.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={PieChartIcon} title="No payment status data" message={EMPTY_MESSAGES.chart} />
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-900">Compliance Distribution</p>
              </div>
              {complianceDistribution.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={complianceDistribution} dataKey="value" nameKey="name" innerRadius={46} outerRadius={82} paddingAngle={2}>
                        {complianceDistribution.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={ShieldCheck} title="No compliance distribution data" message={EMPTY_MESSAGES.chart} />
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Compliance Monitoring" subtitle="Compliant, late, and unpaid status coverage" icon={ShieldCheck}>
          <div className="space-y-4 p-5">
            {[
              { label: "Compliant properties", value: complianceTotals.counts.Compliant, total: complianceTotals.total, tone: "emerald" as BadgeTone },
              { label: "Late payments", value: complianceTotals.counts.Late, total: complianceTotals.total, tone: "amber" as BadgeTone },
              { label: "Unpaid taxes", value: complianceTotals.counts.Unpaid, total: complianceTotals.total, tone: "red" as BadgeTone },
            ].map((item) => {
              const percentage = item.total > 0 ? (item.value / item.total) * 100 : 0;

              return (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${toneClasses(item.tone)}`}>
                      {formatPercent(percentage)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${item.tone === "emerald" ? "bg-emerald-500" : item.tone === "amber" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, percentage)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.value.toLocaleString()} records</span>
                    <span>{item.total.toLocaleString()} total reviewed</span>
                  </div>
                </div>
              );
            })}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Audit compliance rate</p>
                  <p className="text-xs text-slate-500">Share of reviewed properties currently compliant</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{formatPercent(complianceTotals.rate)}</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Audit Risk Flags" subtitle="High-risk and warning-level activity requiring verification" icon={ShieldAlert}>
          <div className="p-5">
            {riskFlags.length > 0 ? (
              <div className="space-y-3">
                {riskFlags.map((flag) => {
                  const tone = toneForSeverity(flag.severity);

                  return (
                    <div key={flag.logId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                              {flag.logId}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${toneClasses(tone)}`}>
                              {flag.severity}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {flag.status}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-700">{flag.details}</p>
                          <p className="mt-1 text-xs text-blue-700">{flag.user}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatDateTime(flag.timestamp)} · {flag.module}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs font-medium text-slate-500">Affected module</p>
                          <p className="text-sm font-semibold text-violet-700">{flag.module}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Lock} title="No risk flags" message={EMPTY_MESSAGES.riskFlags} />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Audit Trail / User Activities" subtitle="Recent actions observed in the system" icon={Clock3}>
          <div className="overflow-hidden rounded-b-2xl">
            {activities.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {activities.map((activity) => (
                  <div key={`${activity.user}-${activity.timestamp}-${activity.action}`} className="flex items-start gap-3 px-5 py-4 transition hover:bg-slate-50">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-blue-700">{activity.user}</p>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {activity.module}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-700">{activity.action}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(activity.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <EmptyState icon={Clock3} title="No recent activity" message={EMPTY_MESSAGES.activities} />
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Financial Transaction Review" subtitle="Recent receipts, taxpayers, amounts, and processing details" icon={Wallet}>
          <div className="overflow-x-auto">
            {transactions.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">OR Number</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Taxpayer / Property</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Processed By</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {transactions.map((transaction) => {
                    const statusStr = String(transaction.status);
                    const tone = statusStr === "Compliant" || statusStr === "Paid"
                      ? "emerald"
                      : statusStr === "Late"
                        ? "amber"
                        : "red";

                    return (
                      <tr key={transaction.orNumber} className="hover:bg-slate-50/80">
                        <td className="px-5 py-4 text-sm font-medium text-blue-700">{transaction.orNumber}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{transaction.taxpayer}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{formatCurrency(transaction.amount)}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${toneClasses(tone)}`}>
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-blue-700">{transaction.processedBy}</td>
                        <td className="px-5 py-4 text-sm text-slate-500">{formatDateTime(transaction.date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-5">
                <EmptyState icon={Wallet} title="No transactions available" message={EMPTY_MESSAGES.transactions} />
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Reports & Quick Actions" subtitle="Read-only navigation and export controls" icon={FileText}>
          <div className="space-y-2 p-5">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  onClick={() => {
                    if ("onClick" in action && action.onClick) {
                      action.onClick();
                      return;
                    }

                    if ("path" in action) {
                      navigate(action.path);
                    }
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 transition group-hover:bg-slate-100">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-blue-700">{action.label}</p>
                    <p className="text-xs text-slate-500">Read-only access</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Alerts & Notifications" subtitle="Open issues and unresolved findings" icon={Bell}>
          <div className="space-y-3 p-5">
            {alerts.length > 0 ? alerts.map((alert) => {
              const tone = toneForSeverity(alert.severity);

              return (
                <div key={alert.title} className={`rounded-2xl border bg-white p-4 shadow-sm ${toneClasses(tone)}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg border border-inherit bg-white p-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-blue-700"}`}>{alert.title}</p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">{alert.description}</p>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <EmptyState icon={Bell} title="No alerts available" message={EMPTY_MESSAGES.alerts} />
            )}
          </div>
        </SectionCard>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium text-slate-700">Read-only dashboard.</span>
          <span>Auditor access is limited to monitoring, verification, and export actions.</span>
        </div>
      </div>
    </div>
  );
}