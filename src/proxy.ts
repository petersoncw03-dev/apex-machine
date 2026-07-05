import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

/**
 * Next.js 16+ Proxy — substituto do middleware.ts (deprecated em v16.0.0).
 * Arquivo: src/proxy.ts | Exportado como named export `proxy`.
 * Documentação: node_modules/next/dist/docs/.../proxy.md
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Executa o proxy em todas as rotas EXCETO:
     * - Arquivos estáticos do Next.js (_next/static, _next/image)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Arquivos de mídia/fonte (svg, png, jpg, jpeg, gif, webp, ico, woff, woff2)
     * - Webhook do Mercado Pago (deve receber sem interferência de sessão)
     *
     * Rotas privadas protegidas dentro de updateSession (redirect → /login):
     *   /painel-master, /analista, /analista-simulador, /analise-pnl,
     *   /laboratorio, /laboratorio-minutos, /casa-exata, /casa-exata-teste,
     *   /dupla-exata, /analysis, /radar, /radar-chuva, /radar-rec,
     *   /backtester, /fabrica-ia, /meus-robos, /minutos-ia,
     *   /sinais, /grafico, /grid, /max-soro, /foco-na-cor, /sandbox
     *
     * Rotas públicas (sem proteção):
     *   /, /login, /planos, /termos, /privacidade, /api/mercadopago/webhook
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/mercadopago/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
