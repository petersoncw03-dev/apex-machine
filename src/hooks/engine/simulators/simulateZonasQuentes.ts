export interface RollData {
  color: string;
  roll: number;
  timestamp: string;
  id?: string;
}

export interface ZonasSimConfig {
  enabledZones: number[]; // Array dos índices das zonas ativas [0, 1, 2, 3, 4, 5]
  zonaLen: number; // Qtd de pedras/entradas por disparo na zona (ex: 5, 6, 7, 10)
  enableGeral: boolean; // Ativa/Desativa Filtro 1 (Winrate Micro)
  geralHours: number; // Horas para Winrate Micro
  geralMinWr: number; // % Winrate Micro mínimo
  enableCiclo: boolean; // Ativa/Desativa Filtro 2 (Winrate Ciclo)
  cicloHours: number; // Horas/Dias para Winrate do Ciclo Macro
  cicloMinWr: number; // % Winrate Ciclo mínimo
  enableMetaCiclo: boolean; // Ativa/Desativa Filtro 3 (Ciclo do Ciclo)
  metaCicloDays: number; // Dias para Winrate do Ciclo do Ciclo
  metaCicloMinWr: number; // % Winrate Ciclo do Ciclo mínimo
  initialBet: number; // Valor da 1ª Aposta (ex: R$ 1.00)
  galeMultiplier: number; // Multiplicador de Gale (ex: 1.078 ou 2.0)
  maxGales: number; // Qtd máxima de Gales acumulados antes de considerar Loss Definitivo (ex: 39)
}

export interface TradeEntry {
  id: number;
  timestamp: string;
  zoneLabel: string;
  zoneIndex: number;
  type: 'WIN' | 'LOSS_PARCIAL' | 'RED_TOTAL';
  pnl: number;
  galeLevel: number;
  startGaleLevel?: number;
  betAmount: number;
  rollHit?: number;
}

export interface ZonasSimResult {
  totalSignals: number;
  wins: number;
  redsTotal: number;
  winrate: number;
  totalPnl: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: { type: 'W' | 'L'; count: number };
  trades: TradeEntry[];
}

