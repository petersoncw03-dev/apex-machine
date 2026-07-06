import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac } from 'crypto';

// O Mercado Pago envia notificações IPN/Webhook neste endpoint.
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks

/**
 * Valida a assinatura HMAC-SHA256 enviada pelo Mercado Pago no header x-signature.
 * Formato do header: ts=<timestamp>,v1=<hash>
 * O template de assinatura é: "id:<dataId>;request-id:<xRequestId>;ts:<ts>;"
 */
function validateMPSignature(
  req: Request,
  body: any,
  rawText: string
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  // Se não há secret configurado, pula a validação (não recomendado em produção)
  if (!secret) {
    console.warn('[MP Webhook] ⚠️ MP_WEBHOOK_SECRET não configurado — validação HMAC desativada.');
    return true;
  }

  const signatureHeader = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id') || '';

  if (!signatureHeader) {
    console.warn('[MP Webhook] Header x-signature ausente.');
    return false;
  }

  // Extrai ts e v1 do header
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.trim().split('=') as [string, string])
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) {
    console.warn('[MP Webhook] Header x-signature malformado.');
    return false;
  }

  const dataId = body?.data?.id || '';
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expectedHash = createHmac('sha256', secret).update(template).digest('hex');

  if (expectedHash !== v1) {
    console.error('[MP Webhook] ❌ Assinatura HMAC inválida! Possível tentativa de fraude.');
    return false;
  }

  return true;
}

export async function POST(req: Request) {
  try {
    const rawText = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ ok: true });
    }

    console.log('[MP Webhook] Notificação recebida:', JSON.stringify(body));

    // ── Validação de Assinatura HMAC ──────────────────────────────────────
    if (!validateMPSignature(req, body, rawText)) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
    }

    // O MP pode enviar vários tipos de notificação — só nos importa pagamento aprovado
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
