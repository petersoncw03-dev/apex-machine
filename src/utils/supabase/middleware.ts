import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Lista de rotas protegidas — todas as áreas que exigem login.
  // Rotas públicas: /, /login, /planos, /termos, /privacidade, /api/stripe/webhook
  const protectedRoutes = [
    '/painel-master',
    '/analista',
    '/analista-simulador',
    '/analise-pnl',
    '/laboratorio',
    '/laboratorio-minutos',
    '/casa-exata',
    '/casa-exata-teste',
    '/dupla-exata',
    '/analysis',
    '/radar',
    '/radar-chuva',
    '/radar-rec',
    '/backtester',
    '/fabrica-ia',
    '/meus-robos',
    '/minutos-ia',
    '/sinais',
    '/grafico',
    '/grid',
    '/max-soro',
    '/foco-na-cor',
    '/sandbox',
  ]
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  if (
    !user &&
    isProtectedRoute
  ) {
    // se usuário não está logado e tentou acessar rota protegida
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se o usuário ESTÁ logado e tentou ir para o login, redireciona pro dashboard
  if (user && request.nextUrl.pathname === '/login') {
     const url = request.nextUrl.clone()
     url.pathname = '/painel-master'
     return NextResponse.redirect(url)
  }

  return supabaseResponse
}
