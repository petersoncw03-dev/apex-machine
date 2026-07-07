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

        const plan = (profile.plan || '').toLowerCase();
        
        // Verifica se o plano é premium
        if (plan === 'premium' || plan === 'vip') {
          if (profile.plan_expires_at) {
            // Tem data de expiração, verifica se ainda é válida
            const expiresAt = new Date(profile.plan_expires_at).getTime();
            if (expiresAt > Date.now()) {
              setIsVip(true);
            } else {
              setIsVip(false);
            }
          } else {
            // É premium mas sem data de expiração (vitalício / dev)
            setIsVip(true);
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
