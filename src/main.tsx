import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// `/react`, not `/next` — this app is a Vite SPA. The Next entry point pulls in
// next/navigation and will not resolve here.
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
);

// Register Service Worker for PWA offline support and home screen installability
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.debug('ServiceWorker registration omitted:', err));
  });
}
