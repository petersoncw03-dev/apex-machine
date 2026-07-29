'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';
import { TickerData } from '@/components/Ticker';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, ArrowUpDown, Sigma, Copy, Sparkles, ArrowLeft, Eye, X } from 'lucide-react';
import Link from 'next/link';

// Pattern generators
function genColor(len: number): string[][] {
  const r: string[][] = [];
  const t = Math.pow(2, len);
  for (let i = 0; i < t; i++) {
    const p: string[] = [];
    for (let j = len - 1; j >= 0; j--) {
      p.push((i & (1 << j)) !== 0 ? 'P' : 'V');
    }
    r.push(p);
  }
  return r;
}

function genNum(len: number): number[][] {
  const ns = Array.from({ length: 15 }, (_, i) => i);
  if (len === 1) return ns.map(n => [n]);
  if (len === 2) {
    const r: number[][] = [];
    for (const a of ns) for (const b of ns) r.push([a, b]);
    return r;
  }
  if (len === 3) {
    const r: number[][] = [];
    for (const a of ns) for (const b of ns) for (const c of ns) r.push([a, b, c]);
    return r;
  }
  return [];
}

const CP: { [k: number]: string[][] } = {
  3: genColor(3),
  4: genColor(4),
  5: genColor(5),
  6: genColor(6),
  7: genColor(7),
  8: genColor(8),
};
const NP: { [k: number]: number[][] } = { 1: genNum(1), 2: genNum(2), 3: genNum(3) };

type SortCol = 'TX_ESTADO' | 'TX_CICLO' | 'TX_ENTRADA' | 'SA' | 'SM' | 'WIN_CICLO' | 'LOSS_CICLO';

// Interfaces de estatísticas de padrão
interface PatternStats {
  id: string;
  pat: any;
  winCiclo: number;
  lossCiclo: number;
  saCiclo: number;
  smCiclo: number;
  wrCiclo: number;
  winEnt: number;
  lossEnt: number;
  sa: number;
  sm: number;
  wrEntrada: number;
  csCiclo: number[];
  outcomesCiclos: ('W' | 'L')[];
  fullCycles: { type: 'W' | 'L'; count: number }[];
  currentCycleState: { type: 'W' | 'L' | null; count: number };
  currentCycleWinrate: number;
  currentCycleTotal: number;
  currentCycleWins: number;
}

