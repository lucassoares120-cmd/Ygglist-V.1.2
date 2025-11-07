
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './modules/App.jsx'
import './styles/index.css'
import { startFaviconBreath } from './utils/faviconBreath.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Inicia a “respiração” do favicon (suave)
startFaviconBreath('/YggSymbol.png', 2400)

// Registra o Service Worker para PWA instalável
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
