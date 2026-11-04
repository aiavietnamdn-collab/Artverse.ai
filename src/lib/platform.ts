/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Platform Detection, API Endpoint Resolution & Multi-Platform URL Routing
 * Supports Website (Google Cloud Run), Installed PWA (iOS Safari / Chromium), and Capacitor iOS.
 */

import { Capacitor } from '@capacitor/core';
import { ScreenTab } from '../types/artverse';

export const APP_VERSION = '3.0.0';
export const APP_BUILD_ID = '2026.11.02-museum-editorial-r1';

/**
 * Clears outdated browser Cache Storage and forces Service Worker update when a new build is deployed.
 */
export async function ensureLatestBuildCache(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const STORAGE_KEY = 'artverse_active_build_id';
  try {
    const previousBuildId = window.localStorage.getItem(STORAGE_KEY);
    if (previousBuildId !== APP_BUILD_ID) {
      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => !name.includes('google-fonts'))
            .map((name) => window.caches.delete(name))
        );
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.update()));
      }
      window.localStorage.setItem(STORAGE_KEY, APP_BUILD_ID);
      return previousBuildId !== null;
    }
  } catch (err) {
    console.warn('Version cache check skipped:', err);
  }
  return false;
}

/**
 * Forces a full Service Worker unregistration, cache purge, and hard reload to fetch the newest deployment.
 */
export async function forceRefreshAppVersion(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    window.localStorage.setItem('artverse_active_build_id', APP_BUILD_ID);
  } catch (err) {
    console.warn('Force refresh cleanup error:', err);
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', `${Date.now()}`);
  window.location.replace(url.toString());
}

/**
 * Checks if the app is running inside a native Capacitor container (e.g. iOS WKWebView).
 */
export function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Checks if the app is running in standalone installed PWA mode (iOS Home Screen or Chromium PWA).
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    isCapacitorNative()
  );
}

/**
 * Checks if the current device is an iPhone, iPad, or iPod running iOS.
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isTouchMac =
    ua.includes('macintosh') && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(ua) || isTouchMac;
}

/**
 * Resolves backend API URLs across Website (same-origin) and Capacitor iOS (remote Cloud Run origin).
 * No secret keys are ever stored in the frontend; Capacitor calls the Cloud Run backend configured via VITE_API_BASE_URL.
 */
export function getApiUrl(endpointPath: string): string {
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

  if (configuredBaseUrl) {
    return `${configuredBaseUrl}${normalizedPath}`;
  }

  return normalizedPath;
}

const PATH_TO_TAB: Record<string, ScreenTab> = {
  '/': 'discover',
  '/discover': 'discover',
  '/trang-chu': 'discover',
  '/kham-pha': 'discover',
  '/gallery': 'community-library',
  '/trien-lam': 'community-library',
  '/community-library': 'community-library',
  '/shorts': 'artverse-shorts',
  '/artverse-shorts': 'artverse-shorts',
  '/stories': 'art-stories',
  '/cau-chuyen': 'art-stories',
  '/art-stories': 'art-stories',
  '/gdpt': 'class-lessons',
  '/mi-thuat-gdpt': 'class-lessons',
  '/classes': 'class-lessons',
  '/lop-hoc': 'class-lessons',
  '/class-lessons': 'class-lessons',
  '/upload': 'upload-hub',
  '/dang-tai': 'upload-hub',
  '/upload-hub': 'upload-hub',
  '/profile': 'profile-manage',
  '/ho-so': 'profile-manage',
  '/ca-nhan': 'profile-manage',
  '/profile-manage': 'profile-manage',
  '/management': 'management-tools',
  '/cong-cu-quan-ly': 'management-tools',
  '/management-tools': 'management-tools',
  '/admin': 'system-admin',
  '/quan-tri-he-thong': 'system-admin',
  '/system-admin': 'system-admin',
  '/ai-chat': 'ai-chatbox',
  '/ai-chatbox': 'ai-chatbox',
  '/moderation': 'moderation',
  '/kiem-duyet': 'moderation',
  '/safety-audit': 'safety-audit',
  '/bao-mat': 'safety-audit',
  '/storage-center': 'storage-center',
  '/luu-tru': 'storage-center',
};

const TAB_TO_PATH: Record<string, string> = {
  discover: '/',
  'community-library': '/gallery',
  library: '/gallery',
  'artverse-shorts': '/shorts',
  'art-stories': '/stories',
  'class-lessons': '/gdpt',
  'upload-hub': '/upload',
  'profile-manage': '/profile',
  'management-tools': '/management',
  'system-admin': '/admin',
  'ai-chatbox': '/ai-chat',
  moderation: '/moderation',
  'safety-audit': '/safety-audit',
  'storage-center': '/storage-center',
};

/**
 * Reads the initial active ScreenTab from the current URL pathname, query param (?tab=), or QR hash (#gallery?token=).
 */
export function getInitialTabFromUrl(): ScreenTab {
  if (typeof window === 'undefined') return 'discover';

  const hash = window.location.hash || '';
  if (hash.startsWith('#gallery') || hash.includes('token=')) {
    return 'community-library';
  }

  const params = new URLSearchParams(window.location.search);
  const queryTab = params.get('tab');
  if (queryTab && TAB_TO_PATH[queryTab]) {
    return queryTab as ScreenTab;
  }

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  return PATH_TO_TAB[pathname] || 'discover';
}

/**
 * Updates the browser URL cleanly when switching tabs without triggering a full page reload,
 * while preserving Capacitor file/scheme compatibility and QR share hashes.
 */
export function syncUrlWithTab(tab: ScreenTab): void {
  if (typeof window === 'undefined') return;
  if (isCapacitorNative()) return; // Keep root path inside native WKWebView

  const targetPath = TAB_TO_PATH[tab] || '/';
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

  // Preserve QR share token hash if viewing gallery
  const hash = window.location.hash || '';
  const keepHash = (tab === 'community-library' || tab === 'library') && hash.includes('token=') ? hash : '';

  if (currentPath !== targetPath) {
    try {
      window.history.pushState({ tab }, '', `${targetPath}${keepHash}`);
    } catch {
      // Ignore history errors in restricted sandboxed environments
    }
  }
}
