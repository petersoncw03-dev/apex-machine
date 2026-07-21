import React, { useState, useMemo } from 'react';
import { Activity, RefreshCw } from 'lucide-react';

interface Roll {
  color: string;
  roll: number;
  timestamp: string;
  id?: string;
  house_profit?: string | number;
}

interface BetHistory {
  isWin: boolean;
  betAmount: number;
  pnlBefore: number;
  pnlAfter: number;
}

export default function AnalisePnlTab({ globalData }: { globalData: Roll[] }) {
  const [timeWindow, setTimeWindow] = useState(24); // Horas
  const [entriesLimit, setEntriesLimit] = useState(3); // 3 Entradas (Pedra + 2 Gales)
  const [sortBy, setSortBy] = useState('pnl-desc');

  const numbersToTest = Array.from({ length: 15 }, (_, i) => i);

  // Filter globalData based on timeWindow
  const data = useMemo(() => {
    if (!globalData || globalData.length === 0) return [];
    const cutoff = Date.now() - timeWindow * 3600 * 1000;
    return globalData.filter(d => new Date(d.timestamp).getTime() >= cutoff);
  }, [globalData, timeWindow]);

  const processedResults = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const runSimulationForNumber = (triggerStone: number) => {
      const history: BetHistory[] = [];
      let pnl = 0;
      let currentGale = 0;
      let isBetting = false;
      let entriesLeftInThisTrigger = 0;
      const MAX_ABSOLUTE_GALES = 29;
      const BASE_BET = 1.0;
      const MULTIPLIER = 1.078;
      const PAYOUT = 14;

      const cycleWins = Array(30).fill(0);
      const cycleLosses = Array(30).fill(0);
      let sa = 0;
      let sm = 0;
      let totalWins = 0;
      let totalLosses = 0;

      for (const stone of data) {
        const isTrigger = Number(stone.roll) === triggerStone;
        let overlap = false;

        if (isBetting) {
          const isWin = stone.color.toLowerCase().includes('branco') || Number(stone.roll) === 0 || stone.color.toLowerCase().includes('white') || stone.color.toLowerCase() === 'b';
          const betAmount = BASE_BET * Math.pow(MULTIPLIER, currentGale);
          const pnlBefore = pnl;

          if (isWin) {
            pnl += (betAmount * PAYOUT) - betAmount;
            history.push({ isWin: true, betAmount, pnlBefore, pnlAfter: pnl });
            
            if (currentGale < 30) cycleWins[currentGale]++;
            totalWins++;
            sa = 0;
            
            isBetting = false;
            currentGale = 0;
          } else {
            pnl -= betAmount;
            history.push({ isWin: false, betAmount, pnlBefore, pnlAfter: pnl });
            
            if (currentGale < 30) cycleLosses[currentGale]++;
            
            currentGale++;
            entriesLeftInThisTrigger--;

            // O USUÁRIO PEDIU: SA e Loss contado por entrada!
            totalLosses++;
            sa++;
            if (sa > sm) sm = sa;

            // O USUÁRIO PEDIU: se a pedra for gatilho de novo, reinicia as entradas!
            if (isTrigger) {
                overlap = true; // flag to trigger restart
                isBetting = false; // end the current cycle prematurely
            } else if (entriesLeftInThisTrigger <= 0 || currentGale > MAX_ABSOLUTE_GALES) {
                isBetting = false;
                currentGale = 0;
            }
          }
        }
        
        if (isTrigger && (!isBetting || overlap)) {
          isBetting = true;
          entriesLeftInThisTrigger = entriesLimit;
          currentGale = 0; // REINICIA A APOSTA!
        }
      }

      const totalEntries = totalWins + totalLosses;
      const assertivity = totalEntries > 0 ? (totalWins / totalEntries) * 100 : 0;
      
      return { 
        triggerStone, 
        history, 
        finalPnl: pnl,
        totalWins,
        totalLosses,
        assertivity,
        sa,
        sm,
      };
    };

    const results = numbersToTest.map(num => runSimulationForNumber(num));

    if (sortBy === 'pnl-desc') results.sort((a, b) => b.finalPnl - a.finalPnl);
    else if (sortBy === 'assertivity-desc') results.sort((a, b) => b.assertivity - a.assertivity);
    else if (sortBy === 'assertivity-asc') results.sort((a, b) => a.assertivity - b.assertivity);
    else if (sortBy === 'sa-desc') results.sort((a, b) => b.sa - a.sa);
    else if (sortBy === 'sa-asc') results.sort((a, b) => a.sa - b.sa);
    else if (sortBy === 'sm-asc') results.sort((a, b) => a.sm - b.sm);

    return results;
  }, [data, entriesLimit, sortBy]);

  const SvgStepChart = ({ history }: { history: BetHistory[] }) => {
    if (history.length === 0) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">Sem entradas</span>
        </div>
      );
    }

    let minPnl = 0;
    let maxPnl = 0;
    for (const h of history) {
      if (h.pnlAfter < minPnl) minPnl = h.pnlAfter;
      if (h.pnlAfter > maxPnl) maxPnl = h.pnlAfter;
      if (h.pnlBefore < minPnl) minPnl = h.pnlBefore;
      if (h.pnlBefore > maxPnl) maxPnl = h.pnlBefore;
    }

    const range = (maxPnl - minPnl) || 1;
    const padding = range * 0.1;
    const finalMin = minPnl - padding;
    const finalMax = maxPnl + padding;
    const finalRange = finalMax - finalMin;

    const formatCurrency = (val: number) => 
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
      <div className="w-full h-full relative">
        <svg className="w-full h-full preserve-3d" preserveAspectRatio="none" viewBox={`0 0 ${Math.max(history.length, 1)} 100`}>
          <line 
            x1="0" 
            y1={100 - ((0 - finalMin) / finalRange) * 100} 
            x2={Math.max(history.length, 1)} 
            y2={100 - ((0 - finalMin) / finalRange) * 100} 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth="0.5" 
            strokeDasharray="1,1" 
          />

          {history.map((h, i) => {
            const y1 = 100 - ((h.pnlBefore - finalMin) / finalRange) * 100;
            const y2 = 100 - ((h.pnlAfter - finalMin) / finalRange) * 100;
            const rectY = Math.min(y1, y2);
            const height = Math.max(Math.abs(y1 - y2), 0.5); 
            const width = 0.8;
            
            return (
              <rect 
                key={i}
                x={i + 0.1}
                y={rectY}
                width={width}
                height={height}
                fill={h.isWin ? '#00c83a' : '#e51e3e'}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        
        <div className="absolute right-0 top-0 bottom-4 w-12 flex flex-col justify-between text-[8px] text-gray-500 font-bold border-l border-white/5 pl-1.5 items-end pr-1.5 py-1.5">
          <span className="text-emerald-500/80">{formatCurrency(maxPnl)}</span>
          <span className="text-rose-500/80">{formatCurrency(minPnl)}</span>
        </div>
        
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5">
          <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${history[history.length - 1].pnlAfter >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            PNL: {formatCurrency(history[history.length - 1].pnlAfter)}
          </div>
          <div className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-white/5 text-gray-400">
            {history.length} Entradas
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 2) Filtros do Stress Test */}
      <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl p-4 md:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 flex flex-col gap-1.5 w-full">
          <label className="text-[9px] text-[#00c83a] font-black uppercase tracking-widest pl-1">Base de Histórico</label>
          <select 
            value={timeWindow} onChange={e => setTimeWindow(Number(e.target.value))}
            className="bg-[#0b0e14] text-white border border-white/10 rounded-lg p-2.5 text-xs font-bold focus:border-[#00c83a] outline-none transition-all hover:border-white/20"
          >
            {[1, 2, 3, 4, 6, 12, 24, 48, 72].map(h => <option key={h} value={h}>Últimas {h} Horas</option>)}
          </select>
        </div>
        
        <div className="flex-1 flex flex-col gap-1.5 w-full">
          <label className="text-[9px] text-[#00c83a] font-black uppercase tracking-widest pl-1">Qtd Entradas (Gales)</label>
          <select 
            value={entriesLimit} onChange={e => setEntriesLimit(Number(e.target.value))}
            className="bg-[#0b0e14] text-white border border-white/10 rounded-lg p-2.5 text-xs font-bold focus:border-[#00c83a] outline-none transition-all hover:border-white/20"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 30].map(g => <option key={g} value={g}>{g} Entradas</option>)}
          </select>
        </div>

        <div className="flex-1 flex flex-col gap-1.5 w-full">
          <label className="text-[9px] text-[#00c83a] font-black uppercase tracking-widest pl-1">Ranking</label>
          <select 
            value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="bg-[#0b0e14] text-white border border-white/10 rounded-lg p-2.5 text-xs font-bold focus:border-[#00c83a] outline-none transition-all hover:border-white/20"
          >
            <option value="num-asc">Por Número</option>
            <option value="pnl-desc">Maior Lucro (PNL)</option>
            <option value="assertivity-desc">Maior Assertividade</option>
            <option value="assertivity-asc">Pior Assertividade</option>
            <option value="sa-desc">Maior SA Atual</option>
            <option value="sa-asc">Menor SA Atual</option>
            <option value="sm-asc">Menor SM (Risco)</option>
          </select>
        </div>
        
        <div className="hidden md:flex items-center justify-center shrink-0 w-12 h-[42px] bg-[#00c83a]/10 border border-[#00c83a]/30 rounded-lg">
          <Activity size={18} className="text-[#00c83a]" />
        </div>
      </div>

      {/* 3) Grid de Cards Menores e Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {processedResults.map(res => {
          const num = res.triggerStone;

          return (
            <div key={num} className="bg-[#0f141e]/60 backdrop-blur-md border border-white/5 rounded-xl p-3 flex flex-col gap-3 hover:border-white/20 hover:bg-[#0f141e]/90 transition-all shadow-lg group">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black shadow-lg
                    ${num === 0 ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]' : num <= 7 ? 'bg-[#e51e3e] text-white shadow-[0_0_15px_rgba(229,30,62,0.2)]' : 'bg-[#21252e] text-white shadow-[0_0_15px_rgba(0,0,0,0.5)]'}`}>
                    {num}
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-black leading-none mb-1">Gatilho</div>
                    <div className="text-xs font-black text-white">Pedra {num}</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-black leading-none mb-1">Lucro (PNL)</div>
                  <div className={`text-sm font-black ${res.finalPnl >= 0 ? 'text-[#00c83a]' : 'text-rose-500'}`}>
                    {res.finalPnl >= 0 ? '+' : ''}R$ {res.finalPnl.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-[8px] font-black uppercase tracking-widest text-center">
                <div className="bg-[#1a1a24] text-emerald-400 py-1.5 rounded-md border border-emerald-500/10">W: {res.totalWins}</div>
                <div className="bg-[#1a1a24] text-rose-400 py-1.5 rounded-md border border-rose-500/10">L: {res.totalLosses}</div>
                <div className="bg-rose-900/20 text-rose-400 py-1.5 rounded-md border border-rose-500/20">SA: {res.sa}</div>
                <div className="bg-purple-900/20 text-purple-400 py-1.5 rounded-md border border-purple-500/20">SM: {res.sm}</div>
              </div>

              <div className="w-full h-20 bg-[#080b12] rounded-lg overflow-hidden border border-white/5 relative group-hover:border-white/10 transition-colors">
                <SvgStepChart history={res.history} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
