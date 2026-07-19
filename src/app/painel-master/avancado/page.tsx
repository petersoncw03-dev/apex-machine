'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { useSSE } from '@/contexts/SSEContext';
import { useMinutosIa } from '@/hooks/useMinutosIa';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';
import ResumoDiarioPanel from '@/components/painel-master/ResumoDiarioPanel';
import AnalisePnlTab from '@/components/painel-master/AnalisePnlTab';
import GraficoPnlPanel from '@/components/painel-master/GraficoPnlPanel';
import { VisaoCoresTab } from '@/components/painel-master/VisaoCoresTab';
import { useVip } from '@/hooks/useVip';

interface Roll { color: string; roll: number; timestamp: string; id?: string; }

// ─── Design tokens (Radar Style Premium) ──────────────────────────────────────
const CARD = 'bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300 [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg';
const HEAD = 'px-3 py-2 border-b border-white/5 bg-[#0b0e14]/50 flex justify-between items-center';
const SEL = 'bg-[#0b0e14] border border-white/10 text-white text-[10px] px-2.5 py-1 rounded-md outline-none focus:border-[#00c83a] uppercase font-black tracking-widest hover:border-white/20 transition-colors cursor-pointer';

const CARD_GREEN = 'bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col relative transition-all duration-300 [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg';
const HEAD_GREEN = 'px-3 py-2 border-b border-white/5 bg-[#0b0e14]/50 flex justify-between items-center';
const SEL_GREEN = 'bg-[#0b0e14] border border-white/10 text-white text-[10px] px-2.5 py-1 rounded-md outline-none focus:border-[#00c83a] uppercase font-black tracking-widest hover:border-white/20 transition-colors cursor-pointer';

type SortDirection = 'desc' | 'asc' | null;



