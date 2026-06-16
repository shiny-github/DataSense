import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import CustomersPage from './pages/CustomersPage'
import { fetchHealth } from './api'

const TAB_STYLE = ({ isActive }) => ({
  padding: '12px 24px',
  color: isActive ? '#a855f7' : '#94a3b8',
  textDecoration: 'none',
  borderBottom: isActive ? '2px solid #a855f7' : '2px solid transparent',
  fontSize: 14,
  fontWeight: isActive ? 600 : 400,
  transition: 'color 0.15s',
  whiteSpace: 'nowrap',
})

export default function App() {
  const [health, setHealth]           = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    const check = async () => {
      try {
        await fetchHealth()
        setHealth('ok')
      } catch {
        setHealth('error')
      }
      setLastUpdated(new Date())
    }
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <BrowserRouter>
      <div style={{
        minHeight: '100vh',
        background: '#0f1117',
        color: '#e2e8f0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}>
        <Navbar health={health} lastUpdated={lastUpdated} />

        <nav style={{
          display: 'flex',
          background: '#1a1d27',
          borderBottom: '1px solid #2d3148',
          overflowX: 'auto',
        }}>
          <NavLink to="/"          end   style={TAB_STYLE}>Overview</NavLink>
          <NavLink to="/products"        style={TAB_STYLE}>Products</NavLink>
          <NavLink to="/customers"       style={TAB_STYLE}>Customers</NavLink>
        </nav>

        <main style={{ padding: '24px', maxWidth: 1440, margin: '0 auto' }}>
          <Routes>
            <Route path="/"          element={<HomePage />} />
            <Route path="/products"  element={<ProductsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
