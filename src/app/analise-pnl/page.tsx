'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Activity, Play, Settings2, RefreshCw } from 'lucide-react';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';

interface TickerData {
  id: string;
  timestamp: string;
  color: string;
  roll: string;
}

interface BetHistory {
  isWin: boolean;
  betAmount: number;
  pnlBefore: number;
  pnlAfter: number;
}

export default function PnlSimulatorPage() {
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [data, setData] = useState<TickerData[]>([]);
  
  // Filters
  const [timeWindow, setTimeWindow] = useState(24); // Horas
  const [entriesLimit, setEntriesLimit] = useState(3); // 3 Entradas (Pedra + 2 Gales)
  
  // Skeleton arrays
  const numbersToTest = Array.from({ length: 15 }, (_, i) => i);

  // Busca de Dados Históricos
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/results/period?hours=${timeWindow}`);
      const json = await res.json();
      if (json.data) {
        const parsed: TickerData[] = json.data.map((r: any) => ({
          ...r,
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
          roll: r.roll?.toString(),
        }));
        // O banco já retorna ASC (do mais VELHO pro mais NOVO), que é a ordem correta para simular.
        setData(parsed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
     fetchData();
  }, [timeWindow]);

  const [sortBy, setSortBy] = useState('num-asc');

  const handleSimulate = () => {
     setSimulating(true);
     setTimeout(() => setSimulating(false), 600);
  };

  // Processamento e Ordenação
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
           const isTrigger = parseInt(stone.roll) === triggerStone;

           if (isBetting) {
              const isWin = stone.color.toLowerCase().includes('branco');
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
                 totalLosses++;
                 sa++;
                 if (sa > sm) sm = sa;
                 
                 currentGale++;
                 entriesLeftInThisTrigger--;

                 if (currentGale > MAX_ABSOLUTE_GALES) {
                    isBetting = false;
                    currentGale = 0;
                 } else if (entriesLeftInThisTrigger <= 0) {
                    isBetting = false;
                 }
              }
           }
           
           if (isTrigger) {
              isBetting = true;
              entriesLeftInThisTrigger = entriesLimit;
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
           cycleWins,
           cycleLosses 
        };
     };

     const results = numbersToTest.map(num => runSimulationForNumber(num));

     if (sortBy === 'pnl-desc') results.sort((a, b) => b.finalPnl - a.finalPnl);
     else if (sortBy === 'assertivity-desc') results.sort((a, b) => b.assertivity - a.assertivity);
     else if (sortBy === 'assertivity-asc') results.sort((a, b) => a.assertivity - b.assertivity);
     else if (sortBy === 'sa-desc') results.sort((a, b) => b.sa - a.sa);
     else if (sortBy === 'sa-asc') results.sort((a, b) => a.sa - b.sa);
     else if (sortBy === 'sm-asc') results.sort((a, b) => a.sm - b.sm);
     // num-asc é o padrão (mantém a ordem original do numbersToTest)

     return results;
  }, [data, entriesLimit, timeWindow, sortBy]);

  // Componente Renderizador de SVG (Step Chart)
  const SvgStepChart = ({ history }: { history: BetHistory[] }) => {
      if (history.length === 0) {
         return (
            <div className="absolute inset-0 flex items-center justify-center">
               <span className="text-gray-600 text-xs font-bold uppercase tracking-widest">Sem entradas neste período</span>
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
            <svg className="w-full h-full preserve-3d" preserveAspectRatio="none" viewBox={`0 0 ${history.length} 100`}>
               <line 
                  x1="0" 
                  y1={100 - ((0 - finalMin) / finalRange) * 100} 
                  x2={history.length} 
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
                        fill={h.isWin ? '#00ff41' : '#e51e3e'}
                        className="transition-all duration-300"
                     />
                  );
               })}
            </svg>
            
            <div className="absolute right-0 top-0 bottom-4 w-16 flex flex-col justify-between text-[9px] text-gray-500 font-bold border-l border-white/5 pl-2 items-end pr-2 py-2">
               <span className="text-green-500/80">{formatCurrency(maxPnl)}</span>
               <span>{formatCurrency(0)}</span>
               <span className="text-red-500/80">{formatCurrency(minPnl)}</span>
            </div>
            
            <div className="absolute bottom-2 left-2 flex items-center gap-2">
               <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${history[history.length - 1].pnlAfter >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  PNL: {formatCurrency(history[history.length - 1].pnlAfter)}
               </div>
               <div className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-white/5 text-gray-400">
                  {history.length} Entradas
               </div>
            </div>
         </div>
      );
  };

  return (
    <main className="min-h-screen bg-[#050507] text-white flex flex-col">
      
      {/* Header Institucional */}
      <div className="bg-[#0a0a0f] border-b border-white/5 h-[72px] px-6 flex items-center justify-between shadow-2xl shrink-0 z-50">
        <div className="flex items-center gap-4">
           <h1 className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center gap-2">
             <LineChart className="text-blue-500" size={22} />
             Stress Test
           </h1>
        </div>
        <div className="flex items-center gap-2">
          {(loading || simulating) && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>}
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{data.length} giros base</span>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-8 max-w-[1400px] mx-auto w-full mt-4">
        <p className="text-gray-400 font-medium text-sm md:text-base text-center max-w-2xl mx-auto -mt-4 mb-2">
           Analise a evolução de banca simulando Martingale Contínuo (Drawdown x Profit) nas pedras gatilhos.
        </p>

      {/* Filtros Centralizados */}
      <div className="bg-[#12141c] p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row gap-4 max-w-5xl mx-auto w-full items-end">
         <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1">Base de Histórico</label>
            <select 
              value={timeWindow} onChange={e => setTimeWindow(Number(e.target.value))}
              disabled={loading || simulating}
              className="bg-[#0a0a0f] text-white border border-white/10 rounded-xl p-3.5 font-bold focus:border-blue-500 outline-none disabled:opacity-50 transition-all hover:border-white/20"
            >
               {[1, 2, 3, 4, 6, 12, 24, 48, 72].map(h => <option key={h} value={h}>Últimas {h} Horas</option>)}
            </select>
         </div>
         
         <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1">Entradas</label>
            <select 
              value={entriesLimit} onChange={e => setEntriesLimit(Number(e.target.value))}
              disabled={loading || simulating}
              className="bg-[#0a0a0f] text-white border border-white/10 rounded-xl p-3.5 font-bold focus:border-cyan-500 outline-none disabled:opacity-50 transition-all hover:border-white/20"
            >
               {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 30].map(g => <option key={g} value={g}>{g} Entradas</option>)}
            </select>
         </div>

         <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1">Ranking</label>
            <select 
              value={sortBy} onChange={e => setSortBy(e.target.value)}
              disabled={loading || simulating}
              className="bg-[#0a0a0f] text-white border border-white/10 rounded-xl p-3.5 font-bold focus:border-purple-500 outline-none disabled:opacity-50 transition-all hover:border-white/20"
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

         <div className="flex-1 w-full">
            <button 
               onClick={handleSimulate}
               disabled={loading || simulating || data.length === 0}
               className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0"
            >
               {loading || simulating ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />} 
               {loading ? 'Extraindo...' : 'Simular'}
            </button>
         </div>
      </div>

      {/* Grid de Cards */}
      <div className="flex flex-col gap-4 mt-4">
         {processedResults.map(res => {
            const num = res.triggerStone;

            return (
               <div key={num} className="bg-[#0a0a0f] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-stretch gap-4 shadow-xl h-auto md:h-72 transition-all hover:border-white/10 hover:shadow-2xl">
                  {/* Left Panel: Number & Stats */}
                  <div className="w-full md:w-44 shrink-0 flex flex-col items-center justify-center md:border-r border-white/5 md:pr-4 py-2 md:py-0">
                     <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black shadow-lg
                        ${num === 0 ? 'bg-white text-black shadow-white/20' : num <= 7 ? 'bg-[#e51e3e] text-white shadow-[#e51e3e]/20' : 'bg-[#21252e] text-white shadow-black/50'}`}>
                        {num}
                     </div>
                     <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-2 text-center leading-tight">Pedra<br/>Gatilho</span>
                     
                     <div className="mt-4 w-full flex flex-col gap-1 text-[9px] font-bold uppercase tracking-widest text-center">
                        <div className="bg-[#1a1a24] text-green-400 py-1.5 rounded-lg border border-green-500/10">Win: {res.totalWins} | Loss: {res.totalLosses}</div>
                        <div className="bg-[#1a1a24] text-blue-400 py-1.5 rounded-lg border border-blue-500/10">Taxa: {res.assertivity.toFixed(1)}%</div>
                        <div className="flex gap-1 mt-1">
                           <div className="flex-1 bg-red-900/30 text-red-400 py-1.5 rounded-lg border border-red-500/20" title="Streak Atual (Perdas Seguidas)">SA: {res.sa}</div>
                           <div className="flex-1 bg-purple-900/30 text-purple-400 py-1.5 rounded-lg border border-purple-500/20" title="Streak Máxima (Risco)">SM: {res.sm}</div>
                        </div>
                     </div>
                  </div>

                  {/* Right Panel: Chart */}
                  <div className="flex-1 flex flex-col relative border-white/10 pb-3 pl-4 pt-3 bg-[#08080c] rounded-xl overflow-hidden shadow-inner border border-white/[0.03]">
                     <div className="absolute top-2 left-4 text-[10px] font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5 z-10">
                        <Activity size={12} /> Curva de Equidade (R$ 1,00 Base)
                     </div>
                     
                     {/* The Magic Math Chart */}
                     <div className="flex-1 w-full h-full pr-16 relative mt-4">
                        {!loading && !simulating && (
                           <SvgStepChart history={res.history} />
                        )}
                        
                        {(loading || simulating) && (
                           <div className="absolute inset-0 flex items-center justify-center">
                              <RefreshCw size={20} className="text-gray-600 animate-spin" />
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            );
         })}
      </div>
      </div>
    </main>
  );
}
