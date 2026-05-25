import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const productionApiBaseUrl =
  'https://property-taxation-backend.onrender.com/api'

// Determine if we are running in a local environment
const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname === '[::1]');

const isDev = import.meta.env.DEV || isLocalhost;

// Get raw URL, fallback to dev backend target or production Render backend URL
let rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:5079/api' : productionApiBaseUrl);

// Crucial: In production, NEVER allow localhost
if (!isDev && (rawApiBaseUrl.includes('localhost') || rawApiBaseUrl.includes('127.0.0.1') || rawApiBaseUrl.includes('::1'))) {
  console.warn('[API] Localhost URL detected in production environment! Falling back to production API base URL.');
  rawApiBaseUrl = productionApiBaseUrl;
}

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.replace(/\/$/, '')

  if (trimmed === '/api' || trimmed.endsWith('/api')) {
    return trimmed
  }

  return `${trimmed}/api`
}

export const API_BASE_URL = normalizeApiBaseUrl(rawApiBaseUrl)

console.log('API BASE URL:', API_BASE_URL)

const API_TIMEOUT_MS = 30000 // 30 seconds to allow Render spin-up
const SHOULD_LOG_RETRY_WARNINGS = import.meta.env.DEV

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  timeoutErrorMessage: 'Request timed out. The backend is waking up or temporarily unavailable. Please try again.',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Extend InternalAxiosRequestConfig to support retry tracking
interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 4000 // 4 seconds between retries

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config

  const token = window.localStorage.getItem('taxsync.token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Automatic wakeup and retry interceptor for Render sleep mode / 503 Service Unavailable / timeouts
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig

    if (!config) {
      return Promise.reject(error)
    }

    const is503 = error.response?.status === 503
    const isTimeout = error.code === 'ECONNABORTED'
    const isNetworkError = !error.response

    if (is503 || isTimeout || isNetworkError) {
      config._retryCount = config._retryCount ?? 0

      if (config._retryCount < MAX_RETRIES) {
        config._retryCount += 1
        const delay = RETRY_DELAY_MS * config._retryCount

        if (SHOULD_LOG_RETRY_WARNINGS) {
          console.warn(
            `[API] Request to ${config.url || ''} failed (${error.message || 'Error code: ' + (error.code || 'unknown')}). ` +
            `Render backend might be sleeping. Waking up and retrying in ${delay}ms... (Attempt ${config._retryCount}/${MAX_RETRIES})`
          )
        }

        await new Promise((resolve) => setTimeout(resolve, delay))

        // Ensure headers are up to date (e.g. if token was refreshed or set)
        if (typeof window !== 'undefined') {
          const token = window.localStorage.getItem('taxsync.token')
          if (token) {
            config.headers.Authorization = `Bearer ${token}`
          }
        }

        return api(config)
      }
    }

    return Promise.reject(error)
  }
)

export default api