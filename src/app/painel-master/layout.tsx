import { requireActivePlan } from '@/lib/auth-guard';

/**
 * Layout do Painel Master.
 * A verificação de sessão e plano ativo é delegada ao helper centralizado
 * `requireActivePlan` (src/lib/auth-guard.ts), que:
 *   - Redireciona para /login se não houver sessão
 *   - Bypassa a checagem para o admin (peterson.cw@hotmail.com)
 *   - Redireciona para /planos se o plano for nulo, inativo ou expirado
 */
export default async function PainelMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActivePlan();

  return <>{children}</>;
}
