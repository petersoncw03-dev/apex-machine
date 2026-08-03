import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!q.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }

    const searchPattern = `%${q.trim()}%`;
    const sql = `
      SELECT id, name, total_bets_count, wins_count, losses_count, 
             total_invested, total_won, total_pnl, win_rate, updated_at
      FROM players
      WHERE name ILIKE $1 OR id ILIKE $1
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $2
    `;

    const res = await query(sql, [searchPattern, limit]);

    const data = res.rows.map((p: any) => ({
      id: p.id,
      name: p.name || 'Jogador Anônimo',
      total_bets_count: Number(p.total_bets_count || 0),
      wins_count: Number(p.wins_count || 0),
      losses_count: Number(p.losses_count || 0),
      total_invested: Number(p.total_invested || 0),
      total_won: Number(p.total_won || 0),
      total_pnl: Number(p.total_pnl || 0),
      win_rate: Number(p.win_rate || 0),
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : null
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: true, data: [] });
  }
}
