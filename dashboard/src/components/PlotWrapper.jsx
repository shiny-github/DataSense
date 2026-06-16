import { lazy, Suspense } from 'react'

// Lazy-load plotly so a CJS/ESM parse failure never crashes the initial render.
// Every <PlotWrapper> shows its own inline spinner while the chunk loads.
const Plot = lazy(() => import('react-plotly.js'))

export default function PlotWrapper({ style, ...props }) {
  const height = style?.height ?? 400

  return (
    <Suspense
      fallback={
        <div style={{
          height,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#64748b', fontSize: 14,
        }}>
          Loading chart…
        </div>
      }
    >
      <Plot style={style} {...props} />
    </Suspense>
  )
}
