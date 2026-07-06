'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { useMinutosIa } from '@/hooks/useMinutosIa';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, Clock, Droplets } from 'lucide-react';

interface RollData {
  id: string;
  timestamp: string;
  color: string;
  roll: string;
}

const COLORS = {
  Vermelho: '#e51e3e',
  Preto: '#1a1d24',
  Branco: '#ffffff',
};

export function VisaoCoresTab() {
  const { subscribe } = useSSE();
  const [history, setHistory] = useState<RollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [radarMode, setRadarMode] = useState<'branco' | 'cor'>('branco');
  const lastProcessedIdRef = useRef<string | null>(null);
  const pendingNextStateRef = useRef<any>(null);
  const [signalState, setSignalState] = useState<{
      status: 'standby' | 'active' | 'win' | 'loss',
      step: number,
      level: number,
      stones: number[]
  }>({ status: 'standby', step: 0, level: 0, stones: [] });

  const [iaPeriodFilter, setIaPeriodFilter] = useState<number>(3);
  const [zonesPeriod, setZonesPeriod] = useState<number>(3);
  const parsedHistory = useMemo(() => history.map(r => ({ ...r, roll: parseInt(r.roll as string) })), [history]);
  const iaSignals = useMinutosIa(parsedHistory as any, iaPeriodFilter, new Set<number>(), true, false);
  const { scores: iaScores, stats: iaStats } = iaSignals;

  const StoneIcon = ({ n, size = "md" }: { n: number, size?: "sm" | "md" | "lg" | "ticker" }) => {
    let containerBg = 'bg-[#2C2F33]';
    let circleBorder = 'border-[1px] border-white/40';
    let textClass = 'text-white font-black';

    if (n === 0) {
      containerBg = 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)]';
      circleBorder = 'border-0';
      textClass = 'text-black font-black';
    } else if (n >= 1 && n <= 7) {
      containerBg = 'bg-[#E51E3E]';
      circleBorder = 'border-[1.5px] border-white/80';
    }

    const dims = {
      sm: { out: 'w-7 h-7', in: 'w-5 h-5', txt: 'text-[9px]' },
      md: { out: 'w-10 h-10', in: 'w-7 h-7', txt: 'text-[12px]' },
      lg: { out: 'w-12 h-12', in: 'w-8 h-8', txt: 'text-[14px]' },
      ticker: { out: 'w-[40px] h-[40px]', in: 'w-[30px] h-[30px]', txt: 'text-[12px]' }
    };

    const d = dims[size];

    return (
      <div className={`rounded flex items-center justify-center shrink-0 ${d.out} ${containerBg}`}>
        {n === 0 ? (
          <div className={`${d.in} flex items-center justify-center overflow-hidden`}>
            <img src="/blaze-white.png" alt="W" className="w-full h-full object-contain drop-shadow-sm" />
          </div>
        ) : (
          <div className={`rounded-full flex items-center justify-center ${d.in} ${circleBorder}`}>
            <span className={`${textClass} ${d.txt}`}>{n}</span>
          </div>
        )}
      </div>
    );
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/results/period?hours=24', { cache: 'no-store' });
      const json = await res.json();
      if (json.data) {
        const parsed = json.data.map((r: any) => ({
          ...r,
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
        }));
        setHistory(parsed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const unsub = subscribe((mappedRoll: any) => {
      setHistory(prev => {
        if (prev.length > 0 && prev[prev.length - 1].id === mappedRoll.id) return prev;
        return [...prev, mappedRoll].slice(-2000);
      });
    });
    return unsub;
  }, [subscribe]);

  const stats = useMemo(() => {
    let counts = { Vermelho: 0, Preto: 0, Branco: 0 };
    let currentDelay = { Vermelho: 0, Preto: 0, Branco: 0 };
    let maxDelay = { Vermelho: 0, Preto: 0, Branco: 0 };
    
    history.forEach((roll) => {
      const c = roll.color as keyof typeof counts;
      if (c === 'Vermelho' || c === 'Preto' || c === 'Branco') {
        counts[c]++;
        ['Vermelho', 'Preto', 'Branco'].forEach(colorKey => {
          const k = colorKey as keyof typeof currentDelay;
          if (c === k) {
            currentDelay[k] = 0;
          } else {
            currentDelay[k]++;
            if (currentDelay[k] > maxDelay[k]) {
              maxDelay[k] = currentDelay[k];
            }
          }
        });
      }
    });

    const total = counts.Vermelho + counts.Preto + counts.Branco;
    const chartData = total > 0 ? [
      { name: 'Vermelho', value: counts.Vermelho, fill: COLORS.Vermelho },
      { name: 'Preto', value: counts.Preto, fill: COLORS.Preto },
      { name: 'Branco', value: counts.Branco, fill: COLORS.Branco },
    ] : [];

    let curr_posV = 0, curr_posP = 0, curr_posB = 0;
    let max_posV = 0, max_posP = 0, max_posB = 0;
    let posNum = 0;
    
    if (history.length > 0) {
      posNum = parseInt(history[history.length - 1].roll as string);
      
      const isW = (r: RollData) => r.color?.toString().toLowerCase().includes('branco') || r.color?.toString().toLowerCase().includes('white') || parseInt(r.roll as string) === 0;
      const isR = (r: RollData) => r.color?.toString().toLowerCase().includes('vermelho') || r.color?.toString().toLowerCase().includes('red') || (parseInt(r.roll as string) >= 1 && parseInt(r.roll as string) <= 7);
      
      for (let i = 0; i < history.length - 1; i++) {
         if (parseInt(history[i].roll as string) === posNum) {
            const fb = history[i+1];
            const fbB = isW(fb);
            const fbV = isR(fb);
            
            if (fbV) { curr_posV = 0; } else { curr_posV++; if (curr_posV > max_posV) max_posV = curr_posV; }
            if (!fbV && !fbB) { curr_posP = 0; } else { curr_posP++; if (curr_posP > max_posP) max_posP = curr_posP; }
            if (fbB) { curr_posB = 0; } else { curr_posB++; if (curr_posB > max_posB) max_posB = curr_posB; }
         }
      }
    }

    return { 
      counts, total, currentDelay, maxDelay, chartData, 
      posAtrasos: { 
        V: { a: curr_posV, m: max_posV }, 
        P: { a: curr_posP, m: max_posP }, 
        B: { a: curr_posB, m: max_posB }, 
        num: posNum 
      } 
    };
  }, [history]);

  const radarStats = useMemo(() => {
    if (history.length === 0) return { lastNumber: 0, livePatterns: {} as Record<number, any>, topCasas: [] as any[], 3: [], 4: [], 5: [], 6: [] };

    const targetMargin = radarMode === 'branco' ? 6 : 2;
    const sizes = [4, 5, 6];
    
    const getC = (r: RollData) => {
       const n = parseInt(r.roll as string);
       const col = r.color?.toString().toLowerCase() || '';
       if (col.includes('branco') || col.includes('white') || n === 0) return 'B';
       if (col.includes('vermelho') || col.includes('red') || (n >= 1 && n <= 7)) return 'V';
       return 'P';
    };

    // 4 horas (~1000 pedras) para branco, 2 horas (~500 pedras) para cor
    const sliceAmount = radarMode === 'branco' ? -1000 : -500;
    const h2h = history.slice(sliceAmount);
    if (h2h.length === 0) return { lastNumber: 0, livePatterns: {} as Record<number, any>, topCasas: [] as any[], 3: [], 4: [], 5: [], 6: [] };

    const lastRoll = h2h[h2h.length - 1];
    const lastRollNumber = parseInt(lastRoll.roll as string);
    
    const rolls = h2h.map(r => ({ color: getC(r), num: parseInt(r.roll as string) }));
    const results: Record<number, any[]> = { 4: [], 5: [], 6: [] };
    const livePatterns: Record<number, any> = {};

    for (const size of sizes) {
       const patMap = new Map<string, { win: number, loss: number, winV: number, lossV: number, winP: number, lossP: number, winL: number, lossL: number, winVL: number, lossVL: number, winPL: number, lossPL: number }>();
       
       const liveSlice = rolls.slice(-size);
       const livePatStr = liveSlice.map(r => r.color).join('');

       // Extrair todos os padrões reais do histórico
       for (let i = 0; i <= rolls.length - size - targetMargin; i++) {
           const patStr = rolls.slice(i, i + size).map(r => r.color).join('');
           const patLastNum = rolls[i + size - 1].num;
           
           if (!patMap.has(patStr)) {
               patMap.set(patStr, { win:0, loss:0, winV:0, lossV:0, winP:0, lossP:0, winL:0, lossL:0, winVL:0, lossVL:0, winPL:0, lossPL:0 });
           }
           const data = patMap.get(patStr)!;
           
           let hitB = false, hitV = false, hitP = false;
           for (let m = 0; m < targetMargin; m++) {
               const c = rolls[i + size + m].color;
               if (c === 'B') hitB = true;
               if (c === 'V') hitV = true;
               if (c === 'P') hitP = true;
           }
           
           if (hitB) data.win++; else data.loss++;
           if (hitV) data.winV++; else data.lossV++;
           if (hitP) data.winP++; else data.lossP++;
           
           if (patLastNum === lastRollNumber) {
               if (hitB) data.winL++; else data.lossL++;
               if (hitV) data.winVL++; else data.lossVL++;
               if (hitP) data.winPL++; else data.lossPL++;
           }
       }

       // Compilar estatísticas
       for (const [patStr, data] of patMap.entries()) {
          const pat = patStr.split('');
          const isLive = (patStr === livePatStr);
          
          if (radarMode === 'branco') {
              const total = data.win + data.loss;
              if (total >= 3 || isLive) {
                 const winrate = total > 0 ? (data.win / total) * 100 : 0;
                 const wrL = (isLive && data.winL + data.lossL > 0) ? (data.winL / (data.winL + data.lossL)) * 100 : null;
                 const statObj = { pat, target: 'B', win: data.win, loss: data.loss, winrate, wrL, total, isLive };
                 results[size].push(statObj);
                 if (isLive) livePatterns[size] = statObj;
              }
          } else {
              const wrV = (data.winV + data.lossV > 0) ? (data.winV / (data.winV + data.lossV)) * 100 : 0;
              const wrP = (data.winP + data.lossP > 0) ? (data.winP / (data.winP + data.lossP)) * 100 : 0;
              const target = wrV >= wrP ? 'V' : 'P';
              const win = target === 'V' ? data.winV : data.winP;
              const loss = target === 'V' ? data.lossV : data.lossP;
              const total = win + loss;
              const winrate = total > 0 ? (win / total) * 100 : 0;
              const wrL = target === 'V' 
                 ? ((data.winVL + data.lossVL > 0) ? (data.winVL / (data.winVL + data.lossVL)) * 100 : null)
                 : ((data.winPL + data.lossPL > 0) ? (data.winPL / (data.winPL + data.lossPL)) * 100 : null);
                 
              if (total >= 3 || isLive) {
                 const statObj = { pat, target, win, loss, winrate, wrL, total, isLive };
                 results[size].push(statObj);
                 if (isLive) livePatterns[size] = statObj;
              }
          }
       }

       results[size].sort((a, b) => b.winrate - a.winrate || b.total - a.total);
       results[size] = results[size].slice(0, 5);
    }

    // -- LÓGICA CASA EXATA TOP 5 --
    const casasLimit = 10;
    const numEntradas = radarMode === 'branco' ? 6 : 2;
    const topCasasExatas: any[] = [];
    
    const ce_stats = Array.from({ length: 15 }, () => ({
        totals: Array(casasLimit).fill(0),
        winB: Array(casasLimit).fill(0),
        winV: Array(casasLimit).fill(0),
        winP: Array(casasLimit).fill(0),
        saB: Array(casasLimit).fill(0),
        smB: Array(casasLimit).fill(0),
        saV: Array(casasLimit).fill(0),
        smV: Array(casasLimit).fill(0),
        saP: Array(casasLimit).fill(0),
        smP: Array(casasLimit).fill(0)
    }));

    for (let i = 0; i < h2h.length; i++) {
       const pastRollNum = parseInt(h2h[i].roll as string);
       if (isNaN(pastRollNum)) continue;

       for (let c = 1; c <= casasLimit; c++) {
          const targetStartIdx = i + c;
          if (targetStartIdx < h2h.length) {
             let hasB = false, hasV = false, hasP = false;
             let maxE = Math.min(numEntradas, h2h.length - targetStartIdx);
             if (maxE < 1) continue;
             
             for (let e = 0; e < maxE; e++) {
                const trC = getC(h2h[targetStartIdx + e]);
                if (trC === 'B') hasB = true;
                if (trC === 'V') hasV = true;
                if (trC === 'P') hasP = true;
             }

             const windowClosed = maxE === numEntradas;
             let counted = false;

             if (hasB || windowClosed) {
                ce_stats[pastRollNum].totals[c-1]++;
                counted = true;
                if (hasB) {
                   ce_stats[pastRollNum].saB[c-1] = 0;
                   ce_stats[pastRollNum].winB[c-1]++;
                } else {
                   ce_stats[pastRollNum].saB[c-1]++;
                   if (ce_stats[pastRollNum].saB[c-1] > ce_stats[pastRollNum].smB[c-1]) ce_stats[pastRollNum].smB[c-1] = ce_stats[pastRollNum].saB[c-1];
                }
             }

             if (hasV || windowClosed) {
                if (!counted) { ce_stats[pastRollNum].totals[c-1]++; counted = true; }
                if (hasV) {
                   ce_stats[pastRollNum].saV[c-1] = 0;
                   ce_stats[pastRollNum].winV[c-1]++;
                } else {
                   ce_stats[pastRollNum].saV[c-1]++;
                   if (ce_stats[pastRollNum].saV[c-1] > ce_stats[pastRollNum].smV[c-1]) ce_stats[pastRollNum].smV[c-1] = ce_stats[pastRollNum].saV[c-1];
                }
             }

             if (hasP || windowClosed) {
                if (!counted) { ce_stats[pastRollNum].totals[c-1]++; counted = true; }
                if (hasP) {
                   ce_stats[pastRollNum].saP[c-1] = 0;
                   ce_stats[pastRollNum].winP[c-1]++;
                } else {
                   ce_stats[pastRollNum].saP[c-1]++;
                   if (ce_stats[pastRollNum].saP[c-1] > ce_stats[pastRollNum].smP[c-1]) ce_stats[pastRollNum].smP[c-1] = ce_stats[pastRollNum].saP[c-1];
                }
             }
          }
       }
    }

    for (let num = 0; num < 15; num++) {
       for (let c = 1; c <= casasLimit; c++) {
           let isLive = false;
           for (let e = 0; e < numEntradas; e++) {
              const gatilhoIdx = h2h.length - c - e;
              if (gatilhoIdx >= 0 && gatilhoIdx < h2h.length) {
                  if (parseInt(h2h[gatilhoIdx].roll as string) === num) {
                      isLive = true;
                      break;
                  }
              }
           }
           
           const total = ce_stats[num].totals[c-1];
           if (total >= 5) {
               if (radarMode === 'branco') {
                   const win = ce_stats[num].winB[c-1];
                   const sa = ce_stats[num].saB[c-1];
                   const winrate = (win / total) * 100;
                   topCasasExatas.push({ num, casa: c, target: 'B', winrate, win, loss: total - win, sa, isLive });
               } else {
                   const winV = ce_stats[num].winV[c-1];
                   const saV = ce_stats[num].saV[c-1];
                   const winrateV = (winV / total) * 100;
                   topCasasExatas.push({ num, casa: c, target: 'V', winrate: winrateV, win: winV, loss: total - winV, sa: saV, isLive });
                   
                   const winP = ce_stats[num].winP[c-1];
                   const saP = ce_stats[num].saP[c-1];
                   const winrateP = (winP / total) * 100;
                   topCasasExatas.push({ num, casa: c, target: 'P', winrate: winrateP, win: winP, loss: total - winP, sa: saP, isLive });
               }
           }
       }
    }

    const bestPerNum = new Map();
    for (const c of topCasasExatas) {
        if (!bestPerNum.has(c.num)) {
            bestPerNum.set(c.num, c);
        } else {
            const existing = bestPerNum.get(c.num);
            if (c.winrate > existing.winrate || (c.winrate === existing.winrate && c.sa < existing.sa)) {
                bestPerNum.set(c.num, c);
            }
        }
    }
    
    const diversifiedTop = Array.from(bestPerNum.values());
    diversifiedTop.sort((a, b) => b.winrate - a.winrate || a.sa - b.sa || b.win - a.win);
    const topCasas = diversifiedTop.slice(0, 5);

    return { lastNumber: lastRollNumber, livePatterns, topCasas, ...results };
  }, [history, radarMode]);

  const zonesStats = useMemo(() => {
     if (history.length === 0) return { blocks: [], currentGap: 0 };
     
     const sliceAmount = -(zonesPeriod * 250); // ~250 pedras por hora
     const rolls = history.slice(sliceAmount);
     const whiteIndices = rolls.reduce((acc, r, i) => {
        const n = parseInt(r.roll as string);
        if (r.color?.includes('Branco') || n === 0) acc.push(i);
        return acc;
     }, [] as number[]);
     
     if (whiteIndices.length === 0) return { blocks: [], currentGap: rolls.length };
     
     const gaps: number[] = [];
     for (let i = 1; i < whiteIndices.length; i++) {
         gaps.push(whiteIndices[i] - whiteIndices[i-1]);
     }
     
     const currentGap = rolls.length - 1 - whiteIndices[whiteIndices.length - 1];
     const nextEnt = currentGap + 1;
     
     const zones = [
        { label: '1 a 5', s: 1, e: 5 },
        { label: '6 a 10', s: 6, e: 10 },
        { label: '11 a 15', s: 11, e: 15 },
        { label: '16 a 20', s: 16, e: 20 },
        { label: '21 a 25', s: 21, e: 25 },
        { label: '26 a 30', s: 26, e: 30 }
     ];
     
     const blocks = zones.map(z => {
        let wins = 0;
        let losses = 0;
        
        const outcomes: ('W'|'L')[] = [];
        for (const g of gaps) {
           if (g >= z.s && g <= z.e) { wins++; outcomes.push('W'); }
           else if (g > z.e) { losses++; outcomes.push('L'); }
        }
        
        if (currentGap >= z.e) {
           losses++;
           outcomes.push('L');
        }
        
        // Calcular Ciclos
        const cycles: { type: 'W'|'L', count: number }[] = [];
        for (const out of outcomes) {
           if (cycles.length === 0) {
              cycles.push({ type: out, count: 1 });
           } else {
              const last = cycles[cycles.length - 1];
              if (last.type === out) {
                 last.count++;
              } else {
                 cycles.push({ type: out, count: 1 });
              }
           }
        }
        
        const total = wins + losses;
        const winrate = total > 0 ? (wins / total) * 100 : 0;
        
        let status = 'aguardando';
        if (nextEnt >= z.s && nextEnt <= z.e) status = 'ativo';
        else if (nextEnt > z.e) status = 'passou';
        
        return { ...z, wins, losses, total, winrate, status, cycles: cycles.slice(-7) };
     });
     
     return { blocks, currentGap };
  }, [history, zonesPeriod]);

  useEffect(() => {
      if (history.length === 0) return;
      
      const lastStone = history[history.length - 1];
      if (lastStone.id === lastProcessedIdRef.current) return;
      
      lastProcessedIdRef.current = lastStone.id;

      const isBranco = lastStone.color?.toString().toLowerCase().includes('branco') || parseInt(lastStone.roll as string) === 0;
      const currentRollValue = parseInt(lastStone.roll as string);

      setSignalState(prev => {
          let points = 0;
          let hasZonasQuentes = zonesStats.blocks.some(b => b.status === 'ativo' && b.winrate >= 30);
          if (hasZonasQuentes) points++;
          
          let hasCasas = radarStats.topCasas?.some((c: any) => c.isLive && c.target === 'B');
          if (hasCasas) points++;
          
          let hasPatterns = [4,5,6].some(t => {
             const pat = radarStats.livePatterns[t];
             if (!pat || pat.target !== 'B') return false;
             if (pat.total < 4 || pat.winrate < 60) return false;
             if (pat.wrL !== null && pat.wrL < 50) return false;
             return true;
          });
          if (hasPatterns) points++;

          // Validação pela IA
          let approvedByIa = false;
          const currentMin = new Date(lastStone.timestamp).getMinutes();
          const m1 = (currentMin + 1) % 60;
          const m2 = (currentMin + 2) % 60;
          const score1 = iaScores[m1] || 0;
          const score2 = iaScores[m2] || 0;
          if (score1 >= 3 || score2 >= 3) approvedByIa = true;
          if (score1 === 2 || score2 === 2) {
              const winrate2 = iaStats[1]?.winRate || 0;
              if (winrate2 >= 35) approvedByIa = true;
          }

          // REGRA DE APROVAÇÃO:
          // Tem que ter no mínimo 1 gatilho (Padrão, Casa Exata ou Zona Quente).
          // E o sinal precisa ser validado: OU pela IA Minutos, OU pelas Zonas Quentes.
          let approved = false;
          if (points >= 1 && (approvedByIa || hasZonasQuentes)) {
              approved = true;
          }

          const nextActiveState = (points >= 1 && approved) 
                ? { status: 'active' as const, step: 1, level: points, stones: [] } 
                : { status: 'standby' as const, step: 0, level: 0, stones: [] };

          pendingNextStateRef.current = nextActiveState;

          if (prev.status === 'active') {
              if (points > prev.level && approved) {
                  return { status: 'active', step: 1, level: points, stones: [] };
              }
              const newStones = [...prev.stones, isNaN(currentRollValue) ? -1 : currentRollValue];
              if (isBranco) {
                  return { status: 'win', step: prev.step, level: prev.level, stones: newStones };
              } else {
                  if (prev.step < 6) {
                      return { ...prev, step: prev.step + 1, stones: newStones };
                  } else {
                      return { status: 'loss', step: 6, level: prev.level, stones: newStones };
                  }
              }
          } else {
              return nextActiveState;
          }
      });
  }, [history, zonesStats, radarStats, iaScores, iaStats]);

  useEffect(() => {
      if (signalState.status === 'win' || signalState.status === 'loss') {
          const t = setTimeout(() => {
              setSignalState(prev => {
                  if (prev.status === 'win' || prev.status === 'loss') {
                      return pendingNextStateRef.current || { status: 'standby', step: 0, level: 0, stones: [] };
                  }
                  return prev;
              });
          }, 7000);
          return () => clearTimeout(t);
      }
  }, [signalState.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff41]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Card Combinado: Visão Geral */}
        <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] lg:col-span-2 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Visão Geral</span>
            </div>
          </div>
          
          <div className="p-4 flex flex-col md:flex-row gap-6 items-center">
            {/* Left: Dominância Pie */}
            <div className="flex-1 flex items-center justify-center gap-4 w-full border-b border-white/5 pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-4">
              <div style={{ width: '120px', height: '120px', minHeight: '120px', position: 'relative', flexShrink: 0 }}>
                  <PieChart width={120} height={120}>
                    <Pie
                      data={stats.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {stats.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [`${value} rodadas`, 'Ocorrências']}
                    />
                  </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Total</span>
                  <span className="text-white text-sm font-black">{stats.total}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {stats.chartData.map(c => (
                  <div key={c.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: c.fill }}></div>
                    <div className="flex flex-col leading-none">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{c.name}</span>
                      <span className="text-[11px] font-black text-white">
                        {stats.total > 0 ? ((c.value / stats.total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Seca */}
            <div className="flex-[1.5] flex gap-4 w-full h-full">
              
              {/* Seca Global */}
              <div className="flex-1 flex flex-col bg-[#0b0e14]/50 rounded-xl border border-white/5 p-3">
                <div className="flex items-center justify-center gap-2 mb-3 h-[32px]">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">Atraso Global</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  {[
                    { c: 'Vermelho', a: stats.currentDelay.Vermelho, m: stats.maxDelay.Vermelho, bg: 'bg-[#e51e3e]', tc: 'text-red-400' },
                    { c: 'Preto', a: stats.currentDelay.Preto, m: stats.maxDelay.Preto, bg: 'bg-[#1a1d24] border border-gray-600', tc: 'text-gray-400' },
                    { c: 'Branco', a: stats.currentDelay.Branco, m: stats.maxDelay.Branco, bg: 'bg-white', tc: 'text-white' }
                  ].map((x, i) => (
                    <div key={`g-${i}`} className="flex justify-between items-center bg-[#1a1d24]/50 rounded-lg p-2 border border-white/5 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-1.5 w-16">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${x.bg} shadow-sm`}></div>
                        <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">{x.c}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end leading-none w-10">
                          <span className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">SA</span>
                          <span className={`text-[12px] font-black ${x.a >= 10 && x.c !== 'Branco' ? 'text-red-500' : x.tc}`}>{x.a}</span>
                        </div>
                        <div className="w-px h-6 bg-white/10"></div>
                        <div className="flex flex-col items-end leading-none w-10">
                          <span className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">SM</span>
                          <span className="text-[11px] font-bold text-gray-500">{x.m}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seca Pós Pedra */}
              <div className="flex-1 flex flex-col bg-[#0b0e14]/80 rounded-xl border border-[#00c83a]/20 p-3 shadow-[0_0_20px_rgba(0,200,58,0.05)]">
                
                {/* Cabeçalho lateral */}
                <div className="flex items-center justify-center gap-3 mb-3 h-[32px]">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-right leading-none">Pós</span>
                  <StoneIcon n={stats.posAtrasos.num} size="md" />
                </div>
                
                {/* Atrasos embaixo */}
                <div className="flex flex-col gap-2 w-full">
                  {[
                    { c: 'Vermelho', a: stats.posAtrasos.V.a, m: stats.posAtrasos.V.m, bg: 'bg-[#e51e3e]', tc: 'text-red-400' },
                    { c: 'Preto', a: stats.posAtrasos.P.a, m: stats.posAtrasos.P.m, bg: 'bg-[#1a1d24] border border-gray-600', tc: 'text-gray-400' },
                    { c: 'Branco', a: stats.posAtrasos.B.a, m: stats.posAtrasos.B.m, bg: 'bg-white', tc: 'text-white' }
                  ].map((x, i) => (
                    <div key={`p-${i}`} className="flex justify-between items-center bg-[#1a1d24]/50 rounded-lg p-2 border border-[#00c83a]/10 hover:bg-[#00c83a]/[0.02] transition-colors">
                      <div className="flex items-center gap-1.5 w-16">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${x.bg} shadow-sm`}></div>
                        <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">{x.c}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end leading-none w-10">
                          <span className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">SA</span>
                          <span className={`text-[12px] font-black ${x.a >= 10 && x.c !== 'Branco' ? 'text-red-500' : x.tc}`}>{x.a}</span>
                        </div>
                        <div className="w-px h-6 bg-white/10"></div>
                        <div className="flex flex-col items-end leading-none w-10">
                          <span className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">SM</span>
                          <span className="text-[11px] font-bold text-gray-500">{x.m}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Radar Mestre de Confluência */}
        <div className="bg-gradient-to-r from-[#0a0a0f] to-[#12141c] border border-white/10 rounded-xl p-5 shadow-xl flex flex-col relative overflow-hidden h-auto justify-between gap-5">
           {signalState.status === 'active' && (
               <div className="absolute top-0 left-0 w-full h-full bg-[#e85dff]/5 animate-pulse pointer-events-none"></div>
           )}
           
           {/* Topo: Indicador e Titulo */}
           <div className="flex items-center justify-between z-10 w-full">
               <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-[2px] transition-all ${
                      signalState.status === 'active' ? 'bg-[#e85dff]/20 border-[#e85dff] shadow-[0_0_15px_rgba(232,93,255,0.4)]' :
                      signalState.status === 'win' ? 'bg-[#00c83a]/20 border-[#00c83a] shadow-[0_0_15px_rgba(0,200,58,0.4)]' :
                      signalState.status === 'loss' ? 'bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' :
                      'bg-black/50 border-white/10'
                  }`}>
                     {signalState.status === 'active' ? (
                         <span className="text-[#e85dff] font-black text-xl">{signalState.step}/6</span>
                     ) : signalState.status === 'win' ? (
                         <span className="text-[#00c83a] font-black text-sm uppercase tracking-widest">Win</span>
                     ) : signalState.status === 'loss' ? (
                         <span className="text-red-500 font-black text-[11px] uppercase tracking-widest">Loss</span>
                     ) : (
                         <div className="w-4 h-4 rounded-full bg-gray-600 animate-pulse"></div>
                     )}
                  </div>

                  <div className="flex flex-col">
                     <h3 className="text-[12px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                        Mestre de Confluência
                        {signalState.status === 'active' && <span className="w-2 h-2 rounded-full bg-[#e85dff] animate-pulse"></span>}
                     </h3>
                     <span className="text-[11px] text-gray-300 font-bold mt-1">
                        {signalState.status === 'active' 
                           ? `Sinal Aprovado (IA)! Entrada ${signalState.step} p/ Branco.` 
                           : signalState.status === 'win' 
                           ? `Vitória na ${signalState.step}ª entrada!`
                           : signalState.status === 'loss'
                           ? `Red após 6 entradas.`
                           : `Buscando gatilhos e analisando a IA...`}
                     </span>
                  </div>
               </div>

               {/* Nível de Confluência */}
               <div className="flex flex-col items-end z-10">
                  <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Nível de Força</span>
                  <div className="flex gap-1.5">
                     {[1, 2, 3].map(lvl => (
                        <div key={lvl} className={`w-8 h-2.5 rounded-sm transition-all ${
                            signalState.level >= lvl 
                               ? 'bg-[#e85dff] shadow-[0_0_8px_rgba(232,93,255,0.5)]' 
                               : 'bg-white/5'
                        }`}></div>
                     ))}
                  </div>
               </div>
           </div>

           {/* Meio: Explicação do Card */}
           <div className="bg-black/30 border border-white/5 rounded-lg p-3 w-full flex items-center justify-center z-10">
              <p className="text-[11px] text-gray-400 font-medium text-center leading-relaxed">
                 {signalState.status === 'standby' ? (
                     <>Aguarde o <strong>sinal verde (roxo)</strong> do Mestre. Quando o radar piscar em roxo, significa que os padrões, zonas e IA alinharam. <strong>Siga a recomendação fazendo a entrada e mais 5 gales para o Branco.</strong></>
                 ) : signalState.status === 'active' ? (
                     <>Gatilho ativado! O radar encontrou confluência nível {signalState.level}. <strong>O Mestre indica fazer até 6 entradas consecutivas buscando o Branco.</strong> Siga o gerenciamento.</>
                 ) : signalState.status === 'win' ? (
                     <>Excelente! Acertamos a pedra Branca na <strong>{signalState.step}ª tentativa</strong>. O ciclo foi fechado com lucro. Aguardando o próximo alinhamento perfeito da inteligência.</>
                 ) : (
                     <>Não foi dessa vez. O mercado quebrou o padrão nas 6 rodadas. O radar entra em modo de recuperação silencioso aguardando a próxima oportunidade clara.</>
                 )}
              </p>
           </div>

           {/* Fundo: Pedras da Entrada */}
           <div className="w-full flex items-center justify-between gap-3 border-t border-white/5 pt-5 z-10">
              {[...Array(6)].map((_, i) => {
                  const stoneNum = signalState.stones[i];
                  const isFilled = stoneNum !== undefined;
                  return (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1">
                          {isFilled ? (
                              <StoneIcon n={stoneNum} size="lg" />
                          ) : (
                              <div className="w-12 h-12 rounded-xl bg-[#1a1d24]/50 border border-dashed border-white/10 flex items-center justify-center">
                                  <span className="text-[10px] text-gray-600 font-black tracking-widest">{i+1}ª</span>
                              </div>
                          )}
                      </div>
                  );
              })}
           </div>
        </div>
      </div>

      {/* ── SEÇÃO AVANÇADA (Zonas Quentes + Minutos da IA) ── */}
      <div className="flex flex-col lg:flex-row gap-4 mt-4">
        
        {/* Zonas Quentes do Branco */}
        <div className="flex-1 bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col">
          <div className="px-4 py-3 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Zonas Quentes após o branco</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-gray-400 bg-black/40 px-2 py-0.5 rounded-full border border-white/5 whitespace-nowrap hidden sm:inline">
                Atraso: <strong className="text-white text-[11px] ml-1">{zonesStats.currentGap}</strong>
              </span>
              <select className="bg-[#0b0e14] border border-white/10 text-white text-[11px] md:text-[9px] px-3 py-1.5 md:px-2 md:py-1 rounded outline-none cursor-pointer" value={zonesPeriod} onChange={(e) => setZonesPeriod(+e.target.value)}>
                <option value={1}>1h</option>
                <option value={2}>2h</option>
                <option value={3}>3h</option>
                <option value={4}>4h</option>
                <option value={6}>6h</option>
                <option value={9}>9h</option>
                <option value={12}>12h</option>
              </select>
            </div>
          </div>
          
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-3 flex-1 content-start">
            {zonesStats.blocks.map((z, i) => (
              <div key={i} className={`rounded-xl border px-3 pt-3 pb-5 flex flex-col gap-1.5 transition-all relative overflow-hidden ${
                z.status === 'ativo' ? 'bg-[#00c83a]/10 border-[#00c83a]/40 shadow-[0_0_15px_rgba(0,200,58,0.2)]' :
                z.status === 'passou' ? 'bg-red-500/5 border-red-500/20 opacity-60' :
                'bg-[#0b0c10] border-white/5 hover:border-white/10'
              }`}>
                {z.status === 'ativo' && (
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-[#00c83a]/20 blur-2xl rounded-full"></div>
                )}
                
                <div className="flex justify-between items-center z-10 relative">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${z.status === 'ativo' ? 'text-emerald-400' : 'text-gray-400'}`}>
                    Casa {z.label}
                  </span>
                  {z.status === 'ativo' && (
                    <span className="text-[7px] font-bold bg-emerald-400 text-black px-1.5 py-0.5 rounded animate-pulse">ATIVO</span>
                  )}
                </div>
                
                <div className="flex items-end gap-1 mt-1 z-10 relative">
                  <span className={`text-lg font-black ${z.winrate >= 50 ? 'text-emerald-400' : z.winrate > 0 ? 'text-white' : 'text-gray-600'}`}>
                    {z.winrate.toFixed(1)}%
                  </span>
                  <span className="text-[8px] text-gray-500 mb-1 font-bold">Win</span>
                </div>
                
                <div className="flex justify-between mt-1 text-[8px] font-bold z-10 relative">
                  <span className="text-emerald-400/80">{z.wins} Win</span>
                  <span className="text-red-400/80">{z.losses} Loss</span>
                </div>
              
                <div className="mt-2 pt-2 border-t border-white/5 flex gap-1.5 justify-end items-center z-10 relative h-[28px]">
                  {z.cycles.map((cy, ci) => {
                     const isNewest = ci === z.cycles.length - 1;
                     return (
                       <div key={ci} className="relative flex flex-col items-center justify-center">
                         <div className={`min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-[5px] text-[11px] font-black font-mono shadow-sm transition-all ${
                            cy.type === 'W' 
                              ? 'bg-[#00c83a]/20 text-[#00c83a] border-[#00c83a]/40' 
                              : 'bg-[#e51e3e]/15 text-[#e51e3e] border-[#e51e3e]/40'
                         } ${isNewest ? 'border scale-110 shadow-[0_0_8px_rgba(255,255,255,0.15)] ring-1 ring-white/20 z-10 opacity-100' : 'border opacity-70'}`}>
                           {cy.count}
                         </div>
                         {isNewest && (
                           <div className="absolute -bottom-2.5 w-1 h-1 rounded-full bg-white animate-pulse shadow-[0_0_5px_white]"></div>
                         )}
                       </div>
                     );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── MINUTOS DA IA ────────────────────── */}
        <div className="flex-[2] bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300 shrink-0">
          <div className="px-5 py-4 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"></div>
              <span className="text-[11px] font-black uppercase tracking-widest text-white">
                MINUTOS DA IA
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <select className="bg-[#0b0e14] border border-white/10 text-white text-[9px] px-2 py-1 rounded outline-none cursor-pointer" value={iaPeriodFilter} onChange={(e) => setIaPeriodFilter(+e.target.value)}>
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
             {iaSignals.stats.map((st: any, idx: number) => (
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

          <div className="p-4 bg-black/40 flex-1">
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
                              const rHist = [
                                rawHistory[3], rawHistory[2], rawHistory[1], rawHistory[0],
                                rawHistory[7], rawHistory[6], rawHistory[5], rawHistory[4],
                                rawHistory[11], rawHistory[10], rawHistory[9], rawHistory[8]
                              ].filter(Boolean);
                              const wins = rawHistory.filter((h: any) => h.hit).length;
                              const wr = ((wins / 12) * 100).toFixed(0);
                              return (
                                <>
                                  <div className="flex justify-between items-center mb-2 gap-4">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Histórico 12h</div>
                                    <div className={`text-[11px] font-black ${wins >= 5 ? 'text-[#00c83a]' : 'text-amber-400'}`}>Win {wr}%</div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {rHist.map((h: any, hIdx: number) => (
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
                              {iaSignals.activeStratsByMin[min].map((sIdx: any) => {
                                const sName = iaSignals.activeStrats[sIdx];
                                const sInfo = iaSignals.stratStats.find((s: any) => s.name === sName) || { winRate: 0, sa: 0, sm: 0, name: sName };
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
      </div>

      {/* Radar de Padrões */}
      <div className="flex flex-col gap-4 mt-4">
        <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="px-4 py-3 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Radar de Padrões</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setRadarMode('branco')}
                className={`text-[9px] font-bold px-2 py-1 border rounded uppercase tracking-wider transition-colors ${radarMode === 'branco' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-gray-400 bg-white/5 border-white/5 hover:border-white/20 hover:text-white'}`}
              >
                Branco (6 Entradas)
              </button>
              <button 
                onClick={() => setRadarMode('cor')}
                className={`text-[9px] font-bold px-2 py-1 border rounded uppercase tracking-wider transition-colors ${radarMode === 'cor' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-gray-400 bg-white/5 border-white/5 hover:border-white/20 hover:text-white'}`}
              >
                Cor (2 Entradas)
              </button>
            </div>
          </div>

          {/* Seção Ao Vivo + Casa Exata */}
          <div className="p-4 border-b border-[#00c83a]/10 bg-black/20 flex flex-col lg:flex-row gap-6">
            
            {/* Monitoramento Ao Vivo (Sequências) */}
            <div className="flex-1 flex flex-col w-full">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                Ao Vivo (Sequência)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-3">
                {[4, 5, 6].map((tamanho) => {
                  const live = radarStats.livePatterns[tamanho];
                  if (!live) return null;
                  return (
                    <div key={tamanho} className="bg-[#1a1d24]/50 border border-white/5 rounded-lg p-3 flex flex-col gap-2 relative overflow-hidden">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-300 tracking-wider">{tamanho} Pedras</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {live.pat.map((c: string, j: number) => (
                          <div key={j} className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                            c === 'V' ? 'bg-[#e51e3e] border-[#e51e3e]/50' : 
                            c === 'P' ? 'bg-[#1a1d24] border-gray-600' :
                            'bg-white border-white/80 shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                          }`}>
                            {c === 'B' && <div className="w-2.5 h-2.5 rounded-full bg-slate-200 shadow-inner"></div>}
                          </div>
                        ))}
                        <span className="text-[10px] text-gray-600 mx-1">→</span>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${live.target === 'B' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)] border-white' : live.target === 'V' ? 'bg-[#e51e3e] border-[#e51e3e]/50' : 'bg-[#1a1d24] border-gray-600'}`}></div>
                      </div>

                      <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-gray-500 uppercase tracking-widest">Geral</span>
                          <span className={`text-[10px] font-black ${live.winrate >= 80 ? 'text-emerald-400' : 'text-white'}`}>{live.winrate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-gray-500 uppercase tracking-widest">Finalizando c/ Nº {radarStats.lastNumber}</span>
                          <span className={`text-[10px] font-black ${live.wrL !== null ? 'text-emerald-400' : 'text-gray-600'}`}>{live.wrL !== null ? `${live.wrL.toFixed(1)}%` : '-'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 5 Casas Exatas */}
            <div className="flex-1 flex flex-col w-full">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8b008b] animate-pulse shadow-[0_0_8px_rgba(139,0,139,0.8)]"></span>
                Top 5 Casas Exatas
              </h4>
              <div className="flex flex-col gap-2">
                {radarStats.topCasas?.map((c: any, i: number) => (
                   <div key={`ce-${i}`} className="flex items-center justify-between p-2 rounded-lg border transition-colors bg-[#1a1d24]/50 border-white/5">
                      <div className="flex items-center gap-3">
                         <StoneIcon n={c.num} size="sm" />
                         <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">→ {c.casa}ª Casa</span>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col items-center leading-none">
                            <span className="text-[7px] text-gray-500 font-bold uppercase mb-0.5">SA</span>
                            <span className="text-[12px] font-black text-white">{c.sa}</span>
                         </div>
                         <div className="flex flex-col items-end leading-none min-w-[50px]">
                            <span className={`text-[12px] font-black ${c.target === 'B' ? 'text-white drop-shadow-sm' : c.target === 'V' ? 'text-[#e51e3e]' : 'text-gray-400'}`}>{c.winrate.toFixed(1)}%</span>
                            <span className="text-[8px] text-gray-600 font-bold uppercase tracking-wider">{c.win}/{c.win + c.loss} {c.target === 'B' ? 'Win' : 'Hit'}</span>
                         </div>
                      </div>
                   </div>
                ))}
                {(!radarStats.topCasas || radarStats.topCasas.length === 0) && (
                   <div className="p-4 text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-[#1a1d24]/30 rounded-lg border border-white/5 h-full flex items-center justify-center min-h-[100px]">Nenhuma casa exata qualificou.</div>
                )}
              </div>
            </div>

          </div>

          {/* Tabelas de Ranking (Histórico) */}
          <div className="p-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[4, 5, 6].map((tamanho) => (
              <div key={tamanho} className="bg-[#0b0c10] border border-white/5 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 bg-black/40 border-b border-white/5 flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Top 5 Histórico ({tamanho} Pedras)</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] font-bold uppercase text-gray-500 tracking-wider">
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2 text-center">Padrão</th>
                        <th className="p-2 text-center">Winrate Geral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(radarStats[tamanho as keyof typeof radarStats] as any[])?.map((stat: any, i: number) => (
                        <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="p-2 text-center text-[10px] text-gray-600 font-bold">{i + 1}</td>
                          <td className="p-2">
                            <div className="flex gap-1 justify-center items-center">
                            {stat.pat.map((c: string, j: number) => (
                              <div key={j} className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                c === 'V' ? 'bg-[#e51e3e] border-[#e51e3e]/50' : 
                                c === 'P' ? 'bg-[#1a1d24] border-gray-600' :
                                'bg-white border-white/80 shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                              }`}>
                                {c === 'B' && <div className="w-2.5 h-2.5 rounded-full bg-slate-200 shadow-inner"></div>}
                              </div>
                            ))}
                            <span className="text-[10px] text-gray-600 mx-0.5">→</span>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${stat.target === 'B' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)] border-white' : stat.target === 'V' ? 'bg-[#e51e3e] border-[#e51e3e]/50' : 'bg-[#1a1d24] border-gray-600'}`}></div>
                          </div>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`text-[10px] font-black ${stat.winrate >= 80 ? 'text-emerald-400' : 'text-gray-300'}`}>{stat.winrate.toFixed(1)}%</span>
                          </td>
                        </tr>
                      ))}
                      {(!radarStats[tamanho as keyof typeof radarStats] || (radarStats[tamanho as keyof typeof radarStats] as any[]).length === 0) && (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-[10px] text-gray-500">Sem dados recentes suficientes</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
