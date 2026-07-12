'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useVip } from '@/hooks/useVip';
import { Target, Activity, Info, X } from 'lucide-react';
import { useSSE } from '@/contexts/SSEContext';

const MemoRow = React.memo(({
  r,
  intervalMins,
  daysInMonth,
  yCount,
  gridRow,
  saRow,
  smRow,
  modoAnalise,
  minTarget,
  selectedMonth,
  spDay,
  spMonth,
  isFutureFn
}: any) => {
  const h = Math.floor(r * intervalMins / 60);
  const m = (r * intervalMins) % 60;
  const timeStr = intervalMins === 60 ? `${h.toString().padStart(2, '0')}h` : `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  
  const getStyle = (cell: { total: number, short: number }, isFut: boolean, d: number, r: number) => {
     const isToday = d === spDay && selectedMonth === spMonth;
     const val = cell.total;
     let style = '';

     if (isFut) {
        style = 'text-white/5 font-black bg-[#12141c]/50'; 
     } else {
        if (val === 0) style = 'text-rose-500 font-black bg-rose-500/10 shadow-[inset_0_0_10px_rgba(244,63,94,0.1)]'; 
        else if (val >= minTarget) style = 'text-white font-black bg-emerald-500/30 shadow-[inset_0_0_15px_rgba(16,185,129,0.4)]'; 
        else if (val >= Math.ceil(minTarget / 2)) style = 'text-emerald-400 font-bold bg-emerald-500/10'; 
        else style = 'text-amber-400 font-medium bg-amber-500/5'; 
     }
     
     const past1 = d > 1 ? gridRow[d-1]?.short > 0 : false;
     const pastVal = d > 1 ? gridRow[d-1]?.total : 0;

     // Indicadores Preditivos no Futuro e Atuais
     if (modoAnalise === 'fogo') {
        if (!isFut && cell.short > 0) {
           style += ' border-[1px] border-amber-500 shadow-[inset_0_0_15px_rgba(245,158,11,0.5)] relative z-10';
        } else if (isFut && isToday && past1) {
           style += ' border border-amber-500/50 shadow-[inset_0_0_15px_rgba(245,158,11,0.2)] bg-amber-500/5 relative z-10 text-amber-500/30';
        }
     }
     
     if (modoAnalise === 'padrao' || modoAnalise === 'fogo') {
        if (isFut && isToday && pastVal >= minTarget) {
            style += ' border border-emerald-500/50 shadow-[inset_0_0_10px_rgba(16,185,129,0.2)] bg-emerald-500/5 relative z-10 text-emerald-500/30';
        }
     }

     return style;
  };

  return (
   <tr className="hover:bg-white/[0.02] transition-colors">
     <td className="py-2.5 px-2 border-b border-r border-white/5 text-[11px] font-black text-gray-300 bg-[#0a0a0f] sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)] tracking-wider">
       {timeStr}
     </td>
     <td className={`py-2.5 px-2 border-b border-r border-white/5 text-[12px] transition-colors ${getStyle(yCount, false, 0, r)}`}>
       {yCount.total || '-'}
     </td>
     {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
       const cell = gridRow[d] || { total: 0, short: 0 };
       const isFut = isFutureFn(d, r);
       const isToday = d === spDay && selectedMonth === spMonth;
       const displayVal = cell.total;
       const past1 = d > 1 ? gridRow[d-1]?.short > 0 : false;
       return (
         <td key={d} className={`py-2.5 px-1.5 border-b border-r border-white/5 text-[12px] ${getStyle(cell, isFut, d, r)} transition-all duration-300 hover:brightness-125 ${isToday && displayVal === 0 && !isFut ? 'bg-amber-500/5' : ''}`}>
           {isFut ? '-' : (displayVal > 0 ? displayVal : '-')}
           {modoAnalise === 'fogo' && !isFut && cell.short > 0 && <span className="absolute -top-1 -right-1 text-[10px]">🔥</span>}
           {modoAnalise === 'fogo' && isFut && isToday && past1 && <span className="absolute -top-1 -right-1 text-[10px] opacity-60">🔥</span>}
         </td>
       );
     })}
     <td className="py-2.5 px-3 border-b border-white/5 text-[11px] font-black bg-[#0a0a0f] sticky right-0 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-center gap-2">
          <span className="text-rose-400 w-4 text-center">{saRow}</span>
          <span className="text-gray-600">|</span>
          <span className="text-amber-400 w-4 text-center">{smRow}</span>
        </div>
     </td>
   </tr>
  );
}, (prev, next) => {
   if (prev.intervalMins !== next.intervalMins) return false;
   if (prev.daysInMonth !== next.daysInMonth) return false;
   if (prev.modoAnalise !== next.modoAnalise) return false;
   if (prev.minTarget !== next.minTarget) return false;
   if (prev.selectedMonth !== next.selectedMonth) return false;
   if (prev.spDay !== next.spDay) return false;
   if (prev.spMonth !== next.spMonth) return false;
   if (prev.saRow !== next.saRow) return false;
   if (prev.smRow !== next.smRow) return false;
   
   // A isFutureFn vai invalidar se spHour ou spMin mudarem e afetarem a linha.
   // Como a função muda a cada 1 min, só re-renderiza as linhas próximas ao tempo atual para economizar CPU.
   if (prev.isFutureFn !== next.isFutureFn) return false;

   for (let d = 1; d <= prev.daysInMonth; d++) {
      if (prev.gridRow[d]?.total !== next.gridRow[d]?.total) return false;
      if (prev.gridRow[d]?.short !== next.gridRow[d]?.short) return false;
   }
   return true;
});

export default function MensalAvancadoPage() {
  const { isVip } = useVip();
  const { latestRoll } = useSSE();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  
  const now = new Date();
  const spNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const [selectedMonth, setSelectedMonth] = useState(spNow.getMonth());
  const [selectedYear, setSelectedYear] = useState(spNow.getFullYear());

  const [intervalMins, setIntervalMins] = useState<60 | 30 | 20 | 15 | 10>(60);
  const [minTarget, setMinTarget] = useState<number>(10);
  const [modoAnalise, setModoAnalise] = useState<'padrao' | 'fogo'>('padrao');
  const [maxEspacoCurto, setMaxEspacoCurto] = useState<number>(5);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/results/period?hours=1080&onlyWhites=true`);
        if (res.ok) {
          const json = await res.json();
          setData(Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!latestRoll) return;
    const isW = latestRoll.color?.toUpperCase() === 'BRANCO' || latestRoll.color?.toUpperCase() === 'B' || Number(latestRoll.roll) === 0;
    if (isW) {
      setData(prev => {
        const last = prev[prev.length - 1];
        if (last && new Date(last.timestamp).getTime() === new Date(latestRoll.timestamp).getTime()) {
          return prev;
        }
        return [...prev, latestRoll];
      });
    }
  }, [latestRoll]);

  const { grid, daysInMonth, yesterdayStats, saColumns, smColumns, saRows, smRows, globalSa, globalSm, isFuture } = useMemo(() => {
    const days = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const rowsCount = Math.floor(24 * 60 / intervalMins);
    
    // Initialize grid
    const g: Record<number, Record<number, { total: number, short: number }>> = {};
    for (let r = 0; r < rowsCount; r++) {
      g[r] = {};
      for (let d = 1; d <= days; d++) g[r][d] = { total: 0, short: 0 };
    }
    
    const yStats: Record<number, { total: number, short: number }> = {};
    for (let r = 0; r < rowsCount; r++) yStats[r] = { total: 0, short: 0 };

    const yDate = new Date(spNow);
    yDate.setDate(yDate.getDate() - 1);
    const yDay = yDate.getDate();
    const yMonth = yDate.getMonth();
    const yYear = yDate.getFullYear();

    const sortedData = [...data].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let lastWhiteGlobal = 0;

    for (const roll of sortedData) {
      if (!roll.timestamp) continue;
      const dt = new Date(roll.timestamp);
      const spDate = new Date(dt.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      
      const rMonth = spDate.getMonth();
      const rYear = spDate.getFullYear();
      const d = spDate.getDate();
      const h = spDate.getHours();
      const m = spDate.getMinutes();
      const rIdx = h * Math.floor(60 / intervalMins) + Math.floor(m / intervalMins);

      const rollTime = dt.getTime();
      let isShort = false;
      if (lastWhiteGlobal > 0) {
         const diffMins = (rollTime - lastWhiteGlobal) / 60000;
         if (diffMins <= maxEspacoCurto) {
            isShort = true;
         }
      }
      lastWhiteGlobal = rollTime;

      if (rMonth === selectedMonth && rYear === selectedYear) {
        if (g[rIdx] && g[rIdx][d] !== undefined) {
          g[rIdx][d].total++;
          if (isShort) g[rIdx][d].short++;
        }
      }
      
      if (rMonth === yMonth && rYear === yYear && d === yDay) {
         if (yStats[rIdx] !== undefined) {
             yStats[rIdx].total++;
             if (isShort) yStats[rIdx].short++;
         }
      }
    }

    const isFuture = (d: number, r: number) => {
       if (selectedYear > spNow.getFullYear()) return true;
       if (selectedYear < spNow.getFullYear()) return false;
       if (selectedMonth > spNow.getMonth()) return true;
       if (selectedMonth < spNow.getMonth()) return false;
       if (d > spNow.getDate()) return true;
       if (d < spNow.getDate()) return false;
       const h = Math.floor(r * intervalMins / 60);
       const m = (r * intervalMins) % 60;
       if (spNow.getHours() < h) return true;
       if (spNow.getHours() === h && spNow.getMinutes() < m) return true;
       return false;
    };

    const saCols: Record<number, number> = {};
    const smCols: Record<number, number> = {};
    for (let d = 1; d <= days; d++) { saCols[d] = 0; smCols[d] = 0; }
    
    const saRs: Record<number, number> = {};
    const smRs: Record<number, number> = {};
    for (let r = 0; r < rowsCount; r++) { saRs[r] = 0; smRs[r] = 0; }

    let gSa = 0;
    let gSm = 0;

    const checkWin = (cell: { total: number, short: number }) => {
       return cell.total >= minTarget;
    };

    // Horizontal (Rows/Months)
    for (let r = 0; r < rowsCount; r++) {
       let currentSa = 0;
       let maxSm = 0;
       for (let d = 1; d <= days; d++) {
          if (isFuture(d, r)) break;
          if (checkWin(g[r][d])) {
             currentSa = 0;
          } else {
             currentSa++;
             if (currentSa > maxSm) maxSm = currentSa;
          }
       }
       saRs[r] = currentSa;
       smRs[r] = maxSm;
    }

    // Vertical (Cols/Days)
    for (let d = 1; d <= days; d++) {
       let currentSa = 0;
       let maxSm = 0;
       for (let r = 0; r < rowsCount; r++) {
          if (isFuture(d, r)) break;
          if (checkWin(g[r][d])) {
             currentSa = 0;
          } else {
             currentSa++;
             if (currentSa > maxSm) maxSm = currentSa;
          }
       }
       saCols[d] = currentSa;
       smCols[d] = maxSm;
    }

    // Sequential (Global)
    for (let d = 1; d <= days; d++) {
       let breakOuter = false;
       for (let r = 0; r < rowsCount; r++) {
          if (isFuture(d, r)) {
             breakOuter = true;
             break;
          }
          if (checkWin(g[r][d])) {
             gSa = 0;
          } else {
             gSa++;
             if (gSa > gSm) gSm = gSa;
          }
       }
       if (breakOuter) break;
    }

    return { grid: g, daysInMonth: days, yesterdayStats: yStats, saColumns: saCols, smColumns: smCols, saRows: saRs, smRows: smRs, globalSa: gSa, globalSm: gSm, isFuture };
  }, [data, selectedMonth, selectedYear, intervalMins, minTarget, spNow.getMinutes(), spNow.getHours(), spNow.getDate(), modoAnalise, maxEspacoCurto]);

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <main className="min-h-screen p-2 md:p-4 max-w-full w-full mx-auto flex flex-col gap-4 bg-[#030303] animate-fade-in">
       <div className="max-w-full mx-auto flex flex-col gap-4 w-full h-full min-h-[90vh]">
         {/* Top Section */}
         <section className="flex flex-wrap justify-between items-center bg-[#0a0a0f] p-4 rounded-lg border border-white/5 shadow-2xl gap-4">
            <div className="flex flex-col">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 flex items-center gap-3">
                <Target className="text-emerald-500" />
                Mensal Avançado
              </h2>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Stress Test Temporal</span>
            </div>
            
            <button onClick={() => setShowGuide(true)} className="flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all">
               <Info className="w-4 h-4" />
               Como Usar
            </button>

            {/* Global Scoreboard */}
            <div className="flex items-center gap-6 bg-[#12141c] px-4 py-2 rounded-lg border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] shrink-0">
               <div className="flex flex-col items-center">
                 <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">SA Global</span>
                 <span className="text-lg font-black text-rose-500 leading-none">{globalSa}</span>
               </div>
               <div className="w-[1px] h-8 bg-white/10"></div>
               <div className="flex flex-col items-center">
                 <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">SM Global</span>
                 <span className="text-lg font-black text-amber-500 leading-none">{globalSm}</span>
               </div>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              {!isVip && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest bg-amber-500/10 px-3 py-1.5 rounded border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]">Exclusivo VIP</span>}
              
              <div className="flex flex-col gap-1">
                 <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Alvo Min</label>
                 <input 
                    type="number"
                    min="1"
                    className="bg-[#12141c] border border-white/10 text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-emerald-500 uppercase font-black transition-colors w-20 text-center"
                    value={minTarget}
                    onChange={e => setMinTarget(Number(e.target.value) || 1)}
                 />
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Fração</label>
                 <select 
                    className="bg-[#12141c] border border-white/10 text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-emerald-500 uppercase font-black transition-colors cursor-pointer"
                    value={intervalMins}
                    onChange={e => setIntervalMins(Number(e.target.value) as any)}
                 >
                    <option value={60}>1 Hora</option>
                    <option value={30}>30 Min</option>
                    <option value={20}>20 Min</option>
                    <option value={15}>15 Min</option>
                    <option value={10}>10 Min</option>
                 </select>
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Mês</label>
                 <select 
                   className="bg-[#12141c] border border-white/10 text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-emerald-500 uppercase font-black transition-colors cursor-pointer"
                   value={selectedMonth}
                   onChange={e => setSelectedMonth(+e.target.value)}
                 >
                   {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                 </select>
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Ano</label>
                 <select 
                   className="bg-[#12141c] border border-white/10 text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-emerald-500 uppercase font-black transition-colors cursor-pointer"
                   value={selectedYear}
                   onChange={e => setSelectedYear(+e.target.value)}
                 >
                   <option value={spNow.getFullYear()}>{spNow.getFullYear()}</option>
                   <option value={spNow.getFullYear() - 1}>{spNow.getFullYear() - 1}</option>
                 </select>
              </div>
            </div>

            {/* Modo Toggles */}
            <div className="w-full flex items-center gap-2 mt-2 overflow-x-auto pb-2 custom-scrollbar border-t border-white/5 pt-4">
                <button onClick={() => setModoAnalise('padrao')} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest border transition-all whitespace-nowrap ${modoAnalise === 'padrao' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-[#12141c] text-gray-500 border-white/5 hover:bg-white/5'}`}>
                   Visão Padrão
                </button>
                <button onClick={() => {
                   setModoAnalise('fogo');
                   setIntervalMins(10);
                   setMinTarget(2);
                   setMaxEspacoCurto(2);
                }} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest border transition-all whitespace-nowrap ${modoAnalise === 'fogo' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-[#12141c] text-gray-500 border-white/5 hover:bg-white/5'}`}>
                   Caçador de Devedor
                </button>

                {(modoAnalise !== 'padrao') && (
                  <div className="flex items-center gap-2 ml-4">
                     <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Espaço Máx:</span>
                     <input 
                        type="number"
                        min="1"
                        className="bg-[#12141c] border border-rose-500/30 text-rose-400 text-xs px-2 py-1.5 rounded outline-none focus:border-rose-500 font-black w-14 text-center shadow-[0_0_10px_rgba(244,63,94,0.1)]"
                        value={maxEspacoCurto}
                        onChange={e => setMaxEspacoCurto(Number(e.target.value) || 5)}
                     />
                     <span className="text-[9px] text-gray-500 font-bold">MIN</span>
                  </div>
                )}
            </div>
         </section>

         {/* Content Table */}
         <section className="bg-[#0a0a0f] rounded-xl border border-white/5 overflow-hidden flex flex-col shadow-2xl flex-1 relative min-h-[500px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/80 backdrop-blur-sm z-50">
                 <div className="flex flex-col items-center gap-4">
                   <Activity className="animate-spin text-emerald-500 w-10 h-10" />
                   <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">Sincronizando Matriz...</span>
                 </div>
              </div>
            ) : null}

            <div className="overflow-auto custom-scrollbar flex-1 relative">
              <table className="w-full text-center border-collapse min-w-max">
                <thead className="sticky top-0 z-20 bg-[#12141c] shadow-lg">
                  <tr>
                    <th className="py-2 px-2 border-b border-r border-white/5 text-[10px] font-black uppercase text-gray-500 tracking-widest bg-[#0a0a0f] sticky left-0 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.3)] min-w-[60px]">
                      Horas
                    </th>
                    <th className="py-2 px-2 border-b border-r border-emerald-500/20 text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 text-emerald-400 min-w-[50px]" title="Quantidade de brancos que caiu ontem neste mesmo horário">
                      Ontem
                    </th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                      <th key={d} className={`py-2 px-1 border-b border-r border-white/5 text-[10px] font-black uppercase bg-[#12141c] ${d === spNow.getDate() && selectedMonth === spNow.getMonth() ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300'}`}>
                        <div className="flex flex-col items-center gap-1">
                           <span>D{d}</span>
                           <div className="flex gap-1.5 text-[8.5px] font-black opacity-90 px-1 py-0.5 rounded bg-[#0a0a0f] border border-white/5 shadow-inner">
                             <span className="text-rose-400" title="SA da Coluna">{saColumns[d]}</span>
                             <span className="text-gray-600">|</span>
                             <span className="text-amber-400" title="SM da Coluna">{smColumns[d]}</span>
                           </div>
                        </div>
                      </th>
                    ))}
                    <th className="py-2 px-3 border-b border-white/5 text-[10px] font-black uppercase tracking-widest bg-[#0a0a0f] sticky right-0 z-30 shadow-[-2px_0_5px_rgba(0,0,0,0.3)] min-w-[60px]">
                       <div className="flex flex-col items-center gap-1">
                          <span className="text-purple-400">Linha</span>
                          <div className="flex gap-1.5 text-[8.5px] font-black opacity-90 px-1 py-0.5 rounded bg-black/40">
                             <span className="text-rose-400">SA</span>
                             <span className="text-gray-600">|</span>
                             <span className="text-amber-400">SM</span>
                           </div>
                       </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm font-bold">
                  {Array.from({ length: 24 * 60 / intervalMins }, (_, r) => (
                      <MemoRow 
                        key={r}
                        r={r}
                        intervalMins={intervalMins}
                        daysInMonth={daysInMonth}
                        yCount={yesterdayStats[r]}
                        gridRow={grid[r]}
                        saRow={saRows[r]}
                        smRow={smRows[r]}
                        modoAnalise={modoAnalise}
                        minTarget={minTarget}
                        selectedMonth={selectedMonth}
                        spDay={spNow.getDate()}
                        spMonth={spNow.getMonth()}
                        isFutureFn={isFuture}
                      />
                  ))}
                </tbody>
              </table>
            </div>
         </section>
       </div>

       {showGuide && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030303]/90 backdrop-blur-sm animate-fade-in p-4">
           <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
             <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#12141c]">
               <h3 className="text-lg font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                 <Info className="w-5 h-5" /> Guia de Operação
               </h3>
               <button onClick={() => setShowGuide(false)} className="text-gray-500 hover:text-white transition-colors">
                 <X className="w-6 h-6" />
               </button>
             </div>
             <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 text-sm text-gray-300">
               <div>
                 <h4 className="font-black text-white text-md uppercase tracking-widest mb-2 border-l-2 border-emerald-500 pl-2">Visão Padrão</h4>
                 <p>Mostra todos os brancos de um horário. <b>Quando usar:</b> Excelente para mapear as janelas "gordas" do algoritmo. Se uma coluna inteira (Dia) está verde, o dia foi pagador.</p>
               </div>
               <div>
                 <h4 className="font-black text-amber-400 text-md uppercase tracking-widest mb-2 border-l-2 border-amber-500 pl-2">Caçador de Devedor 🔥</h4>
                 <p>Focado em encontrar janelas onde a casa está "devendo" e paga brancos próximos um do outro (brancos curtos como: duplo, dentado, banguelo e banguelão). <b>Como Operar:</b> O sistema acende um "Fogo" nos horários onde ocorreram essas recuperações rápidas. Ao operar em um horário futuro que teve fogo no dia anterior (marcado com borda laranja preditiva), você aumenta exponencialmente a chance matemática de surfar uma sequência de brancos curtos.</p>
               </div>
             </div>
             <div className="p-4 border-t border-white/5 bg-[#12141c] flex justify-end">
               <button onClick={() => setShowGuide(false)} className="bg-emerald-500 text-black px-6 py-2 rounded-lg font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors">
                 Entendi
               </button>
             </div>
           </div>
         </div>
       )}
    </main>
  );
}
