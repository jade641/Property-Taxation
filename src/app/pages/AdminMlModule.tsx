import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Database,
  Download,
  FileUp,
  RefreshCcw,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { exportCsv } from '../services/exportService'
import {
  deleteTrainingHistoryEntry,
  dismissMlAlert,
  getMlExplanation,
  getMlAlerts,
  getMlModels,
  getMlPredictions,
  getMlTrainingStatus,
  getTrainingHistory,
  promoteModel,
  resolveMlAlert,
  trainModel,
  uploadDataset,
  listDatasets,
  deleteDataset,
  type MlAlert,
  type MlExplanation,
  type MlModelSummary,
  type MlPredictionItem,
  type MlTrainingStatus,
  type TrainingHistoryItem,
} from '../services/mlService'

const CHART_COLORS = ['#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#ef4444']

function percent(value: number) {
  return `${value.toFixed(2)}%`
}

function normalizeModelKey(value?: string | null) {
  return (value ?? '').trim().toLowerCase()
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })
}

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A'
  // If value already looks like a human-friendly formatted string, return it unchanged
  if (/[A-Za-z]{3,}|,|AM|PM|am|pm/.test(value)) return value

  // If the backend sent an ISO string *without* timezone (e.g. "2026-05-20T14:16:00"),
  // treat it as UTC by appending a 'Z' so the Date constructor converts it to local time.
  const isoNoOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/
  const toParse = isoNoOffset.test(value) ? `${value}Z` : value

  const date = new Date(toParse)
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString('en-PH', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function modelStatusClass(status: MlModelSummary['status']) {
  return status === 'Active'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-slate-100 text-slate-600 border-slate-200'
}

function AlertStatusClass(status: MlAlert['status']) {
  if (status === 'Resolved') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'Dismissed') return 'bg-slate-100 text-slate-600 border-slate-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

const DEFAULT_MODEL_OPTIONS: MlModelSummary[] = [
  {
    id: 1,
    name: 'Logistic Regression',
    version: 'v1.0',
    displayLabel: 'Logistic Regression · v1.0',
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    rocAuc: 0,
    status: 'Active',
    isBestModel: true,
    lastTrainedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Random Forest',
    version: 'v1.0',
    displayLabel: 'Random Forest · v1.0',
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    rocAuc: 0,
    status: 'Active',
    lastTrainedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Extra Trees',
    version: 'v1.0',
    displayLabel: 'Extra Trees · v1.0',
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    rocAuc: 0,
    status: 'Active',
    lastTrainedAt: new Date().toISOString(),
  },
]

type ModalProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
}

function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

