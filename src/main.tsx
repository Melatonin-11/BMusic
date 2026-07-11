import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite HMR WebSocket connection errors in sandbox container
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && (
      (typeof reason === 'string' && (reason.toLowerCase().includes('websocket') || reason.toLowerCase().includes('vite'))) ||
      (reason.message && (reason.message.toLowerCase().includes('websocket') || reason.message.toLowerCase().includes('vite')))
    )) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const message = event.message;
    if (message && (message.toLowerCase().includes('websocket') || message.toLowerCase().includes('vite'))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
