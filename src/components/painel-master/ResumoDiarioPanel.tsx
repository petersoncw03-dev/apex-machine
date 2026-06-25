import React, { useState, useMemo } from 'react';

interface Roll {
  color: string;
  roll: number;
  timestamp: string;
  id?: string;
}

interface ResumoDiarioPanelProps {
  globalData: Roll[];
}

const CARD = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#0062ff]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300';
const HEAD = 'px-5 py-3 bg-gradient-to-b from-[#0062ff]/10 to-transparent border-b border-[#0062ff]/20 flex justify-between items-center border-t-[3px] border-t-[#0062ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const SEL = 'bg-[#0b0e14] border border-white/10 text-white text-[10px] px-3 py-1.5 rounded-lg outline-none focus:border-[#0062ff] uppercase font-black tracking-widest hover:border-white/20 transition-colors cursor-pointer';

export default function ResumoDiarioPanel({ globalData }: ResumoDiarioPanelProps) {
  const [period, setPeriod] = useState<'hoje' | 'ontem' | '6h' | '12h'>('hoje');

  const stats = useMemo(() => {
    const nowMs = Date.now();
    const tz = 'America/Sao_Paulo';
    
    // Calcula a data alvo para 'hoje' ou 'ontem' no fuso do Brasil
    const getTzDate = (offsetDays = 0) => {
      const d = new Date(nowMs + offsetDays * 24 * 3600 * 1000);
      return d.toLocaleDateString('pt-BR', { timeZone: tz });
    };

    const targetDateStr = getTzDate(period === 'ontem' ? -1 : 0);

    const filteredData = globalData.filter(d => {
      const dMs = new Date(d.timestamp).getTime();
      if (period === '6h') {
        return nowMs - dMs <= 6 * 3600 * 1000;
      }
      if (period === '12h') {
        return nowMs - dMs <= 12 * 3600 * 1000;
      }
      // 'hoje' ou 'ontem'
      const dStr = new Date(d.timestamp).toLocaleDateString('pt-BR', { timeZone: tz });
      return dStr === targetDateStr;
    });

    let totalRodadas = filteredData.length;
    let brancos = 0;
    let pretos = 0;
    let vermelhos = 0;
    
    let currentWhiteDelay = 0;
    let maxWhiteDelay = 0;
    let recuperacoesCount = 0; // Delays >= 20
    let lastWhiteDate: Date | null = null;
    
    let redSeq = 0, maxRedSeq = 0;
    let blackSeq = 0, maxBlackSeq = 0;
    let whiteSeq = 0, maxWhiteSeq = 0;
    
    const minBrancos = Array(60).fill(0);
    const minReds = Array(60).fill(0);
    const minBlacks = Array(60).fill(0);
    
    const isW = (r: Roll) => r?.color?.toUpperCase() === 'BRANCO' || r?.color?.toUpperCase() === 'B' || Number(r?.roll) === 0;
    const isR = (r: Roll) => r?.color?.toUpperCase() === 'VERMELHO' || r?.color?.toUpperCase() === 'RED' || r?.color?.toUpperCase() === 'V' || (Number(r?.roll) >= 1 && Number(r?.roll) <= 7);
    const isB = (r: Roll) => r?.color?.toUpperCase() === 'PRETO' || r?.color?.toUpperCase() === 'BLACK' || r?.color?.toUpperCase() === 'P' || (Number(r?.roll) >= 8 && Number(r?.roll) <= 14);

    let sortedToday = [...filteredData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // A distância atual SEMPRE usa os dados mais recentes de globalData, não do filteredData (se for 'ontem', não faz muito sentido, mas ok)
    if (globalData.length > 0 && period !== 'ontem') {
       let currDelay = 0;
       for (let i = globalData.length - 1; i >= 0; i--) {
         if (isW(globalData[i])) break;
         currDelay++;
       }
       currentWhiteDelay = currDelay;
    }

    let delayCounter = 0;
    for (let i = 0; i < sortedToday.length; i++) {
      const roll = sortedToday[i];
      const d = new Date(roll.timestamp);
      const m = parseInt(d.toLocaleString('pt-BR', { timeZone: tz, minute: 'numeric' }), 10);
      
      if (isW(roll)) {
        brancos++;
        if (!isNaN(m)) minBrancos[m]++;
        
        if (delayCounter > maxWhiteDelay) maxWhiteDelay = delayCounter;
        if (delayCounter >= 20) recuperacoesCount++;
        delayCounter = 0;
        
        lastWhiteDate = d;
        
        whiteSeq++;
        redSeq = 0;
        blackSeq = 0;
        if (whiteSeq > maxWhiteSeq) maxWhiteSeq = whiteSeq;
      } else {
        delayCounter++;
        whiteSeq = 0;
        
        if (isR(roll)) {
          vermelhos++;
          if (!isNaN(m)) minReds[m]++;
          redSeq++;
          blackSeq = 0;
          if (redSeq > maxRedSeq) maxRedSeq = redSeq;
        } else if (isB(roll)) {
          pretos++;
          if (!isNaN(m)) minBlacks[m]++;
          blackSeq++;
          redSeq = 0;
          if (blackSeq > maxBlackSeq) maxBlackSeq = blackSeq;
        }
      }
    }
    
    // Atualiza maxWhiteDelay no final para considerar o atraso em andamento (se for 'hoje', '6h', '12h')
    if (period !== 'ontem' && delayCounter > maxWhiteDelay) {
      maxWhiteDelay = delayCounter;
    }
    if (period === 'ontem' && delayCounter > maxWhiteDelay) {
      maxWhiteDelay = delayCounter;
    }
    
    const mediaBrancos = brancos > 0 ? Math.floor(totalRodadas / brancos) : 0;
    
    const dom = Math.max(pretos, vermelhos);
    const domColor = pretos > vermelhos ? 'Preto' : (vermelhos > pretos ? 'Vermelho' : 'Empate');
    const domPct = totalRodadas > 0 ? ((dom / totalRodadas) * 100).toFixed(1) : '0';
    const otherPct = totalRodadas > 0 ? ((Math.min(pretos, vermelhos) / totalRodadas) * 100).toFixed(1) : '0';
    const tend = (parseFloat(domPct) - parseFloat(otherPct)).toFixed(1);
    const tendText = parseFloat(tend) > 10 ? 'Forte tendência' : (parseFloat(tend) > 3 ? 'Leve tendência' : 'Equilíbrio');

    const topBrancos = minBrancos.map((hits, min) => ({ min, hits, pct: brancos > 0 ? (hits/brancos)*100 : 0 })).sort((a,b) => b.hits - a.hits).slice(0, 5);
    const topReds = minReds.map((hits, min) => ({ min, hits })).sort((a,b) => b.hits - a.hits).slice(0, 3);
    const topBlacks = minBlacks.map((hits, min) => ({ min, hits })).sort((a,b) => b.hits - a.hits).slice(0, 3);

    return {
      totalRodadas, brancos, pretos, vermelhos,
      currentWhiteDelay, maxWhiteDelay, mediaBrancos, recuperacoesCount, lastWhiteDate,
      maxRedSeq, maxBlackSeq, maxWhiteSeq,
      domColor, domPct, tendText, tend,
      topBrancos, topReds, topBlacks
    }
  }, [globalData, period]);

  const getStatus = () => {
     if (stats.currentWhiteDelay < 10) return { text: 'Estável', color: 'text-emerald-500', bg: 'bg-[#10b981]/10', border: 'border-[#10b981]/20' };
     if (stats.currentWhiteDelay < 25) return { text: 'Atenção', color: 'text-amber-500', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/20' };
     return { text: 'Risco Elevado', color: 'text-rose-500', bg: 'bg-[#f43f5e]/10', border: 'border-[#f43f5e]/20' };
  };
  const status = getStatus();

  const getPeriodLabel = () => {
    switch (period) {
      case 'hoje': return 'Hoje';
      case 'ontem': return 'Ontem';
      case '6h': return 'Últimas 6 Horas';
      case '12h': return 'Últimas 12 Horas';
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto w-full pb-32">
      {/* Header */}
      <div className={`${CARD} p-5 flex flex-row items-center gap-4`}>
         <div className="w-12 h-12 rounded-xl bg-[#0062ff]/20 border border-[#0062ff]/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,98,255,0.3)] shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-[#0062ff]"><path d="M12 2a2 2 0 0 1 2 2c-.08.64-.17 1.25-.27 1.83.67.24 1.32.55 1.94.92l1.6-1.07a2 2 0 0 1 2.83.82l1.24 2.14a2 2 0 0 1-.5 2.6l-1.46 1.28c.12.63.18 1.27.18 1.93s-.06 1.3-.18 1.93l1.46 1.28a2 2 0 0 1 .5 2.6l-1.24 2.14a2 2 0 0 1-2.83.82l-1.6-1.07c-.62.37-1.27.68-1.94.92.1.58.19 1.19.27 1.83a2 2 0 0 1-2 2h-2.48a2 2 0 0 1-2-2c.08-.64.17-1.25.27-1.83-.67-.24-1.32-.55-1.94-.92l-1.6 1.07a2 2 0 0 1-2.83-.82L2.7 17.5a2 2 0 0 1 .5-2.6l1.46-1.28A9.87 9.87 0 0 1 4.48 12c0-.66.06-1.3.18-1.93L3.2 8.78a2 2 0 0 1-.5-2.6l1.24-2.14a2 2 0 0 1 2.83-.82l1.6 1.07c.62-.37 1.27-.68 1.94-.92-.1-.58-.19-1.19-.27-1.83a2 2 0 0 1 2-2h2.48Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
         </div>
         <div className="flex flex-col flex-1">
            <h1 className="text-xl font-black text-white tracking-wide">Resumo.AI Inteligente</h1>
            <span className="text-slate-400 text-xs font-medium">Análise de dados para: <strong className="text-white">{getPeriodLabel()}</strong></span>
         </div>
         
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Período:</span>
            <select className={SEL} value={period} onChange={(e: any) => setPeriod(e.target.value)}>
               <option value="hoje">Hoje</option>
               <option value="ontem">Ontem</option>
               <option value="6h">Últimas 6 Horas</option>
               <option value="12h">Últimas 12 Horas</option>
            </select>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         {/* Left Column */}
         <div className="xl:col-span-2 flex flex-col gap-6">
            
            {/* RESUMO INTELIGENTE */}
            <div className={CARD}>
               <div className={HEAD}>
                  <span className="text-[11px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M2 12h4l3-9 5 18 3-9h5"></path></svg>
                     Resumo Inteligente ({getPeriodLabel()})
                  </span>
               </div>
               <div className="p-5 flex flex-col gap-3">
                  <p className="text-[13px] text-slate-300 flex items-start gap-3">
                     <span className="text-blue-500 font-black mt-0.5">→</span>
                     <span>Tivemos <strong className="text-white">{stats.brancos} brancos</strong> em <strong className="text-white">{stats.totalRodadas} rodadas</strong>, com distância média de <strong className="text-white">{stats.mediaBrancos} rodadas</strong> entre cada.</span>
                  </p>
                  <p className="text-[13px] text-slate-300 flex items-start gap-3">
                     <span className="text-amber-500 font-black mt-0.5">→</span>
                     <span>Ocorreram <strong className="text-amber-400">{stats.recuperacoesCount} recuperações</strong> (períodos de 20+ rodadas sem branco). A mais longa durou {stats.maxWhiteDelay} rodadas.</span>
                  </p>
                  <p className="text-[13px] text-slate-300 flex items-start gap-3">
                     <span className="text-blue-500 font-black mt-0.5">→</span>
                     <span>A cor dominante é o <strong className="text-white">{stats.domColor}</strong> com {stats.domPct}%. Há uma {stats.tendText.toLowerCase()}.</span>
                  </p>
                  <p className="text-[13px] text-slate-300 flex items-start gap-3">
                     <span className="text-emerald-500 font-black mt-0.5">→</span>
                     <span>Minuto com mais brancos: <strong className="text-white">:{stats.topBrancos[0]?.min.toString().padStart(2,'0') || '00'}</strong> com {stats.topBrancos[0]?.pct.toFixed(1)}% de taxa.</span>
                  </p>
                  <p className="text-[13px] text-slate-300 flex items-start gap-3">
                     <span className="text-slate-500 font-black mt-0.5">→</span>
                     <span>Maiores sequências: Vermelho <strong className="text-rose-500">{stats.maxRedSeq}x</strong>, Preto <strong className="text-slate-200">{stats.maxBlackSeq}x</strong>, Branco <strong className="text-white">{stats.maxWhiteSeq}x</strong>.</span>
                  </p>
               </div>
            </div>

            {/* MAIORES SEQUÊNCIAS DO DIA */}
            <div className={CARD}>
               <div className={HEAD}>
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                     Maiores Sequências ({getPeriodLabel()})
                  </span>
               </div>
               <div className="p-5 grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#E51E3E]/10 to-transparent border border-[#E51E3E]/20 rounded-xl shadow-[inset_0_2px_15px_rgba(229,30,62,0.1)]">
                     <span className="text-3xl font-black text-[#E51E3E] drop-shadow-[0_0_10px_rgba(229,30,62,0.8)]">{stats.maxRedSeq}x</span>
                     <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-2">Vermelho</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#2C2F33]/40 to-transparent border border-white/10 rounded-xl shadow-[inset_0_2px_15px_rgba(255,255,255,0.05)]">
                     <span className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{stats.maxBlackSeq}x</span>
                     <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-2">Preto</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white/10 to-transparent border border-white/20 rounded-xl shadow-[inset_0_2px_15px_rgba(255,255,255,0.1)]">
                     <span className="text-3xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]">{stats.maxWhiteSeq}x</span>
                     <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-2">Branco</span>
                  </div>
               </div>
            </div>

         </div>

         {/* Right Column */}
         <div className="flex flex-col gap-4">
            
            <div className={`${CARD} p-4 flex flex-col gap-1`}>
               <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-white"></div> Brancos no Período</span>
               <span className="text-2xl font-black text-white mt-1">{stats.brancos}</span>
               <span className="text-[10px] text-slate-500 font-bold">{(stats.totalRodadas > 0 ? (stats.brancos / stats.totalRodadas) * 100 : 0).toFixed(1)}% • {stats.totalRodadas} rodadas</span>
            </div>

            {period !== 'ontem' && (
              <div className={`bg-[#0f141e]/80 backdrop-blur-xl border ${status.border} rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 flex flex-col gap-1 relative`}>
                 <div className={`absolute inset-0 ${status.bg} pointer-events-none`}></div>
                 <span className={`text-[10px] font-bold uppercase ${status.color} tracking-widest flex items-center gap-1.5 z-10`}><div className={`w-1.5 h-1.5 rounded-full ${status.color.replace('text-', 'bg-')}`}></div> Status Atual</span>
                 <span className={`text-lg font-black ${status.color} mt-1 z-10`}>{status.text}</span>
                 <span className="text-[10px] text-slate-400 font-bold z-10">{stats.currentWhiteDelay} sem branco</span>
              </div>
            )}

            <div className={`${CARD} p-4 flex flex-col gap-1`}>
               <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Dist. Média</span>
               <span className="text-2xl font-black text-white mt-1">{stats.mediaBrancos}</span>
               <span className="text-[10px] text-slate-500 font-bold">Máx {stats.maxWhiteDelay} rodadas</span>
            </div>

            <div className={`${CARD} p-4 flex flex-col gap-1`}>
               <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Recuperações</span>
               <span className="text-2xl font-black text-white mt-1">{stats.recuperacoesCount}</span>
               <span className="text-[10px] text-slate-500 font-bold">Máx {stats.maxWhiteDelay} rodadas</span>
            </div>

         </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
         
         {/* ANÁLISE DO BRANCO */}
         <div className={CARD}>
            <div className={HEAD}>
               <span className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
                  Análise do Branco
               </span>
            </div>
            <div className="p-0 flex flex-col">
               <div className="flex justify-between items-center p-4 border-b border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider">Último branco</span>
                  <span className="text-[12px] font-black text-white">{stats.lastWhiteDate ? stats.lastWhiteDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : '--:--:--'}</span>
               </div>
               {period !== 'ontem' && (
                 <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.02]">
                    <span className="text-[11px] font-bold text-slate-400 tracking-wider">Distância atual</span>
                    <span className="text-[12px] font-black text-white">{stats.currentWhiteDelay} rodadas</span>
                 </div>
               )}
               <div className="flex justify-between items-center p-4 border-b border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider">Média entre brancos</span>
                  <span className="text-[12px] font-black text-white">{stats.mediaBrancos} rodadas</span>
               </div>
               <div className="flex justify-between items-center p-4 bg-white/[0.02]">
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider">Maior distância do período</span>
                  <span className="text-[12px] font-black text-rose-500">{stats.maxWhiteDelay} rodadas</span>
               </div>
            </div>
         </div>

         {/* DOMINÂNCIA DO DIA */}
         <div className={CARD}>
            <div className={HEAD}>
               <span className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                  Dominância do Período
               </span>
            </div>
            <div className="p-6 flex flex-col gap-6">
               <div className="w-full h-4 rounded-full flex overflow-hidden shadow-inner bg-slate-800">
                  <div className="h-full bg-[#E51E3E]" style={{width: `${(stats.vermelhos/stats.totalRodadas)*100}%`}}></div>
                  <div className="h-full bg-slate-300" style={{width: `${(stats.brancos/stats.totalRodadas)*100}%`}}></div>
                  <div className="h-full bg-[#2C2F33]" style={{width: `${(stats.pretos/stats.totalRodadas)*100}%`}}></div>
               </div>
               <div className="flex justify-between gap-4">
                  <div className="flex-1 bg-[#E51E3E]/10 border border-[#E51E3E]/30 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                     <span className="text-lg font-black text-[#E51E3E]">{stats.vermelhos}</span>
                     <span className="text-[9px] font-bold text-slate-400">{(stats.totalRodadas>0?(stats.vermelhos/stats.totalRodadas)*100:0).toFixed(1)}%</span>
                  </div>
                  <div className="flex-1 bg-[#2C2F33]/50 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                     <span className="text-lg font-black text-white">{stats.pretos}</span>
                     <span className="text-[9px] font-bold text-slate-400">{(stats.totalRodadas>0?(stats.pretos/stats.totalRodadas)*100:0).toFixed(1)}%</span>
                  </div>
                  <div className="flex-1 bg-white/10 border border-white/20 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                     <span className="text-lg font-black text-blue-300">{stats.brancos}</span>
                     <span className="text-[9px] font-bold text-slate-400">{(stats.totalRodadas>0?(stats.brancos/stats.totalRodadas)*100:0).toFixed(1)}%</span>
                  </div>
               </div>
               <div className="flex justify-between items-center text-[12px] border-t border-white/10 pt-4 mt-2">
                  <span className="text-slate-400 font-bold">Cor dominante</span>
                  <span className="text-white font-black">{stats.domColor} ({stats.domPct}%)</span>
               </div>
               <div className="flex justify-between items-center text-[12px]">
                  <span className="text-slate-400 font-bold">Equilíbrio</span>
                  <span className="text-amber-400 font-black">{stats.tendText} ({stats.tend}%)</span>
               </div>
            </div>
         </div>

      </div>
      
      {/* ROW 3: MINUTOS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

         {/* MINUTOS QUENTES P/ BRANCO */}
         <div className={CARD}>
            <div className={HEAD}>
               <span className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Minutos Quentes P/ Branco
               </span>
            </div>
            <div className="p-5 flex flex-col gap-4 h-full">
               {stats.topBrancos.map((m, i) => (
                  <div key={i} className="flex items-center gap-4">
                     <div className="w-5 h-5 rounded-full bg-[#0062ff]/20 text-[#0062ff] text-[10px] font-black flex items-center justify-center shrink-0 border border-[#0062ff]/30">{i+1}</div>
                     <span className="text-[12px] font-black text-white w-6 shrink-0">:{m.min.toString().padStart(2,'0')}</span>
                     <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{width: `${(m.hits / (stats.topBrancos[0]?.hits || 1)) * 100}%`}}></div>
                     </div>
                     <span className="text-[10px] font-bold text-slate-400 w-24 text-right shrink-0">{m.hits} ({m.pct.toFixed(1)}%)</span>
                  </div>
               ))}
               {stats.topBrancos.length === 0 && (
                 <div className="flex items-center justify-center h-full">
                   <span className="text-slate-500 text-[11px] font-bold">Nenhum dado</span>
                 </div>
               )}
            </div>
         </div>

         {/* MINUTOS FORTES POR COR */}
         <div className={CARD}>
            <div className={HEAD}>
               <span className="text-[11px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-500"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                  Minutos Fortes Por Cor
               </span>
               <span className="text-[9px] font-bold text-slate-500 tracking-wider">Base: {stats.totalRodadas} rodadas</span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
               <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-[#E51E3E]"></div>
                     <span className="text-[11px] font-black text-[#E51E3E] uppercase tracking-widest">Vermelho</span>
                  </div>
                  {stats.topReds.map((m, i) => (
                     <div key={i} className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-white w-6 shrink-0">:{m.min.toString().padStart(2,'0')}</span>
                        <div className="flex-1 h-3 bg-slate-800 rounded-sm overflow-hidden">
                           <div className="h-full bg-[#E51E3E]" style={{width: `${(m.hits / (stats.topReds[0]?.hits || 1)) * 100}%`}}></div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 w-12 text-right shrink-0">{((m.hits/stats.vermelhos)*100 || 0).toFixed(1)}%</span>
                     </div>
                  ))}
               </div>
               
               <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                     <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Preto</span>
                  </div>
                  {stats.topBlacks.map((m, i) => (
                     <div key={i} className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-white w-6 shrink-0">:{m.min.toString().padStart(2,'0')}</span>
                        <div className="flex-1 h-3 bg-slate-800 rounded-sm overflow-hidden">
                           <div className="h-full bg-slate-300" style={{width: `${(m.hits / (stats.topBlacks[0]?.hits || 1)) * 100}%`}}></div>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 w-12 text-right shrink-0">{((m.hits/stats.pretos)*100 || 0).toFixed(1)}%</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>

      </div>

    </div>
  );
}

