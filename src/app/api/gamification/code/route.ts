import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Código vazio' }, { status: 400 });

    const upperCode = code.toUpperCase().trim();

    // 1. Pega cupom
    const { data: coupon, error: couponError } = await supabase.from('coupons').select('*').eq('code', upperCode).single();
    if (couponError || !coupon) return NextResponse.json({ error: 'Código inválido ou inexistente.' }, { status: 404 });
    
    if (!coupon.is_active || coupon.current_uses >= coupon.max_uses) {
      return NextResponse.json({ error: 'Este código já expirou ou atingiu o limite de usos.' }, { status: 400 });
    }

    // 2. Checa se o usuário já usou
    const { data: alreadyUsed } = await supabase.from('user_coupons').select('*').eq('user_id', user.id).eq('coupon_id', coupon.id).single();
    if (alreadyUsed) return NextResponse.json({ error: 'Você já utilizou este código anteriormente.' }, { status: 400 });

    // 3. Aplica o tempo VIP
    const { data: profile } = await supabase.from('profiles').select('vip_until').eq('id', user.id).single();
    let currentVip = profile?.vip_until ? new Date(profile.vip_until) : new Date();
    const now = new Date();
    if (currentVip < now) currentVip = now;
    
    currentVip.setDate(currentVip.getDate() + coupon.vip_days);

    await supabase.from('profiles').update({ vip_until: currentVip.toISOString() }).eq('id', user.id);
    
    // 4. Atualiza limite do cupom
    const newUses = coupon.current_uses + 1;
    const updates: any = { current_uses: newUses };
    if (newUses >= coupon.max_uses) updates.is_active = false; // "Acabou, acabou"
    
    await supabase.from('coupons').update(updates).eq('id', coupon.id);
    
    // 5. Registra o uso
    await supabase.from('user_coupons').insert({ user_id: user.id, coupon_id: coupon.id });

    return NextResponse.json({ success: true, message: `Código aplicado com sucesso! +${coupon.vip_days} dias Premium liberados.` });
  } catch (error) {
    console.error('Code redeem error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar o código.' }, { status: 500 });
  }
}
