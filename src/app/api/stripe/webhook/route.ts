import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event;

  try {
    // Valida se o webhook veio realmente do Stripe usando o segredo
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature falhou.', err.message);
    return NextResponse.json({ error: 'Assinatura Inválida' }, { status: 400 });
  }

  // Cliente de Admin do Supabase (ignora RLS) para atualizar a tabela Profiles
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const days = parseInt(session.metadata?.days || '30', 10);
        
        if (userId) {
          // Atualiza o perfil do usuário para Premium
          // Definimos a data de expiração para "days" no futuro, fixando às 23:59:59
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + days);
          expiresAt.setHours(23, 59, 59, 999);
          
          await supabaseAdmin
            .from('profiles')
            .update({ 
              plan: 'premium', 
              plan_expires_at: expiresAt.toISOString() 
            })
            .eq('id', userId);
            
          console.log(`[Stripe Webhook] Usuário ${userId} atualizado para PREMIUM por ${days} dias.`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        // Lógica opcional para quando a assinatura é cancelada / vence
        // Buscar o customer_id no banco e rebaixar para 'free'
        break;
      }
      default:
        console.log(`Evento Stripe não manipulado: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('Erro ao processar Webhook do Stripe:', error);
    return NextResponse.json({ error: 'Erro Interno' }, { status: 500 });
  }
}
