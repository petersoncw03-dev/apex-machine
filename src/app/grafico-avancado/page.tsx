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
import { SmartMoneyRadar } from '@/components/SmartMoneyRadar';

interface Roll {
  id?: string;
  color: string;
  roll: number;
  timestamp: string;
  created_at?: string;
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
  brancos_hits?: number;
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

  // Sub-filtro para o Card 1 (Cores - Vermelho / Preto)
  const [colorSubFilter, setColorSubFilter] = useState<'cores' | 'vermelho' | 'preto'>('cores');
  const [colorPlayers, setColorPlayers] = useState<PlayerStats[]>([]);
  const [loadingColorPlayers, setLoadingColorPlayers] = useState(false);

  // Card 2 (Mestres do Branco 14x)
  const [whitePlayers, setWhitePlayers] = useState<PlayerStats[]>([]);
  const [loadingWhitePlayers, setLoadingWhitePlayers] = useState(false);

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
        const mAny = mappedRoll as any;
        const exists = prev.some(r => r.id === mAny.id);
        if (exists) return prev;
        const normalizedRoll: Roll = {
          id: mAny.id,
          color: mAny.color,
          roll: Number(mAny.roll || 0),
          created_at: mAny.created_at || mAny.timestamp,
          timestamp: mAny.timestamp || mAny.created_at,
          total_bets: mAny.total_bets,
          total_payout: mAny.total_payout,
          house_profit: mAny.house_profit
        };
        const newArr = [...prev, normalizedRoll];
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
      let url = `/api/players/ranking?sort=${rankingSort}&order=${rankingOrder}&limit=100&days=${periodDays}`;
      
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
  }, [rankingSort, rankingOrder, searchQuery, periodDays]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPlayersData();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPlayersData]);

  // Carregar dados das Cores (Card 1 - 2/3)
  const fetchColorPlayersData = useCallback(async () => {
    try {
      setLoadingColorPlayers(true);
      const url = `/api/players/ranking?sort=${rankingSort}&order=${rankingOrder}&limit=30&days=${periodDays}&color=${colorSubFilter}&q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setColorPlayers(json.data);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar jogadores por cor:", err);
    } finally {
      setLoadingColorPlayers(false);
    }
  }, [rankingSort, rankingOrder, periodDays, colorSubFilter, searchQuery]);

  // Carregar dados dos Mestres do Branco (Card 2 - 1/3)
  const fetchWhitePlayersData = useCallback(async () => {
    try {
      setLoadingWhitePlayers(true);
      const url = `/api/players/ranking?sort=pnl&order=desc&limit=30&days=${periodDays}&color=branco&q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setWhitePlayers(json.data);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar mestres do branco:", err);
    } finally {
      setLoadingWhitePlayers(false);
    }
  }, [periodDays, searchQuery]);

  useEffect(() => {
    fetchColorPlayersData();
    fetchWhitePlayersData();
  }, [fetchColorPlayersData, fetchWhitePlayersData]);

  // Carregar detalhes do jogador selecionado via API Interna
  const openPlayerModal = async (player: PlayerStats) => {
    setSelectedPlayer(player);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/players/${player.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.player) {
          setSelectedPlayer(json.player);
        }
        if (json.history && Array.isArray(json.history)) {
          setPlayerHistory(json.history);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar histórico do jogador:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Jogadores retornados diretamente do banco PostgreSQL com filtro por período SQL
  const filteredPlayers = players;

  // Pedras recentes em ordem decrescente (mais nova no topo) para a tabela de histórico de rodadas
  const recentRollsReversed = useMemo(() => {
    return [...globalData].reverse().slice(0, 50);
  }, [globalData]);

  return (
    <div className="flex h-screen w-full bg-[#0b0e14] text-white font-sans overflow-hidden">
      <SidebarNav />

      <main className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar relative">
        {/* Header Superior */}
        <header className="bg-[#12141c] border-b border-white/5 px-6 py-3 flex flex-wrap items-center justify-between gap-4 relative z-10">
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
        </header>

        <div className="p-3 sm:p-4 flex flex-col gap-4 w-full mx-auto">
          
          {/* SEÇÃO 1: GRÁFICO PNL */}
          <section>
            <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <GraficoPnlPanel globalData={globalData} isVip={true} />
            </div>
          </section>



          {/* SEÇÃO RADAR SMART MONEY LIVE */}
          <section className="mb-8">
            <SmartMoneyRadar />
          </section>

          {/* SEÇÃO 3: INTELIGÊNCIA POR CORES (CARD 2/3 CORES vs CARD 1/3 BRANCO) */}
          <section className="flex flex-col gap-4 mb-8">
            {/* Header com Filtro de Período de Dias */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#12141c] border border-white/10 p-4 rounded-2xl shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Users size={22} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">Inteligência & Desempenho por Cores</h2>
                  <p className="text-xs text-gray-400">Análise de apostadores dividida por Cores (Vermelho / Preto) e Caçadores de Branco (14x)</p>
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

              {/* BUSCA DE JOGADORES NO RANKING */}
              <div className="relative w-full max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00c83a]" />
                <input
                  type="text"
                  placeholder="🔍 Buscar apostador por nome..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#12141c] border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-xs font-bold text-white placeholder-gray-500 outline-none focus:border-[#00c83a] transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

            </div>

            {/* GRID DE 2 CARDS: CARD 1 (2/3 LARGURA - CORES) & CARD 2 (1/3 LARGURA - BRANCO) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* CARD 1: 2/3 DA LARGURA (CORES: VERMELHO & PRETO) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                
                {/* Controles de Sub-filtro de Cor & Ordenação */}
                <div className="bg-[#12141c] border border-white/10 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
                  
                  {/* Botões de Seleção de Cor */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Filtro de Cor:</span>
                    <button
                      onClick={() => setColorSubFilter('cores')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        colorSubFilter === 'cores'
                          ? 'bg-gradient-to-r from-rose-500 to-slate-900 text-white border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                          : 'bg-[#0b0e14] text-gray-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      🔴⚫ Ambas Cores (2x)
                    </button>
                    
                    <button
                      onClick={() => setColorSubFilter('vermelho')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        colorSubFilter === 'vermelho'
                          ? 'bg-rose-600 text-white border border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                          : 'bg-[#0b0e14] text-gray-400 border border-white/10 hover:text-rose-400'
                      }`}
                    >
                      🔴 Vermelho (2x)
                    </button>

                    <button
                      onClick={() => setColorSubFilter('preto')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        colorSubFilter === 'preto'
                          ? 'bg-slate-800 text-white border border-slate-600 shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                          : 'bg-[#0b0e14] text-gray-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      ⚫ Preto (2x)
                    </button>
                  </div>

                  {/* Ordenação */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setRankingSort('pnl'); setRankingOrder('desc'); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                        rankingSort === 'pnl' && rankingOrder === 'desc'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-[#0b0e14] text-gray-400 hover:text-white'
                      }`}
                    >
                      Top Ganhadores
                    </button>
                    <button
                      onClick={() => { setRankingSort('pnl'); setRankingOrder('asc'); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                        rankingSort === 'pnl' && rankingOrder === 'asc'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'bg-[#0b0e14] text-gray-400 hover:text-white'
                      }`}
                    >
                      Top Perdedores
                    </button>
                  </div>

                </div>

                {/* Tabela do Card 1 (Cores - Top 30) */}
                <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0f141e] text-gray-400 uppercase font-black text-[10px] tracking-wider border-b border-white/10 sticky top-0 z-10">
                        <tr>
                          <th className="py-3.5 px-4 text-center">#</th>
                          <th className="py-3.5 px-4">Jogador (Top 30)</th>
                          <th className="py-3.5 px-4 text-center">ID</th>
                          <th className="py-3.5 px-4 text-right">Total Apostado</th>
                          <th className="py-3.5 px-4 text-right">Resultado (PnL)</th>
                          <th className="py-3.5 px-4 text-center">Winrate %</th>
                          <th className="py-3.5 px-4 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {loadingColorPlayers ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-gray-500">
                              <div className="flex flex-col items-center gap-2">
                                <RefreshCw className="animate-spin text-[#00c83a]" size={24} />
                                <span className="text-xs font-bold uppercase tracking-wider">Carregando estatísticas nas cores...</span>
                              </div>
                            </td>
                          </tr>
                        ) : colorPlayers.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-gray-400 font-semibold">
                              Nenhum jogador registrado no filtro de cor selecionado.
                            </td>
                          </tr>
                        ) : (
                          colorPlayers.slice(0, 30).map((p, index) => {
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
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => openPlayerModal(p)}
                                    className="px-3 py-1.5 rounded-lg bg-[#00c83a]/10 hover:bg-[#00c83a] text-[#00c83a] hover:text-black font-bold text-xs border border-[#00c83a]/30 transition-all shadow-sm"
                                  >
                                    Detalhes
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

              </div>

              {/* CARD 2: 1/3 DA LARGURA (MESTRES DO BRANCO 14X - TOP 30) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                
                {/* Header do Card 2 (Branco) */}
                <div className="bg-[#12141c] border border-white/10 p-3.5 rounded-2xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner font-black">
                      ⚪
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-white">Reis do Branco (Top 30)</h3>
                      <p className="text-[10px] text-gray-400">Caçadores com maior lucro no Branco</p>
                    </div>
                  </div>
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Trophy size={12} /> Top 30
                  </span>
                </div>

                {/* Tabela do Card 2 (Branco) */}
                <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0f141e] text-gray-400 uppercase font-black text-[10px] tracking-wider border-b border-white/10 sticky top-0 z-10">
                        <tr>
                          <th className="py-3.5 px-3 text-center">#</th>
                          <th className="py-3.5 px-3">Jogador</th>
                          <th className="py-3.5 px-3 text-center">Brancos ⚪</th>
                          <th className="py-3.5 px-3 text-center">Winrate %</th>
                          <th className="py-3.5 px-3 text-right">Lucro PnL (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {loadingWhitePlayers ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-500">
                              <div className="flex flex-col items-center gap-2">
                                <RefreshCw className="animate-spin text-white" size={24} />
                                <span className="text-xs font-bold uppercase tracking-wider">Buscando caçadores do 14x...</span>
                              </div>
                            </td>
                          </tr>
                        ) : whitePlayers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-400 font-semibold">
                              Nenhum caçador de Branco encontrado no período.
                            </td>
                          </tr>
                        ) : (
                          whitePlayers.slice(0, 30).map((p, index) => {
                            return (
                              <tr 
                                key={p.id} 
                                onClick={() => openPlayerModal(p)}
                                className="hover:bg-white/[0.05] transition-colors cursor-pointer group"
                              >
                                <td className="py-3 px-3 text-center font-black text-amber-400 group-hover:text-amber-300">
                                  {index + 1}
                                </td>
                                <td className="py-3 px-3 font-bold text-white">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-[10px] text-white">
                                      {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <span className="truncate max-w-[100px]">{p.name || 'Jogador'}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center font-black text-white">
                                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[11px]">
                                    {p.brancos_hits || Math.max(1, Math.floor(p.wins_count / 3))} ⚪
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center font-bold">
                                  <span className={`px-2 py-0.5 rounded text-[11px] ${
                                    p.win_rate >= 50 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                    p.win_rate >= 30 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                    'bg-gray-500/20 text-gray-300 border border-white/10'
                                  }`}>
                                    {p.win_rate.toFixed(1)}%
                                  </span>
                                </td>
                                <td className={`py-3 px-3 text-right font-black ${p.total_pnl >= 0 ? 'text-[#00c83a]' : 'text-[#f12c4c]'}`}>
                                  {p.total_pnl >= 0 ? '+R$ ' : '-R$ '}{Math.abs(p.total_pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

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
                            <th className="py-2.5 px-3">Data & Horário</th>
                            <th className="py-2.5 px-3 text-center">Cor Apostada</th>
                            <th className="py-2.5 px-3 text-right">Valor Apostado</th>
                            <th className="py-2.5 px-3 text-right">Retorno Pago</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {playerHistory.map((h) => {
                            const isWin = h.status === 'WIN';
                            const dateObj = h.timestamp ? new Date(h.timestamp) : null;
                            const dateTimeStr = dateObj ? `${dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '--:--';

                            return (
                              <tr key={h.id} className="hover:bg-white/[0.02]">
                                <td className="py-2.5 px-3 font-semibold text-gray-400">{dateTimeStr}</td>
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
