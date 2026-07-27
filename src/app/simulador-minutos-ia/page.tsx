'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { useMinutosIa } from '@/hooks/useMinutosIa';

interface Roll { color: string; roll: number; timestamp: string; id?: string; }

// Design tokens
const CARD_BG = 'bg-[#0f141e]/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]';
const CARD_GREEN = 'bg-[#07130c]/90 backdrop-blur-xl border border-[#00c83a]/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]';

export default function SimuladorMinutosIAPage() {
  const [globalData, setGlobalData] = useState<Roll[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Estratégias desativadas por padrão (Desativando as 8 piores / poluidoras: 4, 5, 6, 8, 9, 10, 11, 12)
  const [disabledStrats, setDisabledStrats] = useState<Set<number>>(
    new Set([4, 5, 6, 8, 9, 10, 11, 12])
  );
  const [smartFilter, setSmartFilter] = useState(false);
  const [selectedStratCycles, setSelectedStratCycles] = useState<any>(null);

  // ═══ PERÍODO DE BACKTEST (janela de análise — alimenta useMinutosIa) ═══
  const [iaPeriodFilter, setIaPeriodFilter] = useState(24);

  // ═══ 1. WINRATE MICRO (GERAL) ═══
  const [microEnabled, setMicroEnabled] = useState(true);
  const [microMinWr, setMicroMinWr] = useState(35);
  const [microMaxWr, setMicroMaxWr] = useState(100);
  const [microHours, setMicroHours] = useState(3);

  // ═══ 2. WINRATE CICLO (MACRO) ═══
  const [macroEnabled, setMacroEnabled] = useState(true);
  const [macroMinWr, setMacroMinWr] = useState(40);
  const [macroMaxWr, setMacroMaxWr] = useState(100);
  const [macroHours, setMacroHours] = useState(24);

  // ═══ 3. WINRATE DO MINUTO ALVO (:MM) ═══
  const [minutoEnabled, setMinutoEnabled] = useState(false);
  const [minutoMinWr, setMinutoMinWr] = useState(35);
  const [minutoMaxWr, setMinutoMaxWr] = useState(100);
  const [minutoHours, setMinutoHours] = useState(6);

  // ═══ 4. CONFLUÊNCIA MÍNIMA (para o Placar Geral) ═══
  const [selectedConf, setSelectedConf] = useState(2);

  // ═══ 5. HISTÓRICO DE DIAS (DB fetch — quantos dados buscar) ═══
  const [historyDays, setHistoryDays] = useState(24);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ═══ 6. GESTÃO DE GALES ═══
  const [initialBet, setInitialBet] = useState(1.0);
  const [galeMultiplier, setGaleMultiplier] = useState(1.078);
  const [maxGales, setMaxGales] = useState(5); // 5 gales = 6 entradas

  // ═══ GESTÃO DE EXECUÇÃO DA SIMULAÇÃO (Auto vs Manual) ═══
  const [autoRun, setAutoRun] = useState<boolean>(false);

  // Configuração Ativa que alimenta o simulador
  const [activeConfig, setActiveConfig] = useState({
    iaPeriodFilter: 24,
    microEnabled: true,
    microMinWr: 35,
    microMaxWr: 100,
    microHours: 3,
    macroEnabled: true,
    macroMinWr: 40,
    macroMaxWr: 100,
    macroHours: 24,
    minutoEnabled: false,
    minutoMinWr: 35,
    minutoMaxWr: 100,
    minutoHours: 6,
    selectedConf: 2,
    initialBet: 1.0,
    galeMultiplier: 1.078,
    maxGales: 5
  });

  // Se autoRun === true, sincroniza activeConfig automaticamente ao alterar qualquer filtro
  useEffect(() => {
    if (autoRun) {
      setActiveConfig({
        iaPeriodFilter,
        microEnabled, microMinWr, microMaxWr, microHours,
        macroEnabled, macroMinWr, macroMaxWr, macroHours,
        minutoEnabled, minutoMinWr, minutoMaxWr, minutoHours,
        selectedConf,
        initialBet, galeMultiplier, maxGales
      });
    }
  }, [autoRun, iaPeriodFilter, microEnabled, microMinWr, microMaxWr, microHours, macroEnabled, macroMinWr, macroMaxWr, macroHours, minutoEnabled, minutoMinWr, minutoMaxWr, minutoHours, selectedConf, initialBet, galeMultiplier, maxGales]);

  // Handler do botão manual "Rodar Simulação"
  const handleRunManualSimulation = () => {
    const nextConfig = {
      iaPeriodFilter: historyDays,
      microEnabled, microMinWr, microMaxWr, microHours,
      macroEnabled, macroMinWr, macroMaxWr, macroHours,
      minutoEnabled, minutoMinWr, minutoMaxWr, minutoHours,
      selectedConf,
      initialBet, galeMultiplier, maxGales
    };
    setActiveConfig(nextConfig);
    fetchRollData(historyDays, microHours, macroHours);
  };

  const { subscribe } = useSSE();

  // ─── Cálculos de Gale ───────────────────────────────────────────
  const galeCosts = useMemo(() => {
    const costs: number[] = [];
    let bet = 1;
    for (let g = 0; g <= activeConfig.maxGales; g++) {
      costs.push(bet);
      bet *= activeConfig.galeMultiplier;
    }
    return costs;
  }, [activeConfig.galeMultiplier, activeConfig.maxGales]);

  const totalLossUnits = useMemo(() => galeCosts.reduce((a, b) => a + b, 0), [galeCosts]);
  const winProfitUnits = 13; // 14x - 1 custo ≈ constante com 1.078x

  // ─── Fetch de Dados por Período de Horas (Postgres) ───────────────
  // Busca (testHours + warmupHours) para que no ponto inicial T0 (ex: 2880 rodadas atrás)
  // as estatísticas deslizantes dos filtros Micro e Macro já tenham dados completos!
  const fetchRollData = (testHours: number, microH: number = microHours, macroH: number = macroHours) => {
    setLoadingHistory(true);
    const warmupHours = Math.max(microH, macroH, minutoHours, 24);
    const totalFetchHours = testHours + warmupHours;
    fetch(`/api/results/period?hours=${totalFetchHours}`)
      .then(res => res.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : data?.data;
        if (arr && Array.isArray(arr)) {
          const sorted = arr.sort((a: Roll, b: Roll) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setGlobalData(sorted);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    setIsMounted(true);
    fetchRollData(activeConfig.iaPeriodFilter, activeConfig.microHours, activeConfig.macroHours);
  }, []);

  useEffect(() => {
    const unsub = subscribe((newRoll) => {
      const mappedRoll = { ...newRoll, roll: Number(newRoll.roll) };
      setGlobalData(prevData => {
        const hasIdMatch = mappedRoll.id && prevData.some(r => r.id === mappedRoll.id);
        const hasTsMatch = !mappedRoll.id && prevData.some(r => r.timestamp === mappedRoll.timestamp && r.roll === mappedRoll.roll);
        if (hasIdMatch || hasTsMatch) return prevData;
        const merged = [...prevData, mappedRoll];
        if (merged.length > 100000) merged.shift();
        return merged;
      });
    });
    return unsub;
  }, [subscribe]);

  const handleSelectHistoryDays = (hours: number) => {
    setHistoryDays(hours);
    setIaPeriodFilter(hours);
    setActiveConfig(prev => ({ ...prev, iaPeriodFilter: hours }));
    fetchRollData(hours, microHours, macroHours);
  };

  // ─── Hook Principal da IA ──────────────────────────────────────
  const iaSignals = useMinutosIa(
    globalData as any,
    activeConfig.iaPeriodFilter,
    disabledStrats,
    true,
    smartFilter,
    { enabled: activeConfig.microEnabled, minWr: activeConfig.microMinWr, maxWr: activeConfig.microMaxWr, hours: activeConfig.microHours },
    { enabled: activeConfig.macroEnabled, minWr: activeConfig.macroMinWr, maxWr: activeConfig.macroMaxWr, hours: activeConfig.macroHours },
    { enabled: activeConfig.minutoEnabled, minWr: activeConfig.minutoMinWr, maxWr: activeConfig.minutoMaxWr, hours: activeConfig.minutoHours }
  );

  const toggleStrat = (idx: number) => {
    setDisabledStrats(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ─── PnL do Placar Geral (por confluência selecionada) ────────
  const selectedStat = iaSignals.stats.find(s => s.conf === activeConfig.selectedConf) || { conf: activeConfig.selectedConf, total: 0, wins: 0, winRate: 0, sa: 0, sm: 0 };
  const placarWins = selectedStat.wins;
  const placarLosses = selectedStat.total - selectedStat.wins;
  const placarPnlUnits = (placarWins * winProfitUnits) - (placarLosses * totalLossUnits);
  const placarPnlBrl = placarPnlUnits * activeConfig.initialBet;

  // ─── PnL Individual por Estratégia ────────────────────────────
  const stratPnl = useMemo(() => {
    return iaSignals.stratStats.map(st => {
      const losses = st.total - st.wins;
      const units = (st.wins * winProfitUnits) - (losses * totalLossUnits);
      return { units, brl: units * activeConfig.initialBet };
    });
  }, [iaSignals.stratStats, winProfitUnits, totalLossUnits, activeConfig.initialBet]);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-[#00c83a]/30 font-sans p-4 md:p-8">
      <div className="max-w-[1700px] mx-auto space-y-6">

        {/* ══════════════ CABEÇALHO PRINCIPAL ══════════════ */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#00c83a]/10 text-[#00c83a] border border-[#00c83a]/20">
                Simulador & Backtest
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest">
              Simulador — Minutos da IA
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-medium">
              Análise de confluências por minuto, histórico de disparos e simulação de estratégias da Inteligência Artificial.
            </p>
          </div>
        </div>

        {/* ══════════════ LAYOUT 3 COLUNAS: Grade + Filtros ══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ═══ COLUNAS 1-2: Grade de 60 Minutos (8 cols no LG) ═══ */}
          <div className="lg:col-span-8">
            <div className={`${CARD_BG} border-[#00c83a]/25 flex flex-col`}>

              {/* Header da Grade */}
              <div className="px-5 py-4 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a] rounded-t-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse"></div>
                  <span className="text-[12px] font-black uppercase tracking-widest text-white">
                    Minutos Quentes da IA (Grade 60 Minutos)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Badge Estratégias Ativas com Tooltip */}
                  <div className="group/tooltip relative">
                    <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-500/30 font-black tracking-widest cursor-help uppercase">
                      {iaSignals.activeStrats.length - iaSignals.disabledStrats.size} Ativas
                    </span>
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[#0b0e14] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50">
                      <div className="text-[9px] uppercase font-black text-slate-400 mb-2 tracking-wider">Estratégias Em Operação:</div>
                      <ul className="flex flex-col gap-1.5">
                        {iaSignals.stratStats.map((strat, idx) => (
                          <li key={idx} className={`flex items-center justify-between ${iaSignals.disabledStrats.has(idx) ? 'opacity-30' : ''}`}>
                            <div className="text-[10px] text-slate-300 font-bold flex items-center gap-1.5 flex-1 pr-2 truncate">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${iaSignals.disabledStrats.has(idx) ? 'bg-red-400' : 'bg-cyan-400'}`}></div>
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

                  {/* Dropdown Período (Backtest) */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Período:</span>
                    <select
                      className="bg-[#0b0e14] border border-white/10 text-white text-[10px] px-2.5 py-1 rounded-lg outline-none cursor-pointer font-bold"
                      value={iaPeriodFilter}
                      onChange={(e) => setIaPeriodFilter(+e.target.value)}
                    >
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
              </div>

              {/* Barra de Resumo de Confluências */}
              <div className="w-full p-3 bg-[#0b0c10]/80 border-b border-white/5 flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {iaSignals.stats.map((st, idx) => (
                  <div key={idx} className="flex-1 shrink-0 bg-[#0f141e] border border-white/5 rounded-lg px-2.5 py-2 flex flex-col items-center justify-center min-w-[70px]">
                    <span className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Confl. {st.conf}+</span>
                    <span className={`text-sm font-black ${st.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>{st.winRate.toFixed(1)}%</span>
                    <div className="flex gap-2 mt-1 text-[9px] font-mono font-bold text-slate-500">
                      <span>SA:{st.sa}</span>
                      <span>SM:{st.sm}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grade de 60 Minutos (6 colunas × 10 linhas) com Tooltips */}
              <div className="p-4 bg-black/40">
                <div className="grid grid-cols-6 gap-0 border-t border-l border-white/10 rounded-xl overflow-hidden shadow-2xl">
                  {Array.from({ length: 60 }).map((_, i) => {
                    const col = i % 6;
                    const row = Math.floor(i / 6);
                    const min = col * 10 + row;
                    const minStr = String(min).padStart(2, '0');
                    const score = iaSignals.scores[min];
                    return (
                      <div key={i} className={`relative bg-[#0b0e14]/60 hover:bg-cyan-950/30 border-r border-b border-white/10 transition-colors h-11 flex items-center justify-between px-3 ${score >= 3 ? 'bg-cyan-950/50 shadow-[inset_0_0_15px_rgba(6,182,212,0.3)]' : ''}`}>

                        {/* Número do Minuto com Tooltip Histórico 12h */}
                        <div className="relative group/min flex items-center cursor-pointer">
                          <span className={`text-[12px] font-mono font-black transition-colors ${score > 0 ? 'text-cyan-400' : 'text-slate-500 group-hover/min:text-cyan-300'}`}>{minStr}</span>

                          {iaSignals.history12h && (
                            <div className={`absolute ${row < 5 ? 'top-full mt-2' : 'bottom-full mb-2'} ${col < 3 ? 'left-0' : 'right-0'} w-max opacity-0 invisible group-hover/min:opacity-100 group-hover/min:visible transition-all delay-[400ms] duration-200 z-[100]`}>
                              <div className="bg-[#0b0e14] border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md">
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
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Histórico 12h (Minuto :{minStr})</div>
                                        <div className={`text-[11px] font-black ${wins >= 5 ? 'text-emerald-400' : 'text-amber-400'}`}>Win {wr}%</div>
                                      </div>
                                      <div className="grid grid-cols-4 gap-1.5">
                                        {history.map((h, hIdx) => (
                                          <div key={hIdx} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${h.hit ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {h.hourString.replace('h', '')}
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Badge Score de Confluência + Tooltip de Estratégias */}
                        <div className="relative group/score flex items-center cursor-pointer">
                          <div className={`min-w-[24px] h-[20px] rounded px-1.5 transition-colors flex items-center justify-center ${score > 0 ? (score >= 3 ? 'bg-cyan-400 text-black font-black shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'bg-cyan-900/60 text-cyan-300 font-bold border border-cyan-500/30') : 'bg-slate-800/40 text-slate-600'}`}>
                            <span className="text-[10px] font-mono">{score > 0 ? score : '-'}</span>
                          </div>

                          {score > 0 && iaSignals.activeStratsByMin && iaSignals.activeStratsByMin[min]?.length > 0 && (
                            <div className={`absolute ${row < 5 ? 'top-full mt-2' : 'bottom-full mb-2'} ${col < 3 ? 'left-0' : 'right-0'} w-max opacity-0 invisible group-hover/score:opacity-100 group-hover/score:visible transition-all delay-[300ms] duration-200 z-[100]`}>
                              <div className="bg-[#0b0e14] border border-cyan-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-md min-w-[220px]">
                                <div className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-2 border-b border-cyan-500/20 pb-1.5 flex justify-between">
                                  <span>Confluência Minuto :{minStr}</span>
                                  <span className="text-white">{iaSignals.activeStratsByMin[min].length} Estratégias</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  {iaSignals.activeStratsByMin[min].map(sIdx => {
                                    const sName = iaSignals.activeStrats[sIdx];
                                    const sInfo = iaSignals.stratStats.find(s => s.name === sName) || { winRate: 0, name: sName };
                                    return (
                                      <div key={sIdx} className="flex justify-between items-center bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                                        <div className="text-[9px] text-slate-300 font-bold max-w-[130px] truncate">{sInfo.name}</div>
                                        <span className="text-cyan-400 text-[9px] font-mono font-bold">{sInfo.winRate.toFixed(0)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mt-3 px-1">
                  <span className="font-mono">Total analisado: {globalData.length} rodadas</span>
                  <span className="font-mono">Período: {iaPeriodFilter}h</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ COLUNA 3: Painel de Filtros (4 cols no LG) ═══ */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className={`${CARD_GREEN} p-5 flex flex-col gap-4 font-sans`}>

              {/* Cabeçalho do Painel com Modo Auto/Manual */}
              <div className="flex flex-col gap-3 border-b border-white/10 pb-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#00c83a]"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    Filtros do Simulador
                  </h3>

                  {/* Toggle de Recálculo Automático */}
                  <button 
                    onClick={() => setAutoRun(!autoRun)}
                    className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${autoRun ? 'bg-[#00c83a]/20 text-[#00c83a] border-[#00c83a]/40' : 'bg-white/5 text-gray-400 border-white/10'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${autoRun ? 'bg-[#00c83a] animate-pulse' : 'bg-gray-500'}`}></span>
                    {autoRun ? 'Auto: ON' : 'Auto: OFF'}
                  </button>
                </div>

                {/* Botão Principal para Rodar Simulação Manualmente */}
                <button
                  onClick={handleRunManualSimulation}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black font-black uppercase text-xs tracking-widest rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Rodar Simulação
                </button>
              </div>

              {/* FILTRO 1: Winrate Micro (Geral) */}
              <div className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-all ${microEnabled ? 'bg-[#050b07] border-[#00c83a]/30' : 'bg-[#050b07]/40 border-white/5 opacity-60'}`}>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">1. Winrate Micro (Geral)</span>
                  <button onClick={() => setMicroEnabled(p => !p)} className={`px-2.5 py-0.5 text-[9px] font-black rounded-md uppercase tracking-widest transition-colors ${microEnabled ? 'bg-[#00c83a]/20 text-[#00c83a] border border-[#00c83a]/40' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>
                    {microEnabled ? 'ATIVADO' : 'DESATIVADO'}
                  </button>
                </div>
                {microEnabled && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">HORAS</label>
                      <select value={microHours} onChange={e => setMicroHours(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center cursor-pointer">
                        <option value={1}>1h</option>
                        <option value={2}>2h</option>
                        <option value={3}>3h</option>
                        <option value={6}>6h</option>
                        <option value={12}>12h</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">MIN WR %</label>
                      <input type="number" value={microMinWr} onChange={e => setMicroMinWr(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">MAX WR %</label>
                      <input type="number" value={microMaxWr} onChange={e => setMicroMaxWr(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                    </div>
                  </div>
                )}
              </div>

              {/* FILTRO 2: Winrate Ciclo (Macro) */}
              <div className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-all ${macroEnabled ? 'bg-[#050b07] border-[#00c83a]/30' : 'bg-[#050b07]/40 border-white/5 opacity-60'}`}>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">2. Winrate Ciclo (Macro)</span>
                  <button onClick={() => setMacroEnabled(p => !p)} className={`px-2.5 py-0.5 text-[9px] font-black rounded-md uppercase tracking-widest transition-colors ${macroEnabled ? 'bg-[#00c83a]/20 text-[#00c83a] border border-[#00c83a]/40' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>
                    {macroEnabled ? 'ATIVADO' : 'DESATIVADO'}
                  </button>
                </div>
                {macroEnabled && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">PERÍODO</label>
                      <select value={macroHours} onChange={e => setMacroHours(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center cursor-pointer">
                        <option value={12}>12h</option>
                        <option value={24}>24h (1d)</option>
                        <option value={48}>48h (2d)</option>
                        <option value={72}>72h (3d)</option>
                        <option value={120}>120h (5d)</option>
                        <option value={168}>168h (7d)</option>
                        <option value={360}>360h (15d)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">MIN WR %</label>
                      <input type="number" value={macroMinWr} onChange={e => setMacroMinWr(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">MAX WR %</label>
                      <input type="number" value={macroMaxWr} onChange={e => setMacroMaxWr(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                    </div>
                  </div>
                )}
              </div>

              {/* FILTRO 3: Winrate do Minuto Alvo (:MM) */}
              <div className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-all ${minutoEnabled ? 'bg-[#050b07] border-[#00c83a]/30' : 'bg-[#050b07]/40 border-white/5 opacity-60'}`}>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">3. Winrate do Minuto (:MM)</span>
                  <button onClick={() => setMinutoEnabled(p => !p)} className={`px-2.5 py-0.5 text-[9px] font-black rounded-md uppercase tracking-widest transition-colors ${minutoEnabled ? 'bg-[#00c83a]/20 text-[#00c83a] border border-[#00c83a]/40' : 'bg-slate-800 text-slate-400 border border-white/10'}`}>
                    {minutoEnabled ? 'ATIVADO' : 'DESATIVADO'}
                  </button>
                </div>
                {minutoEnabled && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">HORAS</label>
                      <select value={minutoHours} onChange={e => setMinutoHours(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center cursor-pointer">
                        <option value={1}>1h</option>
                        <option value={2}>2h</option>
                        <option value={3}>3h</option>
                        <option value={6}>6h</option>
                        <option value={12}>12h</option>
                        <option value={24}>24h (1d)</option>
                        <option value={72}>72h (3d)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">MIN WR %</label>
                      <input type="number" value={minutoMinWr} onChange={e => setMinutoMinWr(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">MAX WR %</label>
                      <input type="number" value={minutoMaxWr} onChange={e => setMinutoMaxWr(Number(e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                    </div>
                  </div>
                )}
              </div>

              {/* FILTRO 4: Confluência Mínima (afeta apenas o Placar Geral) */}
              <div className="p-3.5 bg-[#050b07] rounded-xl border border-[#00c83a]/30 flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">4. Confluência Mínima</span>
                  <span className="text-[10px] font-bold text-[#00c83a]">Mínimo {selectedConf}+</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(c => (
                    <button key={c} onClick={() => setSelectedConf(c)} className={`py-1.5 text-xs font-black rounded-lg border transition-all ${selectedConf === c ? 'bg-[#00c83a] text-black border-[#00c83a] shadow-[0_0_12px_rgba(0,200,58,0.4)]' : 'bg-[#09120c] text-slate-400 border-white/5 hover:text-white'}`}>
                      {c}+
                    </button>
                  ))}
                </div>
              </div>

              {/* FILTRO 5: Histórico de Dias (DB Fetch) */}
              <div className="p-3.5 bg-[#050b07] rounded-xl border border-[#00c83a]/30 flex flex-col gap-2">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">5. Histórico de Dias</span>
                  <span className="text-[10px] font-bold text-cyan-400 font-mono">
                    {loadingHistory ? 'Carregando...' : `${globalData.length} rodadas`}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { label: '1 Dia', hours: 24 },
                    { label: '3 Dias', hours: 72 },
                    { label: '7 Dias', hours: 168 },
                    { label: '15 Dias', hours: 360 },
                    { label: '30 Dias', hours: 720 }
                  ].map(p => (
                    <button key={p.hours} onClick={() => handleSelectHistoryDays(p.hours)} className={`py-1.5 text-[9px] font-black rounded-lg border transition-all cursor-pointer ${historyDays === p.hours ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]' : 'bg-[#09120c] text-slate-400 border-white/5 hover:text-white'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* FILTRO 6: Gestão de Gales */}
              <div className="p-3.5 bg-[#050b07] rounded-xl border border-[#00c83a]/30 flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">6. Gestão de Gales</span>
                  <span className="text-[10px] font-bold text-amber-400 font-mono">{maxGales + 1} entradas/sinal</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">1ª Mão (R$)</label>
                    <input type="number" step="0.5" value={initialBet} onChange={e => setInitialBet(Math.max(0.5, +e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Mult. Gale</label>
                    <input type="number" step="0.001" value={galeMultiplier} onChange={e => setGaleMultiplier(Math.max(1, +e.target.value))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Max Gales</label>
                    <input type="number" value={maxGales} onChange={e => setMaxGales(Math.max(0, Math.min(20, +e.target.value)))} className="w-full bg-[#09120c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold focus:border-[#00c83a] outline-none text-center" />
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 font-mono text-center bg-[#09120c] px-2 py-1.5 rounded border border-white/5">
                  Win: +{winProfitUnits} un | Loss: -{totalLossUnits.toFixed(2)} un | Por sinal: {maxGales + 1} entradas (3 minutos × 2)
                </div>
              </div>

              {/* Botões Rápidos */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                <button onClick={() => setDisabledStrats(new Set())} className="py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all">
                  Ativar Todas
                </button>
                <button onClick={() => setDisabledStrats(new Set(Array.from({ length: 13 }, (_, i) => i)))} className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all">
                  Desativar Todas
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ PLACAR GERAL (respeita confluência selecionada) ══════════════ */}
        <div className={`${CARD_BG} border-emerald-500/25 p-5 flex flex-col gap-4 border-t-[2px] border-t-emerald-500`}>
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              Placar de Desempenho — Confluência {selectedConf}+
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">{iaPeriodFilter}h de Backtest | {globalData.length} rodadas</span>
          </div>

          {/* Cards PnL e Winrate */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0b0c10] border border-white/5 p-3 rounded-lg flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Lucro Líquido (PnL)</span>
              <span className={`text-xl font-black mt-1 font-mono ${placarPnlBrl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {placarPnlBrl >= 0 ? `+R$ ${placarPnlBrl.toFixed(2)}` : `-R$ ${Math.abs(placarPnlBrl).toFixed(2)}`}
              </span>
              <span className="text-[9px] text-slate-500 mt-0.5 font-mono">({placarPnlUnits >= 0 ? '+' : ''}{placarPnlUnits.toFixed(1)} unidades)</span>
            </div>

            <div className="bg-[#0b0c10] border border-white/5 p-3 rounded-lg flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Assertividade (Winrate)</span>
              <span className={`text-xl font-black mt-1 font-mono ${selectedStat.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {selectedStat.winRate.toFixed(1)}%
              </span>
            </div>

            <div className="bg-[#0b0c10] border border-white/5 p-3 rounded-lg flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Sem Acerto Atual (SA)</span>
              <span className={`text-xl font-black mt-1 font-mono ${selectedStat.sa >= 3 ? 'text-red-400' : 'text-white'}`}>
                {selectedStat.sa}x
              </span>
            </div>

            <div className="bg-[#0b0c10] border border-white/5 p-3 rounded-lg flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Sem Acerto Máximo (SM)</span>
              <span className="text-xl font-black mt-1 font-mono text-amber-400">
                {selectedStat.sm}x
              </span>
            </div>
          </div>

          {/* Placar Wins / Losses */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono font-bold bg-[#0b0c10] p-2.5 rounded-lg border border-white/5">
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-500 uppercase">Sinais</span>
              <span className="text-white font-black">{selectedStat.total}</span>
            </div>
            <div className="flex flex-col border-x border-white/10">
              <span className="text-[9px] text-emerald-400 uppercase">Wins</span>
              <span className="text-emerald-400 font-black">{placarWins}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-red-400 uppercase">Losses</span>
              <span className="text-red-400 font-black">{placarLosses}</span>
            </div>
          </div>
        </div>

        {/* ══════════════ CARDS INDIVIDUAIS DE ESTRATÉGIA ══════════════ */}
        <div className="pt-6 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                <span className="w-2.5 h-7 bg-cyan-400 rounded-sm shadow-[0_0_10px_rgba(34,211,238,0.5)]"></span>
                Estratégias Integradas da IA ({iaSignals.stratStats.length})
              </h2>
              <p className="text-slate-400 text-xs mt-1 font-medium">
                Cada estratégia com PnL individual, winrate, ciclos e indicador de filtro ativo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {iaSignals.stratStats.map((strat, idx) => {
              const isManuallyDisabled = disabledStrats.has(idx);
              const isAutoFiltered = iaSignals.disabledStrats.has(idx) && !isManuallyDisabled;
              const isDisabled = isManuallyDisabled || isAutoFiltered;
              const pnl = stratPnl[idx];
              const losses = strat.total - strat.wins;

              return (
                <div
                  key={idx}
                  className={`bg-[#07130c]/90 border rounded-2xl p-5 flex flex-col transition-all font-sans relative ${
                    isManuallyDisabled
                      ? 'border-red-500/30 opacity-40 grayscale'
                      : isAutoFiltered
                      ? 'border-amber-500/30 opacity-60'
                      : 'border-[#00c83a]/30 hover:border-[#00c83a]/60 shadow-[0_0_20px_rgba(0,200,58,0.08)]'
                  }`}
                >
                  {/* Header: Nome + Status */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-black text-[#00c83a] uppercase tracking-wider max-w-[160px] truncate">{strat.name}</span>
                    <button
                      onClick={() => toggleStrat(idx)}
                      className={`px-2 py-0.5 text-[9px] font-black rounded-lg uppercase tracking-widest transition-colors ${
                        isManuallyDisabled
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : isAutoFiltered
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-[#00c83a]/20 text-[#00c83a] border border-[#00c83a]/40'
                      }`}
                    >
                      {isManuallyDisabled ? 'DESATIVADO' : isAutoFiltered ? 'FILTRADO' : 'ATIVO'}
                    </button>
                  </div>

                  {/* Badge se filtrado por WR */}
                  {isAutoFiltered && (
                    <div className="text-[8px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 mb-2 text-center uppercase tracking-widest">
                      Filtrado por Winrate (Micro/Macro)
                    </div>
                  )}

                  {/* Winrate Principal + PnL */}
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black tracking-tight ${strat.winRate >= 50 ? 'text-[#00c83a]' : 'text-amber-400'}`}>{strat.winRate.toFixed(1)}%</span>
                      <span className="text-[10px] font-bold text-slate-400">Win</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-black font-mono ${pnl.brl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl.brl >= 0 ? `+R$${pnl.brl.toFixed(2)}` : `-R$${Math.abs(pnl.brl).toFixed(2)}`}
                      </span>
                      <span className="text-[8px] text-slate-500 font-mono">({pnl.units >= 0 ? '+' : ''}{pnl.units.toFixed(1)} un)</span>
                    </div>
                  </div>

                  {/* Placar W/L + SA/SM */}
                  <div className="flex justify-between items-center text-xs font-bold mb-3 border-b border-white/5 pb-3">
                    <div className="flex gap-3">
                      <span className="text-[#00c83a] font-mono">{strat.wins} W</span>
                      <span className="text-red-400 font-mono">{losses} L</span>
                    </div>
                    <div className="flex gap-2 text-[9px] font-mono text-slate-400">
                      <span>SA:<span className={`font-black ml-0.5 ${strat.sa >= 3 ? 'text-red-400' : 'text-white'}`}>{strat.sa}</span></span>
                      <span>SM:<span className="font-black ml-0.5 text-amber-400">{strat.sm}</span></span>
                    </div>
                  </div>

                  {/* Winrate Micro e Ciclo */}
                  <div className="grid grid-cols-2 gap-1.5 text-[9px] mb-3">
                    <div className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-400 font-bold">Micro ({microHours}h):</span>
                      <span className={`font-black font-mono ${strat.winRateMicro >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>{strat.winRateMicro.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-400 font-bold">Ciclo ({macroHours >= 24 ? `${Math.round(macroHours/24)}d` : `${macroHours}h`}):</span>
                      <span className={`font-black font-mono ${strat.winRateCiclo >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>{strat.winRateCiclo.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Sequência de Ciclos */}
                  <div className="flex items-center gap-1.5 mb-4 overflow-x-auto py-1">
                    {strat.groupedCycles && strat.groupedCycles.length > 0 ? (
                      strat.groupedCycles.slice(-7).map((cy, cIdx, arr) => {
                        const isLast = cIdx === arr.length - 1;
                        return (
                          <div key={cIdx} className="flex flex-col items-center gap-1 shrink-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${cy.type === 'W' ? 'bg-[#00c83a]/15 text-[#00c83a] border-[#00c83a]/40' : 'bg-red-500/15 text-red-400 border-red-500/40'} ${isLast ? 'ring-2 ring-white shadow-[0_0_10px_#fff]' : ''}`}>
                              {cy.count}
                            </div>
                            {isLast && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#fff]"></div>}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-500 italic py-1">Sem histórico</span>
                    )}
                  </div>

                  {/* Rodapé: Estado Atual + Análise de Ciclos */}
                  <div className="flex items-end justify-between mt-auto pt-2 border-t border-white/5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">ESTADO ATUAL</span>
                      <span className="text-[11px] font-black">
                        {strat.currentCycleState?.type ? (
                          <span className={strat.currentCycleState.type === 'W' ? 'text-[#00c83a]' : 'text-red-400'}>
                            {strat.currentCycleState.count} {strat.currentCycleState.type === 'W' ? 'Win' : 'Loss'}{' '}
                            <span className="text-slate-400 font-bold text-[9px]">({strat.currentCycleWinrate.toFixed(0)}%)</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 font-bold">Aguardando</span>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedStratCycles(strat)}
                      className="px-2.5 py-1.5 bg-[#142219] hover:bg-[#1a2d21] text-white border border-white/10 hover:border-white/30 rounded-xl text-[9px] font-bold uppercase transition-all shrink-0"
                    >
                      Ciclos
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════ MODAL: Análise de Ciclos ══════════════ */}
      {selectedStratCycles && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0a120c] border border-[#00c83a]/40 w-full max-w-2xl rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col gap-6 relative overflow-hidden font-sans">

            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00c83a] shadow-[0_0_10px_#00c83a]"></span>
                  ANÁLISE DE CICLOS: {selectedStratCycles.name}
                </h3>
                <p className="text-slate-400 text-xs mt-1">Estatísticas de conversão baseadas em sequências de resultados.</p>
              </div>
              <button onClick={() => setSelectedStratCycles(null)} className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors border border-white/10">✕</button>
            </div>

            {/* Estado Atual */}
            <div className="p-4 bg-[#121e16] rounded-xl border border-white/5 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ESTADO ATUAL</span>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className={`text-xl font-black uppercase ${selectedStratCycles.currentCycleState?.type === 'W' ? 'text-[#00c83a]' : 'text-red-400'}`}>
                    APÓS {selectedStratCycles.currentCycleState?.count || 0} {selectedStratCycles.currentCycleState?.type === 'W' ? 'WIN' : 'LOSS'}
                  </span>
                  <span className="text-white text-sm font-bold border-l border-white/20 pl-3">
                    Winrate: <span className={selectedStratCycles.currentCycleWinrate >= 50 ? 'text-[#00c83a] font-black' : 'text-amber-400 font-black'}>{selectedStratCycles.currentCycleWinrate.toFixed(1)}%</span>
                  </span>
                </div>
              </div>
              <div className="bg-[#090f0b] p-3 rounded-lg border border-white/5 flex items-center gap-4 text-center">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Ocorrências</span>
                  <span className="text-white text-sm font-black">{selectedStratCycles.currentCycleOccurrences}x</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Wins</span>
                  <span className="text-[#00c83a] text-sm font-black">{selectedStratCycles.currentCycleWins}x</span>
                </div>
              </div>
            </div>

            {/* Histórico de Ciclos */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">HISTÓRICO DE CICLOS (CRONOLÓGICO)</span>
              <div className="flex items-center gap-2 p-4 bg-[#121e16] rounded-xl border border-white/5 overflow-x-auto">
                {selectedStratCycles.groupedCycles && selectedStratCycles.groupedCycles.length > 0 ? (
                  selectedStratCycles.groupedCycles.map((cy: any, idx: number, arr: any[]) => {
                    const isLast = idx === arr.length - 1;
                    return (
                      <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${cy.type === 'W' ? 'bg-[#00c83a]/20 text-[#00c83a] border-[#00c83a]/40' : 'bg-red-500/20 text-red-400 border-red-500/40'} ${isLast ? 'ring-2 ring-white shadow-[0_0_12px_#fff]' : ''}`}>
                          {cy.count}
                        </div>
                        {isLast && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#fff]"></div>}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-500 italic">Sem histórico de ciclos registrado.</span>
                )}
              </div>
            </div>

            {/* Rodapé */}
            <div className="flex justify-end pt-2 border-t border-white/10">
              <button onClick={() => setSelectedStratCycles(null)} className="py-2.5 px-6 bg-[#00c83a] text-black hover:bg-[#00e041] font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(0,200,58,0.4)]">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
