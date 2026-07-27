'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { useMinutosIa } from '@/hooks/useMinutosIa';
import { BarChart2, Table } from 'lucide-react';

interface Roll {
  color: string;
  roll: number;
  timestamp: string;
  id?: string;
}

const getShortStratName = (name: string): string => {
  if (name.includes('Linha x Coluna')) return 'LINHAxCOL';
  if (name.includes('Quentes (6h')) return 'QUENT 6h';
  if (name.includes('Quentes (12h')) return 'QUENT 12h';
  if (name.includes('Quentes (22h')) return 'QUENT 22h';
  if (name.includes('Minutagem')) return 'MINUT';
  if (name.includes('Horário Cheio')) return 'CHEIO';
  if (name.includes('Soma Anterior')) return 'SOMA ANT';
  if (name.includes('Soma Posterior')) return 'SOMA POST';
  if (name.includes('Fibonacci Espaçado')) return 'FIBO ESP';
  if (name.includes('Zero Absoluto')) return 'ZERO ABS';
  if (name.includes('Frequência Dinâmica')) return 'FREQ DIN';
  if (name.includes('Fibo Filtrado')) return 'FIBO FILT';
  if (name.includes('Soma Sanduíche')) return 'SANDUÍCHE';
  if (name.includes('Momentum Gaps')) return 'MOMENTUM';
  if (name.includes('Matriz de Markov')) return 'MARKOV 3ª';
  return name.slice(0, 10);
};

