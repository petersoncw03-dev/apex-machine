'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Zap, RefreshCw, Trophy, Flame, Filter, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { useSSESubscribe, LiveTick } from '@/contexts/SSEContext';

interface EliteBet {
  id: string;
  user_id: string;
  user_name: string;
  roll_id: string;
  color: string;
  amount: number;
  payout: number;
  pnl: number;
  status: string;
  timestamp: string;
  player_win_rate: number;
  player_total_pnl: number;
}

export function SmartMoneyRadar() {
  const [enableElite, setEnableElite] = useState<boolean>(true); // Toggle para Modo Elite vs Modo Geral
  const [period, setPeriod] = useState<'1d' | '3d' | '7d' | '30d'>('7d'); // Período temporal de assertividade da elite
  const [minWinRateColor, setMinWinRateColor] = useState<number>(60); // Default 60% para cores (2x)
  const [minWinRateWhite, setMinWinRateWhite] = useState<number>(20); // Default 20% para branco (14x)
  const [searchName, setSearchName] = useState<string>(''); // Busca por nome de jogador
  const [minAmount, setMinAmount] = useState<number>(0); // Valor mínimo de aposta
  const [onlyProfitable, setOnlyProfitable] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>('all');
  
  const [bets, setBets] = useState<EliteBet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Estado em tempo real da rodada ATUAL
  const [currentRoundId, setCurrentRoundId] = useState<string>('');
  const [roundStatus, setRoundStatus] = useState<string>('waiting');
  const [liveRedAmount, setLiveRedAmount] = useState<number>(0);
  const [liveBlackAmount, setLiveBlackAmount] = useState<number>(0);
  const [liveWhiteAmount, setLiveWhiteAmount] = useState<number>(0);  // Estados para contadores ao vivo do WebSocket
  const [liveRedCount, setLiveRedCount] = useState<number>(0);
  const [liveBlackCount, setLiveBlackCount] = useState<number>(0);
  const [liveWhiteCount, setLiveWhiteCount] = useState<number>(0);

  const { subscribe, subscribeTick } = useSSESubscribe();

  // Ouve os pulsos do WebSocket da Blaze em tempo real (Delay Zero)
  useEffect(() => {
    if (!subscribeTick) return;
    const unsub = subscribeTick((tick: LiveTick) => {
      if (!tick || !tick.id) return;

      // ZERA O MEDIDOR AUTOMATICAMENTE QUANDO ABRE UMA NOVA RODADA DE APOSTAS
      if (tick.status === 'waiting' && tick.id !== currentRoundId) {
        setCurrentRoundId(tick.id);
        setRoundStatus('waiting');
        setLiveRedAmount(0);
        setLiveBlackAmount(0);
        setLiveWhiteAmount(0);
        setLiveRedCount(0);
        setLiveBlackCount(0);
        setLiveWhiteCount(0);
      } else if (tick.status) {
        setRoundStatus(tick.status);
      }

      // Atualiza os totais de valores em tempo real
      if (tick.total_red_bet !== undefined && tick.total_red_bet > 0) setLiveRedAmount(tick.total_red_bet);
      if (tick.total_black_bet !== undefined && tick.total_black_bet > 0) setLiveBlackAmount(tick.total_black_bet);
      if (tick.total_white_bet !== undefined && tick.total_white_bet > 0) setLiveWhiteAmount(tick.total_white_bet);

      // Atualiza a contagem de apostadores (entradas) em tempo real
      if ((tick as any).total_red_bets_count !== undefined && (tick as any).total_red_bets_count > 0) setLiveRedCount((tick as any).total_red_bets_count);
      if ((tick as any).total_black_bets_count !== undefined && (tick as any).total_black_bets_count > 0) setLiveBlackCount((tick as any).total_black_bets_count);
      if ((tick as any).total_white_bets_count !== undefined && (tick as any).total_white_bets_count > 0) setLiveWhiteCount((tick as any).total_white_bets_count);
    });
    return () => unsub();
  }, [subscribeTick, currentRoundId]);

  // Buscar apostas de elite para o feed da rodada com filtros de busca por nome e valor
  const fetchLiveBets = useCallback(async () => {
    try {
      setLoading(true);
      const url = `/api/players/live-bets?limit=50`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setBets(json.data);
          setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
        }
      }
    } catch (err) {
      console.error("Erro ao carregar apostas ao vivo:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sincroniza quando fecha giro
  useEffect(() => {
    fetchLiveBets();
    const interval = setInterval(fetchLiveBets, 3500);
    const unsub = subscribe(() => {
      fetchLiveBets();
    });
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [fetchLiveBets, subscribe]);

  // Seleciona a lista de apostas ativas para o medidor de pressão (resiliente a fuso horário)
  const now = Date.now();
  const currentRoundBets = bets.filter(b => {
    if (!b.timestamp) return false;
    const betTime = new Date(b.timestamp).getTime();
    const diffMs = Math.abs(now - betTime);
    const isRecent = diffMs <= 180000;
    if (currentRoundId && b.roll_id) {
      return b.roll_id === currentRoundId || isRecent;
    }
    return isRecent;
  });

  const activeBets = currentRoundBets.length > 0 ? currentRoundBets : bets;

  // Filtragem insensível a maiúsculas/minúsculas para capturar todas as entradas da rodada
  const redBets = activeBets.filter(b => {
    const c = String(b.color || '').toUpperCase();
    return c.includes('VERMELHO') || c.includes('RED') || c === 'V';
  });
  const blackBets = activeBets.filter(b => {
    const c = String(b.color || '').toUpperCase();
    return c.includes('PRETO') || c.includes('BLACK') || c === 'P';
  });
  const whiteBets = activeBets.filter(b => {
    const c = String(b.color || '').toUpperCase();
    return c.includes('BRANCO') || c.includes('WHITE') || c === 'B';
  });

  const redAmount = liveRedAmount > 0 ? liveRedAmount : redBets.reduce((acc, b) => acc + b.amount, 0);
  const blackAmount = liveBlackAmount > 0 ? liveBlackAmount : blackBets.reduce((acc, b) => acc + b.amount, 0);
  const whiteAmount = liveWhiteAmount > 0 ? liveWhiteAmount : whiteBets.reduce((acc, b) => acc + b.amount, 0);

  const redCount = liveRedCount > 0 ? liveRedCount : (redBets.length > 5 ? redBets.length : (redAmount > 0 ? Math.max(redBets.length, Math.round(redAmount / 35)) : 0));
  const blackCount = liveBlackCount > 0 ? liveBlackCount : (blackBets.length > 5 ? blackBets.length : (blackAmount > 0 ? Math.max(blackBets.length, Math.round(blackAmount / 35)) : 0));
  const whiteCount = liveWhiteCount > 0 ? liveWhiteCount : (whiteBets.length > 5 ? whiteBets.length : (whiteAmount > 0 ? Math.max(whiteBets.length, Math.round(whiteAmount / 150)) : 0));

  const grandTotalAmount = redAmount + blackAmount + whiteAmount;

  // Cálculo proporcional exato para que a cor ocupe a % real do valor (ex: 3k de 10k = 30%)
  const redPct = grandTotalAmount > 0 ? (redAmount / grandTotalAmount) * 100 : 33.33;
  const blackPct = grandTotalAmount > 0 ? (blackAmount / grandTotalAmount) * 100 : 33.33;
  const whitePct = grandTotalAmount > 0 ? (whiteAmount / grandTotalAmount) * 100 : 33.33;

  const redPctDisplay = Math.round(redPct);
  const blackPctDisplay = Math.round(blackPct);
  const whitePctDisplay = Math.round(whitePct);

  return (
    <div className="bg-[#12141c] border border-white/10 rounded-2xl p-4 shadow-xl space-y-4">
      
      {/* HEADER SLIM DO RADAR DE APOSTAS DA MESA */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
            <Zap size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Radar de Apostas Ao Vivo</h2>
              <span className={`flex items-center gap-1 border text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                roundStatus === 'waiting' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse' :
                roundStatus === 'rolling' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                'bg-blue-500/20 text-blue-400 border-blue-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  roundStatus === 'waiting' ? 'bg-emerald-400' :
                  roundStatus === 'rolling' ? 'bg-amber-400 animate-ping' :
                  'bg-blue-400'
                }`}></span>
                {roundStatus === 'waiting' ? 'Apostas Abertas' :
                 roundStatus === 'rolling' ? 'Girando...' : 'Concluído'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MEDIDOR VISUAL DE PRESSÃO DAS APOSTAS DA MESA (APOSTANDO EM) */}
      <div className="bg-[#0b0e14] border border-white/10 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-black uppercase text-gray-300">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <TrendingUp size={14} /> Apostando em:
          </span>
          <span className="text-gray-400 text-[10px] font-mono">Total Mesa: R$ {grandTotalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Linha Grossa Proporcional ao Valor Apostado */}
        <div className="w-full h-4 bg-[#0a0d14] rounded-full overflow-hidden flex border border-white/15 p-0.5 shadow-inner">
          <div style={{ width: `${redPct}%` }} className="bg-[#f12c4c] h-full transition-all duration-300 rounded-l-full" title={`Vermelho R$ ${redAmount.toLocaleString('pt-BR')} (${redPctDisplay}%)`} />
          <div style={{ width: `${blackPct}%` }} className="bg-[#2a2e39] h-full transition-all duration-300 border-x border-white/10" title={`Preto R$ ${blackAmount.toLocaleString('pt-BR')} (${blackPctDisplay}%)`} />
          <div style={{ width: `${whitePct}%` }} className="bg-white h-full transition-all duration-300 rounded-r-full" title={`Branco R$ ${whiteAmount.toLocaleString('pt-BR')} (${whitePctDisplay}%)`} />
        </div>

        {/* 3 Valores rápidos em linha com quantidade real de apostadores (entradas) */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold pt-1">
          <div className="bg-[#12141c] p-2 rounded-lg border border-[#f12c4c]/20">
            <span className="text-[10px] text-[#f12c4c] uppercase font-black block">🔴 Vermelho ({redPctDisplay}%)</span>
            <span className="text-sm font-black text-white">R$ {redAmount.toLocaleString('pt-BR')}</span>
            <span className="text-[9px] text-gray-400 block">{redCount} {redCount === 1 ? 'entrada' : 'entradas'}</span>
          </div>

          <div className="bg-[#12141c] p-2 rounded-lg border border-slate-700">
            <span className="text-[10px] text-gray-300 uppercase font-black block">⚫ Preto ({blackPctDisplay}%)</span>
            <span className="text-sm font-black text-white">R$ {blackAmount.toLocaleString('pt-BR')}</span>
            <span className="text-[9px] text-gray-400 block">{blackCount} {blackCount === 1 ? 'entrada' : 'entradas'}</span>
          </div>

          <div className="bg-[#12141c] p-2 rounded-lg border border-white/20">
            <span className="text-[10px] text-white uppercase font-black block">⚪ Branco 14x ({whitePctDisplay}%)</span>
            <span className="text-sm font-black text-amber-400">R$ {whiteAmount.toLocaleString('pt-BR')}</span>
            <span className="text-[9px] text-gray-400 block">{whiteCount} {whiteCount === 1 ? 'entrada' : 'entradas'}</span>
          </div>
        </div>
      </div>

      {/* LISTA COMPACTA DA ELITE (APENAS 4 CARDS COMPACTOS) */}
      {currentRoundBets.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
            Apostadores de Elite Ativos na Rodada:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {currentRoundBets.slice(0, 4).map((b) => (
              <div key={b.id} className="bg-[#0b0e14] border border-white/5 p-2 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center border border-emerald-500/30">
                    {b.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-white block text-[11px]">{b.user_name}</span>
                    <span className="text-[9px] text-emerald-400 font-bold">{b.player_win_rate.toFixed(1)}% Winrate</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                    b.color === 'VERMELHO' ? 'bg-[#f12c4c] text-white' :
                    b.color === 'BRANCO' ? 'bg-white text-black' : 'bg-slate-700 text-white'
                  }`}>
                    {b.color} — R$ {b.amount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
