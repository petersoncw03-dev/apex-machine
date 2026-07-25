'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export function AuthRecoveryListener() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 1. Intercepta se o usuário cair em qualquer página com a Hash Fragment de recuperação
    if (typeof window !== 'undefined' && window.location.hash) {
      if (window.location.hash.includes('type=recovery')) {
        const currentHash = window.location.hash;
        if (!window.location.pathname.startsWith('/nova-senha')) {
          router.replace(`/nova-senha${currentHash}`);
          return;
        }
      }
    }

    // 2. Intercepta se o evento de Auth do Supabase for PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/nova-senha')) {
          router.replace('/nova-senha');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  return null;
}
