'use client';

import { useState, useRef, useMemo, Fragment, useDeferredValue } from 'react';
import { Target, Clock, Activity, Download, Play, StopCircle, RefreshCw, BarChart3 } from 'lucide-react';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';

interface Scoreboard {
  wins: number;
  losses: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  timesExceededLossLimit: number;
  totalSignals: number;
  currentSA: number;
  maxSA: number;
  cycleHistory: { type: 'W' | 'L', count: number }[];
}

export default function CasaExataSimulador() {
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedCycles, setExpandedCycles] = useState(false);
  const shouldStopRef = useRef(false);

  // Filters
  const [daysToFetch, setDaysToFetch] = useState(3);
  const [lookbackHours, setLookbackHours] = useState(12);
  const [casasLimit, setCasasLimit] = useState(10);
  const [numEntradas, setNumEntradas] = useState(1);
    const deferredNumEntradas = useDeferredValue(numEntradas);
  const [targetMode, setTargetMode] = useState<'branco' | 'cores'>('branco');
  
  const [minConfluencia, setMinConfluencia] = useState(1);
    const [minHitsFilter, setMinHitsFilter] = useState(20);
  const [maxHitsFilter, setMaxHitsFilter] = useState(100);
  const [minSaFilter, setMinSaFilter] = useState(0);
  const [maxSaFilter, setMaxSaFilter] = useState(999);
  const [minSmFilter, setMinSmFilter] = useState(0);
  const [lossLimitTracker, setLossLimitTracker] = useState(30);

  
  const [enableZone, setEnableZone] = useState(false);
  const [zoneMin, setZoneMin] = useState(0);
  const [zoneMax, setZoneMax] = useState(1);
  const [zoneRaio, setZoneRaio] = useState(5);

  const [report, setReport] = useState<Scoreboard | null>(null);

  const startSimulation = async () => {
    setLoading(true);
    setSimulating(true);
    setProgress(0);
    setReport(null);
    shouldStopRef.current = false;

    try {
      // 1. Fetch historical data (Simulation Period + Lookback Memory)
      const totalHoursToFetch = (daysToFetch * 24) + lookbackHours;
      const res = await fetch(`/api/results/period?hours=${totalHoursToFetch}`);
      if (!res.ok) {
         const errData = await res.json().catch(() => null);
         throw new Error(errData?.error || 'Falha ao baixar dados da nuvem.');
      }
      const json = await res.json();
      if (!json.data || json.data.length === 0) throw new Error('Sem dados suficientes.');

      const fullData = json.data.map((r: any) => ({
        ...r,
        color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
        roll: r.roll?.toString()
      }));

      const lookbackRecords = lookbackHours * 120; // Aproximadamente 120 giros por hora
      
      if (fullData.length <= lookbackRecords) {
        alert("O período selecionado tem menos dados do que a janela de análise.");
        setLoading(false);
        setSimulating(false);
        return;
      }

      let wins = 0;
      let losses = 0;
      let consecutiveWins = 0;
      let consecutiveLosses = 0;
      let maxConsecutiveWins = 0;
      let maxConsecutiveLosses = 0;
      let timesExceededLossLimit = 0;
      let totalSignals = 0;
      let currentSA = 0;
      let maxSA = 0;

            interface ActiveCycle {
        id: string;
        type: 'white' | 'red' | 'black';
        startT: number;
        length: number;
        currentShot: number;
        resolved: boolean;
        zoneApproved?: boolean;
      }
      let activeCycles: ActiveCycle[] = [];
      let nextCycleId = 1;
      
      let cycleHistory: { type: 'W' | 'L', count: number }[] = [];
      let currentCycleType: 'W' | 'L' | null = null;
      let currentCycleCount = 0;

      // ENGINE: The Time Machine
      for (let T = lookbackRecords; T < fullData.length; T++) {
        if (shouldStopRef.current) break;

        const latestStone = fullData[T];

        // 1. Process active cycles for CURRENT stone T
                let currentActiveCount = 0;
        let whiteCount = 0;
        let redCount = 0;
        let blackCount = 0;

        for (let cycle of activeCycles) {
            if (cycle.resolved) continue;
            const currentT = cycle.startT + cycle.currentShot;
            if (currentT === T) {
                currentActiveCount++;
                if (cycle.type === 'white') whiteCount++;
                if (cycle.type === 'red') redCount++;
                if (cycle.type === 'black') blackCount++;
            }
        }

        let isWhiteBet = whiteCount >= minConfluencia;
        let isRedBet = redCount >= minConfluencia;
        let isBlackBet = blackCount >= minConfluencia;
        
        let conflictCancelled = false;
        let cancelledCycleType = '';
        if (targetMode === 'cores' && isRedBet && isBlackBet) {
            if (redCount > blackCount) {
                isBlackBet = false;
                cancelledCycleType = 'black';
            } else if (blackCount > redCount) {
                isRedBet = false;
                cancelledCycleType = 'red';
            } else {
                isRedBet = false;
                isBlackBet = false;
                conflictCancelled = true;
            }
        }
        
        let anyWin = false;
        let anyLoss = false;
        
        let zoneApproved = true;
        if (enableZone && (isWhiteBet || isRedBet || isBlackBet)) {
            let brancosInZone = 0;
            for (let z = 1; z <= zoneRaio; z++) {
                const pastIdx = T - z;
                if (pastIdx >= 0 && pastIdx < fullData.length) {
                    const pastStone = fullData[pastIdx];
                    if (pastStone.color.includes('Branco') || pastStone.roll === '0') brancosInZone++;
                }
            }
            if (brancosInZone < zoneMin || brancosInZone > zoneMax) {
                zoneApproved = false;
            }
        }

        if (zoneApproved && (isWhiteBet || isRedBet || isBlackBet)) {
            let hit = false;
            if (isWhiteBet && (latestStone.color.includes('Branco') || latestStone.roll === '0')) hit = true;
            if (isRedBet && (latestStone.color.includes('Vermelho') || (parseInt(latestStone.roll as string) >= 1 && parseInt(latestStone.roll as string) <= 7))) hit = true;
            if (isBlackBet && (latestStone.color.includes('Preto') || (parseInt(latestStone.roll as string) >= 8 && parseInt(latestStone.roll as string) <= 14))) hit = true;
            
            if (hit) {
                anyWin = true;
            } else {
                anyLoss = true;
            }
        }
        
        // Avança as "Ghost Signals" independentemente da aposta ter sido feita
        for (let cycle of activeCycles) {
            if (cycle.resolved) continue;
            
            const currentT = cycle.startT + cycle.currentShot;
            if (currentT === T) {
                if (conflictCancelled && (cycle.type === 'red' || cycle.type === 'black')) {
                    cycle.resolved = true;
                    continue;
                }
                if (cancelledCycleType === cycle.type) {
                    cycle.resolved = true;
                    continue;
                }
                
                let hitTarget = false;
                if (cycle.type === 'white' && (latestStone.color.includes('Branco') || latestStone.roll === '0')) hitTarget = true;
                if (cycle.type === 'red' && (latestStone.color.includes('Vermelho') || (parseInt(latestStone.roll as string) >= 1 && parseInt(latestStone.roll as string) <= 7))) hitTarget = true;
                if (cycle.type === 'black' && (latestStone.color.includes('Preto') || (parseInt(latestStone.roll as string) >= 8 && parseInt(latestStone.roll as string) <= 14))) hitTarget = true;
                
                if (hitTarget) {
                    cycle.resolved = true;
                } else {
                    cycle.currentShot++;
                    if (cycle.currentShot >= cycle.length) {
                        cycle.resolved = true;
                    }
                }
            }
        }
        
        activeCycles = activeCycles.filter(c => !c.resolved);

        if (anyWin || anyLoss) {
            totalSignals++;
            if (anyWin) {
                wins++;
                consecutiveWins++;
                if (consecutiveWins > maxConsecutiveWins) maxConsecutiveWins = consecutiveWins;
                
                consecutiveLosses = 0;
                currentSA = 0;
                
                if (currentCycleType === 'L') {
                   cycleHistory.push({ type: 'L', count: currentCycleCount });
                   currentCycleType = 'W';
                   currentCycleCount = 1;
                } else {
                   currentCycleType = 'W';
                   currentCycleCount++;
                }
            } else if (anyLoss) {
                losses++;
                consecutiveLosses++;
                currentSA++;
                
                if (consecutiveLosses > 0 && consecutiveLosses % lossLimitTracker === 0) timesExceededLossLimit++;

                if (currentSA > maxSA) maxSA = currentSA;
                if (consecutiveLosses > maxConsecutiveLosses) maxConsecutiveLosses = consecutiveLosses;
                consecutiveWins = 0;
                
                if (currentCycleType === 'W') {
                   cycleHistory.push({ type: 'W', count: currentCycleCount });
                   currentCycleType = 'L';
                   currentCycleCount = 1;
                } else if (currentCycleType === null) {
                   currentCycleType = 'L';
                   currentCycleCount = 1;
                } else {
                   currentCycleCount++;
                }
            }
        }

        // 2. Build the snapshot window ending at T
        const analysisData = fullData.slice(T - lookbackRecords, T + 1);

        const totalsGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const brancoSmGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const brancoSaGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const brancoHitsGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const redSmGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const redSaGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const redHitsGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const blackSmGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const blackSaGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));
        const blackHitsGrid = Array(15).fill(0).map(() => Array(casasLimit).fill(0));

        for (let i = 0; i < analysisData.length; i++) {
          const triggerRollNumber = parseInt(analysisData[i].roll as string);
          if (isNaN(triggerRollNumber) || triggerRollNumber < 0 || triggerRollNumber > 14) continue;
    
          for (let c = 1; c <= casasLimit; c++) {
            if (i + c > analysisData.length - 1) continue; 
            
            let hasBranco = false;
            let hasRed = false;
            let hasBlack = false;
            
            let maxAvailableEntries = Math.min(deferredNumEntradas, analysisData.length - (i + c));
            if (maxAvailableEntries < 1) continue; 
            
            for (let e = 0; e < maxAvailableEntries; e++) {
              const targetRoll = analysisData[i + c + e];
              if (targetRoll.color.includes('Branco') || targetRoll.roll === '0') hasBranco = true;
              if (targetRoll.color.includes('Vermelho') || (parseInt(targetRoll.roll as string) >= 1 && parseInt(targetRoll.roll as string) <= 7)) hasRed = true;
              if (targetRoll.color.includes('Preto') || (parseInt(targetRoll.roll as string) >= 8 && parseInt(targetRoll.roll as string) <= 14)) hasBlack = true;
            }
            
            const isWindowClosed = (maxAvailableEntries === deferredNumEntradas);

            let countedTotal = false;

            if (hasBranco || isWindowClosed) {
                totalsGrid[triggerRollNumber][c - 1]++;
                countedTotal = true;
                if (hasBranco) {
                    brancoSaGrid[triggerRollNumber][c - 1] = 0;
                    brancoHitsGrid[triggerRollNumber][c - 1]++;
                } else {
                    brancoSaGrid[triggerRollNumber][c - 1]++;
                    if (brancoSaGrid[triggerRollNumber][c - 1] > brancoSmGrid[triggerRollNumber][c - 1]) brancoSmGrid[triggerRollNumber][c - 1] = brancoSaGrid[triggerRollNumber][c - 1];
                }
            }

            if (hasRed || isWindowClosed) {
                if (!countedTotal) { totalsGrid[triggerRollNumber][c - 1]++; countedTotal = true; }
                if (hasRed) {
                    redSaGrid[triggerRollNumber][c - 1] = 0;
                    redHitsGrid[triggerRollNumber][c - 1]++;
                } else {
                    redSaGrid[triggerRollNumber][c - 1]++;
                    if (redSaGrid[triggerRollNumber][c - 1] > redSmGrid[triggerRollNumber][c - 1]) redSmGrid[triggerRollNumber][c - 1] = redSaGrid[triggerRollNumber][c - 1];
                }
            }

            if (hasBlack || isWindowClosed) {
                if (!countedTotal) { totalsGrid[triggerRollNumber][c - 1]++; countedTotal = true; }
                if (hasBlack) {
                    blackSaGrid[triggerRollNumber][c - 1] = 0;
                    blackHitsGrid[triggerRollNumber][c - 1]++;
                } else {
                    blackSaGrid[triggerRollNumber][c - 1]++;
                    if (blackSaGrid[triggerRollNumber][c - 1] > blackSmGrid[triggerRollNumber][c - 1]) blackSmGrid[triggerRollNumber][c - 1] = blackSaGrid[triggerRollNumber][c - 1];
                }
            }
          }
        }

        // 3. Scan active patterns for the current stone that just fell at time T
        const currentStoneNum = parseInt(latestStone.roll as string);
        
        if (!isNaN(currentStoneNum)) {
           for (let c = 0; c < casasLimit; c++) {
              const total = totalsGrid[currentStoneNum][c];
              if (total === 0) continue;
              
              const targetT = T + c + 1; // start of the target sequence
              const isFutureTarget = targetT > T;

              if (isFutureTarget && targetMode === 'branco') {
                 const hits = brancoHitsGrid[currentStoneNum][c];
                 const sa = brancoSaGrid[currentStoneNum][c];
                 const sm = brancoSmGrid[currentStoneNum][c];
                 const perc = (hits / total) * 100;
                 
                 if (perc >= minHitsFilter && perc <= maxHitsFilter && sa >= minSaFilter && sa <= maxSaFilter && sm >= minSmFilter) {
                    activeCycles.push({ id: `${nextCycleId++}`, type: 'white', startT: targetT, length: deferredNumEntradas, currentShot: 0, resolved: false });
                 }
              } else if (isFutureTarget) {
                 const rHits = redHitsGrid[currentStoneNum][c];
                 const rSa = redSaGrid[currentStoneNum][c];
                 const rSm = redSmGrid[currentStoneNum][c];
                 const rPerc = (rHits / total) * 100;
                 if (rPerc >= minHitsFilter && rPerc <= maxHitsFilter && rSa >= minSaFilter && rSa <= maxSaFilter && rSm >= minSmFilter) {
                    activeCycles.push({ id: `${nextCycleId++}`, type: 'red', startT: targetT, length: deferredNumEntradas, currentShot: 0, resolved: false });
                 }
                 
                 const bHits = blackHitsGrid[currentStoneNum][c];
                 const bSa = blackSaGrid[currentStoneNum][c];
                 const bSm = blackSmGrid[currentStoneNum][c];
                 const bPerc = (bHits / total) * 100;
                 if (bPerc >= minHitsFilter && bPerc <= maxHitsFilter && bSa >= minSaFilter && bSa <= maxSaFilter && bSm >= minSmFilter) {
                    activeCycles.push({ id: `${nextCycleId++}`, type: 'black', startT: targetT, length: deferredNumEntradas, currentShot: 0, resolved: false });
                 }
              }
           }
        }

        // Yield to UI e Atualiza Progresso a cada 200 passos
        if (T % 200 === 0) {
           setProgress(Math.round(((T - lookbackRecords) / (fullData.length - lookbackRecords)) * 100));
           
           const currentCycleArr = [...cycleHistory];
           if (currentCycleCount > 0) currentCycleArr.push({ type: currentCycleType!, count: currentCycleCount });
           if (currentCycleArr.length > 500) currentCycleArr.splice(0, currentCycleArr.length - 500);

           setReport({
             wins, losses, consecutiveWins, consecutiveLosses, maxConsecutiveWins, maxConsecutiveLosses,
             timesExceededLossLimit, totalSignals, currentSA, maxSA, cycleHistory: currentCycleArr
           });
           await new Promise(r => setTimeout(r, 0));
        }
      }

      const finalCycleArr = [...cycleHistory];
      if (currentCycleCount > 0) finalCycleArr.push({ type: currentCycleType!, count: currentCycleCount });
      if (finalCycleArr.length > 500) finalCycleArr.splice(0, finalCycleArr.length - 500);

      setReport({
         wins, losses, consecutiveWins, consecutiveLosses, maxConsecutiveWins, maxConsecutiveLosses,
         timesExceededLossLimit, totalSignals, currentSA, maxSA, cycleHistory: finalCycleArr
      });

    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro na simulação.");
    } finally {
      setSimulating(false);
      setLoading(false);
      setProgress(100);
    }
  };

  const stopSimulation = () => {
    shouldStopRef.current = true;
  };

  const downloadReport = () => {
     if (!report) return;
     const text = `RELATÓRIO DE BACKTEST DINÂMICO - CASA EXATA
--------------------------------------------
CONFIGURAÇÕES:
Período Buscado: ${daysToFetch} Dias
Janela de Análise (Memória): ${lookbackHours} Horas
Limites de Casa: ${casasLimit} Casas
Alvo: ${targetMode.toUpperCase()}
Filtro - Assertividade: ${minHitsFilter}% a ${maxHitsFilter}%
Filtro - SA: ${minSaFilter} a ${maxSaFilter}
Filtro - SM Mínimo: ${minSmFilter}
Tamanho do Ciclo de Quebra (Loss Seguidos): ${lossLimitTracker}

RESULTADOS REAIS:
Sinais Totais Gerados: ${report.totalSignals}
Win Rate: ${report.totalSignals > 0 ? ((report.wins / report.totalSignals) * 100).toFixed(2) : 0}%
Wins: ${report.wins}
Losses: ${report.losses}
Máximo de Wins Seguidos: ${report.maxConsecutiveWins}
Máximo de Losses Seguidos (Max SA): ${report.maxSA}
Total de Quebras (Múltiplos de ${lossLimitTracker} Loss): ${report.timesExceededLossLimit} quebras
--------------------------------------------
Gerado em: ${new Date().toLocaleString()}
`;
     const blob = new Blob([text], { type: 'text/plain' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `backtest_casa_exata_${new Date().getTime()}.txt`;
     a.click();
     URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1200px] mx-auto flex flex-col gap-6">
      
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#e51e3e] to-purple-500 tracking-tight flex items-center gap-3">
           <Activity size={32} className="text-[#e51e3e]" />
           Casa Exata Simulador
        </h1>
        <p className="text-gray-400 font-medium">Teste e valide suas estratégias utilizando dados reais do passado</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Período de Download */}
        <div className="bg-[#12141c] p-4 rounded-xl border border-white/10 shadow-lg flex flex-col gap-2">
           <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Base de Dados (Dias)</label>
           <select 
              value={daysToFetch} onChange={(e) => setDaysToFetch(Number(e.target.value))} disabled={simulating}
              className="bg-[#0a0a0f] text-white border border-white/5 rounded-lg p-2 font-bold focus:border-[#e51e3e] outline-none"
           >
              {[1, 3, 5, 7, 9, 12, 15, 20].map(d => <option key={d} value={d}>{d} Dias de Histórico</option>)}
           </select>
           <span className="text-xs text-gray-500">Volta no passado para começar o teste.</span>
        </div>

        {/* Janela Deslizante */}
        <div className="bg-[#12141c] p-4 rounded-xl border border-white/10 shadow-lg flex flex-col gap-2">
           <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Janela de Análise</label>
           <select 
              value={lookbackHours} onChange={(e) => setLookbackHours(Number(e.target.value))} disabled={simulating}
              className="bg-[#0a0a0f] text-white border border-white/5 rounded-lg p-2 font-bold focus:border-purple-500 outline-none"
           >
              {[1, 2, 3, 6, 12, 18, 24, 36, 48, 72, 96, 120, 168].map(h => <option key={h} value={h}>{h} Horas de "Memória"</option>)}
           </select>
           <span className="text-xs text-gray-500">Histórico que o robô enxerga a cada giro.</span>
        </div>

        {/* Alvo */}
        <div className="bg-[#12141c] p-4 rounded-xl border border-white/10 shadow-lg flex flex-col gap-2">
           <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Modo Alvo</label>
           <select 
              value={targetMode} onChange={(e) => setTargetMode(e.target.value as 'branco' | 'cores')} disabled={simulating}
              className="bg-[#0a0a0f] text-white border border-white/5 rounded-lg p-2 font-bold focus:border-[#86a8e7] outline-none"
           >
              <option value="branco">APENAS BRANCOS</option>
              <option value="cores">CORES (Vermelho/Preto)</option>
           </select>
        </div>

                {/* Entradas */}
        <div className="bg-[#12141c] p-4 rounded-xl border border-white/10 shadow-lg flex flex-col gap-2">
           <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Entradas</label>
           <input 
              type="number"
              min="1" max="20"
              value={numEntradas} onChange={(e) => setNumEntradas(Number(e.target.value) || 1)} disabled={simulating}
              className="bg-[#0a0a0f] text-white border border-white/5 rounded-lg p-2 font-bold focus:border-white outline-none"
           />
        </div>
{/* Casas Limit */}
        <div className="bg-[#12141c] p-4 rounded-xl border border-white/10 shadow-lg flex flex-col gap-2">
           <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Limite de Casas</label>
           <select 
              value={casasLimit} onChange={(e) => setCasasLimit(Number(e.target.value))} disabled={simulating}
              className="bg-[#0a0a0f] text-white border border-white/5 rounded-lg p-2 font-bold focus:border-white outline-none"
           >
              {[5, 10, 15].map(c => <option key={c} value={c}>Até {c} Casas</option>)}
           </select>
        </div>
      </div>

        {/* Zona de Confirmação */}
        <div className="bg-[#12141c] p-4 rounded-xl border border-white/10 shadow-lg flex flex-col gap-2">
           <div className="flex justify-between items-center mb-1">
             <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Zona (Brancos)</label>
             <button onClick={() => setEnableZone(!enableZone)} className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${enableZone ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{enableZone ? 'ON' : 'OFF'}</button>
           </div>
           <div className="grid grid-cols-3 gap-2 opacity-100 transition-opacity" style={{ opacity: enableZone ? 1 : 0.3 }}>
             <div className="flex flex-col gap-1"><span className="text-[9px] text-gray-500">Mínimo</span><input type="number" disabled={!enableZone || simulating} className="bg-[#0a0a0f] border border-white/5 text-white p-1 rounded font-bold outline-none" value={zoneMin} onChange={e=>setZoneMin(Number(e.target.value))} /></div>
             <div className="flex flex-col gap-1"><span className="text-[9px] text-gray-500">Máximo</span><input type="number" disabled={!enableZone || simulating} className="bg-[#0a0a0f] border border-white/5 text-white p-1 rounded font-bold outline-none" value={zoneMax} onChange={e=>setZoneMax(Number(e.target.value))} /></div>
             <div className="flex flex-col gap-1"><span className="text-[9px] text-gray-500">Raio (Atrás)</span><input type="number" disabled={!enableZone || simulating} className="bg-[#0a0a0f] border border-white/5 text-white p-1 rounded font-bold outline-none" value={zoneRaio} onChange={e=>setZoneRaio(Number(e.target.value))} /></div>
           </div>
        </div>


      <div className="bg-[#12141c] p-6 rounded-xl border border-white/10 shadow-2xl flex flex-col gap-4">
         <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/5 pb-2">
            <Target size={16} className="text-red-500" /> Gatilhos de Disparo
         </h3>
         
         <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="flex flex-col gap-1">
               <label className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Mín Confluência</label>
               <input 
                 type="number" min="1" max="50" disabled={simulating}
                 className="w-full bg-[#0a0a0f] border border-blue-500/30 text-white px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-blue-500 transition-colors"
                 value={minConfluencia} onChange={e => setMinConfluencia(Number(e.target.value))}
               />
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Assert. Min-Max (%)</label>
               <div className="flex gap-2">
                 <input 
                   type="number" min="0" max="100" disabled={simulating}
                   className="w-full bg-[#0a0a0f] border border-white/10 text-white px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-green-500 transition-colors"
                   value={minHitsFilter} onChange={e => setMinHitsFilter(Number(e.target.value))}
                 />
                 <input 
                   type="number" min="0" max="100" disabled={simulating}
                   className="w-full bg-[#0a0a0f] border border-white/10 text-white px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-green-500 transition-colors"
                   value={maxHitsFilter} onChange={e => setMaxHitsFilter(Number(e.target.value))}
                 />
               </div>
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">SA Min-Max</label>
               <div className="flex gap-2">
                 <input 
                   type="number" min="0" disabled={simulating}
                   className="w-full bg-[#0a0a0f] border border-white/10 text-white px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-purple-500 transition-colors"
                   value={minSaFilter} onChange={e => setMinSaFilter(Number(e.target.value))}
                 />
                 <input 
                   type="number" min="0" disabled={simulating}
                   className="w-full bg-[#0a0a0f] border border-white/10 text-white px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-purple-500 transition-colors"
                   value={maxSaFilter} onChange={e => setMaxSaFilter(Number(e.target.value))}
                 />
               </div>
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">SM Mínimo</label>
               <input 
                 type="number" min="0" disabled={simulating}
                 className="bg-[#0a0a0f] border border-white/10 text-white px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-gray-400 transition-colors"
                 value={minSmFilter} onChange={e => setMinSmFilter(Number(e.target.value))}
               />
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-[#e85dff]">Ciclos de Quebra (X)</label>
               <input 
                 type="number" min="1" disabled={simulating}
                 className="bg-[#1a0b1f] border border-[#e85dff]/30 text-[#e85dff] px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-[#e85dff] transition-colors"
                 value={lossLimitTracker} onChange={e => setLossLimitTracker(Number(e.target.value))}
               />
            </div>
         </div>

         <div className="mt-4 flex gap-4">
            {!simulating ? (
               <button 
                  onClick={startSimulation} disabled={loading}
                  className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl shadow-[0_0_20px_rgba(229,30,62,0.3)] transition-all flex justify-center items-center gap-2 disabled:opacity-50"
               >
                  {loading ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                  {loading ? 'Preparando Dados...' : 'Iniciar Backtest Time-Machine'}
               </button>
            ) : (
               <button 
                  onClick={stopSimulation}
                  className="flex-1 bg-gray-800 text-white border border-gray-600 hover:bg-gray-700 font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all flex justify-center items-center gap-2"
               >
                  <StopCircle size={20} />
                  Parar Simulação
               </button>
            )}
         </div>
      </div>

      {/* ÁREA DE PROGRESSO E RESULTADO */}
      {(simulating || report) && (
         <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5 shadow-2xl flex flex-col gap-6">
            
            {/* Progress Bar */}
            <div className="flex flex-col gap-2">
               <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <span>Progresso do Motor Cronológico</span>
                  <span className="text-white">{progress}%</span>
               </div>
               <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
                  <div 
                     className="bg-gradient-to-r from-green-400 to-emerald-600 h-full transition-all duration-300 ease-out"
                     style={{ width: `${progress}%` }}
                  />
               </div>
               {simulating && <p className="text-[10px] text-center text-gray-500 mt-1 animate-pulse">Viajando no tempo e recalculando padrões giro a giro...</p>}
            </div>

            {/* Dashboard do Relatório */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
               <div className="bg-[#12141c] border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sinais Enviados</span>
                  <span className="text-3xl font-black text-white">{report?.totalSignals || 0}</span>
               </div>
               <div className="bg-[#12141c] border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Win Rate (%)</span>
                  <span className="text-3xl font-black text-green-400">
                     {report && report.totalSignals > 0 ? ((report.wins / report.totalSignals) * 100).toFixed(1) : '0.0'}%
                  </span>
               </div>
               <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                  <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Acertos (Wins)</span>
                  <span className="text-3xl font-black text-green-400">{report?.wins || 0}</span>
               </div>
               <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                  <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Erros (Losses)</span>
                  <span className="text-3xl font-black text-red-400">{report?.losses || 0}</span>
               </div>
               
               <div className="bg-[#12141c] border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Max Wins Seguidos</span>
                  <span className="text-2xl font-black text-green-300">{report?.maxConsecutiveWins || 0}</span>
               </div>
               <div className="bg-[#12141c] border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">SA Atual</span>
                  <span className="text-2xl font-black text-white">{report?.currentSA || 0}</span>
               </div>
               <div className="bg-[#12141c] border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Maior SA (Máx)</span>
                  <span className="text-2xl font-black text-red-300">{report?.maxSA || 0}</span>
               </div>
               <div className="bg-[#1a0b1f] border border-[#e85dff]/20 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1">
                  <span className="text-[10px] text-[#e85dff]/70 font-black uppercase tracking-widest">Quebras ({lossLimitTracker} L)</span>
                  <span className="text-2xl font-black text-[#e85dff]">{report?.timesExceededLossLimit || 0}</span>
               </div>
            </div>

            {/* Histórico de Ciclos Visual */}
            {report && report.cycleHistory && report.cycleHistory.length > 0 && (
               <div className="bg-[#12141c] border border-white/5 p-4 rounded-xl flex flex-col gap-2 mt-2">
                  <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 flex items-center justify-between">
                     <span>Linha do Tempo (Últimos 500 Ciclos)</span>
                     <button 
                        onClick={() => setExpandedCycles(!expandedCycles)}
                        className="text-[9px] uppercase font-black tracking-widest bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-3 py-1 rounded-full transition-colors"
                     >
                        {expandedCycles ? 'Esconder Grade' : 'Expandir Grade'}
                     </button>
                  </h4>
                  <div className={`flex gap-2 ${expandedCycles ? 'flex-wrap' : 'overflow-x-auto custom-scrollbar pb-2 items-center'}`}>
                     {[...report.cycleHistory].reverse().map((c, i) => (
                        <div key={i} className={`flex items-center justify-center shrink-0 w-10 h-10 rounded-lg border font-black text-sm shadow-lg
                           ${c.type === 'W' ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(74,222,128,0.2)]' : 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(248,113,113,0.2)]'}
                        `}>
                           {c.count}
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {!simulating && report && (
               <div className="flex justify-center mt-4">
                  <button 
                     onClick={downloadReport}
                     className="bg-[#1b2b42] hover:bg-[#233857] border border-[#86a8e7]/30 text-[#86a8e7] font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
                  >
                     <Download size={16} /> Exportar Relatório Oficial (.txt)
                  </button>
               </div>
            )}
         </div>
      )}

    </main>
  );
}
