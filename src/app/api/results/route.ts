import { NextResponse, NextRequest } from 'next/server';
import { getResultsFromDB, getResultsFromSheets } from '@/lib/data-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '200', 10);

  // Tenta Postgres primeiro
  let data = await getResultsFromDB(limit);
  let source = 'postgres';

  // Se falhar ou estiver vazio
  if (!data || data.length === 0) {
    console.log('Postgres retornou vazio ou falhou...');
    data = [];
  }

  return NextResponse.json({ data, total: data.length, source });
}
