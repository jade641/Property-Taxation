import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface LandingSummary {
  totalUsers: number
  activeUsers: number
  totalProperties: number
  totalTaxpayers: number
  totalAssessments: number
  totalPayments: number
  totalCollected: number
  totalOutstandingBalance: number
  compliantCount: number
  lateCount: number
  unpaidCount: number
  complianceRate: number
  latestCollectionLabel: string | null
}

export class ApiRequestError extends Error {
  readonly errors: string[]

  constructor(message: string, errors: string[] = []) {
    super(message)
    this.name = 'ApiRequestError'
    this.errors = errors
  }
}

function unwrapResponse<T>(payload: ApiResponse<T>): T {
  if (!payload.success || payload.data === undefined) {
    throw new ApiRequestError(payload.message || 'Request failed.', payload.errors ?? [])
  }

  return payload.data
}

function normalizeApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiResponse<unknown> | undefined
    throw new ApiRequestError(payload?.message ?? error.message ?? 'Request failed.', payload?.errors ?? [])
  }

  throw error instanceof Error ? new ApiRequestError(error.message) : new ApiRequestError('Request failed.')
}

export async function getLandingSummary(): Promise<LandingSummary> {
  try {
    const response = await api.get<ApiResponse<LandingSummary>>('/public/landing-summary')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}