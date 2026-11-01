import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { isCapacitorNative, ensureLatestBuildCache } from './lib/platform.ts';
import './index.css';

// Verify build version and purge outdated caches automatically on new deployments
ensureLatestBuildCache();

// Register safe PWA Service Worker in Production on Website & Mobile Safari/Chromium
if (!isCapacitorNative() && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateSW(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          registration.update();
          // Also check for updates whenever the user returns to the app tab / PWA
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              registration.update();
            }
          });
        }
      },
      onRegisterError(error) {
        console.warn('PWA Service Worker registration skipped:', error);
      },
    });
  } else {
    // In development mode, unregister any leftover dev service workers so live edits are never cached
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);


