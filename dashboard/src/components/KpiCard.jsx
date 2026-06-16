export default function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: '#1a1d27',
      border: '1px solid #2d3148',
      borderRadius: 12,
      padding: '20px 24px',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: accent || '#e2e8f0', letterSpacing: '-1px', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  )
}
