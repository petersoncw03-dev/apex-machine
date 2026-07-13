// 'analysis' page – placeholder name, will be renamed later
'use client';

import { useEffect, useState, useMemo } from 'react';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';
import { useSSE } from '@/contexts/SSEContext';
import { Target, Copy } from 'lucide-react';

// Types
interface TickerData {
  id: string;
  timestamp: string; // ISO string
  color: string; // "Branco", "Vermelho", "Preto" …
  roll: string;
}

// Helper to parse hour/minute from timestamp
const getHourMinute = (ts: string) => {
  const d = new Date(ts);
  return { hour: d.getHours(), minute: d.getMinutes() };
};

export default function AnalysisPage() {
  const { subscribe } = useSSE();
  // Data for previous day and current day
  const [prevData, setPrevData] = useState<TickerData[]>([]);
  const [currData, setCurrData] = useState<TickerData[]>([]);
  const [weekGroups, setWeekGroups] = useState<TickerData[][]>([]);
  const [loading, setLoading] = useState(true);
  const [manualHouse, setManualHouse] = useState<number | null>(null);

  // ---------------------------------------------------------------------
  // Fetch data – for now we simply request the last 48 hours (24 h each) and
  // split it by date. In production replace with two dedicated endpoints.
  // ---------------------------------------------------------------------
  const fetchData = async () => {
    setLoading(true);
    try {
      const [res48, resWhites] = await Promise.all([
        fetch('/api/results/period?hours=48'),
        fetch('/api/results/period?hours=192&onlyWhites=true')
      ]);
      const json48 = await res48.json();
      const jsonWhites = await resWhites.json();

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      startOfWeek.setHours(0,0,0,0);

      const isSameDay = (date: Date, day: Date) =>
        date.getFullYear() === day.getFullYear() &&
        date.getMonth() === day.getMonth() &&
        date.getDate() === day.getDate();
        
      const prev: TickerData[] = [];
      const curr: TickerData[] = [];
      const weekMap = new Map<string, TickerData[]>();
      
      if (json48.data) {
        json48.data.forEach((r: any) => {
          const d = new Date(r.timestamp);
          const parsed = {
            ...r,
            color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
            roll: r.roll?.toString(),
          };
          if (isSameDay(d, now)) {
             curr.push(parsed);
          } else if (isSameDay(d, yesterday)) {
             prev.push(parsed);
          }
        });
      }

      if (jsonWhites.data) {
        jsonWhites.data.forEach((r: any) => {
          const d = new Date(r.timestamp);
          if (d >= startOfWeek && !isSameDay(d, now) && !isSameDay(d, yesterday)) {
            const parsed = {
              ...r,
              color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
              roll: r.roll?.toString(),
            };
            const dateKey = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
            if (!weekMap.has(dateKey)) weekMap.set(dateKey, []);
            weekMap.get(dateKey)!.push(parsed);
          }
        });
      }

      setPrevData(prev);
      setCurrData(curr);
      setWeekGroups(Array.from(weekMap.values()));
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
    return subscribe((roll: any) => {
      const newRoll: TickerData = {
        id: roll.id || roll.timestamp,
        timestamp: roll.timestamp,
        color: roll.color?.toString().charAt(0).toUpperCase() + roll.color?.toString().slice(1).toLowerCase(),
        roll: roll.roll?.toString(),
      };

      setCurrData((prev) => {
        if (prev.some((r) => r.id === newRoll.id || r.timestamp === newRoll.timestamp)) {
          return prev;
        }
        const updated = [...prev, newRoll];
        // Garantimos que seja ordenado do mais antigo para o mais recente (ordem cronológica padrão)
        updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return updated;
      });
    });
  }, [subscribe]);

  // ---------------------------------------------------------------------
  // Build the 24 × 60 matrix for a given dataset.
  // matrix[hour][minute] = true if a white was paid at that exact time.
  // ---------------------------------------------------------------------
  const buildMatrix = (data: TickerData[]) => {
    const matrix = Array.from({ length: 24 }, () => Array(60).fill(false));
    data.forEach((r) => {
      if (r.color?.toLowerCase().includes('branco')) {
        const { hour, minute } = getHourMinute(r.timestamp);
        matrix[hour][minute] = true;
      }
    });
    return matrix;
  };

  const prevMatrix = useMemo(() => buildMatrix(prevData), [prevData]);
  const currMatrix = useMemo(() => buildMatrix(currData), [currData]);

  // ---------------------------------------------------------------------
  // Count whites per minute (total column) and per hour (houses).
  // ---------------------------------------------------------------------
  const minuteTotalsPrev = useMemo(() => {
    const totals = Array(60).fill(0);
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        if (prevMatrix[h][m]) totals[m]++;
      }
    }
    return totals;
  }, [prevMatrix]);

  const minuteTotalsCurr = useMemo(() => {
    const totals = Array(60).fill(0);
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        if (currMatrix[h][m]) totals[m]++;
      }
    }
    return totals;
  }, [currMatrix]);

  // ---------------------------------------------------------------------
  // Calculate house counts and SM/SA for all 24 houses
  // ---------------------------------------------------------------------
  const computeGapsAndScores = (targetMatrix: boolean[][], prevMatrixForLookback: boolean[][] | null, isToday: boolean) => {
    const counts = Array(24).fill(0);
    const losses = Array(24).fill(0);
    const sm = Array(24).fill(0);
    const sa = Array(24).fill(0);

    const currentMisses = Array(24).fill(0);
    const lastHourArray = Array<number | null>(60).fill(null);

    const now = new Date();
    const currH = now.getHours();
    const currM = now.getMinutes();

    // Evaluate chronologically across the grid
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        // Stop evaluating if it's in the future
        if (isToday) {
          if (h > currH || (h === currH && m >= currM)) {
            continue;
          }
        }

        const lastHour = lastHourArray[m];
        if (lastHour !== null) {
          const gap = h - lastHour;
          if (gap >= 1 && gap <= 24) {
            // We reached a gap of `gap` hours without a white hitting previously.
            // This is an attempt for Casa `gap`!
            if (targetMatrix[h][m]) {
              // Hit!
              counts[gap - 1]++;
              currentMisses[gap - 1] = 0; // Reset SA for this Casa
            } else {
              // Miss!
              losses[gap - 1]++;
              currentMisses[gap - 1]++;
              if (currentMisses[gap - 1] > sm[gap - 1]) {
                sm[gap - 1] = currentMisses[gap - 1]; // Update Max Sequencia (SM)
              }
            }
          }
        }

        // If a white hits, update the anchor point
        if (targetMatrix[h][m]) {
          lastHourArray[m] = h;
        }
      }
    }

    for (let i = 0; i < 24; i++) {
      sa[i] = currentMisses[i];
    }

    return { counts, losses, sm, sa };
  };

  const { counts: houseCountsPrev, losses: lossesPrev, sm: smPrev, sa: saPrev } = useMemo(() => {
    return computeGapsAndScores(prevMatrix, null, false);
  }, [prevMatrix]);

  const { counts: houseCountsCurr, losses: lossesCurr, sm: smCurr, sa: saCurr } = useMemo(() => {
    return computeGapsAndScores(currMatrix, prevMatrix, true);
  }, [currMatrix, prevMatrix]);

  const weekScores = useMemo(() => {
    const aggCounts = Array(24).fill(0);
    const aggLosses = Array(24).fill(0);
    const aggSm = Array(24).fill(0);
    
    weekGroups.forEach(group => {
       const matrix = buildMatrix(group);
       const scores = computeGapsAndScores(matrix, null, false);
       for(let i=0; i<24; i++) {
          aggCounts[i] += scores.counts[i];
          aggLosses[i] += scores.losses[i];
          if (scores.sm[i] > aggSm[i]) aggSm[i] = scores.sm[i];
       }
    });
    
    return { counts: aggCounts, losses: aggLosses, sm: aggSm, sa: saPrev }; // sa uses prev day's SA since it's the last closed day
  }, [weekGroups, saPrev]);
  
  const bestHousesWeek = useMemo(() => {
    const paired = weekScores.counts.map((c, i) => ({ houseIndex: i, count: c }));
    paired.sort((a, b) => b.count - a.count);
    return paired.slice(0, 3).map((p) => p.houseIndex);
  }, [weekScores.counts]);

  const bestHousesCurr = useMemo(() => {
    const paired = houseCountsCurr.map((c, i) => ({ houseIndex: i, count: c }));
    paired.sort((a, b) => b.count - a.count);
    return paired.slice(0, 3).map((p) => p.houseIndex);
  }, [houseCountsCurr]);

  const bestHousesPrev = useMemo(() => {
    const paired = houseCountsPrev.map((c, i) => ({ houseIndex: i, count: c }));
    paired.sort((a, b) => b.count - a.count);
    return paired.slice(0, 3).map((p) => p.houseIndex);
  }, [houseCountsPrev]);

  // Compute future predictions for the current day based on best houses
  const currPredictionsMatrix = useMemo(() => {
    const pMatrix = Array.from({ length: 24 }, () => Array(60).fill(false));
    const now = new Date();
    const currH = now.getHours();
    const currM = now.getMinutes();

    for (let m = 0; m < 60; m++) {
      // Find latest white for this minute
      let lastHour: number | null = null;
      for (let h = 23; h >= 0; h--) {
        if (currMatrix[h][m]) {
          lastHour = h;
          break;
        }
      }
      if (lastHour === null && prevMatrix) {
        for (let h = 23; h >= 0; h--) {
          if (prevMatrix[h][m]) {
            lastHour = h - 24;
            break;
          }
        }
      }

      if (lastHour !== null) {
        bestHousesCurr.forEach(gapIndex => {
          const gap = gapIndex + 1;
          const expectedHour = lastHour! + gap;
          // If expected hit is within today's bounds
          if (expectedHour >= 0 && expectedHour < 24) {
            // Only highlight if it hasn't passed yet
            if (expectedHour > currH || (expectedHour === currH && m >= currM)) {
              pMatrix[expectedHour][m] = true;
            }
          }
        });
      }
    }
    return pMatrix;
  }, [currMatrix, prevMatrix, bestHousesCurr]);

  const manualPredictionsMatrix = useMemo(() => {
    if (manualHouse === null) return null;
    const pMatrix = Array.from({ length: 24 }, () => Array(60).fill(false));
    const now = new Date();
    const currH = now.getHours();
    const currM = now.getMinutes();

    for (let m = 0; m < 60; m++) {
      let lastHour: number | null = null;
      for (let h = 23; h >= 0; h--) {
        if (currMatrix[h][m]) {
          lastHour = h;
          break;
        }
      }
      if (lastHour === null && prevMatrix) {
        for (let h = 23; h >= 0; h--) {
          if (prevMatrix[h][m]) {
            lastHour = h - 24;
            break;
          }
        }
      }

      if (lastHour !== null) {
        const gap = manualHouse + 1;
        const expectedHour = lastHour + gap;
        if (expectedHour >= 0 && expectedHour < 24) {
          if (expectedHour > currH || (expectedHour === currH && m >= currM)) {
            pMatrix[expectedHour][m] = true;
          }
        }
      }
    }
    return pMatrix;
  }, [currMatrix, prevMatrix, manualHouse]);

  // ---------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------
  const renderHouseSummary = (title: string, counts: number[], losses: number[], smArray: number[], saArray: number[], bestHouses: number[], isInteractive: boolean = false) => {
    return (
      <div className="flex flex-col mb-4">
        <h3 className="text-xs font-bold mb-2 uppercase text-gray-400 tracking-wider">{title}</h3>
        <div className="flex w-full border border-white/20 rounded overflow-hidden">
          {Array.from({ length: 24 }, (_, i) => {
            const isBest = bestHouses.includes(i);
            const isManual = isInteractive && manualHouse === i;
            
            let styleClass = { backgroundColor: '#7a9be3', color: '#000' };
            if (isManual) styleClass = { backgroundColor: '#FFCC00', color: '#000' };
            else if (isBest) styleClass = { backgroundColor: '#800080', color: '#fff' };
            
            const total = counts[i] + losses[i];
            const assertivity = total === 0 ? '--%' : ((counts[i] / total) * 100).toFixed(1) + '%';
            
            return (
              <div key={i} className="flex-1 flex flex-col border-r border-white/20 last:border-r-0">
                <div className="py-1 text-center text-[11px] font-black border-b border-white/20 flex justify-center items-center gap-1" style={styleClass}>
                  {i + 1}
                  {isInteractive && (
                    <button 
                      onClick={() => setManualHouse(manualHouse === i ? null : i)}
                      className={`w-2 h-2 rounded-full border transition-all cursor-pointer shadow-sm ${
                        manualHouse === i ? 'border-black bg-black/60 scale-125' : 'border-black/30 hover:border-black/60 bg-white/20'
                      }`}
                      title={manualHouse === i ? 'Remover seleção manual' : 'Destacar previsões desta casa'}
                    />
                  )}
                </div>
                <div className="py-1 text-center text-[12px] font-bold border-b border-white/20" style={styleClass}>
                  {counts[i]}
                </div>
                <div className="py-0.5 text-center text-[9px] font-bold bg-[#1a1a24] text-green-400 border-b border-white/10" title={`Assertividade (Win: ${counts[i]} / Loss: ${losses[i]})`}>
                  {assertivity}
                </div>
                <div className="py-0.5 text-center text-[9px] font-bold bg-[#1a1a24] text-red-400">
                  SM {smArray[i]}
                </div>
                <div className="py-0.5 text-center text-[9px] font-bold bg-[#1a1a24] text-red-500">
                  SA {saArray[i]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const renderGrid = (matrix: boolean[][], minuteTotals: number[], predictionsMatrix?: boolean[][], manualPredMatrix?: boolean[][] | null) => {
    const maxTotal = Math.max(...minuteTotals);
    const rows: React.ReactNode[] = [];
    for (let m = 0; m < 60; m++) {
      const total = minuteTotals[m];
      
      let styleTotal = { backgroundColor: '#7a9be3', color: '#000' };
      if (total === 0) styleTotal = { backgroundColor: '#d32f2f', color: '#fff' };
      else if (total === maxTotal && maxTotal > 0) styleTotal = { backgroundColor: '#16a34a', color: '#fff' };
      
      rows.push(
        <tr key={m}>
          <td className="p-1 text-center font-bold text-[11px] border border-white/20" style={styleTotal}>{total}</td>
          <td className="p-1 text-center font-bold text-[11px] border border-white/20" style={{ backgroundColor: '#7a9be3', color: '#000' }}>{m}</td>
          {Array.from({ length: 24 }, (_, h) => {
            const isWhite = matrix[h][m];
            const isPrediction = predictionsMatrix ? predictionsMatrix[h][m] : false;
            const isManualPrediction = manualPredMatrix ? manualPredMatrix[h][m] : false;
            
            let bgColor = '#262626';
            if (isWhite) bgColor = '#22c55e';
            else if (isManualPrediction) bgColor = '#FFCC00';
            else if (isPrediction) bgColor = '#800080';
            
            return (
              <td 
                key={h} 
                className="h-6 border border-white/20" 
                style={{ backgroundColor: bgColor }}
              ></td>
            );
          })}
        </tr>
      );
    }
    return rows;
  };

  const handleCopyPredictions = (h: number) => {
    if (!currPredictionsMatrix) return;
    
    const minutes: string[] = [];
    for (let m = 0; m < 60; m++) {
      const isPurple = currPredictionsMatrix[h][m];
      const isYellow = manualPredictionsMatrix ? manualPredictionsMatrix[h][m] : false;
      
      if (isYellow) {
        minutes.push(`${m}*`);
      } else if (isPurple) {
        minutes.push(`${m}`);
      }
    }
    
    if (minutes.length === 0) {
      alert(`Nenhuma entrada para as ${h}h.`);
      return;
    }
    
    const text = `Para o horario de ${h}h, os minutos exatos indicados para entrar, são:\n${minutes.join('\n')}`;
    navigator.clipboard.writeText(text);
  };

  if (loading && !currData.length) {
    return (
      <div className="flex h-screen items-center justify-center text-white bg-[#030303]">
        <div className="animate-pulse flex flex-col items-center">
          <Target className="w-12 h-12 text-blue-500 mb-4 animate-spin" />
          <p className="text-xl font-bold tracking-widest text-gray-400">ANALISANDO...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-full w-full mx-auto flex flex-col gap-6 bg-[#030303] text-white">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6 w-full">
      {/* Top card – same style as painel‑master */}
      <section className="bg-[#0a0a0f] border border-white/5 rounded-lg p-4 shadow-2xl mb-4">
        <LiveHistoryCard data={currData} maxItems={20} />
      </section>

      {/* Houses summary – current day & previous day */}
      <section className="flex flex-col gap-4 bg-[#0a0a0f] border border-white/5 rounded-lg p-4 shadow-xl">
        {renderHouseSummary('Hoje', houseCountsCurr, lossesCurr, smCurr, saCurr, bestHousesCurr, true)}
        {renderHouseSummary('Dia Anterior', houseCountsPrev, lossesPrev, smPrev, saPrev, bestHousesPrev)}
        {renderHouseSummary('Última Semana (Dias Fechados)', weekScores.counts, weekScores.losses, weekScores.sm, weekScores.sa, bestHousesWeek)}
      </section>

      {/* Excel‑style grid – current day */}
      <section className="overflow-auto rounded-lg border border-white/5 bg-[#0a0a0f]">
        <h3 className="text-sm font-bold text-center py-2 text-white">Hoje</h3>
        <table className="w-full min-w-max table-fixed border-collapse">
          <thead>
            <tr>
              <th className="p-1 font-bold text-xs border border-white/20 w-16" style={{ backgroundColor: '#7a9be3', color: '#000' }}>Total</th>
              <th className="p-1 font-bold text-xs border border-white/20 w-16" style={{ backgroundColor: '#7a9be3', color: '#000' }}>Minuto</th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="group relative p-1 font-bold text-[10px] border border-white/20 min-w-[45px] sm:min-w-[50px] cursor-default" style={{ backgroundColor: '#7a9be3', color: '#000' }}>
                  <div className="flex flex-col items-center justify-center md:flex-row md:gap-1">
                    <span>{h.toString().padStart(2, '0')}:00</span>
                    <button 
                      onClick={() => handleCopyPredictions(h)}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-black/20 md:bg-black/80 text-white rounded p-0.5 mt-0.5 md:mt-0 hover:bg-black/40 md:hover:bg-black"
                      title="Copiar previsões"
                    >
                      <Copy className="w-[10px] h-[10px]" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{renderGrid(currMatrix, minuteTotalsCurr, currPredictionsMatrix, manualPredictionsMatrix)}</tbody>
        </table>
      </section>

      {/* Excel‑style grid – previous day */}
      <section className="overflow-auto rounded-lg border border-white/5 bg-[#0a0a0f]">
        <h3 className="text-sm font-bold text-center py-2 text-white">Dia Anterior</h3>
        <table className="w-full min-w-max table-fixed border-collapse">
          <thead>
            <tr>
              <th className="p-1 font-bold text-xs border border-white/20 w-16" style={{ backgroundColor: '#7a9be3', color: '#000' }}>Total</th>
              <th className="p-1 font-bold text-xs border border-white/20 w-16" style={{ backgroundColor: '#7a9be3', color: '#000' }}>Minuto</th>
              {Array.from({ length: 24 }, (_, i) => (
                <th key={i} className="p-1 font-bold text-[10px] border border-white/20 min-w-[45px] sm:min-w-[50px]" style={{ backgroundColor: '#7a9be3', color: '#000' }}>
                  {i.toString().padStart(2, '0')}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{renderGrid(prevMatrix, minuteTotalsPrev)}</tbody>
        </table>
      </section>


      </div>
    </main>
  );
}
