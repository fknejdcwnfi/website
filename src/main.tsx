import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import SiteBoundary from './components/SiteBoundary'
import './styles.css'
import './styles/site.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in index.html')
const fallbackHtml = root.innerHTML

createRoot(root).render(
  <StrictMode>
    <SiteBoundary fallbackHtml={fallbackHtml}><App /></SiteBoundary>
  </StrictMode>,
)
