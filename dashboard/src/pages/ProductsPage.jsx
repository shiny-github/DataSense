import { useState, useEffect } from 'react'
import PlotWrapper from '../components/PlotWrapper'
import { fetchProducts } from '../api'

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    fetchProducts()
      .then(r => setProducts(r.data.products || []))
      .catch(e => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Placeholder>Loading products…</Placeholder>
  if (error)   return <Placeholder error>{error}</Placeholder>
  if (!products.length) return <Placeholder>No product data available.</Placeholder>

  // Sort ascending so highest-revenue product appears at top (Plotly renders bottom→top)
  const sorted = [...products].sort((a, b) => a.total_revenue - b.total_revenue)
  const labels = sorted.map(p => {
    const desc = (p.description || '').substring(0, 32)
    return `${desc} (${p.stock_code})`
  })
  const values = sorted.map(p => p.total_revenue)

  const trace = {
    type: 'bar',
    orientation: 'h',
    x: values,
    y: labels,
    marker: {
      color: values,
      colorscale: [[0, '#3b82f6'], [1, '#a855f7']],
      showscale: false,
    },
    hovertemplate: '<b>%{y}</b><br>Revenue: £%{x:,.0f}<extra></extra>',
  }

  const layout = {
    title: { text: 'Top 20 Products by Lifetime Revenue', font: { color: '#e2e8f0', size: 16 } },
    paper_bgcolor: '#1a1d27',
    plot_bgcolor: '#1a1d27',
    font: { color: '#94a3b8' },
    xaxis: { gridcolor: '#2d3148', title: 'Total Revenue (£)', tickprefix: '£', tickformat: ',.0f' },
    yaxis: { gridcolor: 'transparent', automargin: true, tickfont: { size: 11 } },
    margin: { l: 320, r: 30, t: 50, b: 60 },
  }

  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, overflow: 'hidden' }}>
      <PlotWrapper
        data={[trace]}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: 640 }}
        useResizeHandler
      />
    </div>
  )
}

function Placeholder({ children, error }) {
  return (
    <div style={{ padding: 40, color: error ? '#ef4444' : '#94a3b8', fontSize: 14 }}>
      {children}
    </div>
  )
}
