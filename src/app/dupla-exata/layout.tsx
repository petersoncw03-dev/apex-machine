import { requireActivePlan } from '@/lib/auth-guard';

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireActivePlan();
  return <>{children}</>;
}

