import { useState, useEffect, useCallback } from 'react'
import PlotWrapper from '../components/PlotWrapper'
import KpiCard from '../components/KpiCard'
import SidePanel from '../components/SidePanel'
import { fetchMetricsDaily, fetchPipelineStatus } from '../api'

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtGBP(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `£${(n / 1_000).toFixed(1)}K`
  return `£${n.toFixed(0)}`
}

function fmtNum(n) {
  return n != null ? n.toLocaleString() : '—'
}

function dateStr(d) {
  return typeof d === 'string' ? d.substring(0, 10) : String(d ?? '')
}

// ── Detection-method styling ──────────────────────────────────────────────────

const DM_BG = {
  confirmed_anomaly: 'rgba(239,68,68,0.07)',
  possible_anomaly:  'rgba(245,158,11,0.07)',
  normal:            'transparent',
}
const DM_BADGE = {
  confirmed_anomaly: { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#ef4444'  },
  possible_anomaly:  { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#f59e0b'  },
  normal:            { bg: 'transparent',            border: '#2d3148', text: '#64748b'  },
}

function DetectionBadge({ value }) {
  const s = DM_BADGE[value] ?? DM_BADGE.normal
  const label = (value ?? 'normal').replace(/_/g, ' ')
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
    }}>
      {label}
    </span>
  )
}

