import React, { useMemo, useState } from 'react';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';

interface Roll {
  color: string;
  roll: number;
  timestamp: string;
}

interface SmaBrancosTabProps {
  globalData: Roll[];
}

export default function SmaBrancosTab({ globalData }: SmaBrancosTabProps) {
  const [lookbackHours, setLookbackHours] = useState<number>(6);

  const stats = useMemo(() => {
    if (!globalData || globalData.length < 2) return null;

    const latestTime = new Date(globalData[globalData.length - 1].timestamp).getTime();
    const cutoffTime = latestTime - lookbackHours * 3600000;

    const whites = globalData
      .filter(r => r.roll === 0 && new Date(r.timestamp).getTime() >= cutoffTime)
      .map(r => ({ ...r, time: new Date(r.timestamp).getTime() }));

    if (whites.length < 2) return null;

    let totalDelay = 0;
    const delays: { current: number, previous: number, delayMins: number, dateStr: string }[] = [];

    for (let i = 1; i < whites.length; i++) {
      const delayMs = whites[i].time - whites[i - 1].time;
      const delayMins = Math.round(delayMs / 60000);
      totalDelay += delayMins;
      
      const dateStr = new Date(whites[i].time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      delays.push({ current: whites[i].time, previous: whites[i - 1].time, delayMins, dateStr });
    }

    // Sort descending for list
    delays.reverse();

    const sma = Math.round(totalDelay / (whites.length - 1));

    // Distribution
    const dist = { under: 0, exactly: 0, over: 0 };
    delays.forEach(d => {
      if (d.delayMins < sma) dist.under++;
      else if (d.delayMins === sma) dist.exactly++;
      else dist.over++;
    });

    const currentDelayMs = latestTime - whites[whites.length - 1].time;
    const currentDelayMins = Math.floor(currentDelayMs / 60000);

    return {
      sma,
      totalWhites: whites.length,
      delays,
      dist,
      currentDelayMins,
      lastWhiteTime: whites[whites.length - 1].time
    };
  }, [globalData, lookbackHours]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Dados insuficientes para calcular o SMA no período selecionado.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── HEADER & CONTROLS ── */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-[#0b0e14]/80 p-5 rounded-xl border border-white/5 shadow-lg">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-cyan-400">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            SMA Dinâmico de Brancos
          </h2>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Média Móvel de Distanciamento</p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Analisar Últimas:</span>
          <select 
            className="bg-[#131722] border border-white/10 rounded-lg px-4 py-2 text-xs font-black text-white outline-none cursor-pointer hover:border-cyan-500/50 transition-colors"
            value={lookbackHours}
            onChange={(e) => setLookbackHours(Number(e.target.value))}
          >
            <option value={3}>3 Horas</option>
            <option value={6}>6 Horas</option>
            <option value={12}>12 Horas</option>
            <option value={24}>24 Horas</option>
          </select>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#0b0e14] to-[#131722] p-5 rounded-xl border border-white/5 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Média SMA Atual</div>
          <div className="text-4xl font-black text-white drop-shadow-md">
            {stats.sma} <span className="text-lg text-cyan-500">min</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0b0e14] to-[#131722] p-5 rounded-xl border border-white/5 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Brancos no Período</div>
          <div className="text-4xl font-black text-white drop-shadow-md">
            {stats.totalWhites}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0b0e14] to-[#131722] p-5 rounded-xl border border-white/5 shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Atraso Atual</div>
          <div className="flex items-baseline gap-2">
            <div className={`text-4xl font-black drop-shadow-md ${stats.currentDelayMins > stats.sma ? 'text-amber-400' : 'text-emerald-400'}`}>
              {stats.currentDelayMins} <span className="text-lg text-white/50">min</span>
            </div>
          </div>
          <div className="text-[9px] mt-1 text-slate-500 uppercase tracking-widest">
            {stats.currentDelayMins > stats.sma ? 'Acima da média' : 'Abaixo da média'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0b0e14] to-[#131722] p-5 rounded-xl border border-white/5 shadow-lg flex flex-col justify-center">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Distribuição</div>
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-emerald-400">Rápido:</span>
            <span className="text-white">{stats.dist.under}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold mt-1">
            <span className="text-cyan-400">Exato:</span>
            <span className="text-white">{stats.dist.exactly}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold mt-1">
            <span className="text-amber-400">Longo:</span>
            <span className="text-white">{stats.dist.over}</span>
          </div>
        </div>
      </div>

      {/* ── HISTORY LIST ── */}
      <div className="bg-[#0b0e14]/80 p-5 rounded-xl border border-white/5 shadow-lg flex-1 min-h-[300px] flex flex-col">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div> Histórico Recente de Distanciamento
        </h3>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="flex flex-col gap-2">
            {stats.delays.map((d, i) => {
              const diff = d.delayMins - stats.sma;
              let barColor = 'bg-cyan-500';
              let badgeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
              
              if (diff < -2) {
                barColor = 'bg-emerald-500';
                badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              } else if (diff > 2) {
                barColor = 'bg-amber-500';
                badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
              }

              // Normaliza o tamanho da barra para caber na tela (max 60 min visual = 100%)
              const widthPerc = Math.min(100, Math.max(2, (d.delayMins / 60) * 100));

              return (
                <div key={i} className="flex items-center gap-4 bg-[#131722] p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                  <div className="w-12 text-center text-xs font-black text-slate-400">{d.dateStr}</div>
                  <GlobalStoneIcon n={0} size="md" />
                  
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 bg-black/40 h-2 rounded-full overflow-hidden relative">
                      <div 
                        className={`absolute left-0 top-0 bottom-0 ${barColor} rounded-full opacity-80`} 
                        style={{ width: `${widthPerc}%` }}
                      ></div>
                      {/* SMA Marker */}
                      <div 
                        className="absolute top-0 bottom-0 w-px bg-white/50 z-10" 
                        style={{ left: `${Math.min(100, (stats.sma / 60) * 100)}%` }}
                        title="SMA"
                      ></div>
                    </div>
                  </div>

                  <div className={`w-20 text-center text-[11px] font-black uppercase tracking-wider py-1 border rounded-md ${badgeColor}`}>
                    {d.delayMins} min
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
