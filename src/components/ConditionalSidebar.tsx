'use client';

import { usePathname } from 'next/navigation';
import SidebarNav from './SidebarNav';

export default function ConditionalSidebar() {
  const pathname = usePathname();

  // Esconde a sidebar na página de login (/)
  if (pathname === '/') {
    return null;
  }

  return <SidebarNav />;
}