// ── HomePage ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [daily, setDaily]       = useState([])
  const [status, setStatus]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dailyRes, statusRes] = await Promise.allSettled([
        fetchMetricsDaily(),
        fetchPipelineStatus(),
      ])
      if (dailyRes.status === 'fulfilled')  setDaily(dailyRes.value.data.daily ?? [])
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 5 * 60_000)
    return () => clearInterval(t)
  }, [loadData])

  // ── KPI aggregates ────────────────────────────────────────────────────────

  const totalRevenue = daily.reduce((s, d) => s + (d.total_revenue ?? 0), 0)
  const totalOrders  = daily.reduce((s, d) => s + (d.total_orders  ?? 0), 0)
  const anomalyCount = daily.filter(d =>
    d.detection_method === 'confirmed_anomaly' || d.detection_method === 'possible_anomaly'
  ).length
  const dqScore = status?.data_quality_score != null
    ? `${status.data_quality_score.toFixed(1)}%`
    : null

  // ── Chart data ────────────────────────────────────────────────────────────

  const confirmed = daily.filter(d => d.detection_method === 'confirmed_anomaly')
  const possible  = daily.filter(d => d.detection_method === 'possible_anomaly')

  const mainTrace = {
    type: 'scatter',
    mode: 'lines',
    name: 'Daily Revenue',
    x: daily.map(d => dateStr(d.sale_date)),
    y: daily.map(d => d.total_revenue),
    line: { color: '#3b82f6', width: 1.8 },
    customdata: daily.map(d => [
      d.revenue_zscore != null ? d.revenue_zscore.toFixed(2) : 'N/A',
      d.detection_method ?? 'normal',
      d.anomaly_type ?? 'normal',
    ]),
    hovertemplate:
      '<b>%{x}</b><br>' +
      'Revenue: £%{y:,.0f}<br>' +
      'Z-Score: %{customdata[0]}<br>' +
      'Type: %{customdata[2]}<extra></extra>',
  }

  const confirmedTrace = {
    type: 'scatter',
    mode: 'markers',
    name: 'Confirmed',
    x: confirmed.map(d => dateStr(d.sale_date)),
    y: confirmed.map(d => d.total_revenue),
    marker: { color: '#ef4444', size: 10, symbol: 'circle', line: { color: '#fff', width: 1 } },
    customdata: confirmed.map(d => [
      d.revenue_zscore?.toFixed(2) ?? 'N/A',
      d.anomaly_type ?? '',
    ]),
    hovertemplate:
      '<b>%{x} — Confirmed</b><br>' +
      'Revenue: £%{y:,.0f}<br>' +
      'Z-Score: %{customdata[0]}<br>' +
      'Type: %{customdata[1]}<extra></extra>',
  }

  const possibleTrace = {
    type: 'scatter',
    mode: 'markers',
    name: 'Possible',
    x: possible.map(d => dateStr(d.sale_date)),
    y: possible.map(d => d.total_revenue),
    marker: { color: '#f59e0b', size: 9, symbol: 'diamond', line: { color: '#fff', width: 1 } },
    customdata: possible.map(d => [
      d.revenue_zscore?.toFixed(2) ?? 'N/A',
      d.anomaly_type ?? '',
    ]),
    hovertemplate:
      '<b>%{x} — Possible</b><br>' +
      'Revenue: £%{y:,.0f}<br>' +
      'Z-Score: %{customdata[0]}<br>' +
      'Type: %{customdata[1]}<extra></extra>',
  }

  const chartLayout = {
    title: {
      text: 'Daily Revenue with Anomaly Detection',
      font: { color: '#e2e8f0', size: 16 },
    },
    paper_bgcolor: '#1a1d27',
    plot_bgcolor:  '#1a1d27',
    font: { color: '#94a3b8', size: 12 },
    xaxis: { gridcolor: '#2d3148', title: 'Date', tickangle: -30 },
    yaxis: { gridcolor: '#2d3148', title: 'Revenue (£)', tickprefix: '£', tickformat: ',.0f' },
    legend: {
      bgcolor: '#21253a', bordercolor: '#2d3148', borderwidth: 1,
      font: { color: '#e2e8f0' },
      orientation: 'h', x: 0, y: 1.12,
    },
    hovermode: 'closest',
    margin: { l: 80, r: 20, t: 80, b: 60 },
  }

  // ── Anomaly table (all rows, newest first) ────────────────────────────────

  const tableRows = [...daily].reverse()

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiCard
          label="Total Revenue"
          value={fmtGBP(totalRevenue)}
          sub="All-time gross"
        />
        <KpiCard
          label="Total Orders"
          value={fmtNum(totalOrders)}
          sub="All-time invoices"
        />
        <KpiCard
          label="Anomalies Detected"
          value={anomalyCount}
          sub="Possible + Confirmed"
          accent={anomalyCount > 0 ? '#f59e0b' : '#22c55e'}
        />
        <KpiCard
          label="Data Quality Score"
          value={dqScore ?? (loading ? '…' : '—')}
          sub="Silver / Bronze rows"
          accent="#a855f7"
        />
      </div>

      {/* Revenue chart */}
      <div style={{
        background: '#1a1d27', border: '1px solid #2d3148',
        borderRadius: 12, marginBottom: 24, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            Loading chart…
          </div>
        ) : (
          <PlotWrapper
            data={[mainTrace, confirmedTrace, possibleTrace]}
            layout={chartLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: 420 }}
            useResizeHandler
          />
        )}
      </div>

      {/* Anomaly table */}
      <div style={{
        background: '#1a1d27', border: '1px solid #2d3148',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #2d3148',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600 }}>Anomaly Results</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{tableRows.length} days</span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: '#21253a' }}>
                {['Date', 'Revenue', 'Z-Score', 'Type', 'Top Product', 'Action'].map(col => (
                  <th key={col} style={{
                    padding: '10px 16px', textAlign: 'left',
                    color: '#64748b', fontWeight: 600,
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
                    borderBottom: '1px solid #2d3148',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                const dm   = row.detection_method ?? 'normal'
                const date = dateStr(row.sale_date)
                return (
                  <tr
                    key={i}
                    style={{ background: DM_BG[dm], borderBottom: '1px solid #2d3148', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#21253a'}
                    onMouseLeave={e => e.currentTarget.style.background = DM_BG[dm]}
                    onClick={() => setSelectedDate(date)}
                  >
                    <td style={{ padding: '10px 16px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                      {date}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#e2e8f0' }}>
                      {row.total_revenue != null ? `£${Number(row.total_revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                    </td>
                    <td style={{
                      padding: '10px 16px',
                      color: Math.abs(row.revenue_zscore ?? 0) > 2.5 ? '#ef4444' : '#94a3b8',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {row.revenue_zscore != null ? Number(row.revenue_zscore).toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <DetectionBadge value={dm} />
                    </td>
                    <td style={{ padding: '10px 16px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>
                      {row.top_product_that_day ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedDate(date) }}
                        style={{
                          background: 'transparent',
                          border: '1px solid #2d3148',
                          borderRadius: 6,
                          color: '#a855f7',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        Analyse →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SidePanel date={selectedDate} onClose={() => setSelectedDate(null)} />
    </div>
  )
}
