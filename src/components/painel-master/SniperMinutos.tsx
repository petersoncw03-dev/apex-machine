"use client";

import React, { useState, useEffect, useMemo } from 'react';

export default function SniperMinutos({ globalData }: { globalData: any[] }) {
  const [periodDays, setPeriodDays] = useState<7 | 14>(7);
  const [extendedData, setExtendedData] = useState<any[] | null>(null);
  const [loadingExtended, setLoadingExtended] = useState(false);
  const inactivityTimer = React.useRef<NodeJS.Timeout | null>(null);

  // Reseta o timer de inatividade quando o usuário interage
  const resetInactivityTimer = () => {
    if (periodDays !== 14) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setPeriodDays(7);
      setExtendedData(null);
    }, 3 * 60 * 1000); // 3 minutos
  };

  // Limpa o timer no unmount
  useEffect(() => {
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  const handleSetPeriod = async (days: 7 | 14) => {
    setPeriodDays(days);
    if (days === 14 && !extendedData) {
      setLoadingExtended(true);
      try {
        const res = await fetch(`/api/results/period?hours=336`); // 14 dias
        if (res.ok) {
          const json = await res.json();
          const arr = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
          const mappedData = [...arr].map((r: any) => ({
            ...r,
            color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
            roll: r.roll?.toString()
          }));
          setExtendedData(mappedData);
        }
      } catch (e) {
        console.error('Erro ao buscar 14 dias:', e);
      } finally {
        setLoadingExtended(false);
      }
    }
    
    if (days === 7) {
      setExtendedData(null);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    } else {
      resetInactivityTimer();
    }
  };

  // Mescla os dados extras com os dados globais mais recentes (que recebem websocket)
  const mergedData = useMemo(() => {
    if (periodDays === 7 || !extendedData) return globalData;
    if (!globalData || globalData.length === 0) return extendedData;
    
    // globalData is oldest-first. The newest item is at the end.
    const oldestGlobalTimestamp = new Date(globalData[0].timestamp).getTime();
    // extendedData is also oldest-first.
    // We want items in extendedData that are OLDER than the oldest item in globalData.
    const olderData = extendedData.filter(d => new Date(d.timestamp).getTime() < oldestGlobalTimestamp);
    // Oldest items first: olderData comes first, then globalData.
    return [...olderData, ...globalData];
  }, [globalData, extendedData, periodDays]);

  // Filtra dados para o periodo escolhido
  const dataPeriod = useMemo(() => {
    if (!mergedData || mergedData.length === 0) return [];
    const now = Date.now();
    const cutoff = now - periodDays * 24 * 3600 * 1000;
    return mergedData.filter(d => new Date(d.timestamp).getTime() >= cutoff);
  }, [mergedData, periodDays]);

  const generalWinrate2Days = useMemo(() => {
     if (!globalData || globalData.length === 0) return new Array(60).fill(0);
     const now = Date.now();
     const cutoff = now - 2 * 24 * 3600 * 1000;
     const recentData = globalData.filter(d => new Date(d.timestamp).getTime() >= cutoff);
     
     const mapKeys = new Map<string, boolean>();
     for (let i = 0; i < recentData.length; i++) {
        const r = recentData[i];
        const d = new Date(new Date(r.timestamp).getTime() - 3 * 3600 * 1000);
        const m = d.getUTCMinutes();
        const hKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${m}`;
        const isW = r?.color?.toUpperCase() === 'BRANCO' || r?.color?.toUpperCase() === 'B' || Number(r?.roll) === 0;
        
        if (!mapKeys.has(hKey)) mapKeys.set(hKey, isW);
        else if (isW) mapKeys.set(hKey, true);
     }
     
     const h = new Array(60).fill(0);
     const t = new Array(60).fill(0);
     mapKeys.forEach((isW, key) => {
         const m = parseInt(key.split('-')[4]);
         t[m]++;
         if (isW) h[m]++;
     });
     
     return h.map((hit, i) => (t[i] > 0 ? (hit / t[i]) * 100 : 0));
  }, [globalData]);

  const ranking = useMemo(() => {
    if (!dataPeriod || dataPeriod.length === 0) return [];

    const mapKeys = new Map<string, boolean>();
    // Indexar de oldest to newest para construir a linha do tempo cronológica
    // globalData: [oldest, ..., newest] (vindo do Postgres ASC)
    for (let i = 0; i < dataPeriod.length; i++) {
        const r = dataPeriod[i];
        const d = new Date(new Date(r.timestamp).getTime() - 3 * 3600 * 1000);
        const m = d.getUTCMinutes();
        const hKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${m}`;
        const isW = r?.color?.toUpperCase() === 'BRANCO' || r?.color?.toUpperCase() === 'B' || Number(r?.roll) === 0;
        
        if (!mapKeys.has(hKey)) mapKeys.set(hKey, isW);
        else if (isW) mapKeys.set(hKey, true);
    }

    const minuteOutcomes: Record<number, boolean[]> = {};
    for (let i = 0; i < 60; i++) minuteOutcomes[i] = [];

    const nowD = new Date(Date.now() - 3 * 3600 * 1000);
    const currentHKey = `${nowD.getUTCFullYear()}-${nowD.getUTCMonth()}-${nowD.getUTCDate()}-${nowD.getUTCHours()}-${nowD.getUTCMinutes()}`;

    mapKeys.forEach((isW, key) => {
         // Se estamos no minuto ATUAL e ainda não deu WIN, não conta como LOSS ainda, pois faltam entradas (o minuto não acabou)
         if (key === currentHKey && !isW) return;
         
         const m = parseInt(key.split('-')[4]);
         minuteOutcomes[m].push(isW);
    });

    const results = [];

    for (let m = 0; m < 60; m++) {
        const outcomes = minuteOutcomes[m];
        if (outcomes.length === 0) continue;

        // Dicionário de transições: transitions[state] = { hits, total }
        const transitions: Record<number, { hits: number, total: number }> = {};
        
        let currentState = 0; // 0 = start, +X = Win streak, -X = Loss streak

        for (let i = 0; i < outcomes.length; i++) {
            const isHit = outcomes[i];
            
            // Registra o que aconteceu a partir do currentState
            if (!transitions[currentState]) transitions[currentState] = { hits: 0, total: 0 };
            transitions[currentState].total++;
            if (isHit) transitions[currentState].hits++;

            // Atualiza currentState para a próxima iteração
            if (isHit) {
                if (currentState > 0) currentState++;
                else currentState = 1;
            } else {
                if (currentState < 0) currentState--;
                else currentState = -1;
            }
        }

        // currentState agora é o estado ATUAL (após avaliar todo o histórico)
        const stats = transitions[currentState] || { hits: 0, total: 0 };
        const winrate = stats.total > 0 ? (stats.hits / stats.total) * 100 : 0;

        results.push({
            minuto: m,
            cicloAtual: currentState,
            winrate: winrate,
            ocorrencias: stats.total,
            geral2d: generalWinrate2Days[m]
        });
    }

    // Rank by winrate DESC, then occurrences DESC
    return results
      .filter(r => r.ocorrencias >= 2) // Filtro minimo de confiabilidade
      .sort((a, b) => b.winrate - a.winrate || b.ocorrencias - a.ocorrencias)
      .slice(0, 10);

  }, [dataPeriod, generalWinrate2Days]);

  return (
    <div 
      className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col mt-4"
      onMouseMove={resetInactivityTimer}
      onClick={resetInactivityTimer}
    >
      <div className="px-4 py-3 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[2px] border-t-[#00c83a]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
          <span className="text-[11px] font-black uppercase tracking-widest text-white">Sniper de Minutos</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => handleSetPeriod(7)}
            className={`text-[9px] font-bold px-2 py-1 border rounded uppercase tracking-wider transition-colors ${periodDays === 7 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-gray-400 bg-white/5 border-white/5 hover:border-white/20 hover:text-white'}`}
          >
            7 Dias
          </button>
          <button 
            onClick={() => handleSetPeriod(14)}
            className={`text-[9px] font-bold px-2 py-1 border rounded uppercase tracking-wider transition-colors ${periodDays === 14 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-gray-400 bg-white/5 border-white/5 hover:border-white/20 hover:text-white'}`}
            title="Carrega 14 dias independentemente. Volta para 7 dias após 3 min de inatividade."
          >
            {loadingExtended ? 'Carregando...' : '14 Dias'}
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-1">
           As 10 melhores oportunidades de entrada neste exato momento (baseado no ciclo atual).
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
           {ranking.map((r, i) => {
               const isWin = r.cicloAtual > 0;
               const cycleName = isWin ? `Win ${r.cicloAtual}` : `Loss ${Math.abs(r.cicloAtual)}`;
               
               return (
                   <div key={r.minuto} className="bg-[#131722] border border-white/5 rounded-lg p-3 flex flex-col relative overflow-hidden group hover:border-[#00c83a]/30 transition-all shadow-lg">
                      {i < 3 && <div className="absolute -top-10 -right-10 w-20 h-20 bg-[#00c83a]/10 blur-2xl rounded-full"></div>}
                      
                      <div className="flex justify-between items-start z-10">
                          <div className="flex flex-col">
                              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Minuto</span>
                              <span className="text-xl font-black text-white leading-none mt-1">{String(r.minuto).padStart(2, '0')}</span>
                          </div>
                          <div className="flex flex-col items-end">
                              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Ciclo Atual</span>
                              <div className={`mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${isWin ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                 {cycleName}
                              </div>
                          </div>
                      </div>

                      <div className="mt-4 flex items-end justify-between z-10">
                          <div className="flex flex-col">
                              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Winrate (Neste Ciclo)</span>
                              <span className={`text-lg font-black leading-none ${r.winrate >= 80 ? 'text-[#00c83a]' : r.winrate >= 50 ? 'text-amber-400' : 'text-gray-300'}`}>
                                 {r.winrate.toFixed(1)}%
                              </span>
                          </div>
                          <div className="flex flex-col items-end text-[9px] font-bold text-gray-500">
                              <span title="Vezes que este ciclo ocorreu historicamente">{r.ocorrencias}x Hist.</span>
                          </div>
                      </div>

                      <div className="w-full h-px bg-white/5 my-2.5 z-10"></div>
                      
                      <div className="flex justify-between items-center z-10">
                          <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Geral (48h)</span>
                          <span className="text-[10px] font-black text-gray-400">{r.geral2d.toFixed(1)}%</span>
                      </div>
                   </div>
               )
           })}

           {ranking.length === 0 && !loadingExtended && (
               <div className="col-span-full py-10 flex items-center justify-center text-gray-500 text-[11px] font-bold uppercase tracking-widest">
                   Processando histórico de dados...
               </div>
           )}
           {loadingExtended && (
               <div className="col-span-full py-10 flex items-center justify-center text-[#00c83a] text-[11px] font-bold uppercase tracking-widest animate-pulse">
                   Baixando base histórica pesada (14 Dias)...
               </div>
           )}
        </div>
      </div>
    </div>
  );
}
