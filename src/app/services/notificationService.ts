import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export type DataNotificationType = 'info' | 'deadline' | 'overdue'

export interface DataNotificationDto {
  id: number
  title: string
  message: string
  type: DataNotificationType | string
  entityName?: string | null
  entityId?: string | null
  isRead: boolean
  createdAtUtc: string
  readAtUtc?: string | null
}

export class NotificationRequestError extends Error {
  readonly errors: string[]

  constructor(message: string, errors: string[] = []) {
    super(message)
    this.name = 'NotificationRequestError'
    this.errors = errors
  }
}

function unwrapResponse<T>(payload: ApiResponse<T>): T {
  if (!payload.success || payload.data === undefined) {
    throw new NotificationRequestError(payload.message || 'Request failed.', payload.errors ?? [])
  }

  return payload.data
}

function normalizeApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiResponse<unknown> | undefined
    throw new NotificationRequestError(payload?.message ?? error.message ?? 'Request failed.', payload?.errors ?? [])
  }

  throw error instanceof Error ? new NotificationRequestError(error.message) : new NotificationRequestError('Request failed.')
}

export async function getNotifications(take = 20): Promise<DataNotificationDto[]> {
  try {
    const response = await api.get<ApiResponse<DataNotificationDto[]>>('/notifications', { params: { take } })
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const response = await api.get<ApiResponse<number>>('/notifications/unread-count')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function markNotificationRead(id: number): Promise<void> {
  try {
    await api.post<ApiResponse<null>>(`/notifications/${id}/read`)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function markAllNotificationsRead(): Promise<number> {
  try {
    const response = await api.post<ApiResponse<number>>('/notifications/read-all')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}
