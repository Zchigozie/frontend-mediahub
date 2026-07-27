import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' 
import { initThemeListener } from './store'

// Starts watching the OS's prefers-color-scheme setting so the site updates
// live whenever the phone/computer switches light/dark while the tab is
// already open and theme is set to 'system' — without this, the theme only
// ever gets checked once, on load.
initThemeListener()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)