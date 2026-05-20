import api from './api'

export type DashboardOverview = {
  totalProperties: number
  totalTaxCollected: number
  pendingPayments: number
  complianceRate: number
  highRiskProperties: number
  monthlyTaxCollection: Array<{ month: string; amount: number }>
  paymentStatus: Array<{ name: string; value: number }>
  complianceByArea: Array<{ name: string; value: number }>
}

export type MlModelSummary = {
  id: number
  name: string
  version: string
  displayLabel?: string
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  rocAuc: number
  cvRocAucMean?: number
  testAccuracy?: number
  testPrecision?: number
  testRecall?: number
  testF1?: number
  testRocAuc?: number
  status: 'Active' | 'Archived'
  isBestModel?: boolean
  lastTrainedAt: string
}

export type MlPredictionItem = {
  id: number
  propertyId: string
  owner: string
  prediction: 'Late' | 'On-time'
  riskLevel: 'Low' | 'Medium' | 'High'
  probabilityScore: number
  lastPaymentDate: string
  modelName: string
}

export type MlExplanation = {
  id: number
  predictionId: number
  summary: string
  confidenceScore: number
  factors: Array<{ name: string; impact: number }>
  rawJson: Record<string, unknown>
}

export type MlAlert = {
  id: number
  title: string
  description: string
  category: 'High-risk' | 'Repeated late payment' | 'Audit flag'
  status: 'Open' | 'Resolved' | 'Dismissed'
  createdAt: string
  propertyId: string
  severity: 'Low' | 'Medium' | 'High'
}

export type TrainingHistoryItem = {
  id: number
  modelName: string
  datasetName: string
  status: 'Queued' | 'Running' | 'Training' | 'Completed' | 'Failed'
  startedAt: string
  finishedAt?: string
  log: string
}

export type MlTrainingStatus = {
  status: 'idle' | 'queued' | 'training' | 'completed' | 'failed'
  progress: number
  currentModel: string
  lastTrainedAt?: string | null
  accuracy?: number
  precision?: number
  recall?: number
  f1Score?: number
  rocAuc?: number
  jobId?: number | null
  message?: string | null
}

export type DatasetUploadResult = {
  success: boolean
  message: string
  fileName?: string
  storedAs?: string
}

const emptyOverview: DashboardOverview = {
  totalProperties: 0,
  totalTaxCollected: 0,
  pendingPayments: 0,
  complianceRate: 0,
  highRiskProperties: 0,
  monthlyTaxCollection: [],
  paymentStatus: [],
  complianceByArea: [],
}

const emptyModels: MlModelSummary[] = []
const emptyPredictions: MlPredictionItem[] = []
const emptyHistory: TrainingHistoryItem[] = []

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await api.get(path)
    return (response.data?.data ?? response.data ?? fallback) as T
  } catch {
    return fallback
  }
}

async function safePost<T>(path: string, body?: unknown, fallback?: T): Promise<T> {
  try {
    const response = await api.post(path, body)
    return (response.data?.data ?? response.data ?? fallback) as T
  } catch {
    if (fallback === undefined) {
      throw new Error('Request failed and no fallback was provided.')
    }

    return fallback
  }
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  return safeGet('/dashboard/overview', emptyOverview)
}

export async function getMlModels(): Promise<MlModelSummary[]> {
  return safeGet('/ml/models', emptyModels)
}

export async function getMlPredictions(): Promise<MlPredictionItem[]> {
  return safeGet('/ml/predictions', emptyPredictions)
}

export async function getMlExplanation(predictionId: number): Promise<MlExplanation> {
  const fallback: MlExplanation = {
    id: predictionId,
    predictionId,
    summary: 'No explanation is available yet.',
    confidenceScore: 0,
    factors: [],
    rawJson: {},
  }

  return safeGet(`/ml/explanations/${predictionId}`, fallback)
}

export async function createPrediction(payload: { propertyId: number; modelName?: string }) {
  return safePost('/ml/predictions', payload)
}

export async function trainModel(payload: { modelName: string; datasetName: string; parameters?: Record<string, unknown> }): Promise<TrainingHistoryItem> {
  return safePost('/ml/training', payload)
}

export async function uploadDataset(file: File): Promise<DatasetUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await api.post('/ml/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return (response.data?.data ?? response.data) as DatasetUploadResult
  } catch {
    return {
      success: false,
      message: `Unable to upload dataset ${file.name}.`,
    }
  }
}

export async function listDatasets(): Promise<Array<{ fileName: string; storedAs: string; size: number; createdAt: string }>> {
  return safeGet('/ml/datasets', [])
}

export async function deleteDataset(storedAs: string): Promise<boolean> {
  try {
    const response = await api.delete(`/ml/datasets/${encodeURIComponent(storedAs)}`)
    return Boolean(response?.data?.data ?? response?.data)
  } catch {
    return false
  }
}

export async function getTrainingHistory(): Promise<TrainingHistoryItem[]> {
  return safeGet('/ml/training/history', emptyHistory)
}

export async function getMlTrainingStatus(): Promise<MlTrainingStatus> {
  return safeGet('/ml/status', {
    status: 'idle',
    progress: 0,
    currentModel: 'N/A',
  })
}
