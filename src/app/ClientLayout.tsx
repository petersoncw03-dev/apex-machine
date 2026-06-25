'use client';
import { SSEProvider } from '@/contexts/SSEContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <SSEProvider>{children}</SSEProvider>;
}
