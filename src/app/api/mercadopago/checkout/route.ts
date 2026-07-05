import { NextResponse } from 'next/server';
import { mpClient } from '@/lib/mercadopago';
import { Preference } from 'mercadopago';
import { createServerClient } from '@supabase/ssr';
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
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
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
          // Habilita Pix, Cartão e Google Pay nativamente
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
        // Expiração da preferência: 24 horas
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    return NextResponse.json({ url: response.init_point });
  } catch (error: any) {
    console.error('[MP Checkout] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
