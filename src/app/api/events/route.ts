import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * NOTA DE ARQUITETURA SERVERLESS:
 * Conexões SSE (Server-Sent Events) contínuas em funções Serverless da Vercel
 * causam retenção de instâncias 24/7, estourando rapidamente as cotas de
 * Fluid Provisioned Memory e Active CPU.
 * 
 * Por isso, a escuta de eventos via SSE foi migrada para o microserviço
 * independente na VPS (vps-events-service).
 * 
 * O cliente frontend se conecta diretamente:
 * 1. Ao WebSocket direto da Blaze (wss://api-gaming.blaze.bet.br/...)
 * 2. Ao SSE da VPS caso NEXT_PUBLIC_VPS_URL esteja definido.
 */
export async function GET() {
  const vpsUrl = process.env.NEXT_PUBLIC_VPS_URL || process.env.VPS_EVENTS_URL;

  if (vpsUrl) {
    const target = `${vpsUrl.replace(/\/$/, '')}/api/events`;
    return NextResponse.redirect(target, 307);
  }

  return NextResponse.json({
    status: 'notice',
    message: 'O SSE contínuo da Vercel foi desativado para evitar estouro de memória e CPU. O cliente utiliza conexão WebSocket direta com a Blaze e/ou o microserviço VPS (NEXT_PUBLIC_VPS_URL).',
  });
}

