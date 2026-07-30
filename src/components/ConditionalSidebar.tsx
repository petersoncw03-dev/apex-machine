'use client';

import { usePathname } from 'next/navigation';
import SidebarNav from './SidebarNav';

export default function ConditionalSidebar() {
  const pathname = usePathname();

  // Esconde a sidebar na página de venda (/), login (/login) e /test-vendas
  if (pathname === '/' || pathname === '/login' || pathname === '/test-vendas') {
    return null;
  }

  return <SidebarNav />;
}