type Toast = { id: number; title: string; message: string; tone: 'blue' | 'emerald' | 'amber' | 'red' }

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed right-4 top-4 z-[60] space-y-3">
      {toasts.map((toast) => (
        <div key={toast.id} className="w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${toast.tone === 'emerald' ? 'bg-emerald-500' : toast.tone === 'amber' ? 'bg-amber-500' : toast.tone === 'red' ? 'bg-red-500' : 'bg-blue-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{toast.title}</p>
              <p className="mt-1 text-sm text-slate-500">{toast.message}</p>
            </div>
            <button onClick={() => onDismiss(toast.id)} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function MetricCard({ title, value, subtitle, icon: Icon }: { title: string; value: string; subtitle: string; icon: ElementType }) {
  return (
    <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 max-w-full break-words text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl">{value}</p>
          <p className="mt-1 break-all text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function SectionCard({ title, subtitle, children, action, notice, className }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode; notice?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm${className ? ` ${className}` : ''}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {notice ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div> : null}
      {children}
    </section>
  )
}

function buildRiskDistribution(predictions: MlPredictionItem[]) {
  const counts = { Low: 0, Medium: 0, High: 0 }
  predictions.forEach((prediction) => {
    counts[prediction.riskLevel] += 1
  })

  return [
    { name: 'Low', value: counts.Low },
    { name: 'Medium', value: counts.Medium },
    { name: 'High', value: counts.High },
  ].filter((entry) => entry.value > 0)
}

function buildHistogram(predictions: MlPredictionItem[]) {
  const buckets = [
    { name: '0-20%', value: 0 },
    { name: '21-40%', value: 0 },
    { name: '41-60%', value: 0 },
    { name: '61-80%', value: 0 },
    { name: '81-100%', value: 0 },
  ]

  predictions.forEach((prediction) => {
    const score = prediction.probabilityScore
    if (score <= 20) buckets[0].value += 1
    else if (score <= 40) buckets[1].value += 1
    else if (score <= 60) buckets[2].value += 1
    else if (score <= 80) buckets[3].value += 1
    else buckets[4].value += 1
  })

  return buckets.filter((bucket) => bucket.value > 0)
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

async function buildChartFallbackFromCsv(file: File) {
  const fallbackRisk = [
    { name: 'Low', value: 0 },
    { name: 'Medium', value: 0 },
    { name: 'High', value: 0 },
  ]
  const histogram = [
    { name: '0-20%', value: 0 },
    { name: '21-40%', value: 0 },
    { name: '41-60%', value: 0 },
    { name: '61-80%', value: 0 },
    { name: '81-100%', value: 0 },
  ]

  const text = await file.text()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
  if (lines.length < 2) {
    return {
      riskDistribution: [{ name: 'Medium', value: 1 }],
      probabilityHistogram: [{ name: '41-60%', value: 1 }],
      featureImportance: [{ name: 'Uploaded rows', importance: 100 }],
    }
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
  const rows = lines.slice(1).map(parseCsvLine)

  const getIndex = (names: string[]) => headers.findIndex((header) => names.includes(header))
  const riskIndex = getIndex(['risklevel', 'risk_level', 'risk'])
  const probIndex = getIndex(['probability', 'probabilityscore', 'probability_score', 'late_probability', 'predicted_probability'])
  const labelIndex = getIndex(['prediction', 'predicted_label', 'is_late_payment', 'late_payment', 'label'])

  const parseProbability = (raw: string) => {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return null
    const score = parsed <= 1 ? parsed * 100 : parsed
    return Math.max(0, Math.min(100, score))
  }

  const riskKeyFromLabel = (raw: string) => {
    const normalized = raw.trim().toLowerCase()
    if (['high', 'late', '1', 'true'].includes(normalized)) return 'High'
    if (['medium', 'mid'].includes(normalized)) return 'Medium'
    if (['low', 'on-time', 'ontime', '0', 'false'].includes(normalized)) return 'Low'
    return null
  }

  const probabilities: number[] = []
  let low = 0
  let medium = 0
  let high = 0

  rows.forEach((row) => {
    let assigned = false

    if (riskIndex >= 0) {
      const risk = riskKeyFromLabel(row[riskIndex] ?? '')
      if (risk === 'High') high += 1
      else if (risk === 'Medium') medium += 1
      else if (risk === 'Low') low += 1
      assigned = Boolean(risk)
    }

    const probability = probIndex >= 0 ? parseProbability(row[probIndex] ?? '') : null
    if (probability !== null) {
      probabilities.push(probability)
      if (!assigned) {
        if (probability >= 80) high += 1
        else if (probability >= 50) medium += 1
        else low += 1
        assigned = true
      }
    }

    if (!assigned && labelIndex >= 0) {
      const labelRisk = riskKeyFromLabel(row[labelIndex] ?? '')
      if (labelRisk === 'High') high += 1
      else if (labelRisk === 'Medium') medium += 1
      else if (labelRisk === 'Low') low += 1
      assigned = Boolean(labelRisk)
    }

    if (!assigned) {
      medium += 1
    }
  })

  fallbackRisk[0].value = low
  fallbackRisk[1].value = medium
  fallbackRisk[2].value = high

  probabilities.forEach((score) => {
    if (score <= 20) histogram[0].value += 1
    else if (score <= 40) histogram[1].value += 1
    else if (score <= 60) histogram[2].value += 1
    else if (score <= 80) histogram[3].value += 1
    else histogram[4].value += 1
  })

  if (probabilities.length === 0) {
    histogram[2].value = rows.length
  }

  const nonEmptyCount = rows.reduce((count, row) => count + row.filter((cell) => String(cell ?? '').trim() !== '').length, 0)
  const totalCells = Math.max(1, rows.length * Math.max(headers.length, 1))
  const completeness = Math.round((nonEmptyCount / totalCells) * 100)
  const featureImportance = [
    { name: 'Rows parsed', importance: Math.min(100, Math.max(1, rows.length)) },
    { name: 'Columns detected', importance: Math.min(100, Math.max(1, headers.length * 5)) },
    { name: 'Data completeness', importance: Math.min(100, Math.max(1, completeness)) },
  ]

  return {
    riskDistribution: fallbackRisk.filter((entry) => entry.value > 0),
    probabilityHistogram: histogram.filter((entry) => entry.value > 0),
    featureImportance,
  }
}

type MlChartResponse<T> = { data: T | null; unavailable: boolean }
type UploadedDataset = { fileName: string; storedAs: string; size: number; createdAt: string }

const SHOULD_LOG_CHART_WARNINGS = import.meta.env.DEV

function resolveSelectedDatasetName(requestedDatasetName: string, availableDatasets: UploadedDataset[]) {
  const trimmed = requestedDatasetName.trim()
  if (availableDatasets.length === 0) {
    return trimmed
  }

  if (!trimmed) {
    return availableDatasets[0].storedAs
  }

  const normalized = trimmed.toLowerCase()
  const exactMatch = availableDatasets.find((dataset) => dataset.storedAs.toLowerCase() === normalized || dataset.fileName.toLowerCase() === normalized)
  return exactMatch?.storedAs ?? availableDatasets[0].storedAs
}

function buildChartQuery(datasetName: string, modelName: string) {
  const params = new URLSearchParams()

  if (datasetName) {
    params.set('dataset', datasetName)
  }

  if (modelName) {
    params.set('model_name', modelName)
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

async function fetchMlChart<T>(path: string): Promise<MlChartResponse<T>> {
  try {
    const response = await api.get(path)

    // Validate response has expected structure
    if (!response.data) {
      if (SHOULD_LOG_CHART_WARNINGS) {
        console.warn(`[ML Chart] Empty response from ${path}`)
      }
      return { data: null, unavailable: true }
    }

    const result = (response.data?.data ?? response.data) as T

    // Ensure result is not empty or null
    if (!result) {
      if (SHOULD_LOG_CHART_WARNINGS) {
        console.warn(`[ML Chart] Null/empty data from ${path}`)
      }
      return { data: null, unavailable: true }
    }

    return {
      data: result,
      unavailable: false,
    }
  } catch (error) {
    if (SHOULD_LOG_CHART_WARNINGS) {
      if (axios.isAxiosError(error) && (error.response?.status === 503 || error.code === 'ECONNABORTED')) {
        console.warn(`[ML Chart] Service unavailable for ${path}`)
      } else if (axios.isAxiosError(error)) {
        console.warn(`[ML Chart] Request failed for ${path}: ${error.status}`)
      } else {
        console.warn(`[ML Chart] Unexpected error for ${path}:`, error instanceof Error ? error.message : 'Unknown error')
      }
    }

    return { data: null, unavailable: true }
  }
}

function buildAlertsFromPredictions(predictions: MlPredictionItem[]): MlAlert[] {
  return predictions
    .filter((prediction) => prediction.riskLevel === 'High')
    .slice(0, 6)
    .map((prediction) => ({
      id: prediction.id,
      title: 'High-risk property detected',
      description: `${prediction.propertyId} owned by ${prediction.owner} was flagged by the live ML model.`,
      category: 'High-risk',
      status: 'Open',
      createdAt: new Date().toISOString(),
      propertyId: prediction.propertyId,
      severity: 'High',
      source: 'derived',
    }))
}

function buildDatasetSummaryAlert(highRiskCount: number, datasetLabel: string, modelName: string): MlAlert[] {
  if (highRiskCount <= 0) {
    return []
  }

  return [{
    id: -1,
    title: 'High-risk records detected',
    description: `${highRiskCount.toLocaleString('en-PH')} records from ${datasetLabel} were classified as high risk by ${modelName || 'the selected model'}.`,
    category: 'High-risk',
    status: 'Open',
    createdAt: new Date().toISOString(),
    propertyId: datasetLabel,
    severity: 'High',
    source: 'derived',
  }]
}

function buildAlertFeed(storedAlerts: MlAlert[], predictions: MlPredictionItem[], highRiskCount: number, datasetLabel: string, modelName: string): MlAlert[] {
  if (storedAlerts.length > 0) {
    return storedAlerts
  }

  const predictionAlerts = buildAlertsFromPredictions(predictions)
  if (predictionAlerts.length > 0) {
    return predictionAlerts
  }

  return buildDatasetSummaryAlert(highRiskCount, datasetLabel, modelName)
}

function buildAccountantExportRows(predictions: MlPredictionItem[]) {
  const total = predictions.length
  const lateCount = predictions.filter((prediction) => prediction.prediction === 'Late').length
  const onTimeCount = total - lateCount
  const highRiskCount = predictions.filter((prediction) => prediction.riskLevel === 'High').length
  const mediumRiskCount = predictions.filter((prediction) => prediction.riskLevel === 'Medium').length
  const lowRiskCount = predictions.filter((prediction) => prediction.riskLevel === 'Low').length
  const averageProbability = total > 0
    ? predictions.reduce((sum, prediction) => sum + prediction.probabilityScore, 0) / total
    : 0

  return [
    ['Total Predictions', total],
    ['Late Predictions', lateCount],
    ['On-time Predictions', onTimeCount],
    ['High-Risk Predictions', highRiskCount],
    ['Medium-Risk Predictions', mediumRiskCount],
    ['Low-Risk Predictions', lowRiskCount],
    ['Average Probability Score', averageProbability.toFixed(1)],
  ]
}

function buildDetailedExportRows(
  predictions: MlPredictionItem[],
  explanations: Record<number, MlExplanation | null>,
  includeRawJson: boolean,
) {
  return predictions.map((prediction) => {
    const explanation = explanations[prediction.id]

    return [
      prediction.propertyId,
      prediction.owner,
      prediction.prediction,
      prediction.riskLevel,
      prediction.probabilityScore,
      prediction.lastPaymentDate,
      prediction.modelName,
      explanation?.summary ?? 'No explanation available',
      explanation?.confidenceScore ?? 0,
      includeRawJson ? JSON.stringify(explanation?.rawJson ?? {}, null, 0) : 'Restricted',
    ]
  })
}

export default function AdminMlModule() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const isAuditor = user?.role === 'Auditor'
  const isAccountant = user?.role === 'Accountant'

  const [models, setModels] = useState<MlModelSummary[]>([])
  const [predictions, setPredictions] = useState<MlPredictionItem[]>([])
  const [alerts, setAlerts] = useState<MlAlert[]>([])
  const [history, setHistory] = useState<TrainingHistoryItem[]>([])
  const [datasets, setDatasets] = useState<Array<{ fileName: string; storedAs: string; size: number; createdAt: string }>>([])
  const [uploadedRiskDistribution, setUploadedRiskDistribution] = useState<Array<{ name: string; value: number }>>([])
  const [uploadedProbabilityHistogram, setUploadedProbabilityHistogram] = useState<Array<{ name: string; value: number }>>([])
  const [uploadedFeatureImportance, setUploadedFeatureImportance] = useState<Array<{ name: string; importance: number }>>([])
  const [artifactRiskDistribution, setArtifactRiskDistribution] = useState<Array<{ name: string; value: number }>>([])
  const [artifactHistogram, setArtifactHistogram] = useState<Array<{ name: string; value: number }>>([])
  const [artifactFeatureImportance, setArtifactFeatureImportance] = useState<Array<{ name: string; importance: number }>>([])
  const [riskChartUnavailable, setRiskChartUnavailable] = useState(false)
  const [histogramChartUnavailable, setHistogramChartUnavailable] = useState(false)
  const [featureChartUnavailable, setFeatureChartUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectedPrediction] = useState<MlPredictionItem | null>(null)
  const [selectedExplanation, setSelectedExplanation] = useState<MlExplanation | null>(null)
  const [showPredictionModal, setShowPredictionModal] = useState(false)
  const [showExplanationModal, setShowExplanationModal] = useState(false)
  const [showRetrainModal, setShowRetrainModal] = useState(false)
  const [rawJsonVisible, setRawJsonVisible] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [trainingStatus, setTrainingStatus] = useState<MlTrainingStatus>({ status: 'idle', progress: 0, currentModel: 'N/A' })
  const [retrainRequestPending, setRetrainRequestPending] = useState(false)
  const [deletingTrainingHistoryId, setDeletingTrainingHistoryId] = useState<number | null>(null)
  const [trainingHistoryPage, setTrainingHistoryPage] = useState(1)
  const [toasts, setToasts] = useState<Toast[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastIdRef = useRef(0)
  const trainingCompletionHandledRef = useRef(false)

  const pushToast = (title: string, message: string, tone: Toast['tone'] = 'blue') => {
    toastIdRef.current += 1
    const id = toastIdRef.current
    setToasts((current) => [...current, { id, title, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3800)
  }

  const refreshTrainingStatus = useCallback(async () => {
    try {
      return await getMlTrainingStatus()
    } catch {
      return null
    }
  }, [])

  const loadAlertsSafely = useCallback(async () => {
    try {
      return await getMlAlerts()
    } catch (error) {
      console.warn('[Dashboard] Error loading alerts:', error instanceof Error ? error.message : 'Unknown error')
      return [] as MlAlert[]
    }
  }, [])

  const reloadDashboardInsights = useCallback(async () => {
    try {
      setApiError(null)
      // Best-effort: clear server-side chart cache so retrains show fresh charts
      try {
        await api.post('/ml/chart/cache/clear')
      } catch {
        // ignore — cache clear is best-effort
      }
      // Fetch core dashboard data first so we can derive the selected model from fresh results
      const [nextModels, nextPredictions, nextAlerts, nextHistory, nextDatasets, nextStatus] = await Promise.all([
        getMlModels(),
        getMlPredictions(),
        loadAlertsSafely(),
        getTrainingHistory(),
        listDatasets(),
        getMlTrainingStatus(),
      ])

      const availableDatasets = nextDatasets ?? []
      const resolvedDatasetName = resolveSelectedDatasetName(datasetName, availableDatasets)
      const selectedDatasetLabel = resolvedDatasetName || 'No dataset selected'
      const selectedModelName = (nextModels && nextModels.length > 0)
        ? ((selectedModelId !== null
          ? nextModels.find((model) => model.id === selectedModelId)
          : undefined) ?? nextModels.find((model) => model.isBestModel || model.status === 'Active') ?? nextModels[0]).name ?? ''
        : ''
      const datasetChartQuery = buildChartQuery(resolvedDatasetName, selectedModelName)

      if (resolvedDatasetName !== datasetName) {
        setDatasetName(resolvedDatasetName)
      }

      const [featureResult, riskResult, histogramResult] = await Promise.all([
        fetchMlChart<{ features: Array<{ name: string; importance: number }> }>('/ml/chart/feature-importance' + (selectedModelName ? `?model_name=${encodeURIComponent(selectedModelName)}` : '')),
        fetchMlChart<{ low: number; medium: number; high: number }>(`/ml/chart/risk-distribution${datasetChartQuery}`),
        fetchMlChart<{ bins: string[]; counts: number[] }>(`/ml/chart/probability-histogram${datasetChartQuery}`),
      ])

      const fallbackHighRiskCount = riskResult?.data && typeof riskResult.data.high === 'number'
        ? riskResult.data.high
        : 0

      setModels(nextModels ?? [])
      setPredictions(nextPredictions ?? [])
      setAlerts(buildAlertFeed(nextAlerts ?? [], nextPredictions ?? [], fallbackHighRiskCount, selectedDatasetLabel, selectedModelName))
      setHistory(nextHistory ?? [])
      setDatasets(availableDatasets)
      setTrainingStatus(nextStatus ?? { status: 'idle', progress: 0, currentModel: 'N/A' })

      if (featureResult?.data?.features && Array.isArray(featureResult.data.features)) {
        setArtifactFeatureImportance(featureResult.data.features)
      } else {
        setArtifactFeatureImportance([])
      }
      setFeatureChartUnavailable(featureResult?.unavailable ?? true)

      if (riskResult?.data && typeof riskResult.data.low === 'number' && typeof riskResult.data.medium === 'number' && typeof riskResult.data.high === 'number') {
        setArtifactRiskDistribution([
          { name: 'Low', value: riskResult.data.low },
          { name: 'Medium', value: riskResult.data.medium },
          { name: 'High', value: riskResult.data.high },
        ])
      } else {
        setArtifactRiskDistribution([])
      }
      setRiskChartUnavailable(riskResult?.unavailable ?? true)

      if (histogramResult?.data && Array.isArray(histogramResult.data.bins) && Array.isArray(histogramResult.data.counts)) {
        setArtifactHistogram(histogramResult.data.bins.map((bin, index) => ({ name: bin, value: histogramResult.data?.counts[index] ?? 0 })))
      } else {
        setArtifactHistogram([])
      }
      setHistogramChartUnavailable(histogramResult?.unavailable ?? true)
    } catch (error) {
      console.error('[Dashboard] Error refreshing insights:', error)
      let msg = 'Failed to connect to the Machine Learning API. The server may be sleeping or starting up.'
      if (axios.isAxiosError(error) && error.message) {
        msg = `Connection Error: ${error.message}`
      }
      setApiError(msg)
    } finally {
      setLoading(false)
    }
  }, [datasetName, loadAlertsSafely, selectedModelId])

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        setApiError(null)
        setLoading(true)
        // Fetch models first, then use them to build chart URLs with correct model_name
        const [initialModels, initialDatasets] = await Promise.all([getMlModels(), listDatasets()])
        const initialSelectedModel = (selectedModelId !== null
          ? initialModels.find((model) => model.id === selectedModelId)
          : undefined) ?? initialModels.find((model) => model.isBestModel || model.status === 'Active') ?? initialModels[0]
        const selectedModelNameLocal = initialSelectedModel?.name ?? ''
        const resolvedDatasetNameLocal = resolveSelectedDatasetName(datasetName, initialDatasets)
        const selectedDatasetLabel = resolvedDatasetNameLocal || 'No dataset selected'
        const datasetChartQueryLocal = buildChartQuery(resolvedDatasetNameLocal, selectedModelNameLocal)

        if (active) {
          setModels(initialModels)
          setDatasets(initialDatasets)
          if (resolvedDatasetNameLocal !== datasetName) {
            setDatasetName(resolvedDatasetNameLocal)
          }
        }

        // Fetch predictions and history (models already fetched)
        const [nextPredictions, nextAlerts, nextHistory] = await Promise.all([getMlPredictions(), loadAlertsSafely(), getTrainingHistory()])

        let fallbackHighRiskCount = 0

        if (!active) return
        setPredictions(nextPredictions ?? [])
        setHistory(nextHistory ?? [])

        // Fetch charts using selected model derived from the returned models
        try {
          const [featureResult, riskResult, histogramResult] = await Promise.all([
            fetchMlChart<{ features: Array<{ name: string; importance: number }> }>('/ml/chart/feature-importance' + (selectedModelNameLocal ? `?model_name=${encodeURIComponent(selectedModelNameLocal)}` : '')),
            fetchMlChart<{ low: number; medium: number; high: number }>(`/ml/chart/risk-distribution${datasetChartQueryLocal}`),
            fetchMlChart<{ bins: string[]; counts: number[] }>(`/ml/chart/probability-histogram${datasetChartQueryLocal}`),
          ])

          if (featureResult?.data?.features && Array.isArray(featureResult.data.features)) {
            setArtifactFeatureImportance(featureResult.data.features)
          }
          setFeatureChartUnavailable(featureResult?.unavailable ?? true)

          if (riskResult?.data && typeof riskResult.data.low === 'number' && typeof riskResult.data.medium === 'number' && typeof riskResult.data.high === 'number') {
            fallbackHighRiskCount = riskResult.data.high
            setArtifactRiskDistribution([
              { name: 'Low', value: riskResult.data.low },
              { name: 'Medium', value: riskResult.data.medium },
              { name: 'High', value: riskResult.data.high },
            ])
          } else {
            setArtifactRiskDistribution([])
          }
          setRiskChartUnavailable(riskResult?.unavailable ?? true)

          if (histogramResult?.data && Array.isArray(histogramResult.data.bins) && Array.isArray(histogramResult.data.counts)) {
            setArtifactHistogram(histogramResult.data.bins.map((bin, index) => ({ name: bin, value: histogramResult.data?.counts[index] ?? 0 })))
          } else {
            setArtifactHistogram([])
          }
          setHistogramChartUnavailable(histogramResult?.unavailable ?? true)
        } catch (error) {
          console.warn('[Dashboard] Error loading charts:', error instanceof Error ? error.message : 'Unknown error')
        }

        if (!active) return
        setAlerts(buildAlertFeed(nextAlerts ?? [], nextPredictions ?? [], fallbackHighRiskCount, selectedDatasetLabel, selectedModelNameLocal))
      } catch (error) {
        if (!active) return
        console.error('[Dashboard] Error loading initial ML data:', error)
        let msg = 'Failed to connect to the Machine Learning API. The server may be sleeping or starting up.'
        if (axios.isAxiosError(error) && error.message) {
          msg = `Connection Error: ${error.message}`
        }
        setApiError(msg)
        setModels([])
        setPredictions([])
        setAlerts([])
        setHistory([])
      } finally {
        if (active) setLoading(false)
      }
    })()

    // load uploaded datasets separately
    listDatasets()
      .then((items) => { if (active) setDatasets(items ?? []) })
      .catch((error) => {
        if (active) {
          console.warn('[Dashboard] Error loading datasets:', error instanceof Error ? error.message : 'Unknown error')
          setDatasets([])
        }
      })

    return () => {
      active = false
    }
  }, [datasetName, loadAlertsSafely, selectedModelId])


  useEffect(() => {
    if (trainingStatus.status !== 'queued' && trainingStatus.status !== 'training') {
      return
    }

    let active = true

    const pollTrainingStatus = async () => {
      const status = await refreshTrainingStatus()
      if (!active || !status) return

      if (status.status === 'completed' && !trainingCompletionHandledRef.current) {
        trainingCompletionHandledRef.current = true
        setRetrainRequestPending(false)
        await reloadDashboardInsights()
        setTrainingStatus(status)
        pushToast('Model retraining completed successfully. Dashboard insights updated.', 'ML charts, metrics, and alerts have been refreshed.', 'emerald')
        return
      }

      if (status.status === 'failed' && !trainingCompletionHandledRef.current) {
        trainingCompletionHandledRef.current = true
        setRetrainRequestPending(false)
        setTrainingStatus(status)
        pushToast('Retraining failed', status.message ?? 'Model retraining failed. Previous dashboard data is preserved.', 'red')
      }
    }

    void pollTrainingStatus()
    const intervalId = window.setInterval(() => {
      void pollTrainingStatus()
    }, 4000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [trainingStatus.status, refreshTrainingStatus, reloadDashboardInsights])

  const bestModel = useMemo(() => [...models].sort((left, right) => right.f1Score - left.f1Score)[0], [models])
  const activeModel = models.find((model) => model.status === 'Active') ?? models[0]
  const modelSelectorOptions = (models.length > 0 ? models : DEFAULT_MODEL_OPTIONS)
    .filter((m) => m.accuracy > 0 || m.rocAuc > 0 || m.f1Score > 0 || DEFAULT_MODEL_OPTIONS.some((d) => d.name === m.name))
  const explanationFeatureImportance = useMemo(
    () => (selectedExplanation?.factors ?? []).map((factor) => ({ name: factor.name, importance: factor.impact })),
    [selectedExplanation],
  )
  const resolvedSelectedModelId = selectedModelId ?? (modelSelectorOptions.find((option) => option.isBestModel || option.status === 'Active') ?? modelSelectorOptions[0])?.id ?? null
  const selectedModel = modelSelectorOptions.find((option) => option.id === resolvedSelectedModelId)
  const chartRiskDistribution = artifactRiskDistribution.length > 0
    ? artifactRiskDistribution
    : riskChartUnavailable
      ? (uploadedRiskDistribution.length > 0
        ? uploadedRiskDistribution
        : (predictions.length > 0
          ? buildRiskDistribution(predictions)
          : []))
      : []
  const chartProbabilityHistogram = artifactHistogram.length > 0
    ? artifactHistogram
    : histogramChartUnavailable
      ? (uploadedProbabilityHistogram.length > 0
        ? uploadedProbabilityHistogram
        : (predictions.length > 0
          ? buildHistogram(predictions)
          : []))
      : []
  const chartFeatureImportance = artifactFeatureImportance.length > 0
    ? artifactFeatureImportance
    : featureChartUnavailable
      ? (uploadedFeatureImportance.length > 0
        ? uploadedFeatureImportance
        : explanationFeatureImportance.length > 0
          ? explanationFeatureImportance
          : [])
      : []
  const focusedModel = selectedModel ?? activeModel
  const selectedDatasetLabel = datasetName.trim() || 'No dataset selected'
  const selectedHighRiskCount = chartRiskDistribution.find((bucket) => bucket.name === 'High')?.value ?? 0
  const trainingMetricsMatchFocusedModel = normalizeModelKey(trainingStatus.currentModel) !== ''
    && normalizeModelKey(trainingStatus.currentModel) !== 'n/a'
    && normalizeModelKey(trainingStatus.currentModel) === normalizeModelKey(focusedModel?.name)
  const displayedMetrics = {
    accuracy: trainingMetricsMatchFocusedModel ? (trainingStatus.accuracy ?? focusedModel?.accuracy ?? 0) : (focusedModel?.accuracy ?? 0),
    precision: trainingMetricsMatchFocusedModel ? (trainingStatus.precision ?? focusedModel?.precision ?? 0) : (focusedModel?.precision ?? 0),
    recall: trainingMetricsMatchFocusedModel ? (trainingStatus.recall ?? focusedModel?.recall ?? 0) : (focusedModel?.recall ?? 0),
    f1Score: trainingMetricsMatchFocusedModel ? (trainingStatus.f1Score ?? focusedModel?.f1Score ?? 0) : (focusedModel?.f1Score ?? 0),
    rocAuc: trainingMetricsMatchFocusedModel ? (trainingStatus.rocAuc ?? focusedModel?.rocAuc ?? 0) : (focusedModel?.rocAuc ?? 0),
  }
  const displayedLastTrainedAt = trainingMetricsMatchFocusedModel
    ? (trainingStatus.lastTrainedAt ?? focusedModel?.lastTrainedAt)
    : focusedModel?.lastTrainedAt

  // Training History pagination
  const itemsPerPage = 8
  const totalPages = Math.ceil(history.length / itemsPerPage)
  const validPage = Math.max(1, Math.min(trainingHistoryPage, totalPages || 1))
  const paginatedHistory = history.slice((validPage - 1) * itemsPerPage, validPage * itemsPerPage)

  useEffect(() => {
    if (!selectedPrediction) return

    let active = true
    getMlExplanation(selectedPrediction.id)
      .then((explanation) => {
        if (!active) return
        setSelectedExplanation(explanation)
      })
      .catch(() => {
        if (!active) return
        setSelectedExplanation(null)
      })

    return () => {
      active = false
    }
  }, [selectedPrediction])

  const handleExport = async () => {
    if (!user) return

    try {
      if (isAccountant) {
        exportCsv(
          'ml-predictions-summary.csv',
          ['Metric', 'Value'],
          buildAccountantExportRows(predictions),
        )

        pushToast('Export complete', 'Summary predictions exported for accounting review.', 'emerald')
        return
      }

      const includeRawJson = isAdmin
      const explanationEntries = await Promise.all(
        predictions.map(async (prediction) => {
          try {
            const explanation = await getMlExplanation(prediction.id)
            return [prediction.id, explanation] as const
          } catch {
            return [prediction.id, null] as const
          }
        }),
      )

      const explanationMap = Object.fromEntries(explanationEntries)

      exportCsv(
        includeRawJson ? 'ml-predictions-full.csv' : 'ml-predictions-detailed.csv',
        ['Property ID', 'Owner', 'Prediction', 'Risk Level', 'Probability Score', 'Last Payment Date', 'Model', 'Explanation Summary', 'Confidence Score', 'Raw JSON'],
        buildDetailedExportRows(predictions, explanationMap, includeRawJson),
      )

      pushToast('Export complete', includeRawJson ? 'Full prediction export downloaded.' : 'Detailed prediction export downloaded.', 'emerald')
    } catch (error) {
      pushToast('Export failed', error instanceof Error ? error.message : 'Unable to export predictions.', 'red')
    }
  }

  const handleUpload = async (file?: File | null) => {
    if (!file) return

    const result = await uploadDataset(file)
    pushToast(result.success ? 'Dataset uploaded' : 'Upload failed', result.message, result.success ? 'emerald' : 'red')
    if (result.success) {
      // refresh dataset list and set dataset name to uploaded file
      try {
        const items = await listDatasets()
        setDatasets(items)
        setDatasetName(result.storedAs ?? file.name)
        const chartFallback = await buildChartFallbackFromCsv(file)
        setUploadedRiskDistribution(chartFallback.riskDistribution)
        setUploadedProbabilityHistogram(chartFallback.probabilityHistogram)
        setUploadedFeatureImportance(chartFallback.featureImportance)
      } catch {
        // ignore
      }
    }
  }

  const handleDeleteDataset = async (storedAs: string, displayName: string) => {
    if (!confirm(`Delete dataset ${displayName}? This action cannot be undone.`)) return
    try {
      const ok = await deleteDataset(storedAs)
      if (ok) {
        pushToast('Dataset deleted', `${displayName} removed.`, 'emerald')
        const items = await listDatasets()
        setDatasets(items)
      } else {
        pushToast('Delete failed', `Unable to delete ${displayName}.`, 'red')
      }
    } catch {
      pushToast('Delete failed', `Unable to delete ${displayName}.`, 'red')
    }
  }

  const handleRetrain = async () => {
    try {
      if (retrainRequestPending || trainingStatus.status === 'queued' || trainingStatus.status === 'training') {
        return
      }

      setRetrainRequestPending(true)
      trainingCompletionHandledRef.current = false

      const model = modelSelectorOptions.find((m) => m.id === resolvedSelectedModelId)
      if (!model) throw new Error('No model selected for retraining')
      const result = await trainModel({ modelName: model.name, datasetName })
      setHistory((current) => [result, ...current])
      setTrainingStatus({
        status: 'queued',
        progress: 10,
        currentModel: model.name,
        lastTrainedAt: trainingStatus.lastTrainedAt ?? new Date().toISOString(),
        accuracy: trainingStatus.accuracy,
        precision: trainingStatus.precision,
        recall: trainingStatus.recall,
        f1Score: trainingStatus.f1Score,
        rocAuc: trainingStatus.rocAuc,
        jobId: result.id,
        message: result.log,
      })
      pushToast('Retraining queued', 'Model retraining has been queued. Dashboard insights will refresh after completion.', 'blue')
      setShowRetrainModal(false)
      setRetrainRequestPending(false)
    } catch (error) {
      pushToast('Retraining failed', error instanceof Error ? error.message : 'Unable to queue training.', 'red')
      setRetrainRequestPending(false)
    }
  }

  const handlePromote = async (modelId: number) => {
    try {
      setLoading(true)
      await promoteModel(modelId)
      setSelectedModelId(modelId)
      await reloadDashboardInsights()
      pushToast('Active model switched', 'The selected model is now active across the ML module.', 'emerald')
    } catch (error) {
      setLoading(false)
      pushToast('Model switch failed', error instanceof Error ? error.message : 'Unable to activate the selected model.', 'red')
    }
  }

  const getModelOptionLabel = (model: MlModelSummary) => model.displayLabel ?? `${model.name} · ${model.version}`

  const handleResolveAlert = async (alertId: number) => {
    const targetAlert = alerts.find((alert) => alert.id === alertId)
    if (!targetAlert) return

    if (targetAlert.source !== 'stored') {
      setAlerts((current) => current.map((alert) => (alert.id === alertId ? { ...alert, status: 'Resolved' } : alert)))
      pushToast('Alert resolved', 'The alert has been marked as resolved.', 'emerald')
      return
    }

    try {
      const updatedAlert = await resolveMlAlert(alertId)
      setAlerts((current) => current.map((alert) => (alert.id === alertId ? updatedAlert : alert)))
      pushToast('Alert resolved', 'The alert has been marked as resolved.', 'emerald')
    } catch (error) {
      pushToast('Resolve failed', error instanceof Error ? error.message : 'Unable to update the selected alert.', 'red')
    }
  }

  const handleDismissAlert = async (alertId: number) => {
    const targetAlert = alerts.find((alert) => alert.id === alertId)
    if (!targetAlert) return

    if (targetAlert.source !== 'stored') {
      setAlerts((current) => current.map((alert) => (alert.id === alertId ? { ...alert, status: 'Dismissed' } : alert)))
      pushToast('Alert dismissed', 'The alert has been marked as dismissed.', 'blue')
      return
    }

    try {
      const updatedAlert = await dismissMlAlert(alertId)
      setAlerts((current) => current.map((alert) => (alert.id === alertId ? updatedAlert : alert)))
      pushToast('Alert dismissed', 'The alert has been marked as dismissed.', 'blue')
    } catch (error) {
      pushToast('Dismiss failed', error instanceof Error ? error.message : 'Unable to update the selected alert.', 'red')
    }
  }

  const handleDeleteTrainingHistory = async (historyItem: TrainingHistoryItem) => {
    const isInProgress = historyItem.status === 'Queued' || historyItem.status === 'Running' || historyItem.status === 'Training'
    if (isInProgress) {
      pushToast('Delete unavailable', 'A training job that is still in progress cannot be deleted.', 'amber')
      return
    }

    if (!confirm(`Delete training history for ${historyItem.modelName} using ${historyItem.datasetName}? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingTrainingHistoryId(historyItem.id)
      await deleteTrainingHistoryEntry(historyItem.id)
      const [updatedHistory, updatedTrainingStatus] = await Promise.all([
        getTrainingHistory(),
        getMlTrainingStatus(),
      ])
      setHistory(updatedHistory ?? [])
      setTrainingStatus(updatedTrainingStatus ?? { status: 'idle', progress: 0, currentModel: 'N/A' })
      pushToast('Training history deleted', 'The selected training history entry was removed.', 'emerald')
    } catch (error) {
      pushToast('Delete failed', error instanceof Error ? error.message : 'Unable to delete the selected training history entry.', 'red')
    } finally {
      setDeletingTrainingHistoryId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />

      {apiError && (
        <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="rounded-xl bg-red-100 p-2 text-red-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">Machine Learning API Connection Failure</h3>
            <p className="mt-1 text-sm text-red-700">{apiError}</p>
            <button
              onClick={() => {
                setLoading(true);
                void reloadDashboardInsights();
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition"
            >
              <RefreshCcw className="h-3 w-3 animate-spin" />
              Retry Connection
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-800">
            <Brain className="h-3.5 w-3.5" />
            Machine Learning Module
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Risk Analytics, Explainability, and Model Management</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Use ML analytics to predict late payments, review explanations, and manage production models with role-based controls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/app/dashboard')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Back to overview <ArrowRight className="h-4 w-4" />
          </button>
          {(isAdmin || isAuditor || isAccountant) && (
            <button onClick={() => void handleExport()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              <Download className="h-4 w-4" />
              {isAccountant ? 'Export Summary' : isAdmin ? 'Export Full Report' : 'Export Predictions'}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((value) => <div key={value} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Selected Model" value={focusedModel?.name ?? 'N/A'} subtitle={focusedModel ? `${selectedDatasetLabel} · ${percent(displayedMetrics.rocAuc * 100)} ROC AUC` : 'No trained model available'} icon={Brain} />
          <MetricCard title="High-Risk Records" value={selectedHighRiskCount.toLocaleString('en-PH')} subtitle={`For ${selectedDatasetLabel}`} icon={AlertTriangle} />
          <MetricCard title="Selected F1 Score" value={focusedModel ? percent(displayedMetrics.f1Score * 100) : '—'} subtitle={focusedModel ? `${focusedModel.name} metrics for the current selection` : 'No selected model metrics'} icon={CheckCircle2} />
          <MetricCard title="Training Jobs" value={history.length.toLocaleString('en-PH')} subtitle="Recent training runs and status" icon={Database} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="Risk Distribution"
          subtitle="Low / medium / high risk forecast mix"
          notice={riskChartUnavailable ? (chartRiskDistribution.length > 0 ? 'ML service unavailable — showing fallback data' : 'ML service unavailable') : undefined}
        >
          <div className="h-72 relative">
            {riskChartUnavailable && chartRiskDistribution.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-200 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500 mb-2 animate-bounce" />
                <p className="text-sm font-medium text-slate-800">ML Risk Chart Unavailable</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">The ML service is starting up or temporarily sleeping.</p>
                <button
                  onClick={() => {
                    setLoading(true);
                    void reloadDashboardInsights();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <RefreshCcw className="h-3 w-3" />
                  Retry Chart
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartRiskDistribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>
                    {chartRiskDistribution.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Probability Histogram"
          subtitle="Distribution of late-payment risk scores"
          notice={histogramChartUnavailable ? (chartProbabilityHistogram.length > 0 ? 'ML service unavailable — showing fallback data' : 'ML service unavailable') : undefined}
        >
          <div className="h-72 relative">
            {histogramChartUnavailable && chartProbabilityHistogram.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-200 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500 mb-2 animate-bounce" />
                <p className="text-sm font-medium text-slate-800">ML Histogram Unavailable</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">The ML service is starting up or temporarily sleeping.</p>
                <button
                  onClick={() => {
                    setLoading(true);
                    void reloadDashboardInsights();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <RefreshCcw className="h-3 w-3" />
                  Retry Chart
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartProbabilityHistogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Feature Importance"
          subtitle="Top contributing drivers for the current explanation"
          notice={featureChartUnavailable ? (chartFeatureImportance.length > 0 ? 'ML service unavailable — showing fallback data' : 'ML service unavailable') : undefined}
        >
          <div className="h-72 relative">
            {featureChartUnavailable && chartFeatureImportance.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-200 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500 mb-2 animate-bounce" />
                <p className="text-sm font-medium text-slate-800">ML Feature Importance Unavailable</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">The ML service is starting up or temporarily sleeping.</p>
                <button
                  onClick={() => {
                    setLoading(true);
                    void reloadDashboardInsights();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  <RefreshCcw className="h-3 w-3" />
                  Retry Chart
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartFeatureImportance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" width={130} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="importance" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
        <div className={`flex h-full flex-col gap-4 ${isAdmin ? 'xl:col-span-3' : 'xl:col-span-6'}`}>
          <SectionCard
            title="Model Performance"
            subtitle="Compare active and archived models"
            action={isAdmin ? (
              <button onClick={() => setShowRetrainModal(true)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">
                <RefreshCcw className="h-4 w-4" />
                Retrain Model
              </button>
            ) : null}
          >
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
                    {isAdmin && <th className="px-4 py-3">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {models
                    .filter((model) => model.accuracy > 0 || model.rocAuc > 0 || model.f1Score > 0)
                    .map((model) => (
                      <tr key={model.id} className={bestModel?.id === model.id ? 'bg-blue-50/50' : ''}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{model.name}</div>
                          <div className="text-xs text-slate-500">Version {model.version} · {formatDate(model.lastTrainedAt)}</div>
                        </td>
                        <td className="px-4 py-3">{percent(model.accuracy * 100)}</td>
                        <td className="px-4 py-3">{percent(model.precision * 100)}</td>
                        <td className="px-4 py-3">{percent(model.recall * 100)}</td>
                        <td className="px-4 py-3">{percent(model.f1Score * 100)}</td>
                        <td className="px-4 py-3">{percent(model.rocAuc * 100)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${modelStatusClass(model.status)}`}>{model.status}</span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <button onClick={() => handlePromote(model.id)} disabled={model.status === 'Active'} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                              Promote
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  {models.filter((model) => model.accuracy > 0 || model.rocAuc > 0 || model.f1Score > 0).length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-6 text-center text-sm text-slate-400">
                        No trained models with metrics yet. Train a model to see performance data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Alerts" subtitle="Auto-generated alerts for audit and compliance" className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-3">
              {alerts.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                  <div>
                    <p className="text-sm font-medium text-slate-700">No alerts yet</p>
                    <p className="mt-1 text-xs text-slate-500">High-risk predictions and audit flags will appear here once the ML module detects records that need review.</p>
                  </div>
                </div>
              ) : alerts.map((alert) => (
                <div key={`${alert.source ?? 'alert'}-${alert.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full ${alert.severity === 'High' ? 'bg-red-500' : alert.severity === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">{alert.title}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${AlertStatusClass(alert.status)}`}>{alert.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{alert.description}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">{alert.category} · {formatDateTime(alert.createdAt)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isAdmin ? (
                          <button onClick={() => void handleResolveAlert(alert.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
                            Resolve
                          </button>
                        ) : null}
                        <button onClick={() => void handleDismissAlert(alert.id)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {isAdmin && (
          <SectionCard
            title="Model Management"
            subtitle="Admin controls for dataset upload and active model switching"
            className="h-full xl:col-span-3"
            action={<span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Admin only</span>}
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">ML Model Status</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">Selected Model: {focusedModel?.name ?? 'N/A'}</p>
                    <p className="mt-1 break-all text-sm text-slate-600">Dataset: {selectedDatasetLabel}</p>
                    <p className="mt-1 text-sm text-slate-600">Training Job Model: {trainingStatus.currentModel || 'N/A'}</p>
                    <p className="mt-1 text-sm text-slate-600">Status: {trainingStatus.status === 'training' ? 'Training...' : trainingStatus.status === 'queued' ? 'Queued' : trainingStatus.status === 'completed' ? 'Completed' : trainingStatus.status === 'failed' ? 'Failed' : 'Idle'}</p>
                    <p className="mt-1 text-sm text-slate-600">Progress: {trainingStatus.progress}%</p>
                    <p className="mt-1 text-sm text-slate-600">Last Trained: {formatDateTime(displayedLastTrainedAt)}</p>
                  </div>
                  <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-sm lg:w-[220px] lg:flex-none">
                    <p className="font-semibold uppercase tracking-wider text-slate-500">Selected model metrics</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                      <span>Accuracy</span><span className="text-right font-medium text-slate-900">{percent(displayedMetrics.accuracy * 100)}</span>
                      <span>Precision</span><span className="text-right font-medium text-slate-900">{percent(displayedMetrics.precision * 100)}</span>
                      <span>Recall</span><span className="text-right font-medium text-slate-900">{percent(displayedMetrics.recall * 100)}</span>
                      <span>F1</span><span className="text-right font-medium text-slate-900">{percent(displayedMetrics.f1Score * 100)}</span>
                      <span>ROC AUC</span><span className="text-right font-medium text-slate-900">{percent(displayedMetrics.rocAuc * 100)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-700 transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, trainingStatus.progress))}%` }} />
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white p-2 text-blue-700 shadow-sm">
                    <FileUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Upload dataset</p>
                    <p className="text-xs text-slate-500">CSV files only. Used for retraining and validation.</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="ml-auto rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800">
                    Select CSV
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void handleUpload(event.target.files?.[0])} />
                </div>
              </div>

              {/* Uploaded datasets list */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Uploaded datasets</p>
                {datasets.length === 0 ? (
                  <p className="text-sm text-slate-500">No datasets uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {datasets.map((d) => (
                      <div key={d.storedAs} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2">
                        <div className="text-sm text-slate-800">{d.fileName}</div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDatasetName(d.storedAs)} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Select</button>
                          <button onClick={() => void handleDeleteDataset(d.storedAs, d.fileName)} className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Active model selector</span>
                <select value={resolvedSelectedModelId ?? ''} onChange={(event) => setSelectedModelId(Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none ring-0 focus:border-blue-300">
                  {modelSelectorOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {getModelOptionLabel(model)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Dataset name</span>
                <input value={datasetName} onChange={(event) => setDatasetName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-300" />
              </label>

              <button
                onClick={() => setShowRetrainModal(true)}
                disabled={retrainRequestPending || trainingStatus.status === 'queued' || trainingStatus.status === 'training'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <RefreshCcw className={`h-4 w-4 ${(retrainRequestPending || trainingStatus.status === 'queued' || trainingStatus.status === 'training') ? 'animate-spin' : ''}`} />
                {retrainRequestPending || trainingStatus.status === 'queued' || trainingStatus.status === 'training' ? 'Training in progress...' : 'Retrain model'}
              </button>
            </div>
          </SectionCard>
        )}

      </div>

      <SectionCard title="Training History" subtitle="Recent retraining jobs and logs">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Dataset</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Finished</th>
                  {isAdmin ? <th className="px-4 py-3 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedHistory.length > 0 ? (
                  paginatedHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{item.modelName}</td>
                      <td className="px-4 py-2">{item.datasetName}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            item.status === 'Failed' ? 'bg-red-50 text-red-700 border-red-200' :
                              item.status === 'Queued' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                item.status === 'Running' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{formatDateTime(item.startedAt)}</td>
                      <td className="px-4 py-2 text-slate-600">{formatDateTime(item.finishedAt)}</td>
                      {isAdmin ? (
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => void handleDeleteTrainingHistory(item)}
                            disabled={deletingTrainingHistoryId === item.id || item.status === 'Queued' || item.status === 'Running' || item.status === 'Training'}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {deletingTrainingHistoryId === item.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                      No training history available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-600">
                Showing <span className="font-semibold">{(validPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold">{Math.min(validPage * itemsPerPage, history.length)}</span> of <span className="font-semibold">{history.length}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTrainingHistoryPage(Math.max(1, validPage - 1))}
                  disabled={validPage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setTrainingHistoryPage(page)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${page === validPage
                          ? 'bg-blue-700 text-white'
                          : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setTrainingHistoryPage(Math.min(totalPages, validPage + 1))}
                  disabled={validPage === totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {showPredictionModal && selectedPrediction && (
        <Modal title={`Prediction details · ${selectedPrediction.propertyId}`} onClose={() => setShowPredictionModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Owner</p><p className="mt-1 font-medium text-slate-900">{selectedPrediction.owner}</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Model</p><p className="mt-1 font-medium text-slate-900">{selectedPrediction.modelName}</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Risk Level</p><p className="mt-1 font-medium text-slate-900">{selectedPrediction.riskLevel}</p></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Probability</p><p className="mt-1 font-medium text-slate-900">{selectedPrediction.probabilityScore}%</p></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Last Payment Date</p>
              <p className="mt-1 text-sm text-slate-700">{formatDate(selectedPrediction.lastPaymentDate)}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPredictionModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
            </div>
          </div>
        </Modal>
      )}

      {showExplanationModal && selectedPrediction && selectedExplanation && (
        <Modal title={`Explainability · ${selectedPrediction.propertyId}`} onClose={() => setShowExplanationModal(false)}>
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs uppercase tracking-wider text-blue-700">Why flagged as high risk?</p>
              <p className="mt-2 text-sm text-slate-800">{selectedExplanation ? selectedExplanation.summary : 'No explanation is available for this prediction yet.'}</p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Top contributing factors</p>
              {selectedExplanation && selectedExplanation.factors.length > 0 ? (
                <div className="space-y-2">
                  {selectedExplanation.factors.slice(0, 3).map((factor) => (
                    <div key={factor.name} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{factor.name}</span>
                        <span className="text-slate-500">{factor.impact}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-blue-700" style={{ width: `${factor.impact}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No contributing factor data is available yet.</div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Confidence score</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{selectedExplanation ? percent(selectedExplanation.confidenceScore) : '—'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Prediction</p>
                <p className="mt-1 text-sm text-slate-700">{selectedPrediction.prediction} · {selectedPrediction.riskLevel}</p>
              </div>
            </div>

            <div>
              <button onClick={() => setRawJsonVisible((current) => !current)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {rawJsonVisible ? 'Hide raw JSON' : 'Show raw JSON'}
              </button>
              {rawJsonVisible && selectedExplanation && (
                <pre className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(selectedExplanation.rawJson, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showRetrainModal && (
        <Modal title="Confirm retraining" onClose={() => setShowRetrainModal(false)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Retrain the current production pipeline?</p>
              <p className="mt-1 text-amber-800">A new training job will be queued using {datasetName}. The active model selector is currently set to {selectedModel?.name ?? 'Unknown'}.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRetrainModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => void handleRetrain()} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">Retrain</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
