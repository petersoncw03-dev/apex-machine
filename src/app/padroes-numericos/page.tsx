'use client';

import { useEffect, useState, useMemo } from 'react';
import Ticker, { TickerData } from '@/components/Ticker';
import { motion } from 'framer-motion';

function generateNumberPatterns(length: number): number[][] {
  const nums = Array.from({ length: 15 }, (_, i) => i);
  if (length === 1) return nums.map(n => [n]);
  if (length === 2) {
    const res = [];
    for (const a of nums) {
      for (const b of nums) {
        res.push([a, b]);
      }
    }
    return res;
  }
  if (length === 3) {
    const res = [];
    for (const a of nums) {
      for (const b of nums) {
        for (const c of nums) {
          res.push([a, b, c]);
        }
      }
    }
    return res;
  }
  return [];
}

const PATTERNS_1 = generateNumberPatterns(1);
const PATTERNS_2 = generateNumberPatterns(2);
const PATTERNS_3 = generateNumberPatterns(3);

interface PatternStats {
  id: string;
  pattern: number[];
  win: number;
  loss: number;
  sm: number;
  sa: number;
  casas: number[];
}

function NumberPatternTableSection({ title, patternsConfig, data }: { title: string, patternsConfig: number[][], data: TickerData[] }) {
  const [casasLimit, setCasasLimit] = useState(3);
  const [periodHours, setPeriodHours] = useState(12);
  const [minWin, setMinWin] = useState(0);
  const [sortColumn, setSortColumn] = useState<'TX' | 'SA' | 'SM'>('TX');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const handleSort = (column: 'TX' | 'SA' | 'SM') => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn('TX');
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const stats: PatternStats[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    const recordsNeeded = periodHours * 120;
    const analysisData = data.slice(-recordsNeeded);

    const unsortedStats = patternsConfig.map((patternConfig) => {
      let winCount = 0;
      let lossCount = 0;
      let currentLossStreak = 0;
      let maxLossStreak = 0;
      let casasWins = Array(casasLimit).fill(0);

      let activeTriggers: { entriesLeft: number, step: number }[] = [];

      for (let i = 0; i < analysisData.length; i++) {
        const currentRoll = analysisData[i];
        const isBranco = currentRoll.color.includes('Branco') || currentRoll.roll === '0';

        if (activeTriggers.length > 0) {
          if (isBranco) {
            winCount += 1;
            const oldestTrigger = activeTriggers[0];
            casasWins[oldestTrigger.step]++;
            activeTriggers = [];
            currentLossStreak = 0;
          } else {
            for (let t = activeTriggers.length - 1; t >= 0; t--) {
              activeTriggers[t].entriesLeft--;
              activeTriggers[t].step++;
              if (activeTriggers[t].entriesLeft === 0) {
                lossCount++;
                currentLossStreak++;
                if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
                activeTriggers.splice(t, 1);
              }
            }
          }
        }

        if (i >= patternConfig.length - 1) {
          let match = true;
          for (let p = 0; p < patternConfig.length; p++) {
            const historyRoll = analysisData[i - (patternConfig.length - 1) + p];
            const historyRollNum = parseInt(historyRoll.roll as string);
            if (historyRollNum !== patternConfig[p]) {
              match = false;
              break;
            }
          }
          if (match) activeTriggers.push({ entriesLeft: casasLimit, step: 0 });
        }
      }

      return {
        id: patternConfig.join('-'),
        pattern: patternConfig,
        win: winCount,
        loss: lossCount,
        sm: maxLossStreak,
        sa: currentLossStreak,
        casas: casasWins
      };
    });

    const sorted = unsortedStats.sort((a, b) => {
      const aMeetsWin = a.win >= minWin;
      const bMeetsWin = b.win >= minWin;

      if (aMeetsWin && !bMeetsWin) return -1;
      if (!aMeetsWin && bMeetsWin) return 1;

      if (sortColumn === 'SA') {
        if (sortDirection === 'desc') return b.sa - a.sa;
        return a.sa - b.sa;
      }

      if (sortColumn === 'SM') {
        if (sortDirection === 'desc') return b.sm - a.sm;
        return a.sm - b.sm;
      }

      let aRate = 0;
      if (a.win + a.loss > 0) aRate = a.win / (a.win + a.loss);
      let bRate = 0;
      if (b.win + b.loss > 0) bRate = b.win / (b.win + b.loss);
      
      if (sortDirection === 'desc') {
        if (Math.abs(bRate - aRate) < 0.0001) return b.win - a.win;
        return bRate - aRate;
      } else {
        if (Math.abs(bRate - aRate) < 0.0001) return a.win - b.win;
        return aRate - bRate;
      }
    });

    return sorted.slice(0, 50); // Keep only top 50 to avoid DOM lag
  }, [data, casasLimit, periodHours, patternsConfig, minWin, sortColumn, sortDirection]);

  const getNumberColorClass = (num: number) => {
    if (num === 0) return "bg-white text-black border-black/30";
    if (num >= 1 && num <= 7) return "bg-[#f12c4c] text-white border-black/30";
    return "bg-[#262831] text-white border-white/20"; // 8 to 14
  };

  return (
    <>
      <h2 className="text-xl font-bold text-white mt-8 mb-[-10px]">{title} <span className="text-xs font-normal text-gray-400 ml-2">(Mostrando TOP 50)</span></h2>
      
      <section className="flex flex-wrap gap-4 items-center bg-[#0a0a0f] p-4 rounded-lg border border-white/5">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Limites de Casas (Gale)</label>
          <select 
            className="bg-[#12141c] border border-white/10 text-white px-3 py-1.5 rounded-md outline-none focus:border-[#e51e3e]"
            value={casasLimit}
            onChange={(e) => setCasasLimit(Number(e.target.value))}
          >
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => (
              <option key={num} value={num}>{num} Casas</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Período de Análise</label>
          <select 
            className="bg-[#12141c] border border-white/10 text-white px-3 py-1.5 rounded-md outline-none focus:border-[#e51e3e]"
            value={periodHours}
            onChange={(e) => setPeriodHours(Number(e.target.value))}
          >
            {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(h => (
              <option key={h} value={h}>{h} Horas (~{h * 120} giros)</option>
            ))}
          </select>
        </div>
      </section>

      <section className="bg-[#0a0a0f] rounded-lg border border-white/5 overflow-x-auto shadow-2xl mb-8">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-[#789bde] text-white">
              <th className="p-3 border-r border-white/20 text-center font-medium">PADRÃO NUMÉRICO</th>
              <th 
                className="p-3 border-r border-white/20 text-center font-medium cursor-pointer hover:bg-white/10 select-none transition-colors"
                title="Porcentagem de Assertividade"
                onClick={() => handleSort('TX')}
              >
                TX % {sortColumn === 'TX' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th className="p-3 border-r border-white/20 text-center font-medium">
                <div className="flex items-center justify-center gap-2">
                  <span>WIN</span>
                  <input 
                    type="number" 
                    min="0" 
                    className="w-12 bg-[#12141c] border border-white/10 rounded px-1 text-sm outline-none focus:border-[#e51e3e]"
                    value={minWin}
                    onChange={(e) => setMinWin(Number(e.target.value))}
                    title="Mínimo de Vitórias"
                  />
                </div>
              </th>
              <th className="p-3 border-r border-white/20 text-center font-medium">LOSS</th>
              <th 
                className="p-3 border-r border-white/20 text-center font-medium cursor-pointer hover:bg-white/10 select-none transition-colors"
                onClick={() => handleSort('SM')}
              >
                SM {sortColumn === 'SM' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th 
                className="p-3 border-r border-white/20 text-center font-medium cursor-pointer hover:bg-white/10 select-none transition-colors"
                onClick={() => handleSort('SA')}
              >
                SA {sortColumn === 'SA' ? (sortDirection === 'desc' ? '↓' : '↑') : ''}
              </th>
              {Array.from({ length: casasLimit }).map((_, i) => (
                <th key={i} className="p-3 border-r border-white/20 last:border-r-0 text-center font-medium">
                  CASA {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => {
              const winRate = ((stat.win / (stat.win + stat.loss || 1)) * 100).toFixed(1);
              const isAlert = stat.sm > 0 && stat.sa > 0 && (stat.sm - stat.sa <= 2);
              const highlightClass = isAlert ? "bg-[#8b008b] text-white" : "text-gray-300";

              return (
                <motion.tr 
                  layout
                  key={stat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="p-2 border-r border-white/5">
                    <div className="flex gap-1 justify-center">
                      {stat.pattern.map((num, i) => (
                        <div 
                          key={i} 
                          className={`w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs shadow-sm border ${getNumberColorClass(num)}`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 border-r border-white/5 text-center text-[#4ade80] font-bold">{winRate}%</td>
                  <td className="p-3 border-r border-white/5 text-center text-[#789bde] font-semibold">{stat.win}</td>
                  <td className="p-3 border-r border-white/5 text-center text-[#789bde] font-semibold">{stat.loss}</td>
                  <td className={`p-3 border-r border-white/5 text-center font-bold transition-colors ${highlightClass}`}>{stat.sm}</td>
                  <td className={`p-3 border-r border-white/5 text-center font-bold transition-colors ${highlightClass}`}>{stat.sa}</td>
                  {stat.casas.map((val, i) => (
                    <td key={i} className="p-3 border-r border-white/5 last:border-r-0 text-center text-gray-300">
                      {val}
                    </td>
                  ))}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default function PadroesNumericosPage() {
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      const res = await fetch(`/api/results/period?hours=60`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data.map((r: any) => ({ 
          ...r, 
          color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), 
          roll: r.roll?.toString() 
        })));
      }
    } catch (err) { 
      console.warn("Falha ao buscar dados (Padrões Num):", err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const tickerData = useMemo(() => {
    return data.slice(-20);
  }, [data]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1400px] mx-auto flex flex-col gap-6">
      {/* Ticker Section */}
      <section>
        {loading && data.length === 0 ? (
          <div className="h-14 w-full bg-white/5 rounded-lg animate-pulse"></div>
        ) : (
          <Ticker data={tickerData} />
        )}
      </section>

      {!loading && data.length > 0 && (
        <div className="flex flex-col gap-4">
          <NumberPatternTableSection title="Padrões de 1 Número (Gale)" patternsConfig={PATTERNS_1} data={data} />
          <NumberPatternTableSection title="Padrões de 2 Números Seguidos" patternsConfig={PATTERNS_2} data={data} />
          <NumberPatternTableSection title="Padrões de 3 Números Seguidos" patternsConfig={PATTERNS_3} data={data} />
        </div>
      )}

      {loading && data.length === 0 && (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#e51e3e]"></div>
        </div>
      )}
    </main>
  );
}
