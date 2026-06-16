import axios from 'axios'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: 90_000,
})

export const fetchHealth         = ()     => http.get('/health')
export const fetchMetricsDaily   = ()     => http.get('/metrics/daily')
export const fetchAnomalies      = ()     => http.get('/anomalies')
export const fetchPipelineStatus = ()     => http.get('/pipeline/status')
export const fetchProducts       = ()     => http.get('/products')
export const fetchCustomers      = ()     => http.get('/customers')
export const analyzeDate         = (date) => http.post(`/analyze/${date}`)
