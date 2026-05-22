import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Brain,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AuditLogDto } from '../services/auditService'
import type { ComplianceStatusItem } from '../services/complianceService'
import type { CollectionsReportResponse, DelinquencyReportResponse, PropertiesReportResponse } from '../services/reportService'
import type { PaymentDto } from '../services/paymentService'
import { getMlModels, getMlPredictions, type MlModelSummary, type MlPredictionItem } from '../services/mlService'
import { normalizePaymentStatus } from '../constants/statuses'

interface AdminDashboardProps {
  loading: boolean
  errorMessage: string | null
  collectionsReport: CollectionsReportResponse | null
  delinquencyReport: DelinquencyReportResponse | null
  propertiesReport: PropertiesReportResponse | null
  paymentHistory: PaymentDto[]
  auditLogs: AuditLogDto[]
  complianceItems: ComplianceStatusItem[]
}

type CardProps = {
  title: string
  value: string
  subtitle: string
  icon: ElementType
  tone?: 'blue' | 'emerald' | 'amber' | 'slate'
}

type ChartCardProps = {
  title: string
  subtitle: string
  children: ReactNode
}

type AdminAlert = {
  id: number
  title: string
  desc: string
  severity: 'High' | 'Medium' | 'Low'
  createdAt: string
}

const CHART_COLORS = ['#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#ef4444']