export default function RadarAvancado() {
  const { isVip } = useVip();
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'resumos' | 'grafico' | 'analise-pnl' | 'visao-cores'>('visao-cores');
  const [histRealTime, setHistRealTime] = useState(true);
  const [histFixedCols, setHistFixedCols] = useState(false);
  const [histReverse, setHistReverse] = useState(false);
  const [histShowSeconds, setHistShowSeconds] = useState(false);
  const [globalData, setGlobalData] = useState<Roll[]>([]);
  const [globalData24h, setGlobalData24h] = useState<Roll[]>([]);
  const isInitialLoad24h = useRef(true);
  useEffect(() => {
    if (isInitialLoad24h.current || globalData24h.length === 0) {
      setGlobalData24h(globalData.slice(-3000));
      if (globalData && globalData.length > 0) isInitialLoad24h.current = false;
      return;
    }
    // Solução B: Atraso de 2s para os painéis analíticos não travarem a queda da pedra!
    const timer = setTimeout(() => {
      setGlobalData24h(globalData.slice(-3000));
    }, 2000);
    return () => clearTimeout(timer);
  }, [globalData, globalData24h.length]);
  const [loading, setLoading] = useState(true);
  const [maxDataHours, setMaxDataHours] = useState(168);


  // ── NOVAS ESTATÍSTICAS (BRANCOS, DUPLOS, TRIPLOS, HORAS) ──────────────
  const [analiseBrancos, setAnaliseBrancos] = useState({ minAtras: 0, rodadasAtras: 0, maxima24h: 0 });
  const [seqDuplos, setSeqDuplos] = useState({ minAtras: 0, rodadasAtras: 0, brancosSem: 0, maxima: 0 });
  const [seqTriplos, setSeqTriplos] = useState({ minAtras: 0, rodadasAtras: 0, brancosSem: 0, maxima: 0, duplosSem: 0, maxDuplosSem: 0 });
  const [seqDentado, setSeqDentado] = useState({ minAtras: 0, rodadasAtras: 0, brancosSem: 0, maxima: 0 });
  const [seqBanguelo, setSeqBanguelo] = useState({ minAtras: 0, rodadasAtras: 0, brancosSem: 0, maxima: 0 });
  const [coresPorHora, setCoresPorHora] = useState(Array.from({ length: 24 }, () => ({ r: 0, b: 0, w: 0 })));
  const [coresMode, setCoresMode] = useState<'qtd' | 'perc'>('qtd');
  const [coresHoraOffsetDays, setCoresHoraOffsetDays] = useState<number>(0);
  const [hotHoursPrevDay, setHotHoursPrevDay] = useState<{ hour: number, count: number }[]>([]);
  
  const [seqColorLen, setSeqColorLen] = useState(5);
  // ── SOUND & TOAST STATE ───────────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const [showBrancoToast, setShowBrancoToast] = useState(false);

  const playAlert = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBell = (time: number, freq: number) => {
        // Fundamental
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, time);
        gain1.gain.setValueAtTime(0, time);
        gain1.gain.linearRampToValueAtTime(1, time + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, time + 2.5); // Longo e suave
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        
        // Harmônico metálico
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.76, time); // Fator inarmônico para dar o tom de sino
        gain2.gain.setValueAtTime(0, time);
        gain2.gain.linearRampToValueAtTime(0.35, time + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, time + 1.0);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        // Harmônico agudo (brilho)
        const osc3 = audioCtx.createOscillator();
        const gain3 = audioCtx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(freq * 5.4, time); 
        gain3.gain.setValueAtTime(0, time);
        gain3.gain.linearRampToValueAtTime(0.15, time + 0.02);
        gain3.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        osc3.connect(gain3);
        gain3.connect(audioCtx.destination);
        
        osc1.start(time); osc2.start(time); osc3.start(time);
        osc1.stop(time + 3); osc2.stop(time + 3); osc3.stop(time + 3);
      };

      const now = audioCtx.currentTime;
      // Toque de Sino duplo de "Win" (Comemoração)
      playBell(now, 1046.50); // C6
      playBell(now + 0.15, 1318.51); // E6
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (!globalData || globalData.length === 0) return;

    const now = Date.now();
    const isW = (r: any) => r?.color?.toUpperCase() === 'BRANCO' || r?.color?.toUpperCase() === 'B' || r?.color?.toUpperCase() === 'WHITE' || Number(r?.roll) === 0;
    const isR = (r: any) => r?.color?.toUpperCase() === 'VERMELHO' || r?.color?.toUpperCase() === 'RED' || r?.color?.toUpperCase() === 'V' || (Number(r?.roll) >= 1 && Number(r?.roll) <= 7);
    const isB = (r: any) => r?.color?.toUpperCase() === 'PRETO' || r?.color?.toUpperCase() === 'BLACK' || r?.color?.toUpperCase() === 'P' || (Number(r?.roll) >= 8 && Number(r?.roll) <= 14);

    // Cores por Hora e Dia Anterior
    const targetDate = new Date(now + coresHoraOffsetDays * 24 * 3600 * 1000);
    const prevDate = new Date(now + (coresHoraOffsetDays - 1) * 24 * 3600 * 1000);
    
    const targetDateStr = targetDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const prevDateStr = prevDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    const cph = Array.from({ length: 24 }, () => ({ r: 0, b: 0, w: 0 }));
    const prevCphW = Array.from({ length: 24 }, () => 0);

    for (const roll of globalData) {
      const d = new Date(roll.timestamp);
      const rollDateStr = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      
      if (rollDateStr === targetDateStr) {
        const hStr = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false });
        const h = parseInt(hStr, 10);
        if (h >= 0 && h < 24) {
          if (isR(roll)) cph[h].r++;
          else if (isB(roll)) cph[h].b++;
          else if (isW(roll)) cph[h].w++;
        }
      } else if (rollDateStr === prevDateStr && isW(roll)) {
        const hStr = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false });
        const h = parseInt(hStr, 10);
        if (h >= 0 && h < 24) {
          prevCphW[h]++;
        }
      }
    }
    
    const hot = [];
    for (let i = 0; i < 24; i++) {
      if (prevCphW[i] >= 10) {
        hot.push({ hour: i, count: prevCphW[i] });
      }
    }
    
    setHotHoursPrevDay(hot);
    setCoresPorHora(cph);
  }, [globalData, coresHoraOffsetDays]);

  useEffect(() => {
    if (!globalData || globalData.length === 0) return;

    const now = Date.now();
    const isW = (r: any) => r?.color?.toUpperCase() === 'BRANCO' || r?.color?.toUpperCase() === 'B' || r?.color?.toUpperCase() === 'WHITE' || Number(r?.roll) === 0;
    const data24h = globalData.filter(d => (now - new Date(d.timestamp).getTime()) <= 24 * 3600 * 1000);

    // Análise de Brancos (último e máxima 24h)
    let lastWIdx = -1;
    let maxW = 0;

    for (let i = 0; i < data24h.length; i++) {
      if (isW(data24h[i])) {
        if (lastWIdx !== -1) {
          const delay = i - lastWIdx;
          if (delay > maxW) maxW = delay;
        }
        lastWIdx = i;
      }
    }
    if (lastWIdx !== -1) {
      const currentDelay = (data24h.length - 1) - lastWIdx;
      if (currentDelay > maxW) maxW = currentDelay;
    } else {
      maxW = data24h.length; // No white in 24h
    }

    let minAtrasW = 0;
    let rodadasAtrasW = 0;
    for (let i = data24h.length - 1; i >= 0; i--) {
      if (isW(data24h[i])) {
        rodadasAtrasW = data24h.length - 1 - i;
        minAtrasW = Math.floor((now - new Date(data24h[i].timestamp).getTime()) / 60000);
        break;
      }
    }
    setAnaliseBrancos({ minAtras: minAtrasW, rodadasAtras: rodadasAtrasW, maxima24h: maxW });

    // Sequências de Brancos (Duplos e Triplos)
    const findPattern = (pattern: ('W'|'X')[]) => {
      let maxDelay = 0;
      let lastEndIdx = -1;
      const count = pattern.length;

      for (let i = 0; i <= data24h.length - count; i++) {
        let isSeq = true;
        for (let j = 0; j < count; j++) {
          const isWhite = isW(data24h[i + j]);
          if ((pattern[j] === 'W' && !isWhite) || (pattern[j] === 'X' && isWhite)) {
            isSeq = false;
            break;
          }
        }

        if (isSeq) {
          const endIdx = i + count - 1;
          if (lastEndIdx !== -1) {
            const delay = endIdx - lastEndIdx;
            if (delay > maxDelay) maxDelay = delay;
          }
          lastEndIdx = endIdx;
          i += count - 1; // Prevent overlapping
        }
      }
      
      if (lastEndIdx !== -1) {
        const currentDelay = (data24h.length - 1) - lastEndIdx;
        if (currentDelay > maxDelay) maxDelay = currentDelay;
      } else {
        maxDelay = data24h.length;
      }

      let minAtras = 0;
      let rodadasAtras = -1;
      let brancosSem = 0;

      for (let i = data24h.length - count; i >= 0; i--) {
        let isSeq = true;
        for (let j = 0; j < count; j++) {
          const isWhite = isW(data24h[i + j]);
          if ((pattern[j] === 'W' && !isWhite) || (pattern[j] === 'X' && isWhite)) {
            isSeq = false;
            break;
          }
        }

        if (isSeq) {
          const endIdx = i + count - 1;
          rodadasAtras = data24h.length - 1 - endIdx;
          minAtras = Math.floor((now - new Date(data24h[endIdx].timestamp).getTime()) / 60000);

          brancosSem = 0;
          for (let k = endIdx + 1; k < data24h.length; k++) {
            if (isW(data24h[k])) brancosSem++;
          }
          break;
        }
      }

      if (rodadasAtras === -1) {
        brancosSem = 0;
        for (let k = 0; k < data24h.length; k++) {
          if (isW(data24h[k])) brancosSem++;
        }
      }

      return { minAtras, rodadasAtras, brancosSem, maxima: maxDelay };
    };

    const ds = findPattern(['W', 'W']);
    const ts: any = findPattern(['W', 'W', 'W']);

    // Calculate Duplos without Triplos
    let maxDuplosBetweenTriplos = 0;
    let currentDuplos = 0;
    let idx = 0;
    while (idx <= data24h.length - 2) {
      if (idx <= data24h.length - 3 && isW(data24h[idx]) && isW(data24h[idx + 1]) && isW(data24h[idx + 2])) {
        // Triplo
        if (currentDuplos > maxDuplosBetweenTriplos) maxDuplosBetweenTriplos = currentDuplos;
        currentDuplos = 0;
        idx += 3;
      } else if (isW(data24h[idx]) && isW(data24h[idx + 1])) {
        // Duplo
        currentDuplos++;
        idx += 2;
      } else {
        idx++;
      }
    }
    if (currentDuplos > maxDuplosBetweenTriplos) maxDuplosBetweenTriplos = currentDuplos;

    ts.duplosSem = currentDuplos;
    ts.maxDuplosSem = maxDuplosBetweenTriplos;

    setSeqDuplos(ds);
    setSeqTriplos(ts);
    setSeqDentado(findPattern(['W', 'X', 'W']));
    setSeqBanguelo(findPattern(['W', 'X', 'X', 'W']));

  }, [globalData]);

  const seqColorStats = useMemo(() => {
    if (!globalData || globalData.length === 0) return {
      any: { minAtras: 0, rodadasAtras: 0, maxima: 0 },
      red: { minAtras: 0, rodadasAtras: 0, maxima: 0 },
      black: { minAtras: 0, rodadasAtras: 0, maxima: 0 }
    };

    const now = Date.now();
    const isR = (r: any) => r?.color?.toUpperCase() === 'VERMELHO' || r?.color?.toUpperCase() === 'RED' || r?.color?.toUpperCase() === 'V' || (Number(r?.roll) >= 1 && Number(r?.roll) <= 7);
    const isB = (r: any) => r?.color?.toUpperCase() === 'PRETO' || r?.color?.toUpperCase() === 'BLACK' || r?.color?.toUpperCase() === 'P' || (Number(r?.roll) >= 8 && Number(r?.roll) <= 14);

    const findSeqColor = (colorCheck: (r: any) => boolean, count: number) => {
      let maxDelay = 0;
      let lastEndIdx = -1;

      for (let i = 0; i <= globalData.length - count; i++) {
        let isSeq = true;
        for (let j = 0; j < count; j++) {
          if (!colorCheck(globalData[i + j])) {
            isSeq = false;
            break;
          }
        }

        if (isSeq) {
          const endIdx = i + count - 1;
          if (lastEndIdx !== -1) {
            const delay = endIdx - lastEndIdx;
            if (delay > maxDelay) maxDelay = delay;
          }
          lastEndIdx = endIdx;
          i += count - 1;
        }
      }

      if (lastEndIdx !== -1) {
        const currentDelay = (globalData.length - 1) - lastEndIdx;
        if (currentDelay > maxDelay) maxDelay = currentDelay;
      } else {
        maxDelay = globalData.length;
      }

      let minAtras = 0;
      let rodadasAtras = -1;

      for (let i = globalData.length - 1; i >= count - 1; i--) {
        let isSeq = true;
        for (let j = 0; j < count; j++) {
          if (!colorCheck(globalData[i - j])) {
            isSeq = false;
            break;
          }
        }

        if (isSeq) {
          rodadasAtras = globalData.length - 1 - i;
          minAtras = Math.floor((now - new Date(globalData[i].timestamp).getTime()) / 60000);
          break;
        }
      }

      if (rodadasAtras === -1) rodadasAtras = globalData.length;

      return { minAtras, rodadasAtras, maxima: maxDelay };
    };

    const findSeqAnyColor = (count: number) => {
      let maxDelay = 0;
      let lastEndIdx = -1;

      for (let i = 0; i <= globalData.length - count; i++) {
        let isSeqR = true;
        let isSeqB = true;
        for (let j = 0; j < count; j++) {
          if (!isR(globalData[i + j])) isSeqR = false;
          if (!isB(globalData[i + j])) isSeqB = false;
        }

        if (isSeqR || isSeqB) {
          const endIdx = i + count - 1;
          if (lastEndIdx !== -1) {
            const delay = endIdx - lastEndIdx;
            if (delay > maxDelay) maxDelay = delay;
          }
          lastEndIdx = endIdx;
          i += count - 1;
        }
      }

      if (lastEndIdx !== -1) {
        const currentDelay = (globalData.length - 1) - lastEndIdx;
        if (currentDelay > maxDelay) maxDelay = currentDelay;
      } else {
        maxDelay = globalData.length;
      }

      let minAtras = 0;
      let rodadasAtras = -1;

      for (let i = globalData.length - 1; i >= count - 1; i--) {
        let isSeqR = true;
        let isSeqB = true;
        for (let j = 0; j < count; j++) {
          if (!isR(globalData[i - j])) isSeqR = false;
          if (!isB(globalData[i - j])) isSeqB = false;
        }

        if (isSeqR || isSeqB) {
          rodadasAtras = globalData.length - 1 - i;
          minAtras = Math.floor((now - new Date(globalData[i].timestamp).getTime()) / 60000);
          break;
        }
      }

      if (rodadasAtras === -1) rodadasAtras = globalData.length;

      return { minAtras, rodadasAtras, maxima: maxDelay };
    };

    return {
      red: findSeqColor(isR, seqColorLen),
      black: findSeqColor(isB, seqColorLen),
      any: findSeqAnyColor(seqColorLen)
    };
  }, [globalData, seqColorLen]);

  // --- IA SIGNALS CALCULATION ---
  // (O Master Sniper AI foi removido para dar lugar ao Mestre de Confluência)

  // --- IA STATS (SA/SM) CALCULATION ---
  const [iaMinConfluence, setIaMinConfluence] = useState(1);

  const iaStats = useMemo(() => {
    if (!globalData24h || globalData24h.length < 100) return { sa: 0, sm: 0 };

    const getMinuteStamp = (time: number) => Math.floor(time / 60000);

    const startTime = new Date(globalData24h[0].timestamp).getTime();
    const endTime = new Date(globalData24h[globalData24h.length - 1].timestamp).getTime();
    
    const startStamp = getMinuteStamp(startTime);
    const endStamp = getMinuteStamp(endTime);
    const totalMinutes = endStamp - startStamp;
    
    const signalGenList = new Array(totalMinutes + 1).fill(null).map(() => [] as number[]);
    const whiteMinutes = new Uint8Array(totalMinutes + 1);

    for (let i = 0; i < globalData24h.length; i++) {
      const roll = globalData24h[i];
      if (roll.roll === 0) {
        const timeW = new Date(roll.timestamp).getTime();
        const idx = getMinuteStamp(timeW) - startStamp;
        if (idx >= 0 && idx <= totalMinutes) whiteMinutes[idx] = 1;
      }
    }

    for (let i = 1; i < globalData24h.length; i++) {
      const roll = globalData24h[i];
      if (roll.roll !== 0) continue;

      const timeW = new Date(roll.timestamp).getTime();
      const prev = globalData24h[i - 1] ? Number(globalData24h[i - 1].roll) : 0;
      const next = i + 1 < globalData24h.length ? Number(globalData24h[i + 1].roll) : null;

      const strats = [
        timeW + 10 * 60000,
        timeW + 20 * 60000,
        timeW + 60 * 60000,
        timeW + 120 * 60000
      ];
      if (prev > 0) strats.push(timeW + prev * 60000);
      if (next !== null && next > 0) strats.push(timeW + next * 60000);

      const genTime = getMinuteStamp(timeW) - startStamp;

      for (const st of strats) {
        const idx = getMinuteStamp(st) - startStamp;
        if (idx >= 0 && idx <= totalMinutes) {
           signalGenList[idx].push(genTime);
        }
      }
    }

    // Janela deslizante para estratégias de calor (6h e 3h)
    let p6_tail = 0, p6_head = 0;
    let p3_tail = 0, p3_head = 0;
    const minCount6h = Array(60).fill(0);
    const rowCount = Array(6).fill(0);
    const colCount = Array(10).fill(0);

    for (let mIdx = 0; mIdx <= totalMinutes; mIdx++) {
      const currentTimeStamp = startStamp + mIdx;
      const currentTime = currentTimeStamp * 60000;
      const cut6h = currentTime - 6 * 3600000;
      const cut3h = currentTime - 3 * 3600000;
      const cut10m = currentTime - 10 * 60000; // Delay de 10 minutos

      while (p6_tail < globalData24h.length && new Date(globalData24h[p6_tail].timestamp).getTime() < cut6h) {
        const r = globalData24h[p6_tail];
        if (r.roll === 0) minCount6h[new Date(r.timestamp).getMinutes()]--;
        p6_tail++;
      }
      while (p6_head < globalData24h.length && new Date(globalData24h[p6_head].timestamp).getTime() <= cut10m) {
        if (p6_head >= p6_tail) {
            const r = globalData24h[p6_head];
            if (r.roll === 0) minCount6h[new Date(r.timestamp).getMinutes()]++;
        }
        p6_head++;
      }

      while (p3_tail < globalData24h.length && new Date(globalData24h[p3_tail].timestamp).getTime() < cut3h) {
        const r = globalData24h[p3_tail];
        if (r.roll === 0) {
          const m = new Date(r.timestamp).getMinutes();
          rowCount[Math.floor(m/10)]--;
          colCount[m%10]--;
        }
        p3_tail++;
      }
      while (p3_head < globalData24h.length && new Date(globalData24h[p3_head].timestamp).getTime() <= cut10m) {
        if (p3_head >= p3_tail) {
            const r = globalData24h[p3_head];
            if (r.roll === 0) {
              const m = new Date(r.timestamp).getMinutes();
              rowCount[Math.floor(m/10)]++;
              colCount[m%10]++;
            }
        }
        p3_head++;
      }

      const currMinNum = currentTimeStamp % 60;
      
      const sortedMins = minCount6h
        .map((hits, min) => ({ min, hits }))
        .filter(x => x.hits >= 2)
        .sort((a, b) => b.hits - a.hits);
      for(let i=0; i<3 && i<sortedMins.length; i++) {
         if (sortedMins[i].min === currMinNum) signalGenList[mIdx].push(-1); // Incrementa
      }

      const r = Math.floor(currMinNum/10);
      const c = currMinNum%10;
      if (rowCount[r] >= 2 && colCount[c] >= 2) {
         signalGenList[mIdx].push(-1); // Incrementa
      }
    }

    // Calcular SA e SM
    let currentSA = 0;
    let maxSA = 0;
    const warmupMinutes = 6 * 60; // Aguarda 6h de dados para calcular calor corretamente

    // Só iteramos até totalMinutes - 1. 
    // Se um sinal está no minuto atual (totalMinutes), a margem dele vai até totalMinutes + 1 (futuro).
    // Não podemos contar como Loss um sinal que ainda tem minutos futuros de margem pendentes.
    for (let i = warmupMinutes; i <= totalMinutes - 1; i++) {
        if (signalGenList[i].length >= iaMinConfluence) {
            let hit = false;
            // Verifica se caiu branco na margem do sinal (1 minuto antes, no exato, ou 1 minuto depois)
            for (let m = i - 1; m <= i + 1; m++) {
                if (m >= 0 && m <= totalMinutes && whiteMinutes[m] === 1) {
                    let validSignalsForM = 0;
                    for (const genTime of signalGenList[i]) {
                        if (genTime === -1 || genTime < m) {
                            validSignalsForM++;
                        }
                    }
                    if (validSignalsForM >= iaMinConfluence) {
                        hit = true;
                        break;
                    }
                }
            }

            if (hit) {
                currentSA = 0;
            } else {
                // Se a margem vai pro futuro (m > totalMinutes), não damos loss ainda!
                if (i + 1 > totalMinutes) {
                    // Sinal pendente, ainda não finalizou a margem. Ignora.
                } else {
                    currentSA++;
                    if (currentSA > maxSA) maxSA = currentSA;
                }
            }
        }
    }

    return { sa: currentSA, sm: maxSA };
  }, [globalData24h, iaMinConfluence]);

  // SOMA
  const [somaHoursGeral, setSomaHoursGeral] = useState(12);
  const [somaHoursSM, setSomaHoursSM] = useState(48);
  const [somaSortCol, setSomaSortCol] = useState<'BCO' | 'SM' | 'SA' | null>(null);
  const [somaSortDir, setSomaSortDir] = useState<SortDirection>(null);
  const [popupSum, setPopupSum] = useState<number | null>(null);
  const [copiedList, setCopiedList] = useState(false);

  // SCANNER
  const [scanDays, setScanDays] = useState(3);
  const [scanMin, setScanMin] = useState(30);
  const [scanSortCol, setScanSortCol] = useState<'SA' | 'SM' | null>(null);
  const [scanSortDir, setScanSortDir] = useState<SortDirection>(null);
  const [minSaScanner, setMinSaScanner] = useState<number>(20);
  const [popupScannerPatterns, setPopupScannerPatterns] = useState<string[] | null>(null);
  const [scannerData, setScannerData] = useState<Roll[]>([]);
  const [loadingScanner, setLoadingScanner] = useState(false);

  // CASAS
  const [casas, setCasas] = useState(3);
  const [casasHours, setCasasHours] = useState(3);

  // MINUTOS
  const [minHours, setMinHours] = useState(24);

  // ENTRADAS BRANCO
  const [entradasBranco, setEntradasBranco] = useState(3);

  // PAGAMENTO POR COR E PAR/IMPAR
  const [horasCor, setHorasCor] = useState(12);
  const [horasParImpar, setHorasParImpar] = useState(12);

  // MÁXIMAS (30 DIAS)
  const [showMaximasPopup, setShowMaximasPopup] = useState(false);
  const [maximasLoading, setMaximasLoading] = useState(false);
  const [maximasData, setMaximasData] = useState<{ sma1: number, sma2: number, smaTotal: number }[]>(Array(60).fill({ sma1: 0, sma2: 0, smaTotal: 0 }));
  const [maximasDays, setMaximasDays] = useState(30);

  const handleOpenMaximas = async (days = 30) => {
    setShowMaximasPopup(true);
    setMaximasLoading(true);
    setMaximasDays(days);
    try {
      const r = await fetch(`/api/results/period?hours=${days * 24}&onlyWhites=true`);
      if (r.ok) {
        const d = (await r.json()).data || [];
        d.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const lastHit1 = Array(60).fill(-1);
        const lastHit2 = Array(60).fill(-1);
        const lastHitTotal = Array(60).fill(-1);

        const sma1 = Array(60).fill(0);
        const sma2 = Array(60).fill(0);
        const smaTotal = Array(60).fill(0);

        const getBRT = (ts: string) => new Date(new Date(ts).getTime() - 3 * 3600 * 1000);

        for (let i = 0; i < d.length; i++) {
          const r = d[i];
          if (r?.color?.toUpperCase() === 'BRANCO' || r?.color?.toUpperCase() === 'B' || Number(r?.roll) === 0) {
            const dt = getBRT(r.timestamp);
            const t = dt.getTime();
            const m = dt.getUTCMinutes();
            const s = dt.getUTCSeconds();

            if (lastHitTotal[m] !== -1) {
              const delayHours = Math.floor((t - lastHitTotal[m]) / (3600 * 1000));
              if (delayHours > smaTotal[m]) smaTotal[m] = Math.max(smaTotal[m], delayHours);
            }
            lastHitTotal[m] = t;

            if (s < 30) {
              if (lastHit1[m] !== -1) {
                const delayHours = Math.floor((t - lastHit1[m]) / (3600 * 1000));
                if (delayHours > sma1[m]) sma1[m] = Math.max(sma1[m], delayHours);
              }
              lastHit1[m] = t;
            } else {
              if (lastHit2[m] !== -1) {
                const delayHours = Math.floor((t - lastHit2[m]) / (3600 * 1000));
                if (delayHours > sma2[m]) sma2[m] = Math.max(sma2[m], delayHours);
              }
              lastHit2[m] = t;
            }
          }
        }

        // Verifica o atraso atual (desde o último hit até AGORA)
        const nowBRT = new Date(Date.now() - 3 * 3600 * 1000).getTime();
        const maxHours = days * 24;
        for (let m = 0; m < 60; m++) {
          if (lastHitTotal[m] !== -1) {
            const delayHours = Math.floor((nowBRT - lastHitTotal[m]) / (3600 * 1000));
            if (delayHours > smaTotal[m]) smaTotal[m] = delayHours;
          } else {
            smaTotal[m] = maxHours; // Não bateu no período
          }

          if (lastHit1[m] !== -1) {
            const delayHours = Math.floor((nowBRT - lastHit1[m]) / (3600 * 1000));
            if (delayHours > sma1[m]) sma1[m] = delayHours;
          } else {
            sma1[m] = maxHours;
          }

          if (lastHit2[m] !== -1) {
            const delayHours = Math.floor((nowBRT - lastHit2[m]) / (3600 * 1000));
            if (delayHours > sma2[m]) sma2[m] = delayHours;
          } else {
            sma2[m] = maxHours;
          }
        }

        const formatted = Array.from({ length: 60 }, (_, i) => ({
          sma1: sma1[i], sma2: sma2[i], smaTotal: smaTotal[i]
        }));
        setMaximasData(formatted);
      }
    } catch { } finally {
      setMaximasLoading(false);
    }
  };

  const tickerRef = useRef<HTMLDivElement>(null);
  const [tickerCols, setTickerCols] = useState(20);

  useEffect(() => {
    const measure = () => {
      if (tickerRef.current) {
        // Let CSS handle the overflow-hidden on the left side perfectly
        setTickerCols(100);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const dataRef = useRef<Roll[]>([]);
  const MAX_ROWS = maxDataHours === 360 ? 45000 : 15000;

  const fetchGlobalDataPeriod = useCallback(async (hours: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/results/period?hours=${hours}`);
      if (r.ok) {
        const res = await r.json();
        const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        dataRef.current = arr;
        setGlobalData(arr);
      }
    } catch { } finally { setLoading(false); }
  }, []);

  const handleSetMaxDataHours = (hours: number) => {
    if (hours === maxDataHours) return;
    setMaxDataHours(hours);
    fetchGlobalDataPeriod(hours);
  };

  const fetchScannerData = useCallback(async (days: number) => {
    setLoadingScanner(true);
    try {
      const r = await fetch(`/api/results/period?hours=${days * 24}&onlyWhites=true`);
      if (r.ok) {
        const res = await r.json();
        const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        setScannerData(arr);
      }
    } catch { } finally { setLoadingScanner(false); }
  }, []);

  // Carrega UMA ÚNICA VEZ ao montar (Dual-Phase Loading)
  useEffect(() => {
    let isMounted = true;
    
    const initialLoad = async () => {
      setLoading(true);
      
      // Fase 1: Carga Rápida (48h Global, 3 dias Scanner) para renderizar a interface rápido
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/results/period?hours=48`),
          fetch(`/api/results/period?hours=72&onlyWhites=true`)
        ]);
        if (r1.ok) {
          const res = await r1.json();
          const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          if (isMounted) { dataRef.current = arr; setGlobalData(arr); }
        }
        if (r2.ok) {
          const res = await r2.json();
          const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          if (isMounted) setScannerData(arr);
        }
      } catch {}
      
      // Libera a tela imediatamente após os dados curtos chegarem
      if (isMounted) setLoading(false);
      
      // Fase 2: Carga Silenciosa no fundo (7 Dias)
      try {
        if (isMounted) setLoadingScanner(true); // Animação discreta no botão do scanner
        
        const [r1Full, r2Full] = await Promise.all([
          fetch(`/api/results/period?hours=${maxDataHours}`),
          fetch(`/api/results/period?hours=${scanDays * 24}&onlyWhites=true`)
        ]);
        
        if (r1Full.ok) {
          const res = await r1Full.json();
          const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          if (isMounted) { dataRef.current = arr; setGlobalData(arr); }
        }
        if (r2Full.ok) {
          const res = await r2Full.json();
          const arr = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
          if (isMounted) setScannerData(arr);
        }
      } catch {} finally {
        if (isMounted) setLoadingScanner(false);
      }
    };
    
    initialLoad();
    
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { subscribe } = useSSE();

  useEffect(() => {
    const unsub = subscribe((newRoll) => {
      const mappedRoll = { ...newRoll, roll: Number(newRoll.roll) };
      
      const isBranco = mappedRoll.color?.toUpperCase().includes('BRANCO') || mappedRoll.color?.toUpperCase().includes('WHITE') || String(newRoll.roll) === '0';
      console.log("[DEBUG BRANCO]", { newRoll, mappedRoll, isBranco });
      if (isBranco) {
         setShowBrancoToast(true);
         if (soundEnabledRef.current) {
            playAlert();
         }
         setTimeout(() => setShowBrancoToast(false), 5000);
      }

      console.log('SSE Recebeu:', mappedRoll);
      
      setGlobalData(prevData => {
        const hasIdMatch = mappedRoll.id && prevData.some(r => r.id === mappedRoll.id);
        const hasTsMatch = !mappedRoll.id && prevData.some(r => r.timestamp === mappedRoll.timestamp && r.roll === mappedRoll.roll);
        
        console.log(`Verificando duplicada: hasIdMatch=${hasIdMatch}, hasTsMatch=${hasTsMatch}`);
        if (hasIdMatch || hasTsMatch) {
           console.log('Pedra ignorada (duplicada)');
           return prevData;
        }
        
        console.log('Pedra ACEITA e adicionada no estado global');
        const merged = [...prevData, mappedRoll];
        // newRolls always come in chronological order, no need to sort.
        // sorting by ID fails because ID is alphanumeric (e.g. 'zokgXzzVly')
        const trimmed = merged.length > MAX_ROWS ? merged.slice(-MAX_ROWS) : merged;
        dataRef.current = trimmed;
        return trimmed;
      });
      setScannerData(prev => {
        if (mappedRoll.id && prev.some(r => r.id === mappedRoll.id)) return prev;
        if (!mappedRoll.id && prev.some(r => r.timestamp === mappedRoll.timestamp && r.roll === mappedRoll.roll)) return prev;
        
        const merged = [...prev, mappedRoll];
        return merged.length > 90000 ? merged.slice(-90000) : merged;
      });
    });
    return unsub;
  }, [subscribe]);


  const tickerRolls = useMemo(() => globalData.slice(-tickerCols), [globalData, tickerCols]);

  // Busca binária: muito mais rápido que .filter() em 15k+ linhas (O(log n) vs O(n))
  const sliceByHours = useCallback((data: Roll[], hours: number): Roll[] => {
    if (!data.length) return [];
    const cutMs = new Date(data[data.length - 1].timestamp).getTime() - hours * 3_600_000;
    let lo = 0, hi = data.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (new Date(data[mid].timestamp).getTime() < cutMs) lo = mid + 1;
      else hi = mid;
    }
    return data.slice(lo);
  }, []);

  // Fatias pré-computadas — cada analítico re-usa o corte já feito, sem varrer tudo de novo
  const sliceCustomSomaGeral = useMemo(() => sliceByHours(globalData, somaHoursGeral), [globalData, somaHoursGeral, sliceByHours]);
  const sliceCustomSomaSM = useMemo(() => sliceByHours(globalData, somaHoursSM), [globalData, somaHoursSM, sliceByHours]);
  const sliceCustomCasas = useMemo(() => sliceByHours(globalData, casasHours), [globalData, casasHours, sliceByHours]);
  const sliceCustomMin = useMemo(() => sliceByHours(globalData, minHours), [globalData, minHours, sliceByHours]);

  const deferredScannerData = useDeferredValue(scannerData);
  const isScannerStale = deferredScannerData !== scannerData || loadingScanner;

  const isBranco = (r: any) => r?.color?.toUpperCase() === 'BRANCO' || r?.color?.toUpperCase() === 'B' || String(r?.roll) === '0';

  // ── PAGAMENTO POR COR E PAR/IMPAR ──────────────────────────────────────────
  const corStats = useMemo(() => {
    const data = sliceByHours(globalData, horasCor);
    let saBlack = 0, smaBlack = 0, hitsBlack = 0;
    let saRed = 0, smaRed = 0, hitsRed = 0;

    const isB = (r: any) => r?.color?.toUpperCase() === 'PRETO' || r?.color?.toUpperCase() === 'BLACK' || r?.color?.toUpperCase() === 'P' || (Number(r?.roll) >= 8 && Number(r?.roll) <= 14);
    const isR = (r: any) => r?.color?.toUpperCase() === 'VERMELHO' || r?.color?.toUpperCase() === 'RED' || r?.color?.toUpperCase() === 'V' || (Number(r?.roll) >= 1 && Number(r?.roll) <= 7);

    for (let i = 0; i < data.length - 1; i++) {
      if (isB(data[i])) {
        if (isBranco(data[i + 1])) { hitsBlack++; saBlack = 0; }
        else { saBlack++; if (saBlack > smaBlack) smaBlack = saBlack; }
      }
      if (isR(data[i])) {
        if (isBranco(data[i + 1])) { hitsRed++; saRed = 0; }
        else { saRed++; if (saRed > smaRed) smaRed = saRed; }
      }
    }
    return {
      black: { hits: hitsBlack, sa: saBlack, sma: smaBlack },
      red: { hits: hitsRed, sa: saRed, sma: smaRed }
    };
  }, [globalData, horasCor, sliceByHours]);

  const parImparStats = useMemo(() => {
    const data = sliceByHours(globalData, horasParImpar);
    let saPar = 0, smaPar = 0, hitsPar = 0;
    let saImpar = 0, smaImpar = 0, hitsImpar = 0;

    for (let i = 0; i < data.length - 1; i++) {
      const roll = Number(data[i].roll);
      if (roll > 0) {
        if (roll % 2 === 0) {
          if (isBranco(data[i + 1])) { hitsPar++; saPar = 0; }
          else { saPar++; if (saPar > smaPar) smaPar = saPar; }
        } else {
          if (isBranco(data[i + 1])) { hitsImpar++; saImpar = 0; }
          else { saImpar++; if (saImpar > smaImpar) smaImpar = saImpar; }
        }
      }
    }
    return {
      par: { hits: hitsPar, sa: saPar, sma: smaPar },
      impar: { hits: hitsImpar, sa: saImpar, sma: smaImpar }
    };
  }, [globalData, horasParImpar, sliceByHours]);

  // ── SOMA ──────────────────────────────────────────────────────────────────
  const somaStats = useMemo(() => {
    const dataGeral = sliceCustomSomaGeral;
    const dataSM = sliceCustomSomaSM;

    const stGeral = Array.from({ length: 29 }, (_, i) => ({ sum: i, hits: 0, sa: 0 }));
    const stSM = Array.from({ length: 29 }, (_, i) => ({ sum: i, sma: 0 }));

    for (let i = 0; i < dataGeral.length - 2; i++) {
      const sum = dataGeral[i].roll + dataGeral[i + 1].roll;
      if (isBranco(dataGeral[i + 2])) { stGeral[sum].hits++; stGeral[sum].sa = 0; }
      else { stGeral[sum].sa++; }
    }

    const tempSA = Array(29).fill(0);
    for (let i = 0; i < dataSM.length - 2; i++) {
      const sum = dataSM[i].roll + dataSM[i + 1].roll;
      if (isBranco(dataSM[i + 2])) { tempSA[sum] = 0; }
      else { tempSA[sum]++; if (tempSA[sum] > stSM[sum].sma) stSM[sum].sma = tempSA[sum]; }
    }

    const combined = Array.from({ length: 29 }, (_, i) => ({
      sum: i, hits: stGeral[i].hits, sa: stGeral[i].sa, sma: stSM[i].sma
    })).slice(1);

    if (somaSortCol && somaSortDir) {
      combined.sort((a, b) => {
        const valA = somaSortCol === 'BCO' ? a.hits : somaSortCol === 'SM' ? a.sma : a.sa;
        const valB = somaSortCol === 'BCO' ? b.hits : somaSortCol === 'SM' ? b.sma : b.sa;
        return somaSortDir === 'desc' ? valB - valA : valA - valB;
      });
    }
    return combined;
  }, [sliceCustomSomaGeral, sliceCustomSomaSM, somaSortCol, somaSortDir]);


  const handleSomaSort = (col: 'BCO' | 'SM' | 'SA') => {
    if (somaSortCol === col) {
      if (somaSortDir === 'desc') setSomaSortDir('asc');
      else if (somaSortDir === 'asc') { setSomaSortDir(null); setSomaSortCol(null); }
    } else {
      setSomaSortCol(col);
      setSomaSortDir('desc');
    }
  };

  const sortIcon = (col: 'BCO' | 'SM' | 'SA') => {
    if (somaSortCol !== col) return '';
    return somaSortDir === 'desc' ? ' ↓' : ' ↑';
  };

  const getCombinations = (sum: number) => {
    const combos: string[] = [];
    for (let x = 0; x <= 14; x++) {
      for (let y = 0; y <= 14; y++) {
        if (x + y === sum) {
          combos.push(`${x} ${y} = branco g0`);
        }
      }
    }
    return combos;
  };

  // ── CASAS + MÍSTICAS ───────────────────────────────────────────────────────
  const casasStats = useMemo(() => {
    const data = sliceCustomCasas;
    const st = Array.from({ length: 15 }, (_, i) => ({ stone: i, hits: 0, sa: 0, sma: 0 }));
    for (let i = 0; i < data.length - casas; i++) {
      const stone = data[i].roll;
      let hit = false;
      for (let j = 1; j <= casas; j++) if (isBranco(data[i + j])) { hit = true; break; }
      if (hit) { st[stone].hits++; st[stone].sa = 0; }
      else { st[stone].sa++; if (st[stone].sa > st[stone].sma) st[stone].sma = st[stone].sa; }
    }
    return st;
  }, [sliceCustomCasas, casas]);

  // FIX: User requested to sort by "mais puxaram branco" (hits) descending.
  const top3 = [...casasStats].sort((a, b) => b.hits - a.hits || a.sa - b.sa).slice(0, 3);

  // ── SCANNER ────────────────────────────────────────────────────────────────
  const scannerStats = useMemo(() => {
    const data = deferredScannerData;
    if (!data.length) return [];

    const getBRTDate = (tsStr: string) => {
      const utc = new Date(tsStr).getTime();
      return new Date(utc - 3 * 3600 * 1000);
    };

    const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    const days = Array.from(new Set(data.map(d => dayKey(getBRTDate(d.timestamp)))));
    const blocks = Math.floor(1440 / scanMin);
    const hitsPerDay: Record<string, Set<number>> = {};
    days.forEach(d => hitsPerDay[d] = new Set());

    const latestDate = new Date(Date.now() - 3 * 3600 * 1000);
    const latestDayKey = dayKey(latestDate);
    const latestBlock = Math.floor((latestDate.getUTCHours() * 60 + latestDate.getUTCMinutes() + latestDate.getUTCSeconds() / 60) / scanMin);

    data.forEach(r => {
      if (!isBranco(r)) return;
      const dt = getBRTDate(r.timestamp);
      const min = dt.getUTCHours() * 60 + dt.getUTCMinutes() + dt.getUTCSeconds() / 60;
      const blk = Math.floor(min / scanMin);
      if (blk < blocks) hitsPerDay[dayKey(dt)].add(blk);
    });

    const result = Array.from({ length: blocks }, (_, b) => {
      const totalMin = b * scanMin;
      const h = Math.floor(totalMin / 60);
      const m = Math.floor(totalMin % 60);
      const s = Math.round((totalMin % 1) * 60);
      let sa = 0, sma = 0, hits = 0;
      for (const d of days) {
        if (d === latestDayKey && b > latestBlock) continue;
        if (hitsPerDay[d].has(b)) { 
          hits++; 
          sa = 0; 
        } else { 
          // Só aumenta o SA se o bloco já terminou (não estamos mais nele sem acerto)
          if (d === latestDayKey && b === latestBlock) {
             // Bloco atual em andamento, não soma SA ainda
          } else {
             sa++; 
             if (sa > sma) sma = sa; 
          }
        }
      }
      const label = scanMin < 1 
          ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      return { id: b, label, sa, sma, hits };
    });

    if (scanSortCol && scanSortDir) {
      result.sort((a, b) => {
        const valA = scanSortCol === 'SA' ? a.sa : a.sma;
        const valB = scanSortCol === 'SA' ? b.sa : b.sma;
        return scanSortDir === 'desc' ? valB - valA : valA - valB;
      });
    }
    return result;
  }, [sliceCustomMin, scanMin, scanSortCol, scanSortDir]);

  const handleScanSort = (col: 'SA' | 'SM') => {
    if (scanSortCol === col) {
      if (scanSortDir === 'desc') setScanSortDir('asc');
      else if (scanSortDir === 'asc') { setScanSortDir(null); setScanSortCol(null); }
    } else {
      setScanSortCol(col);
      setScanSortDir('desc');
    }
  };

  const scanSortIcon = (col: 'SA' | 'SM') => {
    if (scanSortCol !== col) return '';
    return scanSortDir === 'desc' ? ' ↓' : ' ↑';
  };

  const handleGenerateScannerPatterns = () => {
    const matches = scannerStats.filter(s => s.sa >= minSaScanner);
    const formattedPatterns = matches.map(s => {
      const label = s.label;
      const entries = scanMin * 2;
      const gale = entries - 1;
      return `${label} = branco g${gale}`;
    });
    setPopupScannerPatterns(formattedPatterns);
  };

  // ── MINUTOS ────────────────────────────────────────────────────────────────
  const minStats = useMemo(() => {
    const data = sliceCustomMin;
    const st = Array.from({ length: 60 }, (_, i) => ({ min: i, hits1: 0, hits2: 0, hits: 0, sa: 0 }));
    const last = Array(60).fill(-1);
    for (let i = 0; i < data.length; i++) {
      const utcTime = new Date(data[i].timestamp).getTime();
      const brtTime = new Date(utcTime - 3 * 3600 * 1000);
      const m = brtTime.getUTCMinutes();
      const sec = brtTime.getUTCSeconds();
      if (isBranco(data[i])) {
        st[m].hits++;
        if (sec < 30) st[m].hits1++; else st[m].hits2++;
        last[m] = i;
      }
    }
    for (let m = 0; m < 60; m++) {
      const raw = last[m] === -1 ? data.length : data.length - 1 - last[m];
      st[m].sa = Math.max(0, Math.floor(raw / 60));
    }
    return st;
  }, [sliceCustomMin]);

  // ── Helpers visuais ───────────────────────────────────────────────────────
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
      md: { out: 'w-7 h-7', in: 'w-7 h-7', txt: 'text-[12px]' },
      lg: { out: 'w-12 h-12', in: 'w-6 h-6', txt: 'text-[14px]' },
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

  const zeroPurpleBg = (h: number) => h === 0 ? 'bg-[#8b008b] text-white' : '';

  // ── GALE BRANCO POR PEDRA (1h a 24h) ────────────────────────────────────
  const timeframesBranco = useMemo(() => [1, 2, 3, 4, 5, 6, 12, 24], []);
  const galeBrancoStats = useMemo(() => {
    return timeframesBranco.map(hours => {
      const data = sliceByHours(globalData, hours);
      const st = Array.from({ length: 15 }, (_, i) => ({ stone: i, hits: 0, triggers: 0 }));

      for (let i = 0; i < data.length - entradasBranco; i++) {
        const stone = data[i].roll;
        st[stone].triggers++;

        let hit = false;
        for (let j = 1; j <= entradasBranco; j++) {
          if (isBranco(data[i + j])) { hit = true; break; }
        }

        if (hit) {
          st[stone].hits++;
        }
      }
      return { hours, stats: st };
    });
  }, [globalData, sliceByHours, timeframesBranco, entradasBranco]);

  return (
    <div className="h-screen overflow-hidden bg-[#030303] text-gray-200 font-sans flex flex-col relative">
      
      {/* ── AUDIO & TOAST DE BRANCO ────────────────────────────────────────────── */}
      
      {showBrancoToast && (
        <div className="absolute top-6 right-6 z-[9999] bg-[#0b0e14]/90 backdrop-blur-xl border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.3)] px-6 py-4 rounded-xl flex items-center gap-5 animate-in fade-in slide-in-from-top-10 duration-300">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.4)] overflow-hidden bg-transparent">
            <img src="/blaze-white.png" alt="Branco" className="w-full h-full object-contain drop-shadow-xl scale-110" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-white font-black tracking-widest uppercase text-lg leading-tight drop-shadow-md">BRANCO DETECTADO!</span>
            <span className="text-emerald-400 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              Pagamento 14x Confirmado
            </span>
          </div>
        </div>
      )}

      {/* Global Glowing Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-900/10 rounded-full blur-[150px] pointer-events-none z-0"></div>

      {/* ── PAGE BODY ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar w-full z-10 flex flex-col relative">
        
        {/* ── TOP SECTION (TABS + TICKER) ─────────────────────────────────── */}
        <div className="w-full max-w-[1600px] mx-auto px-6 pt-6 pb-2 shrink-0 flex flex-col gap-4 z-50">
           {/* Abas Principais (Top Navigation) */}
           <div className="flex items-center gap-2 md:gap-1.5 overflow-x-auto custom-scrollbar bg-[#0b0e14]/80 backdrop-blur-md border border-[#00c83a]/20 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-2 md:p-1.5 shrink-0">
             <button 
               onClick={() => setActiveTab('visao-cores')} 
               className={`px-5 py-3 md:px-4 md:py-2 rounded-lg text-[13px] md:text-[12px] font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'visao-cores' ? 'bg-[#00c83a] text-white shadow-[0_2px_10px_rgba(0,200,58,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
             >
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-4 md:h-4"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
               Avançado
             </button>
             <button 
               onClick={() => window.location.href = '/painel-master'} 
               className={`px-5 py-3 md:px-4 md:py-2 rounded-lg text-[13px] md:text-[12px] font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-[#00c83a] text-white shadow-[0_2px_10px_rgba(0,200,58,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
             >
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-4 md:h-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
               Histórico
             </button>
             <button 
               onClick={() => window.location.href = '/painel-master'} 
               className={`px-5 py-3 md:px-4 md:py-2 rounded-lg text-[13px] md:text-[12px] font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'resumos' ? 'bg-[#00c83a] text-white shadow-[0_2px_10px_rgba(0,200,58,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
             >
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-4 md:h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
               Resumos
             </button>
             <button 
                onClick={() => isVip ? setActiveTab('analise-pnl') : alert('Aba exclusiva para usuários VIP!')} 
                className={`px-5 py-3 md:px-4 md:py-2 rounded-lg text-[13px] md:text-[12px] font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'analise-pnl' ? 'bg-[#00c83a] text-white shadow-[0_2px_10px_rgba(0,200,58,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'} ${!isVip ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!isVip ? "Exclusivo VIP" : ""}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-4 md:h-4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Stress Test
              </button>
              <button 
                onClick={() => setActiveTab('grafico')} 
                className={`px-5 py-3 md:px-4 md:py-2 rounded-lg text-[13px] md:text-[12px] font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'grafico' ? 'bg-[#00c83a] text-white shadow-[0_2px_10px_rgba(0,200,58,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-4 md:h-4"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                Gráfico
              </button>

              <span className="text-white/20 hidden md:block select-none">|</span>

              <button 
                onClick={() => window.location.href = '/painel-master'} 
                className={`px-5 py-3 md:px-4 md:py-2 rounded-lg text-[13px] md:text-[12px] font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'home' ? 'bg-[#00c83a] text-white shadow-[0_2px_10px_rgba(0,200,58,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-4 md:h-4"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Painel Master
              </button>
             <a 
                href="https://blaze.bet.br/pt/games/double"  
                target="_blank" 
                rel="noopener noreferrer" 
                className="ml-auto bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors rounded-lg px-4 py-2 flex items-center justify-center text-[10px] font-black text-white uppercase tracking-widest shadow-sm active:scale-95"
             >
                IR PARA BLAZE &gt;
             </a>
           </div>

           {/* ── HISTÓRICO AO VIVO (Tempo Real Premium Card) ─────────────────────────── */}
           <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg transition-all duration-300 relative flex flex-col">
             
             {/* Header */}
             <div className="px-4 py-2 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[2px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
               <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                   <span className="relative flex h-3 w-3">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                   </span>
                   <span className="text-[14px] font-black tracking-wide text-white">Tempo Real</span>
                 </div>
               </div>
               
               <div className="flex items-center gap-4">
                 <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-slate-400 hover:text-white transition-colors" title={soundEnabled ? "Desativar Som" : "Ativar Som"}>
                   {soundEnabled ? (
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                   ) : (
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-red-500"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                   )}
                 </button>
                 <div className="flex items-center gap-1.5 text-green-400 text-[12px] font-bold font-mono bg-green-400/10 px-2 py-1 rounded-md border border-green-400/20">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                   <RealTimeClock />
                 </div>
               </div>
             </div>

             {/* Ticker Grid */}
             <div 
               ref={tickerRef} 
               className="w-full flex flex-row-reverse gap-1.5 overflow-hidden justify-start items-center p-3 bg-black/40"
             >
               {[...tickerRolls].reverse().map((roll, i) => {
                 const n = parseInt(roll.roll as any);
                 const time = new Date(roll.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                 return (
                   <div key={roll.id || roll.timestamp} className="flex flex-col items-center p-1 border border-[#00c83a]/10 bg-[#0b0e14]/70 rounded-lg shrink-0 w-[50px] shadow-sm hover:bg-[#00c83a]/20 transition-all hover:-translate-y-1">
                     <StoneIcon n={n} size="ticker" />
                     <span className="text-[9px] text-gray-500 font-bold mt-1 tracking-widest">{time}</span>
                   </div>
                 );
               })}
             </div>

             {/* Alert Banner for Brancos Atrasados */}
             {analiseBrancos.rodadasAtras >= 20 && (
               <div className="mx-3 mb-3 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-transparent border border-amber-500/30 rounded-md flex justify-between items-center shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                 <div className="flex items-center gap-1.5 text-amber-500">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                   <span className="text-[9px] font-black tracking-widest">ALERTA</span>
                   <span className="text-amber-200/70 text-[9px] border-l border-amber-500/30 pl-1.5 ml-0.5">Possível Recuperação</span>
                 </div>
                 <div className="flex items-center gap-2 text-amber-500 text-[9px] font-bold">
                   {analiseBrancos.rodadasAtras} rodadas sem branco
                 </div>
               </div>
             )}
           </div>
        </div>

        {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
        <div className="w-full flex-1">
          <div className="w-full max-w-[1600px] mx-auto px-6 py-4 flex flex-col gap-6">
            <div className="flex flex-col xl:flex-row gap-6 pb-24 items-stretch">
              
              {/* ── LEFT COLUMN: NOVAS INFORMAÇÕES ──────────────────────────────────── */}
              
              {activeTab === 'visao-cores' && (
                <div className="w-full">
                  <VisaoCoresTab globalData={globalData} />
                </div>
              )}

              {activeTab === 'analise-pnl' && (
                <div className="w-full">
                  <AnalisePnlTab globalData={globalData} />
                </div>
              )}

              {activeTab === 'grafico' && (
                <div className="w-full">
                  <GraficoPnlPanel isVip={isVip} globalData={globalData} />
                </div>
              )}

              {activeTab === 'home' && (
                <div className="flex flex-col gap-4 w-full xl:w-[300px] shrink-0">

                {/* Análise de Brancos */}
                <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg transition-all duration-300 relative">
                  <div className="px-3 py-2 border-b border-white/5 bg-[#0b0e14]/50 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Análise de Brancos</span>
                  </div>
                  <div className="p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-lg bg-transparent flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)] overflow-hidden">
                        <img src="/blaze-white.png" alt="W" className="w-full h-full object-contain drop-shadow-md" />
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-[10px] text-slate-300 font-medium">O último Branco foi há <strong className="text-white">{analiseBrancos.minAtras} minutos</strong></span>
                        <span className="text-[10px] text-white font-bold">{analiseBrancos.rodadasAtras} rodadas atrás</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-lg bg-transparent flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.2)] overflow-hidden">
                        <img src="/blaze-white.png" alt="W" className="w-full h-full object-contain drop-shadow-md" />
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-[10px] text-slate-300 font-medium">A máxima de Brancos (24h) é de</span>
                        <span className="text-[10px] text-white font-bold">{analiseBrancos.maxima24h} rodadas</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sequência de Brancos (Duplos/Triplos) */}
                <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg transition-all duration-300 relative">
                  <div className="px-3 py-2 border-b border-white/5 bg-[#0b0e14]/50 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Sequência de Brancos</span>
                  </div>
                  <div className="p-3 flex flex-col gap-4">

                    {/* Duplos */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col gap-1 shrink-0">
                          <div className="w-6 h-6 rounded bg-white text-black font-black flex items-center justify-center text-xs">X2</div>
                          <div className="w-6 h-6 rounded bg-white text-black font-black flex items-center justify-center text-xs">X2</div>
                        </div>
                        <div className="flex flex-col justify-center gap-1">
                          <span className="text-[10px] text-slate-300 leading-tight">O último Duplo foi há <strong className="text-white">{seqDuplos.minAtras} min</strong></span>
                          <span className="text-[10px] text-white font-bold leading-tight">{seqDuplos.rodadasAtras} rodadas atrás</span>
                          <span className="text-[10px] text-rose-400 font-bold leading-tight mt-1">{seqDuplos.brancosSem} brancos sem duplo</span>
                          <span className="text-[10px] text-slate-400 leading-tight mt-1">A máxima sem duplos em rodadas é: <strong className="text-white">{seqDuplos.maxima}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Triplos */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col gap-1 shrink-0">
                          <div className="w-6 h-6 rounded bg-white text-black font-black flex items-center justify-center text-xs">X3</div>
                          <div className="w-6 h-6 rounded bg-white text-black font-black flex items-center justify-center text-xs">X3</div>
                        </div>
                        <div className="flex flex-col justify-center gap-1">
                          {seqTriplos.rodadasAtras === -1 ? (
                            <span className="text-[10px] text-slate-300 mb-1">Não houve triplo no histórico.</span>
                          ) : (
                            <>
                              <span className="text-[10px] text-slate-300 leading-tight">O último Triplo foi há <strong className="text-white">{seqTriplos.minAtras} min</strong></span>
                              <span className="text-[10px] text-white font-bold leading-tight">{seqTriplos.rodadasAtras} rodadas atrás</span>
                            </>
                          )}
                          <span className="text-[10px] text-rose-400 font-bold leading-tight mt-1">{seqTriplos.brancosSem} brancos sem triplo</span>
                          <span className="text-[10px] text-amber-400 font-bold leading-tight mt-0.5">Duplos sem triplos: {seqTriplos.duplosSem} (Máx: {seqTriplos.maxDuplosSem})</span>
                          <span className="text-[10px] text-slate-400 leading-tight mt-1">A máxima sem triplos em rodadas é: <strong className="text-white">{seqTriplos.maxima}</strong></span>
                        </div>
                      </div>
                    </div>
                    {/* Dentado */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-row gap-0.5 shrink-0 p-1 bg-white rounded">
                          <GlobalStoneIcon n={0} size="xs" />
                          <div className="w-[18px] h-[18px] rounded bg-[#1e2330]"></div>
                          <GlobalStoneIcon n={0} size="xs" />
                        </div>
                        <div className="flex flex-col justify-center gap-1">
                          {seqDentado.rodadasAtras === -1 ? (
                            <span className="text-[10px] text-slate-300 mb-1">Não houve dentado no histórico.</span>
                          ) : (
                            <>
                              <span className="text-[10px] text-slate-300 leading-tight">O último Dentado foi há <strong className="text-white">{seqDentado.minAtras} min</strong></span>
                              <span className="text-[10px] text-white font-bold leading-tight">{seqDentado.rodadasAtras} rodadas atrás</span>
                            </>
                          )}
                          <span className="text-[10px] text-rose-400 font-bold leading-tight mt-1">{seqDentado.brancosSem} brancos sem dentado</span>
                          <span className="text-[10px] text-slate-400 leading-tight mt-1">Máxima sem dentado: <strong className="text-white">{seqDentado.maxima}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Banguelo */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-row gap-0.5 shrink-0 p-1 bg-white rounded">
                          <GlobalStoneIcon n={0} size="xs" />
                          <div className="w-[18px] h-[18px] rounded bg-[#1e2330]"></div>
                          <div className="w-[18px] h-[18px] rounded bg-[#1e2330]"></div>
                          <GlobalStoneIcon n={0} size="xs" />
                        </div>
                        <div className="flex flex-col justify-center gap-1">
                          {seqBanguelo.rodadasAtras === -1 ? (
                            <span className="text-[10px] text-slate-300 mb-1">Não houve banguelo no histórico.</span>
                          ) : (
                            <>
                              <span className="text-[10px] text-slate-300 leading-tight">O último Banguelo foi há <strong className="text-white">{seqBanguelo.minAtras} min</strong></span>
                              <span className="text-[10px] text-white font-bold leading-tight">{seqBanguelo.rodadasAtras} rodadas atrás</span>
                            </>
                          )}
                          <span className="text-[10px] text-rose-400 font-bold leading-tight mt-1">{seqBanguelo.brancosSem} brancos sem banguelo</span>
                          <span className="text-[10px] text-slate-400 leading-tight mt-1">Máxima sem banguelo: <strong className="text-white">{seqBanguelo.maxima}</strong></span>
                        </div>
                      </div>
                    </div>


                  </div>
                </div>

                {/* Pagamento por Cor */}
                <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg transition-all duration-300 relative">
                  <div className="px-3 py-2 border-b border-white/5 bg-[#0b0e14]/50 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Pagamento por Cor</span>
                    <select className={SEL} value={horasCor} onChange={e => setHorasCor(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                      {[1, 2, 3, 4, 5, 6, 12, 18, 24].map(v => <option key={v} value={v}>{v}h</option>)}
                    </select>
                  </div>
                  <div className="p-3 flex flex-col gap-3">
                    {/* Preto */}
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-lg bg-[#2C2F33] flex items-center justify-center shrink-0 border-[1.5px] border-white/40 shadow-[0_0_15px_rgba(44,47,51,0.5)]"></div>
                      <div className="flex flex-col justify-center gap-0.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">QTD BCO: <span className="text-emerald-400 text-[11px] font-black">{corStats.black.hits}</span></span>
                        </div>
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                          SA <span className={corStats.black.sa === 0 ? 'text-emerald-400' : 'text-rose-400'}>{corStats.black.sa}</span> <span className="text-slate-500">/</span> SM <span className="text-white">{corStats.black.sma}</span>
                        </span>
                      </div>
                    </div>
                    {/* Vermelho */}
                    <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                      <div className="w-7 h-7 rounded-lg bg-[#E51E3E] flex items-center justify-center shrink-0 border-[1.5px] border-white/80 shadow-[0_0_15px_rgba(229,30,62,0.4)]"></div>
                      <div className="flex flex-col justify-center gap-0.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">QTD BCO: <span className="text-emerald-400 text-[11px] font-black">{corStats.red.hits}</span></span>
                        </div>
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                          SA <span className={corStats.red.sa === 0 ? 'text-emerald-400' : 'text-rose-400'}>{corStats.red.sa}</span> <span className="text-slate-500">/</span> SM <span className="text-white">{corStats.red.sma}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pagamento Par e Ímpar */}
                <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg transition-all duration-300 relative">
                  <div className="px-3 py-2 border-b border-white/5 bg-[#0b0e14]/50 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Par e Ímpar</span>
                    <select className={SEL} value={horasParImpar} onChange={e => setHorasParImpar(+e.target.value)}>
                      {[1, 2, 3, 4, 5, 6, 12, 18, 24].map(v => <option key={v} value={v}>{v}h</option>)}
                    </select>
                  </div>
                  <div className="p-3 flex flex-col gap-3">
                    {/* Par */}
                    <div className="flex items-center gap-4">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/50">
                        <span className="text-[11px] font-black text-white uppercase drop-shadow-md">PAR</span>
                      </div>
                      <div className="flex flex-col justify-center gap-0.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">QTD BCO: <span className="text-emerald-400 text-[11px] font-black">{parImparStats.par.hits}</span></span>
                        </div>
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                          SA <span className={parImparStats.par.sa === 0 ? 'text-emerald-400' : 'text-rose-400'}>{parImparStats.par.sa}</span> <span className="text-slate-500">/</span> SM <span className="text-white">{parImparStats.par.sma}</span>
                        </span>
                      </div>
                    </div>
                    {/* Ímpar */}
                    <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/50">
                        <span className="text-[10px] font-black text-white uppercase drop-shadow-md">ÍMPAR</span>
                      </div>
                      <div className="flex flex-col justify-center gap-0.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">QTD BCO: <span className="text-emerald-400 text-[11px] font-black">{parImparStats.impar.hits}</span></span>
                        </div>
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                          SA <span className={parImparStats.impar.sa === 0 ? 'text-emerald-400' : 'text-rose-400'}>{parImparStats.impar.sa}</span> <span className="text-slate-500">/</span> SM <span className="text-white">{parImparStats.impar.sma}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                
              {/* ── SEQUÊNCIA DE CORES ────────────────────── */}
              <div className="flex flex-col gap-6 overflow-hidden shrink-0">
                <div className={`${CARD} flex flex-col h-full`}>
                  <div className={HEAD}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                      Sequência de Cores
                      
                    </span>
                    <div className="flex items-center gap-2">
                      <select 
                        className={SEL} 
                        value={maxDataHours} 
                        onChange={e => handleSetMaxDataHours(+e.target.value)}
                        title={!isVip ? "Filtro exclusivo VIP" : "Período de Histórico"}
                        disabled={!isVip}
                      >
                        <option value={168}>7 Dias</option>
                        <option value={360}>15 Dias</option>
                      </select>
                      <select className={SEL} value={seqColorLen} onChange={e => setSeqColorLen(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                        {[5, 6, 7, 8, 9].map(v => <option key={v} value={v}>{v} Cores</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-3">
                    {/* Preto/Vermelho (Ambos) */}
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col gap-1 shrink-0">
                        <div className="w-6 h-6 rounded bg-[linear-gradient(135deg,#E51E3E_50%,#131722_50%)] text-white font-black flex items-center justify-center text-xs border border-white/20 shadow-md">X{seqColorLen}</div>
                      </div>
                      <div className="flex flex-col justify-center gap-1">
                        <span className="text-[10px] text-slate-300 leading-tight">Última seq. Preto/Vermelho foi há <strong className="text-white">{seqColorStats.any.minAtras} min</strong></span>
                        <span className="text-[10px] text-white font-bold leading-tight">{seqColorStats.any.rodadasAtras} rodadas atrás</span>
                        <span className="text-[10px] text-slate-400 leading-tight mt-1">A máxima sem a sequência de {seqColorLen} é: <strong className="text-white">{seqColorStats.any.maxima}</strong></span>
                      </div>
                    </div>

                    {/* Vermelho */}
                    <div className="flex items-start gap-4 pt-3 border-t border-white/5">
                      <div className="flex flex-col gap-1 shrink-0">
                        <div className="w-6 h-6 rounded bg-[#E51E3E] text-white font-black flex items-center justify-center text-xs border border-white/20">X{seqColorLen}</div>
                      </div>
                      <div className="flex flex-col justify-center gap-1">
                        <span className="text-[10px] text-slate-300 leading-tight">Última seq. Vermelho foi há <strong className="text-white">{seqColorStats.red.minAtras} min</strong></span>
                        <span className="text-[10px] text-white font-bold leading-tight">{seqColorStats.red.rodadasAtras} rodadas atrás</span>
                        <span className="text-[10px] text-slate-400 leading-tight mt-1">A máxima sem a sequência de {seqColorLen} é: <strong className="text-white">{seqColorStats.red.maxima}</strong></span>
                      </div>
                    </div>

                    {/* Preto */}
                    <div className="flex items-start gap-4 pt-3 border-t border-white/5">
                      <div className="flex flex-col gap-1 shrink-0">
                        <div className="w-6 h-6 rounded bg-[#2C2F33] text-white font-black flex items-center justify-center text-xs border border-white/20">X{seqColorLen}</div>
                      </div>
                      <div className="flex flex-col justify-center gap-1">
                        <span className="text-[10px] text-slate-300 leading-tight">Última seq. Preto foi há <strong className="text-white">{seqColorStats.black.minAtras} min</strong></span>
                        <span className="text-[10px] text-white font-bold leading-tight">{seqColorStats.black.rodadasAtras} rodadas atrás</span>
                        <span className="text-[10px] text-slate-400 leading-tight mt-1">A máxima sem a sequência de {seqColorLen} é: <strong className="text-white">{seqColorStats.black.maxima}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {/* Cores por Hora */}
                <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg transition-all duration-300 relative flex-1 flex flex-col min-h-[500px]">
                  <div className="px-4 py-2 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center shrink-0 border-t-[2px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <button onClick={() => setCoresHoraOffsetDays(prev => prev - 1)} className="text-slate-500 hover:text-white p-1.5 bg-white/5 rounded border border-white/10 hover:border-white/30 transition-all flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                        Cores por Hora
                        
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 tracking-widest">
                        {new Date(Date.now() + coresHoraOffsetDays * 24 * 3600 * 1000).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <button onClick={() => setCoresHoraOffsetDays(prev => prev + 1)} disabled={coresHoraOffsetDays === 0} className={`p-1.5 rounded border transition-all flex items-center justify-center ${coresHoraOffsetDays === 0 ? 'text-slate-700 border-white/5 bg-transparent cursor-not-allowed' : 'text-slate-500 hover:text-white bg-white/5 border-white/10 hover:border-white/30'}`}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>
                  
                  <div className="flex border-b border-white/5 bg-[#0b0e14]/30">
                    <button onClick={() => setCoresMode('qtd')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${coresMode === 'qtd' ? 'text-white border-b-2 border-emerald-500 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}>Qtd (Volume)</button>
                    <button onClick={() => setCoresMode('perc')} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${coresMode === 'perc' ? 'text-white border-b-2 border-emerald-500 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}>% (Porcentagem)</button>
                  </div>

                  <div className="flex-1 p-3 bg-[#0b0e14]/30 overflow-hidden flex flex-col gap-3">
                    <div className="flex-1 flex flex-col gap-y-1 overflow-y-auto pr-2 custom-scrollbar">
                      {coresPorHora.map((c, h) => {
                        const total = c.r + c.b + c.w;
                        const getVal = (v: number) => {
                           if (coresMode === 'qtd') return v;
                           if (total === 0) return '0%';
                           return Math.round((v / total) * 100) + '%';
                        };
                        return (
                        <div key={h} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded p-1.5 shrink-0">
                          <span className="text-[11px] font-black text-slate-300 w-16 shrink-0">{h.toString().padStart(2, '0')}:00</span>
                          <div className="flex gap-2 shrink-0 flex-1 justify-end max-w-[220px]">
                            <div className={`flex-1 h-5 rounded bg-[#131722] text-slate-300 font-black flex items-center justify-center ${coresMode === 'perc' ? 'text-[9px]' : 'text-[10px]'}`}>{getVal(c.b)}</div>
                            <div className={`flex-1 h-5 rounded bg-rose-600 text-white font-black flex items-center justify-center ${coresMode === 'perc' ? 'text-[9px]' : 'text-[10px]'}`}>{getVal(c.r)}</div>
                            <div className={`flex-1 h-5 rounded border border-slate-600 bg-white text-slate-800 font-black flex items-center justify-center ${coresMode === 'perc' ? 'text-[9px]' : 'text-[10px]'}`}>{getVal(c.w)}</div>
                          </div>
                        </div>
                      )})}
                      
                      {hotHoursPrevDay.length > 0 && (
                        <div className="shrink-0 flex flex-col gap-2 pt-3 border-t border-white/5 mt-1">
                          <div className="text-[10px] font-black uppercase text-emerald-400 tracking-widest flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Horários Quentes 10+ (Ontem)
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {hotHoursPrevDay.map(h => (
                              <div key={h.hour} className="flex flex-col items-center justify-center bg-[#10b981]/10 border border-[#10b981]/30 rounded p-1.5 w-[60px] shrink-0">
                                <span className="text-[11px] font-black text-white">{h.hour.toString().padStart(2, '0')}:00</span>
                                <span className="text-[9px] font-bold text-emerald-400">{h.count} BCO</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
              )}

              {/* ── MIDDLE COLUMN: SCANNER + SOMA ───────────────────────────────────── */}
              {activeTab === 'home' && (
              <div className="flex flex-col gap-4 w-full xl:w-[320px] shrink-0">
              {/* ── LEFT TOP: SCANNER DO BRANCO ────────────────────────────────────────── */}
              <div className="flex flex-col gap-6 overflow-hidden h-[870px] max-h-[870px] shrink-0">
                <div className={`${CARD_GREEN} flex flex-col h-full`}>
                  <div className={HEAD_GREEN}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${isScannerStale ? 'bg-[#f12c4c] animate-pulse' : 'bg-emerald-500'}`}></div> Scanner BCO
                      
                    </span>
                  </div>

                  <div className="px-2 py-1.5 bg-black/40 border-b border-white/10 flex flex-col gap-2">
                    <div className="flex gap-2 w-full">
                      <select className={`${SEL_GREEN} flex-1`} value={scanDays} onChange={e => setScanDays(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                        {[1, 2, 3, 5, 7, 10, 14, 30, 60, 90, 120].map(v => <option key={v} value={v}>{v} Dias</option>)}
                      </select>
                      <select className={`${SEL_GREEN} flex-1`} value={scanMin} onChange={e => setScanMin(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                        {[0.5, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v} Min</option>)}
                      </select>
                    </div>
                    <button
                      onClick={() => fetchScannerData(scanDays)}
                      disabled={loadingScanner || !isVip}
                      title={!isVip ? "Exclusivo VIP" : ""}
                      className="w-full py-1.5 rounded font-black uppercase text-[9px] tracking-widest transition-all bg-white/5 hover:bg-white/10 text-white border border-white/10 relative overflow-hidden flex items-center justify-center disabled:opacity-50"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {loadingScanner ? 'CARREGANDO...' : 'APLICAR DIAS'}
                      </span>
                      {loadingScanner && (
                        <>
                          <div className="absolute inset-0 bg-white/5"></div>
                          <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full overflow-hidden">
                            <div className="h-full bg-white w-1/3 animate-pulse"></div>
                          </div>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Control Bar: Min SA Input and Generate Patterns Button */}
                  <div className="px-2 py-1.5 bg-[#050507] border-b border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] uppercase font-black text-gray-400 tracking-wider">Min SA:</span>
                      <input
                        type="number"
                        value={minSaScanner}
                        onChange={e => setMinSaScanner(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-[#12141c] border border-white/20 text-white text-[10px] w-12 px-1.5 py-1 rounded-md outline-none text-center font-bold"
                        disabled={!isVip}
                        title={!isVip ? "Exclusivo VIP" : ""}
                      />
                    </div>
                    <button
                      onClick={handleGenerateScannerPatterns}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded transition-all hover:border-white/20 active:scale-95 disabled:opacity-50"
                      disabled={!isVip}
                      title={!isVip ? "Exclusivo VIP" : ""}
                    >
                      Gerar Padrões
                    </button>
                  </div>

                  <div className="flex flex-col border border-white/5 rounded-lg h-full overflow-hidden mx-3 mb-3">
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#131722] relative">
                      <div className="grid grid-cols-3 text-center bg-[#0b0e14] border-b border-white/5 sticky top-0 z-20">
                        <div className="py-1 text-[9px] font-bold text-slate-400 border-r border-white/5">Hora</div>
                        <div onClick={() => handleScanSort('SA')} className="py-1 text-[9px] font-bold text-slate-400 border-r border-white/5 cursor-pointer hover:bg-[#131722] transition-colors">SA{scanSortIcon('SA')}</div>
                        <div onClick={() => handleScanSort('SM')} className="py-1 text-[9px] font-bold text-slate-400 cursor-pointer hover:bg-[#131722] transition-colors">SM{scanSortIcon('SM')}</div>
                      </div>

                      {(() => {
                        const now = new Date(Date.now() - 3 * 3600 * 1000);
                        const min = now.getUTCHours() * 60 + now.getUTCMinutes();
                        const currentBlock = Math.floor(min / scanMin);

                        return scannerStats.map(s => {
                          const isMaxSA = s.sa === s.sma && s.sma > 0;
                          const isCurrent = s.id === currentBlock;

                          const saStyle = s.sa === 0 ? 'bg-emerald-500/50 text-white font-black shadow-[inset_0_0_8px_rgba(16,185,129,0.3)]' : isMaxSA ? 'bg-rose-500/50 text-white font-black shadow-[inset_0_0_8px_rgba(244,63,94,0.3)]' : 'text-slate-300 hover:bg-slate-700/30';

                          return (
                            <div key={`${s.id}-${s.hits}`} className={`grid grid-cols-3 text-center border-b border-white/5 text-[11px] font-mono font-bold transition-colors ${isCurrent ? "ring-2 ring-inset ring-amber-500 bg-[#f59e0b]/20 z-10 relative" : "hover:bg-slate-700/20"}`}>
                              <div className="py-1.5 text-slate-200 border-r border-white/5 tracking-wide flex items-center justify-center gap-1.5">
                                {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>}
                                {s.label}
                              </div>
                              <div className={`py-1.5 border-r border-white/5 ${saStyle}`}>{s.sa}</div>
                              <div className="py-1.5 text-slate-400">{s.sma}</div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>


              {/* ── LEFT BOTTOM: SOMA DE 2 PEDRAS ────────────────────── */}
              <div className="flex flex-col gap-6 overflow-hidden h-fit shrink-0">
                <div className={`${CARD} flex flex-col h-full`}>
                  <div className={HEAD}>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00c83a]"></div> Soma de 2 Pedras
                      
                    </span>
                  </div>

                  <div className="px-2 py-1.5 bg-black/40 border-b border-white/10 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-gray-400">Geral (BCO/SA):</span>
                      <select className={SEL} value={somaHoursGeral} onChange={e => setSomaHoursGeral(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                        {[1, 2, 3, 6, 12, 18, 24, 36, 48].map(v => <option key={v} value={v}>{v}h</option>)}
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-gray-400">Filtro SM:</span>
                      <select className={SEL} value={somaHoursSM} onChange={e => setSomaHoursSM(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                        {[1, 2, 3, 6, 12, 18, 24, 36, 48].map(v => <option key={v} value={v}>{v}h</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col border border-white/5 rounded-lg h-full overflow-hidden mx-3 mb-3">
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#131722] relative">
                      <div className="grid grid-cols-4 text-center bg-[#0b0e14] border-b border-white/5 sticky top-0 z-20">
                        <div className="py-1 text-[9px] font-black uppercase text-slate-400 tracking-widest border-r border-white/5">#</div>
                        <div onClick={() => handleSomaSort('BCO')} className="py-1 text-[9px] font-black uppercase text-slate-400 tracking-widest border-r border-white/5 cursor-pointer hover:bg-[#131722] transition-colors">BCO{sortIcon('BCO')}</div>
                        <div onClick={() => handleSomaSort('SM')} className="py-1 text-[9px] font-black uppercase text-slate-400 tracking-widest border-r border-white/5 cursor-pointer hover:bg-[#131722] transition-colors">SM{sortIcon('SM')}</div>
                        <div onClick={() => handleSomaSort('SA')} className="py-1 text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:bg-[#131722] transition-colors">SA{sortIcon('SA')}</div>
                      </div>

                      {(() => {
                        const currentSum = globalData.length >= 2 ? (Number(globalData[globalData.length - 1].roll) || 0) + (Number(globalData[globalData.length - 2].roll) || 0) : null;
                        
                        return somaStats.map((s, i) => {
                          const isMaxSA = s.sa === s.sma && s.sma > 0;
                          const isNearMax = s.sa >= s.sma * 0.85 && s.sma > 0 && !isMaxSA && s.sa > 0;
                          const isCurrent = s.sum === currentSum;

                          const saStyle = s.sa === 0 ? 'bg-emerald-500/50 text-white font-black shadow-[inset_0_0_8px_rgba(16,185,129,0.3)]' :
                            isMaxSA ? 'bg-rose-500/50 text-white font-black shadow-[inset_0_0_8px_rgba(244,63,94,0.3)]' :
                              isNearMax ? 'bg-amber-500/30 text-amber-200' :
                                'text-slate-300';

                          return (
                            <div key={i} className={`grid grid-cols-4 text-center border-b border-white/5 text-[11px] font-mono transition-colors group ${isCurrent ? "ring-2 ring-inset ring-amber-500 bg-[#f59e0b]/20 z-10 relative" : "hover:bg-slate-700/30"}`}>
                              <div className="py-1 text-slate-200 border-r border-white/5 flex items-center justify-center gap-1.5 relative font-bold tracking-wide">
                                {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse absolute left-2"></div>}
                                {s.sum}
                                <button
                                  onClick={() => setPopupSum(s.sum)}
                                  className="w-4 h-4 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 absolute right-2"
                                  title="Ver padrões"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </button>
                              </div>
                              <div className={`py-1 border-r border-white/5 font-bold ${s.hits > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{s.hits}</div>
                              <div className="py-1 border-r border-white/5 text-slate-400">{s.sma}</div>
                              <div className={`py-1 font-bold transition-colors ${saStyle}`}>
                                {s.sa}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>



            </div>
            )}
            {/* ── RIGHT COLUMN: PAINEL DE MINUTO + CASAS + TOP 3 ────────────────────────── */}
            {/* ── RIGHT COLUMN: PAINEL DE MINUTO + CASAS + ENTRADAS ───────────── */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">
              {activeTab === 'home' ? (
                <>
              {/* PAINEL DE MINUTO */}
              <div className={`${CARD} shrink-0`}>
                {/* Header */}
                <div className={HEAD}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></div> Painel de Minuto
                  </span>
                  <div className="flex gap-1.5 items-center">
                    <button onClick={() => handleOpenMaximas(30)} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded transition-all disabled:opacity-50" disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                      Máximas 30d
                    </button>
                    <select className={SEL} value={minHours} onChange={e => setMinHours(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                      {[1, 2, 3, 6, 12, 18, 24, 36, 48, 60, 72, 84, 96].map(v => <option key={v} value={v}>{v}h</option>)}
                    </select>
                  </div>
                </div>

                <div className="w-full flex justify-center bg-transparent">
                  <div className="flex flex-col gap-3 p-3 w-full max-w-[1100px]">
                    {[0, 10, 20, 30, 40, 50].map(start => {
                      const rowSum = Array.from({ length: 10 }, (_, i) => minStats[start + i].hits).reduce((a, b) => a + b, 0);

                      return (
                        <div key={start} className="flex items-stretch gap-4">
                          <div className="flex-1 flex flex-col border border-white/5 rounded-xl overflow-hidden bg-[#131722] shadow-lg">
                            {/* Headers */}
                            <div className="grid grid-cols-10 text-center bg-[#0b0e14] border-b border-white/5">
                              {Array.from({ length: 10 }, (_, i) => (
                                <div key={i} className="text-slate-400 font-bold text-[12px] py-1.5 border-r border-white/5 last:border-0">
                                  {String(start + i).padStart(2, '0')}
                                </div>
                              ))}
                            </div>
                            {/* Splits */}
                            <div className="grid grid-cols-10 text-center font-mono text-[11px] border-b border-white/5 bg-[#131722]">
                              {Array.from({ length: 10 }, (_, i) => {
                                const stat = minStats[start + i];
                                const getStyle = (hits: number) => {
                                  const E_split = minHours / 28; // Expectativa matemática para 30s
                                  const med = Math.max(1, Math.ceil(E_split * 1.5));
                                  const good = Math.max(2, Math.ceil(E_split * 2.5));

                                  if (hits === 0) return 'bg-rose-500/40 text-rose-50';
                                  if (hits >= good) return 'bg-emerald-500/50 text-emerald-50 font-bold tracking-wide shadow-[0_0_10px_rgba(52,211,153,0.2)]';
                                  return 'text-slate-300 font-medium tracking-wide bg-slate-700/20';
                                };
                                return (
                                  <div key={i} className="grid grid-cols-2 border-r border-white/5 last:border-0">
                                    <div className={`py-1 border-r border-white/5 transition-colors ${getStyle(stat.hits1)}`}>{stat.hits1}</div>
                                    <div className={`py-1 transition-colors ${getStyle(stat.hits2)}`}>{stat.hits2}</div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Total */}
                            <div className="grid grid-cols-10 text-center font-mono font-black text-[15px]">
                              {Array.from({ length: 10 }, (_, i) => {
                                const stat = minStats[start + i];
                                const getStyle = (hits: number) => {
                                  const E_total = minHours / 14; // Expectativa matemática para 1 minuto
                                  const med = Math.max(2, Math.ceil(E_total * 1.5)); // Mínimo de 2 para ser amarelo no Total
                                  const good = Math.max(3, Math.ceil(E_total * 2.5)); // Mínimo de 3 para ser verde no Total

                                  if (hits === 0) return 'bg-rose-500/60 text-white shadow-[inset_0_0_10px_rgba(244,63,94,0.3)]';
                                  if (hits >= good) return 'bg-emerald-500/70 text-white font-black tracking-wide border border-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.3)]';
                                  return 'text-white font-medium tracking-wide bg-slate-700/40 hover:bg-slate-600';
                                };
                                return (
                                  <div key={i} className={`py-1 border-r border-white/5 last:border-0 transition-colors ${getStyle(stat.hits)}`}>
                                    {stat.hits}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bloco de Soma da Linha */}
                          <div className="w-[110px] shrink-0 flex flex-col border border-white/5 rounded-xl overflow-hidden bg-[#131722] shadow-lg">
                            <div className="bg-[#0b0e14] text-slate-400 font-bold text-[12px] py-1.5 text-center border-b border-white/5">
                              {String(start).padStart(2, '0')} - {String(start + 9).padStart(2, '0')}
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center p-2 relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-400/5 to-transparent opacity-50"></div>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5 z-10">Soma Total</span>
                              <span className="text-slate-100 text-[22px] font-black z-10 drop-shadow-md">{rowSum}</span>
                            </div>
                          </div>

                        </div>
                      )
                    })}

                    {/* --- NOVA FUNÇÃO: SOMA DAS COLUNAS (FINAIS 0 A 9) --- */}
                    <div className="flex items-stretch gap-4 mt-1 pt-1 border-t border-white/5">
                      <div className="flex-1 flex flex-col border border-white/5 rounded-xl overflow-hidden bg-[#131722] shadow-lg">
                        {/* Headers */}
                        <div className="grid grid-cols-10 text-center bg-[#0b0e14] border-b border-white/5">
                          {Array.from({ length: 10 }, (_, i) => (
                            <div key={i} className="text-slate-400 font-bold text-[12px] py-1.5 border-r border-white/5 last:border-0 uppercase tracking-widest">
                              Final {i}
                            </div>
                          ))}
                        </div>
                        {/* Splits */}
                        <div className="grid grid-cols-10 text-center font-mono text-[11px] border-b border-white/5 bg-[#131722]">
                          {Array.from({ length: 10 }, (_, i) => {
                            const colHits1 = [0, 10, 20, 30, 40, 50].reduce((sum, start) => sum + minStats[start + i].hits1, 0);
                            const colHits2 = [0, 10, 20, 30, 40, 50].reduce((sum, start) => sum + minStats[start + i].hits2, 0);

                            const getStyle = (hits: number) => {
                              const E_split = (minHours / 28) * 6;
                              const good = Math.max(2, Math.ceil(E_split * 1.5));
                              if (hits === 0) return 'bg-rose-500/40 text-rose-50';
                              if (hits >= good) return 'bg-emerald-500/50 text-emerald-50 font-bold tracking-wide shadow-[0_0_10px_rgba(52,211,153,0.2)]';
                              return 'text-slate-300 font-medium tracking-wide bg-slate-700/20';
                            };
                            return (
                              <div key={i} className="grid grid-cols-2 border-r border-white/5 last:border-0">
                                <div className={`py-1 border-r border-white/5 transition-colors ${getStyle(colHits1)}`} title="Rodada 1 (0-29s)">{colHits1}</div>
                                <div className={`py-1 transition-colors ${getStyle(colHits2)}`} title="Rodada 2 (30-59s)">{colHits2}</div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Total */}
                        <div className="grid grid-cols-10 text-center font-mono font-black text-[15px]">
                          {Array.from({ length: 10 }, (_, i) => {
                            const colHits = [0, 10, 20, 30, 40, 50].reduce((sum, start) => sum + minStats[start + i].hits, 0);
                            const getStyle = (hits: number) => {
                              const E_total = (minHours / 14) * 6;
                              const good = Math.max(3, Math.ceil(E_total * 1.5));
                              if (hits === 0) return 'bg-rose-500/60 text-white shadow-[inset_0_0_10px_rgba(244,63,94,0.3)]';
                              if (hits >= good) return 'bg-emerald-500/70 text-white font-black tracking-wide border border-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.3)]';
                              return 'text-white font-medium tracking-wide bg-slate-700/40 hover:bg-slate-600';
                            };
                            return (
                              <div key={i} className={`py-1 border-r border-white/5 last:border-0 transition-colors ${getStyle(colHits)}`} title={`Soma de todas as casas terminadas em ${i}`}>
                                {colHits}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bloco de Soma da Linha inteira (Placeholder para alinhar) */}
                      <div className="w-[110px] shrink-0 flex flex-col border border-white/5 rounded-xl overflow-hidden bg-[#131722] shadow-lg">
                        <div className="bg-[#0b0e14] text-slate-400 font-bold text-[12px] py-1.5 text-center border-b border-white/5 uppercase tracking-widest">
                          TOTAIS
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center p-2 relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-400/5 to-transparent opacity-50"></div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5 z-10">Soma Global</span>
                          <span className="text-slate-100 text-[22px] font-black z-10 drop-shadow-md">
                            {Array.from({ length: 60 }, (_, i) => minStats[i].hits).reduce((a, b) => a + b, 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* EVOLUÇÃO BRANCO (GALE 2) */}
              <div className={`${CARD} shrink-0`}>
                <div className={HEAD}>
                  <span className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Padrões {entradasBranco} Entradas (Branco)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] uppercase font-black text-gray-400 tracking-wider">Entradas:</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={entradasBranco}
                      onChange={e => setEntradasBranco(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      className="bg-[#12141c] border border-white/20 text-white text-[10px] w-12 px-1.5 py-1 rounded-md outline-none text-center font-bold"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto p-4 bg-transparent">
                  <div className="flex flex-col min-w-[700px] border border-white/5 rounded-lg overflow-hidden bg-[#131722] shadow-lg">
                    <div className="flex bg-[#0b0e14] border-b border-white/5">
                      <div className="w-28 shrink-0 py-3 border-r border-white/5 text-[10px] font-black uppercase text-center text-slate-400 flex items-center justify-center">Período</div>
                      {Array.from({ length: 15 }, (_, i) => (
                        <div key={i} className="flex-1 py-3 text-center border-r border-white/5 last:border-0 flex items-center justify-center">
                          <StoneIcon n={i} size="sm" />
                        </div>
                      ))}
                    </div>

                    {/* Rows for 1h, 2h, 3h, 4h, 5h, 6h, 12h */}
                    {galeBrancoStats.map((row, idx) => (
                      <div key={row.hours} className={`flex border-b border-white/5 last:border-0 ${idx % 2 === 0 ? 'bg-[#131722]/50' : 'bg-[#131722]'}`}>
                        <div className="w-28 shrink-0 py-2 border-r border-white/5 text-[10px] font-black uppercase text-center text-slate-500 flex flex-col items-center justify-center bg-[#0b0e14]/40">
                          <span>Últimas</span>
                          <span className="text-slate-200 text-[12px]">{row.hours} Horas</span>
                        </div>
                        {row.stats.map(s => {
                          const wr = s.triggers > 0 ? ((s.hits / s.triggers) * 100).toFixed(1) : '0.0';
                          const wrFloat = parseFloat(wr);
                          const EV = (1 - Math.pow(14 / 15, entradasBranco)) * 100;

                          let bgClass = 'bg-transparent hover:bg-slate-700/30';
                          let textColor = 'text-slate-400';
                          let subTextColor = 'text-slate-500';

                          if (s.triggers > 0) {
                            if (wrFloat >= EV * 1.3) {
                              bgClass = 'bg-emerald-500/50 shadow-[inset_0_0_8px_rgba(16,185,129,0.3)]';
                              textColor = 'text-white';
                              subTextColor = 'text-emerald-100/70';
                            }
                          }

                          return (
                            <div key={`${s.stone}-${s.hits}`} className={`flex-1 flex flex-col items-center justify-center py-2.5 border-r border-white/5 last:border-0 transition-colors ${bgClass}`}>
                              <span className={`text-[13px] leading-tight font-black font-mono tracking-wide ${textColor}`}>{wr}%</span>
                              <span className={`text-[10px] leading-tight font-mono font-bold ${subTextColor}`}>{s.hits}/{s.triggers}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PAGAMENTO APÓS PEDRA (Casas) */}
              <div className={`${CARD} shrink-0`}>
                <div className={HEAD}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Pagamento Após Pedra
                  </span>
                  <div className="flex gap-1.5">
                    <select className={SEL} value={casasHours} onChange={e => setCasasHours(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                      {[1, 2, 3, 4, 6, 9, 12, 18, 24, 36, 48].map(v => <option key={v} value={v}>{v}h</option>)}
                    </select>
                    <select className={SEL} value={casas} onChange={e => setCasas(+e.target.value)} disabled={!isVip} title={!isVip ? "Exclusivo VIP" : ""}>
                      {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} Casas</option>)}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto p-4 bg-transparent">
                  <div className="flex flex-col min-w-[600px] border border-white/5 rounded-lg overflow-hidden bg-[#131722] shadow-lg">
                    {/* Header Row */}
                    <div className="flex bg-[#0b0e14] border-b border-white/5">
                      <div className="w-24 shrink-0 py-1.5 border-r border-white/5 text-[10px] font-black uppercase text-slate-400 flex items-center justify-center bg-[#0b0e14]/40">Pedra</div>
                      {casasStats.map(s => (
                        <div key={s.stone} className="flex-1 py-1.5 text-center border-r border-white/5 last:border-0 flex items-center justify-center">
                          <StoneIcon n={s.stone} size="sm" />
                        </div>
                      ))}
                    </div>
                    {/* BCO Row */}
                    <div className="flex border-b border-white/5 bg-[#131722]">
                      <div className="w-24 shrink-0 py-1.5 border-r border-white/5 text-[10px] font-black uppercase text-slate-500 bg-[#0b0e14]/40 flex items-center justify-center">BCO</div>
                      {casasStats.map(s => (
                        <div key={s.stone} className={`flex-1 py-1.5 flex items-center justify-center text-center font-mono text-[13px] font-black border-r border-white/5 last:border-0 ${s.hits > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {s.hits}
                        </div>
                      ))}
                    </div>
                    {/* SM Row */}
                    <div className="flex border-b border-white/5 bg-[#131722]/50">
                      <div className="w-24 shrink-0 py-1.5 border-r border-white/5 text-[10px] font-black uppercase text-slate-500 bg-[#0b0e14]/40 flex items-center justify-center">SM</div>
                      {casasStats.map(s => (
                        <div key={s.stone} className="flex-1 py-1.5 flex items-center justify-center text-center font-mono text-[12px] text-slate-400 font-bold border-r border-white/5 last:border-0">
                          {s.sma}
                        </div>
                      ))}
                    </div>
                    {/* SA Row */}
                    <div className="flex bg-[#131722]">
                      <div className="w-24 shrink-0 py-1.5 border-r border-white/5 text-[10px] font-black uppercase text-slate-500 bg-[#0b0e14]/40 flex items-center justify-center">SA</div>
                      {casasStats.map(s => {
                        const isMaxSA = s.sa === s.sma && s.sma > 0;
                        const isNearMax = s.sa >= s.sma * 0.85 && s.sma > 0 && !isMaxSA && s.sa > 0;

                        const saStyle = s.sa === 0 ? 'bg-emerald-500/50 text-white font-black shadow-[inset_0_0_8px_rgba(16,185,129,0.3)]' :
                          isMaxSA ? 'bg-rose-500/50 text-white font-black shadow-[inset_0_0_8px_rgba(244,63,94,0.3)]' :
                            isNearMax ? 'bg-amber-500/30 text-amber-200' :
                              'text-slate-400';
                        return (
                          <div key={`${s.stone}-sa-${s.sa}`} className={`flex-1 py-1.5 flex items-center justify-center text-center font-mono text-[13px] font-black border-r border-white/5 last:border-0 transition-colors ${saStyle}`}>
                            {s.sa}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Os 3 Melhores */}
                <div className="border-t border-white/10 p-4 bg-transparent">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white mb-3 text-center">Os 3 Melhores (Puxam Branco)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {top3.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-[#12141c] border border-white/10 hover:border-white/30 transition-colors rounded-xl p-3 shadow-xl">
                        <StoneIcon n={s.stone} size="md" />
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-300 font-bold uppercase tracking-wider">BCO</span>
                            <span className="text-[#4ade80] font-black text-sm">{s.hits}</span>
                          </div>
                          <div className="w-full h-px bg-white/10 my-1"></div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-400 uppercase tracking-wider">SA / SM</span>
                            <span className="font-mono text-gray-200 font-bold"><span className={s.sa === 0 ? 'text-[#4ade80]' : ''}>{s.sa}</span> / {s.sma}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>



                </>
              ) : activeTab === 'history' ? (
                <HistoryPanel playAlert={playAlert} 
                  globalData={globalData} 
                  histRealTime={histRealTime} setHistRealTime={setHistRealTime}
                  histFixedCols={histFixedCols} setHistFixedCols={setHistFixedCols}
                  histReverse={histReverse} setHistReverse={setHistReverse}
                  histShowSeconds={histShowSeconds} setHistShowSeconds={setHistShowSeconds}
                  isVip={isVip}
                />
              ) : activeTab === 'resumos' ? (
                <ResumoDiarioPanel globalData={globalData} />
              ) : activeTab === 'grafico' ? (
                <GraficoPnlPanel isVip={isVip} globalData={globalData} />
              ) : activeTab === 'analise-pnl' ? (
                <AnalisePnlTab globalData={globalData} />
              ) : null}
            </div>


          </div>
        </div>
      </div>

      {/* POPUP SOMA PADRÕES */}
      {popupSum !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-[#131722] border border-white/10 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col w-[320px] overflow-hidden transform transition-all scale-100">
            <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-blue-500/20 to-transparent flex justify-between items-center">
              <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
                Padrões Soma {popupSum}
              </h3>
              <button
                onClick={() => setPopupSum(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#050507]">
              {getCombinations(popupSum).map((combo, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/5 rounded px-3 py-2.5 font-mono text-sm font-bold text-gray-300 tracking-wider text-center">
                  {combo}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 bg-[#131722] flex flex-col gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getCombinations(popupSum).join('\n'));
                  setCopiedList(true);
                  setTimeout(() => setCopiedList(false), 2000);
                }}
                className="w-full bg-[#4ade80]/10 hover:bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/30 py-3 rounded-lg font-black uppercase text-[10px] tracking-widest transition-colors flex justify-center items-center gap-2"
              >
                {copiedList ? (
                  <>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copiar a lista completa
                  </>
                )}
              </button>
              <button
                onClick={() => setPopupSum(null)}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 py-3 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP SCANNER BCO PADRÕES */}
      {popupScannerPatterns !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-[#131722] border border-white/10 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col w-[350px] overflow-hidden transform transition-all scale-100">
            <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-500/20 to-transparent flex justify-between items-center">
              <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
                Padrões SA ≥ {minSaScanner}
              </h3>
              <button
                onClick={() => setPopupScannerPatterns(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#050507]">
              {popupScannerPatterns.length === 0 ? (
                <div className="text-gray-500 text-center py-6 text-xs font-bold">Nenhum padrão encontrado com SA ≥ {minSaScanner}</div>
              ) : (
                popupScannerPatterns.map((pat, idx) => (
                  <div key={idx} className="bg-white/[0.03] border border-[#4ade80]/10 rounded px-3 py-2.5 font-mono text-[11px] font-bold text-gray-300 tracking-wider text-center">
                    {pat}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-[#131722] flex flex-col gap-3">
              {popupScannerPatterns.length > 0 && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(popupScannerPatterns.join('\n'));
                  }}
                  className="w-full bg-[#4ade80]/10 hover:bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/30 py-3 rounded-lg font-black uppercase text-[10px] tracking-widest transition-colors flex justify-center items-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copiar todos os padrões
                </button>
              )}
              <button
                onClick={() => setPopupScannerPatterns(null)}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 py-3 rounded-lg font-bold uppercase text-[10px] tracking-widest transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MÁXIMAS DIAS */}
      {showMaximasPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#131722] border border-[#1c1c24] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-[#1c1c24] bg-[#13141a]">
              <div className="flex items-center gap-4">
                <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                  Máximas Históricas (Atraso Máximo em {maximasDays} Dias)
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenMaximas(30)} className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-colors ${maximasDays === 30 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}>30d</button>
                  <button onClick={() => handleOpenMaximas(60)} className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-colors ${maximasDays === 60 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}>60d</button>
                  <button onClick={() => handleOpenMaximas(90)} className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-colors ${maximasDays === 90 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}>90d</button>
                </div>
              </div>
              <button onClick={() => setShowMaximasPopup(false)} className="text-gray-400 hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar flex flex-col gap-4">
              {maximasLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-6 h-6 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></div>
                  <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Analisando os últimos {maximasDays} dias de dados...</span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-gray-400 text-xs mb-2">Este painel exibe o **Atraso Máximo em Horas** que cada minuto atingiu nos últimos 30 dias. Valores altos indicam que aquele minuto costuma ficar muito tempo sem pagar branco.</p>
                  {[0, 10, 20, 30, 40, 50].map(start => (
                    <div key={start} className="flex flex-col border border-[#1c1c24] rounded-xl overflow-hidden bg-[#131722]">
                      <div className="grid grid-cols-10 text-center bg-[#13141a] border-b border-[#1c1c24]">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div key={i} className="text-gray-400 font-bold text-[12px] py-1.5 border-r border-[#1c1c24] last:border-0">
                            {String(start + i).padStart(2, '0')}
                          </div>
                        ))}
                      </div>

                      {/* Splits */}
                      <div className="grid grid-cols-10 text-center font-medium text-[10px] border-b border-[#1c1c24] bg-white/[0.01]">
                        {Array.from({ length: 10 }, (_, i) => {
                          const data = maximasData[start + i];
                          const getColor = (v: number) => {
                            if (v > 144) return 'text-rose-500 bg-rose-950/30';
                            if (v > 96) return 'text-rose-500';
                            if (v > 48) return 'text-amber-500';
                            return 'text-emerald-500';
                          };
                          return (
                            <div key={i} className="grid grid-cols-2 border-r border-[#1c1c24] last:border-0">
                              <div className={`py-1.5 border-r border-[#1c1c24] ${getColor(data.sma1)}`}>{data.sma1}h</div>
                              <div className={`py-1.5 ${getColor(data.sma2)}`}>{data.sma2}h</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total */}
                      <div className="grid grid-cols-10 text-center font-black text-[15px]">
                        {Array.from({ length: 10 }, (_, i) => {
                          const data = maximasData[start + i];
                          const max = data.smaTotal;
                          let color = 'text-emerald-500';
                          if (max > 24) color = 'text-amber-500';
                          if (max > 48) color = 'text-rose-500';
                          if (max > 72) color = 'text-white bg-rose-950/50'; // Alerta crítico

                          return (
                            <div key={i} className={`py-3 border-r border-[#1c1c24] last:border-0 transition-colors ${color}`}>
                              {max}h
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

// ── HISTORY PANEL COMPONENTS ──────────────────────────────────────────────────

function RealTimeClock() {
   const [time, setTime] = useState<Date | null>(null);
   useEffect(() => {
      setTime(new Date());
      const timer = setInterval(() => setTime(new Date()), 1000);
      return () => clearInterval(timer);
   }, []);
   if (!time) return <>--:--:--</>;
   return <>{time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>;
}

function HistoryPanel({ playAlert, globalData, histRealTime, setHistRealTime, histFixedCols, setHistFixedCols, histReverse, setHistReverse, histShowSeconds, setHistShowSeconds, isVip }: any) {
  const [frozenData, setFrozenData] = useState<any[]>([]);
  const [activeTool, setActiveTool] = useState<'filtros' | 'notificador' | 'validador'>('filtros');
  
  const [notifPatterns, setNotifPatterns] = useState<any[]>([{ id: 1, name: 'Padrão 1', sequence: [] }]);
  const [notifActiveId, setNotifActiveId] = useState(1);
  const [editingPatternId, setEditingPatternId] = useState<number | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<{start: number, end: number} | null>(null);
    const [validadorMode, setValidadorMode] = useState<'basico' | 'analitico'>('basico');
  const [validadorResult, setValidadorResult] = useState<any>(null);
  const [notificadorActive, setNotificadorActive] = useState(false);
  const [notificadorStats, setNotificadorStats] = useState({ wins: 0, losses: 0, currentSa: 0, maxSa: 0 });
  const lastScoreboardRollId = useRef<number | null>(null);

  const handleToggleNotificador = () => {
     setNotificadorActive(!notificadorActive);
     if (!notificadorActive) {
         setNotificadorStats({ wins: 0, losses: 0, currentSa: 0, maxSa: 0 });
     }
  };

  useEffect(() => {
     if (!notificadorActive || globalData.length === 0) return;
     
     const latestRoll = globalData[0];
     if (lastScoreboardRollId.current === latestRoll.id) return;
     
     const activePattern = notifPatterns.find(p => p.id === notifActiveId);
     if (!activePattern || !activePattern.sequence || activePattern.sequence.length === 0) return;
     
     const seq = activePattern.sequence;
     const target = activePattern.target || 'Branco';
     const gales = activePattern.gales || 0;
     
     let triggerFound = false;
     let hit = false;
     let betFinished = false; // Se a bet já foi ganha ou chegou no limite de gales
     
     // 1. Verificar se a rodada ATUAL é o resultado final de uma entrada em andamento (vitória ou red final)
     for (let g = 0; g <= gales; g++) {
         const triggerIndex = 1 + g; 
         if (globalData.length <= triggerIndex + seq.length - 1) continue;
         
         let isMatch = true;
         for (let p = 0; p < seq.length; p++) {
             const dataRoll = globalData[triggerIndex + seq.length - 1 - p];
             const patternStone = seq[p];
             let col = 'P';
             if (dataRoll.color?.toUpperCase() === 'B' || dataRoll.color?.toUpperCase() === 'BRANCO' || String(dataRoll.roll) === '0') col = 'B';
             else if (dataRoll.color?.toUpperCase() === 'V' || dataRoll.color?.toUpperCase() === 'VERMELHO' || ['1','2','3','4','5','6','7'].includes(String(dataRoll.roll))) col = 'V';
             
             if (patternStone.type === 'color') {
                 if (patternStone.val !== 'ANY' && patternStone.val !== col) { isMatch = false; break; }
             } else if (patternStone.type === 'dual') {
                 if (patternStone.val === 'VP' && col === 'B') { isMatch = false; break; }
                 if (patternStone.val === 'BP' && col === 'V') { isMatch = false; break; }
                 if (patternStone.val === 'BV' && col === 'P') { isMatch = false; break; }
             } else {
                 if (String(dataRoll.roll) !== String(patternStone.val)) { isMatch = false; break; }
             }
         }
         
         if (isMatch) {
             // O padrão disparou exatamente `g` rodadas atrás.
             triggerFound = true;
             
             // Verificar se JÁ GANHOU em algum gale anterior (entre 0 e g-1)
             // O resultado dos gales passados estão em globalData[1] até globalData[g]
             let wonInPreviousGale = false;
             for (let past = 1; past <= g; past++) {
                 const pastRoll = globalData[past];
                 let pastCol = 'P';
                 if (pastRoll.color?.toUpperCase() === 'B' || pastRoll.color?.toUpperCase() === 'BRANCO' || String(pastRoll.roll) === '0') pastCol = 'B';
                 else if (pastRoll.color?.toUpperCase() === 'V' || pastRoll.color?.toUpperCase() === 'VERMELHO' || ['1','2','3','4','5','6','7'].includes(String(pastRoll.roll))) pastCol = 'V';
                 
                 if (target === 'Branco' && pastCol === 'B') wonInPreviousGale = true;
                 if (target === 'Vermelho' && (pastCol === 'V' || pastCol === 'B')) wonInPreviousGale = true; 
                 if (target === 'Preto' && (pastCol === 'P' || pastCol === 'B')) wonInPreviousGale = true;
                 if (wonInPreviousGale) break;
             }
             
             if (!wonInPreviousGale) {
                 // A bet ainda está valendo. Vamos verificar a rodada atual
                 let col = 'P';
                 if (latestRoll.color?.toUpperCase() === 'B' || latestRoll.color?.toUpperCase() === 'BRANCO' || String(latestRoll.roll) === '0') col = 'B';
                 else if (latestRoll.color?.toUpperCase() === 'V' || latestRoll.color?.toUpperCase() === 'VERMELHO' || ['1','2','3','4','5','6','7'].includes(String(latestRoll.roll))) col = 'V';
                 
                 let wonNow = false;
                 if (target === 'Branco' && col === 'B') wonNow = true;
                 if (target === 'Vermelho' && (col === 'V' || col === 'B')) wonNow = true; 
                 if (target === 'Preto' && (col === 'P' || col === 'B')) wonNow = true;
                 
                 if (wonNow) {
                     hit = true;
                     betFinished = true; // Win
                 } else if (g === gales) {
                     hit = false;
                     betFinished = true; // Loss (max gales reached)
                 }
             } else {
                 // Já tinha ganhado no passado
                 betFinished = false; 
             }
             break; 
         }
     }
     
     if (triggerFound && betFinished) {
         setNotificadorStats(prev => {
             const wins = prev.wins + (hit ? 1 : 0);
             const losses = prev.losses + (hit ? 0 : 1);
             const currentSa = hit ? 0 : prev.currentSa + 1;
             const maxSa = Math.max(prev.maxSa, currentSa);
             return { wins, losses, currentSa, maxSa };
         });
     }
     
     // 2. Verificar se o padrão ACABOU DE FORMAR na rodada atual (para tocar o alerta de "Estratégia Confirmada")
     let isMatchNow = true;
     if (globalData.length > seq.length - 1) {
         for (let p = 0; p < seq.length; p++) {
             const dataRoll = globalData[seq.length - 1 - p];
             const patternStone = seq[p];
             let col = 'P';
             if (dataRoll.color?.toUpperCase() === 'B' || dataRoll.color?.toUpperCase() === 'BRANCO' || String(dataRoll.roll) === '0') col = 'B';
             else if (dataRoll.color?.toUpperCase() === 'V' || dataRoll.color?.toUpperCase() === 'VERMELHO' || ['1','2','3','4','5','6','7'].includes(String(dataRoll.roll))) col = 'V';
             
             if (patternStone.type === 'color') {
                 if (patternStone.val !== 'ANY' && patternStone.val !== col) { isMatchNow = false; break; }
             } else if (patternStone.type === 'dual') {
                 if (patternStone.val === 'VP' && col === 'B') { isMatchNow = false; break; }
                 if (patternStone.val === 'BP' && col === 'V') { isMatchNow = false; break; }
                 if (patternStone.val === 'BV' && col === 'P') { isMatchNow = false; break; }
             } else {
                 if (String(dataRoll.roll) !== String(patternStone.val)) { isMatchNow = false; break; }
             }
         }
         
         if (isMatchNow) {
             playAlert();
         }
     }
     
     lastScoreboardRollId.current = latestRoll.id;
  }, [globalData, notificadorActive, notifActiveId, notifPatterns, playAlert]);
  const handleValidarPadrao = () => {
      const activePattern = notifPatterns.find(p => p.id === notifActiveId);
      if (!activePattern || !activePattern.sequence || activePattern.sequence.length === 0) {
         setValidadorResult(null);
         return;
      }
      
      const seq = activePattern.sequence;
      const target = activePattern.target || 'Branco';
      const gales = activePattern.gales || 0;
      
      let wins = 0;
      let losses = 0;
      let winsNoGale = 0;
      let currentSa = 0;
      let maxSa = 0;
      let currentWinStreak = 0;
      let maxWinStreak = 0;

      for (let i = globalData.length - seq.length; i > gales; i--) {
          let isMatch = true;
          for (let p = 0; p < seq.length; p++) {
             const dataRoll = globalData[i + seq.length - 1 - p];
             const patternStone = seq[p];
             let col = 'P';
             if (dataRoll.color?.toUpperCase() === 'B' || dataRoll.color?.toUpperCase() === 'BRANCO' || String(dataRoll.roll) === '0') col = 'B';
             else if (dataRoll.color?.toUpperCase() === 'V' || dataRoll.color?.toUpperCase() === 'VERMELHO' || ['1','2','3','4','5','6','7'].includes(String(dataRoll.roll))) col = 'V';
             
             if (patternStone.type === 'color') {
                 if (patternStone.val !== 'ANY' && patternStone.val !== col) { isMatch = false; break; }
             } else if (patternStone.type === 'dual') {
                 if (patternStone.val === 'VP' && col === 'B') { isMatch = false; break; }
                 if (patternStone.val === 'BP' && col === 'V') { isMatch = false; break; }
                 if (patternStone.val === 'BV' && col === 'P') { isMatch = false; break; }
             } else {
                 if (String(dataRoll.roll) !== String(patternStone.val)) { isMatch = false; break; }
             }
          }

          if (isMatch) {
             let hit = false;
             let hitOnGale0 = false;
             
             for (let g = 0; g <= gales; g++) {
                const betRoll = globalData[i - 1 - g];
                let col = 'P';
                if (betRoll.color?.toUpperCase() === 'B' || betRoll.color?.toUpperCase() === 'BRANCO' || String(betRoll.roll) === '0') col = 'B';
                else if (betRoll.color?.toUpperCase() === 'V' || betRoll.color?.toUpperCase() === 'VERMELHO' || ['1','2','3','4','5','6','7'].includes(String(betRoll.roll))) col = 'V';
                
                let won = false;
                if (target === 'Branco' && col === 'B') won = true;
                if (target === 'Vermelho' && (col === 'V' || col === 'B')) won = true; 
                if (target === 'Preto' && (col === 'P' || col === 'B')) won = true;
                
                if (won) {
                   hit = true;
                   if (g === 0) hitOnGale0 = true;
                   break;
                }
             }

             if (hit) {
                wins++;
                if (hitOnGale0) winsNoGale++;
                currentSa = 0;
                currentWinStreak++;
                if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
             } else {
                losses++;
                currentSa++;
                if (currentSa > maxSa) maxSa = currentSa;
                currentWinStreak = 0;
             }
          }
      }
      
      const total = wins + losses;
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(2) + '%' : '0.00%';
      const noGaleRate = total > 0 ? ((winsNoGale / total) * 100).toFixed(2) + '%' : '0.00%';
      
      setValidadorResult({
         wins, losses, winRate, maxSa, winsNoGale, noGaleRate, maxWinStreak,
         frequencyText: total > 0 ? `A cada ${Math.round((globalData.length / total))} rodadas` : '--',
         freqPercent: total > 0 ? Math.min(100, Math.round(100 * (1 - (maxSa / total)))) : 0
      });
  };
  
  const cycleScrollRef = useRef<HTMLDivElement>(null);
  const scrollState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const handleCycleScroll = (direction: 'left' | 'right') => {
     if (cycleScrollRef.current) {
        cycleScrollRef.current.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
     }
  };

  const onCycleMouseDown = (e: any) => {
     scrollState.current.isDown = true;
     scrollState.current.startX = e.pageX - cycleScrollRef.current!.offsetLeft;
     scrollState.current.scrollLeft = cycleScrollRef.current!.scrollLeft;
  };
  const onCycleMouseLeave = () => { scrollState.current.isDown = false; };
  const onCycleMouseUp = () => { scrollState.current.isDown = false; };
  const onCycleMouseMove = (e: any) => {
     if (!scrollState.current.isDown) return;
     e.preventDefault();
     const x = e.pageX - cycleScrollRef.current!.offsetLeft;
     const walk = (x - scrollState.current.startX) * 1.5;
     cycleScrollRef.current!.scrollLeft = scrollState.current.scrollLeft - walk;
  };

  // Mock de resultados (substituiremos depois pela lógica real)
  const hasValidationResults = validadorResult !== null;

  const handleAddPattern = () => {
     const newId = Date.now();
     const newName = `Padrão ${notifPatterns.length + 1}`;
     setNotifPatterns([...notifPatterns, { id: newId, name: newName, sequence: [] }]);
     setNotifActiveId(newId);
  };

  const handleRenameSubmit = (id: number, newName: string) => {
     if (newName.trim()) {
        setNotifPatterns(prev => prev.map(p => p.id === id ? { ...p, name: newName.trim() } : p));
     }
     setEditingPatternId(null);
  };

  const handleDeletePattern = (id: number) => {
     if (notifPatterns.length <= 1) return;
     const newPatterns = notifPatterns.filter(p => p.id !== id);
     setNotifPatterns(newPatterns);
     if (notifActiveId === id) {
        setNotifActiveId(newPatterns[newPatterns.length - 1].id);
     }
  };

  const updateGales = (gales: number) => {
     setNotifPatterns(prev => prev.map(p => p.id === notifActiveId ? { ...p, gales } : p));
  };

  const updateTarget = (target: string) => {
     setNotifPatterns(prev => prev.map(p => p.id === notifActiveId ? { ...p, target } : p));
  };

  const addStoneToPattern = (stone: any) => {
     setNotifPatterns(prev => prev.map(p => {
        if (p.id === notifActiveId) {
           return { ...p, sequence: [...(p.sequence || []), { ...stone, inverted: false, _id: Date.now() + Math.random() }] };
        }
        return p;
     }));
  };

  const removeOneStoneFromGroup = (index: number) => {
     setNotifPatterns(prev => prev.map(p => {
        if (p.id === notifActiveId) {
           const newSeq = [...(p.sequence || [])];
           newSeq.splice(index, 1);
           return { ...p, sequence: newSeq };
        }
        return p;
     }));
  };

  const handleClearPattern = () => {
     setNotifPatterns(prev => prev.map(p => p.id === notifActiveId ? { ...p, sequence: [] } : p));
  };

  const handleDragEnter = (e: any, targetStart: number) => {
     e.preventDefault();
     if (!draggedBlock) return;
     const { start, end } = draggedBlock;
     if (targetStart >= start && targetStart <= end) return;

     const count = end - start + 1;
     let adjustedTarget = targetStart;
     if (targetStart > start) adjustedTarget -= count;
     
     setNotifPatterns(prev => prev.map(p => {
        if (p.id === notifActiveId) {
           const newSeq = [...(p.sequence || [])];
           const draggedItems = newSeq.splice(start, count);
           newSeq.splice(adjustedTarget, 0, ...draggedItems);
           return { ...p, sequence: newSeq };
        }
        return p;
     }));
     
     setDraggedBlock({ start: adjustedTarget, end: adjustedTarget + count - 1 });
  };

  const handleDragEnd = (e: any) => {
     if (e.dataTransfer.dropEffect === 'none' && draggedBlock) {
        setNotifPatterns(prev => prev.map(p => {
           if (p.id === notifActiveId) {
              const newSeq = [...(p.sequence || [])];
              newSeq.splice(draggedBlock.start, draggedBlock.end - draggedBlock.start + 1);
              return { ...p, sequence: newSeq };
           }
           return p;
        }));
     }
     setDraggedBlock(null);
  };

  const toggleInvertGroup = (start: number, end: number) => {
     setNotifPatterns(prev => prev.map(p => {
        if (p.id === notifActiveId) {
           const newSeq = [...(p.sequence || [])];
           const firstState = newSeq[start].inverted;
           for (let k = start; k <= end; k++) {
               newSeq[k] = { ...newSeq[k], inverted: !firstState };
           }
           return { ...p, sequence: newSeq };
        }
        return p;
     }));
  };

  const renderStoneUI = (stone: any) => {
     let content = null;
     if (stone.type === 'number') content = <GlobalStoneIcon n={stone.val} size="md" />;
     else if (stone.type === 'color') {
        if (stone.val === 'ANY') content = <div className="rounded flex items-center justify-center shrink-0 w-7 h-7 bg-[#008ce3] shadow-sm"><div className="rounded-full flex items-center justify-center w-7 h-7 border-[1.5px] border-white/80"></div></div>;
        if (stone.val === 'V') content = <div className="rounded flex items-center justify-center shrink-0 w-7 h-7 bg-[#E51E3E] shadow-sm"><div className="rounded-full flex items-center justify-center w-7 h-7 border-[1.5px] border-white/80"></div></div>;
        if (stone.val === 'P') content = <div className="rounded flex items-center justify-center shrink-0 w-7 h-7 bg-[#2C2F33] shadow-sm"><div className="rounded-full flex items-center justify-center w-7 h-7 border-[1px] border-white/40"></div></div>;
        if (stone.val === 'B') content = <GlobalStoneIcon n={0} size="md" />;
     }
     else if (stone.type === 'dual') {
        if (stone.val === 'VP') content = <div className="rounded flex items-center justify-center shrink-0 w-7 h-7 shadow-sm relative overflow-hidden"><div className="w-1/2 h-full bg-[#E51E3E]"></div><div className="w-1/2 h-full bg-[#2C2F33]"></div><div className="absolute rounded-full w-7 h-7 border-[1.5px] border-white/80 shadow-[0_0_2px_rgba(0,0,0,0.5)]"></div></div>;
        if (stone.val === 'BP') content = <div className="rounded flex items-center justify-center shrink-0 w-7 h-7 shadow-sm relative overflow-hidden border border-[#2C2F33]/20 bg-white"><div className="w-1/2 h-full bg-white"></div><div className="w-1/2 h-full bg-[#2C2F33]"></div><div className="absolute rounded-full w-7 h-7 border-[1.5px] border-[#2C2F33]/30 shadow-[0_0_2px_rgba(0,0,0,0.2)]"></div></div>;
        if (stone.val === 'BV') content = <div className="rounded flex items-center justify-center shrink-0 w-7 h-7 shadow-sm relative overflow-hidden border border-[#E51E3E]/20 bg-white"><div className="w-1/2 h-full bg-white"></div><div className="w-1/2 h-full bg-[#E51E3E]"></div><div className="absolute rounded-full w-7 h-7 border-[1.5px] border-[#E51E3E]/50 shadow-[0_0_2px_rgba(0,0,0,0.1)]"></div></div>;
     }
     return (
        <div className="relative pointer-events-none">
           {content}
           {stone.inverted && (
              <div className="absolute inset-0 bg-red-950/60 rounded flex items-center justify-center z-20 backdrop-blur-[0.5px]">
                 <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3" strokeLinecap="round" className="w-7 h-7 opacity-90"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
              </div>
           )}
        </div>
     );
  };

  const activePatternSeq = notifPatterns.find(p => p.id === notifActiveId)?.sequence || [];

  const blocks = [];
  let _i = 0;
  while (_i < activePatternSeq.length) {
     let _j = _i;
     while (_j < activePatternSeq.length && 
            activePatternSeq[_j].type === activePatternSeq[_i].type && 
            activePatternSeq[_j].val === activePatternSeq[_i].val &&
            !!activePatternSeq[_j].inverted === !!activePatternSeq[_i].inverted) {
        _j++;
     }
     const count = _j - _i;
     if (count >= 3) {
        blocks.push({ isGroup: true, startIndex: _i, endIndex: _j - 1, count, item: activePatternSeq[_i], _id: activePatternSeq[_i]._id + '_group' });
     } else {
        for (let k = _i; k < _j; k++) {
           blocks.push({ isGroup: false, startIndex: k, endIndex: k, count: 1, item: activePatternSeq[k], _id: activePatternSeq[k]._id });
        }
     }
     _i = _j;
  }

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [fQty, setFQty] = useState<number | ''>(200);
  const [fDateStart, setFDateStart] = useState('');
  const [fDateEnd, setFDateEnd] = useState('');
  const [fTimeStart, setFTimeStart] = useState('');
  const [fTimeEnd, setFTimeEnd] = useState('');
  const [fColor, setFColor] = useState('Todas');
  const [fNum, setFNum] = useState('Todos');
  const [fHour, setFHour] = useState('Todas');
  const [fMin, setFMin] = useState('Todos');
  const [fSec, setFSec] = useState('Todos');
  const [fLastMin, setFLastMin] = useState('Todos');
  const [appliedFilters, setAppliedFilters] = useState<any>(null);

  const applyShortcut = (type: string) => {
     const today = new Date();
     const tzOffset = today.getTimezoneOffset() * 60000;
     const localToday = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
     const yesterday = new Date(Date.now() - 86400000);
     const localYesterday = new Date(yesterday.getTime() - tzOffset).toISOString().split('T')[0];

     let newFQty: any = '';
     let newFDateStart = '';
     let newFDateEnd = '';
     let newFColor = 'Todas';

     if (type === '200') {
         newFQty = 200;
     } else if (type === 'hoje') { 
         newFQty = 3000;
         newFDateStart = localToday; 
         newFDateEnd = localToday; 
     } else if (type === 'ontem') { 
         newFQty = 3000;
         newFDateStart = localYesterday; 
         newFDateEnd = localYesterday; 
     } else if (type === 'branco') { 
         newFColor = 'Brancos'; 
     } else if (type === 'preto') { 
         newFColor = 'Pretos'; 
     } else if (type === 'vermelho') { 
         newFColor = 'Vermelhos'; 
     }

     setFQty(newFQty);
     setFDateStart(newFDateStart);
     setFDateEnd(newFDateEnd);
     setFTimeStart('');
     setFTimeEnd('');
     setFColor(newFColor);
     setFNum('Todos');
     setFHour('Todas');
     setFMin('Todos');
     setFSec('Todos');
     setFLastMin('Todos');

     setAppliedFilters({
         fQty: newFQty,
         fDateStart: newFDateStart,
         fDateEnd: newFDateEnd,
         fTimeStart: '',
         fTimeEnd: '',
         fColor: newFColor,
         fNum: 'Todos',
         fHour: 'Todas',
         fMin: 'Todos',
         fSec: 'Todos',
         fLastMin: 'Todos'
     });
  };

  const handleApplyFilter = () => {
     setAppliedFilters({ fQty, fDateStart, fDateEnd, fTimeStart, fTimeEnd, fColor, fNum, fHour, fMin, fSec, fLastMin });
  };

  const handleExportCSV = () => {
     // Pegar até 20.000 linhas, do mais novo pro mais antigo
     let exportData = [...activeData].reverse().slice(0, 20000);
     if (!isVip && exportData.length > 5000) {
        exportData = exportData.slice(0, 5000);
        alert('Exportação limitada a 5.000 registros no plano Gratuito. Assine o VIP para exportar o histórico completo (20.000).');
     }
     
     if (exportData.length === 0) {
        alert('Nenhum dado para exportar.');
        return;
     }

     // Cabeçalho CSV com BOM para Excel reconhecer acentuação (UTF-8)
     let csvContent = "\uFEFFCódigo da Pedra,Número da Pedra,Cor da Pedra,Horário da Pedra\n";

     exportData.forEach(row => {
        let colorName = row.color || '';
        const n = Number(row.roll);
        if (n === 0) colorName = 'Branco';
        else if (n >= 1 && n <= 7) colorName = 'Vermelho';
        else if (n >= 8 && n <= 14) colorName = 'Preto';

        const id = row.id || '-';
        const dateStr = new Date(row.timestamp).toLocaleString('pt-BR');
        
        csvContent += `${id},${n},${colorName},${dateStr}\n`;
     });

     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", `historico_blaze_${new Date().getTime()}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };
  
  useEffect(() => {
     if (!histRealTime) {
        setFrozenData([...globalData]);
     }
  }, [histRealTime]); // Apenas quando o toggle for clicado

  const activeData = histRealTime ? globalData : frozenData;

  const filteredData = useMemo(() => {
     let arr = [...activeData];
     
     if (appliedFilters) {
         if (appliedFilters.fDateStart) {
             const ds = new Date(appliedFilters.fDateStart + 'T00:00:00-03:00').getTime();
             arr = arr.filter(r => new Date(r.timestamp).getTime() >= ds);
         }
         if (appliedFilters.fDateEnd) {
             const de = new Date(appliedFilters.fDateEnd + 'T23:59:59-03:00').getTime();
             arr = arr.filter(r => new Date(r.timestamp).getTime() <= de);
         }
         if (appliedFilters.fTimeStart || appliedFilters.fTimeEnd) {
             arr = arr.filter(r => {
                 const loc = new Date(new Date(r.timestamp).getTime() - 3 * 3600 * 1000);
                 const mins = loc.getUTCHours() * 60 + loc.getUTCMinutes();
                 let pass = true;
                 if (appliedFilters.fTimeStart) {
                     const [sh, sm] = appliedFilters.fTimeStart.split(':').map(Number);
                     if (mins < sh * 60 + sm) pass = false;
                 }
                 if (appliedFilters.fTimeEnd) {
                     const [eh, em] = appliedFilters.fTimeEnd.split(':').map(Number);
                     if (mins > eh * 60 + em) pass = false;
                 }
                 return pass;
             });
         }
         
         if (appliedFilters.fColor !== 'Todas') {
             arr = arr.filter(r => {
                 const n = Number(r.roll);
                 if (appliedFilters.fColor === 'Brancos') return n === 0;
                 if (appliedFilters.fColor === 'Vermelhos') return n >= 1 && n <= 7;
                 if (appliedFilters.fColor === 'Pretos') return n >= 8 && n <= 14;
                 return true;
             });
         }

         if (appliedFilters.fNum !== 'Todos') {
             arr = arr.filter(r => Number(r.roll) === Number(appliedFilters.fNum));
         }

         if (appliedFilters.fHour !== 'Todas') {
             arr = arr.filter(r => {
                 const loc = new Date(new Date(r.timestamp).getTime() - 3 * 3600 * 1000);
                 return loc.getUTCHours() === Number(appliedFilters.fHour);
             });
         }

         if (appliedFilters.fMin !== 'Todos') {
             arr = arr.filter(r => {
                 const loc = new Date(new Date(r.timestamp).getTime() - 3 * 3600 * 1000);
                 return loc.getUTCMinutes() === Number(appliedFilters.fMin);
             });
         }

         if (appliedFilters.fSec !== 'Todos') {
             arr = arr.filter(r => {
                 const loc = new Date(new Date(r.timestamp).getTime() - 3 * 3600 * 1000);
                 return loc.getUTCSeconds() === Number(appliedFilters.fSec);
             });
         }

         if (appliedFilters.fLastMin !== 'Todos') {
             arr = arr.filter(r => {
                 const loc = new Date(new Date(r.timestamp).getTime() - 3 * 3600 * 1000);
                 return (loc.getUTCMinutes() % 10) === Number(appliedFilters.fLastMin);
             });
         }

         if (appliedFilters.fQty !== '' && appliedFilters.fQty > 0) {
             arr = arr.slice(-appliedFilters.fQty);
         } else {
             arr = arr.slice(-600); // safety fallback
         }
     } else {
         arr = arr.slice(-200); // Padrão antes de filtrar
     }

     return arr;
  }, [activeData, appliedFilters]);

  const historyData = useMemo(() => {
     let arr = [...filteredData];
     arr.reverse(); // Sempre o mais novo no index 0
     return arr;
  }, [filteredData]);

  const Toggle = ({ label, checked, onChange }: any) => (
    <label className="flex items-center gap-2 cursor-pointer group">
       <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
       <div className={`relative w-8 h-4 rounded-full transition-colors ${checked ? 'bg-[#3b82f6]' : 'bg-slate-700'}`}>
          <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
       </div>
       <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-white transition-colors flex items-center gap-1.5">
          {label}
       </span>
    </label>
  );



  const F_INPUT = "w-full bg-[#0b0e14] border border-white/10 text-white text-[11px] px-3 py-2 rounded outline-none focus:border-[#00c83a] transition-colors";
  const F_LABEL = "text-[10px] font-bold text-slate-400 mb-1.5 block";
  const F_SELECT = "w-full bg-[#0b0e14] border border-white/10 text-white text-[11px] px-3 py-2 rounded outline-none focus:border-[#00c83a] transition-colors appearance-none";

  return (
    <div className="flex flex-col gap-4 h-[1800px] w-full">
      <div className="flex flex-col">
         <div className="flex items-end gap-1 px-4">
            <button onClick={() => { setActiveTool('filtros'); setIsFilterOpen(true); }} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t ${activeTool === 'filtros' ? 'bg-[#0f141e]/90 text-[#00c83a] border-[#00c83a]/25 border-b-transparent shadow-[0_-4px_20px_rgba(0,98,255,0.15)] relative z-10' : 'bg-[#0b0e14]/50 text-slate-500 hover:text-slate-300 hover:bg-[#0f141e]/60 border-transparent hover:border-white/5 border-b-[#00c83a]/25'}`}>Filtros</button>
            <button onClick={() => { setActiveTool('notificador'); setIsFilterOpen(true); }} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t ${activeTool === 'notificador' ? 'bg-[#0f141e]/90 text-[#00c83a] border-[#00c83a]/25 border-b-transparent shadow-[0_-4px_20px_rgba(0,98,255,0.15)] relative z-10' : 'bg-[#0b0e14]/50 text-slate-500 hover:text-slate-300 hover:bg-[#0f141e]/60 border-transparent hover:border-white/5 border-b-[#00c83a]/25'}`}>Notificador de padrão</button>
            <button onClick={() => { setActiveTool('validador'); setIsFilterOpen(true); }} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-t-xl border-x border-t ${activeTool === 'validador' ? 'bg-[#0f141e]/90 text-[#00c83a] border-[#00c83a]/25 border-b-transparent shadow-[0_-4px_20px_rgba(0,98,255,0.15)] relative z-10' : 'bg-[#0b0e14]/50 text-slate-500 hover:text-slate-300 hover:bg-[#0f141e]/60 border-transparent hover:border-white/5 border-b-[#00c83a]/25'}`}>Validador de padrão</button>
         </div>

         <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-b-xl rounded-tr-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] shrink-0 transition-all duration-300 -mt-px relative z-0">
            <button 
               onClick={() => setIsFilterOpen(!isFilterOpen)}
               className="bg-[#00c83a] hover:bg-blue-600 text-white text-[8px] font-black tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors uppercase shadow-md"
            >
               {isFilterOpen ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
               ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
               )}
               {isFilterOpen ? 'Ocultar' : 'Exibir'}
            </button>
            <div className="w-px h-6 bg-white/10"></div>
            <Toggle label="Tempo real" checked={histRealTime} onChange={() => setHistRealTime(!histRealTime)} />
            <Toggle label="Colunas fixas" checked={histFixedCols} onChange={() => setHistFixedCols(!histFixedCols)} />
            <Toggle label="Sentido inverso" checked={histReverse} onChange={() => setHistReverse(!histReverse)} />
            <Toggle label="Exibir segundos" checked={histShowSeconds} onChange={() => setHistShowSeconds(!histShowSeconds)} />
         </div>
      </div>



      {isFilterOpen && (
         <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg p-5 shrink-0 flex flex-col gap-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300">
            {activeTool === 'filtros' && (
               <>
            {/* Shortcuts */}
            <div className="flex flex-wrap items-center justify-between text-[11px] font-bold text-slate-400 bg-[#0b0e14]/50 border border-[#00c83a]/20 px-4 py-3 rounded-lg shadow-inner gap-4">
               <div className="flex flex-wrap items-center gap-6">
                  <span className="cursor-pointer hover:text-white transition-colors" onClick={() => applyShortcut('200')}>200 rodadas</span>
                  <span className="cursor-pointer hover:text-white transition-colors" onClick={() => applyShortcut('hoje')}>De hoje</span>
                  <span className="cursor-pointer hover:text-white transition-colors" onClick={() => applyShortcut('ontem')}>De ontem</span>
                  <span className="cursor-pointer hover:text-white transition-colors" onClick={() => applyShortcut('branco')}>Só brancos</span>
                  <span className="cursor-pointer hover:text-white transition-colors" onClick={() => applyShortcut('preto')}>Só pretos</span>
                  <span className="cursor-pointer hover:text-white transition-colors" onClick={() => applyShortcut('vermelho')}>Só vermelhos</span>
               </div>
               
               <button 
                  onClick={handleExportCSV} 
                  className="ml-auto flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white px-3 py-1.5 rounded transition-all uppercase tracking-widest text-[9px] font-black active:scale-95 shadow-sm"
                  title="Baixar histórico em Excel/CSV (Máx. 20.000 linhas)"
               >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Exportar Excel
               </button>
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
               <div>
                  <label className={F_LABEL}>Quantidade</label>
                  <input type="number" className={F_INPUT} value={fQty} onChange={e => {
                     let val: any = e.target.value ? +e.target.value : '';
                     if (!isVip && typeof val === 'number' && val > 5000) {
                        alert('Limite de 5.000 resultados na tela para usuários Free. Assine o VIP para buscar até 20.000.');
                        val = 5000;
                     }
                     setFQty(val);
                  }} />
               </div>
               <div>
                  <label className={F_LABEL}>Data inicial</label>
                  <input type="date" className={F_INPUT} value={fDateStart} onChange={e => setFDateStart(e.target.value)} />
               </div>
               <div>
                  <label className={F_LABEL}>Data final</label>
                  <input type="date" className={F_INPUT} value={fDateEnd} onChange={e => setFDateEnd(e.target.value)} />
               </div>
               <div>
                  <label className={F_LABEL}>Hora inicial</label>
                  <input type="time" className={F_INPUT} value={fTimeStart} onChange={e => setFTimeStart(e.target.value)} />
               </div>
               <div>
                  <label className={F_LABEL}>Hora final</label>
                  <input type="time" className={F_INPUT} value={fTimeEnd} onChange={e => setFTimeEnd(e.target.value)} />
               </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
               <div>
                  <label className={F_LABEL}>Por cores</label>
                  <select className={F_SELECT} value={fColor} onChange={e => setFColor(e.target.value)}>
                     <option>Todas</option>
                     <option>Brancos</option>
                     <option>Pretos</option>
                     <option>Vermelhos</option>
                  </select>
               </div>
               <div>
                  <label className={F_LABEL}>Por número</label>
                  <select className={F_SELECT} value={fNum} onChange={e => setFNum(e.target.value)}>
                     <option>Todos</option>
                     {Array.from({length: 15}, (_,i) => <option key={i} value={i}>{i}</option>)}
                  </select>
               </div>
               <div>
                  <label className={F_LABEL}>Por hora</label>
                  <select className={F_SELECT} value={fHour} onChange={e => setFHour(e.target.value)}>
                     <option>Todas</option>
                     {Array.from({length: 24}, (_,i) => <option key={i} value={i.toString().padStart(2,'0')}>{i.toString().padStart(2,'0')}</option>)}
                  </select>
               </div>
               <div>
                  <label className={F_LABEL}>Por minuto</label>
                  <select className={F_SELECT} value={fMin} onChange={e => setFMin(e.target.value)}>
                     <option>Todos</option>
                     {Array.from({length: 60}, (_,i) => <option key={i} value={i.toString().padStart(2,'0')}>{i.toString().padStart(2,'0')}</option>)}
                  </select>
               </div>
               <div>
                  <label className={F_LABEL}>Por segundo</label>
                  <select className={F_SELECT} value={fSec} onChange={e => setFSec(e.target.value)}>
                     <option>Todos</option>
                     {Array.from({length: 60}, (_,i) => <option key={i} value={i.toString().padStart(2,'0')}>{i.toString().padStart(2,'0')}</option>)}
                  </select>
               </div>
               <div>
                  <label className={F_LABEL}>Pelo último minuto</label>
                  <select className={F_SELECT} value={fLastMin} onChange={e => setFLastMin(e.target.value)}>
                     <option>Todos</option>
                     {Array.from({length: 10}, (_,i) => <option key={i} value={i}>{i}</option>)}
                  </select>
               </div>
            </div>

            {/* Actions */}
            <div className="flex pt-4 border-t border-[#2a2a35]">
               <button 
                  onClick={handleApplyFilter}
                  className="bg-[#00c83a] hover:bg-blue-600 text-white text-[11px] font-black tracking-widest px-8 py-3 rounded-lg transition-colors uppercase flex items-center gap-2 shadow-lg"
               >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                  Filtrar
               </button>
            </div>
               </>
            )}

            {(activeTool === 'notificador' || activeTool === 'validador') && (
               <div className="flex flex-col gap-4 w-full animate-fade-in">
                  {/* Header: Tabs de Padrões */}
                  <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                     {notifPatterns.map(p => (
                        <div key={p.id} onClick={() => { if (editingPatternId !== p.id) setNotifActiveId(p.id); }} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all border ${notifActiveId === p.id ? 'bg-[#00c83a] border-[#00c83a] text-white shadow-[0_0_15px_rgba(0,98,255,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                           {editingPatternId === p.id ? (
                              <input 
                                 autoFocus
                                 defaultValue={p.name}
                                 onBlur={(e) => handleRenameSubmit(p.id, e.target.value)}
                                 onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSubmit(p.id, e.currentTarget.value);
                                    if (e.key === 'Escape') setEditingPatternId(null);
                                 }}
                                 className="text-[12px] font-bold bg-transparent border-b border-white/30 outline-none w-24 text-white placeholder-white/40"
                              />
                           ) : (
                              <>
                                 <span className="text-[12px] font-bold whitespace-nowrap">{p.name}</span>
                                 <div className="flex items-center gap-0.5 ml-1">
                                    <button 
                                       onClick={(e) => { e.stopPropagation(); setEditingPatternId(p.id); }} 
                                       className="opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-black/20" 
                                       title="Renomear Padrão"
                                    >
                                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                    </button>
                                    {notifPatterns.length > 1 && (
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); handleDeletePattern(p.id); }} 
                                          className="opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-red-500/20 text-slate-300 hover:text-red-400" 
                                          title="Excluir Padrão"
                                       >
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                       </button>
                                    )}
                                 </div>
                              </>
                           )}
                        </div>
                     ))}
                     <button onClick={handleAddPattern} className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-all shrink-0 ml-1" title="Criar novo padrão">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                     </button>
                  </div>

                  {/* Body: Seção Padrão e Resultados */}
                  <div className="flex gap-6 items-stretch w-full">
                     {/* Coluna do Construtor */}
                     <div className="bg-[#0b0e14]/50 border border-white/5 rounded-xl p-5 flex flex-col gap-6 shadow-inner flex-1 min-w-0">
                     <div className="flex justify-between items-center">
                        <span className="text-[12px] font-black uppercase tracking-widest text-slate-400">Construir Padrão:</span>
                        <button onClick={handleClearPattern} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Limpar padrão">
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                     </div>

                     {/* Sequence Display Area */}
                     <div className="bg-[#12141c] border border-white/5 rounded-lg p-3 min-h-[70px] flex items-center gap-2 flex-wrap mb-2">
                        {blocks.length === 0 ? (
                           <span className="text-[11px] text-slate-500 font-bold mx-auto w-full text-center">Nenhuma pedra selecionada. Clique abaixo para construir.</span>
                        ) : (
                           blocks.map((block: any) => (
                              <div 
                                 key={block._id} 
                                 draggable
                                 onDragStart={(e) => {
                                    setDraggedBlock({ start: block.startIndex, end: block.endIndex });
                                    e.dataTransfer.effectAllowed = 'move';
                                 }}
                                 onDragEnter={(e) => handleDragEnter(e, block.startIndex)}
                                 onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                 onDragEnd={handleDragEnd}
                                 className={`relative cursor-move group transition-all duration-300 ${draggedBlock && draggedBlock.start === block.startIndex ? 'opacity-30 scale-90' : 'hover:scale-105'}`}
                              >
                                 <button onClick={() => removeOneStoneFromGroup(block.endIndex)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110 shadow-sm border border-red-700" title="Excluir (1)">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                 </button>
                                 
                                 <button onClick={() => toggleInvertGroup(block.startIndex, block.endIndex)} className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-orange-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110 shadow-sm border border-orange-700" title="Alternar: Quando NÃO sair">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                                 </button>

                                 {block.isGroup && (
                                    <div className="absolute -top-2 -left-2 w-5 h-5 bg-[#00c83a] text-white font-black text-[10px] rounded-full flex items-center justify-center border-2 border-[#12141c] z-30 shadow-sm">
                                       {block.count}
                                    </div>
                                 )}

                                 {renderStoneUI(block.item)}
                              </div>
                           ))
                        )}
                     </div>

                     <div className="flex flex-col gap-6">
                        {/* Cores */}
                        <div className="flex flex-col gap-3">
                           <span className="text-[12px] font-bold text-slate-400">Montar usando cores:</span>
                           <div className="flex flex-wrap gap-2">
                              {/* Azul (Qualquer) */}
                              <button onClick={() => addStoneToPattern({type:'color',val:'ANY'})} className="rounded flex items-center justify-center shrink-0 w-7 h-7 bg-[#008ce3] shadow-sm hover:scale-105 active:scale-95 transition-transform"><div className="rounded-full flex items-center justify-center w-7 h-7 border-[1.5px] border-white/80 pointer-events-none"></div></button>
                              {/* Vermelho */}
                              <button onClick={() => addStoneToPattern({type:'color',val:'V'})} className="rounded flex items-center justify-center shrink-0 w-7 h-7 bg-[#E51E3E] shadow-sm hover:scale-105 active:scale-95 transition-transform"><div className="rounded-full flex items-center justify-center w-7 h-7 border-[1.5px] border-white/80 pointer-events-none"></div></button>
                              {/* Preto */}
                              <button onClick={() => addStoneToPattern({type:'color',val:'P'})} className="rounded flex items-center justify-center shrink-0 w-7 h-7 bg-[#2C2F33] shadow-sm hover:scale-105 active:scale-95 transition-transform"><div className="rounded-full flex items-center justify-center w-7 h-7 border-[1px] border-white/40 pointer-events-none"></div></button>
                              {/* Branco / Blaze */}
                              <button onClick={() => addStoneToPattern({type:'color',val:'B'})} className="hover:scale-105 active:scale-95 transition-transform"><div className="pointer-events-none"><GlobalStoneIcon n={0} size="md" /></div></button>
                              {/* Vermelho / Preto */}
                              <button onClick={() => addStoneToPattern({type:'dual',val:'VP'})} className="rounded flex items-center justify-center shrink-0 w-7 h-7 shadow-sm hover:scale-105 active:scale-95 transition-transform relative overflow-hidden"><div className="w-1/2 h-full bg-[#E51E3E] pointer-events-none"></div><div className="w-1/2 h-full bg-[#2C2F33] pointer-events-none"></div><div className="absolute rounded-full w-7 h-7 border-[1.5px] border-white/80 shadow-[0_0_2px_rgba(0,0,0,0.5)] pointer-events-none"></div></button>
                              {/* Branco / Preto */}
                              <button onClick={() => addStoneToPattern({type:'dual',val:'BP'})} className="rounded flex items-center justify-center shrink-0 w-7 h-7 shadow-sm hover:scale-105 active:scale-95 transition-transform relative overflow-hidden border border-[#2C2F33]/20 bg-white"><div className="w-1/2 h-full bg-white pointer-events-none"></div><div className="w-1/2 h-full bg-[#2C2F33] pointer-events-none"></div><div className="absolute rounded-full w-7 h-7 border-[1.5px] border-[#2C2F33]/30 shadow-[0_0_2px_rgba(0,0,0,0.2)] pointer-events-none"></div></button>
                              {/* Branco / Vermelho */}
                              <button onClick={() => addStoneToPattern({type:'dual',val:'BV'})} className="rounded flex items-center justify-center shrink-0 w-7 h-7 shadow-sm hover:scale-105 active:scale-95 transition-transform relative overflow-hidden border border-[#E51E3E]/20 bg-white"><div className="w-1/2 h-full bg-white pointer-events-none"></div><div className="w-1/2 h-full bg-[#E51E3E] pointer-events-none"></div><div className="absolute rounded-full w-7 h-7 border-[1.5px] border-[#E51E3E]/50 shadow-[0_0_2px_rgba(0,0,0,0.1)] pointer-events-none"></div></button>
                           </div>
                        </div>

                        {/* Números */}
                        <div className="flex flex-col gap-3">
                           <span className="text-[12px] font-bold text-slate-400">Montar usando números:</span>
                           <div className="flex flex-wrap gap-2">
                              {/* 0 */}
                              <button onClick={() => addStoneToPattern({type:'number',val:0})} className="hover:scale-105 active:scale-95 transition-transform"><div className="pointer-events-none"><GlobalStoneIcon n={0} size="md" /></div></button>
                              {/* 1 to 7 */}
                              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                 <button key={n} onClick={() => addStoneToPattern({type:'number',val:n})} className="hover:scale-105 active:scale-95 transition-transform"><div className="pointer-events-none"><GlobalStoneIcon n={n} size="md" /></div></button>
                              ))}
                              {/* 8 to 14 */}
                              {[8, 9, 10, 11, 12, 13, 14].map(n => (
                                 <button key={n} onClick={() => addStoneToPattern({type:'number',val:n})} className="hover:scale-105 active:scale-95 transition-transform"><div className="pointer-events-none"><GlobalStoneIcon n={n} size="md" /></div></button>
                              ))}
                           </div>
                        </div>
                     </div>
                     
                     {/* Configurações de Aposta */}
                     <div className="flex items-center gap-6 pt-5 mt-2 border-t border-[#2a2a35]">
                        <div className="flex flex-col gap-2 w-1/4">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gales</label>
                           <div className="flex items-center bg-[#0b0e14] border border-white/10 rounded-lg overflow-hidden h-10">
                              <button onClick={() => updateGales(Math.max(0, ((notifPatterns.find(p => p.id === notifActiveId)?.gales) || 0) - 1))} className="px-3 h-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors border-r border-white/10 flex items-center justify-center">-</button>
                              <span className="flex-1 text-center text-[12px] font-bold text-white">{(notifPatterns.find(p => p.id === notifActiveId)?.gales) || 0}</span>
                              <button onClick={() => updateGales(((notifPatterns.find(p => p.id === notifActiveId)?.gales) || 0) + 1)} className="px-3 h-full text-slate-400 hover:text-white hover:bg-white/5 transition-colors border-l border-white/10 flex items-center justify-center">+</button>
                           </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vitória em</label>
                           <select 
                              value={(notifPatterns.find(p => p.id === notifActiveId)?.target) || 'Branco'}
                              onChange={(e) => updateTarget(e.target.value)}
                              className="bg-[#0b0e14] border border-white/10 rounded-lg px-3 h-10 text-[12px] font-bold text-white outline-none focus:border-[#00c83a] transition-colors w-full appearance-none"
                           >
                              <option value="Branco">Branco</option>
                              <option value="Vermelho">Vermelho</option>
                              <option value="Vermelho e Branco">Vermelho e Branco</option>
                              <option value="Preto">Preto</option>
                              <option value="Preto e Branco">Preto e Branco</option>
                           </select>
                        </div>
                     </div>

                     {/* Actions: Notificador / Validador */}
                     {activeTool === 'notificador' && (
                        <div className="flex pt-4 mt-2 border-t border-[#2a2a35]">
                           <button onClick={handleToggleNotificador} className={`${notificadorActive ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-[#00c83a] hover:bg-blue-600 shadow-lg'} text-white text-[11px] font-black tracking-widest px-8 py-3 rounded-lg transition-colors uppercase flex items-center gap-2`}>
                              {notificadorActive ? <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>}
                              {notificadorActive ? 'Parar Notificador' : 'Ativar Notificador'}
                           </button>
                        </div>
                     )}
                     
                     {activeTool === 'validador' && (
                        <div className="flex flex-col pt-4 mt-2 border-t border-[#2a2a35]">
                           <button onClick={handleValidarPadrao} className="bg-[#00c83a] hover:bg-blue-600 text-white text-[11px] font-black tracking-widest px-8 py-3 rounded-lg transition-colors uppercase flex items-center gap-2 shadow-lg w-max">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                              Validar Padrão
                           </button>
                        </div>
                     )}
                     </div>

                     {/* Coluna de Resultados (Apenas Validador) */}
                     {activeTool === 'validador' && (
                        <div className="bg-[#0b0e14]/50 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-inner w-[400px] shrink-0">
                           <div className="flex justify-between items-center pb-2 border-b border-white/5">
                              <span className="text-[12px] font-black uppercase tracking-widest text-slate-400">Resultados</span>
                              <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/5">
                                 <button onClick={() => setValidadorMode('basico')} className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${validadorMode === 'basico' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Básico</button>
                                 <button onClick={() => alert('Em breve!')} className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all flex items-center gap-1.5 ${validadorMode === 'analitico' ? 'bg-[#00c83a]/20 text-blue-400 shadow-sm border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    Premium
                                 </button>
                              </div>
                           </div>
                           
                           {validadorMode === 'basico' ? (
                              <div className="flex flex-col gap-2.5 overflow-y-auto custom-scrollbar pr-2 h-[450px]">
                                 
                                 <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-300">Vitórias:</span>
                                    <div className="flex items-center gap-1.5">
                                       <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? validadorResult.wins : '--'}</span>
                                       <span className="text-slate-500 text-[10px]">•</span>
                                       <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? validadorResult.winRate : '--%'}</span>
                                    </div>
                                 </div>
                                 <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-300">Sequência de vitórias:</span>
                                    <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? validadorResult.maxWinStreak : '--'}</span>
                                 </div>
                                 <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm mt-1">
                                    <span className="text-[11px] font-bold text-slate-300">Vitória (sem gale):</span>
                                    <div className="flex items-center gap-1.5">
                                       <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? validadorResult.winsNoGale : '--'}</span>
                                       <span className="text-slate-500 text-[10px]">•</span>
                                       <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? validadorResult.noGaleRate : '--%'}</span>
                                    </div>
                                 </div>
                                 
                                 {Array.from({length: (notifPatterns.find(p => p.id === notifActiveId)?.gales) || 0}).map((_, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm">
                                       <span className="text-[11px] font-bold text-slate-300">Vitória (gale {i + 1}):</span>
                                       <div className="flex items-center gap-1.5">
                                          <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? validadorResult.losses : '--'}</span>
                                          <span className="text-slate-500 text-[10px]">•</span>
                                          <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? '0.00%' : '--%'}</span>
                                       </div>
                                    </div>
                                 ))}

                                 <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm mt-1">
                                    <span className="text-[11px] font-bold text-slate-300">Derrotas:</span>
                                    <div className="flex items-center gap-1.5">
                                       <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? validadorResult.losses : '--'}</span>
                                       <span className="text-slate-500 text-[10px]">•</span>
                                       <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? '0.00%' : '--%'}</span>
                                    </div>
                                 </div>
                                 <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-300">Sequência de derrotas (Máx SA):</span>
                                    <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{hasValidationResults ? validadorResult.maxSa : '--'}</span>
                                 </div>
                              </div>
                           ) : (
                              <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 h-[450px]">
                                 {/* 1. Score da IA */}
                                 <div className="bg-gradient-to-r from-blue-900/40 to-transparent border border-blue-500/20 rounded-lg p-4 flex items-center justify-between shadow-inner">
                                    <div className="flex flex-col gap-1">
                                       <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Score da IA</span>
                                       <span className="text-[9px] font-bold text-slate-400 leading-tight w-[180px]">Probabilidade do padrão respeitar a métrica de acerto no próximo sinal.</span>
                                    </div>
                                    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                                       <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                          <path className="text-white/5" strokeWidth="3" stroke="currentColor" fill="none" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                          {hasValidationResults && <path className="text-[#00c83a] drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" strokeDasharray="85, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />}
                                       </svg>
                                       <span className="absolute text-[11px] font-black text-white">{hasValidationResults ? validadorResult.freqPercent + '%' : '--%'}</span>
                                    </div>
                                 </div>

                                 {/* 2. Ciclos */}
                                 <div className="flex flex-col gap-2 relative">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sequência de Ciclos</span>
                                    <div className="relative group/scroll">
                                       {/* Scroll Left Button */}
                                       <button onClick={() => handleCycleScroll('left')} className="absolute left-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-r from-[#0b0e14] via-[#0b0e14]/80 to-transparent flex items-center justify-start opacity-0 group-hover/scroll:opacity-100 transition-opacity">
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4 text-slate-300 ml-1"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                       </button>

                                       <div 
                                          ref={cycleScrollRef}
                                          onMouseDown={onCycleMouseDown}
                                          onMouseLeave={onCycleMouseLeave}
                                          onMouseUp={onCycleMouseUp}
                                          onMouseMove={onCycleMouseMove}
                                          className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x cursor-grab active:cursor-grabbing rounded-lg border border-white/5"
                                          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                       >
                                          {!hasValidationResults ? (
                                             <div className="flex flex-col items-center justify-center shrink-0 w-full py-4 text-slate-500 text-[10px] font-bold">Sem dados</div>
                                          ) : (
                                             <>
                                                {/* Exemplo 1: Red */}
                                                <div className="flex flex-col items-center justify-center shrink-0 w-16 py-2.5 bg-gradient-to-b from-[#3a1015] to-[#250a0d] border-r border-white/5 snap-start shadow-inner">
                                                   <span className="text-[14px] font-black text-white/90">5</span>
                                                   <span className="text-[10px] font-bold text-white/70 mt-1">10.26%</span>
                                                </div>
                                                {/* Exemplo 2: Green */}
                                                <div className="flex flex-col items-center justify-center shrink-0 w-16 py-2.5 bg-gradient-to-b from-[#0f2e22] to-[#0a1f16] border-r border-white/5 snap-start shadow-inner">
                                                   <span className="text-[14px] font-black text-white/90">1</span>
                                                   <span className="text-[10px] font-bold text-white/70 mt-1">11.36%</span>
                                                </div>
                                                {/* Exemplo 3: Red */}
                                                <div className="flex flex-col items-center justify-center shrink-0 w-16 py-2.5 bg-gradient-to-b from-[#3a1015] to-[#250a0d] border-r border-white/5 snap-start shadow-inner">
                                                   <span className="text-[14px] font-black text-white/90">34</span>
                                                   <span className="text-[10px] font-bold text-white/70 mt-1">20.00%</span>
                                                </div>
                                                {/* Exemplo 4: Green */}
                                                <div className="flex flex-col items-center justify-center shrink-0 w-16 py-2.5 bg-gradient-to-b from-[#0f2e22] to-[#0a1f16] border-r border-white/5 snap-start shadow-inner">
                                                   <span className="text-[14px] font-black text-white/90">1</span>
                                                   <span className="text-[10px] font-bold text-white/70 mt-1">11.36%</span>
                                                </div>
                                                {/* Exemplo 5: Red */}
                                                <div className="flex flex-col items-center justify-center shrink-0 w-16 py-2.5 bg-gradient-to-b from-[#3a1015] to-[#250a0d] border-r border-white/5 snap-start shadow-inner">
                                                   <span className="text-[14px] font-black text-white/90">7</span>
                                                   <span className="text-[10px] font-bold text-white/70 mt-1">15.15%</span>
                                                </div>
                                                {/* Exemplo 6: Green */}
                                                <div className="flex flex-col items-center justify-center shrink-0 w-16 py-2.5 bg-gradient-to-b from-[#0f2e22] to-[#0a1f16] snap-start shadow-inner">
                                                   <span className="text-[14px] font-black text-white/90">1</span>
                                                   <span className="text-[10px] font-bold text-white/70 mt-1">11.36%</span>
                                                </div>
                                             </>
                                          )}
                                       </div>

                                       {/* Scroll Right Button */}
                                       <button onClick={() => handleCycleScroll('right')} className="absolute right-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-l from-[#0b0e14] via-[#0b0e14]/80 to-transparent flex items-center justify-end opacity-0 group-hover/scroll:opacity-100 transition-opacity">
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4 text-slate-300 mr-1"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                       </button>
                                    </div>
                                 </div>

                                 {/* 3. Top Zonas de Densidade */}
                                 <div className="flex flex-col gap-2 bg-[#0b0e14]/50 border border-white/5 p-3 rounded-lg shadow-inner">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                                       <GlobalStoneIcon n={0} size="sm" /> Top 3 Zonas de Brancos
                                    </span>
                                    
                                    {!hasValidationResults ? (
                                       <div className="text-center py-4 text-slate-500 text-[10px] font-bold">Sem dados</div>
                                    ) : (
                                       <div className="flex flex-col gap-1.5">
                                          {/* Row 1 */}
                                          <div className="flex items-center justify-between bg-white/5 px-2.5 py-1.5 rounded border border-white/5">
                                             <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-black text-slate-300">50</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">casas</span>
                                                <span className="text-slate-600 px-0.5">|</span>
                                                <span className="text-[11px] font-black text-white">3</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">brancos</span>
                                             </div>
                                             <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-black text-emerald-400">95% Win</span>
                                             </div>
                                          </div>
                                          {/* Row 2 */}
                                          <div className="flex items-center justify-between bg-white/5 px-2.5 py-1.5 rounded border border-white/5">
                                             <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-black text-slate-300">20</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">casas</span>
                                                <span className="text-slate-600 px-0.5">|</span>
                                                <span className="text-[11px] font-black text-white">1</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">branco</span>
                                             </div>
                                             <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-black text-emerald-400">88% Win</span>
                                             </div>
                                          </div>
                                          {/* Row 3 */}
                                          <div className="flex items-center justify-between bg-white/5 px-2.5 py-1.5 rounded border border-white/5">
                                             <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-black text-slate-300">70</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">casas</span>
                                                <span className="text-slate-600 px-0.5">|</span>
                                                <span className="text-[11px] font-black text-white">4</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">brancos</span>
                                             </div>
                                             <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-black text-emerald-400">82% Win</span>
                                             </div>
                                          </div>
                                       </div>
                                    )}
                                 </div>
                                 
                                 {/* 4. Frequência */}
                                 <div className="flex flex-col gap-2 bg-white/5 border border-white/10 p-3 rounded-lg">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tempo de Espera (Delay)</span>
                                    <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                                       <span className="text-slate-400">Média:</span>
                                       <span className="text-yellow-400">{hasValidationResults ? validadorResult.frequencyText : '--'}</span>
                                    </div>
                                    <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
                                       <div className={`bg-gradient-to-r from-yellow-500 to-orange-500 h-full ${hasValidationResults ? `w-[${validadorResult.freqPercent}%]` : 'w-0'}`}></div>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-500 mt-1 leading-tight">{hasValidationResults ? 'Após 60 minutos sem aparecer, a probabilidade de acerto sobe para 98%.' : 'Construa e valide um padrão para ver a frequência.'}</p>
                                 </div>
                              </div>
                           )}
                        </div>
                     )}

                     {/* Coluna de Resultados Ao Vivo (Apenas Notificador) */}
                     {activeTool === 'notificador' && (
                        <div className="bg-[#0b0e14]/50 border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-inner w-[400px] shrink-0">
                           <span className="text-[12px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              Resultados Ao Vivo
                           </span>
                           <div className="flex flex-col gap-2.5 overflow-y-auto custom-scrollbar pr-2 h-[450px]">
                              
                              <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm">
                                 <span className="text-[11px] font-bold text-slate-300">Vitórias:</span>
                                 <div className="flex items-center gap-1.5">
                                    <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">{notificadorStats.wins}</span>
                                    <span className="text-slate-500 text-[10px]">•</span>
                                    <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0.00%</span>
                                 </div>
                              </div>
                              <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm">
                                 <span className="text-[11px] font-bold text-slate-300">Sequência de vitórias:</span>
                                 <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0</span>
                              </div>
                              <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm mt-1">
                                 <span className="text-[11px] font-bold text-slate-300">Vitória (sem gale):</span>
                                 <div className="flex items-center gap-1.5">
                                    <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0</span>
                                    <span className="text-slate-500 text-[10px]">•</span>
                                    <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0.00%</span>
                                 </div>
                              </div>
                              
                              {Array.from({length: (notifPatterns.find(p => p.id === notifActiveId)?.gales) || 0}).map((_, i) => (
                                 <div key={i} className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-300">Vitória (gale {i + 1}):</span>
                                    <div className="flex items-center gap-1.5">
                                       <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0</span>
                                       <span className="text-slate-500 text-[10px]">•</span>
                                       <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0.00%</span>
                                    </div>
                                 </div>
                              ))}

                              <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm mt-1">
                                 <span className="text-[11px] font-bold text-slate-300">Derrotas:</span>
                                 <div className="flex items-center gap-1.5">
                                    <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0</span>
                                    <span className="text-slate-500 text-[10px]">•</span>
                                    <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0.00%</span>
                                 </div>
                              </div>
                              <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-md px-3 py-2.5 shadow-sm">
                                 <span className="text-[11px] font-bold text-slate-300">Sequência de derrotas:</span>
                                 <span className="bg-black text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/10 shadow-inner">0</span>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      )}

      <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-white/5 rounded-lg overflow-y-auto custom-scrollbar p-3 flex-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300">
         {histFixedCols ? (
            <FixedColumnsHistory data={filteredData} reverse={histReverse} showSec={histShowSeconds} />
         ) : (
            <div className="flex flex-wrap gap-2 content-start" dir={histReverse ? "ltr" : "rtl"}>
               {historyData.map((r: any, i: number) => (
                  <div key={r.id || r.timestamp || i} dir="ltr">
                     <HistoryCard roll={r} showSec={histShowSeconds} />
                  </div>
               ))}
            </div>
         )}
      </div>
    </div>
  );
}



function HistoryCardComponent({ roll, showSec }: any) {
   const n = Number(roll.roll);
   const dt = new Date(roll.timestamp);
   const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: showSec ? '2-digit' : undefined, timeZone: 'America/Sao_Paulo' });
   
   return (
      <div className="flex flex-col items-center shrink-0 w-[44px] p-1 gap-[2px] bg-[#0b0e14]/70 rounded-lg border border-[#00c83a]/20 shadow-sm transition-all hover:bg-[#00c83a]/10">
         <div className="flex justify-center w-full">
            <GlobalStoneIcon n={n} size="md" />
         </div>
         <div className="flex justify-center w-full">
            <div className={`text-center py-[2px] px-1.5 whitespace-nowrap text-[8px] font-black tracking-wider leading-none rounded bg-transparent text-slate-400`}>
               {timeStr}
            </div>
         </div>
      </div>
   );
}
const HistoryCard = React.memo(HistoryCardComponent);

function HistoryCardFixedComponent({ roll, showSec }: any) {
   const n = Number(roll.roll);
   const dt = new Date(roll.timestamp);
   const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: showSec ? '2-digit' : undefined, timeZone: 'America/Sao_Paulo' });

   return (
      <div className="flex flex-col items-center shrink-0 w-[42px] gap-[3px]">
         <GlobalStoneIcon n={n} size="md" />
         <div className="flex justify-center w-full">
            <div className={`text-center py-[2px] px-1.5 whitespace-nowrap text-[8px] font-black tracking-wider leading-none rounded bg-transparent text-slate-400`}>
               {timeStr}
            </div>
         </div>
      </div>
   );
}
const HistoryCardFixed = React.memo(HistoryCardFixedComponent);

function FixedColumnsHistory({ data, reverse, showSec }: any) {
   const [preds, setPreds] = useState<Record<string, string>>({});
   const blocksMap = new Map();
   const blockKeysSet = new Set<number>();
   let maxBlock = -1;

   const cyclePred = (key: string) => {
      setPreds(p => {
         const curr = p[key];
         let next = 'red';
         if (curr === 'red') next = 'black';
         else if (curr === 'black') next = 'white';
         else if (curr === 'white') next = '';
         
         if (next === '') {
            const copy = {...p};
            delete copy[key];
            return copy;
         }
         return { ...p, [key]: next };
      });
   };

   for (const r of data) {
      const ts = r.timestamp ? new Date(r.timestamp).getTime() : (r.created_at ? new Date(r.created_at).getTime() : Date.now());
      const dt = new Date(ts - 3 * 3600 * 1000);
      const min = dt.getUTCMinutes();
      const sec = dt.getUTCSeconds();
      const blockId = Math.floor(dt.getTime() / (10 * 60 * 1000));
      
      if (blockId > maxBlock) maxBlock = blockId;

      if (!blocksMap.has(blockId)) {
         blocksMap.set(blockId, Array.from({length: 10}, () => [null, null]));
         blockKeysSet.add(blockId);
      }
      
      const col = min % 10;
      const split = sec >= 30 ? 1 : 0;
      blocksMap.get(blockId)[col][split] = r;
   }
   
   if (maxBlock !== -1) {
      blocksMap.set(maxBlock + 1, Array.from({length: 10}, () => [null, null]));
      blocksMap.set(maxBlock + 2, Array.from({length: 10}, () => [null, null]));
      blockKeysSet.add(maxBlock + 1);
      blockKeysSet.add(maxBlock + 2);
   }

   const sortedKeys = Array.from(blockKeysSet).sort((a, b) => b - a);

   return (
      <div className="flex flex-col gap-3 w-full min-w-max pb-4 overflow-x-auto">
         {/* HEADER AZUL */}
         <div className="flex w-full min-w-[1000px] bg-blue-600 rounded overflow-hidden">
            {Array.from({length: 10}, (_, i) => (
                <div key={i} className="flex-1 text-center text-[12px] text-white font-black py-1.5 border-r border-white/20 last:border-r-0">
                  0{i}
                </div>
            ))}
         </div>
         {/* LINHAS DE BLOCOS */}
         {sortedKeys.map((bk) => {
            const grid = blocksMap.get(bk);
            const cells = [];
            for (let c=0; c<10; c++) {
               cells.push({ col: c, split: 0, item: grid[c][0] });
               cells.push({ col: c, split: 1, item: grid[c][1] });
            }

            return (
               <div key={bk} className="flex w-full min-w-[1000px] border border-white/5 rounded overflow-hidden shadow-sm">
                  {cells.map((cellObj, idx) => {
                     const { col: cIdx, split: sIdx, item } = cellObj;
                     const key = `${bk}-${cIdx}-${sIdx}`;
                     const pred = preds[key];
                     const localTimeMs = bk * 10 * 60 * 1000 + cIdx * 60 * 1000;
                     const localDate = new Date(localTimeMs);
                     const timeStr = `${localDate.getUTCHours().toString().padStart(2, '0')}:${localDate.getUTCMinutes().toString().padStart(2, '0')}`;

                     const wrapperClass = "flex-1 flex flex-col items-center justify-center p-1.5 border-r border-white/5 last:border-r-0 bg-[#131722] hover:bg-white/5 transition-colors cursor-pointer group";

                     if (item) {
                        return (
                           <div key={idx} className={wrapperClass}>
                              <GlobalStoneIcon n={Number(item.roll)} size="lg" />
                              <div className="text-[10px] font-bold text-slate-500 mt-1.5">{timeStr}</div>
                           </div>
                        );
                     }

                     if (!pred) {
                        return (
                           <div key={idx} onClick={() => cyclePred(key)} className={wrapperClass}>
                              <div className="w-[48px] h-[48px] rounded border border-white/20 bg-transparent flex items-center justify-center p-[5px]">
                                 <div className="w-full h-full rounded-full border border-white/20"></div>
                              </div>
                              <div className="text-[10px] font-bold text-slate-500 mt-1.5">{timeStr}</div>
                           </div>
                        );
                     }
                     
                     let inner = null;
                     if (pred === 'red') {
                        inner = (
                           <div className="w-[48px] h-[48px] rounded bg-[#E51E3E] flex items-center justify-center p-[5px]">
                              <div className="w-full h-full rounded-full border-[2.5px] border-white"></div>
                           </div>
                        );
                     } else if (pred === 'black') {
                        inner = (
                           <div className="w-[48px] h-[48px] rounded bg-[#2C2F33] flex items-center justify-center p-[5px]">
                              <div className="w-full h-full rounded-full border-[2.5px] border-white/50"></div>
                           </div>
                        );
                     } else if (pred === 'white') {
                        inner = (
                           <div className="w-[48px] h-[48px] rounded bg-white flex items-center justify-center">
                              <div className="w-6 h-6 flex items-center justify-center overflow-hidden">
                                 <img src="/blaze-white.png" alt="W" className="w-full h-full object-contain grayscale" />
                              </div>
                           </div>
                        );
                     }

                     return (
                        <div key={idx} onClick={() => cyclePred(key)} className={wrapperClass}>
                           {inner}
                           <div className="text-[10px] font-bold text-slate-500 mt-1.5">{timeStr}</div>
                        </div>
                     );
                  })}
               </div>
            );
         })}
      </div>
   );
}

