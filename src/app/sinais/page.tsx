'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart2, Target } from 'lucide-react';
import { LiveHistoryCard } from '@/components/LiveHistoryCard';

interface TickerData {
  id: string;
  timestamp: string;
  color: string;
  roll: string;
}

const formatTime = (d: Date) => {
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}`;
};

type StrategyFn = (parsed: TickerData[], index: number, whiteTime: Date) => Date[];

const STRATEGIES: { name: string; color: string; fn: StrategyFn }[] = [
  {
    name: 'ANTERIOR',
    color: '#FFCC00', // Yellow
    fn: (parsed, i, d) => {
      if (i > 0) {
        const rollAnt = parseInt(parsed[i - 1].roll, 10);
        if (!isNaN(rollAnt)) return [new Date(d.getTime() + rollAnt * 60000)];
      }
      return [];
    }
  },
  {
    name: 'POSTERIOR',
    color: '#FF0000', // Red
    fn: (parsed, i, d) => {
      if (i < parsed.length - 1) {
        const rollPost = parseInt(parsed[i + 1].roll, 10);
        if (!isNaN(rollPost)) return [new Date(d.getTime() + rollPost * 60000)];
      }
      return [];
    }
  },
  {
    name: '60/120',
    color: '#0000FF', // Blue
    fn: (parsed, i, d) => {
      return [
        new Date(d.getTime() + 60 * 60000),
        new Date(d.getTime() + 120 * 60000)
      ];
    }
  },
  {
    name: '010/020',
    color: '#808080', // Gray
    fn: (parsed, i, d) => {
      return [
        new Date(d.getTime() + 10 * 60000),
        new Date(d.getTime() + 20 * 60000)
      ];
    }
  }
];

export default function SinaisPage() {
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/results/period?hours=48');
      const json = await res.json();
      if (json.data) {
        setData([...json.data].reverse()); // oldest to newest
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const engine = useMemo(() => {
    if (!data.length) return null;

    const now = new Date();
    const whiteSet = new Set<string>();

    data.forEach((r) => {
      if (r.color.toLowerCase().includes('branco')) {
        whiteSet.add(formatTime(new Date(r.timestamp)));
      }
    });

    const results = STRATEGIES.map(strat => {
      const targetMap = new Map<string, boolean>(); // key: formatTime, value: evaluated (used for deduplication)
      const currentSignals = Array(60).fill(0);

      for (let i = 0; i < data.length; i++) {
        const r = data[i];
        if (r.color.toLowerCase().includes('branco')) {
          const d = new Date(r.timestamp);
          const targets = strat.fn(data, i, d);

          targets.forEach(t => {
            if (t > now) {
              // Future target -> active signal for its minute
              currentSignals[t.getMinutes()]++;
            } else {
              // Past target -> evaluate for PG/SM/SA
              const tStr = formatTime(t);
              targetMap.set(tStr, true);
            }
          });
        }
      }

      // Evaluate chronological targets
      const sortedTargets = Array.from(targetMap.keys()).sort();
      let pg = 0;
      let maxMisses = 0;
      let currentMisses = 0;

      sortedTargets.forEach(tStr => {
        const isHit = whiteSet.has(tStr);
        if (isHit) {
          pg++;
          currentMisses = 0;
        } else {
          currentMisses++;
          if (currentMisses > maxMisses) maxMisses = currentMisses;
        }
      });

      return {
        name: strat.name,
        color: strat.color,
        pg,
        maxMisses,
        currentMisses,
        currentSignals
      };
    });

    // Calculate overall 'SINAIS' totals per minute
    const totalSignals = Array(60).fill(0);
    results.forEach(res => {
      for (let m = 0; m < 60; m++) {
        totalSignals[m] += res.currentSignals[m];
      }
    });

    return { results, totalSignals };
  }, [data]);

  if (loading || !engine) {
    return (
      <div className="flex h-screen items-center justify-center text-white bg-[#050505]">
        <div className="animate-pulse flex flex-col items-center">
          <Target className="w-12 h-12 text-blue-500 mb-4 animate-spin" />
          <p className="text-xl font-bold tracking-widest text-gray-400">ANALISANDO SINAIS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 overflow-x-hidden font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
              <BarChart2 className="w-8 h-8 text-[#6d8bcf]" />
              SINAIS <span className="text-[#6d8bcf]">AO VIVO</span>
            </h1>
            <p className="text-gray-400 mt-1 text-sm max-w-2xl">
              Validação de estratégias em tempo real. Os horários projetados são avaliados cronologicamente e deduplicados.
            </p>
          </div>
        </header>

        {/* Live History Card */}
        <section>
          <LiveHistoryCard data={[...data].reverse()} title="HISTÓRICO RECENTE" />
        </section>

        <section className="bg-[#0a0a0f] border border-white/5 rounded-lg p-4 shadow-xl">
        <div className="w-full overflow-auto max-h-[600px] rounded-md border border-white/10 custom-scrollbar">
          <table className="w-full text-center border-collapse text-xs font-bold">
            <thead className="sticky top-0 z-10 shadow-lg">
              {/* Main Headers */}
              <tr>
                <th className="p-3 border border-white/10 min-w-[60px] bg-[#1e293b] text-white tracking-wider">HORA</th>
                <th className="p-3 border border-white/10 min-w-[80px] bg-[#1e293b] text-white tracking-wider">SINAIS</th>
                {engine.results.map((res, idx) => (
                  <th key={idx} className="p-3 border border-white/10 min-w-[100px] uppercase bg-[#0f172a] text-gray-300 tracking-wider">
                    {res.name}
                  </th>
                ))}
              </tr>
              {/* Color Legend Row */}
              <tr>
                <th className="p-1 border border-white/10 bg-[#1e293b]"></th>
                <th className="p-1 border border-white/10 bg-[#800080]"></th>
                {engine.results.map((res, idx) => (
                  <th key={idx} className="p-1 border border-white/10" style={{ backgroundColor: res.color }}></th>
                ))}
              </tr>
              {/* PG Row */}
              <tr>
                <td className="p-2 border border-white/10 text-right font-black bg-[#0f172a] text-gray-400">PG</td>
                <td className="p-2 border border-white/10 bg-[#0f172a] text-gray-600">-</td>
                {engine.results.map((res, idx) => (
                  <td key={idx} className="p-2 border border-white/10 bg-[#0f172a] text-green-400 text-sm">
                    {res.pg}
                  </td>
                ))}
              </tr>
              {/* MAXIMA Row */}
              <tr>
                <td className="p-2 border border-white/10 text-right font-black bg-[#0f172a] text-gray-400">MÁXIMA</td>
                <td className="p-2 border border-white/10 bg-[#0f172a] text-gray-600">-</td>
                {engine.results.map((res, idx) => (
                  <td key={idx} className={`p-2 border border-white/10 text-sm ${res.maxMisses >= 10 ? 'bg-[#800080] text-white' : 'bg-[#0f172a] text-red-400'}`}>
                    {res.maxMisses}
                  </td>
                ))}
              </tr>
              {/* LOSS ATUAL Row */}
              <tr>
                <td className="p-2 border border-white/10 text-right font-black bg-[#0f172a] text-gray-400 border-b-2 border-b-white/20">
                  LOSS ATUAL
                </td>
                <td className="p-2 border border-white/10 bg-[#0f172a] text-gray-600 border-b-2 border-b-white/20">
                  -
                </td>
                {engine.results.map((res, idx) => (
                  <td key={idx} className={`p-2 border border-white/10 border-b-2 border-b-white/20 text-sm ${res.currentMisses >= 5 ? 'bg-[#800080] text-white' : 'bg-[#0f172a] text-red-500'}`}>
                    {res.currentMisses}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody className="bg-[#050505]">
              {Array.from({ length: 60 }).map((_, m) => {
                const total = engine.totalSignals[m];
                const isHot = total >= 2;
                
                return (
                  <tr key={m} className="hover:bg-white/5 transition-colors">
                    <td className="p-2 border border-white/10 bg-[#1e293b] text-gray-200 font-black">
                      {m.toString().padStart(2, '0')}
                    </td>
                    <td className={`p-2 border border-white/10 font-black ${isHot ? 'bg-[#FFCC00] text-black' : 'text-gray-500'}`}>
                      {total > 0 ? total : 0}
                    </td>
                    {engine.results.map((res, idx) => {
                      const val = res.currentSignals[m];
                      return (
                        <td key={idx} className={`p-2 border border-white/10 ${val === 0 ? 'text-gray-700 font-normal' : 'text-white font-black bg-white/10'}`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      </div>
    </div>
  );
}
