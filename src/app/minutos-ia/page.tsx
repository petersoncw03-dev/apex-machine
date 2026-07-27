'use client';

import React, { useState, useEffect } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { useMinutosIa } from '@/hooks/useMinutosIa';
import SidebarNav from '@/components/SidebarNav';

interface Roll { color: string; roll: number; timestamp: string; id?: string; }

// Design tokens
const CARD_GREEN = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300';
const HEAD_GREEN = 'px-5 py-4 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-t-xl';

export default function MinutosIAPage() {
  const [globalData, setGlobalData] = useState<Roll[]>([]);
  const [iaPeriodFilter, setIaPeriodFilter] = useState(24);
  const [disabledStrats, setDisabledStrats] = useState<Set<number>>(new Set([4, 5, 6, 8, 9, 10, 11, 12]));
  const [smartFilter, setSmartFilter] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const { subscribe } = useSSE();

  useEffect(() => {
    setIsMounted(true);
    fetch('/api/results?limit=5000')
      .then(res => res.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : data.data; if (arr && Array.isArray(arr)) {
          const sorted = arr.sort((a: Roll, b: Roll) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          console.log('CARREGOU:', sorted.length); setGlobalData(sorted);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const unsub = subscribe((newRoll) => {
      const mappedRoll = { ...newRoll, roll: Number(newRoll.roll) };
      setGlobalData(prevData => {
        const hasIdMatch = mappedRoll.id && prevData.some(r => r.id === mappedRoll.id);
        const hasTsMatch = !mappedRoll.id && prevData.some(r => r.timestamp === mappedRoll.timestamp && r.roll === mappedRoll.roll);
        if (hasIdMatch || hasTsMatch) return prevData;
        const merged = [...prevData, mappedRoll];
        if (merged.length > 5000) merged.shift();
        return merged;
      });
    });
    return unsub;
  }, [subscribe]);

  const iaSignals = useMinutosIa(globalData as any, iaPeriodFilter, disabledStrats, true, smartFilter);

  const toggleStrat = (idx: number) => {
    setDisabledStrats(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-[#00c83a]/30 font-sans flex">
      <SidebarNav />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="max-w-[1600px] mx-auto space-y-6">
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
                  <span className="w-8 h-8 rounded-lg bg-[#00c83a]/20 flex items-center justify-center border border-[#00c83a]/30">
                    <svg className="w-4 h-4 text-[#00c83a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </span>
                  MINUTOS DA IA (ISOLADO)
                </h1>
                <p className="text-slate-400 text-sm mt-1 font-medium">Reconstrução passo a passo das estratégias da inteligência artificial</p>
              </div>
            </div>

            <div className={`${CARD_GREEN} shrink-0`}>
                <div className={HEAD_GREEN}>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"></div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-white">
                      MINUTOS DA IA
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="group/tooltip relative">
                      <span className="text-[9px] text-cyan-500/70 uppercase font-black tracking-widest cursor-help border-b border-cyan-500/30 border-dashed">
                        {iaSignals.activeStrats.length} Estratégias
                      </span>
                      <div className="absolute right-0 top-full mt-2 w-64 p-2.5 bg-[#0b0e14] border border-white/10 rounded-md shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50">
                        <div className="text-[9px] uppercase font-black text-slate-400 mb-1.5 tracking-wider">Estratégias Ativas:</div>
                        <ul className="flex flex-col gap-1">
                          {iaSignals.stratStats.map((strat, idx) => ({ strat, idx })).filter(x => ![4, 5, 6].includes(x.idx)).map(({ strat, idx }) => (
                            <li key={idx} className="flex items-center justify-between group/strat">
                              <div className="text-[10px] text-slate-300 font-bold flex items-center gap-1.5 flex-1 pr-2 truncate">
                                <div className="w-1 h-1 rounded-full bg-cyan-500 shrink-0"></div> 
                                <span className="truncate">{strat.name}</span>
                              </div>
                              <div className={`text-[10px] font-black shrink-0 ${strat.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {strat.winRate.toFixed(1)}%
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <select className="bg-[#0b0e14] border border-white/10 text-white text-[9px] px-2 py-1 rounded outline-none" value={iaPeriodFilter} onChange={(e) => setIaPeriodFilter(+e.target.value)}>
                      <option value={1}>1h</option>
                      <option value={2}>2h</option>
                      <option value={3}>3h</option>
                      <option value={4}>4h</option>
                      <option value={6}>6h</option>
                      <option value={9}>9h</option>
                      <option value={12}>12h</option>
                      <option value={18}>18h</option>
                      <option value={24}>24h</option>
                      <option value={48}>48h</option>
                    </select>
                  </div>
                </div>

                <div className="w-full p-3 flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                   {iaSignals.stats.map((st, idx) => (
                      <div key={idx} className="flex-1 shrink-0 bg-black/40 border border-white/5 rounded px-2 py-2 flex flex-col items-center justify-center min-w-[65px]">
                         <span className="text-[9px] uppercase font-bold text-slate-500 mb-1">Confl. {st.conf}+</span>
                         <span className={`text-sm font-black ${st.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>{st.winRate.toFixed(1)}%</span>
                         <div className="flex gap-2 mt-1 text-[9px] font-mono font-bold text-slate-400">
                           <span>SA:{st.sa}</span>
                           <span>SM:{st.sm}</span>
                         </div>
                      </div>
                   ))}
                </div>

                <div className="p-4 bg-black/40">
                  <div className="grid grid-cols-6 gap-0 border-t border-l border-white/10 rounded-lg shadow-lg">
                    {Array.from({length: 60}).map((_, i) => {
                      const col = i % 6;
                      const row = Math.floor(i / 6);
                      const min = col * 10 + row;
                      const minStr = String(min).padStart(2, '0');
                      const score = iaSignals.scores[min];
                      return (
                        <div key={i} className={`relative bg-[#0b0e14]/60 hover:bg-cyan-900/20 border-r border-b border-white/10 transition-colors h-10 flex ${score >= 3 ? 'bg-cyan-900/40 shadow-[inset_0_0_15px_rgba(6,182,212,0.3)]' : ''}`}>
                          
                          <div className="relative group/min flex-1 flex items-center pl-4 pr-1 cursor-pointer">
                            <span className={`text-[11px] font-mono font-black transition-colors ${score > 0 ? 'text-cyan-400' : 'text-slate-500 group-hover/min:text-cyan-400'}`}>{minStr}</span>
                            
                            {/* Tooltip Hover Histórico */}
                            {iaSignals.history12h && (
                              <div className={`absolute ${row < 5 ? 'top-full mt-2' : 'bottom-full mb-2'} ${col < 3 ? 'left-0' : 'right-0'} w-max opacity-0 invisible group-hover/min:opacity-100 group-hover/min:visible transition-all delay-[500ms] duration-200 z-[100]`}>
                                <div className="bg-[#0b0e14] border border-slate-700/80 rounded-lg p-3 shadow-2xl backdrop-blur-md">
                                  {(() => {
                                    const rawHistory = iaSignals.history12h[min];
                                    const history = [
                                      rawHistory[3], rawHistory[2], rawHistory[1], rawHistory[0],
                                      rawHistory[7], rawHistory[6], rawHistory[5], rawHistory[4],
                                      rawHistory[11], rawHistory[10], rawHistory[9], rawHistory[8]
                                    ].filter(Boolean);
                                    const wins = rawHistory.filter(h => h.hit).length;
                                    const wr = ((wins / 12) * 100).toFixed(0);
                                    return (
                                      <>
                                        <div className="flex justify-between items-center mb-2 gap-4">
                                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Histórico 12h</div>
                                          <div className={`text-[11px] font-black ${wins >= 5 ? 'text-[#00c83a]' : 'text-amber-400'}`}>Win {wr}%</div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1.5">
                                          {history.map((h, hIdx) => (
                                            <div key={hIdx} className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-mono font-bold ${h.hit ? 'bg-[#00c83a]/20 text-[#00c83a] border border-[#00c83a]/30 shadow-[inset_0_0_8px_rgba(0,200,58,0.2)]' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                              {h.hourString.replace('h', '')}
                                            </div>
                                          ))}
                                        </div>
                                      </>
                                    )
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="relative group/score shrink-0 flex items-center pr-4 pl-1 cursor-pointer">
                            <div className={`min-w-[26px] h-[18px] rounded-[3px] transition-colors flex items-center justify-center ${score > 0 ? (score >= 3 ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'bg-cyan-200') : 'bg-slate-300 group-hover/score:bg-slate-200'}`}>
                              {score > 0 && <span className={`text-[10px] font-black ${score >= 3 ? 'text-slate-900' : 'text-cyan-900'}`}>{score}</span>}
                            </div>
                            
                            {/* Tooltip Hover Estratégias */}
                            {score > 0 && iaSignals.activeStratsByMin && iaSignals.activeStratsByMin[min]?.length > 0 && (
                              <div className={`absolute ${row < 5 ? 'top-full mt-2' : 'bottom-full mb-2'} ${col < 3 ? 'left-0' : 'right-0'} w-max opacity-0 invisible group-hover/score:opacity-100 group-hover/score:visible transition-all delay-[500ms] duration-200 z-[100]`}>
                                                                <div className="bg-[#0b0e14] border border-cyan-900/80 rounded-lg p-2.5 shadow-2xl backdrop-blur-md min-w-[200px]">
                                  <div className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-2 border-b border-cyan-900/50 pb-1.5 text-center">Confluência M{minStr}</div>
                                  <div className="flex flex-col gap-1">
                                    {iaSignals.activeStratsByMin[min].map(sIdx => {
                                      const sName = iaSignals.activeStrats[sIdx];
                                      const sInfo = iaSignals.stratStats.find(s => s.name === sName) || { winRate: 0, sa: 0, sm: 0, name: sName };
                                      return (
                                        <div key={sIdx} className="flex justify-between items-center bg-black/40 px-2 py-1 rounded border border-white/5">
                                          <div className="text-[9px] text-slate-300 font-bold max-w-[120px] truncate">{sInfo.name}</div>
                                          <div className="flex gap-2 text-[9px] font-mono font-bold text-right shrink-0">
                                            <span className="text-cyan-400 w-7 text-right">{sInfo.winRate.toFixed(0)}%</span>
                                            <span className={`w-6 text-right ${sInfo.sa >= sInfo.sm && sInfo.sm > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{sInfo.sa}/{sInfo.sm}</span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              {/* LISTAGEM DE ESTRATÉGIAS PARA REINSTALAÇÃO */}
              <div className="mt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span className="w-2 h-6 bg-[#00c83a] rounded-sm"></span>
                    Estratégias Instaladas
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSmartFilter(!smartFilter)}
                      className={`px-4 py-2 text-[12px] font-black rounded uppercase tracking-widest transition-colors flex items-center gap-2 ${smartFilter ? 'bg-[#00c83a]/20 text-[#00c83a] border border-[#00c83a]/50' : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${smartFilter ? 'bg-[#00c83a] shadow-[0_0_8px_#00c83a]' : 'bg-slate-500'}`}></div>
                      Filtro I.A. (Modo Fantasma): {smartFilter ? 'LIGADO' : 'DESLIGADO'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {iaSignals.stratStats.map((strat, idx) => ({ strat, idx })).filter(x => ![4, 5, 6].includes(x.idx)).map(({ strat, idx }) => {
                    const isDisabled = disabledStrats.has(idx);
                    return (
                    <div key={idx} className={`bg-[#0f141e]/80 border ${isDisabled ? 'border-red-500/30 opacity-50 grayscale' : 'border-white/10'} rounded-xl p-4 flex flex-col hover:border-[#00c83a]/30 transition-all`}>
                       <div className="flex justify-between items-start mb-3">
                          <span className="text-[12px] font-bold text-slate-300 uppercase tracking-wider">{strat.name}</span>
                          <button 
                            onClick={() => toggleStrat(idx)}
                            className={`px-3 py-1 text-[10px] font-black rounded uppercase tracking-widest transition-colors ${isDisabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-[#00c83a]/20 text-[#00c83a] hover:bg-[#00c83a]/30'}`}
                          >
                            {isDisabled ? 'Ativar' : 'Desativar'}
                          </button>
                       </div>
                       <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[14px] font-black px-2 py-0.5 rounded ${strat.winRate >= 50 ? 'bg-emerald-500/20 text-emerald-400' : strat.winRate > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                            {strat.winRate.toFixed(1)}%
                          </span>
                       </div>
                       <div className="flex items-center gap-3 mt-2 text-[10px] font-mono">
                         <span className="text-emerald-400 font-bold">W:{strat.wins}</span>
                         <span className="text-red-400 font-bold">L:{strat.total - strat.wins}</span>
                         <span className="text-slate-400">({strat.total} ciclos)</span>
                       </div>
                       <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-500">
                         <span>SA: <span className={strat.sa >= 3 ? 'text-red-400 font-bold' : 'text-slate-300 font-bold'}>{strat.sa}</span></span>
                         <span>SM: <span className="text-slate-300 font-bold">{strat.sm}</span></span>
                       </div>
                       <div className="text-[9px] text-slate-600 mt-2 border-t border-white/5 pt-2">
                         Ciclo ±2min · Trava creatorTime · Anti-sombreamento
                       </div>
                    </div>
                  )})}
                </div>
              </div>
          </div>
        </main>
      </div>
    </div>
  );
}
