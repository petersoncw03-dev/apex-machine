import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// O Mercado Pago envia notificações IPN/Webhook neste endpoint.
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log('[MP Webhook] Notificação recebida:', JSON.stringify(body));

    // O MP pode enviar vários tipos de notificação — só nos importa pagamento aprovado
    const topic = body.type || body.topic;
    const resourceId = body.data?.id || body.id;

    if (!resourceId) {
      return NextResponse.json({ ok: true }); // Ignora pings sem ID
    }

    // Consulta o pagamento na API do MP para confirmar status (nunca confie no body cego)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
    });

    if (!mpRes.ok) {
      console.warn('[MP Webhook] Não conseguiu buscar pagamento:', resourceId);
      return NextResponse.json({ ok: true });
    }

    const payment = await mpRes.json();

    console.log('[MP Webhook] Status do pagamento:', payment.status, '| ID:', resourceId);

    // Só processa se o pagamento foi APROVADO
    if (payment.status !== 'approved') {
      return NextResponse.json({ ok: true });
    }

    // Lê os metadados que enviamos na criação da Preference
    const userId = payment.metadata?.user_id;
    const days = parseInt(payment.metadata?.days || '30', 10);

    if (!userId) {
      console.error('[MP Webhook] user_id não encontrado nos metadados do pagamento:', resourceId);
      return NextResponse.json({ ok: true });
    }

    // Atualiza o plano do usuário no Supabase
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    expiresAt.setHours(23, 59, 59, 999);

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        plan: 'premium',
        plan_expires_at: expiresAt.toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[MP Webhook] Erro ao atualizar Supabase:', error.message);
    } else {
      console.log(`[MP Webhook] ✅ Usuário ${userId} → PREMIUM por ${days} dias (expira ${expiresAt.toISOString()})`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[MP Webhook] Erro interno:', err.message);
    // Retorna 200 para o MP não ficar re-tentando em loop
    return NextResponse.json({ ok: true });
  }
}

// Necessário para o MP poder enviar POST sem CSRF
export async function GET() {
  return NextResponse.json({ status: 'MP Webhook ativo' });
}
