import React from 'react'
import { X } from 'lucide-react'

type State = { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<Record<string, unknown>, State> {
  constructor(props: Record<string, unknown>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console and keep UI from unmounting
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children as React.ReactElement

    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-4">
            <div className="text-red-700"><X className="h-6 w-6" /></div>
            <div>
              <h3 className="text-lg font-semibold text-red-800">Something went wrong</h3>
              <p className="mt-2 text-sm text-red-700">The machine learning module failed to load. The error has been logged to the console.</p>
              {this.state.error && (
                <pre className="mt-3 max-h-40 overflow-auto rounded bg-white p-3 text-xs text-slate-700">{this.state.error.message}</pre>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
