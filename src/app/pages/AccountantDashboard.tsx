import { useMemo, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  Filter,
  PieChart as PieChartIcon,
  Printer,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { exportCsv } from "../services/exportService";
import { normalizePaymentStatus } from "../constants/statuses";
import type { CollectionsReportResponse, DelinquencyReportResponse } from "../services/reportService";
import type { PaymentDto } from "../services/paymentService";

type AccountantDashboardProps = {
  loading: boolean;
  errorMessage: string | null;
  collectionsReport: CollectionsReportResponse | null;
  delinquencyReport: DelinquencyReportResponse | null;
  paymentHistory: PaymentDto[];
};

type KpiCardProps = {
  title: string;
  value: string;
  description: string;
  icon: ElementType;
  tone: IconTone;
  comparisonLabel?: string;
  comparisonTone?: "positive" | "negative" | "neutral";
};

type IconTone = "slate" | "blue" | "emerald" | "amber" | "red" | "violet" | "teal" | "indigo";

const ICON_TONE_CLASSES: Record<IconTone, { container: string; icon: string }> = {
  slate: { container: "border-slate-200 bg-slate-50 text-slate-700", icon: "text-slate-700" },
  blue: { container: "border-blue-200 bg-blue-50 text-blue-700", icon: "text-blue-700" },
  emerald: { container: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: "text-emerald-700" },
  amber: { container: "border-amber-200 bg-amber-50 text-amber-700", icon: "text-amber-700" },
  red: { container: "border-red-200 bg-red-50 text-red-700", icon: "text-red-700" },
  violet: { container: "border-violet-200 bg-violet-50 text-violet-700", icon: "text-violet-700" },
  teal: { container: "border-teal-200 bg-teal-50 text-teal-700", icon: "text-teal-700" },
  indigo: { container: "border-indigo-200 bg-indigo-50 text-indigo-700", icon: "text-indigo-700" },
};

type DelinquentRow = {
  taxpayerName: string;
  propertyId: string;
  outstandingBalance: number;
  dueDate: string;
  monthsDelayed: number;
  rawDueDate: string;
};

type VerificationRow = {
  referenceNumber: string;
  taxpayerName: string;
  amount: number;
  submittedDate: string;
  verificationStatus: string;
  propertyId: string;
};

function formatCurrency(value: number) {
  return `₱ ${value.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
}

function getMonthsLate(dueDateUtc: string, referenceDateUtc: string) {
  const dueDate = new Date(dueDateUtc);
  const referenceDate = new Date(referenceDateUtc);

  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(referenceDate.getTime())) {
    return 0;
  }

  let months = ((referenceDate.getFullYear() - dueDate.getFullYear()) * 12) + referenceDate.getMonth() - dueDate.getMonth();

  if (referenceDate.getDate() > dueDate.getDate() || months === 0) {
    months += 1;
  }

  return Math.max(months, 0);
}

function buildMonthlyRevenue(collectionsReport: CollectionsReportResponse | null) {
  const labels = collectionsReport?.labels ?? [];
  const values = collectionsReport?.datasets[0]?.data ?? [];

  return labels.map((label, index) => ({
    name: formatMonthLabel(label),
    collected: Number(values[index] ?? 0),
  }));
}

function buildBarangayComparison(collectionsReport: CollectionsReportResponse | null) {
  return (collectionsReport?.byBarangay ?? []).map((item) => ({
    name: item.barangay,
    due: Number(item.totalDue),
    collected: Number(item.totalCollected),
  }));
}

function buildStatusOverview(paymentHistory: PaymentDto[]) {
  const counts = { Paid: 0, Pending: 0, Overdue: 0 };

  paymentHistory.forEach((payment) => {
    const normalized = normalizePaymentStatus(payment.status);

    if (normalized === "Paid") {
      counts.Paid += 1;
      return;
    }

    if (normalized === "Late") {
      counts.Overdue += 1;
      return;
    }

    counts.Pending += 1;
  });

  return [
    { name: "Paid", value: counts.Paid },
    { name: "Pending", value: counts.Pending },
    { name: "Overdue", value: counts.Overdue },
  ].filter((entry) => entry.value > 0);
}

function buildRecentPayments(paymentHistory: PaymentDto[]) {
  return [...paymentHistory]
    .sort((left, right) => (right.paymentDateUtc ?? "").localeCompare(left.paymentDateUtc ?? ""))
    .slice(0, 6);
}

function buildDelinquents(paymentHistory: PaymentDto[]) {
  return paymentHistory
    .filter((payment) => Number(payment.remainingBalance ?? 0) > 0 || normalizePaymentStatus(payment.status) !== "Paid")
    .sort((left, right) => (left.dueDateUtc ?? "").localeCompare(right.dueDateUtc ?? ""))
    .map<DelinquentRow>((payment) => ({
      taxpayerName: payment.ownerName ?? "Unknown taxpayer",
      propertyId: payment.propertyPin ?? String(payment.propertyId),
      outstandingBalance: Number(payment.remainingBalance ?? Math.max(Number(payment.amountDue) - Number(payment.amountPaid), 0)),
      dueDate: formatDate(payment.dueDateUtc),
      monthsDelayed: payment.dueDateUtc ? getMonthsLate(payment.dueDateUtc, payment.paymentDateUtc ?? new Date().toISOString()) : 0,
      rawDueDate: payment.dueDateUtc ?? "",
    }))
    .slice(0, 8);
}

function buildVerificationQueue(paymentHistory: PaymentDto[]) {
  return paymentHistory
    .filter((payment) => normalizePaymentStatus(payment.status) !== "Paid")
    .sort((left, right) => (left.dueDateUtc ?? "").localeCompare(right.dueDateUtc ?? ""))
    .map<VerificationRow>((payment) => ({
      referenceNumber: payment.officialReceiptNumber ?? payment.referenceNumber ?? `PAY-${String(payment.id).padStart(4, "0")}`,
      taxpayerName: payment.ownerName ?? "Unknown taxpayer",
      amount: Number(payment.amountPaid),
      submittedDate: formatDate(payment.paymentDateUtc),
      verificationStatus: normalizePaymentStatus(payment.status),
      propertyId: payment.propertyPin ?? String(payment.propertyId),
    }))
    .slice(0, 8);
}

function KpiCard({ title, value, description, icon: Icon, tone, comparisonLabel, comparisonTone = "neutral" }: KpiCardProps) {
  const comparisonClass = comparisonTone === "positive"
    ? "text-emerald-700"
    : comparisonTone === "negative"
      ? "text-red-600"
      : "text-slate-500";
  const toneClasses = ICON_TONE_CLASSES[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border p-3 ${toneClasses.container}`}>
          <Icon className={`h-5 w-5 ${toneClasses.icon}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
          {comparisonLabel ? <p className={`mt-2 text-xs font-medium ${comparisonClass}`}>{comparisonLabel}</p> : null}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  icon: Icon,
  tone = "slate",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  icon?: ElementType;
  tone?: IconTone;
}) {
  const toneClasses = ICON_TONE_CLASSES[tone];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
        {Icon ? (
          <div className={`mt-0.5 rounded-lg border p-2 ${toneClasses.container}`}>
            <Icon className={`h-4 w-4 ${toneClasses.icon}`} />
          </div>
        ) : null}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function AccountantDashboard({
  loading,
  errorMessage,
  collectionsReport,
  delinquencyReport,
  paymentHistory,
}: AccountantDashboardProps) {
  const { user, can } = useAuth();
  const navigate = useNavigate();

  const monthlyRevenue = useMemo(() => buildMonthlyRevenue(collectionsReport), [collectionsReport]);
  const barangayComparison = useMemo(() => buildBarangayComparison(collectionsReport), [collectionsReport]);
  const paymentStatusOverview = useMemo(() => buildStatusOverview(paymentHistory), [paymentHistory]);
  const recentPayments = useMemo(() => buildRecentPayments(paymentHistory), [paymentHistory]);
  const delinquentAccounts = useMemo(() => buildDelinquents(paymentHistory), [paymentHistory]);
  const verificationQueue = useMemo(() => buildVerificationQueue(paymentHistory), [paymentHistory]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const thisMonthKey = todayIso.slice(0, 7);

  const totalCollectionsToday = paymentHistory
    .filter((payment) => (payment.paymentDateUtc ?? "").slice(0, 10) === todayIso)
    .reduce((sum, payment) => sum + Number(payment.amountPaid), 0);

  const monthlyRevenueValue = monthlyRevenue.at(-1)?.collected ?? 0;
  const previousMonthlyRevenue = monthlyRevenue.at(-2)?.collected ?? 0;
  const collectionGrowthPct = previousMonthlyRevenue > 0
    ? ((monthlyRevenueValue - previousMonthlyRevenue) / previousMonthlyRevenue) * 100
    : monthlyRevenueValue > 0
      ? 100
      : 0;

  const outstandingBalances = delinquencyReport?.summary.outstandingBalance
    ?? paymentHistory.reduce((sum, payment) => sum + Number(payment.remainingBalance ?? 0), 0);

  const delinquentTaxpayers = new Set(
    paymentHistory.filter((payment) => normalizePaymentStatus(payment.status) !== "Paid").map((payment) => payment.propertyPin ?? String(payment.propertyId)),
  ).size;

  const pendingVerifications = verificationQueue.length;

  const alerts = [
    {
      title: `${delinquentTaxpayers} overdue accounts this month`,
      desc: "Review unpaid and late payments in the delinquent accounts table.",
      tone: "red" as IconTone,
      path: "/app/payment-management",
    },
    {
      title: `${pendingVerifications} pending payment verifications`,
      desc: "Check the verification queue and confirm the recorded payments.",
      tone: "violet" as IconTone,
      path: "/app/payment-management",
    },
    {
      title: `${collectionGrowthPct < 0 ? "Revenue decreased" : "Revenue increased"} by ${Math.abs(collectionGrowthPct).toFixed(1)}% this week`,
      desc: "Use the revenue trend and barangay comparison charts to review collection changes.",
      tone: "blue" as IconTone,
      path: "/app/reporting",
    },
    {
      title: "Upcoming payment deadlines",
      desc: "Track items that are nearing their due date in the delinquency list.",
      tone: "amber" as IconTone,
      path: "/app/reporting",
    },
  ];

  const quickActions = [
    { label: "Record Payment", icon: CreditCard, tone: "emerald" as IconTone, path: "/app/payment-management", visible: can("payment.create") },
    { label: "Verify Payment", icon: ShieldCheck, tone: "blue" as IconTone, path: "/app/payment-management", visible: can("payment.view") },
    { label: "Generate Report", icon: FileText, tone: "indigo" as IconTone, path: "/app/reporting", visible: can("reporting.generate") },
    { label: "Search Taxpayer", icon: Search, tone: "teal" as IconTone, path: "/app/payment-management", visible: can("payment.view") },
    { label: "View Collection Summary", icon: BarChart3, tone: "violet" as IconTone, path: "/app/reporting", visible: can("reporting.view") },
  ].filter((item) => item.visible);

  const handleExportMonthlyRevenue = () => {
    exportCsv(
      `monthly-revenue-${thisMonthKey}.csv`,
      ["Month", "Collected"],
      monthlyRevenue.map((entry) => [entry.name, entry.collected]),
    );
  };

  const handleExportDelinquents = () => {
    exportCsv(
      `delinquency-report-${todayIso}.csv`,
      ["Taxpayer Name", "Property ID", "Outstanding Balance", "Due Date", "Months Delayed"],
      delinquentAccounts.map((row) => [row.taxpayerName, row.propertyId, row.outstandingBalance, row.dueDate, row.monthsDelayed]),
    );
  };

  const handleExportDailyCollections = () => {
    const dailyPayments = paymentHistory
      .filter((payment) => (payment.paymentDateUtc ?? "").slice(0, 10) === todayIso)
      .sort((left, right) => (right.paymentDateUtc ?? "").localeCompare(left.paymentDateUtc ?? ""));

    exportCsv(
      `daily-collections-${todayIso}.csv`,
      ["OR Number", "Taxpayer Name", "Property ID", "Amount", "Payment Date", "Payment Method"],
      dailyPayments.map((payment) => [
        payment.officialReceiptNumber ?? payment.referenceNumber ?? `PAY-${payment.id}`,
        payment.ownerName ?? "Unknown taxpayer",
        payment.propertyPin ?? String(payment.propertyId),
        Number(payment.amountPaid),
        formatDate(payment.paymentDateUtc),
        payment.paymentMethod,
      ]),
    );
  };

  const handleExportSummary = () => {
    exportCsv(
      `accountant-summary-${todayIso}.csv`,
      ["Metric", "Value"],
      [
        ["Total Collections Today", totalCollectionsToday],
        ["Monthly Revenue", monthlyRevenueValue],
        ["Outstanding Balances", outstandingBalances],
        ["Delinquent Taxpayers", delinquentTaxpayers],
        ["Pending Payment Verifications", pendingVerifications],
        ["Collection Growth Percentage", `${collectionGrowthPct.toFixed(2)}%`],
      ],
    );
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Accountant Dashboard</p>
          <h1 className="mt-1 tracking-tight text-slate-900">Collections and Financial Monitoring</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, <span className="font-medium text-slate-700">{user?.name}</span>. Monitor collections, verify payments, and prepare financial reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/app/payment-management")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <CreditCard className="h-4 w-4" /> Record Payment
          </button>
          <button
            onClick={() => navigate("/app/reporting")}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
          >
            <FileText className="h-4 w-4" /> Generate Report
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Loading live accountant dashboard data...
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          title="Total Collections Today"
          value={formatCurrency(totalCollectionsToday)}
          description="Payments recorded in the system today"
          icon={Wallet}
          tone="emerald"
          comparisonLabel={totalCollectionsToday > 0 ? "Updated from live payment records" : "No collections posted today"}
          comparisonTone={totalCollectionsToday > 0 ? "positive" : "neutral"}
        />
        <KpiCard
          title="Monthly Revenue"
          value={formatCurrency(monthlyRevenueValue)}
          description="Current reporting period revenue"
          icon={TrendingUp}
          tone="blue"
          comparisonLabel={previousMonthlyRevenue > 0 ? `${collectionGrowthPct >= 0 ? "+" : ""}${collectionGrowthPct.toFixed(1)}% vs previous month` : "Not enough history for comparison"}
          comparisonTone={collectionGrowthPct >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          title="Outstanding Balances"
          value={formatCurrency(outstandingBalances)}
          description="Total unpaid balance across live records"
          icon={CreditCard}
          tone="amber"
          comparisonLabel={outstandingBalances > 0 ? "Requires follow-up" : "No outstanding balance recorded"}
          comparisonTone={outstandingBalances > 0 ? "negative" : "positive"}
        />
        <KpiCard
          title="Delinquent Taxpayers"
          value={delinquentTaxpayers.toLocaleString()}
          description="Taxpayers with unpaid or late status"
          icon={AlertTriangle}
          tone="red"
          comparisonLabel={delinquentTaxpayers > 0 ? "Needs monitoring" : "All clear"}
          comparisonTone={delinquentTaxpayers > 0 ? "negative" : "positive"}
        />
        <KpiCard
          title="Pending Payment Verifications"
          value={pendingVerifications.toLocaleString()}
          description="Payments requiring review"
          icon={CheckCircle2}
          tone="violet"
          comparisonLabel={pendingVerifications > 0 ? "Open verification queue" : "No pending reviews"}
          comparisonTone={pendingVerifications > 0 ? "negative" : "positive"}
        />
        <KpiCard
          title="Collection Growth Percentage"
          value={`${collectionGrowthPct.toFixed(1)}%`}
          description="Current month versus previous month"
          icon={TrendingDown}
          tone="indigo"
          comparisonLabel={collectionGrowthPct >= 0 ? "Positive revenue movement" : "Collection pace declined"}
          comparisonTone={collectionGrowthPct >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard title="Collection Analytics" subtitle="Live revenue movement and barangay-level performance" icon={BarChart3} tone="blue">
            <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-slate-700" />
                  <p className="text-sm font-medium text-slate-900">Monthly Revenue Trend</p>
                </div>
                <div className="h-[260px] rounded-xl border border-slate-200 bg-white p-3">
                  {monthlyRevenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} tickFormatter={(value) => `₱${Number(value).toLocaleString()}`} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} formatter={(value: number) => formatCurrency(Number(value))} />
                        <Line type="monotone" dataKey="collected" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 4, fill: "#0f172a" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                      No collection trend data available yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-700" />
                    <p className="text-sm font-medium text-slate-900">Barangay Collection Comparison</p>
                  </div>
                  <div className="h-[260px] rounded-xl border border-slate-200 bg-white p-3">
                    {barangayComparison.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barangayComparison} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} tickFormatter={(value) => `₱${Number(value).toLocaleString()}`} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} formatter={(value: number, name) => [formatCurrency(Number(value)), name === "collected" ? "Collected" : "Tax Due"]} />
                          <Bar dataKey="collected" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={24} name="Collected" />
                          <Bar dataKey="due" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={24} name="Tax Due" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                        No barangay comparison data available yet.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-slate-700" />
                    <p className="text-sm font-medium text-slate-900">Payment Status Overview</p>
                  </div>
                  <div className="h-[260px] rounded-xl border border-slate-200 bg-white p-3">
                    {paymentStatusOverview.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentStatusOverview} cx="50%" cy="45%" innerRadius={54} outerRadius={82} paddingAngle={4} dataKey="value">
                            {paymentStatusOverview.map((entry, index) => (
                              <Cell key={entry.name} fill={index === 0 ? "#0f172a" : index === 1 ? "#64748b" : "#cbd5e1"} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} />
                          <Legend verticalAlign="bottom" height={20} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                        No payment status data available yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Compliance and Alerts" subtitle="Current items needing attention" icon={AlertTriangle} tone="red">
          <div className="space-y-3 p-5">
            {alerts.map((alert) => {
              const toneClasses = ICON_TONE_CLASSES[alert.tone];

              return (
              <button
                key={alert.title}
                onClick={() => navigate(alert.path)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-lg border p-2 ${toneClasses.container}`}>
                    <CalendarDays className={`h-4 w-4 ${toneClasses.icon}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{alert.desc}</p>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Recent Payments" subtitle="Latest recorded payments from the live database" icon={CreditCard} tone="emerald">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">OR Number</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Taxpayer Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Property ID</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentPayments.length > 0 ? recentPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-blue-700">{payment.officialReceiptNumber ?? payment.referenceNumber ?? `PAY-${payment.id}`}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{payment.ownerName ?? "Unknown taxpayer"}</td>
                    <td className="px-5 py-4 text-sm font-medium text-blue-700">{payment.propertyPin ?? String(payment.propertyId)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{formatCurrency(Number(payment.amountPaid))}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{formatDate(payment.paymentDateUtc)}</td>
                    <td className="px-5 py-4 text-sm font-medium text-violet-700">{payment.paymentMethod}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">No recent payments recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Delinquent Accounts" subtitle="Unpaid and overdue taxpayers that need follow-up" icon={TrendingDown} tone="amber">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Taxpayer Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Property ID</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Balance</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Due Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Months Delayed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {delinquentAccounts.length > 0 ? delinquentAccounts.map((row) => (
                  <tr key={`${row.propertyId}-${row.rawDueDate}`} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm text-slate-700">{row.taxpayerName}</td>
                    <td className="px-5 py-4 text-sm font-medium text-blue-700">{row.propertyId}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-red-700">{formatCurrency(row.outstandingBalance)}</td>
                    <td className="px-5 py-4 text-sm text-amber-700">{row.dueDate}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-red-700">{row.monthsDelayed}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No delinquent accounts found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Payment Verification Queue" subtitle="Payments waiting for verification or follow-up" icon={ShieldCheck} tone="violet">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reference Number</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Taxpayer</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Property ID</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Submitted Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Verification Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {verificationQueue.length > 0 ? verificationQueue.map((row) => (
                <tr key={`${row.referenceNumber}-${row.propertyId}`} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4 text-sm font-medium text-blue-700">{row.referenceNumber}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{row.taxpayerName}</td>
                  <td className="px-5 py-4 text-sm font-medium text-blue-700">{row.propertyId}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{formatCurrency(row.amount)}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{row.submittedDate}</td>
                  <td className={`px-5 py-4 text-sm font-medium ${row.verificationStatus.toLowerCase().includes("paid") ? "text-emerald-700" : row.verificationStatus.toLowerCase().includes("late") ? "text-amber-700" : "text-slate-700"}`}>{row.verificationStatus}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => navigate("/app/payment-management")}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">No payment verification items are waiting right now.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Financial Reports" subtitle="Quick access to common Accountant reports and exports" icon={FileText} tone="teal">
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            <button onClick={handleExportDailyCollections} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`rounded-xl border p-3 ${ICON_TONE_CLASSES.blue.container}`}><CalendarDays className={`h-5 w-5 ${ICON_TONE_CLASSES.blue.icon}`} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Daily Collection Report</p>
                <p className="text-xs text-slate-500">Export today's payments</p>
              </div>
            </button>
            <button onClick={handleExportMonthlyRevenue} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`rounded-xl border p-3 ${ICON_TONE_CLASSES.indigo.container}`}><BarChart3 className={`h-5 w-5 ${ICON_TONE_CLASSES.indigo.icon}`} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Monthly Revenue Report</p>
                <p className="text-xs text-slate-500">Download monthly trend</p>
              </div>
            </button>
            <button onClick={handleExportDelinquents} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`rounded-xl border p-3 ${ICON_TONE_CLASSES.red.container}`}><TrendingDown className={`h-5 w-5 ${ICON_TONE_CLASSES.red.icon}`} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Delinquency Report</p>
                <p className="text-xs text-slate-500">Export overdue accounts</p>
              </div>
            </button>
            <button onClick={handleExportSummary} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`rounded-xl border p-3 ${ICON_TONE_CLASSES.teal.container}`}><Download className={`h-5 w-5 ${ICON_TONE_CLASSES.teal.icon}`} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Export to Excel</p>
                <p className="text-xs text-slate-500">Summary CSV for Excel</p>
              </div>
            </button>
            <button onClick={handleExportPdf} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`rounded-xl border p-3 ${ICON_TONE_CLASSES.slate.container}`}><Printer className={`h-5 w-5 ${ICON_TONE_CLASSES.slate.icon}`} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Export to PDF</p>
                <p className="text-xs text-slate-500">Use browser print dialog</p>
              </div>
            </button>
            <button onClick={() => navigate("/app/reporting")} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`rounded-xl border p-3 ${ICON_TONE_CLASSES.violet.container}`}><ChevronDown className={`h-5 w-5 ${ICON_TONE_CLASSES.violet.icon}`} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">Open Reporting Module</p>
                <p className="text-xs text-slate-500">View official report snapshots</p>
              </div>
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Quick Actions" subtitle="Most used Accountant workflows" icon={Filter} tone="indigo">
          <div className="space-y-3 p-5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const toneClasses = ICON_TONE_CLASSES[action.tone];
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`rounded-xl border p-3 transition group-hover:opacity-95 ${toneClasses.container}`}>
                    <Icon className={`h-5 w-5 ${toneClasses.icon}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{action.label}</p>
                    <p className="text-xs text-slate-500">Open</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}