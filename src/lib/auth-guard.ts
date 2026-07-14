/**
 * auth-guard.ts
 *
 * Helper server-side centralizado para verificação de autenticação e plano ativo.
 * Usado por layouts de rotas privadas — NÃO altera o proxy.ts.
 *
 * Tabela lida no Supabase: `profiles`
 * Colunas verificadas:
 *   - `id`              UUID — vinculado ao auth.users.id
 *   - `plan`            TEXT — valor esperado: 'premium' para acesso liberado
 *   - `plan_expires_at` TIMESTAMPTZ — data/hora de expiração do plano
 *
 * Regras:
 *   1. Usuário não logado → redirect /login
 *   2. Admin (email hardcoded) → passa direto (acesso vitalício)
 *   3. plan = 'premium' E plan_expires_at > now() → passa
 *   4. Qualquer outro caso (free, null, expirado) → redirect /planos
 */

import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** E-mail do administrador com acesso vitalício (bypass de pagamento). */
const ADMIN_EMAIL = 'peterson.cw@hotmail.com';

export async function requireActivePlan(): Promise<void> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Layout Server Component: leitura de cookies apenas (sem set/remove)
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  // 1. Verificar sessão ativa
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Bypass imediato para o admin
  if (user.email === ADMIN_EMAIL) {
    return;
  }

  // 3. Buscar perfil na tabela `profiles`
  //    Colunas: plan (TEXT), plan_expires_at (TIMESTAMPTZ)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single();

  if (error) {
    // Se não encontrar o perfil, trata como sem plano
    console.error('[auth-guard] Erro ao buscar profile:', error.message);
    redirect('/planos');
  }

  const isPremium = profile?.plan === 'premium';
  const hasExpiry = !!profile?.plan_expires_at;
  const isNotExpired =
    hasExpiry && (new Date(profile.plan_expires_at).getTime() + 3 * 60 * 60 * 1000) > Date.now();

  // 4. Verificar plano válido e não expirado
  const hasValidPlan = isPremium && isNotExpired;

  if (!hasValidPlan) {
    redirect('/planos');
  }

  // Plano ativo — permite o acesso
}