export default function SinaisPage() {
  const [globalData, setGlobalData] = useState<Roll[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Período de Histórico (24h por padrão)
  const [historyHours, setHistoryHours] = useState(24);
  const [loading, setLoading] = useState(true);

  const { subscribe } = useSSE();

  // Fetch de dados históricos do Postgres
  const fetchRollData = (hours: number) => {
    setLoading(true);
    fetch(`/api/results/period?hours=${hours}`)
      .then(res => res.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : data?.data;
        if (arr && Array.isArray(arr)) {
          const sorted = arr.sort((a: Roll, b: Roll) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setGlobalData(sorted);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setIsMounted(true);
    fetchRollData(historyHours);
  }, [historyHours]);

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

  // Hook da IA para a página /sinais: 100% liberado, todas as 15 estratégias ativas e SEM filtros de winrate
  const noDisabled = useMemo(() => new Set<number>(), []);
  const noMicro = useMemo(() => ({ enabled: false, minWr: 0, maxWr: 100, hours: 1 }), []);
  const noMacro = useMemo(() => ({ enabled: false, minWr: 0, maxWr: 100, hours: 72 }), []);
  const iaSignals = useMinutosIa(
    globalData as any,
    historyHours,
    noDisabled,
    true,
    false,
    noMicro,
    noMacro
  );

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-[#00c83a]/30 font-sans p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto space-y-5">

        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#00c83a]/10 text-[#00c83a] border border-[#00c83a]/20">
                Matriz Estilo Excel
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <Table className="w-8 h-8 text-[#00c83a]" />
              Sinais — Matriz por Minutos
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-medium">
              Matriz compacta de minutos (00 a 59) cruzando todas as 15 estratégias da IA e confluência.
            </p>
          </div>

          {/* Seletor de Período Histórico */}
          <div className="flex items-center gap-2 bg-[#0b0e14] p-2 rounded-xl border border-white/10">
            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase px-2">Histórico:</span>
            {[
              { label: '24h (1d)', h: 24 },
              { label: '48h (2d)', h: 48 },
              { label: '7 Dias', h: 168 },
              { label: '15 Dias', h: 360 },
              { label: '30 Dias', h: 720 }
            ].map(p => (
              <button
                key={p.h}
                onClick={() => setHistoryHours(p.h)}
                className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg border transition-all cursor-pointer ${
                  historyHours === p.h
                    ? 'bg-[#00c83a] text-black border-[#00c83a] shadow-[0_0_12px_rgba(0,200,58,0.4)]'
                    : 'bg-[#09120c] text-slate-400 border-white/5 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela Principal Estilo Excel */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-[#0f141e]/50 border border-white/10 rounded-2xl">
            <div className="w-10 h-10 border-4 border-[#00c83a]/20 border-t-[#00c83a] rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Processando Matriz Compacta ({historyHours}h)...</p>
          </div>
        ) : (
          <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar max-h-[780px] overflow-y-auto">
              <table className="w-full text-center border-collapse text-xs font-mono select-none">
                
                {/* ═══ CABEÇALHO (Linha 1) ═══ */}
                <thead className="sticky top-0 z-20 shadow-xl bg-[#0b0e14]">
                  <tr className="border-b border-white/15">
                    <th className="p-2 border-r border-white/10 bg-[#07130c] text-slate-300 font-black tracking-widest text-[10px] min-w-[70px] max-w-[70px] sticky left-0 z-30 shadow-md">
                      MINUTOS
                    </th>
                    <th className="p-2 border-r border-white/10 bg-cyan-950/80 text-cyan-300 font-black tracking-widest text-[10px] min-w-[85px] max-w-[85px]">
                      QTD
                    </th>
                    {iaSignals.stratStats.map((strat, idx) => (
                      <th
                        key={idx}
                        className="p-2 border-r border-white/10 bg-[#0d1611] text-emerald-400 font-black tracking-wider text-[10px] min-w-[85px] max-w-[95px] uppercase truncate cursor-help"
                        title={strat.name}
                      >
                        {getShortStratName(strat.name)}
                      </th>
                    ))}
                  </tr>

                  {/* ═══ LINHA 2: Quantidade de Brancos (Wins) ═══ */}
                  <tr className="border-b border-white/10 bg-[#09120c]">
                    <td className="p-2 border-r border-white/10 font-black text-slate-400 text-[10px] uppercase tracking-wider bg-[#09120c] sticky left-0 z-30">
                      Qtd de Brancos
                    </td>
                    <td className="p-2 border-r border-white/10 font-black text-cyan-400 text-xs">
                      {iaSignals.stratStats.reduce((acc, curr) => acc + curr.wins, 0)}
                    </td>
                    {iaSignals.stratStats.map((strat, idx) => (
                      <td key={idx} className="p-2 border-r border-white/10 font-black text-emerald-400 text-xs">
                        {strat.wins}
                      </td>
                    ))}
                  </tr>

                  {/* ═══ LINHA 3: SM (Sem Acerto Máximo) ═══ */}
                  <tr className="border-b border-white/10 bg-[#09120c]">
                    <td className="p-2 border-r border-white/10 font-black text-slate-400 text-[10px] uppercase tracking-wider bg-[#09120c] sticky left-0 z-30">
                      SM (Sem Acerto Max)
                    </td>
                    <td className="p-2 border-r border-white/10 font-black text-amber-400 text-xs">
                      -
                    </td>
                    {iaSignals.stratStats.map((strat, idx) => (
                      <td key={idx} className="p-2 border-r border-white/10 font-black text-amber-400 text-xs">
                        {strat.sm}x
                      </td>
                    ))}
                  </tr>

                  {/* ═══ LINHA 4: SA (Sem Acerto Atual) ═══ */}
                  <tr className="border-b-2 border-b-white/20 bg-[#09120c]">
                    <td className="p-2 border-r border-white/10 font-black text-slate-400 text-[10px] uppercase tracking-wider bg-[#09120c] sticky left-0 z-30">
                      SA (Sem Acerto Atual)
                    </td>
                    <td className="p-2 border-r border-white/10 font-black text-slate-500 text-xs">
                      -
                    </td>
                    {iaSignals.stratStats.map((strat, idx) => (
                      <td key={idx} className={`p-2 border-r border-white/10 font-black text-xs ${strat.sa >= 3 ? 'text-red-400' : 'text-white'}`}>
                        {strat.sa}x
                      </td>
                    ))}
                  </tr>
                </thead>

                {/* ═══ CORPO DA MATRIZ: Minutos 00 a 59 ═══ */}
                <tbody className="divide-y divide-white/5 bg-black/40">
                  {Array.from({ length: 60 }).map((_, m) => {
                    const minStr = String(m).padStart(2, '0');
                    const score = iaSignals.scores[m];
                    const activeStratIndices = (iaSignals.activeStratsByMin && iaSignals.activeStratsByMin[m]) || [];
                    const activeSet = new Set(activeStratIndices);

                    return (
                      <tr key={m} className="hover:bg-white/5 transition-colors h-10">
                        {/* Coluna 1: Minuto (00 a 59) */}
                        <td className="p-2 border-r border-white/10 font-black text-white bg-[#07130c] sticky left-0 z-10 text-xs shadow-md">
                          :{minStr}
                        </td>

                        {/* Coluna 2: Quantidade (Soma das Estratégias) */}
                        <td className={`p-2 border-r border-white/10 font-black text-xs ${
                          score >= 3
                            ? 'bg-cyan-400 text-black shadow-[inset_0_0_10px_rgba(34,211,238,0.8)] font-black'
                            : score > 0
                            ? 'bg-cyan-950/60 text-cyan-300'
                            : 'text-slate-600'
                        }`}>
                          {score > 0 ? score : '-'}
                        </td>

                        {/* Colunas 3 a N: Cada Estratégia (X se estiver apontando) */}
                        {iaSignals.stratStats.map((strat, sIdx) => {
                          const isPointed = activeSet.has(sIdx);
                          return (
                            <td
                              key={sIdx}
                              className={`p-2 border-r border-white/5 transition-all ${
                                isPointed
                                  ? 'bg-[#00c83a]/20 text-[#00c83a] font-black text-sm border border-[#00c83a]/40 shadow-[inset_0_0_8px_rgba(0,200,58,0.3)]'
                                  : 'text-slate-800 font-normal'
                              }`}
                            >
                              {isPointed ? 'X' : ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rodapé com Resumo de Dados */}
            <div className="p-4 bg-[#07130c] border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-[10px] font-bold text-slate-400 gap-2">
              <span className="font-mono">Total de Rodadas Analisadas: {globalData.length}</span>
              <span className="font-mono">Período de Análise: {historyHours} Horas</span>
              <span className="text-[#00c83a] uppercase tracking-widest font-black flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00c83a] animate-pulse"></span>
                Matriz Atualizada em Tempo Real
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