export function runZonasQuentesSimulation(
  history: RollData[],
  config: ZonasSimConfig
): ZonasSimResult {
  if (!history || history.length < 50) {
    return {
      totalSignals: 0,
      wins: 0,
      redsTotal: 0,
      winrate: 0,
      totalPnl: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      currentStreak: { type: 'W', count: 0 },
      trades: []
    };
  }

  // Ordena cronologicamente (do mais antigo para o mais recente)
  const rolls = [...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Definição dinâmica das 6 zonas com base na quantidade da zona (config.zonaLen)
  const baseZones = Array.from({ length: 6 }, (_, z) => {
    const s = 1 + z * config.zonaLen;
    const e = (z + 1) * config.zonaLen;
    return { label: `${s} a ${e}`, s, e };
  });

  let totalPnl = 0;
  let wins = 0;
  let redsTotal = 0;
  let totalSignals = 0;

  let currentStreakType: 'W' | 'L' | null = null;
  let currentStreakCount = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  // Estado do Gale Persistente (Martingale Contínuo inter-sinais)
  let currentBet = config.initialBet;
  let accumulatedSpentInCycle = 0;
  let currentGaleCount = 0;

  const trades: TradeEntry[] = [];
  let tradeId = 1;

  // Auxiliar para extrair atrasos (gaps) de um trecho do histórico
  const extractGaps = (arr: RollData[]) => {
    const whiteIndices: number[] = [];
    arr.forEach((r, idx) => {
      const n = typeof r.roll === 'number' ? r.roll : parseInt(r.roll as any, 10);
      if (r.color?.includes('Branco') || n === 0) {
        whiteIndices.push(idx);
      }
    });

    if (whiteIndices.length === 0) return { gaps: [], currentGap: arr.length };

    const gaps: number[] = [];
    for (let i = 1; i < whiteIndices.length; i++) {
      gaps.push(whiteIndices[i] - whiteIndices[i - 1]);
    }
    const currentGap = arr.length - 1 - whiteIndices[whiteIndices.length - 1];
    return { gaps, currentGap };
  };

  // Função para calcular estatísticas de uma zona z no momento idx
  const getZoneStatsAtPoint = (subHistory: RollData[], zoneIdx: number) => {
    const zBase = baseZones[zoneIdx];
    const zStart = zBase.s;
    const zEnd = zStart + config.zonaLen - 1;

    let microWinrate = 0;
    if (config.enableGeral) {
      // 1. Winrate Micro (Geral) nas últimas X horas
      const microSlice = subHistory.slice(-(config.geralHours * 120));
      const { gaps: microGaps } = extractGaps(microSlice);
      let mWins = 0;
      let mLosses = 0;
      for (const g of microGaps) {
        if (g >= zStart && g <= zEnd) mWins++;
        else if (g > zEnd) mLosses++;
      }
      const microTotal = mWins + mLosses;
      microWinrate = microTotal > 0 ? (mWins / microTotal) * 100 : 0;
    }

    let cicloWinrate = 0;
    if (config.enableCiclo) {
      // 2. Winrate Macro (Ciclo) nas últimas Y horas
      const macroSlice = subHistory.slice(-(config.cicloHours * 120));
      const { gaps: macroGaps } = extractGaps(macroSlice);
      const macroOutcomes: ('W' | 'L')[] = [];
      for (const g of macroGaps) {
        if (g >= zStart && g <= zEnd) macroOutcomes.push('W');
        else if (g > zEnd) macroOutcomes.push('L');
      }

      // Calcula a sequência atual no histórico macro
      let runningType: 'W' | 'L' | null = null;
      let runningCount = 0;
      const cycleStats: { W: Record<number, { win: number; loss: number }>; L: Record<number, { win: number; loss: number }> } = { W: {}, L: {} };

      for (let i = 0; i < macroOutcomes.length; i++) {
        const out = macroOutcomes[i];
        if (runningType && runningCount > 0) {
          if (!cycleStats[runningType][runningCount]) {
            cycleStats[runningType][runningCount] = { win: 0, loss: 0 };
          }
          if (out === 'W') cycleStats[runningType][runningCount].win++;
          else cycleStats[runningType][runningCount].loss++;
        }
        if (runningType === out) runningCount++;
        else {
          runningType = out;
          runningCount = 1;
        }
      }

      if (runningType && cycleStats[runningType][runningCount]) {
        const st = cycleStats[runningType][runningCount];
        const tot = st.win + st.loss;
        cicloWinrate = tot > 0 ? (st.win / tot) * 100 : 0;
      }
    }

    let metaCicloWinrate = 0;
    if (config.enableMetaCiclo) {
      // 3. Winrate Meta-Ciclo (Ciclo do Ciclo) nos últimos Z dias
      const metaSlice = subHistory.slice(-(config.metaCicloDays * 2880));
      const { gaps: metaGaps } = extractGaps(metaSlice);
      const metaOutcomesList: ('W' | 'L')[] = [];
      for (const g of metaGaps) {
        if (g >= zStart && g <= zEnd) metaOutcomesList.push('W');
        else if (g > zEnd) metaOutcomesList.push('L');
      }

      let runningType: 'W' | 'L' | null = null;
      let runningCount = 0;
      for (const out of metaOutcomesList) {
        if (runningType === out) runningCount++;
        else { runningType = out; runningCount = 1; }
      }

      // Monta a sequência de meta-ciclos
      const metaCycles: { type: 'W' | 'L'; count: number }[] = [];
      if (runningType && runningCount > 0) {
        let tType = null;
        let tCount = 0;
        for (let i = 0; i < metaOutcomesList.length; i++) {
          const out = metaOutcomesList[i];
          if (tType === out) tCount++;
          else { tType = out; tCount = 1; }
          if (tType === runningType && tCount === runningCount) {
            if (i + 1 < metaOutcomesList.length) {
              const nextOut = metaOutcomesList[i + 1];
              if (metaCycles.length === 0) metaCycles.push({ type: nextOut, count: 1 });
              else {
                const last = metaCycles[metaCycles.length - 1];
                if (last.type === nextOut) last.count++;
                else metaCycles.push({ type: nextOut, count: 1 });
              }
            }
          }
        }
      }

      const currentMetaState = metaCycles.length > 0 ? metaCycles[metaCycles.length - 1] : { type: null, count: 0 };
      if (currentMetaState.type) {
        let mType = null;
        let mCount = 0;
        let mTotal = 0;
        let mWinsCount = 0;
        for (let i = 0; i < metaOutcomesList.length; i++) {
          const out = metaOutcomesList[i];
          if (mType === out) mCount++;
          else { mType = out; mCount = 1; }
          if (mType === currentMetaState.type && mCount === currentMetaState.count) {
            if (i + 1 < metaOutcomesList.length) {
              mTotal++;
              if (metaOutcomesList[i + 1] === 'W') mWinsCount++;
            }
          }
        }
        metaCicloWinrate = mTotal > 0 ? (mWinsCount / mTotal) * 100 : 0;
      }
    }

    return { microWinrate, cicloWinrate, metaCicloWinrate };
  };

  // Simulação pedra por pedra
  let currentGap = 0;
  let i = 0;

  while (i < rolls.length) {
    const currentRoll = rolls[i];
    const n = typeof currentRoll.roll === 'number' ? currentRoll.roll : parseInt(currentRoll.roll as any, 10);
    const isWhite = currentRoll.color?.includes('Branco') || n === 0;

    if (isWhite) {
      currentGap = 0;
      i++;
      continue;
    }

    currentGap++;

    // Verifica se o atraso atingiu o início de alguma zona ativa
    for (const zIdx of config.enabledZones) {
      const zBase = baseZones[zIdx];
      if (currentGap === zBase.s) {
        // ZONA ATINGIDA! Avalia se passa pelos filtros ativados
        const subHist = rolls.slice(0, i + 1);
        const { microWinrate, cicloWinrate, metaCicloWinrate } = getZoneStatsAtPoint(subHist, zIdx);

        const passGeral = !config.enableGeral || microWinrate >= config.geralMinWr;
        const passCiclo = !config.enableCiclo || cicloWinrate >= config.cicloMinWr;
        const passMeta = !config.enableMetaCiclo || metaCicloWinrate >= config.metaCicloMinWr;

        if (passGeral && passCiclo && passMeta) {
          // DISPARO DE ENTRADA NA ZONA!
          totalSignals++;
          const zLabel = zBase.label;
          const startGaleForThisZone = currentGaleCount;

          let hitWhiteInZone = false;
          let hitRedTotalInZone = false;
          let rollHitVal = 0;
          let entryStep = 0;
          let spentInThisZone = 0;

          while (entryStep < config.zonaLen && (i + 1 + entryStep) < rolls.length) {
            const nextRollObj = rolls[i + 1 + entryStep];
            const nextN = typeof nextRollObj.roll === 'number' ? nextRollObj.roll : parseInt(nextRollObj.roll as any, 10);
            const nextIsWhite = nextRollObj.color?.includes('Branco') || nextN === 0;

            const betForThisStep = currentBet;
            accumulatedSpentInCycle += betForThisStep;
            spentInThisZone += betForThisStep;

            if (nextIsWhite) {
              // GREEN! (Saiu o Branco)
              hitWhiteInZone = true;
              rollHitVal = nextN;

              const payout = betForThisStep * 14;
              const netProfit = payout - accumulatedSpentInCycle;

              // Como o custo das jogadas anteriores já foi subtraído de totalPnl a cada pedra,
              // ao dar WIN adicionamos apenas o prêmio (payout - aposta da pedra atual)
              totalPnl += (payout - betForThisStep);
              wins++;

              // Atualiza Sequência de Vitórias
              if (currentStreakType === 'W') currentStreakCount++;
              else { currentStreakType = 'W'; currentStreakCount = 1; }
              if (currentStreakCount > maxWinStreak) maxWinStreak = currentStreakCount;

              trades.push({
                id: tradeId++,
                timestamp: nextRollObj.timestamp,
                zoneLabel: zLabel,
                zoneIndex: zIdx,
                type: 'WIN',
                pnl: netProfit,
                startGaleLevel: startGaleForThisZone,
                galeLevel: currentGaleCount,
                betAmount: betForThisStep,
                rollHit: rollHitVal
              });

              // Reseta Gale para próxima entrada
              currentBet = config.initialBet;
              accumulatedSpentInCycle = 0;
              currentGaleCount = 0;

              // Avança o ponteiro i até a pedra do Branco
              i = i + 1 + entryStep;
              currentGap = 0;
              break;
            } else {
              // Não saiu Branco nesta pedra da zona
              currentGaleCount++;
              totalPnl -= betForThisStep; // Contabiliza o custo parcial da aposta no PnL

              if (currentGaleCount > config.maxGales) {
                // RED TOTAL (Limite máximo de Gales atingido!)
                hitRedTotalInZone = true;
                redsTotal++;

                if (currentStreakType === 'L') currentStreakCount++;
                else { currentStreakType = 'L'; currentStreakCount = 1; }
                if (currentStreakCount > maxLossStreak) maxLossStreak = currentStreakCount;

                trades.push({
                  id: tradeId++,
                  timestamp: nextRollObj.timestamp,
                  zoneLabel: zLabel,
                  zoneIndex: zIdx,
                  type: 'RED_TOTAL',
                  pnl: -accumulatedSpentInCycle,
                  startGaleLevel: startGaleForThisZone,
                  galeLevel: currentGaleCount,
                  betAmount: betForThisStep
                });

                // Reseta Gale para a Mão Inicial
                currentBet = config.initialBet;
                accumulatedSpentInCycle = 0;
                currentGaleCount = 0;

                i = i + 1 + entryStep;
                currentGap += (entryStep + 1);
                break;
              } else {
                // Prepara valor da próxima aposta de Gale
                currentBet = currentBet * config.galeMultiplier;
              }
            }

            entryStep++;
          }

          if (hitWhiteInZone || hitRedTotalInZone) {
            break;
          } else {
            // Concluiu as pedras desta zona sem o Branco (e sem estouro de RED).
            // Registra a entrada PARCIAL (LOSS PARCIAL) indicando a transição de gales!
            trades.push({
              id: tradeId++,
              timestamp: rolls[Math.min(i + config.zonaLen, rolls.length - 1)].timestamp,
              zoneLabel: zLabel,
              zoneIndex: zIdx,
              type: 'LOSS_PARCIAL',
              pnl: -spentInThisZone,
              startGaleLevel: startGaleForThisZone,
              galeLevel: currentGaleCount,
              betAmount: spentInThisZone
            });

            // O Gale fica SUSPENSO (PERSISTENTE) e o ponteiro i avança a quantidade de pedras da zona.
            i = i + config.zonaLen;
            currentGap += config.zonaLen;
            break;
          }
        }
      }
    }

    i++;
  }

  const winrate = totalSignals > 0 ? (wins / (wins + redsTotal)) * 100 : 0;

  return {
    totalSignals,
    wins,
    redsTotal,
    winrate,
    totalPnl,
    maxWinStreak,
    maxLossStreak,
    currentStreak: { type: currentStreakType || 'W', count: currentStreakCount },
    trades: trades.reverse()
  };
}
