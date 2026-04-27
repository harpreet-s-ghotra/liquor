import './assets/main.css'
import './lib/logger'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CustomerDisplay } from './pages/CustomerDisplay'

const params = new URLSearchParams(window.location.search)
const isCustomerDisplay = params.get('display') === 'customer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isCustomerDisplay ? <CustomerDisplay /> : <App />}</StrictMode>
)
