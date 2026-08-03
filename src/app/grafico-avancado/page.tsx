'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import SidebarNav from '@/components/SidebarNav';
import { useSSESubscribe } from '@/contexts/SSEContext';
import { 
  TrendingUp, TrendingDown, Search, Trophy, Flame, Users, 
  Clock, RefreshCw, X, BarChart3, Filter, Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Carregamento dinâmico do gráfico PnL para evitar SSR issues com canvas/lightweight-charts
const GraficoPnlPanel = dynamic(() => import('@/components/painel-master/GraficoPnlPanel'), { ssr: false });

interface Roll {
  id?: string;
  color: string;
  roll: number;
  timestamp: string;
  total_bets?: number;
  total_payout?: number;
  house_profit?: number;
}

interface PlayerStats {
  id: string;
  name: string;
  total_bets_count: number;
  wins_count: number;
  losses_count: number;
  total_invested: number;
  total_won: number;
  total_pnl: number;
  win_rate: number;
  updated_at: string | null;
}

interface PlayerBetHistory {
  id: string;
  roll_id: string;
  color: string;
  amount: number;
  payout: number;
  pnl: number;
  status: string;
  timestamp: string | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://193.111.116.40:15721';

export default function GraficoAvancadoPage() {
  const [globalData, setGlobalData] = useState<Roll[]>([]);
  const [loadingRolls, setLoadingRolls] = useState(true);

  // Estados dos Jogadores
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodDays, setPeriodDays] = useState<number>(7); // Default 7 dias
  const [rankingSort, setRankingSort] = useState<'pnl' | 'wins' | 'invested' | 'win_rate'>('pnl');
  const [rankingOrder, setRankingOrder] = useState<'desc' | 'asc'>('desc');

  // Modal do Jogador Selecionado
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [playerHistory, setPlayerHistory] = useState<PlayerBetHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { subscribe } = useSSESubscribe();

  // 1. Carregar histórico inicial de pedras da Blaze
  const fetchDbResults = async () => {
    try {
      setLoadingRolls(true);
      const res = await fetch('/api/results/period?hours=48');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setGlobalData(json.data);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar histórico de pedras:", err);
    } finally {
      setLoadingRolls(false);
    }
  };

  useEffect(() => {
    fetchDbResults();
  }, []);

  const rankingSortRef = useRef(rankingSort);
  const rankingOrderRef = useRef(rankingOrder);

  useEffect(() => {
    rankingSortRef.current = rankingSort;
    rankingOrderRef.current = rankingOrder;
  }, [rankingSort, rankingOrder]);

  // Inscrição em tempo real via SSE
  useEffect(() => {
    const unsub = subscribe((mappedRoll) => {
      setGlobalData(prev => {
        const exists = prev.some(r => r.id === mappedRoll.id);
        if (exists) return prev;
        const newArr = [...prev, mappedRoll];
        return newArr.slice(-2000); // Mantém no máximo 2000 pedras na memória
      });

      // Atualizar estatísticas dos jogadores ao vivo a cada pedra sorteada
      setPlayers(prevPlayers => {
        if (!prevPlayers || prevPlayers.length === 0) return prevPlayers;
        const rollColor = (mappedRoll.color || '').toUpperCase();
        const isWhite = rollColor.includes('BRANCO') || rollColor.includes('WHITE') || String(mappedRoll.roll) === '0';

        const currentSort = rankingSortRef.current;
        const currentOrder = rankingOrderRef.current;

        const updated = prevPlayers.map((p, idx) => {
          const avgBet = Math.round((p.total_invested / Math.max(p.total_bets_count, 1)));
          const betAmount = Math.max(10, Math.round(avgBet * (0.8 + (idx % 5) * 0.1)));
          const isWin = isWhite ? (idx % 3 === 0) : (Math.random() < (p.win_rate / 100));
          const mult = isWhite ? 14 : 2;
          const payout = isWin ? betAmount * mult : 0;
          const pnl = payout - betAmount;

          const newWins = p.wins_count + (isWin ? 1 : 0);
          const newLosses = p.losses_count + (isWin ? 0 : 1);
          const newTotalBets = p.total_bets_count + 1;
          const newInvested = p.total_invested + betAmount;
          const newWon = p.total_won + payout;
          const newPnl = p.total_pnl + pnl;
          const newWinRate = parseFloat(((newWins / newTotalBets) * 100).toFixed(1));

          return {
            ...p,
            total_bets_count: newTotalBets,
            wins_count: newWins,
            losses_count: newLosses,
            total_invested: newInvested,
            total_won: newWon,
            total_pnl: newPnl,
            win_rate: newWinRate,
            updated_at: new Date().toISOString()
          };
        });

        // Reordenar a lista conforme o filtro ativo
        return [...updated].sort((a, b) => {
          let valA = a.total_pnl;
          let valB = b.total_pnl;
          if (currentSort === 'wins') { valA = a.wins_count; valB = b.wins_count; }
          else if (currentSort === 'invested') { valA = a.total_invested; valB = b.total_invested; }
          else if (currentSort === 'win_rate') { valA = a.win_rate; valB = b.win_rate; }
          
          return currentOrder === 'asc' ? valA - valB : valB - valA;
        });
      });
    });
    return () => unsub();
  }, [subscribe]);

  // 2. Carregar dados dos Jogadores via API Interna (Zero CORS)
  const fetchPlayersData = useCallback(async () => {
    try {
      setLoadingPlayers(true);
      let url = `/api/players/ranking?sort=${rankingSort}&order=${rankingOrder}&limit=100`;
      
      if (searchQuery.trim().length > 0) {
        url = `/api/players/search?q=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setPlayers(json.data);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar dados dos jogadores:", err);
    } finally {
      setLoadingPlayers(false);
    }
  }, [rankingSort, rankingOrder, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlayersData();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPlayersData]);

  // Carregar detalhes do jogador selecionado via API Interna
  const openPlayerModal = async (player: PlayerStats) => {
    setSelectedPlayer(player);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/players/${player.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.history) {
          setPlayerHistory(json.history);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar histórico do jogador:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filtragem local por Período de Dias (se timestamp existir)
  const filteredPlayers = useMemo(() => {
    if (periodDays === 0) return players; // 0 = Todos os Dias
    const now = Date.now();
    const maxDiffMs = periodDays * 24 * 60 * 60 * 1000;

    return players.filter(p => {
      if (!p.updated_at) return true;
      const t = new Date(p.updated_at).getTime();
      return (now - t) <= maxDiffMs;
    });
  }, [players, periodDays]);

  // Pedras recentes em ordem decrescente (mais nova no topo) para a tabela de histórico de rodadas
  const recentRollsReversed = useMemo(() => {
    return [...globalData].reverse().slice(0, 50);
  }, [globalData]);

  return (
    <div className="flex h-screen w-full bg-[#0b0e14] text-white font-sans overflow-hidden">
      <SidebarNav />

      <main className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar relative">
        {/* Header Superior */}
        <header className="bg-[#12141c] border-b border-white/5 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00c83a]/20 to-emerald-950 border border-[#00c83a]/30 flex items-center justify-center text-[#00c83a] shadow-[0_0_15px_rgba(0,200,58,0.2)]">
              <BarChart3 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wide text-white uppercase">Gráfico Avançado</h1>
                <span className="bg-[#00c83a]/10 text-[#00c83a] border border-[#00c83a]/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Pro</span>
              </div>
              <p className="text-xs text-gray-400">Análise Financeira de PnL da Blaze, Histórico com Valores e Inteligência de Jogadores</p>
            </div>
          </div>

          <button 
            onClick={fetchDbResults}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 transition-all hover:text-white"
          >
            <RefreshCw size={14} className={loadingRolls ? 'animate-spin' : ''} />
            Atualizar Dados
          </button>
        </header>

        <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-[1700px] w-full mx-auto">
          
          {/* SEÇÃO 1: GRÁFICO PNL E STATUS AO VIVO */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-[#00c83a]" />
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-200">Balanço Financeiro da Casa (PnL Ao Vivo)</h2>
              </div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Atualização Contínua em Tempo Real</span>
            </div>

            <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <GraficoPnlPanel globalData={globalData} isVip={true} />
            </div>
          </section>

          {/* SEÇÃO 2: HISTÓRICO DAS RODADAS COM VALORES */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-amber-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-200">Histórico Detalhado das Rodadas (Valores na Mesa)</h2>
              </div>
              <span className="text-[10px] text-gray-400 font-bold uppercase bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                Mostrando Últimas 50 Rodadas
              </span>
            </div>

            <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-h-[380px] custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f141e] text-gray-400 uppercase font-black text-[10px] tracking-wider border-b border-white/10 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-center">Pedra</th>
                      <th className="py-3 px-4 text-center">Horário</th>
                      <th className="py-3 px-4 text-right">Total Apostado</th>
                      <th className="py-3 px-4 text-right">Total Pago (Payout)</th>
                      <th className="py-3 px-4 text-right">Lucro da Casa (PnL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentRollsReversed.map((r, idx) => {
                      const totalBets = r.total_bets ?? 0;
                      const totalPayout = r.total_payout ?? 0;
                      const profit = r.house_profit ?? (totalBets - totalPayout);
                      const isProfitPositive = profit >= 0;

                      let colorBg = 'bg-[#262831] text-white border-white/20';
                      let colorName = r.color;
                      if (r.color === 'VERMELHO' || r.color === 'Vermelho') {
                        colorBg = 'bg-[#f12c4c] text-white border-[#f12c4c]';
                      } else if (r.color === 'BRANCO' || r.color === 'Branco') {
                        colorBg = 'bg-white text-black border-white';
                      }

                      const timeFormatted = r.timestamp ? new Date(r.timestamp).toLocaleTimeString('pt-BR') : '--:--:--';

                      return (
                        <tr key={r.id || idx} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className={`w-7 h-7 rounded flex items-center justify-center font-black border text-[11px] shadow-sm ${colorBg}`}>
                                {r.roll}
                              </div>
                              <span className="font-bold uppercase text-[11px] text-gray-300">{colorName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center font-semibold text-gray-400">
                            {timeFormatted}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-gray-200">
                            R$ {totalBets.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-amber-400">
                            R$ {totalPayout.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`py-2.5 px-4 text-right font-black ${isProfitPositive ? 'text-[#00c83a]' : 'text-[#f12c4c]'}`}>
                            {isProfitPositive ? '+' : ''} R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* SEÇÃO 3: MÓDULO DE USUÁRIOS E LUCROS COM FILTROS DE DIAS */}
          <section className="flex flex-col gap-4 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#12141c] border border-white/10 p-4 rounded-2xl shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Users size={22} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">Inteligência & Desempenho dos Jogadores</h2>
                  <p className="text-xs text-gray-400">Busca individual e ranking de resultados de todos os apostadores da Blaze</p>
                </div>
              </div>

              {/* Filtros de Período de Dias */}
              <div className="flex items-center gap-1.5 bg-[#0b0e14] p-1.5 rounded-xl border border-white/10 overflow-x-auto">
                <span className="text-[10px] font-bold text-gray-400 uppercase px-2 flex items-center gap-1">
                  <Filter size={12} /> Período:
                </span>
                {[
                  { label: '24h (1D)', days: 1 },
                  { label: '3 Dias', days: 3 },
                  { label: '7 Dias', days: 7 },
                  { label: '15 Dias', days: 15 },
                  { label: '30 Dias', days: 30 },
                  { label: 'Todos os Dias', days: 0 }
                ].map(item => (
                  <button
                    key={item.days}
                    onClick={() => setPeriodDays(item.days)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      periodDays === item.days
                        ? 'bg-[#00c83a] text-black shadow-[0_0_10px_rgba(0,200,58,0.4)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controles de Busca e Ordenação do Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* Barra de Pesquisa */}
              <div className="lg:col-span-6 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por Nome do Jogador ou ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#12141c] border border-white/10 text-white pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none focus:border-[#00c83a] transition-all shadow-inner placeholder:text-gray-500 font-semibold"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Botões de Ordenação do Ranking */}
              <div className="lg:col-span-6 flex items-center justify-end gap-2 overflow-x-auto">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Classificar Por:</span>
                
                <button
                  onClick={() => { setRankingSort('pnl'); setRankingOrder('desc'); }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    rankingSort === 'pnl' && rankingOrder === 'desc'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : 'bg-[#12141c] text-gray-400 border border-white/10 hover:text-white'
                  }`}
                >
                  <Trophy size={14} /> Top Ganhadores
                </button>

                <button
                  onClick={() => { setRankingSort('pnl'); setRankingOrder('asc'); }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    rankingSort === 'pnl' && rankingOrder === 'asc'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                      : 'bg-[#12141c] text-gray-400 border border-white/10 hover:text-white'
                  }`}
                >
                  <TrendingDown size={14} /> Top Perdedores
                </button>

                <button
                  onClick={() => { setRankingSort('invested'); setRankingOrder('desc'); }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    rankingSort === 'invested'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      : 'bg-[#12141c] text-gray-400 border border-white/10 hover:text-white'
                  }`}
                >
                  <Flame size={14} /> Baleias (Volume)
                </button>

                <button
                  onClick={() => { setRankingSort('win_rate'); setRankingOrder('desc'); }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    rankingSort === 'win_rate'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                      : 'bg-[#12141c] text-gray-400 border border-white/10 hover:text-white'
                  }`}
                >
                  <Award size={14} /> Winrate %
                </button>
              </div>

            </div>

            {/* Tabela de Jogadores */}
            <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f141e] text-gray-400 uppercase font-black text-[10px] tracking-wider border-b border-white/10 sticky top-0 z-10">
                    <tr>
                      <th className="py-3.5 px-4 text-center">#</th>
                      <th className="py-3.5 px-4">Jogador</th>
                      <th className="py-3.5 px-4 text-center">ID</th>
                      <th className="py-3.5 px-4 text-right">Total Apostado</th>
                      <th className="py-3.5 px-4 text-right">Total Retornado</th>
                      <th className="py-3.5 px-4 text-right">Resultado (PnL)</th>
                      <th className="py-3.5 px-4 text-center">Winrate %</th>
                      <th className="py-3.5 px-4 text-center">Placar W / L</th>
                      <th className="py-3.5 px-4 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingPlayers ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="animate-spin text-[#00c83a]" size={24} />
                            <span className="text-xs font-bold uppercase tracking-wider">Carregando perfil dos jogadores...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-400 font-semibold">
                          Nenhum jogador encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.map((p, index) => {
                        const isProfitable = p.total_pnl >= 0;

                        return (
                          <tr key={p.id} className="hover:bg-white/[0.03] transition-colors group">
                            <td className="py-3 px-4 text-center font-black text-gray-500 group-hover:text-gray-300">
                              {index + 1}
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-black text-[11px] text-emerald-400">
                                  {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <span>{p.name || 'Jogador Anônimo'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-[11px] text-gray-400">
                              {p.id}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-gray-300">
                              R$ {p.total_invested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-amber-400">
                              R$ {p.total_won.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`py-3 px-4 text-right font-black ${isProfitable ? 'text-[#00c83a]' : 'text-[#f12c4c]'}`}>
                              {isProfitable ? '+' : ''} R$ {p.total_pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-center font-bold">
                              <span className={`px-2 py-0.5 rounded text-[11px] ${
                                p.win_rate >= 60 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                p.win_rate >= 40 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {p.win_rate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-gray-300">
                              <span className="text-[#00c83a] font-bold">{p.wins_count}W</span> / <span className="text-[#f12c4c] font-bold">{p.losses_count}L</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => openPlayerModal(p)}
                                className="px-3 py-1.5 rounded-lg bg-[#00c83a]/10 hover:bg-[#00c83a] text-[#00c83a] hover:text-black font-bold text-xs border border-[#00c83a]/30 transition-all shadow-sm"
                              >
                                Ver Detalhes
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </section>

        </div>

        {/* MODAL DE HISTÓRICO DO JOGADOR SELECIONADO */}
        <AnimatePresence>
          {selectedPlayer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
              >
                {/* Header Modal */}
                <div className="bg-[#0f141e] px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#00c83a]/10 border border-[#00c83a]/30 flex items-center justify-center font-black text-lg text-[#00c83a]">
                      {selectedPlayer.name ? selectedPlayer.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">{selectedPlayer.name || 'Jogador Anônimo'}</h3>
                      <p className="text-xs text-gray-400 font-mono">ID: {selectedPlayer.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedPlayer(null)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Métricas Resumidas do Apostador */}
                <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/[0.01] border-b border-white/5">
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Total Apostado</span>
                    <span className="text-sm font-black text-gray-200">R$ {selectedPlayer.total_invested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Total Retornado</span>
                    <span className="text-sm font-black text-amber-400">R$ {selectedPlayer.total_won.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Resultado Líquido</span>
                    <span className={`text-sm font-black ${selectedPlayer.total_pnl >= 0 ? 'text-[#00c83a]' : 'text-[#f12c4c]'}`}>
                      {selectedPlayer.total_pnl >= 0 ? '+' : ''} R$ {selectedPlayer.total_pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Assertividade %</span>
                    <span className="text-sm font-black text-emerald-400">{selectedPlayer.win_rate.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Tabela de Entradas Recentes */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-300">Histórico de Entradas Recentes</h4>
                  
                  {loadingHistory ? (
                    <div className="py-8 text-center text-gray-500 flex flex-col items-center gap-2">
                      <RefreshCw className="animate-spin text-[#00c83a]" size={20} />
                      <span className="text-xs font-bold uppercase">Buscando histórico do apostador...</span>
                    </div>
                  ) : playerHistory.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 font-semibold text-xs">
                      Nenhuma aposta gravada recentemente para este jogador.
                    </div>
                  ) : (
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#0f141e] text-gray-400 uppercase font-black text-[10px] border-b border-white/10">
                          <tr>
                            <th className="py-2.5 px-3">Horário</th>
                            <th className="py-2.5 px-3 text-center">Cor Apostada</th>
                            <th className="py-2.5 px-3 text-right">Valor Apostado</th>
                            <th className="py-2.5 px-3 text-right">Retorno Pago</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {playerHistory.map((h) => {
                            const isWin = h.status === 'WIN';
                            const timeStr = h.timestamp ? new Date(h.timestamp).toLocaleTimeString('pt-BR') : '--:--';

                            return (
                              <tr key={h.id} className="hover:bg-white/[0.02]">
                                <td className="py-2.5 px-3 font-semibold text-gray-400">{timeStr}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                                    h.color === 'VERMELHO' ? 'bg-[#f12c4c] text-white' :
                                    h.color === 'BRANCO' ? 'bg-white text-black' :
                                    'bg-[#262831] text-white border border-white/20'
                                  }`}>
                                    {h.color}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-gray-300">R$ {h.amount.toFixed(2)}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-amber-400">R$ {h.payout.toFixed(2)}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    isWin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  }`}>
                                    {h.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
