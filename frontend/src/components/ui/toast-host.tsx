'use client';

import { Toaster } from 'sonner';

export function ToastHost() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#0A0C18',
          border: '1px solid rgba(240,198,106,0.18)',
          color: '#EAEEFB',
          fontSize: '13px',
          borderRadius: '12px',
        },
      }}
      duration={3000}
    />
  );
}
