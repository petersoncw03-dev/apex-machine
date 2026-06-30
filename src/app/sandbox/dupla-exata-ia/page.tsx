'use client';

import { useState, useRef, useMemo, Fragment } from 'react';
import { Target, Clock, Activity, Download, Play, StopCircle, RefreshCw } from 'lucide-react';

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

export default function DuplaExataSimulador() {
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedCycles, setExpandedCycles] = useState(false);
  const shouldStopRef = useRef(false);

  // Filters
  const [daysToFetch, setDaysToFetch] = useState(3);
  const [lookbackHours, setLookbackHours] = useState(12);
  const [casasLimit, setCasasLimit] = useState(10);
  const [targetMode, setTargetMode] = useState<'branco' | 'cores'>('branco');
  
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

  // IA Otimizadora
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState({ currentLoop: 0, totalLoops: 3, percent: 0 });
  const [aiRanking, setAiRanking] = useState<any[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiMinWrTarget, setAiMinWrTarget] = useState(8);
  const [aiMinSignalsTarget, setAiMinSignalsTarget] = useState(50);
  const [aiDaysToFetch, setAiDaysToFetch] = useState(5);

  const startAIOptimizer = async () => {
    setLoading(true);
    setAiRunning(true);
    setShowAiPanel(true);
    setAiRanking([]);
    shouldStopRef.current = false;

    try {
        const fetchRes = await fetch(`/api/results/period?hours=${aiDaysToFetch * 24}`); // Usa os dias definidos na IA
        const json = await fetchRes.json();
        if (!json.data || json.data.length === 0) throw new Error('Sem dados no DB para a IA.');
        
        const fullData = json.data.map((r: any) => ({
            ...r,
            color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(),
            roll: r.roll?.toString()
        }));

        let allResults: any[] = [];
        let totalTests = 0;

        // Monta a Fila de Cenários a testar
        const queue: any[] = [];
        for (let lb of [24, 72, 120]) {
            for (let casas of [5, 10]) {
                for (let minPerc of [5, 8, 12, 20]) {
                    for (let minSa of [0, 5, 10]) {
                        queue.push({ lookback: lb, casas, minPerc, minSa, minSm: 0 });
                    }
                }
            }
        }

        for (let i = 0; i < queue.length; i++) {
            if (shouldStopRef.current) break;
            const cfg = queue[i];

            // 1. Atualização Visual do Macro (Fisicamente na tela)
            setLookbackHours(cfg.lookback);
            setCasasLimit(cfg.casas);
            setMinHitsFilter(cfg.minPerc);
            setMinSaFilter(cfg.minSa);
            totalTests++;

            setAiProgress({ currentLoop: i + 1, totalLoops: queue.length, percent: 0 });
            await new Promise(r => setTimeout(r, 50)); // Pausa pro humano ver a tela mudando

            // === MOTOR DE TESTE INDIVIDUAL (Roda 1 cenário por completo) ===
            let wins = 0;
            let losses = 0;
            let signals = 0;
            let maxLossStreak = 0;
            let currentLossStreak = 0;
            const pendingPreds: Record<number, boolean> = {};
            const lookbackRecords = cfg.lookback * 120;

            for (let T = lookbackRecords; T < fullData.length; T++) {
                if (shouldStopRef.current) break;

                const latestStone = fullData[T];
                const isBranco = latestStone.color.includes('Branco') || latestStone.roll === '0';

                if (pendingPreds[T]) {
                    signals++;
                    if (isBranco) {
                        wins++;
                        currentLossStreak = 0;
                    } else {
                        losses++;
                        currentLossStreak++;
                        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
                    }
                }

                // Cria matriz limitando o cálculo para manter o navegador 100% liso
                const analysisData = fullData.slice(T - lookbackRecords, T + 1);
                const totalsGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(cfg.casas).fill(0)));
                const brancoSaGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(cfg.casas).fill(0)));
                const brancoSmGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(cfg.casas).fill(0)));
                const brancoHitsGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(cfg.casas).fill(0)));

                for (let k = 1; k < analysisData.length; k++) {
                    const currentRoll = analysisData[k];
                    const prevRoll = analysisData[k - 1];
                    const p1 = parseInt(prevRoll.roll as string);
                    const p2 = parseInt(currentRoll.roll as string);
                    if (isNaN(p1) || isNaN(p2)) continue;
                    const isBrancoLocal = currentRoll.color.includes('Branco') || currentRoll.roll === '0';

                    for (let cCasa = 1; cCasa <= cfg.casas; cCasa++) {
                        const pairIndex2 = k - cCasa;
                        const pairIndex1 = pairIndex2 - 1;
                        if (pairIndex1 >= 0) {
                            const trig1 = parseInt(analysisData[pairIndex1].roll as string);
                            const trig2 = parseInt(analysisData[pairIndex2].roll as string);
                            if (!isNaN(trig1) && !isNaN(trig2) && trig1 >= 0 && trig1 <= 14 && trig2 >= 0 && trig2 <= 14) {
                                totalsGrid[trig1][trig2][cCasa - 1]++;
                                if (isBrancoLocal) {
                                    brancoSaGrid[trig1][trig2][cCasa - 1] = 0;
                                    brancoHitsGrid[trig1][trig2][cCasa - 1]++;
                                } else {
                                    brancoSaGrid[trig1][trig2][cCasa - 1]++;
                                    if (brancoSaGrid[trig1][trig2][cCasa - 1] > brancoSmGrid[trig1][trig2][cCasa - 1]) {
                                        brancoSmGrid[trig1][trig2][cCasa - 1] = brancoSaGrid[trig1][trig2][cCasa - 1];
                                    }
                                }
                            }
                        }
                    }
                }

                const p1Target = parseInt(fullData[T - 1]?.roll as string);
                const p2Target = parseInt(latestStone?.roll as string);
                
                if (!isNaN(p1Target) && !isNaN(p2Target)) {
                    for (let cCasa = 0; cCasa < cfg.casas; cCasa++) {
                        const total = totalsGrid[p1Target][p2Target][cCasa];
                        if (total > 0) {
                            const hits = brancoHitsGrid[p1Target][p2Target][cCasa];
                            const sa = brancoSaGrid[p1Target][p2Target][cCasa];
                            const sm = brancoSmGrid[p1Target][p2Target][cCasa];
                            const perc = (hits / total) * 100;
                            
                            if (perc >= cfg.minPerc && sa >= cfg.minSa && sm >= cfg.minSm) {
                                pendingPreds[T + cCasa + 1] = true;
                            }
                        }
                    }
                }

                // Libera a Thread do navegador para ele não "engasgar"
                if (T % 50 === 0) {
                    setAiProgress(prev => ({ ...prev, percent: Math.round(((T - lookbackRecords) / (fullData.length - lookbackRecords)) * 100) }));
                    await new Promise(r => setTimeout(r, 0));
                }
            } // Fim da viagem no tempo desse cenário

            // 3. Avaliação de Risco do Cenário
            const wr = signals > 0 ? (wins / signals) * 100 : 0;
            
            // Salva TODAS as configurações que deram algum sinal para sempre termos um Top 5
            if (signals > 0) {
                // Pontuação baseada no WinRate, mas priorizando quem bate a meta
                let score = wr - (maxLossStreak * 2);
                if (wins >= aiMinSignalsTarget && wr >= aiMinWrTarget) {
                    score += 1000; // Bônus massivo para quem atinge a meta do usuário
                }
                
                allResults.push({
                    ...cfg,
                    signals, wins, maxLossStreak,
                    winRate: wr,
                    score: score
                });
                
                const sorted = [...allResults].sort((a, b) => b.score - a.score);
                setAiRanking(sorted.slice(0, 5));
            }
        } // Fim da Fila

        if (!shouldStopRef.current) {
            const sortedFinal = [...allResults].sort((a, b) => b.score - a.score);
            setAiRanking(sortedFinal.slice(0, 5));
            
            // Gera Relatório Automático em .txt
            if (sortedFinal.length > 0) {
                let txtContent = `=== RELATÓRIO IA GENÉTICA - DUPLA EXATA ===\n`;
                txtContent += `Gerado em: ${new Date().toLocaleString()}\n`;
                txtContent += `Meta do Usuário: ${aiMinWrTarget}% WinRate Mínimo | ${aiMinSignalsTarget} Wins Mínimos\n\n`;
                
                sortedFinal.slice(0, 20).forEach((rk, idx) => {
                    txtContent += `[ #${idx + 1} ] =====================\n`;
                    const bateuMeta = (rk.wins >= aiMinSignalsTarget && rk.winRate >= aiMinWrTarget) ? "⭐ BATEU A META ⭐" : "Não atingiu a meta.";
                    txtContent += `Status: ${bateuMeta}\n`;
                    txtContent += `Configuração: Memória ${rk.lookback}h | Casas ${rk.casas} | Assertividade ${rk.minPerc}% a 100% | SA ${rk.minSa} a 999\n`;
                    txtContent += `Performance: ${rk.wins} Wins / ${rk.signals} Sinais (WinRate: ${rk.winRate.toFixed(1)}%)\n`;
                    txtContent += `Pior Quebra de Banca: ${rk.maxLossStreak} seguidas\n\n`;
                });

                const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `ia_ranking_dupla_exata_${new Date().getTime()}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            alert(`Auto-Piloto IA Finalizado!\nAvaliados: ${totalTests} padrões complexos.\nO relatório .txt foi baixado no seu computador!`);
        }

    } catch (err: any) {
        alert(err.message || "Erro no otimizador.");
    } finally {
        setLoading(false);
        setAiRunning(false);
    }
  };

  const applyAiConfig = (rk: any) => {
      setDaysToFetch(aiDaysToFetch);
      setLookbackHours(rk.lookback);
      setCasasLimit(rk.casas);
      setTargetMode('branco');
      setMinHitsFilter(rk.minPerc);
      setMaxHitsFilter(100);
      setMinSaFilter(rk.minSa);
      setMaxSaFilter(999);
      setMinSmFilter(rk.minSm);
      
      alert("Parâmetros Genéticos aplicados com sucesso nas caixas do painel! Role para baixo e clique em 'Iniciar Backtest Padrão' para ver o gráfico de ciclos completos.");
  };

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

      const pendingPreds: Record<number, { white: boolean, red: boolean, black: boolean }> = {};
      
      let cycleHistory: { type: 'W' | 'L', count: number }[] = [];
      let currentCycleType: 'W' | 'L' | null = null;
      let currentCycleCount = 0;

      // ENGINE: The Time Machine
      for (let T = lookbackRecords; T < fullData.length; T++) {
        if (shouldStopRef.current) break;

        const prevGlobalStone = fullData[T - 1];
        const latestStone = fullData[T];

        // 1. Resolve PREVIOUS predictions against CURRENT stone
        const activePreds = pendingPreds[T] || { white: false, red: false, black: false };
        delete pendingPreds[T];

        
        // ZONA DE CONFIRMAÇÃO (PRÉ-ENTRADA)
        // Ignora T-1 (pedra atual), olha de T-2 até T-1-zoneRaio
        let zoneApproved = true;
        if (enableZone && (activePreds.white || activePreds.red || activePreds.black)) {
            let brancoCount = 0;
            const startIdx = T - 1 - zoneRaio;
            const endIdx = T - 2;
            if (startIdx >= 0) {
                for (let z = startIdx; z <= endIdx; z++) {
                    const zRoll = fullData[z];
                    if (zRoll && (zRoll.color.includes('Branco') || parseInt(zRoll.roll) === 0)) {
                        brancoCount++;
                    }
                }
                if (brancoCount < zoneMin || brancoCount > zoneMax) {
                    zoneApproved = false;
                }
            } else {
                zoneApproved = false; // Sem dados suficientes para olhar para trás
            }
        }

        if ((activePreds.white || activePreds.red || activePreds.black) && zoneApproved) {

           let hit = false;
           if (activePreds.white && latestStone.color.includes('Branco')) hit = true;
           if (activePreds.red && latestStone.color.includes('Vermelho')) hit = true;
           if (activePreds.black && latestStone.color.includes('Preto')) hit = true;

           totalSignals++;
           if (hit) {
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
           } else {
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

        const totalsGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const brancoSmGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const brancoSaGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const brancoHitsGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const redSmGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const redSaGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const redHitsGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const blackSmGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const blackSaGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));
        const blackHitsGrid = Array(15).fill(0).map(() => Array(15).fill(0).map(() => Array(casasLimit).fill(0)));

        // Calculando DUPLAS para a janela
        for (let i = 1; i < analysisData.length; i++) {
          const currentRoll = analysisData[i];
          const prevRoll = analysisData[i - 1];

          const p1 = parseInt(prevRoll.roll as string);
          const p2 = parseInt(currentRoll.roll as string);

          if (isNaN(p1) || isNaN(p2)) continue;

          const isBranco = currentRoll.color.includes('Branco') || currentRoll.roll === '0';
          const isRed = currentRoll.color.includes('Vermelho') || (p2 >= 1 && p2 <= 7);
          const isBlack = currentRoll.color.includes('Preto') || (p2 >= 8 && p2 <= 14);

          for (let c = 1; c <= casasLimit; c++) {
            const pairIndex2 = i - c;
            const pairIndex1 = pairIndex2 - 1;

            if (pairIndex1 >= 0) {
              const trig1 = parseInt(analysisData[pairIndex1].roll as string);
              const trig2 = parseInt(analysisData[pairIndex2].roll as string);

              if (!isNaN(trig1) && !isNaN(trig2) && trig1 >= 0 && trig1 <= 14 && trig2 >= 0 && trig2 <= 14) {
                totalsGrid[trig1][trig2][c - 1]++;
                
                if (isBranco) {
                  brancoSaGrid[trig1][trig2][c - 1] = 0;
                  brancoHitsGrid[trig1][trig2][c - 1]++;
                  redSaGrid[trig1][trig2][c - 1]++;
                  if (redSaGrid[trig1][trig2][c - 1] > redSmGrid[trig1][trig2][c - 1]) redSmGrid[trig1][trig2][c - 1] = redSaGrid[trig1][trig2][c - 1];
                  blackSaGrid[trig1][trig2][c - 1]++;
                  if (blackSaGrid[trig1][trig2][c - 1] > blackSmGrid[trig1][trig2][c - 1]) blackSmGrid[trig1][trig2][c - 1] = blackSaGrid[trig1][trig2][c - 1];
                } else if (isRed) {
                  brancoSaGrid[trig1][trig2][c - 1]++;
                  if (brancoSaGrid[trig1][trig2][c - 1] > brancoSmGrid[trig1][trig2][c - 1]) brancoSmGrid[trig1][trig2][c - 1] = brancoSaGrid[trig1][trig2][c - 1];
                  redSaGrid[trig1][trig2][c - 1] = 0;
                  redHitsGrid[trig1][trig2][c - 1]++;
                  blackSaGrid[trig1][trig2][c - 1]++;
                  if (blackSaGrid[trig1][trig2][c - 1] > blackSmGrid[trig1][trig2][c - 1]) blackSmGrid[trig1][trig2][c - 1] = blackSaGrid[trig1][trig2][c - 1];
                } else if (isBlack) {
                  brancoSaGrid[trig1][trig2][c - 1]++;
                  if (brancoSaGrid[trig1][trig2][c - 1] > brancoSmGrid[trig1][trig2][c - 1]) brancoSmGrid[trig1][trig2][c - 1] = brancoSaGrid[trig1][trig2][c - 1];
                  blackSaGrid[trig1][trig2][c - 1] = 0;
                  blackHitsGrid[trig1][trig2][c - 1]++;
                  redSaGrid[trig1][trig2][c - 1]++;
                  if (redSaGrid[trig1][trig2][c - 1] > redSmGrid[trig1][trig2][c - 1]) redSmGrid[trig1][trig2][c - 1] = redSaGrid[trig1][trig2][c - 1];
                }
              }
            }
          }
        }

        // 3. Scan active patterns for the current DUPLA that just fell at time T
        const p1Target = parseInt(prevGlobalStone?.roll as string);
        const p2Target = parseInt(latestStone?.roll as string);
        
        if (!isNaN(p1Target) && !isNaN(p2Target)) {
           for (let c = 0; c < casasLimit; c++) {
              const total = totalsGrid[p1Target][p2Target][c];
              if (total === 0) continue;
              
              const targetT = T + c + 1;

              if (targetMode === 'branco') {
                 const hits = brancoHitsGrid[p1Target][p2Target][c];
                 const sa = brancoSaGrid[p1Target][p2Target][c];
                 const sm = brancoSmGrid[p1Target][p2Target][c];
                 const perc = (hits / total) * 100;
                 
                 if (perc >= minHitsFilter && perc <= maxHitsFilter && sa >= minSaFilter && sa <= maxSaFilter && sm >= minSmFilter) {
                    if (!pendingPreds[targetT]) pendingPreds[targetT] = { white: false, red: false, black: false };
                    pendingPreds[targetT].white = true;
                 }
              } else {
                 const rHits = redHitsGrid[p1Target][p2Target][c];
                 const rSa = redSaGrid[p1Target][p2Target][c];
                 const rSm = redSmGrid[p1Target][p2Target][c];
                 const rPerc = (rHits / total) * 100;
                 if (rPerc >= minHitsFilter && rPerc <= maxHitsFilter && rSa >= minSaFilter && rSa <= maxSaFilter && rSm >= minSmFilter) {
                    if (!pendingPreds[targetT]) pendingPreds[targetT] = { white: false, red: false, black: false };
                    pendingPreds[targetT].red = true;
                 }
                 
                 const bHits = blackHitsGrid[p1Target][p2Target][c];
                 const bSa = blackSaGrid[p1Target][p2Target][c];
                 const bSm = blackSmGrid[p1Target][p2Target][c];
                 const bPerc = (bHits / total) * 100;
                 if (bPerc >= minHitsFilter && bPerc <= maxHitsFilter && bSa >= minSaFilter && bSa <= maxSaFilter && bSm >= minSmFilter) {
                    if (!pendingPreds[targetT]) pendingPreds[targetT] = { white: false, red: false, black: false };
                    pendingPreds[targetT].black = true;
                 }
              }
           }
        }

        // Yield to UI e Atualiza Progresso a cada 100 passos (Dupla é mais pesada)
        if (T % 100 === 0) {
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
     const text = `RELATÓRIO DE BACKTEST DINÂMICO - DUPLA EXATA
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
     a.download = `backtest_dupla_exata_${new Date().getTime()}.txt`;
     a.click();
     URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1200px] mx-auto flex flex-col gap-6">
      
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-pink-500 tracking-tight flex items-center gap-3">
           <Target size={32} className="text-red-500" />
           Dupla Exata Simulador
        </h1>
        <p className="text-gray-400 font-medium">Teste e valide suas estratégias utilizando dados reais do passado</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Período de Download */}
        <div className="bg-[#12141c] p-4 rounded-xl border border-white/10 shadow-lg flex flex-col gap-2">
           <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Base de Dados (Dias)</label>
           <select 
              value={daysToFetch} onChange={(e) => setDaysToFetch(Number(e.target.value))} disabled={simulating}
              className="bg-[#0a0a0f] text-white border border-white/5 rounded-lg p-2 font-bold focus:border-red-500 outline-none"
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
              className="bg-[#0a0a0f] text-white border border-white/5 rounded-lg p-2 font-bold focus:border-pink-500 outline-none"
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
              className="bg-[#0a0a0f] text-white border border-white/5 rounded-lg p-2 font-bold focus:border-white outline-none"
           >
              <option value="branco">APENAS BRANCOS</option>
              <option value="cores">CORES (Vermelho/Preto)</option>
           </select>
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
            <Target size={16} className="text-pink-500" /> Gatilhos de Disparo
         </h3>
         
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                   className="w-full bg-[#0a0a0f] border border-white/10 text-white px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-pink-500 transition-colors"
                   value={minSaFilter} onChange={e => setMinSaFilter(Number(e.target.value))}
                 />
                 <input 
                   type="number" min="0" disabled={simulating}
                   className="w-full bg-[#0a0a0f] border border-white/10 text-white px-3 py-2 rounded-lg outline-none font-black text-lg focus:border-pink-500 transition-colors"
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

      </div>

      {/* PAINEL DA INTELIGÊNCIA ARTIFICIAL */}
      {showAiPanel && (
         <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 p-6 rounded-xl shadow-[0_0_30px_rgba(168,85,247,0.15)] flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
               <div>
                 <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-2">
                    🧬 IA Genética: Buscador de Filtros Ocultos
                 </h3>
                 <p className="text-xs text-gray-400 font-bold mt-1">
                    Defina sua meta e a IA fará centenas de simulações para achar a fórmula mágica.
                 </p>
               </div>
               <button onClick={() => setShowAiPanel(false)} className="text-gray-500 hover:text-white uppercase text-[10px] font-black tracking-widest">Fechar IA</button>
            </div>

            {!aiRunning && aiRanking.length === 0 && (
               <div className="flex flex-col gap-4 bg-[#0a0a0f] p-4 rounded-lg border border-white/5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Base de Dados</label>
                        <select value={aiDaysToFetch} onChange={e => setAiDaysToFetch(Number(e.target.value))} className="bg-[#12141c] text-white border border-white/10 rounded p-2 font-black outline-none focus:border-purple-500 cursor-pointer">
                            {[1, 2, 3, 5, 7, 10, 15].map(d => <option key={d} value={d}>Últimos {d} Dias</option>)}
                        </select>
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Meta: Win Rate Mínimo (%)</label>
                        <input type="number" value={aiMinWrTarget} onChange={e => setAiMinWrTarget(Number(e.target.value))} className="bg-[#12141c] text-green-400 border border-white/10 rounded p-2 font-black outline-none focus:border-purple-500" />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Meta: Qtd Mínima de Wins (Acertos)</label>
                        <input type="number" value={aiMinSignalsTarget} onChange={e => setAiMinSignalsTarget(Number(e.target.value))} className="bg-[#12141c] text-white border border-white/10 rounded p-2 font-black outline-none focus:border-purple-500" />
                     </div>
                  </div>
                  <button onClick={startAIOptimizer} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black px-4 py-3 rounded-lg text-sm transition-colors uppercase tracking-widest mt-2">
                     Iniciar Busca por IA
                  </button>
               </div>
            )}

            {aiRunning && (
                <div className="flex flex-col gap-2 bg-[#0a0a0f] p-4 rounded-lg border border-white/5">
                   <div className="flex justify-between items-center text-[10px] font-black text-purple-300 uppercase tracking-widest">
                      <span>Memória {aiProgress.currentLoop} de {aiProgress.totalLoops}</span>
                      <span className="text-white">{aiProgress.percent}% processado</span>
                   </div>
                   <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden shadow-inner">
                      <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-300 ease-out" style={{ width: `${aiProgress.percent}%` }} />
                   </div>
                   <span className="text-[9px] text-gray-500 uppercase tracking-widest text-center animate-pulse">Testando matrizes na Nuvem... Pulando (Pruning) cenários fracos.</span>
                </div>
            )}

            <div className="flex flex-col gap-2">
               <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-1">👑 Top 5 Configurações Encontradas (Score)</h4>
               {aiRanking.length === 0 ? (
                  <div className="text-sm font-bold text-gray-500 text-center py-6">Nenhum padrão robusto encontrado ainda. Aguarde a IA calcular...</div>
               ) : (
                  <div className="grid grid-cols-1 gap-2">
                     {aiRanking.map((rk, idx) => (
                        <div key={idx} className="bg-[#12141c] border border-white/10 rounded-lg p-3 flex justify-between items-center">
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-green-400">WIN RATE: {rk.winRate.toFixed(1)}%</span>
                              <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                                 Sinais: {rk.signals} | Wins: {rk.wins} | Pior Quebra: {rk.maxLossStreak}
                              </span>
                           </div>
                           <div className="flex flex-col md:flex-row items-end gap-2 text-right">
                              <div className="flex flex-col items-end">
                                 <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1">Cópia Rápida (Filtros):</span>
                                 <span className="text-[11px] font-medium text-white bg-[#0a0a0f] px-2 py-1 rounded border border-white/5 whitespace-nowrap">
                                    Memória: {rk.lookback}h | Casas: {rk.casas} | Assert: {rk.minPerc}% a 100% | SA: {rk.minSa} a 999 | SM Min: {rk.minSm}
                                 </span>
                              </div>
                              <button onClick={() => applyAiConfig(rk)} className="bg-green-600/20 hover:bg-green-500/40 text-green-400 border border-green-500/50 font-black text-[10px] px-3 py-1.5 rounded uppercase tracking-widest transition-colors h-fit">
                                 Aplicar Filtros
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         </div>
      )}

      {/* BOTÃO DA IA E BOTÃO MANUAL (MODIFICADOS) */}
      <div className="mt-4 flex gap-4">
         {!simulating ? (
            <>
               <button 
                  onClick={startSimulation} disabled={loading}
                  className="flex-1 bg-[#1a1b26] border border-white/10 hover:border-red-500/50 text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all flex justify-center items-center gap-2"
               >
                  {loading && !aiRunning ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} />}
                  Iniciar Backtest Padrão
               </button>
               <button 
                  onClick={() => setShowAiPanel(true)} disabled={loading}
                  className="flex-1 bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-600 hover:to-blue-600 text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex justify-center items-center gap-2 relative overflow-hidden"
               >
                  <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" style={{ mixBlendMode: 'overlay' }}></div>
                  <Target size={20} />
                  IA: Descobrir Melhor Padrão
               </button>
            </>
         ) : (
            <button 
               onClick={stopSimulation}
               className="w-full bg-red-900/50 text-red-200 border border-red-500/50 hover:bg-red-800 font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
            >
               <StopCircle size={20} />
               Abortar Operação
            </button>
         )}
      </div>

      {/* ÁREA DE PROGRESSO E RESULTADO PADRÃO */}
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
               {simulating && <p className="text-[10px] text-center text-gray-500 mt-1 animate-pulse">Viajando no tempo e recalculando DUPLAS giro a giro...</p>}
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
