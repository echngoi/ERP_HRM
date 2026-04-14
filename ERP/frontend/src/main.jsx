import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'
import App from './App.jsx'

// Global: add loading="lazy" to all avatar images for performance
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      const imgs = node.matches?.('img') ? [node] : node.querySelectorAll?.('img') || [];
      for (const img of imgs) {
        if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      }
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
