'use client';

import { useEffect, useState, useMemo, useRef, useCallback, Fragment, memo, useDeferredValue } from 'react';
import { TickerData } from '@/components/Ticker';
import { Target, Copy, FlaskConical } from 'lucide-react';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';
import { useSSE } from '@/contexts/SSEContext';

interface CasaExataStats {
  numero: number;
  totals: number[];
  branco: { sm: number[], sa: number[], hits: number[] };
  red: { sm: number[], sa: number[], hits: number[] };
  black: { sm: number[], sa: number[], hits: number[] };
}

interface Scoreboard {
  wins: number;
  losses: number;
}

interface PredictionState {
  white: boolean;
  red: boolean;
  black: boolean;
}

export default function CasaExataPage() {
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [casasLimit, setCasasLimit] = useState(15);
  const [numEntradas, setNumEntradas] = useState(1);
  const deferredNumEntradas = useDeferredValue(numEntradas);
  const [periodHours, setPeriodHours] = useState(12);

  const [scoreboard, setScoreboard] = useState<Scoreboard>({ wins: 0, losses: 0 });
  const [targetMode, setTargetMode] = useState<'branco' | 'cores'>('branco');
  const [isIntegrationOn, setIsIntegrationOn] = useState(false);
  const [manualWhiteNum, setManualWhiteNum] = useState<number | null>(null);
  const [scanSortBy, setScanSortBy] = useState<'hits' | 'sa' | 'sm'>('hits');
  const [minHitsFilter, setMinHitsFilter] = useState(0);
  const [maxHitsFilter, setMaxHitsFilter] = useState(100);
  const [minSaFilter, setMinSaFilter] = useState(0);
  const [maxSaFilter, setMaxSaFilter] = useState(999);
  const [minSmFilter, setMinSmFilter] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  const [isCopiedPurple, setIsCopiedPurple] = useState(false);
  const [minSaPurpleFilter, setMinSaPurpleFilter] = useState(0);

  const activePredictionsRef = useRef<PredictionState>({ white: false, red: false, black: false });
  const lastEvaluatedLenRef = useRef<number>(0);

  const fetchData = async () => {
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
        lastEvaluatedLenRef.current = parsed.length;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { subscribe } = useSSE();

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
        const updated = [...prev, newStone as any];
        if (updated.length > 20000) updated.shift();
        return updated;
      });
    });

    return unsub;
  }, [subscribe]);

  // Engine de Estatísticas
  const stats: CasaExataStats[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const recordsNeeded = periodHours * 120;
    const analysisData = data.slice(-recordsNeeded);

    const redSmGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    const redSaGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    const redHitsGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    const blackSmGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    const blackSaGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    const blackHitsGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    
    const brancoSmGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    const brancoSaGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    const brancoHitsGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
    
    const totalsGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));

    for (let i = 0; i < analysisData.length; i++) {
      const currentRoll = analysisData[i];
      const isBranco = currentRoll.color.includes('Branco') || currentRoll.roll === '0';
      const isRed = currentRoll.color.includes('Vermelho') || (parseInt(currentRoll.roll as string) >= 1 && parseInt(currentRoll.roll as string) <= 7);
      const isBlack = currentRoll.color.includes('Preto') || (parseInt(currentRoll.roll as string) >= 8 && parseInt(currentRoll.roll as string) <= 14);

      for (let c = 1; c <= casasLimit; c++) {
        const pastIdx = i - c;
        if (pastIdx >= 0) {
          const pastRollNumber = parseInt(analysisData[pastIdx].roll as string);
          if (!isNaN(pastRollNumber) && pastRollNumber >= 0 && pastRollNumber <= 14) {
            
            let hasBranco = false;
            let hasRed = false;
            let hasBlack = false;
            
            let maxAvailableEntries = Math.min(deferredNumEntradas, analysisData.length - pastIdx - c);
            if (maxAvailableEntries < 1) continue; 
            
            for (let e = 0; e < maxAvailableEntries; e++) {
              const targetRoll = analysisData[pastIdx + c + e];
              if (targetRoll.color.includes('Branco') || targetRoll.roll === '0') hasBranco = true;
              if (targetRoll.color.includes('Vermelho') || (parseInt(targetRoll.roll as string) >= 1 && parseInt(targetRoll.roll as string) <= 7)) hasRed = true;
              if (targetRoll.color.includes('Preto') || (parseInt(targetRoll.roll as string) >= 8 && parseInt(targetRoll.roll as string) <= 14)) hasBlack = true;
            }
            
            const isWindowClosed = (maxAvailableEntries === deferredNumEntradas);
            let countedTotal = false;

            if (hasBranco || isWindowClosed) {
                totalsGrid[pastRollNumber][c - 1]++;
                countedTotal = true;
                if (hasBranco) {
                    brancoSaGrid[pastRollNumber][c - 1] = 0;
                    brancoHitsGrid[pastRollNumber][c - 1]++;
                } else {
                    brancoSaGrid[pastRollNumber][c - 1]++;
                    if (brancoSaGrid[pastRollNumber][c - 1] > brancoSmGrid[pastRollNumber][c - 1]) brancoSmGrid[pastRollNumber][c - 1] = brancoSaGrid[pastRollNumber][c - 1];
                }
            }

            if (hasRed || isWindowClosed) {
                if (!countedTotal) { totalsGrid[pastRollNumber][c - 1]++; countedTotal = true; }
                if (hasRed) {
                    redSaGrid[pastRollNumber][c - 1] = 0;
                    redHitsGrid[pastRollNumber][c - 1]++;
                } else {
                    redSaGrid[pastRollNumber][c - 1]++;
                    if (redSaGrid[pastRollNumber][c - 1] > redSmGrid[pastRollNumber][c - 1]) redSmGrid[pastRollNumber][c - 1] = redSaGrid[pastRollNumber][c - 1];
                }
            }

            if (hasBlack || isWindowClosed) {
                if (!countedTotal) { totalsGrid[pastRollNumber][c - 1]++; countedTotal = true; }
                if (hasBlack) {
                    blackSaGrid[pastRollNumber][c - 1] = 0;
                    blackHitsGrid[pastRollNumber][c - 1]++;
                } else {
                    blackSaGrid[pastRollNumber][c - 1]++;
                    if (blackSaGrid[pastRollNumber][c - 1] > blackSmGrid[pastRollNumber][c - 1]) blackSmGrid[pastRollNumber][c - 1] = blackSaGrid[pastRollNumber][c - 1];
                }
            }
          }
        }
      }
    }

    return Array.from({ length: 15 }).map((_, num) => ({
      numero: num,
      totals: totalsGrid[num],
      branco: { sm: brancoSmGrid[num], sa: brancoSaGrid[num], hits: brancoHitsGrid[num] },
      red: { sm: redSmGrid[num], sa: redSaGrid[num], hits: redHitsGrid[num] },
      black: { sm: blackSmGrid[num], sa: blackSaGrid[num], hits: blackHitsGrid[num] }
    }));
  }, [data, casasLimit, periodHours, deferredNumEntradas]);

  // Placar e Avaliação de Previsões (Acionados a cada nova pedra)
  useEffect(() => {
    if (data.length > lastEvaluatedLenRef.current) {
      const latestStone = data[data.length - 1];
      const preds = activePredictionsRef.current;
      
      // Ignora sinais conflitantes no placar (Vermelho e Preto simultâneos)
      if (!(preds.red && preds.black)) {
          if (preds.white || preds.red || preds.black) {
            let hit = false;
            if (preds.white && latestStone.color.includes('Branco')) hit = true;
            if (preds.red && latestStone.color.includes('Vermelho')) hit = true;
            if (preds.black && latestStone.color.includes('Preto')) hit = true;

            setScoreboard(prev => ({
              wins: prev.wins + (hit ? 1 : 0),
              losses: prev.losses + (hit ? 0 : 1)
            }));
          }
      }

      // Prepara as previsões para o PRÓXIMO giro
      if (isIntegrationOn && stats.length > 0) {
        const currentStoneNum = parseInt(latestStone.roll as string);
        const nextPreds = { white: false, red: false, black: false };
        
        if (!isNaN(currentStoneNum)) {
          // Exemplo de predição: Casa Exata de Branco se SA == SM
          const currentStats = stats[currentStoneNum];
          for(let c=0; c<casasLimit; c++){
            if (currentStats.branco.sm[c] > 0 && currentStats.branco.sa[c] === currentStats.branco.sm[c]) {
                nextPreds.white = true;
            }
          }
        }

        if (manualWhiteNum !== null) {
            nextPreds.white = true;
        }

        activePredictionsRef.current = nextPreds;
      } else {
        activePredictionsRef.current = { white: false, red: false, black: false };
      }

      lastEvaluatedLenRef.current = data.length;
    }
  }, [data, isIntegrationOn, stats, manualWhiteNum, casasLimit]);

  const toggleManualWhite = (num: number) => {
      setManualWhiteNum(prev => prev === num ? null : num);
  };

  const generatePatternStr = (pedra: number, casa: number, cor: string) => {
      const spaces = Array(casa - 1).fill('@').join(' ');
      const targetStr = cor === 'branco' ? `branco g${deferredNumEntradas - 1}` : cor === 'red' ? `vermelho g${deferredNumEntradas - 1}` : `preto g${deferredNumEntradas - 1}`;
      return spaces ? `${pedra} ${spaces} = ${targetStr}` : `${pedra} = ${targetStr}`;
  };

  const handleCopyPattern = (pedra: number, casa: number, cor: string) => {
      navigator.clipboard.writeText(generatePatternStr(pedra, casa, cor));
      const key = `${pedra}-${casa}-${cor}`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateAllPatternsText = () => {
    return scanPatterns.map(p => generatePatternStr(p.pedra, p.casa, p.cor)).join('\n');
  };

  const getPurplePatterns = () => {
    return scanPatterns.filter(p => p.sa > 0 && p.sa === p.sm && p.sa >= minSaPurpleFilter);
  };

  const generatePurplePatternsText = () => {
    return getPurplePatterns().map(p => generatePatternStr(p.pedra, p.casa, p.cor)).join('\n');
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(generateAllPatternsText());
    setIsCopiedAll(true);
    setTimeout(() => setIsCopiedAll(false), 2000);
  };

  const handleCopyPurple = () => {
    navigator.clipboard.writeText(generatePurplePatternsText());
    setIsCopiedPurple(true);
    setTimeout(() => setIsCopiedPurple(false), 2000);
  };

  const tickerData = useMemo(() => {
    return data.slice(-20);
  }, [data]);

  const scanPatterns = useMemo(() => {
    const list: { pedra: number, casa: number, cor: string, hits: number, total: number, perc: number, sa: number, sm: number }[] = [];
    if (!stats || stats.length === 0) return list;
    
    for (const stat of stats) {
      for (let c = 0; c < casasLimit; c++) {
        const total = stat.totals[c];
        if (total === 0) continue;

        if (targetMode === 'branco') {
           const hits = stat.branco.hits[c];
           const sa = stat.branco.sa[c];
           const sm = stat.branco.sm[c];
           const perc = (hits / total) * 100;
           if (perc >= minHitsFilter && perc <= maxHitsFilter && sa >= minSaFilter && sa <= maxSaFilter && sm >= minSmFilter) {
             list.push({ pedra: stat.numero, casa: c + 1, cor: 'branco', hits, total, perc, sa, sm });
           }
        } else {
           const rHits = stat.red.hits[c];
           const rSa = stat.red.sa[c];
           const rSm = stat.red.sm[c];
           const rPerc = (rHits / total) * 100;
           if (rPerc >= minHitsFilter && rPerc <= maxHitsFilter && rSa >= minSaFilter && rSa <= maxSaFilter && rSm >= minSmFilter) {
             list.push({ pedra: stat.numero, casa: c + 1, cor: 'red', hits: rHits, total, perc: rPerc, sa: rSa, sm: rSm });
           }

           const bHits = stat.black.hits[c];
           const bSa = stat.black.sa[c];
           const bSm = stat.black.sm[c];
           const bPerc = (bHits / total) * 100;
           if (bPerc >= minHitsFilter && bPerc <= maxHitsFilter && bSa >= minSaFilter && bSa <= maxSaFilter && bSm >= minSmFilter) {
             list.push({ pedra: stat.numero, casa: c + 1, cor: 'black', hits: bHits, total, perc: bPerc, sa: bSa, sm: bSm });
           }
        }
      }
    }

    list.sort((a, b) => {
      if (scanSortBy === 'hits') return b.perc - a.perc || b.hits - a.hits;
      if (scanSortBy === 'sa') return b.sa - a.sa || b.sm - a.sm;
      if (scanSortBy === 'sm') return b.sm - a.sm || b.sa - a.sa;
      return 0;
    });

    return list;
  }, [stats, scanSortBy, targetMode, casasLimit, minHitsFilter, minSaFilter, minSmFilter]);

  const getNumberColorClass = (num: number) => {
    if (num === 0) return "bg-white text-black font-bold border-white/20";
    if (num >= 1 && num <= 7) return "bg-[#f12c4c] text-white font-bold border-white/20";
    return "bg-[#262831] text-white font-bold border-white/20"; 
  };

  const activePreds = activePredictionsRef.current;
  const showWhiteGlow = isIntegrationOn && activePreds.white;
  const showRedGlow = isIntegrationOn && activePreds.red;
  const showBlackGlow = isIntegrationOn && activePreds.black;
  const isConflicting = showRedGlow && showBlackGlow;

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-full w-full mx-auto flex flex-col gap-6 bg-[#030303]">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-6 w-full">


      {/* CONTROLES */}
      <section className="flex flex-wrap justify-between items-center bg-[#0a0a0f] p-4 rounded-lg border border-white/5 gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
             <h2 className="text-2xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 flex items-center gap-2">
               <Target className="text-red-500" />
               Casa Exata
             </h2>
             <a href="/casa-exata/simulador" className="bg-[#12141c] border border-white/10 hover:border-white/20 text-xs font-bold px-3 py-1.5 rounded-md text-gray-400 hover:text-white transition-colors flex items-center gap-2">
               <FlaskConical size={14} /> Simulador
             </a>
          </div>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Laboratório Temporal</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-[#12141c] p-3 rounded-lg border border-white/5">
           <div className="flex flex-col gap-1">
             <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Modo Alvo</label>
             <select 
               className="bg-[#0a0a0f] text-white px-2 py-1 rounded border border-white/10 text-xs font-bold outline-none focus:border-red-500"
               value={targetMode}
               onChange={(e) => setTargetMode(e.target.value as 'branco' | 'cores')}
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
               className="bg-[#0a0a0f] text-white px-2 py-1 rounded border border-white/10 text-xs font-bold outline-none focus:border-red-500 w-16 text-center"
               value={numEntradas}
               onChange={(e) => setNumEntradas(Number(e.target.value) || 1)}
             />
           </div>

           <div className="flex flex-col gap-1">
             <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Casas</label>
             <select 
               className="bg-[#0a0a0f] text-white px-2 py-1 rounded border border-white/10 text-xs font-bold outline-none focus:border-red-500"
               value={casasLimit}
               onChange={(e) => setCasasLimit(Number(e.target.value))}
             >
               {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(num => (
                 <option key={num} value={num}>{num} Casas</option>
               ))}
             </select>
           </div>

           <div className="flex flex-col gap-1">
             <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Histórico</label>
             <select 
               className="bg-[#0a0a0f] text-white px-2 py-1 rounded border border-white/10 text-xs font-bold outline-none focus:border-red-500"
               value={periodHours}
               onChange={(e) => setPeriodHours(Number(e.target.value))}
             >
               {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60,72,84,96,120].map(h => (
                 <option key={h} value={h}>{h}H</option>
               ))}
             </select>
           </div>
        </div>
      </section>

      {/* ÁREA DE SINAIS PENDENTES */}
      {(showWhiteGlow || showRedGlow || showBlackGlow) && (
          <section className="flex justify-center mb-2">
            <div className="flex items-center gap-3 bg-[#12141c] px-6 py-3 rounded-full border border-white/10 shadow-lg">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-2">Alvo Iminente:</span>
                
                {isConflicting ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-red-500 to-gray-800 shadow-sm border border-white/20 animate-pulse" title="Misto"></div>
                ) : (
                    <>
                        {showWhiteGlow && <div className="w-6 h-6 rounded-full bg-white shadow-sm border border-white/50 animate-pulse"></div>}
                        {showRedGlow && <div className="w-6 h-6 rounded-full bg-[#f12c4c] shadow-sm border border-red-500/50 animate-pulse"></div>}
                        {showBlackGlow && <div className="w-6 h-6 rounded-full bg-[#262831] shadow-sm border border-gray-500/50 animate-pulse"></div>}
                    </>
                )}
            </div>
          </section>
      )}

      {/* MATRIZ DE HISTÓRICO */}
      <section className="bg-[#0a0a0f] rounded-lg border border-white/5 overflow-x-auto shadow-2xl mb-8">
        <table className="w-full text-center border-collapse min-w-max text-sm">
          <thead>
            <tr className="bg-[#1b2b42] text-[#86a8e7]">
              <th rowSpan={2} className="p-3 border border-[#0d1624] font-bold w-16">
                PEDRA
              </th>
              {Array.from({ length: casasLimit }).map((_, i) => (
                <th key={i} colSpan={2} className="p-2 border border-[#0d1624] font-bold tracking-widest bg-[#152438]">
                  {i + 1}
                </th>
              ))}
            </tr>
            <tr className="bg-[#1b2b42] text-[#86a8e7] text-xs">
              {Array.from({ length: casasLimit }).map((_, i) => (
                <Fragment key={`smsa-${i}`}>
                  <th className="p-2 border border-[#0d1624] border-t-0 font-semibold tracking-wider w-[45px]">SM</th>
                  <th className="p-2 border border-[#0d1624] border-t-0 font-semibold tracking-wider w-[45px]">SA</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((row) => {
              if (targetMode === 'branco') {
                  const isManualTarget = manualWhiteNum === row.numero;

                  return (
                  <tr key={`branco-${row.numero}`} className="hover:bg-white/[0.02]">
                    <td 
                        className={`border border-[#0d1624] cursor-pointer transition-all ${getNumberColorClass(row.numero)} ${isManualTarget ? 'ring-2 ring-inset ring-white' : ''}`}
                        onClick={() => toggleManualWhite(row.numero)}
                        title="Clique para marcar como Alvo Branco Manual"
                    >
                      {row.numero}
                    </td>
                    {row.branco.sm.map((sm, idx) => {
                      const sa = row.branco.sa[idx];
                      const isAutoWhite = sm > 0 && sa === sm;
                      const isAlert = sm > 0 && sa > 0 && (sm - sa <= 2) && !isAutoWhite;
                      
                      let cellClass = "bg-[#112035] text-[#86a8e7] font-medium";
                      if (isAutoWhite) cellClass = "bg-[#8b008b] text-white font-bold shadow-sm"; 
                      else if (isAlert) cellClass = "bg-[#8b008b] text-white font-bold";

                      return (
                        <Fragment key={idx}>
                          <td className={`p-2 border border-[#0d1624] ${cellClass} transition-colors`}>{sm}</td>
                          <td className={`p-2 border border-[#0d1624] ${cellClass} transition-colors`}>{sa}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                  );
              } else {
                  return (
                    <Fragment key={`cores-${row.numero}`}>
                       <tr className="hover:bg-white/[0.02]">
                          <td className="border border-[#0d1624] p-2 align-middle bg-[#12141c]" rowSpan={2}>
                             <GlobalStoneIcon n={row.numero} size="md" />
                          </td>
                          {row.red.sm.map((sm, idx) => {
                             const sa = row.red.sa[idx];
                             const isAlert = sa > 0 && sa >= sm - 1;
                             let cellClass = "bg-[#E51E3E]/80 text-black border-[#E51E3E]/40 font-medium";
                             if (isAlert) cellClass = "bg-yellow-400 text-black font-bold";
                             return (
                                <Fragment key={`red-${idx}`}>
                                   <td className={`p-2 border border-[#0d1624] ${cellClass} transition-colors`}>{sm}</td>
                                   <td className={`p-2 border border-[#0d1624] ${cellClass} transition-colors`}>{sa}</td>
                                </Fragment>
                             );
                          })}
                       </tr>
                       <tr className="hover:bg-white/[0.02]">
                          {row.black.sm.map((sm, idx) => {
                             const sa = row.black.sa[idx];
                             const isAlert = sa > 0 && sa >= sm - 1;
                             let cellClass = "bg-[#2C2F33]/90 text-white border-black/40 font-medium";
                             if (isAlert) cellClass = "bg-yellow-400 text-black font-bold";
                             return (
                                <Fragment key={`black-${idx}`}>
                                   <td className={`p-2 border border-[#0d1624] ${cellClass} transition-colors`}>{sm}</td>
                                   <td className={`p-2 border border-[#0d1624] ${cellClass} transition-colors`}>{sa}</td>
                                </Fragment>
                             );
                          })}
                       </tr>
                    </Fragment>
                  );
              }
            })}
          </tbody>
        </table>

        {loading && data.length === 0 && (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#e51e3e]"></div>
          </div>
        )}
      </section>

      {/* SCAN DE PADRÕES */}
      <section className="bg-[#121214] border border-[#2a2a35] rounded-xl p-4 shadow-xl mb-8 flex flex-col gap-4">
         <div className="flex flex-wrap justify-between items-center gap-4">
           <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-2 h-6 bg-[#8b008b] rounded-full"></span>
              Scan de Padrões
           </h3>
           
           <div className="flex items-center gap-4">
             <button 
                onClick={() => setShowCopyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#12141c] text-gray-400 hover:text-white hover:bg-white/10 border border-white/5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors"
             >
                <Copy size={14} />
                Copiar Todos
             </button>
             <div className="flex flex-wrap gap-4 items-center bg-[#0a0a0f] p-3 rounded-lg border border-white/5">
                <div className="flex flex-col gap-1">
                   <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Ordenar Por</label>
                   <select 
                     className="bg-[#1b2b42] border border-[#2a2a35] text-white px-3 py-1.5 rounded outline-none text-sm font-bold focus:border-[#86a8e7]"
                     value={scanSortBy}
                     onChange={(e) => setScanSortBy(e.target.value as 'hits' | 'sa' | 'sm')}
                   >
                     <option value="hits">Maior Assertividade</option>
                     <option value="sa">Maior SA</option>
                     <option value="sm">Maior SM</option>
                   </select>
                </div>

              <div className="flex gap-4 border-l border-white/10 pl-5">
                  <div className="flex flex-col gap-1 items-center">
                     <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest" title="Assertividade (%)">Assertividade</label>
                     <div className="flex gap-2">
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-[8px] text-gray-600 font-bold">MIN</span>
                           <input 
                           type="number" min="0" max="100"
                           className="bg-[#12141c] border border-white/10 text-white px-1 py-1 rounded outline-none text-xs font-bold focus:border-green-500 w-12 text-center"
                           value={minHitsFilter} onChange={e => setMinHitsFilter(Number(e.target.value))}
                           />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-[8px] text-gray-600 font-bold">MAX</span>
                           <input 
                           type="number" min="0" max="100"
                           className="bg-[#12141c] border border-white/10 text-white px-1 py-1 rounded outline-none text-xs font-bold focus:border-green-500 w-12 text-center"
                           value={maxHitsFilter} onChange={e => setMaxHitsFilter(Number(e.target.value))}
                           />
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex flex-col gap-1 items-center">
                     <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest" title="Atraso Atual">SA Atual</label>
                     <div className="flex gap-2">
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-[8px] text-gray-600 font-bold">MIN</span>
                           <input 
                           type="number" min="0" 
                           className="bg-[#12141c] border border-white/10 text-white px-1 py-1 rounded outline-none text-xs font-bold focus:border-[#8b008b] w-12 text-center"
                           value={minSaFilter} onChange={e => setMinSaFilter(Number(e.target.value))}
                           />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                           <span className="text-[8px] text-gray-600 font-bold">MAX</span>
                           <input 
                           type="number" min="0" 
                           className="bg-[#12141c] border border-white/10 text-white px-1 py-1 rounded outline-none text-xs font-bold focus:border-[#8b008b] w-12 text-center"
                           value={maxSaFilter} onChange={e => setMaxSaFilter(Number(e.target.value))}
                           />
                        </div>
                     </div>
                  </div>

                  <div className="flex flex-col gap-1 items-center justify-end">
                     <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest" title="Mínimo de Saída Máxima">MIN SM</label>
                     <div className="flex flex-col items-center gap-1">
                        <span className="text-[8px] text-gray-600 font-bold invisible">MIN</span>
                        <input 
                          type="number" min="0" 
                          className="bg-[#12141c] border border-white/10 text-white px-1 py-1 rounded outline-none text-xs font-bold focus:border-gray-400 w-12 text-center"
                          value={minSmFilter} onChange={e => setMinSmFilter(Number(e.target.value))}
                        />
                     </div>
                  </div>
              </div>
           </div>
           </div>
         </div>

         <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
            {scanPatterns.map((p, idx) => {
               const isAlert = p.sa > 0 && p.sa >= p.sm - 1;
               const isAutoWhite = p.sa > 0 && p.sa === p.sm;
               
               const patternKey = `${p.pedra}-${p.casa}-${p.cor}`;

               return (
                  <div key={idx} className="w-full bg-[#0a0a0f] border border-[#2a2a35] hover:border-white/20 rounded-lg p-3 px-4 flex items-center justify-between transition-colors">
                     {/* Esquerda: Pedras + Padrão Visual */}
                     <div className="flex items-center gap-3 w-auto min-w-[200px]">
                        <span className="text-[10px] font-bold text-gray-600">[{idx + 1}]</span>
                        <GlobalStoneIcon n={p.pedra} size="md" />
                        <span className="text-gray-600 text-sm font-bold mx-1">→</span>
                        
                        <div className="flex items-center gap-1.5 flex-wrap">
                           {Array.from({length: p.casa - 1}).map((_, i) => (
                               <div key={i} className="w-8 h-8 rounded bg-[#0099ff] flex items-center justify-center shadow-sm">
                                  <div className="w-4 h-4 rounded-full border-2 border-white"></div>
                               </div>
                           ))}
                           <div className={`w-10 h-10 rounded flex items-center justify-center shadow-[0_0_6px_rgba(255,255,255,0.4)] ${p.cor === 'branco' ? 'bg-white' : p.cor === 'red' ? 'bg-[#E51E3E]' : 'bg-[#2C2F33]'}`}>
                              {p.cor === 'branco' ? (
                                  <div className="w-7 h-7 flex items-center justify-center overflow-hidden">
                                     <img src="/blaze-white.png" alt="W" className="w-full h-full object-contain" />
                                  </div>
                              ) : p.cor === 'red' ? (
                                  <div className="w-7 h-7 rounded-full border-[1.5px] border-white/80"></div>
                              ) : (
                                  <div className="w-7 h-7 rounded-full border-[1px] border-white/40"></div>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* Meio: Texto Maior */}
                     <div className="flex flex-col justify-center items-start flex-1 px-6">
                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">
                           Entrar na {p.casa}ª
                        </span>
                     </div>

                     {/* Direita: Info */}
                     <div className="flex items-center gap-6 w-auto justify-end">
                        <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase bg-[#121214] px-3 py-1.5 rounded-lg border border-white/5">
                           <span className="text-gray-500">SA:</span><span className={isAutoWhite || isAlert ? "text-[#e85dff] text-[17px] font-black drop-shadow-md" : "text-white text-base font-bold"}>{p.sa}</span>
                           <span className="text-gray-600 mx-1">|</span>
                           <span className="text-gray-500">SM:</span><span className="text-gray-400 text-base font-bold">{p.sm}</span>
                        </div>
                        
                        <div className="flex flex-col items-center min-w-[60px]">
                           <span className="text-green-400 font-black text-base">{p.perc.toFixed(2)}%</span>
                           <span className="text-[10px] text-gray-600 font-bold">{p.hits}/{p.total}</span>
                        </div>

                        <button 
                           onClick={() => handleCopyPattern(p.pedra, p.casa, p.cor)}
                           className="bg-[#12141c] hover:bg-white/10 border border-white/5 p-2.5 rounded transition-colors text-gray-400 hover:text-white"
                           title="Copiar Padrão"
                        >
                           {copiedKey === patternKey ? (
                              <span className="text-[10px] font-bold text-green-400 uppercase">Ok!</span>
                           ) : (
                              <Copy size={16} />
                           )}
                        </button>
                     </div>
                  </div>
               )
            })}
            
            {scanPatterns.length === 0 && (
                <div className="w-full text-center py-8 text-gray-500 text-sm font-bold">Nenhum padrão encontrado com os filtros atuais.</div>
            )}
         </div>
      </section>

      {/* NOVO HISTÓRICO FIXO */}
      <section className="bg-[#121214] border border-[#2a2a35] rounded-xl overflow-x-auto p-4 shadow-xl mb-8">
         <FixedColumnsHistory data={data.slice(-200)} scanPatterns={scanPatterns} numEntradas={deferredNumEntradas} />
      </section>

      {/* MODAL COPIAR */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#121214] border border-[#2a2a35] rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#0a0a0f]">
              <h3 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2">
                 <Copy size={16} className="text-[#86a8e7]" />
                 Exportar Padrões
              </h3>
              <button onClick={() => setShowCopyModal(false)} className="text-gray-500 hover:text-white transition-colors font-bold">
                 X
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row p-4 gap-6 bg-[#0a0a0f]">
               {/* Coluna 1: Todos Filtrados */}
               <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between h-8">
                     <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Lista Geral (Filtros Ativos)</span>
                     <span className="text-[10px] text-gray-500 font-bold uppercase">{scanPatterns.length} Padrões</span>
                  </div>
                  <textarea 
                    readOnly
                    className="w-full h-72 bg-[#12141c] border border-white/10 rounded-lg p-3 text-sm text-gray-300 font-mono focus:outline-none custom-scrollbar resize-none"
                    value={generateAllPatternsText()}
                  />
                  <button 
                    onClick={handleCopyAll}
                    className={`w-full py-3 rounded-lg font-black text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-lg ${isCopiedAll ? 'bg-green-600 text-white' : 'bg-[#1b2b42] text-[#86a8e7] hover:bg-[#233857]'}`}
                  >
                    {isCopiedAll ? 'Copiado com sucesso!' : 'Copiar Todos'}
                  </button>
               </div>

               <div className="w-px bg-white/10 hidden md:block" />

               {/* Coluna 2: Apenas Roxos */}
               <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between h-8">
                     <span className="text-[11px] font-black text-[#e85dff] uppercase tracking-widest flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#e85dff] animate-pulse"></div> Auto-Sinais (Roxos)</span>
                     <div className="flex items-center gap-2 bg-[#12141c] px-2 py-1 rounded border border-white/5">
                         <span className="text-[9px] text-gray-500 uppercase font-black">SA Mín:</span>
                         <input 
                           type="number" min="0"
                           className="w-12 bg-transparent text-[#e85dff] outline-none text-xs text-center font-black" 
                           value={minSaPurpleFilter} 
                           onChange={e => setMinSaPurpleFilter(Number(e.target.value))} 
                         />
                     </div>
                  </div>
                  <textarea 
                    readOnly
                    className="w-full h-72 bg-[#12141c] border border-[#e85dff]/20 rounded-lg p-3 text-sm text-[#e85dff] font-mono focus:outline-none custom-scrollbar resize-none"
                    value={generatePurplePatternsText()}
                  />
                  <button 
                    onClick={handleCopyPurple}
                    className={`w-full py-3 rounded-lg font-black text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(232,93,255,0.2)] ${isCopiedPurple ? 'bg-green-600 text-white shadow-none' : 'bg-[#e85dff]/10 text-[#e85dff] hover:bg-[#e85dff]/20 border border-[#e85dff]/30'}`}
                  >
                    {isCopiedPurple ? 'Copiado com sucesso!' : `Copiar ${getPurplePatterns().length} Roxos`}
                  </button>
               </div>
            </div>

            <div className="p-4 border-t border-white/5 flex justify-end bg-[#0a0a0f]">
              <button 
                onClick={() => setShowCopyModal(false)}
                className="px-6 py-2 rounded-lg font-bold text-xs uppercase text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

function FixedColumnsHistory({ data, scanPatterns, numEntradas }: { data: any[], scanPatterns?: any[], numEntradas: number }) {
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
         let next = 'red';
         if (curr === 'red') next = 'black';
         else if (curr === 'black') next = 'white';
         else if (curr === 'white') next = '';
         
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
      const targets: Record<string, { cor: string, count: number }> = {};
      if (!integrationOn || !scanPatterns || scanPatterns.length === 0 || data.length === 0) return targets;

      const triggersByStone: Record<number, { casa: number, cor: string }[]> = {};
      for (const p of scanPatterns) {
          if (!triggersByStone[p.pedra]) triggersByStone[p.pedra] = [];
          triggersByStone[p.pedra].push({ casa: p.casa, cor: p.cor });
      }

      for (let i = 0; i < data.length; i++) {
         const r = data[i];
         if (r.roll == null) continue;
         const stoneRoll = Number(r.roll);
         const targetList = triggersByStone[stoneRoll];
         if (!targetList) continue;

         for (const targetItem of targetList) {
             for (let e = 0; e < numEntradas; e++) {
                 const targetIdx = i + targetItem.casa + e;
                 let targetTs: number;
                 let hit = false;

                 if (targetIdx < data.length) {
                     const targetStone = data[targetIdx];
                     targetTs = targetStone.timestamp ? new Date(targetStone.timestamp).getTime() : (targetStone.created_at ? new Date(targetStone.created_at).getTime() : Date.now());
                     
                     // Checa se acertamos no meio do caminho!
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
                 
                 // Se bateu na cor, aborta o resto das entradas deste ciclo!
                 if (hit) break;
             }
         }
      }

      return targets;
   }, [data, scanPatterns, integrationOn, numEntradas]);

   const activeTargets = useMemo(() => {
       const combined = { ...evaluatedVisualsRef.current, ...autoTargets, ...preds };
       for (const key of hindsightKeysRef.current) {
           delete combined[key];
       }
       return combined;
   }, [preds, autoTargets]);

   // Avaliação em tempo real
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

      // previousAutoTargetsRef deve sobrescrever activeTargets para recuperar conflitos 'misto' que possam ter sumido no update
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
            // Célula preenchida com a pedra
            evaluatedKeysRef.current.add(key);

            if (integrationStartTimeMs > 0 && targetTs < integrationStartTimeMs) continue;
            
            if (!isManual && !wasInPreviousAuto) {
                hindsightKeysRef.current.add(key);
                continue;
            }
            
            if (predColor === 'misto') {
                if (!isManual) evaluatedVisualsRef.current[key] = 'misto';
                continue; // Pedra conflituosa, anula o resultado
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
            // Célula vazia. O tempo dela já passou?
            if (currentBk > bk || (currentBk === bk && currentCol > c) || (currentBk === bk && currentCol === c && currentSplit > s)) {
               if (isAuto && !isManual) {
                   // Se for sugestão automática, ignoramos o 'loss por tempo' pois o alvo irá pular para a próxima pedra real
                   continue;
               }

               // O tempo passou e não caiu pedra na célula correspondente, conta como loss
               evaluatedKeysRef.current.add(key);
               
               if (integrationStartTimeMs > 0 && targetTs < integrationStartTimeMs) continue;
               
               if (!isManual && !wasInPreviousAuto) {
                   hindsightKeysRef.current.add(key);
                   continue;
               }
               
               if (predColor === 'misto') {
                   if (!isManual) evaluatedVisualsRef.current[key] = 'misto';
                   continue; // Pedra conflituosa, anula o resultado
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
               Histórico (Fixas)
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
