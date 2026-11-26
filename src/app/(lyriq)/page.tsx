'use client';

import dynamic from 'next/dynamic';
import { StrictMode, useEffect } from 'react';
import ErrorBoundary from '@/lyriq/components/ErrorBoundary';

// The editor uses IndexedDB, AudioContext and the microphone at load, so it only runs in the browser.
const LyriqApp = dynamic(() => import('@/lyriq/App'), { ssr: false });

export default function Page() {
  // Cache the app shell so the installed app still opens offline (songs already live in IndexedDB).
  // Production only: in dev the worker would serve stale bundles.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  }, []);

  return (
    <StrictMode>
      <ErrorBoundary>
        <LyriqApp />
      </ErrorBoundary>
    </StrictMode>
  );
}