// Modal do Estado da Zona & Histórico de Ciclos
function CycleDetailModal({ stat, onClose }: { stat: PatternStats; onClose: () => void }) {
  const isColor = typeof stat.pat[0] === 'string';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0f111a] border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-6 relative"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="text-purple-400" size={20} />
            <h2 className="text-base font-black uppercase tracking-wider text-white">
              Análise de Ciclos do Padrão
            </h2>
            <div className="flex gap-1 ml-2">
              {isColor
                ? stat.pat.map((c: string, i: number) => (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded-md border ${
                        c === 'V' ? 'bg-red-600 border-red-500' : 'bg-zinc-800 border-zinc-600'
                      }`}
                    />
                  ))
                : stat.pat.map((n: number, i: number) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
                        n === 0
                          ? 'bg-white text-black'
                          : n <= 7
                          ? 'bg-red-600 text-white'
                          : 'bg-zinc-800 text-white'
                      }`}
                    >
                      {n}
                    </div>
                  ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Card Estado Atual da Zona (Estilo Print) */}
        <div className="bg-[#141724] border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">
              ESTADO ATUAL DA ZONA
            </span>
            {stat.currentCycleState.type ? (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <span
                  className={`text-xl font-black uppercase ${
                    stat.currentCycleState.type === 'W' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  APÓS {stat.currentCycleState.count} {stat.currentCycleState.type === 'W' ? 'WIN' : 'LOSS'}
                </span>
                <span className="text-gray-500 font-bold">|</span>
                <span className="text-sm text-white font-bold">
                  Winrate:{' '}
                  <span
                    className={
                      stat.currentCycleWinrate >= 50
                        ? 'text-emerald-400 font-extrabold'
                        : 'text-rose-400 font-extrabold'
                    }
                  >
                    {stat.currentCycleWinrate.toFixed(1)}%
                  </span>
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold text-gray-500">Sem histórico suficiente</span>
            )}
          </div>

          {stat.currentCycleTotal > 0 && (
            <div className="bg-black/50 px-4 py-2.5 rounded-lg border border-white/5 flex items-center gap-6 text-[10px] font-bold text-gray-400">
              <div className="flex flex-col items-center">
                <span className="uppercase text-gray-500">Ocorrências</span>
                <span className="text-white text-sm font-black">{stat.currentCycleTotal}x</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="uppercase text-gray-500">Wins</span>
                <span className="text-emerald-400 text-sm font-black">{stat.currentCycleWins}x</span>
              </div>
            </div>
          )}
        </div>

        {/* Histórico Cronológico de Ciclos */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
            HISTÓRICO DE CICLOS (CRONOLÓGICO)
          </span>

          {!stat.fullCycles.length ? (
            <div className="text-xs text-gray-500 py-6 text-center">Nenhum ciclo registrado ainda</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin scrollbar-thumb-purple-600/30 scrollbar-track-transparent">
              {stat.fullCycles.map((cy, idx) => {
                const isNewest = idx === stat.fullCycles.length - 1;
                return (
                  <div key={idx} className="relative flex flex-col items-center shrink-0">
                    <div
                      className={`min-w-[28px] h-[28px] px-2 flex items-center justify-center rounded-lg text-xs font-black font-mono shadow-md transition-all ${
                        cy.type === 'W'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                      } ${isNewest ? 'ring-2 ring-white scale-105 z-10' : 'opacity-80 hover:opacity-100'}`}
                    >
                      {cy.count}
                    </div>
                    {isNewest && (
                      <div className="absolute -bottom-3.5 w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Componente para Tabela Avançada de Cores (Por Ciclo + Entradas + Estado da Zona)
function AdvancedColorTable({
  pats,
  data,
  requireHours,
}: {
  pats: string[][];
  data: TickerData[];
  requireHours?: (hours: number) => void;
}) {
  const [casas, setCasas] = useState(6);
  const [ph, setPh] = useState(10);
  const [mw, setMw] = useState(0);
  const [sc, setSc] = useState<SortCol>('TX_ESTADO');
  const [sd, setSd] = useState<'desc' | 'asc'>('desc');
  const [snapshot, setSnapshot] = useState<TickerData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedStat, setSelectedStat] = useState<PatternStats | null>(null);

  const handleCopy = (pat: string[], id: string) => {
    const formula = `${pat.join(' ')} = branco g${casas - 1}`;
    navigator.clipboard.writeText(formula);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hs = (c: SortCol) => {
    if (sc === c) setSd(d => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSc(c);
      setSd('desc');
    }
  };

  const proc = useMemo(() => {
    return snapshot.map(r => {
      const n = parseInt(r.roll as string);
      let c = 'B';
      if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) c = 'V';
      if (r.color.includes('Preto') || (n >= 8 && n <= 14)) c = 'P';
      return { isBranco: r.color.includes('Branco') || r.roll === '0', colorCode: c };
    });
  }, [snapshot]);

  const stats = useMemo(() => {
    if (!snapshot.length) return [];
    const an = proc.slice(-ph * 120);

    return pats
      .map(pat => {
        // --- 1. MÉTRICAS POR ENTRADA ---
        let winEnt = 0,
          lossEnt = 0,
          sa = 0,
          sm = 0;
        let trEnt: { el: number; st: number }[] = [];

        // --- 2. MÉTRICAS POR CICLO DO ACONTECIMENTO ---
        let winCiclo = 0,
          lossCiclo = 0,
          saCiclo = 0,
          smCiclo = 0;
        let activeCycle: { remainingEntries: number; entryIndex: number } | null = null;
        const csCiclo = Array(casas).fill(0);
        const outcomesCiclos: ('W' | 'L')[] = [];

        const pL = pat.length;

        for (let i = 0; i < an.length; i++) {
          const cur = an[i];

          // Processamento Por Entrada
          if (trEnt.length > 0) {
            if (cur.isBranco) {
              winEnt++;
              trEnt = [];
              sa = 0;
            } else {
              for (let t = trEnt.length - 1; t >= 0; t--) {
                trEnt[t].el--;
                trEnt[t].st++;
                if (trEnt[t].el === 0) {
                  lossEnt++;
                  sa++;
                  if (sa > sm) sm = sa;
                  trEnt.splice(t, 1);
                }
              }
            }
          }

          // Processamento Por Ciclo do Padrão
          if (activeCycle !== null) {
            if (cur.isBranco) {
              winCiclo++;
              csCiclo[activeCycle.entryIndex]++;
              saCiclo = 0;
              activeCycle = null;
              outcomesCiclos.push('W');
            } else {
              activeCycle.remainingEntries--;
              activeCycle.entryIndex++;

              if (activeCycle.remainingEntries === 0) {
                lossCiclo++;
                saCiclo++;
                if (saCiclo > smCiclo) smCiclo = saCiclo;
                activeCycle = null;
                outcomesCiclos.push('L');
              }
            }
          }

          // Checa se o padrão aconteceu no giro i
          let isMatch = false;
          if (i >= pL - 1) {
            isMatch = true;
            for (let p = 0; p < pL; p++) {
              if (an[i - (pL - 1) + p].colorCode !== pat[p]) {
                isMatch = false;
                break;
              }
            }
          }

          if (isMatch) {
            trEnt.push({ el: casas, st: 0 });
          }

          if (isMatch) {
            if (activeCycle !== null) {
              lossCiclo++;
              saCiclo++;
              if (saCiclo > smCiclo) smCiclo = saCiclo;
              outcomesCiclos.push('L');
            }
            activeCycle = { remainingEntries: casas, entryIndex: 0 };
          }
        }

        const wrCiclo = winCiclo / (winCiclo + lossCiclo || 1);
        const wrEntrada = winEnt / (winEnt + lossEnt || 1);

        // --- 3. HISTÓRICO DE CICLOS & ESTADO ATUAL DA ZONA ---
        const fullCycles: { type: 'W' | 'L'; count: number }[] = [];
        for (const out of outcomesCiclos) {
          if (fullCycles.length === 0) {
            fullCycles.push({ type: out, count: 1 });
          } else {
            const last = fullCycles[fullCycles.length - 1];
            if (last.type === out) {
              last.count++;
            } else {
              fullCycles.push({ type: out, count: 1 });
            }
          }
        }

        const cycleStats: { W: Record<number, { win: number; loss: number }>; L: Record<number, { win: number; loss: number }> } = { W: {}, L: {} };
        let runningType: 'W' | 'L' | null = null;
        let runningCount = 0;

        for (let i = 0; i < outcomesCiclos.length; i++) {
          const out = outcomesCiclos[i];
          if (runningType && runningCount > 0) {
            if (!cycleStats[runningType][runningCount]) {
              cycleStats[runningType][runningCount] = { win: 0, loss: 0 };
            }
            if (out === 'W') {
              cycleStats[runningType][runningCount].win++;
            } else {
              cycleStats[runningType][runningCount].loss++;
            }
          }
          if (runningType === out) {
            runningCount++;
          } else {
            runningType = out;
            runningCount = 1;
          }
        }

        const currentCycleState = { type: runningType, count: runningCount };
        let currentCycleWinrate = 0;
        let currentCycleTotal = 0;
        let currentCycleWins = 0;
        if (runningType && cycleStats[runningType][runningCount]) {
          const st = cycleStats[runningType][runningCount];
          currentCycleTotal = st.win + st.loss;
          currentCycleWins = st.win;
          currentCycleWinrate = currentCycleTotal > 0 ? (st.win / currentCycleTotal) * 100 : 0;
        }

        return {
          id: pat.join(''),
          pat,
          winCiclo,
          lossCiclo,
          saCiclo,
          smCiclo,
          wrCiclo,
          winEnt,
          lossEnt,
          sa,
          sm,
          wrEntrada,
          csCiclo,
          outcomesCiclos,
          fullCycles,
          currentCycleState,
          currentCycleWinrate,
          currentCycleTotal,
          currentCycleWins,
        };
      })
      .filter(s => s.winCiclo >= mw)
      .sort((a, b) => {
        if (sc === 'TX_ESTADO') return sd === 'desc' ? b.currentCycleWinrate - a.currentCycleWinrate : a.currentCycleWinrate - b.currentCycleWinrate;
        if (sc === 'SA') return sd === 'desc' ? b.sa - a.sa : a.sa - b.sa;
        if (sc === 'SM') return sd === 'desc' ? b.sm - a.sm : a.sm - b.sm;
        if (sc === 'WIN_CICLO') return sd === 'desc' ? b.winCiclo - a.winCiclo : a.winCiclo - b.winCiclo;
        if (sc === 'LOSS_CICLO') return sd === 'desc' ? b.lossCiclo - a.lossCiclo : a.lossCiclo - b.lossCiclo;
        if (sc === 'TX_ENTRADA') return sd === 'desc' ? b.wrEntrada - a.wrEntrada : a.wrEntrada - b.wrEntrada;
        return sd === 'desc' ? b.wrCiclo - a.wrCiclo : a.wrCiclo - b.wrCiclo;
      })
      .slice(0, 60);
  }, [snapshot, proc, casas, ph, pats, mw, sc, sd]);

  const handleProcess = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setSnapshot(data);
      setIsProcessing(false);
    }, 100);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controles de Configuração */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-[#0d0f1a] border border-white/5 rounded-2xl shadow-xl">
        {[
          [
            'Entradas no Ciclo',
            casas,
            setCasas,
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15],
            (v: number) => `${v} entradas`,
          ],
          [
            'Período Análise',
            ph,
            setPh,
            [1, 2, 3, 6, 9, 12, 24, 48, 72, 168, 336, 720],
            (v: number) => (v >= 168 ? `${v / 24}d` : `${v}h`),
          ],
        ].map(([l, v, s, o, f]: any) => (
          <div key={l} className="flex flex-col gap-1">
            <label className="text-[9px] text-gray-400 uppercase font-black tracking-widest">{l}</label>
            <select
              className="bg-black/50 border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none focus:border-purple-500 transition-colors font-semibold"
              value={v}
              onChange={e => {
                const val = Number(e.target.value);
                s(val);
                if (l.includes('Período')) requireHours?.(val);
              }}
            >
              {o.map((x: number) => (
                <option key={x} value={x}>
                  {f(x)}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Min Win (Ciclos)</label>
          <input
            type="number"
            min="0"
            value={mw}
            onChange={e => setMw(Number(e.target.value))}
            className="bg-black/50 border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none w-24 focus:border-purple-500 transition-colors font-semibold"
          />
        </div>

        <button
          onClick={handleProcess}
          disabled={isProcessing}
          className="ml-auto flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Sigma size={14} />
          )}
          Analisar Ciclos
        </button>
      </div>

      {!snapshot.length ? (
        <div className="py-24 text-center opacity-40 flex flex-col items-center gap-3">
          <FlaskConical size={52} className="text-purple-500" />
          <div className="text-xs font-black uppercase tracking-widest text-white">
            Clique em "Analisar Ciclos" para calcular estatísticas de ciclos e estado da zona
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#080911]">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gradient-to-r from-purple-950/60 to-indigo-950/40 text-white border-b border-white/10">
                <th className="p-3 text-center w-12"></th>
                <th className="p-3 text-center text-xs font-bold uppercase tracking-wider">Padrão</th>
                <th className="p-3 text-center text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Estado Atual
                </th>
                <th
                  onClick={() => hs('TX_ESTADO')}
                  className="p-3 text-center text-xs font-black uppercase tracking-wider text-cyan-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    TX Estado % {sc === 'TX_ESTADO' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('TX_CICLO')}
                  className="p-3 text-center text-xs font-black uppercase tracking-wider text-purple-300 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    TX Ciclo % {sc === 'TX_CICLO' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('WIN_CICLO')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-emerald-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    Win Ciclos {sc === 'WIN_CICLO' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('LOSS_CICLO')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-rose-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    Loss Ciclos {sc === 'LOSS_CICLO' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('TX_ENTRADA')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    TX Entrada {sc === 'TX_ENTRADA' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('SM')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-amber-300 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    SM {sc === 'SM' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('SA')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-amber-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    SA {sc === 'SA' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                {Array.from({ length: casas }).map((_, i) => (
                  <th key={i} className="p-3 text-center text-xs font-bold uppercase text-purple-400">
                    C{i + 1}
                  </th>
                ))}
                <th className="p-3 text-center text-xs font-bold uppercase text-gray-500">Histórico</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => {
                const wrC = (s.wrCiclo * 100).toFixed(1);
                const wrE = (s.wrEntrada * 100).toFixed(1);
                const isAlert = s.sm > 0 && s.sa > 0 && s.sm - s.sa <= 2;

                return (
                  <motion.tr
                    layout
                    key={s.id}
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleCopy(s.pat, s.id)}
                        className="bg-white/5 hover:bg-white/10 p-1.5 rounded transition-colors text-gray-400 hover:text-white"
                        title="Copiar fórmula"
                      >
                        {copiedId === s.id ? (
                          <span className="text-[9px] font-black text-emerald-400">OK</span>
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-center">
                        {s.pat.map((c: string, i: number) => (
                          <div
                            key={i}
                            className={`w-6 h-6 rounded-md border ${
                              c === 'V'
                                ? 'bg-red-600/80 border-red-500/50 shadow-[0_0_8px_rgba(220,38,38,0.3)]'
                                : 'bg-zinc-800/90 border-zinc-600/50 shadow-[0_0_8px_rgba(39,39,42,0.5)]'
                            }`}
                          />
                        ))}
                      </div>
                    </td>

                    {/* Estado Atual Badge */}
                    <td className="p-3 text-center">
                      {s.currentCycleState.type ? (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${
                            s.currentCycleState.type === 'W'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                              : 'bg-rose-950/60 text-rose-400 border-rose-500/40'
                          }`}
                        >
                          Após {s.currentCycleState.count} {s.currentCycleState.type === 'W' ? 'WIN' : 'LOSS'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-600">-</span>
                      )}
                    </td>

                    {/* Winrate do Estado Atual */}
                    <td className="p-3 text-center font-black text-sm text-cyan-300">
                      {s.currentCycleTotal > 0 ? (
                        <span className="bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 px-2.5 py-1 rounded-md shadow-sm">
                          {s.currentCycleWinrate.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </td>

                    {/* TX Ciclo % */}
                    <td className="p-3 text-center font-black text-sm text-purple-300">
                      <span className="bg-purple-950/60 border border-purple-500/30 px-2.5 py-1 rounded-md shadow-sm">
                        {wrC}%
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-400">{s.winCiclo}</td>
                    <td className="p-3 text-center font-bold text-rose-400">{s.lossCiclo}</td>
                    <td className="p-3 text-center text-gray-400 text-xs font-semibold">{wrE}%</td>
                    <td className={`p-3 text-center font-bold ${isAlert ? 'text-amber-300 bg-amber-950/30' : 'text-gray-300'}`}>
                      {s.sm}
                    </td>
                    <td className={`p-3 text-center font-bold ${isAlert ? 'text-amber-300 bg-amber-950/30' : 'text-gray-300'}`}>
                      {s.sa}
                    </td>
                    {s.csCiclo.map((v: number, i: number) => (
                      <td key={i} className="p-3 text-center text-gray-400 text-xs font-medium">
                        {v}
                      </td>
                    ))}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => setSelectedStat(s)}
                        className="bg-white/5 hover:bg-white/10 p-1.5 rounded transition-colors text-purple-400 hover:text-white"
                        title="Ver Histórico Cronológico"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedStat && <CycleDetailModal stat={selectedStat} onClose={() => setSelectedStat(null)} />}
    </div>
  );
}

// Componente para Tabela Avançada de Números (Por Ciclo + Entradas + Estado da Zona)
function AdvancedNumberTable({
  pats,
  data,
  requireHours,
}: {
  pats: number[][];
  data: TickerData[];
  requireHours?: (hours: number) => void;
}) {
  const [casas, setCasas] = useState(6);
  const [ph, setPh] = useState(12);
  const [mw, setMw] = useState(0);
  const [sc, setSc] = useState<SortCol>('TX_ESTADO');
  const [sd, setSd] = useState<'desc' | 'asc'>('desc');
  const [snapshot, setSnapshot] = useState<TickerData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedStat, setSelectedStat] = useState<PatternStats | null>(null);

  const handleCopy = (pat: number[], id: string) => {
    const formula = `${pat.join(' ')} = branco g${casas - 1}`;
    navigator.clipboard.writeText(formula);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hs = (c: SortCol) => {
    if (sc === c) setSd(d => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSc(c);
      setSd('desc');
    }
  };

  const stats = useMemo(() => {
    if (!snapshot.length) return [];
    const an = snapshot.slice(-ph * 120);

    return pats
      .map(pat => {
        // --- 1. MÉTRICAS POR ENTRADA ---
        let winEnt = 0,
          lossEnt = 0,
          sa = 0,
          sm = 0;
        let trEnt: { el: number; st: number }[] = [];

        // --- 2. MÉTRICAS POR CICLO ---
        let winCiclo = 0,
          lossCiclo = 0,
          saCiclo = 0,
          smCiclo = 0;
        let activeCycle: { remainingEntries: number; entryIndex: number } | null = null;
        const csCiclo = Array(casas).fill(0);
        const outcomesCiclos: ('W' | 'L')[] = [];

        const pL = pat.length;

        for (let i = 0; i < an.length; i++) {
          const cur = an[i];
          const isBranco = cur.color.includes('Branco') || cur.roll === '0';

          // Processamento por Entrada
          if (trEnt.length > 0) {
            if (isBranco) {
              winEnt++;
              trEnt = [];
              sa = 0;
            } else {
              for (let t = trEnt.length - 1; t >= 0; t--) {
                trEnt[t].el--;
                trEnt[t].st++;
                if (trEnt[t].el === 0) {
                  lossEnt++;
                  sa++;
                  if (sa > sm) sm = sa;
                  trEnt.splice(t, 1);
                }
              }
            }
          }

          // Processamento Por Ciclo do Padrão
          if (activeCycle !== null) {
            if (isBranco) {
              winCiclo++;
              csCiclo[activeCycle.entryIndex]++;
              saCiclo = 0;
              activeCycle = null;
              outcomesCiclos.push('W');
            } else {
              activeCycle.remainingEntries--;
              activeCycle.entryIndex++;

              if (activeCycle.remainingEntries === 0) {
                lossCiclo++;
                saCiclo++;
                if (saCiclo > smCiclo) smCiclo = saCiclo;
                activeCycle = null;
                outcomesCiclos.push('L');
              }
            }
          }

          // Checa se o padrão numérico aconteceu no giro i
          let isMatch = false;
          if (i >= pL - 1) {
            isMatch = true;
            for (let p = 0; p < pL; p++) {
              if (parseInt(an[i - (pL - 1) + p].roll as string) !== pat[p]) {
                isMatch = false;
                break;
              }
            }
          }

          if (isMatch) {
            trEnt.push({ el: casas, st: 0 });
          }

          if (isMatch) {
            if (activeCycle !== null) {
              lossCiclo++;
              saCiclo++;
              if (saCiclo > smCiclo) smCiclo = saCiclo;
              outcomesCiclos.push('L');
            }
            activeCycle = { remainingEntries: casas, entryIndex: 0 };
          }
        }

        const wrCiclo = winCiclo / (winCiclo + lossCiclo || 1);
        const wrEntrada = winEnt / (winEnt + lossEnt || 1);

        // --- 3. HISTÓRICO DE CICLOS & ESTADO ATUAL DA ZONA ---
        const fullCycles: { type: 'W' | 'L'; count: number }[] = [];
        for (const out of outcomesCiclos) {
          if (fullCycles.length === 0) {
            fullCycles.push({ type: out, count: 1 });
          } else {
            const last = fullCycles[fullCycles.length - 1];
            if (last.type === out) {
              last.count++;
            } else {
              fullCycles.push({ type: out, count: 1 });
            }
          }
        }

        const cycleStats: { W: Record<number, { win: number; loss: number }>; L: Record<number, { win: number; loss: number }> } = { W: {}, L: {} };
        let runningType: 'W' | 'L' | null = null;
        let runningCount = 0;

        for (let i = 0; i < outcomesCiclos.length; i++) {
          const out = outcomesCiclos[i];
          if (runningType && runningCount > 0) {
            if (!cycleStats[runningType][runningCount]) {
              cycleStats[runningType][runningCount] = { win: 0, loss: 0 };
            }
            if (out === 'W') {
              cycleStats[runningType][runningCount].win++;
            } else {
              cycleStats[runningType][runningCount].loss++;
            }
          }
          if (runningType === out) {
            runningCount++;
          } else {
            runningType = out;
            runningCount = 1;
          }
        }

        const currentCycleState = { type: runningType, count: runningCount };
        let currentCycleWinrate = 0;
        let currentCycleTotal = 0;
        let currentCycleWins = 0;
        if (runningType && cycleStats[runningType][runningCount]) {
          const st = cycleStats[runningType][runningCount];
          currentCycleTotal = st.win + st.loss;
          currentCycleWins = st.win;
          currentCycleWinrate = currentCycleTotal > 0 ? (st.win / currentCycleTotal) * 100 : 0;
        }

        return {
          id: pat.join('-'),
          pat,
          winCiclo,
          lossCiclo,
          saCiclo,
          smCiclo,
          wrCiclo,
          winEnt,
          lossEnt,
          sa,
          sm,
          wrEntrada,
          csCiclo,
          outcomesCiclos,
          fullCycles,
          currentCycleState,
          currentCycleWinrate,
          currentCycleTotal,
          currentCycleWins,
        };
      })
      .filter(s => s.winCiclo >= mw)
      .sort((a, b) => {
        if (sc === 'TX_ESTADO') return sd === 'desc' ? b.currentCycleWinrate - a.currentCycleWinrate : a.currentCycleWinrate - b.currentCycleWinrate;
        if (sc === 'SA') return sd === 'desc' ? b.sa - a.sa : a.sa - b.sa;
        if (sc === 'SM') return sd === 'desc' ? b.sm - a.sm : a.sm - b.sm;
        if (sc === 'WIN_CICLO') return sd === 'desc' ? b.winCiclo - a.winCiclo : a.winCiclo - b.winCiclo;
        if (sc === 'LOSS_CICLO') return sd === 'desc' ? b.lossCiclo - a.lossCiclo : a.lossCiclo - b.lossCiclo;
        if (sc === 'TX_ENTRADA') return sd === 'desc' ? b.wrEntrada - a.wrEntrada : a.wrEntrada - b.wrEntrada;
        return sd === 'desc' ? b.wrCiclo - a.wrCiclo : a.wrCiclo - b.wrCiclo;
      })
      .slice(0, 60);
  }, [snapshot, casas, ph, pats, mw, sc, sd]);

  const nc = (n: number) =>
    n === 0 ? 'bg-white text-black font-extrabold' : n <= 7 ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white';

  const handleProcess = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setSnapshot(data);
      setIsProcessing(false);
    }, 100);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-[#0d0f1a] border border-white/5 rounded-2xl shadow-xl">
        {[
          [
            'Entradas no Ciclo',
            casas,
            setCasas,
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15],
            (v: number) => `${v} entradas`,
          ],
          [
            'Período Análise',
            ph,
            setPh,
            [1, 2, 3, 6, 9, 12, 24, 48, 72, 168, 336, 720],
            (v: number) => (v >= 168 ? `${v / 24}d` : `${v}h`),
          ],
        ].map(([l, v, s, o, f]: any) => (
          <div key={l} className="flex flex-col gap-1">
            <label className="text-[9px] text-gray-400 uppercase font-black tracking-widest">{l}</label>
            <select
              className="bg-black/50 border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none focus:border-purple-500 transition-colors font-semibold"
              value={v}
              onChange={e => {
                const val = Number(e.target.value);
                s(val);
                if (l.includes('Período')) requireHours?.(val);
              }}
            >
              {o.map((x: number) => (
                <option key={x} value={x}>
                  {f(x)}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <label className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Min Win (Ciclos)</label>
          <input
            type="number"
            min="0"
            value={mw}
            onChange={e => setMw(Number(e.target.value))}
            className="bg-black/50 border border-white/10 text-white px-3 py-2 rounded-lg text-xs outline-none w-24 focus:border-purple-500 transition-colors font-semibold"
          />
        </div>

        <button
          onClick={handleProcess}
          disabled={isProcessing}
          className="ml-auto flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Sigma size={14} />
          )}
          Analisar Ciclos
        </button>
      </div>

      {!snapshot.length ? (
        <div className="py-24 text-center opacity-40 flex flex-col items-center gap-3">
          <FlaskConical size={52} className="text-purple-500" />
          <div className="text-xs font-black uppercase tracking-widest text-white">
            Clique em "Analisar Ciclos" para calcular estatísticas de ciclos e estado da zona
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#080911]">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gradient-to-r from-purple-950/60 to-indigo-950/40 text-white border-b border-white/10">
                <th className="p-3 text-center w-12"></th>
                <th className="p-3 text-center text-xs font-bold uppercase tracking-wider">Padrão</th>
                <th className="p-3 text-center text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Estado Atual
                </th>
                <th
                  onClick={() => hs('TX_ESTADO')}
                  className="p-3 text-center text-xs font-black uppercase tracking-wider text-cyan-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    TX Estado % {sc === 'TX_ESTADO' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('TX_CICLO')}
                  className="p-3 text-center text-xs font-black uppercase tracking-wider text-purple-300 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    TX Ciclo % {sc === 'TX_CICLO' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('WIN_CICLO')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-emerald-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    Win Ciclos {sc === 'WIN_CICLO' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('LOSS_CICLO')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-rose-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    Loss Ciclos {sc === 'LOSS_CICLO' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('TX_ENTRADA')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    TX Entrada {sc === 'TX_ENTRADA' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('SM')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-amber-300 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    SM {sc === 'SM' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                <th
                  onClick={() => hs('SA')}
                  className="p-3 text-center text-xs font-bold uppercase tracking-wider text-amber-400 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    SA {sc === 'SA' && <ArrowUpDown size={11} />}
                  </span>
                </th>
                {Array.from({ length: casas }).map((_, i) => (
                  <th key={i} className="p-3 text-center text-xs font-bold uppercase text-purple-400">
                    C{i + 1}
                  </th>
                ))}
                <th className="p-3 text-center text-xs font-bold uppercase text-gray-500">Histórico</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => {
                const wrC = (s.wrCiclo * 100).toFixed(1);
                const wrE = (s.wrEntrada * 100).toFixed(1);
                const isAlert = s.sm > 0 && s.sa > 0 && s.sm - s.sa <= 2;

                return (
                  <motion.tr
                    layout
                    key={s.id}
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleCopy(s.pat, s.id)}
                        className="bg-white/5 hover:bg-white/10 p-1.5 rounded transition-colors text-gray-400 hover:text-white"
                        title="Copiar fórmula"
                      >
                        {copiedId === s.id ? (
                          <span className="text-[9px] font-black text-emerald-400">OK</span>
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-center">
                        {s.pat.map((n: number, i: number) => (
                          <div
                            key={i}
                            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shadow-md ${nc(
                              n
                            )}`}
                          >
                            {n}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Estado Atual Badge */}
                    <td className="p-3 text-center">
                      {s.currentCycleState.type ? (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${
                            s.currentCycleState.type === 'W'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                              : 'bg-rose-950/60 text-rose-400 border-rose-500/40'
                          }`}
                        >
                          Após {s.currentCycleState.count} {s.currentCycleState.type === 'W' ? 'WIN' : 'LOSS'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-600">-</span>
                      )}
                    </td>

                    {/* Winrate do Estado Atual */}
                    <td className="p-3 text-center font-black text-sm text-cyan-300">
                      {s.currentCycleTotal > 0 ? (
                        <span className="bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 px-2.5 py-1 rounded-md shadow-sm">
                          {s.currentCycleWinrate.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </td>

                    {/* TX Ciclo % */}
                    <td className="p-3 text-center font-black text-sm text-purple-300">
                      <span className="bg-purple-950/60 border border-purple-500/30 px-2.5 py-1 rounded-md shadow-sm">
                        {wrC}%
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-400">{s.winCiclo}</td>
                    <td className="p-3 text-center font-bold text-rose-400">{s.lossCiclo}</td>
                    <td className="p-3 text-center text-gray-400 text-xs font-semibold">{wrE}%</td>
                    <td className={`p-3 text-center font-bold ${isAlert ? 'text-amber-300 bg-amber-950/30' : 'text-gray-300'}`}>
                      {s.sm}
                    </td>
                    <td className={`p-3 text-center font-bold ${isAlert ? 'text-amber-300 bg-amber-950/30' : 'text-gray-300'}`}>
                      {s.sa}
                    </td>
                    {s.csCiclo.map((v: number, i: number) => (
                      <td key={i} className="p-3 text-center text-gray-400 text-xs font-medium">
                        {v}
                      </td>
                    ))}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => setSelectedStat(s)}
                        className="bg-white/5 hover:bg-white/10 p-1.5 rounded transition-colors text-purple-400 hover:text-white"
                        title="Ver Histórico Cronológico"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedStat && <CycleDetailModal stat={selectedStat} onClose={() => setSelectedStat(null)} />}
    </div>
  );
}

type Tab = 'cores' | 'numeros';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'cores', label: 'Padrões de Cores (Ciclos)', icon: '🎨' },
  { id: 'numeros', label: 'Padrões Numéricos (Ciclos)', icon: '🔢' },
];

export default function LaboratorioAvancadoPage() {
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('cores');
  const [colorSize, setColorSize] = useState(3);
  const [numSize, setNumSize] = useState(1);
  const [loadedHours, setLoadedHours] = useState(72);

  const fetchPeriod = async (hours: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/results/period?hours=${hours}&compact=true`);
      if (!res.ok) return;
      const j = await res.json();
      if (j.data && j.data.length > 0) {
        setData(
          j.data.map((r: any) => ({
            ...r,
            color: r.color ? String(r.color).charAt(0).toUpperCase() + String(r.color).slice(1).toLowerCase() : 'Branco',
            roll: r.roll ? String(r.roll) : '0',
          }))
        );
        setLoadedHours(hours);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const requireHours = (hours: number) => {
    if (hours > loadedHours) {
      fetchPeriod(hours);
    }
  };

  const { subscribe } = useSSE();

  useEffect(() => {
    fetchPeriod(72);
  }, []);

  useEffect(() => {
    const unsub = subscribe(mappedRoll => {
      setData(prev => {
        if (prev.some(r => r.id === mappedRoll.id)) return prev;
        const next = [...prev, mappedRoll];
        if (next.length > 100000) return next.slice(-100000);
        return next;
      });
    });
    return unsub;
  }, [subscribe]);

  return (
    <main className="min-h-screen bg-[#050507] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#0a0a0f] border-b border-white/5 h-[72px] px-6 flex items-center justify-between shadow-2xl shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/laboratorio"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-purple-400 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft size={14} /> Voltar ao Laboratório Standard
          </Link>

          <h1 className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 flex items-center gap-2">
            <Sparkles className="text-purple-400" size={22} />
            Laboratório Avançado (Análise por Ciclos)
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {loading && <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />}
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
            {data.length} giros · 15s SSE
          </span>
        </div>
      </div>

      {/* Histórico */}
      <div className="px-6 pt-4 shrink-0 z-10 w-full">
        <LiveHistoryCard data={data} maxItems={35} />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-black whitespace-nowrap transition-all border-b-2 ${
              tab === t.id
                ? 'bg-[#0d0f1a] border-purple-500 text-purple-300 shadow-lg'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="h-px bg-white/5 mx-6" />

      {/* Size selector for patterns */}
      <div className="flex items-center gap-3 px-6 pt-4">
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Tamanho do Padrão:</span>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
          {(tab === 'cores' ? [3, 4, 5, 6, 7, 8] : [1, 2, 3]).map(s => (
            <button
              key={s}
              onClick={() => (tab === 'cores' ? setColorSize(s) : setNumSize(s))}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                (tab === 'cores' ? colorSize : numSize) === s
                  ? 'bg-purple-600/40 text-purple-200 border border-purple-500/40'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-gray-600 font-semibold">
          {tab === 'cores' ? `${CP[colorSize]?.length} combinações` : `${NP[numSize]?.length} combinações`}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {loading && data.length === 0 ? (
            <motion.div
              key="load"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              <span className="text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse">
                Carregando dados em tempo real...
              </span>
            </motion.div>
          ) : tab === 'cores' ? (
            <motion.div key="cores" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <AdvancedColorTable pats={CP[colorSize] || []} data={data} requireHours={requireHours} />
            </motion.div>
          ) : tab === 'numeros' ? (
            <motion.div key="numeros" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <AdvancedNumberTable pats={NP[numSize] || []} data={data} requireHours={requireHours} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
