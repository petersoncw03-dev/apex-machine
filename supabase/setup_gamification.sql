-- 1. Tabela de Cupons/Códigos de Cadastro
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  vip_days INTEGER NOT NULL DEFAULT 1,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela para evitar que o mesmo usuário use o mesmo cupom duas vezes
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, coupon_id)
);

-- 3. Coluna no Profiles para rastrear a Roleta Diária
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_roulette_spin TIMESTAMP WITH TIME ZONE;
