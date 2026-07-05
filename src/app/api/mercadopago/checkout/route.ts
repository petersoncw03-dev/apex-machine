import { NextResponse } from 'next/server';
import { mpClient } from '@/lib/mercadopago';
import { Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Mapa de planos: days -> { title, price }
const PLANS: Record<number, { title: string; price: number }> = {
  1:  { title: 'Passe Diário – Apex Machine',      price: 5  },
  7:  { title: 'Acesso Semanal – Apex Machine',     price: 15 },
  15: { title: 'Acesso Quinzenal – Apex Machine',   price: 35 },
  30: { title: 'Passe Apex Mensal – Apex Machine',  price: 50 },
};

export async function POST(req: Request) {
  try {
    // Usamos o service role para validar o token JWT sem sofrer bloqueio de RLS.
    // O access token do usuário é lido diretamente do cookie de sessão do Supabase.
    const cookieStore = await cookies();

    // O Supabase armazena a sessão como JSON em um cookie chamado sb-<project_ref>-auth-token
    // Tentamos extrair o access_token de qualquer cookie de sessão presente
    let accessToken: string | undefined;
    for (const [name, cookie] of Object.entries(Object.fromEntries(
      cookieStore.getAll().map(c => [c.name, c.value])
    ))) {
      if (name.includes('-auth-token') && !name.includes('.')) {
        try {
          const parsed = JSON.parse(decodeURIComponent(cookie));
          if (parsed?.access_token) {
            accessToken = parsed.access_token;
            break;
          }
        } catch {}
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // Valida o token via service role — ignora RLS, sem queries à tabela profiles
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('[MP Checkout] Token inválido:', authError?.message);
      return NextResponse.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const { days } = await req.json();
    const plan = PLANS[days as number];

    if (!plan) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://apexmachine.com.br';

    const preference = new Preference(mpClient);
    const response = await preference.create({
      body: {
        items: [
          {
            id: `apex-${days}d`,
            title: plan.title,
            quantity: 1,
            unit_price: plan.price,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: user.email,
        },
        payment_methods: {
          excluded_payment_types: [],
        },
        back_urls: {
          success: `${siteUrl}/painel-master?success=true`,
          failure: `${siteUrl}/planos?canceled=true`,
          pending: `${siteUrl}/planos?pending=true`,
        },
        auto_return: 'approved',
        notification_url: `${siteUrl}/api/mercadopago/webhook`,
        metadata: {
          user_id: user.id,
          days: days.toString(),
        },
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    console.log(`[MP Checkout] Preference criada para ${user.email} — ${days} dias`);
    return NextResponse.json({ url: response.init_point });
  } catch (error: any) {
    console.error('[MP Checkout] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
