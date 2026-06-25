'use client';

import { useEffect, useState, useMemo } from 'react';
import Ticker, { TickerData } from '@/components/Ticker';
import { motion } from 'framer-motion';

// Helper to generate all combinations of 'V' and 'P' for a given length
function generatePatterns(length: number): string[][] {
  const patterns: string[][] = [];
  const total = Math.pow(2, length);
  for (let i = 0; i < total; i++) {
    const pattern: string[] = [];
    for (let j = length - 1; j >= 0; j--) {
      pattern.push((i & (1 << j)) !== 0 ? 'P' : 'V');
    }
    patterns.push(pattern);
  }
  return patterns;
}

const PATTERNS_3 = generatePatterns(3);
const PATTERNS_4 = generatePatterns(4);
const PATTERNS_5 = generatePatterns(5);
const PATTERNS_6 = generatePatterns(6);
const PATTERNS_7 = generatePatterns(7);

interface PatternStats {
  id: string;
  pattern: string[];
  win: number;
  loss: number;
  sm: number;
  sa: number;
  casas: number[];
}

interface ProcessedRoll {
  isBranco: boolean;
  colorCode: string;
}

function PatternTableSection({ title, patternsConfig, data, processedData }: { title: string, patternsConfig: string[][], data: TickerData[], processedData: ProcessedRoll[] }) {
  const [casasLimit, setCasasLimit] = useState(3);
  const [periodHours, setPeriodHours] = useState(10);
  const [minWin, setMinWin] = useState(0);
  const [sortColumn, setSortColumn] = useState<'TX' | 'SA' | 'SM'>('TX');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const handleSort = (column: 'TX' | 'SA' | 'SM') => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        // Resetar para o padrão (TX desc)
        setSortColumn('TX');
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const stats: PatternStats[] = useMemo(() => {
    if (!data || data.length === 0 || processedData.length === 0) return [];
    
    const recordsNeeded = Math.min(periodHours * 120, data.length);
    const analysisProcessed = processedData.slice(-recordsNeeded);

    const unsortedStats = patternsConfig.map((patternConfig) => {
      let winCount = 0;
      let lossCount = 0;
      let currentLossStreak = 0;
      let maxLossStreak = 0;
      let casasWins = Array(casasLimit).fill(0);
      let activeTriggers: { entriesLeft: number, step: number }[] = [];

      for (let i = 0; i < analysisProcessed.length; i++) {
        const currentRoll = analysisProcessed[i];
        
        if (activeTriggers.length > 0) {
          if (currentRoll.isBranco) {
            winCount += 1;
            casasWins[activeTriggers[0].step]++;
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

        const pLen = patternConfig.length;
        if (i >= pLen - 1) {
          let match = true;
          for (let p = 0; p < pLen; p++) {
            if (analysisProcessed[i - (pLen - 1) + p].colorCode !== patternConfig[p]) {
              match = false;
              break;
            }
          }
          if (match) activeTriggers.push({ entriesLeft: casasLimit, step: 0 });
        }
      }

      return {
        id: patternConfig.join(''),
        pattern: patternConfig,
        win: winCount,
        loss: lossCount,
        sm: maxLossStreak,
        sa: currentLossStreak,
        casas: casasWins
      };
    });

    return unsortedStats.sort((a, b) => {
      if (sortColumn === 'SA') {
        return sortDirection === 'desc' ? b.sa - a.sa : a.sa - b.sa;
      }
      if (sortColumn === 'SM') {
        return sortDirection === 'desc' ? b.sm - a.sm : a.sm - b.sm;
      }
      
      const aRate = a.win + a.loss > 0 ? a.win / (a.win + a.loss) : 0;
      const bRate = b.win + b.loss > 0 ? b.win / (b.win + b.loss) : 0;

      if (sortDirection === 'desc') {
        if (Math.abs(bRate - aRate) < 0.0001) return b.win - a.win;
        return bRate - aRate;
      } else {
        if (Math.abs(bRate - aRate) < 0.0001) return a.win - b.win;
        return aRate - bRate;
      }
    }).filter(s => s.win >= minWin).slice(0, 50);
  }, [data, processedData, casasLimit, periodHours, patternsConfig, minWin, sortColumn, sortDirection]);

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
            {[3,4,5,6,7].map(num => (
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
              <th className="p-3 border-r border-white/20 text-center font-medium">PADRÃO</th>
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
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                >
                  <td className="p-2 border-r border-white/5">
                    <div className="flex gap-1 justify-center">
                      {stat.pattern.map((color, i) => (
                        <div 
                          key={i} 
                          className={`w-6 h-6 rounded-sm border border-black/50 ${color === 'V' ? 'bg-[#f12c4c]' : 'bg-[#262831]'}`}
                        ></div>
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

export default function PadroesPage() {
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
      console.warn("Falha ao buscar dados (Padrões):", err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const processedData: ProcessedRoll[] = useMemo(() => {
    return data.map(roll => {
      const n = parseInt(roll.roll as string);
      let colorCode = 'B';
      if (roll.color.includes('Vermelho') || (n >= 1 && n <= 7)) colorCode = 'V';
      if (roll.color.includes('Preto') || (n >= 8 && n <= 14)) colorCode = 'P';
      return { isBranco: roll.color.includes('Branco') || roll.roll === '0', colorCode };
    });
  }, [data]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      <Ticker data={data.slice(-20)} />
      
      {!loading && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          <PatternTableSection title="Padrões de 3 Cores" patternsConfig={PATTERNS_3} data={data} processedData={processedData} />
          <PatternTableSection title="Padrões de 4 Cores" patternsConfig={PATTERNS_4} data={data} processedData={processedData} />
          <PatternTableSection title="Padrões de 5 Cores" patternsConfig={PATTERNS_5} data={data} processedData={processedData} />
          <PatternTableSection title="Padrões de 6 Cores" patternsConfig={PATTERNS_6} data={data} processedData={processedData} />
          <PatternTableSection title="Padrões de 7 Cores" patternsConfig={PATTERNS_7} data={data} processedData={processedData} />
        </div>
      ) : (
        <div className="flex justify-center p-20 text-white">Carregando análise...</div>
      )}
    </main>
  );
}
