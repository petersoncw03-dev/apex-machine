'use client';
import { SSEProvider } from '@/contexts/SSEContext';
import { AuthRecoveryListener } from '@/components/auth/AuthRecoveryListener';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SSEProvider>
      <AuthRecoveryListener />
      {children}
    </SSEProvider>
  );
}

