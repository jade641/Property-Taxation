import React, { useMemo, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CreditCard,
  FileUp,
  Home,
  ClipboardList,
  Clock3,
  AlertTriangle,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { normalizePaymentStatus } from "../constants/statuses";
import type { PaymentDto } from "../services/paymentService";
import type { PropertyDto } from "../services/propertyService";
import type { PropertyDocumentDto } from "../services/filingService";

type StaffDashboardProps = {
  loading: boolean;
  errorMessage: string | null;
  properties: PropertyDto[];
  payments: PaymentDto[];
  documents: PropertyDocumentDto[];
};

type KpiCardProps = {
  title: string;
  value: string;
  description: string;
  icon: ElementType;
  tone?: "slate" | "blue" | "emerald" | "amber" | "red" | "violet" | "teal" | "indigo";
};

type PendingTask = {
  propertyId: string;
  ownerName: string;
  missingRequirement: string;
  dateSubmitted: string;
  priority: "High" | "Medium" | "Low";
  actionLabel: string;
  actionPath: string;
  sortKey: number;
};

type ActivityRow = {
  time: string;
  action: string;
  referenceNumber: string;
  status: string;
  sortKey: number;
};

function formatCurrency(value: number) {
  return `₱ ${value.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toTimestamp(value?: string | null) {
  const time = new Date(value ?? "").getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getMonthKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const ICON_TONE_CLASSES: Record<string, { container: string; icon: string }> = {
  slate: { container: "bg-slate-50 text-slate-700 border-slate-200", icon: "text-slate-700" },
  blue: { container: "bg-blue-50 text-blue-700 border-blue-100", icon: "text-blue-700" },
  emerald: { container: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "text-emerald-700" },
  amber: { container: "bg-amber-50 text-amber-700 border-amber-200", icon: "text-amber-700" },
  red: { container: "bg-red-50 text-red-700 border-red-200", icon: "text-red-700" },
  violet: { container: "bg-violet-50 text-violet-700 border-violet-200", icon: "text-violet-700" },
  teal: { container: "bg-teal-50 text-teal-700 border-teal-200", icon: "text-teal-700" },
  indigo: { container: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "text-indigo-700" },
};

function buildMonthlyRegistrations(properties: PropertyDto[]) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    return { key, label: date.toLocaleString("en-PH", { month: "short" }), value: 0 };
  });

  const countsByKey = new Map<string, number>();

  properties.forEach((property) => {
    const key = getMonthKey(property.dateRegisteredUtc);
    if (!key) return;
    countsByKey.set(key, (countsByKey.get(key) ?? 0) + 1);
  });

  return months.map((month) => ({
    name: month.label,
    value: countsByKey.get(month.key) ?? 0,
  }));
}

function buildPaymentStatusData(payments: PaymentDto[]) {
  const counts = new Map<string, number>();

  payments.forEach((payment) => {
    const status = normalizePaymentStatus(payment.status);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });

  return ["Paid", "Late", "Unpaid"].map((status) => ({
    name: status,
    value: counts.get(status) ?? 0,
  })).filter((entry) => entry.value > 0);
}

function buildPendingTasks(properties: PropertyDto[], documents: PropertyDocumentDto[]): PendingTask[] {
  const documentCounts = new Map<number, number>();

  documents.forEach((document) => {
    documentCounts.set(document.propertyId, (documentCounts.get(document.propertyId) ?? 0) + 1);
  });

  const tasks = properties.flatMap<PendingTask>((property) => {
    const missingRequirements: Array<{ label: string; priority: PendingTask["priority"]; actionLabel: string; actionPath: string }> = [];

    if ((property.status ?? "").trim().toLowerCase() === "pending review") {
      missingRequirements.push({ label: "Verification review", priority: "High", actionLabel: "Review", actionPath: "/app/property-registration" });
    }

    if (!property.ownerAddress?.trim()) {
      missingRequirements.push({ label: "Owner mailing address", priority: "Medium", actionLabel: "Update", actionPath: "/app/property-registration" });
    }

    if (!property.taxDeclarationNumber?.trim()) {
      missingRequirements.push({ label: "Tax declaration number", priority: "High", actionLabel: "Update", actionPath: "/app/property-registration" });
    }

    if (!property.zoningClassification?.trim()) {
      missingRequirements.push({ label: "Zoning classification", priority: "Medium", actionLabel: "Update", actionPath: "/app/property-registration" });
    }

    if ((documentCounts.get(property.id) ?? 0) === 0) {
      missingRequirements.push({ label: "Supporting document", priority: "High", actionLabel: "Upload", actionPath: "/app/filing" });
    }

    if (missingRequirements.length === 0) {
      return [];
    }

    const first = missingRequirements[0];
    return [{
      propertyId: property.pin,
      ownerName: property.ownerName,
      missingRequirement: first.label,
      dateSubmitted: formatDate(property.dateRegisteredUtc),
      priority: first.priority,
      actionLabel: first.actionLabel,
      actionPath: first.actionPath,
      sortKey: toTimestamp(property.dateRegisteredUtc),
    }];
  });

  return tasks.sort((left, right) => {
    const priorityScore = (value: PendingTask["priority"]) => (value === "High" ? 3 : value === "Medium" ? 2 : 1);
    return priorityScore(right.priority) - priorityScore(left.priority) || right.sortKey - left.sortKey;
  });
}

function buildActivityRows(properties: PropertyDto[], payments: PaymentDto[], documents: PropertyDocumentDto[]) {
  const rows: ActivityRow[] = [
    ...properties.map((property) => ({
      time: formatDateTime(property.dateRegisteredUtc),
      action: "Property Registered",
      referenceNumber: property.pin,
      status: property.status,
      sortKey: toTimestamp(property.dateRegisteredUtc),
    })),
    ...payments.map((payment) => ({
      time: formatDateTime(payment.paymentDateUtc),
      action: "Payment Recorded",
      referenceNumber: payment.officialReceiptNumber ?? `PAY-${payment.id}`,
      status: normalizePaymentStatus(payment.status),
      sortKey: toTimestamp(payment.paymentDateUtc),
    })),
    ...documents.map((document) => ({
      time: formatDateTime(document.uploadedAtUtc),
      action: "Document Uploaded",
      referenceNumber: document.originalFileName,
      status: "Uploaded",
      sortKey: toTimestamp(document.uploadedAtUtc),
    })),
  ];

  return rows.sort((left, right) => right.sortKey - left.sortKey).slice(0, 8);
}

function KpiCard({ title, value, description, icon: Icon, tone = "slate" }: KpiCardProps) {
  const toneClasses = ICON_TONE_CLASSES[tone] ?? ICON_TONE_CLASSES.slate;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border p-3 ${toneClasses.container}`}>
          <Icon className={`h-5 w-5 ${toneClasses.icon}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, icon: Icon, tone = "slate" }: { title: string; subtitle?: string; children: ReactNode; icon?: ElementType; tone?: "slate" | "blue" | "emerald" | "amber" | "red" | "violet" | "teal" | "indigo" }) {
  const toneClasses = ICON_TONE_CLASSES[tone] ?? ICON_TONE_CLASSES.slate;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-start gap-3">
        {Icon ? (
          <div className={`rounded-lg border p-2 ${toneClasses.container}`}>
            <Icon className={`h-4 w-4 ${toneClasses.icon}`} />
          </div>
        ) : null}
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function StaffDashboard({ loading, errorMessage, properties, payments, documents }: StaffDashboardProps) {
  const { user, can } = useAuth();
  const navigate = useNavigate();

  const canCreateProperty = can("property.create");
  const canCreatePayment = can("payment.create");
  const canUploadDocument = can("filing.upload");

  const todayKey = new Date().toDateString();

  const totalRegisteredProperties = properties.length;
  const pendingRegistrations = properties.filter((property) => (property.status ?? "").trim().toLowerCase() === "pending review").length;
  const paymentsToday = payments.filter((payment) => new Date(payment.paymentDateUtc ?? "").toDateString() === todayKey).length;
  const documentsToday = documents.filter((document) => new Date(document.uploadedAtUtc).toDateString() === todayKey).length;

  const documentCounts = useMemo(() => {
    const counts = new Map<number, number>();
    documents.forEach((document) => {
      counts.set(document.propertyId, (counts.get(document.propertyId) ?? 0) + 1);
    });
    return counts;
  }, [documents]);

  const incompleteTasks = useMemo(() => buildPendingTasks(properties, documents), [properties, documents]);
  const monthlyRegistrations = useMemo(() => buildMonthlyRegistrations(properties), [properties]);
  const paymentStatusData = useMemo(() => buildPaymentStatusData(payments), [payments]);
  const recentActivity = useMemo(() => buildActivityRows(properties, payments, documents), [properties, payments, documents]);
  const recentPayments = useMemo(() =>
    [...payments]
      .sort((left, right) => (right.paymentDateUtc ?? "").localeCompare(left.paymentDateUtc ?? ""))
      .slice(0, 5),
    [payments],
  );

  const incompletePropertyRecords = properties.filter((property) => {
    const missingDocuments = (documentCounts.get(property.id) ?? 0) === 0;
    const missingCoreFields = !property.ownerAddress?.trim() || !property.taxDeclarationNumber?.trim() || !property.zoningClassification?.trim();
    const needsReview = (property.status ?? "").trim().toLowerCase() !== "registered";
    return missingDocuments || missingCoreFields || needsReview;
  }).length;

  const propertiesMissingDocuments = properties.filter((property) => (documentCounts.get(property.id) ?? 0) === 0).length;
  const incompletePayments = payments.filter((payment) => normalizePaymentStatus(payment.status) !== "Paid").length;

  const alerts = [
    { title: `${propertiesMissingDocuments} properties missing documents`, desc: "Upload supporting files to complete the registry records.", path: "/app/filing" },
    { title: `${pendingRegistrations} registrations awaiting verification`, desc: "Review newly submitted property registrations.", path: "/app/property-registration" },
    { title: `${incompletePayments} incomplete payment entr${incompletePayments === 1 ? "y" : "ies"}`, desc: "Check payment records with pending or unsettled status.", path: "/app/payment-management" },
  ].filter((_, index) => [propertiesMissingDocuments, pendingRegistrations, incompletePayments][index] > 0);

  const quickActions = [
    { label: "Register New Property", icon: Home, path: "/app/property-registration", visible: canCreateProperty, tone: "blue" },
    { label: "Open Tax Calculation", icon: ClipboardList, path: "/app/tax-calculation", visible: can("tax.view"), tone: "indigo" },
    { label: "Record Payment", icon: CreditCard, path: "/app/payment-management", visible: canCreatePayment, tone: "emerald" },
    { label: "Upload Documents", icon: FileUp, path: "/app/filing", visible: canUploadDocument, tone: "violet" },
  ].filter((item) => item.visible);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Encoder Staff Dashboard</p>
          <h1 className="mt-1 text-slate-900 tracking-tight">Property Tax Encoder Workspace</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, <span className="font-medium text-slate-700">{user?.name}</span>. Focus on property intake, tax calculation, payment encoding, and document uploads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/app/property-registration")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4" /> Open Registry
          </button>
          <button
            onClick={() => navigate("/app/filing")}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
          >
            <FileUp className="h-4 w-4" /> Upload Document
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
          Loading live staff dashboard data...
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Total Registered Properties" value={totalRegisteredProperties.toLocaleString()} description="Live registry records" icon={Home} tone="blue" />
        <KpiCard title="Pending Property Registrations" value={pendingRegistrations.toLocaleString()} description="Awaiting verification" icon={ClipboardList} tone="amber" />
        <KpiCard title="Payments Encoded Today" value={paymentsToday.toLocaleString()} description="Posted in the system today" icon={CreditCard} tone="emerald" />
        <KpiCard title="Documents Uploaded" value={documentsToday.toLocaleString()} description="Files uploaded today" icon={FileUp} tone="indigo" />
        <KpiCard title="Incomplete Property Records" value={incompletePropertyRecords.toLocaleString()} description="Needs follow-up before filing" icon={AlertTriangle} tone="red" />
      </div>

      <SectionCard title="Quick Actions" subtitle="Task-focused tools for encoder staff" icon={BarChart3} tone="blue">
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon as ElementType & { displayName?: string };
            const toneClasses = ICON_TONE_CLASSES[action.tone ?? "slate"] ?? ICON_TONE_CLASSES.slate;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className={`rounded-xl border p-3 ${toneClasses.container} transition group-hover:opacity-95`}>
                  {React.createElement(Icon as any, { className: `h-5 w-5 ${toneClasses.icon}` })}
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard title="Pending Encoding Tasks" subtitle="Complete these items before submission" icon={ClipboardList} tone="amber">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Property ID</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Owner Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Missing Requirement</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date Submitted</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Priority</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {incompleteTasks.length > 0 ? (
                    incompleteTasks.slice(0, 6).map((task) => (
                      <tr key={`${task.propertyId}-${task.missingRequirement}`} className="hover:bg-slate-50/80">
                        <td className="px-5 py-4 text-sm font-medium text-blue-700">{task.propertyId}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{task.ownerName}</td>
                        <td className="px-5 py-4 text-sm font-medium text-red-700">{task.missingRequirement}</td>
                        <td className="px-5 py-4 text-sm text-slate-500">{task.dateSubmitted}</td>
                        <td className={`px-5 py-4 text-sm font-semibold ${task.priority === "High" ? "text-red-700" : task.priority === "Medium" ? "text-amber-700" : "text-emerald-700"}`}>{task.priority}</td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => navigate(task.actionPath)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            {task.actionLabel}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                        No pending encoding tasks right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Alerts & Notifications" subtitle="Items needing your attention" icon={Bell} tone="red">
          <div className="space-y-3 p-5">
            {alerts.length > 0 ? alerts.map((alert) => (
              <button
                key={alert.title}
                onClick={() => navigate(alert.path)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-red-700">{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{alert.desc}</p>
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No current alerts.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="My Recent Activity" subtitle="Latest actions recorded in the system" icon={Clock3} tone="slate">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reference Number</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentActivity.length > 0 ? recentActivity.map((row) => (
                  <tr key={`${row.action}-${row.referenceNumber}-${row.time}`} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm text-slate-500">{row.time}</td>
                    <td className="px-5 py-4 text-sm font-medium text-blue-700">{row.action}</td>
                    <td className="px-5 py-4 text-sm font-medium text-blue-700">{row.referenceNumber}</td>
                    <td className={`px-5 py-4 text-sm font-medium ${row.status.toLowerCase().includes("paid") || row.status.toLowerCase().includes("uploaded") || row.status.toLowerCase().includes("registered") ? "text-emerald-700" : row.status.toLowerCase().includes("pending") ? "text-amber-700" : "text-slate-700"}`}>{row.status}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">No recent activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Recent Payments" subtitle="Latest five encoded payments" icon={CreditCard} tone="emerald">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">OR Number</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Owner</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentPayments.length > 0 ? recentPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 text-sm font-medium text-blue-700">{payment.officialReceiptNumber ?? `PAY-${payment.id}`}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{payment.ownerName ?? "Unknown taxpayer"}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{formatCurrency(Number(payment.amountPaid))}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{formatDate(payment.paymentDateUtc)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">No payments have been encoded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Monthly Property Registrations" subtitle="Registrations by month for the last six months" icon={BarChartIcon} tone="indigo">
          <div className="h-[280px] p-5">
            {monthlyRegistrations.some((entry) => entry.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRegistrations} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} />
                  <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                No property registration data available yet.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Payment Status Overview" subtitle="Encoded payments by status" icon={PieChartIcon} tone="violet">
          <div className="h-[280px] p-5">
            {paymentStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={92}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={index === 0 ? "#0f172a" : index === 1 ? "#64748b" : "#cbd5e1"}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} />
                  <Legend verticalAlign="bottom" height={24} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                No payment status data available yet.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}