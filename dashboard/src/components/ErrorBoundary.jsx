import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>
            Render error
          </div>
          <pre style={{
            fontSize: 12, color: '#94a3b8', textAlign: 'left',
            background: '#1a1d27', border: '1px solid #2d3148',
            borderRadius: 8, padding: 16,
            maxWidth: 640, margin: '0 auto', overflowX: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 20, padding: '8px 20px',
              background: 'transparent', border: '1px solid #2d3148',
              borderRadius: 6, color: '#a855f7', cursor: 'pointer', fontSize: 14,
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
