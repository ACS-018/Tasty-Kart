import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#fff7f7',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{ maxWidth: 560, textAlign: 'center' }}>
            <h1 style={{ color: '#B32B2C', fontSize: 28, marginBottom: 12 }}>TastyKart failed to load</h1>
            <p style={{ color: '#374151', marginBottom: 16 }}>
              The admin panel hit a runtime error. Try a hard refresh, or open the login page directly.
            </p>
            <pre style={{
              textAlign: 'left',
              background: '#111827',
              color: '#fca5a5',
              padding: 16,
              borderRadius: 12,
              overflow: 'auto',
              fontSize: 12,
              marginBottom: 20,
            }}>
              {this.state.error.message}
            </pre>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                background: '#B32B2C',
                color: '#fff',
                padding: '12px 20px',
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Go to Login
            </a>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
