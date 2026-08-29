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

// Register Service Worker for PWA offline support and home screen installability.
//
// Production only. The worker is network-first, so in dev it caches every
// HMR module URL for no benefit — and it makes debugging actively misleading:
// a stale registration keeps serving alongside a hot-reloaded module graph,
// and transient "used outside its Provider" errors thrown while HMR swaps a
// context module pile up in the console looking exactly like a real bug.
if ('serviceWorker' in navigator && import.meta.env.PROD && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.debug('ServiceWorker registration omitted:', err));
  });
}
