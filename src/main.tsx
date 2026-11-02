import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './global.css'
import App from './AdminApp.tsx'
import SuccessToast from './SuccessToast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <SuccessToast />
  </StrictMode>,
)
