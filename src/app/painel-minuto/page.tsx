'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import Ticker, { TickerData } from '@/components/Ticker';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

export default function PainelMinutoPage() {
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodHours, setPeriodHours] = useState(12);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/results/period?hours=${periodHours}`);
      if (!res.ok) throw new Error('Falha');
      const json = await res.json();
      if (json.data) {
        setData(json.data.map((r: any) => ({ ...r, color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), roll: r.roll?.toString() })));
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const { subscribe } = useSSE();

  useEffect(() => { fetchData(); }, [periodHours]);

  useEffect(() => {
    const unsub = subscribe((mappedRoll) => {
      setData(prevData => {
        if (prevData.some(r => r.id === mappedRoll.id)) return prevData;
        return [...prevData, {...mappedRoll, roll: mappedRoll.roll?.toString()}];
      });
    });
    return unsub;
  }, [subscribe]);


  const tickerData = useMemo(() => data.slice(-20), [data]);

  const grid = useMemo(() => {
    const defaultGrid = Array.from({ length: 60 }).map(() => ({ col1: 0, col2: 0 }));
    if (!data || data.length === 0) return defaultGrid;
    for (const roll of data) {
      const isBranco = roll.color.includes('Branco') || roll.roll === '0';
      if (isBranco && roll.timestamp) {
        const d = new Date(roll.timestamp);
        const m = d.getMinutes(), s = d.getSeconds();
        if (!isNaN(m) && !isNaN(s) && m >= 0 && m < 60) {
          if (s < 30) defaultGrid[m].col1++;
          else defaultGrid[m].col2++;
        }
      }
    }
    return defaultGrid;
  }, [data, periodHours]);

  const maxVal = useMemo(() => Math.max(...grid.map(g => g.col1 + g.col2), 1), [grid]);

  return (
    <main className="min-h-screen bg-[#050507] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#0a0a0f] border-b border-white/5 p-4 flex items-center justify-between shadow-2xl z-40">
        <h1 className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 flex items-center gap-2">
          <Clock className="text-cyan-500" size={22} />
          Painel de Minuto
        </h1>
        <div className="flex items-center gap-3">
          <select
            className="bg-[#12141c] border border-white/10 text-white font-bold text-xs px-3 py-2 rounded-lg outline-none focus:border-cyan-500 transition-colors"
            value={periodHours}
            onChange={(e) => setPeriodHours(Number(e.target.value))}
          >
            {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(h => (
              <option key={h} value={h}>{h} {h === 1 ? 'Hora' : 'Horas'}</option>
            ))}
          </select>
          {loading && <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />}
        </div>
      </div>

      {/* Ticker */}
      <Ticker data={tickerData} />

      {/* Legend */}
      <div className="flex items-center gap-6 px-6 py-3 border-b border-white/5 bg-[#0a0a0f]/50">
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Legenda:</span>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500/60" /><span className="text-[10px] text-gray-400">⚪ Branco (1ª metade)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-cyan-500/60" /><span className="text-[10px] text-gray-400">⚪ Branco (2ª metade)</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-900/60" /><span className="text-[10px] text-gray-400">Sem brancos</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-600/60" /><span className="text-[10px] text-gray-400">5+ brancos (quente)</span></div>
      </div>

      {/* Grid */}
      {!loading && data.length > 0 && (
        <div className="flex-1 p-4 md:p-6">
          <div className="flex flex-col gap-3">
            {[0, 10, 20, 30, 40, 50].map((startMin, rowIndex) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rowIndex * 0.06 }}
                key={startMin}
                className="flex gap-2"
              >
                <div className="w-8 flex items-center justify-center text-[9px] font-black text-gray-600 uppercase tracking-widest">
                  {startMin.toString().padStart(2,'0')}
                </div>
                <div className="flex-1 grid grid-cols-10 gap-1.5">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const min = startMin + i;
                    const col1 = grid[min].col1;
                    const col2 = grid[min].col2;
                    const sum = col1 + col2;
                    const intensity = Math.min(sum / maxVal, 1);

                    const getBarColor = (val: number) => {
                      if (val === 0) return 'bg-red-950/60 border-red-900/30';
                      if (val >= 5) return 'bg-green-700/70 border-green-600/40';
                      return 'bg-blue-700/50 border-blue-600/30';
                    };

                    const getSumColor = () => {
                      if (sum === 0) return 'text-red-400/50';
                      if (sum >= 5) return 'text-green-400 font-black';
                      return 'text-blue-300';
                    };

                    return (
                      <div key={min} className="flex flex-col rounded-xl overflow-hidden border border-white/5 bg-[#0a0a0f]">
                        {/* Minute header */}
                        <div className="text-center py-1 text-[9px] font-black text-gray-500 bg-white/[0.03]">
                          {min.toString().padStart(2, '0')}
                        </div>
                        {/* Heat bar */}
                        <div className="h-1 bg-white/5">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all rounded-full" style={{width:`${intensity*100}%`}} />
                        </div>
                        {/* Sub-columns */}
                        <div className="flex flex-1">
                          <div className={`flex-1 text-center py-2 text-xs font-bold border-r border-white/5 ${getBarColor(col1)} text-white`}>
                            {col1}
                          </div>
                          <div className={`flex-1 text-center py-2 text-xs font-bold ${getBarColor(col2)} text-white`}>
                            {col2}
                          </div>
                        </div>
                        {/* Sum */}
                        <div className={`text-center py-1.5 text-sm ${getSumColor()} border-t border-white/5`}>
                          {sum}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {loading && data.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 animate-pulse">Carregando...</span>
        </div>
      )}
    </main>
  );
}
