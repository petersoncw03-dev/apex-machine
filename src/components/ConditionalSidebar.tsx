'use client';

import { usePathname } from 'next/navigation';
import SidebarNav from './SidebarNav';

export default function ConditionalSidebar() {
  const pathname = usePathname();

  // Esconde a sidebar na página de venda (/) e de login (/login)
  if (pathname === '/' || pathname === '/login') {
    return null;
  }

  return <SidebarNav />;
}
