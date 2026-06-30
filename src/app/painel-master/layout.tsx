import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function PainelMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verifica o plano do usuário no Supabase
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single();

  const isPremium = profile?.plan === 'premium';
  const isAdmin = user.email === 'peterson.cw@hotmail.com';
  
  // Verifica se a data atual é menor que a data de expiração (ou se é admin)
  const hasValidPlan = isAdmin || (isPremium && profile?.plan_expires_at && new Date(profile.plan_expires_at) > new Date());

  if (!hasValidPlan) {
    // Redireciona o usuário para a página de planos se ele for free ou expirado
    redirect('/planos');
  }

  return <>{children}</>;
}
