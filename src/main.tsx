import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import SiteBoundary from './app/SiteBoundary'
import { retainBootstrapVideo } from './features/referenceScene/bootstrapVideo'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in index.html')
const fallbackHtml = root.innerHTML
retainBootstrapVideo()

createRoot(root).render(
  <StrictMode>
    <SiteBoundary fallbackHtml={fallbackHtml}><App /></SiteBoundary>
  </StrictMode>,
)

document.documentElement.setAttribute('data-site-module', 'ready')
window.dispatchEvent(new Event('site-module-ready'))
