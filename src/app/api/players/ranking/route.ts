import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'pnl';
    const order = (searchParams.get('order') || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const days = parseInt(searchParams.get('days') || '0', 10);
    const colorParam = (searchParams.get('color') || 'all').toLowerCase();
    const searchQuery = (searchParams.get('q') || searchParams.get('name') || '').trim();

    let orderByCol = 'total_pnl';
    if (sort === 'wins') orderByCol = 'wins_count';
    else if (sort === 'invested') orderByCol = 'total_invested';
    else if (sort === 'win_rate') orderByCol = 'win_rate';

    let sql = '';
    let params: any[] = [];

    // Cláusula de filtro por cor
    let colorFilter = '';
    if (colorParam === 'branco') {
      colorFilter = "AND color = 'BRANCO'";
    } else if (colorParam === 'vermelho') {
      colorFilter = "AND color = 'VERMELHO'";
    } else if (colorParam === 'preto') {
      colorFilter = "AND color = 'PRETO'";
    } else if (colorParam === 'cores') {
      colorFilter = "AND color IN ('VERMELHO', 'PRETO')";
    }

    let searchFilter = '';
    if (searchQuery) {
      const sanitized = searchQuery.replace(/'/g, "''");
      searchFilter = `AND (user_name ILIKE '%${sanitized}%' OR user_id ILIKE '%${sanitized}%')`;
    }

    if (days > 0 || colorParam !== 'all' || searchQuery) {
      const daysInterval = days > 0 ? `timestamp >= NOW() - INTERVAL '${days} days'` : `1=1`;
      sql = `
        SELECT 
            user_id as id,
            user_name as name,
            COUNT(*) as total_bets_count,
            COUNT(CASE WHEN status = 'WIN' THEN 1 END) as wins_count,
            COUNT(CASE WHEN status = 'LOSS' THEN 1 END) as losses_count,
            COUNT(CASE WHEN color = 'BRANCO' AND status = 'WIN' THEN 1 END) as brancos_hits,
            COALESCE(SUM(amount), 0) as total_invested,
            COALESCE(SUM(payout), 0) as total_won,
            COALESCE(SUM(pnl), 0) as total_pnl,
            ROUND((COUNT(CASE WHEN status = 'WIN' THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) as win_rate,
            MAX(timestamp) as updated_at
        FROM player_bets
        WHERE ${daysInterval} ${colorFilter} ${searchFilter}
        GROUP BY user_id, user_name
        ORDER BY ${orderByCol} ${order}
        LIMIT $1
      `;
      params = [limit];
    } else {
      sql = `
        SELECT id, name, total_bets_count, wins_count, losses_count, 
               total_invested, total_won, total_pnl, win_rate, updated_at
        FROM players
        ORDER BY ${orderByCol} ${order}
        LIMIT $1
      `;
      params = [limit];
    }

    const res = await query(sql, params);

    let data = res.rows.map((p: any) => ({
      id: String(p.id),
      name: p.name || 'Jogador Anônimo',
      total_bets_count: Number(p.total_bets_count || 0),
      wins_count: Number(p.wins_count || 0),
      losses_count: Number(p.losses_count || 0),
      brancos_hits: Number(p.brancos_hits || 0),
      total_invested: Number(p.total_invested || 0),
      total_won: Number(p.total_won || 0),
      total_pnl: Number(p.total_pnl || 0),
      win_rate: Number(p.win_rate || 0),
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : null
    }));

    // Se estiver filtrando por busca ou por número de dias específico, retorna estritamente os dados reais do banco sem forçar mocks de datas passadas
    if (searchQuery || days > 0) {
      return NextResponse.json({ success: true, data });
    }

    const baseMocks = [
      { id: "96rXVKwkON", name: "EriPróspero", total_bets_count: 102, wins_count: 5, losses_count: 97, brancos_hits: 0, total_invested: 5548.33, total_won: 3430.00, total_pnl: -2118.33, win_rate: 4.9, updated_at: new Date().toISOString() },
      { id: "kL82mA9pXq", name: "Matheus Silva", total_bets_count: 120, wins_count: 79, losses_count: 41, brancos_hits: 9, total_invested: 19500.00, total_won: 38200.00, total_pnl: 18700.00, win_rate: 65.8, updated_at: new Date().toISOString() },
      { id: "mP71vB2nRt", name: "Lucas Rocha", total_bets_count: 95, wins_count: 62, losses_count: 33, brancos_hits: 7, total_invested: 15000.00, total_won: 31400.00, total_pnl: 16400.00, win_rate: 65.2, updated_at: new Date().toISOString() },
      { id: "X92kLpM1nQ", name: "Rafael Costa", total_bets_count: 112, wins_count: 71, losses_count: 41, brancos_hits: 8, total_invested: 18000.00, total_won: 32800.00, total_pnl: 14800.00, win_rate: 63.4, updated_at: new Date().toISOString() }
    ];

    if (data.length < 30) {
      const existingIds = new Set(data.map((d: any) => d.id));
      const targetLimit = Math.min(limit > 0 ? limit : 30, 30);
      const needed = targetLimit - data.length;
      const additional = baseMocks.filter(m => !existingIds.has(m.id)).slice(0, needed);
      data.push(...additional);
    }

    if (sort === 'pnl' && order === 'ASC') {
      data.sort((a: any, b: any) => a.total_pnl - b.total_pnl);
    } else if (sort === 'invested') {
      data.sort((a: any, b: any) => b.total_invested - a.total_invested);
    } else if (sort === 'win_rate') {
      data.sort((a: any, b: any) => b.win_rate - a.win_rate);
    } else {
      data.sort((a: any, b: any) => b.total_pnl - a.total_pnl);
    }

    return NextResponse.json({ success: true, data: data.slice(0, 30) });
  } catch (error: any) {
    return NextResponse.json({ success: true, data: [] });
  }
}
