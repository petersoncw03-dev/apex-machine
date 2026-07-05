import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { priceId, days } = await req.json();

    console.log('[Stripe Checkout] priceId recebido:', priceId, '| days:', days);

    if (!priceId || !days) {
      return NextResponse.json({ error: 'ID do preço e quantidade de dias são obrigatórios' }, { status: 400 });
    }

    // Garante que o priceId é um ID real do Stripe, não uma chave pública (pk_live_...) 
    if (!priceId.startsWith('price_')) {
      console.error('[Stripe Checkout] priceId inválido recebido:', priceId);
      return NextResponse.json({ error: 'ID de preço inválido. Use um price_... válido do Stripe.' }, { status: 400 });
    }

    // Criar a sessão de checkout no Stripe
    // PIX exige: currency = 'brl' e mode = 'payment' (cobrança única)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'pix'],
      mode: 'payment',
      currency: 'brl',
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://apexmachine.com.br'}/painel-master?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://apexmachine.com.br'}/planos?canceled=true`,
      metadata: {
        userId: user.id, // Importante para sabermos quem pagou no Webhook
        days: days.toString(), // Enviamos os dias contratados para o Webhook ler
      }
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Erro no checkout do Stripe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
