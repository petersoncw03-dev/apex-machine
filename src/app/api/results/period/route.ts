import { NextResponse, NextRequest } from 'next/server';
import { getResultsPeriodFromDB } from '@/lib/data-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '24', 10);
  const onlyWhites = searchParams.get('onlyWhites') === 'true';
  const compact = searchParams.get('compact') === 'true';

  // Tenta Postgres primeiro
  let data = await getResultsPeriodFromDB(hours, onlyWhites, compact);
  let source = 'postgres';

  // Se falhar, define data como array vazio
  if (!data || data.length === 0) {
    console.log('Postgres retornou vazio ou falhou...');
    data = [];
  }

  return NextResponse.json({ data, total: data.length, period_hours: hours, source });
}
