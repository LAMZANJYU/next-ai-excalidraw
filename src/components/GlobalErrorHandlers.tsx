'use client';

import { useEffect } from 'react';

export function GlobalErrorHandlers() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);

      event.preventDefault();
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);

      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
