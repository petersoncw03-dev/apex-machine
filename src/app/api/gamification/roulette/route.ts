import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 1. Pegar perfil do usuario
    const { data: profile } = await supabase.from('profiles').select('last_roulette_spin, vip_until').eq('id', user.id).single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    const lastSpin = profile.last_roulette_spin ? new Date(profile.last_roulette_spin) : null;
    const now = new Date();

    // Verifica se já passou 24h
    if (lastSpin && (now.getTime() - lastSpin.getTime() < 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Você já girou a roleta nas últimas 24h. Volte amanhã!' }, { status: 400 });
    }

    // 2. Lógica de probabilidade Segura no Backend (Para evitar manipulação do F12)
    // 90% para tente outra vez (0)
    // 7% para 1 dia (1)
    // 2% para 2 dias (2)
    // 1% para 5 dias (5)
    const roll = Math.random() * 100;
    let prizeDays = 0;
    let prizeName = 'Tente no próximo dia';

    if (roll <= 1) { // 1%
      prizeDays = 5;
      prizeName = '5 Dias Premium';
    } else if (roll <= 3) { // 2% (de 1 a 3 = 2%)
      prizeDays = 2;
      prizeName = '2 Dias Premium';
    } else if (roll <= 10) { // 7% (de 3 a 10 = 7%)
      prizeDays = 1;
      prizeName = '1 Dia Premium';
    } else { // 90% (de 10 a 100)
      prizeDays = 0;
      prizeName = 'Tente no próximo dia';
    }

    // 3. Atualizar o banco
    const updates: any = { last_roulette_spin: now.toISOString() };

    if (prizeDays > 0) {
       let currentVip = profile.vip_until ? new Date(profile.vip_until) : new Date();
       if (currentVip < now) currentVip = now;
       currentVip.setDate(currentVip.getDate() + prizeDays);
       updates.vip_until = currentVip.toISOString();
    }

    await supabase.from('profiles').update(updates).eq('id', user.id);

    return NextResponse.json({ prizeDays, prizeName, success: true });
  } catch (error) {
    console.error('Roulette spin error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a roleta.' }, { status: 500 });
  }
}
