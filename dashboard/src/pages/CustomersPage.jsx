import { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { fetchCustomers } from '../api'

const SEG_COLOR = {
  VIP:        '#a855f7',
  REGULAR:    '#3b82f6',
  OCCASIONAL: '#64748b',
}

function fmtRevenue(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `£${(n / 1_000).toFixed(1)}K`
  return `£${n.toFixed(0)}`
}

function pct(part, total) {
  if (!total) return '—'
  return `${((part / total) * 100).toFixed(1)}%`
}

export default function CustomersPage() {
  const [segments, setSegments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    fetchCustomers()
      .then(r => setSegments(r.data.segments || []))
      .catch(e => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>Loading customer data…</div>
  if (error)   return <div style={{ padding: 40, color: '#ef4444' }}>{error}</div>
  if (!segments.length) return <div style={{ padding: 40, color: '#94a3b8' }}>No customer data available.</div>

  const totalCustomers = segments.reduce((s, r) => s + (r.count || 0), 0)
  const totalRevenue   = segments.reduce((s, r) => s + (r.total_revenue || 0), 0)

  const pieTrace = {
    type: 'pie',
    labels: segments.map(s => s.segment),
    values: segments.map(s => s.count),
    marker: { colors: segments.map(s => SEG_COLOR[s.segment] ?? '#64748b') },
    textinfo: 'label+percent',
    textfont: { color: '#e2e8f0', size: 13 },
    hovertemplate: '<b>%{label}</b><br>Customers: %{value:,}<br>Share: %{percent}<extra></extra>',
    hole: 0.38,
  }

  const layout = {
    title: { text: 'Customer Segment Distribution', font: { color: '#e2e8f0', size: 16 } },
    paper_bgcolor: '#1a1d27',
    plot_bgcolor:  '#1a1d27',
    font: { color: '#94a3b8' },
    legend: { font: { color: '#e2e8f0', size: 13 } },
    margin: { l: 20, r: 20, t: 50, b: 20 },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Pie chart */}
      <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, overflow: 'hidden' }}>
        <Plot
          data={[pieTrace]}
          layout={layout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: 420 }}
          useResizeHandler
        />
      </div>

      {/* Stats table */}
      <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2d3148', fontWeight: 600, fontSize: 14 }}>
          Segment Summary
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#21253a' }}>
                {['Segment', 'Customers', 'Total Revenue', '% of Customers', '% of Revenue'].map(col => (
                  <th key={col} style={{
                    padding: '10px 20px', textAlign: 'left',
                    color: '#64748b', fontWeight: 600, fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: 0.8,
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segments.map((row, i) => {
                const color = SEG_COLOR[row.segment] ?? '#64748b'
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #2d3148' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        padding: '3px 12px', borderRadius: 9999,
                        background: color + '20',
                        color, fontWeight: 700, fontSize: 12,
                      }}>
                        {row.segment}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#e2e8f0' }}>
                      {row.count?.toLocaleString() ?? '—'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#e2e8f0' }}>
                      {fmtRevenue(row.total_revenue)}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8' }}>
                      {pct(row.count, totalCustomers)}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8' }}>
                      {pct(row.total_revenue, totalRevenue)}
                    </td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr style={{ background: '#21253a', borderTop: '2px solid #2d3148' }}>
                <td style={{ padding: '14px 20px', fontWeight: 700, color: '#e2e8f0' }}>Total</td>
                <td style={{ padding: '14px 20px', fontWeight: 700, color: '#e2e8f0' }}>{totalCustomers.toLocaleString()}</td>
                <td style={{ padding: '14px 20px', fontWeight: 700, color: '#e2e8f0' }}>{fmtRevenue(totalRevenue)}</td>
                <td style={{ padding: '14px 20px', color: '#64748b' }}>100%</td>
                <td style={{ padding: '14px 20px', color: '#64748b' }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
