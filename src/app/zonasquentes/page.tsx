'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { VisaoCoresTab } from '@/components/painel-master/VisaoCoresTab';
import { runZonasQuentesSimulation, ZonasSimConfig, ZonasSimResult } from '@/hooks/engine/simulators/simulateZonasQuentes';

interface Roll { color: string; roll: number; timestamp: string; id?: string; }

export default function ZonasQuentesStandalonePage() {
  const { subscribe } = useSSE();
  const [globalData, setGlobalData] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);

  // Modo de Execução do Simulador (Manual vs Automático)
  const [autoRun, setAutoRun] = useState<boolean>(false);
  const [manualTriggerCount, setManualTriggerCount] = useState<number>(0);

  // Toggles de Ativação Individual dos Filtros
  const [enableGeral, setEnableGeral] = useState<boolean>(true);
  const [enableCiclo, setEnableCiclo] = useState<boolean>(true);
  const [enableMetaCiclo, setEnableMetaCiclo] = useState<boolean>(true);

  // Configuração dos Filtros do Simulador
  const [enabledZones, setEnabledZones] = useState<number[]>([0, 1, 2, 3, 4, 5]); // Todas as 6 zonas ativas por padrão
  const [zonaLen, setZonaLen] = useState<number>(5); // 5 pedras por disparo
  const [geralHours, setGeralHours] = useState<number>(3); // 3h Micro
  const [geralMinWr, setGeralMinWr] = useState<number>(35); // 35% Winrate Micro
  const [cicloHours, setCicloHours] = useState<number>(24); // 24h Ciclo
  const [cicloMinWr, setCicloMinWr] = useState<number>(40); // 40% Winrate Ciclo
  const [metaCicloDays, setMetaCicloDays] = useState<number>(3); // 3 dias Meta-Ciclo
  const [metaCicloMinWr, setMetaCicloMinWr] = useState<number>(50); // 50% Winrate Meta-Ciclo
  const [initialBet, setInitialBet] = useState<number>(1.0); // R$ 1.00
  const [galeMultiplier, setGaleMultiplier] = useState<number>(1.078); // Multiplicador 1.078x
  const [maxGales, setMaxGales] = useState<number>(39); // 39 gales (40 entradas no total)

  // Período de Histórico do Simulador (3, 5, 7, 15 ou 30 dias)
  const [simHistoryDays, setSimHistoryDays] = useState<number>(15);

  useEffect(() => {
    setLoading(true);
    const hours = simHistoryDays * 24;
    // Busca N dias de histórico
    fetch(`/api/results/period?hours=${hours}`)
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.data)) {
          setGlobalData(d.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Inscreve no feed em tempo real
    const unsub = subscribe((roll: any) => {
      setGlobalData(prev => {
        if (prev.some(r => r.id === roll.id || r.timestamp === roll.timestamp)) return prev;
        const newArr = [roll, ...prev];
        if (newArr.length > 100000) newArr.pop();
        return newArr;
      });
    });

    return () => {
      unsub();
    };
  }, [simHistoryDays, subscribe]);

  // Configuração Ativa da Simulação (sincronizada via Auto ou Botão Manual)
  const [activeConfig, setActiveConfig] = useState<ZonasSimConfig>({
    enabledZones: [0, 1, 2, 3, 4, 5],
    zonaLen: 5,
    enableGeral: true,
    geralHours: 3,
    geralMinWr: 35,
    enableCiclo: true,
    cicloHours: 24,
    cicloMinWr: 40,
    enableMetaCiclo: true,
    metaCicloDays: 3,
    metaCicloMinWr: 50,
    initialBet: 1.0,
    galeMultiplier: 1.078,
    maxGales: 39
  });

  // Se Auto: ON, atualiza activeConfig a cada mudança de parâmetro
  useEffect(() => {
    if (autoRun) {
      setActiveConfig({
        enabledZones,
        zonaLen,
        enableGeral,
        geralHours,
        geralMinWr,
        enableCiclo,
        cicloHours,
        cicloMinWr,
        enableMetaCiclo,
        metaCicloDays,
        metaCicloMinWr,
        initialBet,
        galeMultiplier,
        maxGales
      });
    }
  }, [
    autoRun,
    enabledZones,
    zonaLen,
    enableGeral,
    geralHours,
    geralMinWr,
    enableCiclo,
    cicloHours,
    cicloMinWr,
    enableMetaCiclo,
    metaCicloDays,
    metaCicloMinWr,
    initialBet,
    galeMultiplier,
    maxGales
  ]);

  // Ao clicar no botão "Rodar Simulação", atualiza activeConfig manualmente
  const handleRunManualSimulation = () => {
    setActiveConfig({
      enabledZones,
      zonaLen,
      enableGeral,
      geralHours,
      geralMinWr,
      enableCiclo,
      cicloHours,
      cicloMinWr,
      enableMetaCiclo,
      metaCicloDays,
      metaCicloMinWr,
      initialBet,
      galeMultiplier,
      maxGales
    });
  };

  // Executa o simulador com array de dependências fixo [globalData, activeConfig]
  const simResult: ZonasSimResult = useMemo(() => {
    if (!globalData || globalData.length < 100) {
      return {
        totalSignals: 0,
        wins: 0,
        redsTotal: 0,
        winrate: 0,
        totalPnl: 0,
        maxWinStreak: 0,
        maxLossStreak: 0,
        currentStreak: { type: 'W', count: 0 },
        trades: []
      };
    }

    return runZonasQuentesSimulation(globalData, activeConfig);
  }, [globalData, activeConfig]);

  const toggleZone = (zIdx: number) => {
    setEnabledZones(prev => {
      if (prev.includes(zIdx)) {
        return prev.filter(i => i !== zIdx);
      } else {
        return [...prev, zIdx].sort((a, b) => a - b);
      }
    });
  };

  const zoneNames = useMemo(() => {
    return Array.from({ length: 6 }, (_, z) => {
      const s = 1 + z * zonaLen;
      const e = (z + 1) * zonaLen;
      return `Casa ${s} a ${e}`;
    });
  }, [zonaLen]);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white overflow-x-hidden font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-[1700px] mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Radar & Simulador Mestre 3 Colunas
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white">
              Zonas Quentes + Backtest no Passado
            </h1>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Análise em tempo real e simulação retroativa pedra por pedra com gestão de filtros e gales persistentes.
            </p>
          </div>
        </div>

        {/* Conteúdo Principal em 3 Colunas */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#0f141e]/50 border border-white/5 rounded-xl">
            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Carregando histórico analítico (15 dias)...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUNA 1: Ferramenta Visual Zonas Quentes (4 colunas no LG) */}
            <div className="lg:col-span-4 w-full">
              <VisaoCoresTab globalData={globalData} onlyZonasQuentes={true} zonaLen={zonaLen} />
            </div>

            {/* COLUNA 2: Placar & Resultados do Simulador (4 colunas no LG) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-emerald-500/25 rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4 border-t-[2px] border-t-emerald-500">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    Placar de Desempenho
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">{simHistoryDays} Dias de Dados</span>
                </div>

                {/* Cards PnL e Winrate */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0b0c10] border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Lucro Líquido (PnL)</span>
                    <span className={`text-xl font-black mt-1 font-mono ${simResult.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {simResult.totalPnl >= 0 ? `+R$ ${simResult.totalPnl.toFixed(2)}` : `-R$ ${Math.abs(simResult.totalPnl).toFixed(2)}`}
                    </span>
                  </div>

                  <div className="bg-[#0b0c10] border border-white/5 p-3 rounded-lg flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Assertividade (Winrate)</span>
                    <span className={`text-xl font-black mt-1 font-mono ${simResult.winrate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {simResult.winrate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Placar Wins / Reds */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono font-bold bg-[#0b0c10] p-2.5 rounded-lg border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 uppercase">Sinais</span>
                    <span className="text-white font-black">{simResult.totalSignals}</span>
                  </div>
                  <div className="flex flex-col border-x border-white/10">
                    <span className="text-[9px] text-emerald-400 uppercase">Wins</span>
                    <span className="text-emerald-400 font-black">{simResult.wins}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-red-400 uppercase">Reds Totais</span>
                    <span className="text-red-400 font-black">{simResult.redsTotal}</span>
                  </div>
                </div>

                {/* Sequências */}
                <div className="flex justify-between items-center text-[10px] font-mono text-gray-300 bg-white/5 px-3 py-2 rounded">
                  <span>Maior Seq. Greens: <strong className="text-emerald-400">{simResult.maxWinStreak}x</strong></span>
                  <span>Maior Seq. Reds: <strong className="text-red-400">{simResult.maxLossStreak}x</strong></span>
                </div>

                {/* Lista de Trades / Entradas */}
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-white/5 pb-1">
                    Histórico de Entradas ({simResult.trades.length})
                  </span>

                  <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                    {simResult.trades.map((t) => {
                      const isWin = t.type === 'WIN';
                      const isRedTotal = t.type === 'RED_TOTAL';
                      const isPartial = t.type === 'LOSS_PARCIAL';

                      const dotColor = isWin ? 'bg-emerald-400 animate-pulse' : isRedTotal ? 'bg-red-500' : 'bg-amber-400/80';
                      const pnlColor = isWin ? 'text-emerald-400' : isRedTotal ? 'text-red-400' : 'text-amber-400/80';

                      const startGale = t.startGaleLevel || 0;
                      const endGale = Math.max(startGale, t.galeLevel > startGale ? t.galeLevel - 1 : startGale);
                      const galeLabelText = isWin
                        ? `Gale ${t.galeLevel}`
                        : isPartial
                        ? `Gale ${startGale} → ${endGale}`
                        : `RED (Gale ${Math.max(0, t.galeLevel - 1)})`;

                      return (
                        <div key={t.id} className="flex justify-between items-center bg-[#0b0c10] border border-white/5 px-3 py-2 rounded text-[11px] font-mono hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                            <span className="text-white font-bold">{t.zoneLabel}</span>
                            <span className="text-[9px] text-gray-400">
                              {galeLabelText}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {isWin && t.rollHit !== undefined && (
                              <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                Pedra {t.rollHit}
                              </span>
                            )}
                            {isPartial && (
                              <span className="text-[8px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                Sem Branco
                              </span>
                            )}
                            <span className={`font-black ${pnlColor}`}>
                              {t.pnl >= 0 ? `+R$ ${t.pnl.toFixed(2)}` : `-R$ ${Math.abs(t.pnl).toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {simResult.trades.length === 0 && (
                      <div className="text-[10px] text-gray-500 text-center py-6">
                        Nenhuma entrada gerada com os filtros atuais.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA 3: Painel de Filtros do Simulador (4 colunas no LG) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-5">
                
                {/* Cabeçalho do Painel com Modo Auto/Manual */}
                <div className="flex flex-col gap-3 border-b border-white/10 pb-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                      Filtros do Simulador
                    </h3>

                    {/* Toggle de Recálculo Automático */}
                    <button 
                      onClick={() => setAutoRun(!autoRun)}
                      className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${autoRun ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-gray-400 border-white/10'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${autoRun ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}></span>
                      {autoRun ? 'Auto: ON' : 'Auto: OFF'}
                    </button>
                  </div>

                  {/* Botão Principal para Rodar Simulação Manualmente */}
                  <button
                    onClick={handleRunManualSimulation}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black font-black uppercase text-xs tracking-widest rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Rodar Simulação
                  </button>
                </div>

                {/* Período de Backtest no Passado */}
                <div className="flex flex-col gap-2 p-3 bg-[#0b0c10] rounded-lg border border-emerald-500/30">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      Histórico no Passado
                    </span>
                    <span className="text-emerald-400 font-mono">{simHistoryDays} Dias ({simHistoryDays * 24}h)</span>
                  </label>
                  <select 
                    value={simHistoryDays} 
                    onChange={e => setSimHistoryDays(+e.target.value)} 
                    className="bg-[#0b0e14] border border-white/10 text-white text-xs px-2.5 py-1.5 rounded outline-none cursor-pointer font-bold"
                  >
                    <option value={3}>3 Dias (72 horas)</option>
                    <option value={5}>5 Dias (120 horas)</option>
                    <option value={7}>7 Dias (168 horas)</option>
                    <option value={15}>15 Dias (360 horas)</option>
                    <option value={30}>30 Dias (720 horas)</option>
                  </select>
                </div>

                {/* Filtro 1: Winrate Micro (Geral) + Horas */}
                <div className={`flex flex-col gap-2 p-3 rounded-lg border transition-all ${enableGeral ? 'bg-[#0b0c10] border-emerald-500/30' : 'bg-[#0b0c10]/40 border-white/5 opacity-60'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                      1. Winrate Micro (Geral)
                    </span>
                    <button 
                      onClick={() => setEnableGeral(!enableGeral)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${enableGeral ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-gray-500 border-white/5'}`}
                    >
                      {enableGeral ? 'ATIVADO' : 'DESATIVADO'}
                    </button>
                  </div>

                  {enableGeral && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Horas</span>
                        <select value={geralHours} onChange={e => setGeralHours(+e.target.value)} className="bg-[#0b0e14] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none cursor-pointer">
                          <option value={1}>1h</option>
                          <option value={2}>2h</option>
                          <option value={3}>3h</option>
                          <option value={6}>6h</option>
                          <option value={12}>12h</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Min Winrate %</span>
                        <input type="number" min={0} max={100} value={geralMinWr} onChange={e => setGeralMinWr(+e.target.value)} className="bg-[#0b0e14] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none font-mono" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtro 2: Winrate Macro (Ciclo) + Horas */}
                <div className={`flex flex-col gap-2 p-3 rounded-lg border transition-all ${enableCiclo ? 'bg-[#0b0c10] border-emerald-500/30' : 'bg-[#0b0c10]/40 border-white/5 opacity-60'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                      2. Winrate Ciclo (Macro)
                    </span>
                    <button 
                      onClick={() => setEnableCiclo(!enableCiclo)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${enableCiclo ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-gray-500 border-white/5'}`}
                    >
                      {enableCiclo ? 'ATIVADO' : 'DESATIVADO'}
                    </button>
                  </div>

                  {enableCiclo && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Período</span>
                        <select value={cicloHours} onChange={e => setCicloHours(+e.target.value)} className="bg-[#0b0e14] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none cursor-pointer">
                          <option value={12}>12h</option>
                          <option value={24}>24h (1 dia)</option>
                          <option value={48}>48h (2 dias)</option>
                          <option value={72}>72h (3 dias)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Min Winrate Quebra %</span>
                        <input type="number" min={0} max={100} value={cicloMinWr} onChange={e => setCicloMinWr(+e.target.value)} className="bg-[#0b0e14] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none font-mono" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtro 3: Ciclo do Ciclo + Dias */}
                <div className={`flex flex-col gap-2 p-3 rounded-lg border transition-all ${enableMetaCiclo ? 'bg-[#0b0c10] border-emerald-500/30' : 'bg-[#0b0c10]/40 border-white/5 opacity-60'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                      3. Ciclo do Ciclo (Meta)
                    </span>
                    <button 
                      onClick={() => setEnableMetaCiclo(!enableMetaCiclo)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${enableMetaCiclo ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-gray-500 border-white/5'}`}
                    >
                      {enableMetaCiclo ? 'ATIVADO' : 'DESATIVADO'}
                    </button>
                  </div>

                  {enableMetaCiclo && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Dias</span>
                        <select value={metaCicloDays} onChange={e => setMetaCicloDays(+e.target.value)} className="bg-[#0b0e14] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none cursor-pointer">
                          <option value={1}>1 Dia</option>
                          <option value={3}>3 Dias</option>
                          <option value={7}>7 Dias</option>
                          <option value={15}>15 Dias</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Min Winrate Quebra %</span>
                        <input type="number" min={0} max={100} value={metaCicloMinWr} onChange={e => setMetaCicloMinWr(+e.target.value)} className="bg-[#0b0e14] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none font-mono" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Filtro 4: Seleção de Zonas Ativas */}
                <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                    4. Zonas Autorizadas
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {zoneNames.map((name, idx) => {
                      const active = enabledZones.includes(idx);
                      return (
                        <button key={idx} onClick={() => toggleZone(idx)} className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-colors ${active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-black/40 text-gray-500 border-white/5 hover:border-white/10'}`}>
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filtro 5: Quantidade da Zona */}
                <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 flex justify-between">
                    <span>5. Quantidade da Zona</span>
                    <span className="text-emerald-400 font-mono">De {zonaLen} em {zonaLen}</span>
                  </label>
                  <select value={zonaLen} onChange={e => setZonaLen(+e.target.value)} className="bg-[#0b0c10] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none cursor-pointer font-bold">
                    <option value={5}>De 5 em 5 (1-5, 6-10...)</option>
                    <option value={6}>De 6 em 6 (1-6, 7-12...)</option>
                    <option value={7}>De 7 em 7 (1-7, 8-14...)</option>
                    <option value={10}>De 10 em 10 (1-10, 11-20...)</option>
                  </select>
                </div>

                {/* Gestão de Gales Persistente */}
                <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                    6. Gestão de Gales Persistente
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">1ª Mão (R$)</span>
                      <input type="number" step="0.5" value={initialBet} onChange={e => setInitialBet(+e.target.value)} className="bg-[#0b0c10] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none font-mono" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Mult. Gale</span>
                      <input type="number" step="0.001" value={galeMultiplier} onChange={e => setGaleMultiplier(+e.target.value)} className="bg-[#0b0c10] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none font-mono" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-gray-500 font-bold uppercase">Max Gales</span>
                      <input type="number" value={maxGales} onChange={e => setMaxGales(+e.target.value)} className="bg-[#0b0c10] border border-white/10 text-white text-xs px-2 py-1.5 rounded outline-none font-mono" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