function currency(value: number) {
  return `₱ ${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
}

function percent(value: number) {
  return `${value.toFixed(2)}%`
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'N/A'
    : date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })
}

function formatMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short' })
}

function Card({ title, value, subtitle, icon: Icon, tone = 'blue' }: CardProps) {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border p-3 ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function buildComplianceChart(items: ComplianceStatusItem[]) {
  const byBarangay = new Map<string, { compliant: number; late: number; unpaid: number }>()

  items.forEach((item) => {
    const current = byBarangay.get(item.barangay) ?? { compliant: 0, late: 0, unpaid: 0 }
    const status = normalizePaymentStatus(item.status)

    if (status === 'Paid') current.compliant += 1
    else if (status === 'Late') current.late += 1
    else current.unpaid += 1

    byBarangay.set(item.barangay, current)
  })

  return [...byBarangay.entries()].slice(0, 5).map(([name, value]) => ({
    name,
    compliance: value.compliant,
    late: value.late,
    unpaid: value.unpaid,
  }))
}

function buildPaymentStatus(paymentHistory: PaymentDto[]) {
  const counts = { Paid: 0, Late: 0, Pending: 0 }

  paymentHistory.forEach((payment) => {
    const normalized = normalizePaymentStatus(payment.status)
    if (normalized === 'Paid') counts.Paid += 1
    else if (normalized === 'Late') counts.Late += 1
    else counts.Pending += 1
  })

  return [
    { name: 'Paid', value: counts.Paid },
    { name: 'Late', value: counts.Late },
    { name: 'Pending', value: counts.Pending },
  ].filter((entry) => entry.value > 0)
}

function buildActivityRows(auditLogs: AuditLogDto[]) {
  return [...auditLogs]
    .slice()
    .sort((left, right) => (right.createdAtUtc ?? '').localeCompare(left.createdAtUtc ?? ''))
    .slice(0, 5)
}

function hasMeaningfulModelMetrics(model: MlModelSummary) {
  return model.accuracy > 0 || model.precision > 0 || model.recall > 0 || model.f1Score > 0 || model.rocAuc > 0
}

function getModelRank(model: MlModelSummary) {
  return [model.f1Score, model.rocAuc, model.accuracy, model.precision, model.recall]
}

function compareModels(left: MlModelSummary, right: MlModelSummary) {
  const leftRank = getModelRank(left)
  const rightRank = getModelRank(right)

  for (let index = 0; index < leftRank.length; index += 1) {
    if (leftRank[index] !== rightRank[index]) {
      return rightRank[index] - leftRank[index]
    }
  }

  return (new Date(right.lastTrainedAt).getTime() || 0) - (new Date(left.lastTrainedAt).getTime() || 0)
}

export default function AdminDashboard({
  loading: _loading,
  errorMessage,
  collectionsReport,
  delinquencyReport,
  propertiesReport,
  paymentHistory,
  auditLogs,
  complianceItems,
}: AdminDashboardProps) {
  const navigate = useNavigate()
  const [models, setModels] = useState<MlModelSummary[]>([])
  const [predictions, setPredictions] = useState<MlPredictionItem[]>([])
  const [mlLoading, setMlLoading] = useState(true)

  useEffect(() => {
    let active = true

    Promise.all([getMlModels(), getMlPredictions()])
      .then(([nextModels, nextPredictions]) => {
        if (!active) return
        setModels(nextModels)
        setPredictions(nextPredictions)
      })
      .catch(() => {
        if (!active) return
        setModels([])
        setPredictions([])
      })
      .finally(() => {
        if (active) setMlLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const alerts = useMemo<AdminAlert[]>(() => {
    return predictions
      .filter((prediction) => prediction.riskLevel === 'High')
      .slice(0, 4)
      .map((prediction) => ({
        id: prediction.id,
        title: 'High-risk property detected',
        desc: `${prediction.propertyId} owned by ${prediction.owner} was flagged by the live ML model.`,
        severity: 'High',
        createdAt: prediction.lastPaymentDate || new Date().toISOString(),
      }))
  }, [predictions])

  const collectionSeries = useMemo(() => {
    const labels = collectionsReport?.labels ?? []
    const values = collectionsReport?.datasets[0]?.data ?? []

    return labels.map((label, index) => ({
      month: formatMonth(label),
      amount: Number(values[index] ?? 0),
    }))
  }, [collectionsReport])

  const paymentStatus = useMemo(() => buildPaymentStatus(paymentHistory), [paymentHistory])
  const complianceChart = useMemo(() => buildComplianceChart(complianceItems), [complianceItems])
  const activityRows = useMemo(() => buildActivityRows(auditLogs), [auditLogs])
  const highRiskPredictions = useMemo(() => predictions.filter((item) => item.riskLevel === 'High'), [predictions])
  const highRiskCount = highRiskPredictions.length
  const visibleModels = useMemo(() => {
    const uniqueModels = new Map<string, MlModelSummary>()

    models.forEach((model) => {
      if (!hasMeaningfulModelMetrics(model)) {
        return
      }

      const key = model.name.trim().toLowerCase()
      const current = uniqueModels.get(key)

      if (!current || compareModels(model, current) < 0) {
        uniqueModels.set(key, model)
      }
    })

    return [...uniqueModels.values()].sort(compareModels)
  }, [models])

  const totalProperties = propertiesReport?.summary.totalProperties ?? 0
  const totalTaxCollected = collectionsReport?.summary.totalCollected ?? 0
  const pendingPayments = delinquencyReport?.summary.unpaidCount ?? 0
  const complianceRate = complianceItems.length > 0
    ? Number(((complianceItems.filter((item) => normalizePaymentStatus(item.status) === 'Paid').length / complianceItems.length) * 100).toFixed(1))
    : 0

  const bestModel = visibleModels[0]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">Unable to load part of the dashboard</p>
            <p className="text-xs text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin Command Center
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Property Taxation & Compliance Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Monitor property records, collections, compliance, and machine learning risk scoring from one enterprise-grade view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/app/ml')}
            className="inline-flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            <div className="rounded-lg p-2 bg-blue-50 text-blue-700">
              <Brain className="h-4 w-4" />
            </div>
            Open ML Module <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/app/users')}
            className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <div className="rounded-lg p-2 bg-blue-50 text-blue-700">
              <Users className="h-4 w-4" />
            </div>
            Users & Roles
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card title="Total Properties" value={totalProperties.toLocaleString('en-PH')} subtitle="Registered and active properties" icon={Building2} tone="blue" />
        <Card title="Total Tax Collected" value={currency(totalTaxCollected)} subtitle="Year-to-date collections" icon={Wallet} tone="emerald" />
        <Card title="Pending Payments" value={pendingPayments.toLocaleString('en-PH')} subtitle="Open receivables and late filings" icon={CreditCard} tone="amber" />
        <Card title="Compliance Rate" value={percent(complianceRate)} subtitle="Current compliance coverage" icon={CheckCircle2} tone="slate" />
        <Card title="High-Risk Properties" value={highRiskCount.toLocaleString('en-PH')} subtitle="ML-flagged properties" icon={Brain} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Monthly Tax Collection Trend" subtitle="Tax collection pace for the current year">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={collectionSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="#1e3a8a" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Payment Status Distribution" subtitle="Settlement mix across active records">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentStatus} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={4}>
                  {paymentStatus.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Compliance Rate Overview" subtitle="Top barangay-level compliance mix">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complianceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="compliance" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
                <Bar dataKey="late" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                <Bar dataKey="unpaid" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Machine Learning Snapshot</h2>
              <p className="text-sm text-slate-500">Current model performance and top risk indicators.</p>
            </div>
            <button onClick={() => navigate('/app/ml')} className="text-sm font-medium text-blue-700 hover:text-blue-800">
              Go to ML module
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3">Precision</th>
                  <th className="px-4 py-3">Recall</th>
                  <th className="px-4 py-3">F1</th>
                  <th className="px-4 py-3">ROC AUC</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleModels.map((model) => (
                  <tr key={model.id} className={bestModel?.id === model.id ? 'bg-blue-50/60' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-blue-700">{model.name}</div>
                      <div className="text-xs text-slate-500">{model.version} · Trained {formatDate(model.lastTrainedAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-blue-700">{percent(model.accuracy * 100)}</td>
                    <td className="px-4 py-3 text-blue-700">{percent(model.precision * 100)}</td>
                    <td className="px-4 py-3 text-emerald-700">{percent(model.recall * 100)}</td>
                    <td className="px-4 py-3 text-emerald-700">{percent(model.f1Score * 100)}</td>
                    <td className="px-4 py-3 text-amber-700">{percent(model.rocAuc * 100)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${model.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {model.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleModels.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                      No trained models with metrics are available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Alerts</h2>
              <p className="text-sm text-slate-500">Auto-generated risk and audit notifications.</p>
            </div>
            <Bell className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${alert.severity === 'High' ? 'bg-red-500' : alert.severity === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-red-700">{alert.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{alert.desc}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">{alert.severity} · {formatDate(alert.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">High-Risk Property Preview</h2>
              <p className="text-sm text-slate-500">Latest ML-flagged properties ready for audit review.</p>
            </div>
            <Database className="h-5 w-5 text-slate-400" />
          </div>
          {mlLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((value) => <div key={value} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Prediction</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {highRiskPredictions.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium text-blue-700">{item.propertyId}</td>
                      <td className="px-4 py-3 text-slate-700">{item.owner}</td>
                      <td className="px-4 py-3 text-slate-700">{item.prediction}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.riskLevel === 'High' ? 'bg-red-50 text-red-700' : item.riskLevel === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {item.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-red-700">{item.probabilityScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Activity Feed</h2>
              <p className="text-sm text-slate-500">Recent compliance and audit actions.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {activityRows.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-blue-700">{log.action}</p>
                    <p className="mt-1 text-xs text-slate-500">{log.entityName ?? 'System'} · {log.performedByUsername ?? 'System user'}</p>
                  </div>
                  <span className="text-[11px] text-slate-400">{formatDate(log.createdAtUtc)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="High-Risk Properties" value={highRiskCount.toLocaleString('en-PH')} subtitle="From ML predictions" icon={Brain} tone="amber" />
        <Card title="Properties Assessed" value={(propertiesReport?.summary.totalProperties ?? 0).toLocaleString('en-PH')} subtitle="All assessed properties" icon={Building2} tone="slate" />
        <Card title="Compliance Coverage" value={percent(complianceRate)} subtitle="Board-level compliance snapshot" icon={TrendingUp} tone="emerald" />
      </div>
    </div>
  )
}
