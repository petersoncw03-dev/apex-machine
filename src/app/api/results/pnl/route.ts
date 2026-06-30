import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const { rows } = await query(`
      SELECT 
        to_char(day, 'YYYY-MM-DD') as day, 
        total_wagered, 
        total_winnings, 
        net_profit, 
        rounds 
      FROM daily_pnl 
      ORDER BY day DESC
    `);
    
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('Erro ao buscar PnL:', error);
    return NextResponse.json({ error: 'Erro ao extrair PnL do banco.' }, { status: 500 });
  }
}
