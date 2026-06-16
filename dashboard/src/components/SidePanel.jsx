import { useEffect, useState } from 'react'
import { analyzeDate } from '../api'

function Chip({ text, colorMap }) {
  const key  = text?.toLowerCase()
  const c    = colorMap?.[key] ?? { bg: 'rgba(100,116,139,0.15)', border: '#475569', text: '#94a3b8' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 9999,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {text}
    </span>
  )
}

const CONFIDENCE_COLORS = {
  high:   { bg: 'rgba(34,197,94,0.12)',   border: '#22c55e', text: '#22c55e' },
  medium: { bg: 'rgba(245,158,11,0.12)',  border: '#f59e0b', text: '#f59e0b' },
  low:    { bg: 'rgba(239,68,68,0.12)',   border: '#ef4444', text: '#ef4444' },
}

const LIKELIHOOD_COLORS = {
  high:   { bg: 'rgba(239,68,68,0.1)',   border: '#ef4444', text: '#ef4444' },
  medium: { bg: 'rgba(245,158,11,0.1)',  border: '#f59e0b', text: '#f59e0b' },
  low:    { bg: 'rgba(34,197,94,0.1)',   border: '#22c55e', text: '#22c55e' },
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#475569',
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export default function SidePanel({ date, onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!date) return
    setData(null)
    setError(null)
    setLoading(true)
    analyzeDate(date)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false))
  }, [date])

  const open = Boolean(date)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        height: '100vh', width: 500,
        background: '#1a1d27',
        borderLeft: '1px solid #2d3148',
        zIndex: 50,
        overflowY: 'auto',
        padding: '24px 28px',
        boxSizing: 'border-box',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>AI Analysis</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>{date}</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #2d3148', borderRadius: 6,
              color: '#94a3b8', width: 32, height: 32, cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0', color: '#64748b', fontSize: 14 }}>
            <div style={{
              width: 36, height: 36,
              border: '3px solid #2d3148',
              borderTopColor: '#a855f7',
              borderRadius: '50%',
              animation: 'ds-spin 0.7s linear infinite',
            }} />
            Asking Claude…
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid #7f1d1d',
            borderRadius: 8, padding: 16, color: '#fca5a5', fontSize: 14, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Summary */}
            <Section label="Summary">
              <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{data.summary}</p>
            </Section>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Confidence</div>
                <Chip text={data.confidence} colorMap={CONFIDENCE_COLORS} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Category</div>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#a855f7',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {data.anomaly_category?.replace(/_/g, ' ') ?? '—'}
                </span>
              </div>
            </div>

            {/* Probable causes */}
            {data.probable_causes?.length > 0 && (
              <Section label="Probable Causes">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.probable_causes.map((c, i) => (
                    <div key={i} style={{
                      background: '#21253a', border: '1px solid #2d3148',
                      borderRadius: 8, padding: '12px 14px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{c.cause}</span>
                        <Chip text={c.likelihood} colorMap={LIKELIHOOD_COLORS} />
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{c.reasoning}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Recommended actions */}
            {data.recommended_actions?.length > 0 && (
              <Section label="Recommended Actions">
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.recommended_actions.map((a, i) => (
                    <li key={i} style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>{a}</li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Calendar context */}
            {data.calendar_context && (
              <Section label="Calendar Context">
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{data.calendar_context}</p>
              </Section>
            )}

            {/* Data quality flags */}
            {data.data_quality_flags?.length > 0 && (
              <Section label="Data Quality Flags">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.data_quality_flags.map((f, i) => (
                    <span key={i} style={{
                      padding: '2px 10px', borderRadius: 9999, fontSize: 12,
                      background: 'rgba(245,158,11,0.1)', border: '1px solid #92400e', color: '#fbbf24',
                    }}>
                      {f}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Sources */}
            {(data._rag_sources?.length > 0 || data._web_sources?.length > 0) && (
              <Section label="Sources">
                {data._rag_sources?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Knowledge Base</div>
                    {data._rag_sources.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                        {s.source} · chunk {s.chunk} · score {s.score}
                      </div>
                    ))}
                  </div>
                )}
                {data._web_sources?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Web Search</div>
                    {data._web_sources.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#475569', lineHeight: 1.8, wordBreak: 'break-all' }}>
                        {s.title || s.url}
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {data._cached && (
              <div style={{ fontSize: 11, color: '#334155', textAlign: 'right' }}>Cached result</div>
            )}
          </div>
        )}

        <style>{`@keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  )
}
