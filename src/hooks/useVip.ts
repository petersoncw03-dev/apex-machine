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

        // Whitelist do Admin - Nunca bloquear
        if (user.email === 'peterson.cw@hotmail.com') {
          setIsVip(true);
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
            // Adicionamos +3 horas de tolerância (offset do Brasil)
            // para evitar que 23:59 UTC bloqueie o cliente as 20:59 no horário local
            const expiresAt = new Date(profile.plan_expires_at).getTime() + (3 * 60 * 60 * 1000);
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
