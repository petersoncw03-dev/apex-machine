import { NextResponse, NextRequest } from 'next/server';
import { getResultsPeriodFromDB } from '@/lib/data-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '24', 10);
  const onlyWhites = searchParams.get('onlyWhites') === 'true';

  // Tenta Postgres primeiro
  let data = await getResultsPeriodFromDB(hours, onlyWhites);
  let source = 'postgres';

  // Se falhar, retorna erro
  if (!data || data.length === 0) {
    console.log('Postgres retornou vazio ou falhou...');
    return NextResponse.json({ error: 'Erro ao extrair dados do banco. Tente novamente ou reinicie a página.' }, { status: 500 });
  }

  return NextResponse.json({ data, total: data.length, period_hours: hours, source });
}
