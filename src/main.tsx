import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { RuntimeProvider } from './runtime/RuntimeContext'
import { defaultRuntimePort } from './adapters/runtime/defaultRuntimePort'
import './styles.css'

const root = document.getElementById('react-root')

if (!root) {
  throw new Error('React root element was not found')
}

if (!defaultRuntimePort.getInitialContext().isTauri) {
  document.body.classList.add('web-platform')
}

createRoot(root).render(
  <StrictMode>
    <RuntimeProvider>
      <App />
    </RuntimeProvider>
  </StrictMode>,
)
