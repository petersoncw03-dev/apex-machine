'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clock, TrendingUp, AlertTriangle, ShieldCheck, Activity, Target, History, RefreshCcw, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

interface Roll { color: string; roll: number; timestamp: string; id?: string; time?: Date; }

interface CycleDef {
  type: 'W' | 'L';
  count: number;
}

interface StratState {
  id: string;
  name: string;
  desc: string;
  color: string;
  wins: number;
  losses: number;
  sa: number;
  sm: number;
  currentCycleType: 'W' | 'L' | null;
  currentCycleCount: number;
  currentCycleWinrate: number;
  topLossCycles: { count: number; total: number; winrate: number }[];
  topWinCycles: { count: number; total: number; winrate: number }[];
  isTriggered: boolean;
  activeStep: number;
}

interface PredictedMinute {
  min: number;
  strats: string[];
}

export default function DozeEntradasPage() {
  const [data, setData] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  const [strats, setStrats] = useState<StratState[]>([]);
  const [predictedMinutes, setPredictedMinutes] = useState<PredictedMinute[]>([]);
  const [selectedCycles, setSelectedCycles] = useState<StratState | null>(null);

  const isInitialLoad = useRef(true);

  const fetchData = async () => {
    try {
      const hours = isInitialLoad.current ? 360 : 1;
      const res = await fetch(`/api/results/period?hours=${hours}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const fetchedRolls: Roll[] = json.data.map((r: any) => {
            let t_str = r.timestamp;
            if (t_str.endsWith('Z')) t_str = t_str.slice(0, -1);
            return {
              id: r.id,
              roll: parseInt(r.roll),
              color: r.color?.toString().toLowerCase(),
              timestamp: r.timestamp,
              time: new Date(t_str)
            };
          });
          fetchedRolls.sort((a, b) => (a.time as Date).getTime() - (b.time as Date).getTime());
          
          setData(prev => {
             if (isInitialLoad.current) return fetchedRolls;
             
             const existingIds = new Set(prev.map(r => r.id));
             const newRolls = fetchedRolls.filter(r => !existingIds.has(r.id));
             
             if (newRolls.length > 0) {
                // Keep history trimmed to exactly 15.5 days (approx 45,000 rolls max) to avoid infinite memory growth
                const merged = [...prev, ...newRolls];
                if (merged.length > 45000) return merged.slice(merged.length - 45000);
                return merged;
             }
             return prev;
          });

          if (isInitialLoad.current) {
            isInitialLoad.current = false;
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isInitialLoad.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const simState = useRef({
    lastIndex: -1,
    strats: [] as any[]
  });

  // Engine Evaluator
  useEffect(() => {
    if (data.length === 0) return;

    // Simulate the maximum possible history (360 hours total, minus 10 hours for warm-up)
    const lastTime = data[data.length - 1].time as Date;
    const simStartTime = new Date(lastTime.getTime() - 350 * 60 * 60 * 1000);

    const isBranco = (r: Roll) => r.color === 'branco' || r.color === 'white' || r.roll === 0;

    const countBrancos = (rolls: Roll[], currentIdx: number, deltaHours: number, mins = 6) => {
      const ct = rolls[currentIdx].time as Date;
      const targetTime = new Date(ct.getTime() - deltaHours * 60 * 60 * 1000);
      const startTime = new Date(targetTime.getTime() - mins * 60 * 1000);
      let c = 0;
      let sIdx = currentIdx;
      while (sIdx >= 0) {
        const t = rolls[sIdx].time as Date;
        if (t > targetTime) { sIdx--; continue; }
        if (t < startTime) break;
        if (isBranco(rolls[sIdx])) c++;
        sIdx--;
      }
      return c;
    };

    const stratsDef = [
      { id: 'eco4', name: 'Eco 4 Horas', desc: 'Repetição do pico de 4h atrás', color: '#3b82f6', eval: (r: Roll[], i: number) => countBrancos(r, i, 4, 6) >= 2 },
      { id: 'eco5', name: 'Eco 5 Horas', desc: 'Repetição do pico de 5h atrás', color: '#a855f7', eval: (r: Roll[], i: number) => countBrancos(r, i, 5, 6) >= 2 },
      { id: 'eco8', name: 'Eco 8 Horas', desc: 'O Grande Ciclo Mestre de 8h', color: '#00c83a', eval: (r: Roll[], i: number) => countBrancos(r, i, 8, 6) >= 2 },
      { id: 'eco24', name: 'Eco 24 Horas (Curto)', desc: 'Pico denso de ontem (4 mins)', color: '#ec4899', eval: (r: Roll[], i: number) => countBrancos(r, i, 24, 4) >= 2 },
      { id: 'ritmo24', name: 'Ritmo 2-4', desc: 'Confluência dupla de 4h e 2h', color: '#f59e0b', eval: (r: Roll[], i: number) => countBrancos(r, i, 4, 6) >= 2 && countBrancos(r, i, 2, 6) >= 1 },
    ];

    if (simState.current.lastIndex === -1 || data.length < simState.current.lastIndex) {
      simState.current = {
        lastIndex: -1,
        strats: stratsDef.map(def => ({
           id: def.id,
           results: [] as ('W'|'L')[],
           activeStep: 0,
           triggerCooldown: 0,
           isTriggered: false
        }))
      };
    }

    const startIdx = Math.max(0, simState.current.lastIndex + 1);

    for (let sIdx = 0; sIdx < stratsDef.length; sIdx++) {
      const def = stratsDef[sIdx];
      const st = simState.current.strats[sIdx];

      for (let i = startIdx; i < data.length; i++) {
        const roll = data[i];
        if ((roll.time as Date) < simStartTime) continue;

        if (st.triggerCooldown > 0) {
          if (st.activeStep === 0) st.triggerCooldown--;
        }

        if (st.activeStep > 0) {
          if (isBranco(roll)) {
            st.results.push('W');
            st.activeStep = 0;
            st.triggerCooldown = 12 - st.activeStep; 
          } else if (st.activeStep === 12) {
            st.results.push('L');
            st.activeStep = 0;
            st.triggerCooldown = 0;
          } else {
            st.activeStep++;
          }
        } else {
          if (st.triggerCooldown === 0) {
            if (def.eval(data, i)) {
              st.activeStep = 1;
              st.isTriggered = true;
            } else {
              st.isTriggered = false;
            }
          }
        }
      }
    }
    
    simState.current.lastIndex = data.length - 1;

    const newStrats: StratState[] = [];

    stratsDef.forEach((def, idx) => {
      const st = simState.current.strats[idx];
      const results = st.results;

      // Calculate stats from results
      let wins = 0;
      let losses = 0;
      let sa = 0;
      let sm = 0;
      let currentStreakType: 'W'|'L'|null = null;
      let currentStreak = 0;

      const calcCycleData = (targetType: 'W'|'L') => {
        const cycleMap = new Map<number, { occurrences: number, winsAfter: number }>();
        let streak = 0;
        let sType: 'W'|'L'|null = null;

        for (let i = 0; i < results.length - 1; i++) {
          const res = results[i];
          if (sType === null) { sType = res; streak = 1; }
          else if (res === sType) { streak++; }
          else { streak = 1; sType = res; }

          if (sType === targetType) {
             const data = cycleMap.get(streak) || { occurrences: 0, winsAfter: 0 };
             data.occurrences++;
             if (results[i+1] === 'W') data.winsAfter++;
             cycleMap.set(streak, data);
          }
        }
        
        const list = Array.from(cycleMap.entries()).map(([count, d]) => ({
          count,
          total: d.occurrences,
          winrate: d.occurrences > 0 ? (d.winsAfter / d.occurrences) * 100 : 0
        })).filter(x => x.total > 0);
        
        // Sort by sequential order (L1, L2, L3...) instead of winrate
        list.sort((a, b) => a.count - b.count);
        return list; // Return all without slicing, the UI has a scrollbar!
      };

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r === 'W') {
          wins++;
          sa = 0;
        } else {
          losses++;
          sa++;
          if (sa > sm) sm = sa;
        }
        
        if (currentStreakType === null) {
          currentStreakType = r;
          currentStreak = 1;
        } else if (currentStreakType === r) {
          currentStreak++;
        } else {
          currentStreakType = r;
          currentStreak = 1;
        }
      }

      const topLossCycles = calcCycleData('L');
      const topWinCycles = calcCycleData('W');

      let currentCycleWinrate = 0;
      if (currentStreakType) {
        const cycles = currentStreakType === 'W' ? topWinCycles : topLossCycles;
        const match = cycles.find(c => c.count === currentStreak);
        if (match) currentCycleWinrate = match.winrate;
      }

      newStrats.push({
        id: def.id,
        name: def.name,
        desc: def.desc,
        color: def.color,
        wins,
        losses,
        sa,
        sm,
        currentCycleType: currentStreakType,
        currentCycleCount: currentStreak,
        currentCycleWinrate,
        topLossCycles,
        topWinCycles,
        isTriggered: st.activeStep > 0,
        activeStep: st.activeStep
      });
    });

    // --- MINUTE PREDICTION LOGIC ---
    // Project the 4 strategies onto the next occurrence of each minute 0-59
    const predictions: PredictedMinute[] = [];
    const now = new Date();
    // Assuming data's latest roll is "now" in the simulation's perspective
    const currentSimTime = data[data.length - 1].time as Date;
    const cooldowns: Record<string, number> = { 'Eco 4H': 0, 'Eco 5H': 0, 'Eco 8H': 0, 'Eco 24H (Curto)': 0, 'Ritmo 2-4': 0 };

    for (let m = -6; m < 60; m++) {
      let targetHour = currentSimTime.getHours();
      let actualM = m;
      if (m < 0) {
        targetHour -= 1;
        actualM = 60 + m;
      }
      
      let targetDate = new Date(currentSimTime);
      targetDate.setHours(targetHour, actualM, 0, 0);

      const checkCondition = (deltaHours: number, mins = 6) => {
        const pastTargetTime = new Date(targetDate.getTime() - deltaHours * 60 * 60 * 1000);
        const startTime = new Date(pastTargetTime.getTime() - mins * 60 * 1000);
        let c = 0;
        let sIdx = data.length - 1;
        while (sIdx >= 0) {
          const t = data[sIdx].time as Date;
          if (t > pastTargetTime) { sIdx--; continue; }
          if (t < startTime) break;
          if (isBranco(data[sIdx])) c++;
          sIdx--;
        }
        return c;
      };

      const activeStrats: string[] = [];
      
      const evaluateStrat = (name: string, condition: boolean) => {
        if (cooldowns[name] > 0) {
          cooldowns[name]--;
        } else if (condition) {
          activeStrats.push(name);
          cooldowns[name] = 6; // 6 minutes UI cooldown (approx 12 rolls)
        }
      };

      evaluateStrat('Eco 4H', checkCondition(4, 6) >= 2);
      evaluateStrat('Eco 5H', checkCondition(5, 6) >= 2);
      evaluateStrat('Eco 8H', checkCondition(8, 6) >= 2);
      evaluateStrat('Eco 24H (Curto)', checkCondition(24, 4) >= 2);
      evaluateStrat('Ritmo 2-4', checkCondition(4, 6) >= 2 && checkCondition(2, 6) >= 1);

      if (m >= 0) {
        predictions.push({ min: actualM, strats: activeStrats });
      }
    }
    setPredictedMinutes(predictions);

    setStrats(newStrats);
    if (selectedCycles) {
      const updated = newStrats.find(s => s.id === selectedCycles.id);
      if (updated) setSelectedCycles(updated);
    }

  }, [data]);


  return (
    <main className="min-h-screen bg-[#050507] text-white font-sans flex flex-col">
      <header className="px-6 py-4 bg-[#0a0a0f] border-b border-white/5 flex items-center justify-between sticky top-0 z-40 shadow-xl">
        <div className="flex items-center gap-4">
          <Link href="/painel-master" className="text-gray-500 hover:text-white transition-colors bg-white/5 p-2 rounded-lg border border-white/5">
             <LayoutDashboard size={18} />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <Clock size={20} className="text-[#00c83a]" />
              Radar Mestre: <span className="text-gray-400">12 Entradas</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Previsão e Leitura de Horários</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {loading ? (
             <span className="text-xs font-bold text-gray-500 flex items-center gap-2"><RefreshCcw size={14} className="animate-spin" /> Atualizando...</span>
           ) : (
             <span className="text-xs font-bold text-[#00c83a] flex items-center gap-2"><div className="w-2 h-2 bg-[#00c83a] rounded-full animate-pulse shadow-[0_0_10px_#00c83a]"></div> Ao Vivo</span>
           )}
        </div>
      </header>

      <div className="flex-1 p-6 lg:p-8 max-w-[1600px] mx-auto w-full flex flex-col gap-8">
        
        <div className="p-4 bg-[#1a1d24]/50 border border-white/5 rounded-xl flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
             <Target size={24} />
          </div>
          <div className="flex flex-col">
             <h2 className="text-sm font-black uppercase tracking-widest text-white">Sobre a Ferramenta</h2>
             <p className="text-xs text-gray-400 font-medium mt-1">Este radar opera exclusivamente buscando Brancos em janelas de 12 entradas (6 minutos). A inteligência analisa horas passadas para prever anomalias de repetição de tempo. <strong>Winrate Base Recomendado: &gt; 59.0%</strong>.</p>
          </div>
        </div>

        {/* PAINEL DE MINUTOS (TOP, FULL WIDTH) */}
        <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300 w-full">
             <div className="px-6 py-4 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[2px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse"></div>
                   <span className="text-sm font-black uppercase tracking-widest text-white">
                     Mapeamento da Hora Atual ({data.length > 0 ? String((data[data.length-1].time as Date).getHours()).padStart(2, '0') : '00'}h)
                   </span>
                </div>
             </div>
             
             <div className="p-6 bg-black/40">
                <div className="grid grid-cols-6 gap-0 border-t border-l border-white/10 rounded-xl shadow-2xl">
                  {Array.from({length: 60}).map((_, i) => {
                    const col = i % 6;
                    const row = Math.floor(i / 6);
                    const min = col * 10 + row;
                    const minStr = String(min).padStart(2, '0');
                    const pred = predictedMinutes.find(p => p.min === min);
                    const score = pred?.strats.length || 0;
                    
                    // Utilize actual computer time for the current minute indicator to avoid jumping when API delays
                    const nowMin = new Date().getMinutes();
                    const isCurrent = min === nowMin;
                    
                    return (
                      <div key={i} className={`relative bg-[#0b0e14]/60 hover:bg-emerald-900/20 border-r border-b border-white/10 transition-colors h-16 flex ${score > 0 ? 'bg-emerald-900/40 shadow-[inset_0_0_20px_rgba(16,185,129,0.3)]' : ''} ${isCurrent ? 'ring-[1px] ring-emerald-500/50 z-10 bg-white/[0.02]' : ''}`}>
                        
                        <div className="relative group/min flex-1 flex items-center justify-between px-3 cursor-pointer">
                          <span className={`text-lg font-mono font-black transition-colors ${score > 0 ? 'text-emerald-400' : 'text-slate-500 group-hover/min:text-emerald-400'}`}>{minStr}</span>
                          
                          {score > 0 && (
                             <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[11px] font-black">
                                {score}
                             </div>
                          )}

                          {/* Tooltip Hover Histórico */}
                          {score > 0 && (
                            <div className={`absolute ${row < 5 ? 'top-full mt-2' : 'bottom-full mb-2'} ${col < 3 ? 'left-0' : 'right-0'} w-max opacity-0 invisible group-hover/min:opacity-100 group-hover/min:visible transition-all delay-[150ms] duration-200 z-[100]`}>
                              <div className="bg-[#0b0e14] border border-[#00c83a]/30 rounded-lg p-3 shadow-[0_0_20px_rgba(0,200,58,0.2)] backdrop-blur-md flex flex-col gap-1.5">
                                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest border-b border-emerald-500/20 pb-1 mb-1">Estratégias Indicando:</div>
                                {pred?.strats.map((stName, idx) => (
                                   <div key={idx} className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#00c83a]"></div>
                                      <span className="text-[11px] font-bold text-white">{stName}</span>
                                   </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
             </div>
          </div>

          {/* ESTRATÉGIAS CARDS (GRID INFERIOR) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {strats.map(strat => {
            const total = strat.wins + strat.losses;
            const winrate = total > 0 ? (strat.wins / total) * 100 : 0;
            const isHot = winrate > 59.0;

            return (
              <div key={strat.id} className="bg-[#0b0e14]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col relative overflow-hidden transition-all hover:border-white/10 group">
                {/* Accent Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 opacity-20 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: strat.color }}></div>
                
                {/* Header */}
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex flex-col">
                     <h3 className="text-lg font-black uppercase tracking-tighter" style={{ color: strat.color }}>{strat.name}</h3>
                     <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{strat.desc}</span>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Winrate Global</span>
                     <span className={`text-xl font-black ${isHot ? 'text-[#00c83a]' : 'text-gray-400'}`}>
                        {winrate.toFixed(1)}%
                     </span>
                  </div>
                </div>

                {/* Status Dashboard */}
                <div className="grid grid-cols-3 gap-3 mb-5 relative z-10">
                   <div className="bg-[#1a1d24]/50 border border-white/5 rounded-lg p-3 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Gatilhos</span>
                      <span className="text-lg font-black text-white">{total}</span>
                   </div>
                   <div className="bg-[#1a1d24]/50 border border-white/5 rounded-lg p-3 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">SA (Loss Atual)</span>
                      <span className={`text-lg font-black ${strat.sa > 0 ? 'text-red-400' : 'text-gray-400'}`}>{strat.sa}</span>
                   </div>
                   <div className="bg-[#1a1d24]/50 border border-white/5 rounded-lg p-3 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">SM (Máx Loss)</span>
                      <span className="text-lg font-black text-orange-400">{strat.sm}</span>
                   </div>
                </div>

                {/* Ciclo Atual Info */}
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#1a1d24]/80 to-transparent border-l-2 rounded-r-lg mb-5 relative z-10" style={{ borderColor: strat.color }}>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Estado do Ciclo (Macro)</span>
                      {strat.currentCycleType ? (
                         <div className="flex items-center gap-3">
                            <span className={`text-sm font-black uppercase ${strat.currentCycleType === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>
                               Após {strat.currentCycleCount} {strat.currentCycleType === 'W' ? 'WIN' : 'LOSS'}
                            </span>
                         </div>
                      ) : (
                         <span className="text-xs font-bold text-gray-500">Aguardando gatilhos...</span>
                      )}
                   </div>
                   {strat.currentCycleType && strat.currentCycleWinrate > 0 && (
                      <div className="flex flex-col items-end">
                         <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Winrate p/ Próximo</span>
                         <span className={`text-sm font-black ${strat.currentCycleWinrate >= 59.0 ? 'text-[#00c83a]' : 'text-yellow-400'}`}>
                           {strat.currentCycleWinrate.toFixed(1)}%
                         </span>
                      </div>
                   )}
                </div>

                {/* Live Status & Action */}
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                   <div className="flex items-center gap-2">
                      {strat.isTriggered ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md">
                           <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                           <span className="text-[11px] font-black text-red-400 uppercase tracking-widest">Entrada {strat.activeStep}/12</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-md text-gray-500">
                           <Activity size={14} />
                           <span className="text-[11px] font-bold uppercase tracking-widest">Monitorando...</span>
                        </div>
                      )}
                   </div>
                   
                   <button 
                      onClick={() => setSelectedCycles(strat)}
                      className="px-4 py-1.5 bg-[#1a1d24] hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-black uppercase tracking-widest text-white transition-colors flex items-center gap-2"
                   >
                     <History size={14} />
                     Ver Ciclos
                   </button>
                </div>

              </div>
            );
          })}
          </div>
      </div>

      {/* MODAL DE CICLOS */}
      <AnimatePresence>
      {selectedCycles && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0b0e14] border border-white/10 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="px-5 py-4 bg-[#1a1d24]/50 border-b border-white/5 flex justify-between items-center" style={{ borderTop: `2px solid ${selectedCycles.color}` }}>
                      <div className="flex flex-col">
                          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                              <History size={16} style={{ color: selectedCycles.color }} />
                              Ciclos de Eficiência: {selectedCycles.name}
                          </h3>
                          <span className="text-[11px] text-gray-400 font-medium mt-1">Estatística Condicional baseada nos gatilhos dos últimos 14.5 dias (~42.000 giros).</span>
                      </div>
                      <button onClick={() => setSelectedCycles(null)} className="text-gray-400 hover:text-white bg-white/5 p-2 rounded-lg transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col gap-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
                      
                      {/* Estado Atual no Modal */}
                      <div className="bg-[#1a1d24]/50 border border-white/5 rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex flex-col">
                              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Cenário Atual do Algoritmo</span>
                              {selectedCycles.currentCycleType ? (
                                  <div className="flex items-center gap-3">
                                      <span className={`text-lg font-black uppercase ${selectedCycles.currentCycleType === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>
                                          Após {selectedCycles.currentCycleCount} {selectedCycles.currentCycleType === 'W' ? 'WIN' : 'LOSS'}
                                      </span>
                                      <div className="h-4 w-px bg-white/20"></div>
                                      <span className="text-sm text-white font-bold">
                                          Winrate Previsto: <span className={selectedCycles.currentCycleWinrate >= 59.0 ? 'text-emerald-400' : 'text-red-400'}>{selectedCycles.currentCycleWinrate.toFixed(1)}%</span>
                                      </span>
                                  </div>
                              ) : (
                                  <span className="text-sm font-black text-gray-500">Aguardando gatilhos...</span>
                              )}
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Top Loss */}
                          <div className="flex flex-col gap-3">
                              <h4 className="text-[11px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2 border-b border-red-500/20 pb-2">
                                  <TrendingUp size={14} className="rotate-180" />
                                  Probabilidade Após LOSS
                              </h4>
                              <div className="flex flex-col gap-2">
                                  {selectedCycles.topLossCycles.map((c: any, idx: number) => (
                                      <div key={idx} className="flex justify-between items-center bg-[#1a1d24]/40 border border-white/5 p-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                                          <div className="flex items-center gap-3">
                                              <div className="w-6 h-6 rounded-md bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center text-[10px] font-black">
                                                  L{c.count}
                                              </div>
                                              <span className="text-xs font-bold text-gray-300">Após {c.count} Loss</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-xs font-bold">
                                              <span className="text-gray-500">Amostra: {c.total}</span>
                                              <span className={c.winrate >= 59.0 ? 'text-emerald-400' : 'text-gray-300'}>{c.winrate.toFixed(1)}%</span>
                                          </div>
                                      </div>
                                  ))}
                                  {selectedCycles.topLossCycles.length === 0 && (
                                      <div className="text-[10px] text-gray-500 text-center py-4 bg-white/5 rounded-lg border border-white/5">Sem dados estatísticos suficientes.</div>
                                  )}
                              </div>
                          </div>

                          {/* Top Win */}
                          <div className="flex flex-col gap-3">
                              <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                                  <TrendingUp size={14} />
                                  Probabilidade Após WIN
                              </h4>
                              <div className="flex flex-col gap-2">
                                  {selectedCycles.topWinCycles.map((c: any, idx: number) => (
                                      <div key={idx} className="flex justify-between items-center bg-[#1a1d24]/40 border border-white/5 p-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                                          <div className="flex items-center gap-3">
                                              <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center text-[10px] font-black">
                                                  W{c.count}
                                              </div>
                                              <span className="text-xs font-bold text-gray-300">Após {c.count} Win</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-xs font-bold">
                                              <span className="text-gray-500">Amostra: {c.total}</span>
                                              <span className={c.winrate >= 59.0 ? 'text-emerald-400' : 'text-gray-300'}>{c.winrate.toFixed(1)}%</span>
                                          </div>
                                      </div>
                                  ))}
                                  {selectedCycles.topWinCycles.length === 0 && (
                                      <div className="text-[10px] text-gray-500 text-center py-4 bg-white/5 rounded-lg border border-white/5">Sem dados estatísticos suficientes.</div>
                                  )}
                              </div>
                          </div>
                      </div>

                  </div>
              </motion.div>
          </motion.div>
      )}
      </AnimatePresence>

    </main>
  );
}
