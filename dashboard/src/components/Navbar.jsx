export default function Navbar({ health, lastUpdated }) {
  const dot = health === 'ok'    ? '#22c55e'
            : health === 'error' ? '#ef4444'
            : '#64748b'

  const label = health === 'ok'    ? 'Pipeline online'
              : health === 'error' ? 'Pipeline offline'
              : 'Checking…'

  const ts = lastUpdated
    ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : ''

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 56,
      background: '#1a1d27', borderBottom: '1px solid #2d3148',
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      <span style={{
        fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px',
        background: 'linear-gradient(90deg, #a855f7, #3b82f6)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        DataSense
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94a3b8' }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8,
          borderRadius: '50%', background: dot,
          boxShadow: health === 'ok' ? `0 0 6px ${dot}` : 'none',
        }} />
        <span>{label}</span>
        {ts && <span style={{ color: '#475569' }}>{ts}</span>}
      </div>
    </header>
  )
}
