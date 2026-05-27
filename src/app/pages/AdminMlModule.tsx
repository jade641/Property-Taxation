import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react'
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
  getMlDatasetAnalysis,
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
  type MlDatasetAnalysis,
  type MlDatasetInsights,
  type MlDatasetPredictionItem,
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

function PredictionSummaryCard({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string
  value: string
  subtitle: string
  tone: 'blue' | 'red' | 'amber' | 'emerald'
}) {
  const toneClasses = tone === 'red'
    ? 'border-red-200 bg-red-50/80'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50/80'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50/80'
        : 'border-blue-200 bg-blue-50/80'

  const labelClasses = tone === 'red'
    ? 'text-red-700'
    : tone === 'amber'
      ? 'text-amber-700'
      : tone === 'emerald'
        ? 'text-emerald-700'
        : 'text-blue-700'

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${labelClasses}`}>{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{subtitle}</p>
    </div>
  )
}

function UnavailableChartState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
      <AlertTriangle className="mb-2 h-8 w-8 text-amber-500 animate-bounce" />
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="mt-1 max-w-[220px] text-xs text-slate-500">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <RefreshCcw className="h-3 w-3" />
        Retry Chart
      </button>
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

type MlChartResponse<T> = { data: T | null; unavailable: boolean }
type UploadedDataset = { fileName: string; storedAs: string; size: number; createdAt: string }
type DashboardSnapshot = {
  models: MlModelSummary[]
  predictions: MlPredictionItem[]
  alerts: MlAlert[]
  history: TrainingHistoryItem[]
  datasets: UploadedDataset[]
  trainingStatus: MlTrainingStatus
  datasetInsights: MlDatasetInsights | null
  datasetPredictions: MlDatasetPredictionItem[]
  datasetPredictionSkippedRows: number
  artifactRiskDistribution: Array<{ name: string; value: number }>
  artifactHistogram: Array<{ name: string; value: number }>
  artifactFeatureImportance: Array<{ name: string; importance: number }>
  riskChartUnavailable: boolean
  histogramChartUnavailable: boolean
  featureChartUnavailable: boolean
  resolvedDatasetName: string
}
type DatasetPredictionRiskFilter = 'All' | MlDatasetPredictionItem['riskLevel']
type DatasetPredictionSortMode = 'RiskDescending' | 'ScoreDescending' | 'PropertyAscending'

const SHOULD_LOG_CHART_WARNINGS = import.meta.env.DEV
const SHOULD_LOG_DASHBOARD_WARNINGS = import.meta.env.DEV
const EMPTY_DATASET_ANALYSIS: MlDatasetAnalysis = { summary: null, predictions: [], skippedRows: 0 }
const DEFAULT_TRAINING_STATUS: MlTrainingStatus = { status: 'idle', progress: 0, currentModel: 'N/A' }
const DATASET_RISK_FILTER_OPTIONS: Array<{ value: DatasetPredictionRiskFilter; label: string }> = [
  { value: 'All', label: 'All preview rows' },
  { value: 'High', label: 'High risk' },
  { value: 'Medium', label: 'Medium risk' },
  { value: 'Low', label: 'Low risk' },
]
const DATASET_SORT_OPTIONS: Array<{ value: DatasetPredictionSortMode; label: string }> = [
  { value: 'RiskDescending', label: 'Highest risk first' },
  { value: 'ScoreDescending', label: 'Highest score first' },
  { value: 'PropertyAscending', label: 'Property ID' },
]

function getDatasetPredictionKey(item: MlDatasetPredictionItem) {
  return `${item.rowNumber}-${item.propertyId}-${item.owner}`
}

function getDatasetRiskWeight(riskLevel: MlDatasetPredictionItem['riskLevel']) {
  if (riskLevel === 'High') return 3
  if (riskLevel === 'Medium') return 2
  return 1
}

function getDatasetRiskBadgeClass(riskLevel: MlDatasetPredictionItem['riskLevel']) {
  if (riskLevel === 'High') return 'border border-red-100 bg-red-50 text-red-700'
  if (riskLevel === 'Medium') return 'border border-amber-100 bg-amber-50 text-amber-700'
  return 'border border-emerald-100 bg-emerald-50 text-emerald-700'
}

function getDatasetRiskMeterClass(riskLevel: MlDatasetPredictionItem['riskLevel']) {
  if (riskLevel === 'High') return 'bg-red-500'
  if (riskLevel === 'Medium') return 'bg-amber-500'
  return 'bg-emerald-500'
}

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

    if (response.data && typeof response.data === 'object' && 'unavailable' in response.data && response.data.unavailable === true) {
      return { data: null, unavailable: true }
    }

    // Validate response has expected structure
    if (!response.data) {
      if (SHOULD_LOG_CHART_WARNINGS) {
        console.warn(`[ML Chart] Empty response from ${path}`)
      }
      return { data: null, unavailable: true }
    }

    const result = (response.data?.data ?? response.data) as T

    if (result && typeof result === 'object' && 'unavailable' in (result as Record<string, unknown>) && (result as Record<string, unknown>).unavailable === true) {
      return { data: null, unavailable: true }
    }

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

function buildAlertFeed(storedAlerts: MlAlert[]): MlAlert[] {
  return storedAlerts
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
  const [datasetInsights, setDatasetInsights] = useState<MlDatasetInsights | null>(null)
  const [datasetPredictions, setDatasetPredictions] = useState<MlDatasetPredictionItem[]>([])
  const [datasetPredictionSkippedRows, setDatasetPredictionSkippedRows] = useState(0)
  const [artifactRiskDistribution, setArtifactRiskDistribution] = useState<Array<{ name: string; value: number }>>([])
  const [artifactHistogram, setArtifactHistogram] = useState<Array<{ name: string; value: number }>>([])
  const [artifactFeatureImportance, setArtifactFeatureImportance] = useState<Array<{ name: string; importance: number }>>([])
  const [riskChartUnavailable, setRiskChartUnavailable] = useState(false)
  const [histogramChartUnavailable, setHistogramChartUnavailable] = useState(false)
  const [featureChartUnavailable, setFeatureChartUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showRetrainModal, setShowRetrainModal] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [datasetRiskFilter, setDatasetRiskFilter] = useState<DatasetPredictionRiskFilter>('All')
  const [datasetSortMode, setDatasetSortMode] = useState<DatasetPredictionSortMode>('RiskDescending')
  const [datasetPredictionQuery, setDatasetPredictionQuery] = useState('')
  const [selectedDatasetPredictionKey, setSelectedDatasetPredictionKey] = useState<string | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<MlTrainingStatus>({ status: 'idle', progress: 0, currentModel: 'N/A' })
  const [retrainRequestPending, setRetrainRequestPending] = useState(false)
  const [deletingTrainingHistoryId, setDeletingTrainingHistoryId] = useState<number | null>(null)
  const [trainingHistoryPage, setTrainingHistoryPage] = useState(1)
  const [toasts, setToasts] = useState<Toast[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastIdRef = useRef(0)
  const trainingCompletionHandledRef = useRef(false)
  const deferredDatasetPredictionQuery = useDeferredValue(datasetPredictionQuery)

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
      if (SHOULD_LOG_DASHBOARD_WARNINGS) {
        console.warn('[Dashboard] Error loading alerts:', error instanceof Error ? error.message : 'Unknown error')
      }
      return [] as MlAlert[]
    }
  }, [])

  const resetVisualizationState = useCallback(() => {
    setDatasetInsights(null)
    setDatasetPredictions([])
    setDatasetPredictionSkippedRows(0)
    setArtifactRiskDistribution([])
    setArtifactHistogram([])
    setArtifactFeatureImportance([])
    setRiskChartUnavailable(false)
    setHistogramChartUnavailable(false)
    setFeatureChartUnavailable(false)
    setSelectedDatasetPredictionKey(null)
  }, [])

  const buildDashboardSnapshot = useCallback(async (options?: { clearCache?: boolean }): Promise<DashboardSnapshot> => {
    if (options?.clearCache) {
      try {
        await api.post('/ml/chart/cache/clear')
      } catch {
        // ignore — cache clear is best-effort
      }
    }

    const [nextModels, nextPredictions, nextAlerts, nextHistory, nextDatasets, nextStatus] = await Promise.all([
      getMlModels(),
      getMlPredictions(),
      loadAlertsSafely(),
      getTrainingHistory(),
      listDatasets(),
      getMlTrainingStatus(),
    ])

    const availableDatasets = nextDatasets ?? []
    const safePredictions = nextPredictions ?? []
    const resolvedDatasetName = resolveSelectedDatasetName(datasetName, availableDatasets)
    const selectedModelName = (nextModels && nextModels.length > 0)
      ? ((selectedModelId !== null
        ? nextModels.find((model) => model.id === selectedModelId)
        : undefined) ?? nextModels.find((model) => model.isBestModel || model.status === 'Active') ?? nextModels[0]).name ?? ''
      : ''
    const datasetChartQuery = buildChartQuery(resolvedDatasetName, selectedModelName)
    const hasSelectedDataset = Boolean(resolvedDatasetName)

    const datasetAnalysisPromise = hasSelectedDataset
      ? getMlDatasetAnalysis(resolvedDatasetName, selectedModelName)
      : Promise.resolve<MlDatasetAnalysis>(EMPTY_DATASET_ANALYSIS)
    const riskPromise = hasSelectedDataset
      ? Promise.resolve<MlChartResponse<{ low: number; medium: number; high: number }>>({ data: null, unavailable: false })
      : fetchMlChart<{ low: number; medium: number; high: number }>(`/ml/chart/risk-distribution${datasetChartQuery}`)
    const histogramPromise = hasSelectedDataset
      ? Promise.resolve<MlChartResponse<{ bins: string[]; counts: number[] }>>({ data: null, unavailable: false })
      : fetchMlChart<{ bins: string[]; counts: number[] }>(`/ml/chart/probability-histogram${datasetChartQuery}`)

    const [featureResult, datasetAnalysisResult, riskResult, histogramResult] = await Promise.all([
      fetchMlChart<{ features: Array<{ name: string; importance: number }> }>('/ml/chart/feature-importance' + (selectedModelName ? `?model_name=${encodeURIComponent(selectedModelName)}` : '')),
      datasetAnalysisPromise,
      riskPromise,
      histogramPromise,
    ])

    const datasetInsightsData = datasetAnalysisResult?.summary && typeof datasetAnalysisResult.summary.low === 'number'
      ? datasetAnalysisResult.summary
      : null

    const nextRiskDistribution = datasetInsightsData
      ? [
          { name: 'Low', value: datasetInsightsData.low },
          { name: 'Medium', value: datasetInsightsData.medium },
          { name: 'High', value: datasetInsightsData.high },
        ]
      : riskResult?.data && typeof riskResult.data.low === 'number' && typeof riskResult.data.medium === 'number' && typeof riskResult.data.high === 'number'
        ? [
            { name: 'Low', value: riskResult.data.low },
            { name: 'Medium', value: riskResult.data.medium },
            { name: 'High', value: riskResult.data.high },
          ]
        : []

    const nextHistogram = datasetInsightsData && Array.isArray(datasetInsightsData.bins) && Array.isArray(datasetInsightsData.histogramCounts)
      ? datasetInsightsData.bins.map((bin, index) => ({ name: bin, value: datasetInsightsData.histogramCounts[index] ?? 0 }))
      : histogramResult?.data && Array.isArray(histogramResult.data.bins) && Array.isArray(histogramResult.data.counts)
        ? histogramResult.data.bins.map((bin, index) => ({ name: bin, value: histogramResult.data?.counts[index] ?? 0 }))
        : []

    const nextFeatureImportance = featureResult?.data?.features && Array.isArray(featureResult.data.features)
      ? featureResult.data.features
      : []

    return {
      models: nextModels ?? [],
      predictions: safePredictions,
      alerts: buildAlertFeed(nextAlerts ?? []),
      history: nextHistory ?? [],
      datasets: availableDatasets,
      trainingStatus: nextStatus ?? DEFAULT_TRAINING_STATUS,
      datasetInsights: datasetInsightsData,
      datasetPredictions: datasetAnalysisResult?.predictions ?? [],
      datasetPredictionSkippedRows: datasetAnalysisResult?.skippedRows ?? 0,
      artifactRiskDistribution: nextRiskDistribution,
      artifactHistogram: nextHistogram,
      artifactFeatureImportance: nextFeatureImportance,
      riskChartUnavailable: hasSelectedDataset ? !datasetInsightsData : (riskResult?.unavailable ?? true),
      histogramChartUnavailable: hasSelectedDataset ? !datasetInsightsData : (histogramResult?.unavailable ?? true),
      featureChartUnavailable: featureResult?.unavailable ?? true,
      resolvedDatasetName,
    }
  }, [datasetName, loadAlertsSafely, selectedModelId])

  const applyDashboardSnapshot = useCallback((snapshot: DashboardSnapshot) => {
    if (snapshot.resolvedDatasetName !== datasetName) {
      setDatasetName(snapshot.resolvedDatasetName)
    }

    setModels(snapshot.models)
    setPredictions(snapshot.predictions)
    setAlerts(snapshot.alerts)
    setHistory(snapshot.history)
    setDatasets(snapshot.datasets)
    setTrainingStatus(snapshot.trainingStatus)
    setDatasetInsights(snapshot.datasetInsights)
    setDatasetPredictions(snapshot.datasetPredictions)
    setDatasetPredictionSkippedRows(snapshot.datasetPredictionSkippedRows)
    setArtifactRiskDistribution(snapshot.artifactRiskDistribution)
    setArtifactHistogram(snapshot.artifactHistogram)
    setArtifactFeatureImportance(snapshot.artifactFeatureImportance)
    setRiskChartUnavailable(snapshot.riskChartUnavailable)
    setHistogramChartUnavailable(snapshot.histogramChartUnavailable)
    setFeatureChartUnavailable(snapshot.featureChartUnavailable)
  }, [datasetName])

  const reloadDashboardInsights = useCallback(async (options?: { clearCache?: boolean }) => {
    try {
      setApiError(null)
      resetVisualizationState()
      const snapshot = await buildDashboardSnapshot(options)
      applyDashboardSnapshot(snapshot)
    } catch (error) {
      if (SHOULD_LOG_DASHBOARD_WARNINGS) {
        console.error('[Dashboard] Error refreshing insights:', error)
      }
      let msg = 'Failed to connect to the Machine Learning API. The server may be sleeping or starting up.'
      if (axios.isAxiosError(error) && error.message) {
        msg = `Connection Error: ${error.message}`
      }
      setApiError(msg)
      setRiskChartUnavailable(true)
      setHistogramChartUnavailable(true)
      setFeatureChartUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [applyDashboardSnapshot, buildDashboardSnapshot, resetVisualizationState])

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        setLoading(true)
        setApiError(null)
        resetVisualizationState()
        const snapshot = await buildDashboardSnapshot()
        if (!active) return
        applyDashboardSnapshot(snapshot)
      } catch (error) {
        if (!active) return
        if (SHOULD_LOG_DASHBOARD_WARNINGS) {
          console.error('[Dashboard] Error loading initial ML data:', error)
        }
        let msg = 'Failed to connect to the Machine Learning API. The server may be sleeping or starting up.'
        if (axios.isAxiosError(error) && error.message) {
          msg = `Connection Error: ${error.message}`
        }
        setApiError(msg)
        setModels([])
        setPredictions([])
        setAlerts([])
        setHistory([])
        setDatasets([])
        setTrainingStatus(DEFAULT_TRAINING_STATUS)
        resetVisualizationState()
        setRiskChartUnavailable(true)
        setHistogramChartUnavailable(true)
        setFeatureChartUnavailable(true)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [applyDashboardSnapshot, buildDashboardSnapshot, resetVisualizationState])

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
        await reloadDashboardInsights({ clearCache: true })
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
  const resolvedSelectedModelId = selectedModelId ?? (modelSelectorOptions.find((option) => option.isBestModel || option.status === 'Active') ?? modelSelectorOptions[0])?.id ?? null
  const selectedModel = modelSelectorOptions.find((option) => option.id === resolvedSelectedModelId)
  const chartRiskDistribution = artifactRiskDistribution
  const chartProbabilityHistogram = artifactHistogram
  const chartFeatureImportance = artifactFeatureImportance
  const focusedModel = selectedModel ?? activeModel
  const selectedDatasetLabel = datasetName.trim() || 'No dataset selected'
  const selectedModelLabel = focusedModel?.name ?? 'Selected model'
  const selectedHighRiskCount = datasetInsights?.high ?? (chartRiskDistribution.find((bucket) => bucket.name === 'High')?.value ?? 0)
  const datasetMetricsAvailable = Boolean(datasetInsights?.hasGroundTruth && datasetInsights.evaluatedRows > 0)
  const displayedMetrics = datasetMetricsAvailable
    ? {
        accuracy: datasetInsights?.accuracy ?? 0,
        precision: datasetInsights?.precision ?? 0,
        recall: datasetInsights?.recall ?? 0,
        f1Score: datasetInsights?.f1Score ?? 0,
        rocAuc: datasetInsights?.rocAuc ?? 0,
      }
    : {
        accuracy: focusedModel?.accuracy ?? 0,
        precision: focusedModel?.precision ?? 0,
        recall: focusedModel?.recall ?? 0,
        f1Score: focusedModel?.f1Score ?? 0,
        rocAuc: focusedModel?.rocAuc ?? 0,
      }
  const metricsSubtitle = datasetMetricsAvailable
    ? `${selectedDatasetLabel} dataset evaluation`
    : 'stored evaluation metric'
  const displayedLastTrainedAt = focusedModel?.lastTrainedAt ?? trainingStatus.lastTrainedAt
  const datasetFallbackRiskCounts = useMemo(() => {
    const counts: Record<MlDatasetPredictionItem['riskLevel'], number> = { High: 0, Medium: 0, Low: 0 }

    for (const item of datasetPredictions) {
      counts[item.riskLevel] += 1
    }

    return counts
  }, [datasetPredictions])
  const datasetSummary = useMemo(() => ({
    totalScoredRows: datasetInsights?.totalPredictions ?? datasetPredictions.length,
    highRiskRows: datasetInsights?.high ?? datasetFallbackRiskCounts.High,
    mediumRiskRows: datasetInsights?.medium ?? datasetFallbackRiskCounts.Medium,
    lowRiskRows: datasetInsights?.low ?? datasetFallbackRiskCounts.Low,
    previewRows: datasetPredictions.length,
    evaluatedRows: datasetInsights?.evaluatedRows ?? 0,
  }), [datasetFallbackRiskCounts, datasetInsights, datasetPredictions.length])
  const datasetPreviewRiskCounts = useMemo(() => {
    const counts: Record<DatasetPredictionRiskFilter, number> = {
      All: datasetPredictions.length,
      High: 0,
      Medium: 0,
      Low: 0,
    }

    for (const item of datasetPredictions) {
      counts[item.riskLevel] += 1
    }

    return counts
  }, [datasetPredictions])
  const filteredDatasetPredictionRows = useMemo(() => {
    const normalizedQuery = deferredDatasetPredictionQuery.trim().toLowerCase()
    const rows = datasetPredictions
      .filter((item) => datasetRiskFilter === 'All' || item.riskLevel === datasetRiskFilter)
      .filter((item) => {
        if (!normalizedQuery) return true

        return item.propertyId.toLowerCase().includes(normalizedQuery)
          || item.owner.toLowerCase().includes(normalizedQuery)
          || item.prediction.toLowerCase().includes(normalizedQuery)
          || item.modelName.toLowerCase().includes(normalizedQuery)
      })

    rows.sort((left, right) => {
      if (datasetSortMode === 'PropertyAscending') {
        return left.propertyId.localeCompare(right.propertyId, undefined, { numeric: true, sensitivity: 'base' })
          || left.rowNumber - right.rowNumber
      }

      const riskDelta = getDatasetRiskWeight(right.riskLevel) - getDatasetRiskWeight(left.riskLevel)

      if (datasetSortMode === 'ScoreDescending') {
        return right.probabilityScore - left.probabilityScore
          || riskDelta
          || left.rowNumber - right.rowNumber
      }

      return riskDelta
        || right.probabilityScore - left.probabilityScore
        || left.rowNumber - right.rowNumber
    })

    return rows
  }, [datasetPredictions, datasetRiskFilter, datasetSortMode, deferredDatasetPredictionQuery])
  const datasetPredictionPreviewRows = filteredDatasetPredictionRows.slice(0, 12)
  const selectedDatasetPrediction = useMemo(
    () => filteredDatasetPredictionRows.find((item) => getDatasetPredictionKey(item) === selectedDatasetPredictionKey)
      ?? filteredDatasetPredictionRows[0]
      ?? null,
    [filteredDatasetPredictionRows, selectedDatasetPredictionKey],
  )
  const selectedDatasetPredictionRank = useMemo(() => {
    if (!selectedDatasetPrediction) {
      return null
    }

    return filteredDatasetPredictionRows.findIndex((item) => getDatasetPredictionKey(item) === getDatasetPredictionKey(selectedDatasetPrediction)) + 1
  }, [filteredDatasetPredictionRows, selectedDatasetPrediction])
  const datasetPredictionNotice = useMemo(() => {
    const notices: string[] = []

    if (datasetPredictionSkippedRows > 0) {
      notices.push(`${datasetPredictionSkippedRows.toLocaleString('en-PH')} dataset row(s) were skipped because the ML service rejected them.`)
    }

    if (datasetInsights && datasetPredictions.length > 0 && datasetPredictions.length < datasetInsights.totalPredictions) {
      notices.push(`Aggregate cards and charts reflect all ${datasetInsights.totalPredictions.toLocaleString('en-PH')} scored row(s). The review queue below uses ${datasetPredictions.length.toLocaleString('en-PH')} preview row(s) returned for UI review.`)
    }

    return notices.length > 0 ? notices.join(' ') : undefined
  }, [datasetInsights, datasetPredictionSkippedRows, datasetPredictions.length])

  // Training History pagination
  const itemsPerPage = 8
  const totalPages = Math.ceil(history.length / itemsPerPage)
  const validPage = Math.max(1, Math.min(trainingHistoryPage, totalPages || 1))
  const paginatedHistory = history.slice((validPage - 1) * itemsPerPage, validPage * itemsPerPage)

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
      try {
        const items = await listDatasets()
        setDatasets(items)
        setDatasetName(result.storedAs ?? file.name)
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
        const nextSelectedDataset = storedAs === datasetName ? resolveSelectedDatasetName('', items ?? []) : datasetName
        setDatasetName(nextSelectedDataset)
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
      const retrainDatasetName = resolveSelectedDatasetName(datasetName, datasets)
      if (!retrainDatasetName.trim()) {
        throw new Error('Select or upload a dataset CSV before retraining.')
      }

      if (retrainDatasetName !== datasetName) {
        setDatasetName(retrainDatasetName)
      }

      const result = await trainModel({ modelName: model.name, datasetName: retrainDatasetName })
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
      await reloadDashboardInsights({ clearCache: true })
      pushToast('Active model switched', 'The selected model is now active across the ML module.', 'emerald')
    } catch (error) {
      setLoading(false)
      pushToast('Model switch failed', error instanceof Error ? error.message : 'Unable to activate the selected model.', 'red')
    }
  }

  const retryDashboardLoad = useCallback(() => {
    setLoading(true)
    void reloadDashboardInsights()
  }, [reloadDashboardInsights])

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
              onClick={retryDashboardLoad}
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
          <MetricCard title="Selected Model" value={focusedModel?.name ?? 'N/A'} subtitle={focusedModel ? `${percent(displayedMetrics.rocAuc * 100)} ROC AUC · ${metricsSubtitle}` : 'No trained model available'} icon={Brain} />
          <MetricCard title="High-Risk Records" value={selectedHighRiskCount.toLocaleString('en-PH')} subtitle={datasetInsights ? `${selectedDatasetLabel} · ${datasetInsights.totalPredictions.toLocaleString('en-PH')} rows scored` : `For ${selectedDatasetLabel}`} icon={AlertTriangle} />
          <MetricCard title="Selected F1 Score" value={focusedModel ? percent(displayedMetrics.f1Score * 100) : '—'} subtitle={focusedModel ? `${focusedModel.name} ${metricsSubtitle}` : 'No selected model metrics'} icon={CheckCircle2} />
          <MetricCard title="Training Jobs" value={history.length.toLocaleString('en-PH')} subtitle="Recent training runs and status" icon={Database} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="Risk Distribution"
          subtitle="Low / medium / high risk forecast mix"
          notice={riskChartUnavailable ? 'ML service unavailable' : undefined}
        >
          <div className="h-72 relative">
            {riskChartUnavailable && chartRiskDistribution.length === 0 ? (
              <UnavailableChartState
                title="ML Risk Chart Unavailable"
                message="The ML service is starting up or temporarily sleeping."
                onRetry={retryDashboardLoad}
              />
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
          notice={histogramChartUnavailable ? 'ML service unavailable' : undefined}
        >
          <div className="h-72 relative">
            {histogramChartUnavailable && chartProbabilityHistogram.length === 0 ? (
              <UnavailableChartState
                title="ML Histogram Unavailable"
                message="The ML service is starting up or temporarily sleeping."
                onRetry={retryDashboardLoad}
              />
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
          notice={featureChartUnavailable ? 'ML service unavailable' : undefined}
        >
          <div className="h-72 relative">
            {featureChartUnavailable && chartFeatureImportance.length === 0 ? (
              <UnavailableChartState
                title="ML Feature Importance Unavailable"
                message="The ML service is starting up or temporarily sleeping."
                onRetry={retryDashboardLoad}
              />
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
                    <p className="mt-1 break-all text-sm text-slate-600">Dataset for live charts: {selectedDatasetLabel}</p>
                    <p className="mt-1 text-sm text-slate-600">Metric Source: {metricsSubtitle}{datasetInsights?.evaluatedRows ? ` · ${datasetInsights.evaluatedRows.toLocaleString('en-PH')} labeled rows` : ''}</p>
                    <p className="mt-1 text-sm text-slate-600">Training Job Model: {trainingStatus.currentModel || 'N/A'}</p>
                    <p className="mt-1 text-sm text-slate-600">Status: {trainingStatus.status === 'training' ? 'Training...' : trainingStatus.status === 'queued' ? 'Queued' : trainingStatus.status === 'completed' ? 'Completed' : trainingStatus.status === 'failed' ? 'Failed' : 'Idle'}</p>
                    <p className="mt-1 text-sm text-slate-600">Progress: {trainingStatus.progress}%</p>
                    <p className="mt-1 text-sm text-slate-600">Last Trained: {formatDateTime(displayedLastTrainedAt)}</p>
                  </div>
                  <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-sm lg:w-[220px] lg:flex-none">
                    <p className="font-semibold uppercase tracking-wider text-slate-500">{datasetMetricsAvailable ? 'Dataset evaluation metrics' : 'Stored model evaluation metrics'}</p>
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

      <SectionCard
        title="Prediction Review Console"
        subtitle={`Predictions generated from ${selectedDatasetLabel} using ${selectedModelLabel}`}
        notice={datasetPredictionNotice}
      >
        {!datasetName.trim() ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            Select or upload a dataset CSV to generate model-based predictions.
          </div>
        ) : datasetPredictions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            No dataset predictions are available yet for the selected model and CSV.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <PredictionSummaryCard
                label="Scored Rows"
                value={datasetSummary.totalScoredRows.toLocaleString('en-PH')}
                subtitle={`${selectedDatasetLabel} scored by ${selectedModelLabel}`}
                tone="blue"
              />
              <PredictionSummaryCard
                label="High-Risk Rows"
                value={datasetSummary.highRiskRows.toLocaleString('en-PH')}
                subtitle={datasetSummary.totalScoredRows > 0
                  ? `${((datasetSummary.highRiskRows / datasetSummary.totalScoredRows) * 100).toFixed(1)}% of the full dataset analysis`
                  : 'No scored rows yet'}
                tone="red"
              />
              <PredictionSummaryCard
                label="Preview Queue"
                value={datasetSummary.previewRows.toLocaleString('en-PH')}
                subtitle="Rows returned by the dataset-analysis preview for manual review"
                tone="amber"
              />
              <PredictionSummaryCard
                label="Evaluated Rows"
                value={datasetSummary.evaluatedRows.toLocaleString('en-PH')}
                subtitle={datasetMetricsAvailable ? 'Rows with ground-truth labels backing the evaluation metrics' : 'No ground-truth labels were detected in the selected CSV'}
                tone="emerald"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bound To Current Selection</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Dataset: {selectedDatasetLabel}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Model: {selectedModelLabel}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Preview rows loaded: {datasetSummary.previewRows.toLocaleString('en-PH')}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Metrics: {datasetMetricsAvailable ? 'CSV labels detected' : 'Model-only scoring'}</span>
                  </div>
                </div>

                <label className="block w-full xl:max-w-sm">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Search preview rows</span>
                  <input
                    value={datasetPredictionQuery}
                    onChange={(event) => setDatasetPredictionQuery(event.target.value)}
                    placeholder="Property ID, owner, prediction, or model"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-300"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {DATASET_RISK_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDatasetRiskFilter(option.value)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${datasetRiskFilter === option.value
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
                    >
                      {option.label} · {datasetPreviewRiskCounts[option.value].toLocaleString('en-PH')}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>Sort queue</span>
                  <select
                    value={datasetSortMode}
                    onChange={(event) => setDatasetSortMode(event.target.value as DatasetPredictionSortMode)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-blue-300"
                  >
                    {DATASET_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Showing top {datasetPredictionPreviewRows.length.toLocaleString('en-PH')} row(s) from {filteredDatasetPredictionRows.length.toLocaleString('en-PH')} matching preview record(s). Aggregate counters and charts remain tied to the full scored dataset.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {filteredDatasetPredictionRows.length === 0 ? (
                  <div className="flex min-h-[320px] items-center justify-center p-6 text-center">
                    <div>
                      <p className="text-sm font-medium text-slate-800">No preview rows match the current filters.</p>
                      <p className="mt-2 text-xs text-slate-500">Try a different risk filter, clear the search, or switch back to the full preview queue.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="border-b border-slate-200 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Review queue</p>
                      <p className="text-xs text-slate-500">Highest-risk preview rows are surfaced first unless you change the sort.</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Row</th>
                            <th className="px-4 py-3">Property</th>
                            <th className="px-4 py-3">Owner</th>
                            <th className="px-4 py-3">Prediction</th>
                            <th className="px-4 py-3">Risk</th>
                            <th className="px-4 py-3">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {datasetPredictionPreviewRows.map((item) => {
                            const isSelected = selectedDatasetPrediction ? getDatasetPredictionKey(item) === getDatasetPredictionKey(selectedDatasetPrediction) : false

                            return (
                              <tr
                                key={getDatasetPredictionKey(item)}
                                onClick={() => setSelectedDatasetPredictionKey(getDatasetPredictionKey(item))}
                                className={`cursor-pointer align-top transition-colors hover:bg-slate-50 ${isSelected ? 'bg-blue-50/70' : ''}`}
                              >
                                <td className="px-4 py-3 text-slate-500">{item.rowNumber}</td>
                                <td className="px-4 py-3 font-medium text-blue-700">{item.propertyId}</td>
                                <td className="px-4 py-3 text-slate-700">{item.owner}</td>
                                <td className="px-4 py-3 text-slate-700">{item.prediction}</td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getDatasetRiskBadgeClass(item.riskLevel)}`}>
                                    {item.riskLevel}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="min-w-[140px] space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-medium text-slate-900">{item.probabilityScore}%</span>
                                      <span className="text-[11px] uppercase tracking-wider text-slate-400">score</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className={`h-full rounded-full ${getDatasetRiskMeterClass(item.riskLevel)}`}
                                        style={{ width: `${Math.max(0, Math.min(100, item.probabilityScore))}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected preview row</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">{selectedDatasetPrediction?.propertyId ?? 'No matching row'}</h3>
                      <p className="mt-1 text-sm text-slate-600">{selectedDatasetPrediction?.owner ?? 'Adjust the filters or search to surface a matching row.'}</p>
                    </div>
                    {selectedDatasetPrediction ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getDatasetRiskBadgeClass(selectedDatasetPrediction.riskLevel)}`}>
                        {selectedDatasetPrediction.riskLevel}
                      </span>
                    ) : null}
                  </div>

                  {selectedDatasetPrediction ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Risk score</span>
                          <span className="font-semibold text-slate-900">{selectedDatasetPrediction.probabilityScore}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${getDatasetRiskMeterClass(selectedDatasetPrediction.riskLevel)}`}
                            style={{ width: `${Math.max(0, Math.min(100, selectedDatasetPrediction.probabilityScore))}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wider text-slate-500">Prediction</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedDatasetPrediction.prediction}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wider text-slate-500">CSV row</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedDatasetPrediction.rowNumber}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wider text-slate-500">Queue rank</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedDatasetPredictionRank ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wider text-slate-500">Model</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedDatasetPrediction.modelName}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Binding</p>
                        <p className="mt-2">This review card is sourced from <span className="font-medium text-slate-900">{selectedDatasetLabel}</span> and scored by <span className="font-medium text-slate-900">{selectedModelLabel}</span>.</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Select a preview row from the table to inspect its current dataset-scoped prediction details.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Full dataset risk mix</p>
                  <p className="mt-1 text-xs text-slate-500">These counts come from the selected CSV and model, not only the preview queue.</p>

                  <div className="mt-4 space-y-3">
                    {[
                      { label: 'High risk', value: datasetSummary.highRiskRows, bar: 'bg-red-500', track: 'bg-red-100' },
                      { label: 'Medium risk', value: datasetSummary.mediumRiskRows, bar: 'bg-amber-500', track: 'bg-amber-100' },
                      { label: 'Low risk', value: datasetSummary.lowRiskRows, bar: 'bg-emerald-500', track: 'bg-emerald-100' },
                    ].map((item) => {
                      const share = datasetSummary.totalScoredRows > 0 ? (item.value / datasetSummary.totalScoredRows) * 100 : 0

                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-slate-700">{item.label}</span>
                            <span className="text-slate-500">{item.value.toLocaleString('en-PH')} · {share.toFixed(1)}%</span>
                          </div>
                          <div className={`mt-2 h-2 overflow-hidden rounded-full ${item.track}`}>
                            <div className={`h-full rounded-full ${item.bar}`} style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

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
