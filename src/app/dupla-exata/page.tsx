'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { Target, Activity, Check, Copy, Flame, FlaskConical } from 'lucide-react';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';
import Link from 'next/link';

export default function DuplaExataPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [numEntradas, setNumEntradas] = useState(1);
  const [casasLimit, setCasasLimit] = useState(15);
  const [periodHours, setPeriodHours] = useState(24);
  const [targetMode, setTargetMode] = useState<'branco' | 'cores'>('branco');
  const [scanSortBy, setScanSortBy] = useState<'perc' | 'sa' | 'sm'>('perc');
  const [minSaFilter, setMinSaFilter] = useState(0);
  const [maxSaFilter, setMaxSaFilter] = useState(999);
  const [minSmFilter, setMinSmFilter] = useState(0);
  const [minPercFilter, setMinPercFilter] = useState(0);
  const [maxPercFilter, setMaxPercFilter] = useState(100);

  const [showCopyModal, setShowCopyModal] = useState(false);
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const generateAllPatternsText = () => {
     let text = '';
     for (const st of stats) {
        const spaces = Array(st.casa - 1).fill('@').join(' ');
        const targetStr = st.cor === 'branco' ? `branco g${numEntradas - 1}` : st.cor === 'red' ? `vermelho g${numEntradas - 1}` : `preto g${numEntradas - 1}`;
        const str = spaces ? `${st.p1} ${st.p2} ${spaces} = ${targetStr}` : `${st.p1} ${st.p2} = ${targetStr}`;
        text += str + '\n';
     }
     return text.trim();
  };

  const handleCopyAll = () => {
     navigator.clipboard.writeText(generateAllPatternsText());
     setIsCopiedAll(true);
     setTimeout(() => setIsCopiedAll(false), 2000);
  };

  const handleCopyPattern = (st: any) => {
      const spaces = Array(st.casa - 1).fill('@').join(' ');
      const targetStr = st.cor === 'branco' ? `branco g${numEntradas - 1}` : st.cor === 'red' ? `vermelho g${numEntradas - 1}` : `preto g${numEntradas - 1}`;
      const str = spaces ? `${st.p1} ${st.p2} ${spaces} = ${targetStr}` : `${st.p1} ${st.p2} = ${targetStr}`;
      navigator.clipboard.writeText(str);
      const key = `${st.p1}-${st.p2}-${st.casa}-${st.cor}`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
  };

  const { subscribe } = useSSE();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/results/period?hours=${periodHours}`);
      if (!res.ok) throw new Error('Falha');
      const json = await res.json();
      if (json.data) {
        const parsed = json.data.map((r: any) => ({ 
          ...r, 
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), 
          roll: r.roll?.toString() 
        }));
        setData(parsed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [periodHours]);

  useEffect(() => {
    const unsub = subscribe((newRoll) => {
      setData(prev => {
        if (prev.some(r => r.id === newRoll.id || new Date(r.timestamp).getTime() === new Date(newRoll.timestamp).getTime())) return prev;
        const newStone = {
          ...newRoll,
          color: newRoll.color?.toString().charAt(0).toUpperCase() + newRoll.color?.toString().slice(1).toLowerCase(),
          roll: newRoll.roll?.toString()
        };
        const updated = [...prev, newStone];
        if (updated.length > 20000) updated.shift();
        return updated;
      });
    });
    return unsub;
  }, [subscribe]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Matrizes para as estatísticas
    // Como temos 15x15 = 225 pares, usaremos chaves string "p1-p2" ou índice p1 * 15 + p2
    const pairData: Record<string, any> = {};

    // Inicialização sob demanda
    const getPairData = (key: string) => {
        if (!pairData[key]) {
            pairData[key] = {
                totals: Array(casasLimit).fill(0),
                branco: { sa: Array(casasLimit).fill(0), sm: Array(casasLimit).fill(0), hits: Array(casasLimit).fill(0) },
                red: { sa: Array(casasLimit).fill(0), sm: Array(casasLimit).fill(0), hits: Array(casasLimit).fill(0) },
                black: { sa: Array(casasLimit).fill(0), sm: Array(casasLimit).fill(0), hits: Array(casasLimit).fill(0) }
            };
        }
        return pairData[key];
    };

    for (let i = 1; i < data.length; i++) {
      const currentRoll = data[i];
      const prevRoll = data[i - 1];

      const p1 = parseInt(prevRoll.roll);
      const p2 = parseInt(currentRoll.roll);

      if (isNaN(p1) || isNaN(p2)) continue;

      const isBranco = currentRoll.color.includes('Branco') || currentRoll.roll === '0';
      const isRed = currentRoll.color.includes('Vermelho') || (p2 >= 1 && p2 <= 7);
      const isBlack = currentRoll.color.includes('Preto') || (p2 >= 8 && p2 <= 14);

      for (let c = 1; c <= casasLimit; c++) {
        // Look back para achar o par que serviu de gatilho
        const pairIndex2 = i - c;
        const pairIndex1 = pairIndex2 - 1;

        if (pairIndex1 >= 0) {
            const trig1 = parseInt(data[pairIndex1].roll);
            const trig2 = parseInt(data[pairIndex2].roll);

            if (!isNaN(trig1) && !isNaN(trig2) && trig1 >= 0 && trig1 <= 14 && trig2 >= 0 && trig2 <= 14) {
                const key = `${trig1}-${trig2}`;
                const st = getPairData(key);

                let hasBranco = false;
                let hasRed = false;
                let hasBlack = false;

                let maxAvailableEntries = Math.min(numEntradas, data.length - pairIndex2 - c);
                if (maxAvailableEntries < 1) continue;

                for (let e = 0; e < maxAvailableEntries; e++) {
                  const targetRoll = data[pairIndex2 + c + e];
                  if (targetRoll.color.includes('Branco') || targetRoll.roll === '0') hasBranco = true;
                  if (targetRoll.color.includes('Vermelho') || (parseInt(targetRoll.roll) >= 1 && parseInt(targetRoll.roll) <= 7)) hasRed = true;
                  if (targetRoll.color.includes('Preto') || (parseInt(targetRoll.roll) >= 8 && parseInt(targetRoll.roll) <= 14)) hasBlack = true;
                }

                const isWindowClosed = (maxAvailableEntries === numEntradas);
                let countedTotal = false;

                if (hasBranco || isWindowClosed) {
                    st.totals[c - 1]++;
                    countedTotal = true;
                    if (hasBranco) {
                        st.branco.sa[c - 1] = 0;
                        st.branco.hits[c - 1]++;
                    } else {
                        st.branco.sa[c - 1]++;
                        if (st.branco.sa[c - 1] > st.branco.sm[c - 1]) st.branco.sm[c - 1] = st.branco.sa[c - 1];
                    }
                }

                if (hasRed || isWindowClosed) {
                    if (!countedTotal) { st.totals[c - 1]++; countedTotal = true; }
                    if (hasRed) {
                        st.red.sa[c - 1] = 0;
                        st.red.hits[c - 1]++;
                    } else {
                        st.red.sa[c - 1]++;
                        if (st.red.sa[c - 1] > st.red.sm[c - 1]) st.red.sm[c - 1] = st.red.sa[c - 1];
                    }
                }

                if (hasBlack || isWindowClosed) {
                    if (!countedTotal) { st.totals[c - 1]++; countedTotal = true; }
                    if (hasBlack) {
                        st.black.sa[c - 1] = 0;
                        st.black.hits[c - 1]++;
                    } else {
                        st.black.sa[c - 1]++;
                        if (st.black.sa[c - 1] > st.black.sm[c - 1]) st.black.sm[c - 1] = st.black.sa[c - 1];
                    }
                }
            }
        }
      }
    }

    // Filtrar e preparar array final
    const results: any[] = [];
    Object.keys(pairData).forEach(key => {
        const [trig1, trig2] = key.split('-').map(Number);
        const st = pairData[key];

        for (let c = 0; c < casasLimit; c++) {
            const total = st.totals[c];
            if (total === 0) continue;

            if (targetMode === 'branco') {
                const hits = st.branco.hits[c];
                const sa = st.branco.sa[c];
                const sm = st.branco.sm[c];
                const perc = (hits / total) * 100;

                if (sa >= minSaFilter && sa <= maxSaFilter && sm >= minSmFilter && perc >= minPercFilter && perc <= maxPercFilter) {
                    results.push({ p1: trig1, p2: trig2, casa: c + 1, cor: 'branco', hits, total, perc, sa, sm });
                }
            } else {
                // Red
                const rHits = st.red.hits[c];
                const rSa = st.red.sa[c];
                const rSm = st.red.sm[c];
                const rPerc = (rHits / total) * 100;
                if (rSa >= minSaFilter && rSa <= maxSaFilter && rSm >= minSmFilter && rPerc >= minPercFilter && rPerc <= maxPercFilter) {
                    results.push({ p1: trig1, p2: trig2, casa: c + 1, cor: 'red', hits: rHits, total, perc: rPerc, sa: rSa, sm: rSm });
                }

                // Black
                const bHits = st.black.hits[c];
                const bSa = st.black.sa[c];
                const bSm = st.black.sm[c];
                const bPerc = (bHits / total) * 100;
                if (bSa >= minSaFilter && bSa <= maxSaFilter && bSm >= minSmFilter && bPerc >= minPercFilter && bPerc <= maxPercFilter) {
                    results.push({ p1: trig1, p2: trig2, casa: c + 1, cor: 'black', hits: bHits, total, perc: bPerc, sa: bSa, sm: bSm });
                }
            }
        }
    });

    results.sort((a, b) => {
        if (scanSortBy === 'perc') return b.perc - a.perc || b.hits - a.hits;
        if (scanSortBy === 'sa') return b.sa - a.sa || b.sm - a.sm;
        if (scanSortBy === 'sm') return b.sm - a.sm || b.sa - a.sa;
        return 0;
    });
    return results;

  }, [data, casasLimit, targetMode, scanSortBy, minSaFilter, minSmFilter, minPercFilter, numEntradas]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-full w-full mx-auto flex flex-col gap-6 bg-[#030303]">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-6 w-full">
      <section className="flex flex-wrap justify-between items-center bg-[#0a0a0f] p-4 rounded-lg border border-white/5 gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
             <h2 className="text-2xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 flex items-center gap-2">
               <Target className="text-red-500" />
               Dupla Exata
             </h2>
          </div>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Laboratório Temporal</span>
        </div>
        
        {/* Painel de Filtros */}
        <div className="flex flex-wrap items-center gap-4 bg-[#12141c] p-3 rounded-lg border border-white/5">
          <div className="flex items-center gap-3 pr-4 border-r border-white/10">
             <button 
                onClick={() => setShowCopyModal(true)}
                className="flex items-center justify-center w-8 h-8 bg-[#0a0a0f] text-gray-400 hover:text-white border border-white/10 rounded-md transition-colors"
                title="Copiar Todos"
             >
                <Copy size={14} />
             </button>
             <div className="flex flex-col gap-1">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Alvo</label>
                <select 
                   value={targetMode} 
                   onChange={(e) => setTargetMode(e.target.value as 'branco' | 'cores')}
                   className="bg-[#0a0a0f] text-white px-2 py-1 rounded border border-white/10 text-xs font-bold outline-none focus:border-red-500"
                >
                   <option value="branco">BRANCOS</option>
                   <option value="cores">CORES</option>
                </select>
             </div>
             <div className="flex flex-col gap-1">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Entradas</label>
                <input 
                   type="number" 
                   min="1" 
                   max="20"
                   value={numEntradas} 
                   onChange={(e) => setNumEntradas(Number(e.target.value) || 1)}
                   className="w-16 bg-[#0a0a0f] text-white px-2 py-1 rounded border border-white/10 text-xs font-bold outline-none focus:border-red-500 text-center"
                />
             </div>
             <div className="flex flex-col gap-1">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Casas</label>
                <select 
                   value={casasLimit} 
                   onChange={(e) => setCasasLimit(Number(e.target.value))}
                   className="bg-[#0a0a0f] text-white px-2 py-1 rounded border border-white/10 text-xs font-bold outline-none focus:border-red-500"
                >
                   {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(c => (
                       <option key={c} value={c}>{c}</option>
                   ))}
                </select>
             </div>
             <div className="flex flex-col gap-1">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Histórico</label>
                <select 
                   value={periodHours} 
                   onChange={(e) => setPeriodHours(Number(e.target.value))}
                   className="bg-[#0a0a0f] text-white px-2 py-1 rounded border border-white/10 text-xs font-bold outline-none focus:border-red-500"
                >
                   {[1, 2, 3, 4, 5, 6, 9, 12, 18, 24, 36, 48, 72, 120, 168, 336].map(h => (
                       <option key={h} value={h}>{h}H</option>
                   ))}
                </select>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex flex-col gap-1 items-center">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest" title="Mínimo e Máximo">Assertividade</label>
                <div className="flex items-center gap-1">
                   <input type="number" min="0" max="100" value={minPercFilter} onChange={e => setMinPercFilter(Number(e.target.value))} className="w-10 bg-[#0a0a0f] border border-white/10 rounded px-1 text-white text-center text-xs py-1 outline-none focus:border-green-500" title="Mínimo (%)" />
                   <span className="text-gray-600 text-xs">-</span>
                   <input type="number" min="0" max="100" value={maxPercFilter} onChange={e => setMaxPercFilter(Number(e.target.value))} className="w-10 bg-[#0a0a0f] border border-white/10 rounded px-1 text-white text-center text-xs py-1 outline-none focus:border-green-500" title="Máximo (%)" />
                </div>
             </div>
             
             <div className="flex flex-col gap-1 items-center">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest" title="Mínimo e Máximo">SA Atual</label>
                <div className="flex items-center gap-1">
                   <input type="number" min="0" value={minSaFilter} onChange={e => setMinSaFilter(Number(e.target.value))} className="w-10 bg-[#0a0a0f] border border-white/10 rounded px-1 text-white text-center text-xs py-1 outline-none focus:border-red-500" title="Mínimo" />
                   <span className="text-gray-600 text-xs">-</span>
                   <input type="number" min="0" value={maxSaFilter} onChange={e => setMaxSaFilter(Number(e.target.value))} className="w-10 bg-[#0a0a0f] border border-white/10 rounded px-1 text-white text-center text-xs py-1 outline-none focus:border-red-500" title="Máximo" />
                </div>
             </div>

             <div className="flex flex-col gap-1 items-center">
                <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">MIN SM</label>
                <input type="number" min="0" value={minSmFilter} onChange={e => setMinSmFilter(Number(e.target.value))} className="w-10 bg-[#0a0a0f] border border-white/10 rounded px-1 text-white text-center text-xs py-1 outline-none focus:border-gray-500" title="Mínimo SM" />
             </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
            <Activity className="animate-spin text-red-500 w-8 h-8" />
        </div>
      ) : (
        <section className="bg-[#0a0a0f] rounded-xl border border-white/5 overflow-hidden flex flex-col shadow-2xl">
                <div className="max-h-[40vh] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#12141c] text-xs font-black uppercase text-gray-500 border-b border-white/5 sticky top-0 z-10">
                        <tr>
                            <th className="py-4 px-6 text-center">Gatilho (Dupla)</th>
                            <th className="py-4 px-6 text-center">Casa Alvo</th>
                            <th className="py-4 px-6 text-center">Cor Alvo</th>
                            <th className="py-4 px-6 text-center">Win / Loss</th>
                            <th className="py-4 px-6 text-center cursor-pointer hover:text-white transition-colors" onClick={() => setScanSortBy('sa')}>
                                SA Atual {scanSortBy === 'sa' && <span className="text-red-500 ml-1">▼</span>}
                            </th>
                            <th className="py-4 px-6 text-center cursor-pointer hover:text-white transition-colors" onClick={() => setScanSortBy('sm')}>
                                SM (Teto) {scanSortBy === 'sm' && <span className="text-red-500 ml-1">▼</span>}
                            </th>
                            <th className="py-4 px-6 text-center cursor-pointer hover:text-white transition-colors" onClick={() => setScanSortBy('perc')}>
                                Assertividade {scanSortBy === 'perc' && <span className="text-green-500 ml-1">▼</span>}
                            </th>
                            <th className="py-4 px-6 text-center">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm font-bold">
                        {stats.length > 0 ? stats.map((st, idx) => (
                            <tr key={`${st.p1}-${st.p2}-${st.casa}-${st.cor}-${idx}`} className="hover:bg-white/5 transition-colors">
                                <td className="py-3 px-6">
                                    <div className="flex items-center justify-center gap-2">
                                        <GlobalStoneIcon n={st.p1} size="sm" />
                                        <span className="text-gray-600">+</span>
                                        <GlobalStoneIcon n={st.p2} size="sm" />
                                    </div>
                                </td>
                                <td className="py-3 px-6 text-center text-gray-400">
                                    Casa {st.casa}
                                </td>
                                <td className="py-3 px-6">
                                    <div className="flex justify-center">
                                        <div className={`w-7 h-7 rounded flex items-center justify-center overflow-hidden border border-white/20 shadow-sm ${
                                            st.cor === 'branco' ? 'bg-white' : 
                                            st.cor === 'red' ? 'bg-[#e51e3e]' : 
                                            'bg-[#2c2f33]'
                                        }`}>
                                            {st.cor === 'branco' && <img src="/blaze-white.png" alt="W" className="w-5 h-5 object-contain" />}
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-6 text-center">
                                    <span className="text-green-400">{st.hits}</span>
                                    <span className="text-gray-600 mx-2">/</span>
                                    <span className="text-red-400">{st.total - st.hits}</span>
                                </td>
                                <td className="py-3 px-6 text-center text-white">{st.sa}</td>
                                <td className="py-3 px-6 text-center text-gray-500">{st.sm}</td>
                                <td className="py-3 px-6 text-center">
                                    <span className={`${st.perc >= 80 ? 'text-green-400' : 'text-amber-400'}`}>
                                        {st.perc.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="py-3 px-6 text-center">
                                    <button 
                                        onClick={() => handleCopyPattern(st)}
                                        className="text-gray-500 hover:text-white transition-colors"
                                        title="Copiar Padrão"
                                    >
                                        {copiedKey === `${st.p1}-${st.p2}-${st.casa}-${st.cor}` ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Target size={48} className="opacity-20" />
                                        <span className="font-bold uppercase tracking-widest text-sm">Nenhum par atende aos filtros</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </section>
      )}

      {/* HISTÓRICO E INTEGRAÇÃO */}
      <section className="bg-[#121214] border border-[#2a2a35] rounded-xl overflow-x-auto p-4 shadow-xl shrink-0">
         <FixedColumnsHistory data={data.slice(-200)} stats={stats} numEntradas={numEntradas} />
      </section>

      {/* MODAL COPIAR TODOS */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-[#2a2a35] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#0a0a0f]">
              <h3 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                 <Copy size={16} className="text-[#86a8e7]" />
                 Exportar Padrões
              </h3>
              <button onClick={() => setShowCopyModal(false)} className="text-gray-500 hover:text-white transition-colors font-bold">
                 X
              </button>
            </div>
            <div className="p-4 bg-[#0a0a0f]">
              <textarea 
                readOnly
                className="w-full h-64 bg-[#12141c] border border-white/10 rounded-lg p-3 text-sm text-gray-300 font-mono focus:outline-none custom-scrollbar resize-none"
                value={generateAllPatternsText()}
              />
              <p className="text-[10px] text-gray-500 font-bold uppercase mt-2">
                 Total de padrões filtrados: {stats.length}
              </p>
            </div>
            <div className="p-4 border-t border-white/5 flex justify-end gap-3 bg-[#0a0a0f]">
              <button 
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 rounded font-bold text-xs uppercase text-gray-400 hover:bg-white/5 transition-colors"
              >
                Fechar
              </button>
              <button 
                onClick={handleCopyAll}
                className={`px-4 py-2 rounded font-bold text-xs uppercase flex items-center gap-2 transition-colors shadow-lg ${isCopiedAll ? 'bg-green-600 text-white' : 'bg-[#1b2b42] text-[#86a8e7] hover:bg-[#233857]'}`}
              >
                {isCopiedAll ? 'Copiado!' : 'Copiar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </main>
  );
}

function FixedColumnsHistory({ data, stats, numEntradas }: { data: any[], stats?: any[], numEntradas: number }) {
   const [preds, setPreds] = useState<Record<string, string>>({});
   const [integrationOn, setIntegrationOn] = useState(false);
   const [integrationStartTimeMs, setIntegrationStartTimeMs] = useState<number>(0);
   const [score, setScore] = useState<{ w: number, l: number, sa: number, sm: number, cycleHistory: {type: 'W'|'L', count: number}[], currentCycleType: 'W'|'L'|null, currentCycleCount: number }>({ w: 0, l: 0, sa: 0, sm: 0, cycleHistory: [], currentCycleType: null, currentCycleCount: 0 });
   const evaluatedKeysRef = useRef<Set<string>>(new Set());
   const evaluatedVisualsRef = useRef<Record<string, string>>({});
   const previousAutoTargetsRef = useRef<Record<string, { cor: string; count: number }>>({});
   const hindsightKeysRef = useRef<Set<string>>(new Set());

   const cyclePred = (key: string) => {
      setPreds(p => {
         const curr = p[key];
         let next = 'white';
         if (curr === 'white') next = 'red';
         else if (curr === 'red') next = 'black';
         else if (curr === 'black') next = '';
         
         if (next === '') {
            const copy = {...p};
            delete copy[key];
            return copy;
         }
         return { ...p, [key]: next };
      });
   };

   const gridData = useMemo(() => {
      const map = new Map<number, any[][]>();
      const keys = new Set<number>();
      let maxB = -1;
      
      for (const r of data) {
         const ts = r.timestamp ? new Date(r.timestamp).getTime() : (r.created_at ? new Date(r.created_at).getTime() : Date.now());
         const dt = new Date(ts - 3 * 3600 * 1000);
         const min = dt.getUTCMinutes();
         const sec = dt.getUTCSeconds();
         const blockId = Math.floor(dt.getTime() / (10 * 60 * 1000));
         
         if (blockId > maxB) maxB = blockId;

         if (!map.has(blockId)) {
            map.set(blockId, Array.from({length: 10}, () => [null, null]));
            keys.add(blockId);
         }
         
         const col = min % 10;
         const split = sec >= 30 ? 1 : 0;
         map.get(blockId)![col][split] = r;
      }
      
      if (maxB !== -1) {
         map.set(maxB + 1, Array.from({length: 10}, () => [null, null]));
         map.set(maxB + 2, Array.from({length: 10}, () => [null, null]));
         keys.add(maxB + 1);
         keys.add(maxB + 2);
      }

      const sortedKeys = Array.from(keys).sort((a, b) => b - a);
      return { map, sortedKeys };
   }, [data]);

   const autoTargets = useMemo(() => {
      const targets: Record<string, { cor: string; count: number }> = {};
      if (!integrationOn || !stats || stats.length === 0 || data.length === 0) return targets;

      const triggersByPair: Record<string, { casa: number, cor: string }[]> = {};
      for (const st of stats) {
          const key = `${st.p1}-${st.p2}`;
          if (!triggersByPair[key]) triggersByPair[key] = [];
          triggersByPair[key].push({ casa: st.casa, cor: st.cor });
      }

      for (let i = 1; i < data.length; i++) {
         const r1 = data[i-1];
         const r2 = data[i];
         if (r1.roll == null || r2.roll == null) continue;
         
         const key = `${r1.roll}-${r2.roll}`;
         const targetList = triggersByPair[key];
         if (!targetList) continue;

         for (const targetItem of targetList) {
             for (let e = 0; e < numEntradas; e++) {
                 const targetIdx = i + targetItem.casa + e;
                 let targetTs: number;
                 let hit = false;

                 if (targetIdx < data.length) {
                     const targetStone = data[targetIdx];
                     targetTs = targetStone.timestamp ? new Date(targetStone.timestamp).getTime() : (targetStone.created_at ? new Date(targetStone.created_at).getTime() : Date.now());
                     
                     const isBranco = targetStone.color.includes('Branco') || targetStone.roll === '0';
                     const isRed = targetStone.color.includes('Vermelho') || (parseInt(targetStone.roll as string) >= 1 && parseInt(targetStone.roll as string) <= 7);
                     const isBlack = targetStone.color.includes('Preto') || (parseInt(targetStone.roll as string) >= 8 && parseInt(targetStone.roll as string) <= 14);
                     
                     if (targetItem.cor === 'branco' && isBranco) hit = true;
                     if (targetItem.cor === 'red' && isRed) hit = true;
                     if (targetItem.cor === 'black' && isBlack) hit = true;
                 } else {
                     const latestStone = data[data.length - 1];
                     const latestTs = latestStone.timestamp ? new Date(latestStone.timestamp).getTime() : (latestStone.created_at ? new Date(latestStone.created_at).getTime() : Date.now());
                     const remaining = targetIdx - (data.length - 1);
                     targetTs = latestTs + remaining * 30 * 1000;
                 }

                 const dt = new Date(targetTs - 3 * 3600 * 1000);
                 const blockId = Math.floor(dt.getTime() / (10 * 60 * 1000));
                 const col = dt.getUTCMinutes() % 10;
                 const split = dt.getUTCSeconds() >= 30 ? 1 : 0;
                 const cellKey = `${blockId}-${col}-${split}`;
                 
                 if (targets[cellKey]) {
                     targets[cellKey].count++;
                     if (targets[cellKey].cor !== targetItem.cor && targets[cellKey].cor !== 'misto') {
                         targets[cellKey].cor = 'misto';
                     }
                 } else {
                     targets[cellKey] = { cor: targetItem.cor, count: 1 };
                 }

                 if (hit) break;
             }
         }
      }

      return targets;
   }, [data, stats, integrationOn, numEntradas]);

   const activeTargets = useMemo(() => {
       const combined = { ...evaluatedVisualsRef.current, ...autoTargets, ...preds };
       for (const key of hindsightKeysRef.current) {
           delete combined[key];
       }
       return combined;
   }, [preds, autoTargets]);

   useEffect(() => {
      if (!integrationOn || data.length === 0) return;

      let { w, l, sa, sm, cycleHistory, currentCycleType, currentCycleCount } = score;
      let changed = false;

      const latestStone = data[data.length - 1];
      const ts = latestStone.timestamp ? new Date(latestStone.timestamp).getTime() : Date.now();
      const dt = new Date(ts - 3 * 3600 * 1000);
      const currentBk = Math.floor(dt.getTime() / (10 * 60 * 1000));
      const currentCol = dt.getUTCMinutes() % 10;
      const currentSplit = dt.getUTCSeconds() >= 30 ? 1 : 0;

      const targetsToEvaluate = { ...activeTargets, ...previousAutoTargetsRef.current, ...preds };

      for (const [key, targetData] of Object.entries(targetsToEvaluate)) {
         const predColor = typeof targetData === 'string' ? targetData : (targetData as any).cor;
         if (evaluatedKeysRef.current.has(key)) continue;

         const [bkStr, cStr, sStr] = key.split('-');
         const bk = Number(bkStr);
         const c = Number(cStr);
         const s = Number(sStr);
         
         const targetTs = (bk * 10 * 60 * 1000) + (c * 60 * 1000) + (s * 30 * 1000) + (3 * 3600 * 1000);

         const isManual = preds[key] !== undefined;
         const isAuto = autoTargets[key] !== undefined;
         const wasInPreviousAuto = previousAutoTargetsRef.current[key] !== undefined;

         const block = gridData.map.get(bk);
         if (block && block[c][s]) {
            evaluatedKeysRef.current.add(key);

            if (integrationStartTimeMs > 0 && targetTs < integrationStartTimeMs) continue;
            
            if (!isManual && !wasInPreviousAuto) {
                hindsightKeysRef.current.add(key);
                continue;
            }
            if (predColor === 'misto') {
                if (!isManual) evaluatedVisualsRef.current[key] = 'misto';
                continue; 
            }

            changed = true;

            const item = block[c][s];
            const stoneColor = item.color?.toString().toLowerCase() || '';
            const isWin = ((predColor === 'white' || predColor === 'branco') && stoneColor.includes('branco')) ||
                          (predColor === 'red' && stoneColor.includes('vermelho')) ||
                          (predColor === 'black' && stoneColor.includes('preto'));

            if (isWin) {
               w++;
               sa = 0;
               if (currentCycleType === 'L') {
                   cycleHistory = [...cycleHistory, { type: 'L', count: currentCycleCount }];
                   currentCycleType = 'W';
                   currentCycleCount = 1;
               } else {
                   currentCycleType = 'W';
                   currentCycleCount++;
               }
            } else {
               l++;
               sa++;
               if (sa > sm) sm = sa;
               if (currentCycleType === 'W') {
                   cycleHistory = [...cycleHistory, { type: 'W', count: currentCycleCount }];
                   currentCycleType = 'L';
                   currentCycleCount = 1;
               } else if (currentCycleType === null) {
                   currentCycleType = 'L';
                   currentCycleCount = 1;
               } else {
                   currentCycleCount++;
               }
            }
            if (!isManual) evaluatedVisualsRef.current[key] = predColor;
         } else {
            if (currentBk > bk || (currentBk === bk && currentCol > c) || (currentBk === bk && currentCol === c && currentSplit > s)) {
               if (isAuto && !isManual) continue;

               evaluatedKeysRef.current.add(key);
               
               if (integrationStartTimeMs > 0 && targetTs < integrationStartTimeMs) continue;
               
               if (!isManual && !wasInPreviousAuto) {
                   hindsightKeysRef.current.add(key);
                   continue;
               }
               if (predColor === 'misto') {
                   if (!isManual) evaluatedVisualsRef.current[key] = 'misto';
                   continue;
               }

               changed = true;
               l++;
               sa++;
               if (sa > sm) sm = sa;
               if (currentCycleType === 'W') {
                   cycleHistory = [...cycleHistory, { type: 'W', count: currentCycleCount }];
                   currentCycleType = 'L';
                   currentCycleCount = 1;
               } else if (currentCycleType === null) {
                   currentCycleType = 'L';
                   currentCycleCount = 1;
               } else {
                   currentCycleCount++;
               }
               if (!isManual) evaluatedVisualsRef.current[key] = predColor;
            }
         }
      }

      if (changed) {
         if (cycleHistory.length > 500) cycleHistory = cycleHistory.slice(cycleHistory.length - 500);
         setScore({ w, l, sa, sm, cycleHistory, currentCycleType, currentCycleCount });
      }
   }, [data, preds, integrationOn, gridData, score]);

   useEffect(() => {
      previousAutoTargetsRef.current = autoTargets;
   }, [autoTargets]);

   const handleToggleIntegration = () => {
      const isNowOn = !integrationOn;
      setIntegrationOn(isNowOn);
      if (isNowOn) {
         setIntegrationStartTimeMs(Date.now());
         setScore({ w: 0, l: 0, sa: 0, sm: 0, cycleHistory: [], currentCycleType: null, currentCycleCount: 0 });
         evaluatedKeysRef.current.clear();
         evaluatedVisualsRef.current = {};
         previousAutoTargetsRef.current = {};
      } else {
         setIntegrationStartTimeMs(0);
      }
   };

   return (
      <div className="w-full">
         <div className="flex flex-wrap justify-between items-center mb-6 min-w-[1000px]">
            <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
               <span className="w-2 h-6 bg-[#e51e3e] rounded-full"></span>
               Histórico & Integração
            </h3>
            
            <div className="flex items-center gap-6 bg-[#0a0a0f] p-2 rounded-lg border border-white/5 shadow-inner">
               <div className="flex items-center gap-4 px-2 font-bold text-sm">
                  <span className="text-gray-500 tracking-wider">W: <span className="text-green-400 text-lg">{score.w}</span></span>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-500 tracking-wider">L: <span className="text-red-400 text-lg">{score.l}</span></span>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-500 tracking-wider">SA: <span className="text-white text-lg">{score.sa}</span></span>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-500 tracking-wider">SM: <span className="text-gray-400 text-lg">{score.sm}</span></span>
               </div>
               
               <button 
                  onClick={handleToggleIntegration}
                  className={`px-6 py-2 rounded font-black text-[11px] uppercase tracking-widest transition-all border shadow-sm ${
                     integrationOn 
                     ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.4)]' 
                     : 'bg-[#12141c] text-gray-500 border-white/5 hover:bg-white/5'
                  }`}
               >
                  Integração: {integrationOn ? 'ON' : 'OFF'}
               </button>
            </div>
         </div>

         {integrationOn && (
            <div className="bg-[#0a0a0f] p-3 rounded-lg border border-white/5 shadow-inner mb-4 flex flex-col gap-2">
               <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Target size={12} className="text-pink-500" /> CICLOS
               </h4>
               {score.cycleHistory.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 items-center">
                     {(() => {
                        const currentArr = [...score.cycleHistory];
                        if (score.currentCycleCount > 0) currentArr.push({ type: score.currentCycleType!, count: score.currentCycleCount });
                        return currentArr.reverse().map((c, i) => (
                           <div key={i} className={`flex items-center justify-center shrink-0 w-8 h-8 rounded border font-black text-xs shadow-sm
                              ${c.type === 'W' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}
                           `}>
                              {c.count}
                           </div>
                        ));
                     })()}
                  </div>
               ) : (
                  <p className="text-[10px] text-gray-600">Aguardando gatilhos e fechamentos de ciclo...</p>
               )}
            </div>
         )}

         <div className="flex flex-col gap-3 w-full min-w-max pb-4 overflow-x-auto">
            {/* HEADER AZUL */}
            <div className="flex w-full min-w-[1000px] bg-blue-600 rounded overflow-hidden">
               {Array.from({length: 10}, (_, i) => (
                   <div key={i} className="flex-1 text-center text-[12px] text-white font-black py-1.5 border-r border-white/20 last:border-r-0">
                     0{i}
                   </div>
               ))}
            </div>
            {/* LINHAS DE BLOCOS */}
            {gridData.sortedKeys.map((bk) => {
               const grid = gridData.map.get(bk);
               const cells = [];
               for (let c=0; c<10; c++) {
                  cells.push({ col: c, split: 0, item: grid![c][0] });
                  cells.push({ col: c, split: 1, item: grid![c][1] });
               }

            return (
               <div key={bk} className="flex w-full min-w-[1000px] border border-white/5 rounded overflow-hidden shadow-sm">
                  {cells.map((cellObj, idx) => {
                     const { col: cIdx, split: sIdx, item } = cellObj;
                     const key = `${bk}-${cIdx}-${sIdx}`;
                     const manualPred = preds[key];
                     const autoTarget = autoTargets[key];
                     const pred = manualPred || (autoTarget ? autoTarget.cor : undefined);
                     const localTimeMs = bk * 10 * 60 * 1000 + cIdx * 60 * 1000;
                     const localDate = new Date(localTimeMs);
                     const timeStr = `${localDate.getUTCHours().toString().padStart(2, '0')}:${localDate.getUTCMinutes().toString().padStart(2, '0')}`;

                     const wrapperClass = "flex-1 flex flex-col items-center justify-center p-1.5 border-r border-white/5 last:border-r-0 bg-[#0a0a0f] hover:bg-white/5 transition-colors cursor-pointer group select-none";

                     if (item) {
                        return (
                           <div key={idx} className={wrapperClass}>
                              <GlobalStoneIcon n={Number(item.roll)} size="lg" />
                              <div className="text-[10px] font-bold text-[#86a8e7] mt-1.5">{timeStr}</div>
                           </div>
                        );
                     }

                     if (!pred) {
                        return (
                           <div key={idx} onClick={() => cyclePred(key)} className={wrapperClass}>
                              <div className="w-[48px] h-[48px] rounded border border-white/20 bg-transparent flex items-center justify-center p-[5px]">
                                 <div className="w-full h-full rounded-full border border-white/20"></div>
                              </div>
                              <div className="text-[10px] font-bold text-[#86a8e7] mt-1.5">{timeStr}</div>
                           </div>
                        );
                     }
                     
                     let inner = null;
                     const isAutoTargetRender = autoTarget && !manualPred;
                     const alvoBadge = isAutoTargetRender ? (
                        <>
                          <div className="absolute top-0.5 w-full flex justify-center z-10">
                             <span className="animate-pulse bg-[#001f3f]/60 border border-[#001f3f]/80 text-cyan-400 text-[8px] font-black px-1 rounded shadow-sm uppercase tracking-widest">
                                Alvo
                             </span>
                          </div>
                          {autoTarget.count > 1 && (
                              <div className="absolute -top-1.5 -right-1.5 bg-cyan-500 text-slate-900 text-[9px] font-black w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)] z-20 border-[1.5px] border-[#0a0a0f]">
                                {autoTarget.count}
                              </div>
                          )}
                        </>
                     ) : null;

                     if (pred === 'red') {
                        inner = (
                           <div className="relative w-[48px] h-[48px] rounded bg-[#E51E3E] flex items-center justify-center">
                              {alvoBadge}
                              <div className="w-8 h-8 rounded-full border-[1.5px] border-white/80"></div>
                           </div>
                        );
                     } else if (pred === 'black') {
                        inner = (
                           <div className="relative w-[48px] h-[48px] rounded bg-[#2C2F33] flex items-center justify-center">
                              {alvoBadge}
                              <div className="w-8 h-8 rounded-full border-[1px] border-white/40"></div>
                           </div>
                        );
                     } else if (pred === 'white' || pred === 'branco') {
                        inner = (
                           <div className="relative w-[48px] h-[48px] rounded bg-white flex items-center justify-center">
                              {alvoBadge}
                              <div className="w-8 h-8 flex items-center justify-center overflow-hidden">
                                 <img src="/blaze-white.png" alt="W" className="w-full h-full object-contain grayscale" />
                              </div>
                           </div>
                        );
                     } else if (pred === 'misto') {
                        inner = (
                           <div 
                              className="relative w-[48px] h-[48px] rounded flex items-center justify-center shadow-inner border border-white/5" 
                              style={{ background: 'linear-gradient(135deg, #E51E3E 50%, #2C2F33 50%)' }}
                              title="Alvo Conflitante (Anulado)"
                           >
                              {alvoBadge}
                              <div className="w-8 h-8 rounded-full border-[1.5px] border-white/60 bg-black/10"></div>
                           </div>
                        );
                     }

                     return (
                        <div key={idx} onClick={() => cyclePred(key)} className={wrapperClass}>
                           {inner}
                           <div className="text-[10px] font-bold text-[#86a8e7] mt-1.5">{timeStr}</div>
                        </div>
                     );
                  })}
               </div>
            );
         })}
      </div>
      </div>
   );
}
