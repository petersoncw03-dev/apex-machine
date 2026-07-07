import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export function useVip() {
  const [isVip, setIsVip] = useState(false);
  const [loadingVip, setLoadingVip] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function checkVipStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsVip(false);
          setLoadingVip(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('plan, plan_expires_at')
          .eq('id', user.id)
          .single();

        if (error || !profile) {
          setIsVip(false);
          setLoadingVip(false);
          return;
        }

        // Verifica se o plano é premium e se ainda não expirou
        if (profile.plan === 'premium' && profile.plan_expires_at) {
          const expiresAt = new Date(profile.plan_expires_at).getTime();
          if (expiresAt > Date.now()) {
            setIsVip(true);
          } else {
            setIsVip(false);
          }
        } else {
          setIsVip(false);
        }
      } catch (err) {
        console.error('Erro ao verificar status VIP:', err);
        setIsVip(false);
      } finally {
        setLoadingVip(false);
      }
    }

    checkVipStatus();
  }, []);

  return { isVip, loadingVip };
}
