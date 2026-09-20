import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

import { ErrorBoundary } from './components/ErrorBoundary';

// Browser preview only: stub Tauri IPC so `npm run dev` renders in a normal
// browser. Statically dropped from production builds, and it refuses to install
// when the real Tauri internals are present.
if (import.meta.env.DEV) {
  const { installBrowserIpcShim } = await import('./dev/browserIpcShim');
  installBrowserIpcShim();
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
