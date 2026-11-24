'use client';

import dynamic from 'next/dynamic';
import { StrictMode } from 'react';
import ErrorBoundary from '@/lyriq/components/ErrorBoundary';

// The editor uses IndexedDB, AudioContext and the microphone at load, so it only runs in the browser.
const LyriqApp = dynamic(() => import('@/lyriq/App'), { ssr: false });

export default function Page() {
  return (
    <StrictMode>
      <ErrorBoundary>
        <LyriqApp />
      </ErrorBoundary>
    </StrictMode>
  );
}
