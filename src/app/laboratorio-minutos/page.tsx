"use client";
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSSE } from '@/contexts/SSEContext';

interface Roll {
  id?: string;
  server_seed?: string;
  color: string;
  roll: number;
  timestamp: string;
}

const CARD_GREEN = 'bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300';
const HEAD_GREEN = 'px-5 py-4 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const INPUT_STYLE = 'bg-[#0b0e14] border border-white/10 text-white text-[11px] px-3 py-2 rounded-lg outline-none focus:border-[#00c83a] w-24 text-center font-mono';

export default function LaboratorioMinutos() {
  const [globalData, setGlobalData] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings for Cruzamento
  const [cruzJanela, setCruzJanela] = useState(4);
  const [cruzWrLinha, setCruzWrLinha] = useState(10);
  const [cruzWrColuna, setCruzWrColuna] = useState(15);
  
  // Settings for Tendência (WR)
  const [tendHoras, setTendHoras] = useState(4);
  const [tendWr, setTendWr] = useState(50);

  // General Settings
  const [backtestDays, setBacktestDays] = useState(2); // 48 hours

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch(`/api/results/period?hours=${backtestDays * 24}`)
      .then(r => r.json())
      .then(res => {
        const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        if (isMounted) {
          setGlobalData(arr);
          setLoading(false);
        }
      })
      .catch(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [backtestDays]);

  const { subscribe } = useSSE();
  useEffect(() => {
    const unsub = subscribe((newRoll) => {
      const mappedRoll = { ...newRoll, roll: Number(newRoll.roll) };
      setGlobalData(prev => {
        if (mappedRoll.id && prev.some(r => r.id === mappedRoll.id)) return prev;
        if (!mappedRoll.id && prev.some(r => r.timestamp === mappedRoll.timestamp && r.roll === mappedRoll.roll)) return prev;
        return [...prev, mappedRoll];
      });
    });
    return unsub;
  }, [subscribe]);

  const stats = useMemo(() => {
    if (!globalData || globalData.length === 0) return null;

    const latestTime = new Date(globalData[globalData.length - 1].timestamp).getTime();
    const whiteTimes = globalData.filter(r => r.roll === 0).map(r => new Date(r.timestamp).getTime());

    const now = new Date(latestTime);
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
    const allCycles: { m: number, targetTime: number, hit: boolean }[] = [];

    for (let h = 0; h < 24; h++) {
        const hourTime = currentHour - h * 3600000;
        if (hourTime < new Date(globalData[0].timestamp).getTime() - Math.max(cruzJanela, tendHoras) * 3600000) break;

        for (let m = 0; m < 60; m++) {
            const targetTime = hourTime + m * 60000;
            if (targetTime > latestTime) continue; 
            const hit = whiteTimes.some(wt => wt >= targetTime - 60000 && wt < targetTime + 120000);
            allCycles.push({ m, targetTime, hit });
        }
    }

    allCycles.sort((a, b) => a.targetTime - b.targetTime);
    
    const cruzStats = { wins: 0, total: 0, currentSA: 0, maxSA: 0 };
    const tendStats = { wins: 0, total: 0, currentSA: 0, maxSA: 0 };

    for (const cycle of allCycles) {
        // --- CRUZAMENTO ---
        const cJanela = cycle.targetTime - cruzJanela * 3600000;
        let rCount = 0;
        let cCount = 0;
        const row = Math.floor(cycle.m / 10);
        const col = cycle.m % 10;
        
        // --- TENDÊNCIA (WR) ---
        const tJanela = cycle.targetTime - tendHoras * 3600000;
        let hitsInTend = 0;

        for (const wt of whiteTimes) {
            const wm = new Date(wt).getMinutes();
            
            if (wt >= cJanela && wt < cycle.targetTime) {
                if (Math.floor(wm / 10) === row) rCount++;
                if (wm % 10 === col) cCount++;
            }
            
            if (wt >= tJanela && wt < cycle.targetTime) {
                if (wm === cycle.m) {
                    // It hit during that minute's window? The old cycle logic:
                    // Actually, to know if minute M hit in the past, we check if there's a white between [targetTime - 60s, targetTime + 120s] for past hours.
                    // For simplicity, we just check if a white fell exactly on minute M.
                    hitsInTend++;
                }
            }
        }
        
        // Signal Cruzamento: Linha WR >= input e Coluna WR >= input
        const rWr = (rCount / (10 * cruzJanela)) * 100;
        const cWr = (cCount / (6 * cruzJanela)) * 100;
        if (rWr >= cruzWrLinha && cWr >= cruzWrColuna) {
            cruzStats.total++;
            if (cycle.hit) { cruzStats.wins++; cruzStats.currentSA = 0; }
            else { cruzStats.currentSA++; if (cruzStats.currentSA > cruzStats.maxSA) cruzStats.maxSA = cruzStats.currentSA; }
        }
        
        // Signal Tendência: WR% >= Input
        const winRatePast = (hitsInTend / tendHoras) * 100;
        if (winRatePast >= tendWr) {
            tendStats.total++;
            if (cycle.hit) { tendStats.wins++; tendStats.currentSA = 0; }
            else { tendStats.currentSA++; if (tendStats.currentSA > tendStats.maxSA) tendStats.maxSA = tendStats.currentSA; }
        }
    }

    return { cruzStats, tendStats };
  }, [globalData, cruzJanela, cruzWrLinha, cruzWrColuna, tendHoras, tendWr]);

  return (
    <div className="min-h-screen bg-[#050507] p-8 font-sans flex flex-col gap-8">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/painel-master" className="text-[#00c83a] hover:text-[#00ff4a] text-sm font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
            <span>← VOLTAR</span>
          </Link>
          <div className="w-px h-6 bg-white/10"></div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)] animate-pulse"></div>
              Laboratório Dinâmico
            </h1>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">
              Gatilho Fixo: 6 Entradas (2 Antes, 2 no Minuto, 2 Depois)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Amostra (Dias)</span>
            <input type="number" min="1" max="7" value={backtestDays} onChange={e => setBacktestDays(Number(e.target.value))} className={INPUT_STYLE} />
          </div>
          {loading && <span className="text-xs text-cyan-500 animate-pulse font-mono uppercase tracking-widest">Processando Motor IA...</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* CARD CRUZAMENTO */}
        <div className={CARD_GREEN}>
          <div className={HEAD_GREEN}>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-black uppercase tracking-widest text-white">Cruzamento Linha x Coluna</span>
            </div>
          </div>
          <div className="p-6 bg-[#0b0e14]/40 flex flex-col gap-8 border-b border-white/5">
            <div className="flex items-center gap-6">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Janela (Horas)</span>
                <input type="number" min="1" max="24" value={cruzJanela} onChange={e => setCruzJanela(Number(e.target.value))} className={`${INPUT_STYLE} w-full`} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WR Linha (%)</span>
                <input type="number" min="1" max="100" value={cruzWrLinha} onChange={e => setCruzWrLinha(Number(e.target.value))} className={`${INPUT_STYLE} w-full`} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WR Coluna (%)</span>
                <input type="number" min="1" max="100" value={cruzWrColuna} onChange={e => setCruzWrColuna(Number(e.target.value))} className={`${INPUT_STYLE} w-full`} />
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Sinais Enviados</span>
              <span className="text-2xl font-black text-white">{stats?.cruzStats.total || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Win Rate (%)</span>
              <span className={`text-2xl font-black ${(stats?.cruzStats.total || 0) > 0 ? (((stats?.cruzStats.wins || 0) / (stats?.cruzStats.total || 1)) * 100) >= 50 ? 'text-emerald-400' : 'text-rose-400' : 'text-slate-600'}`}>
                {stats?.cruzStats.total ? (((stats.cruzStats.wins / stats.cruzStats.total) * 100).toFixed(1)) : '0.0'}%
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">SA Atual</span>
              <span className="text-2xl font-black text-purple-400">{stats?.cruzStats.currentSA || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">SM (Máxima)</span>
              <span className="text-2xl font-black text-blue-400">{stats?.cruzStats.maxSA || 0}</span>
            </div>
          </div>
        </div>

        {/* CARD TENDÊNCIA */}
        <div className={CARD_GREEN}>
          <div className={HEAD_GREEN}>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-black uppercase tracking-widest text-white">Assertividade de Minuto (WR)</span>
            </div>
          </div>
          <div className="p-6 bg-[#0b0e14]/40 flex flex-col gap-8 border-b border-white/5">
            <div className="flex items-center gap-6">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Horas P/ Trás</span>
                <input type="number" min="1" max="24" value={tendHoras} onChange={e => setTendHoras(Number(e.target.value))} className={`${INPUT_STYLE} w-full`} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WR Mínimo (%)</span>
                <input type="number" min="1" max="100" value={tendWr} onChange={e => setTendWr(Number(e.target.value))} className={`${INPUT_STYLE} w-full`} />
              </div>
              <span className="text-[9px] text-slate-500 italic max-w-[150px] text-right">
                O sinal ativa se a assertividade do minuto nas últimas horas for maior ou igual ao WR Mínimo.
              </span>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Sinais Enviados</span>
              <span className="text-2xl font-black text-white">{stats?.tendStats.total || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Win Rate (%)</span>
              <span className={`text-2xl font-black ${(stats?.tendStats.total || 0) > 0 ? (((stats?.tendStats.wins || 0) / (stats?.tendStats.total || 1)) * 100) >= 50 ? 'text-emerald-400' : 'text-rose-400' : 'text-slate-600'}`}>
                {stats?.tendStats.total ? (((stats.tendStats.wins / stats.tendStats.total) * 100).toFixed(1)) : '0.0'}%
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">SA Atual</span>
              <span className="text-2xl font-black text-purple-400">{stats?.tendStats.currentSA || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">SM (Máxima)</span>
              <span className="text-2xl font-black text-blue-400">{stats?.tendStats.maxSA || 0}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
