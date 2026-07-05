import { useMemo, useState, useEffect } from 'react';

// Tipagem básica dos dados da roleta
export interface RollData {
  id?: string;
  roll: number;
  color: string;
  timestamp: string;
}

export type SniperState = 'STANDBY' | 'ARMED' | 'FIRING' | 'WIN' | 'LOSS';

export interface SniperMetrics {
  score: number;
  activeSignals: string[];
  confluenceLevel: number;
  cycleSA: number; // Streak Atual de Janelas de 5 Pedras (Losses seguidos)
  cycleSM: number; // Streak Máxima Histórica
  winRateG4: number; // Winrate da estratégia de 5 entradas (G4)
}

export function useMasterSniper(globalData: RollData[], iaScores: number[]) {
  // Estado principal da máquina do Sniper
  const [sniperState, setSniperState] = useState<SniperState>('STANDBY');
  const [countdown, setCountdown] = useState<number>(0);
  const [triggerId, setTriggerId] = useState<string>(''); // Para não re-entrar na mesma pedra

  // Métricas analíticas do Sniper
  const metrics = useMemo<SniperMetrics>(() => {
    if (!globalData || globalData.length < 5) {
      return { score: 0, activeSignals: [], confluenceLevel: 0, cycleSA: 0, cycleSM: 0, winRateG4: 0 };
    }

    const currentMinute = new Date(globalData[globalData.length - 1].timestamp).getUTCMinutes();
    const nextMinute = (currentMinute + 1) % 60;
    
    // 1. Rastreamento de Confluência do Radar IA
    // Verificamos o score do minuto atual e do próximo minuto
    const currentScore = iaScores[currentMinute] || 0;
    const nextScore = iaScores[nextMinute] || 0;
    const bestScore = Math.max(currentScore, nextScore);
    
    // Simplificando: cada ponto no iaScore geralmente representa 1 estratégia apontando
    // Se bestScore >= 3, temos uma confluência massiva (3+ sinais)
    const confluenceLevel = bestScore; 
    
    let baseScore = 0;
    const activeSignals: string[] = [];

    if (confluenceLevel >= 3) {
      baseScore += 40;
      activeSignals.push(`${confluenceLevel} Sinais Cruzados (IA)`);
    } else if (confluenceLevel === 2) {
      baseScore += 20;
    }

    // 2. Simulação de Ciclos de 5 Entradas (G4) no Histórico Recente
    // Para fins de performance, vamos analisar os últimos 200 brancos e ver os padrões de repetição
    // Como a lógica exata de "quando" a IA disparou no passado é pesada para recalcular pedra a pedra,
    // vamos usar uma proxy de frequência matemática:
    // "Quantas vezes um branco ocorreu num raio de 5 pedras após uma zona de tensão (Soma > 20)?"
    
    // (Lógica simplificada de Backtest do Sniper)
    let totalCycles = 0;
    let winCycles = 0;
    let currentSA = 0;
    let maxSM = 0;

    // Varredura simplificada para encontrar SA/SM de Ciclos de 5 (Mock / MVP)
    // Na implementação real, cruzaremos os sinais exatos do backtest
    // Aqui usamos a própria proximidade dos brancos como proxy de "Ciclos"
    let lastWhiteIdx = -1;
    for (let i = 0; i < globalData.length; i++) {
      if (globalData[i].roll === 0) {
        if (lastWhiteIdx !== -1) {
          const dist = i - lastWhiteIdx;
          if (dist <= 5) {
             // Win no ciclo G4
             winCycles++;
             totalCycles++;
             currentSA = 0; // Reseta o SA de Loss
          } else {
             // Loss no ciclo G4 (demorou mais de 5 pedras)
             // A cada bloco de 5 pedras sem branco, é um "Ciclo de Loss"
             const missedCycles = Math.floor((dist - 1) / 5);
             totalCycles += missedCycles;
             currentSA += missedCycles;
             if (currentSA > maxSM) maxSM = currentSA;
          }
        }
        lastWhiteIdx = i;
      }
    }

    // Adicionando peso do SA Crítico
    // Se o SA atual estiver >= 80% do SM (mola esticada)
    if (currentSA > 0 && maxSM > 0 && currentSA >= (maxSM - 1)) {
       baseScore += 40;
       activeSignals.push(`Ciclo de Loss Crítico (SA:${currentSA} SM:${maxSM})`);
    }

    // Winrate da janela de 5 entradas
    const winRateG4 = totalCycles > 0 ? (winCycles / totalCycles) * 100 : 0;
    if (winRateG4 > 65) {
      baseScore += 20;
      activeSignals.push(`Winrate G4 Alto (${winRateG4.toFixed(1)}%)`);
    }

    // Trava o score máximo em 100
    const score = Math.min(100, baseScore);

    return {
      score,
      activeSignals,
      confluenceLevel,
      cycleSA: currentSA,
      cycleSM: maxSM,
      winRateG4
    };
  }, [globalData, iaScores]);


  // 3. Máquina de Estados (Trigger & Countdown)
  useEffect(() => {
    if (!globalData || globalData.length === 0) return;
    const lastRoll = globalData[globalData.length - 1];

    if (sniperState === 'STANDBY' || sniperState === 'WIN' || sniperState === 'LOSS') {
      // Condição de Disparo (Score Crítico >= 80)
      if (metrics.score >= 80 && (lastRoll.id || lastRoll.timestamp) !== triggerId) {
        setSniperState('FIRING');
        setCountdown(5);
        setTriggerId((lastRoll.id || lastRoll.timestamp));
      }
    } 
    else if (sniperState === 'FIRING') {
      // Se estamos atirando, avaliamos a nova pedra
      if ((lastRoll.id || lastRoll.timestamp) !== triggerId) {
        if (lastRoll.roll === 0) {
          // BATEU BRANCO NO CICLO!
          setSniperState('WIN');
          setCountdown(0);
          setTriggerId((lastRoll.id || lastRoll.timestamp)); // Atualiza para não engatilhar na mesma pedra
        } else {
          // NÃO BATEU BRANCO, DECREMENTA O TIRO
          const newCount = countdown - 1;
          if (newCount <= 0) {
            // ZEROU A CONTAGEM
            // Regra de Extensão Dinâmica: Se o padrão continua crítico (Score >= 80), estende!
            if (metrics.score >= 80) {
               setCountdown(5); // Re-estica a proteção
               setTriggerId((lastRoll.id || lastRoll.timestamp));
            } else {
               setSniperState('LOSS');
               setCountdown(0);
               setTriggerId((lastRoll.id || lastRoll.timestamp));
            }
          } else {
            setCountdown(newCount);
            setTriggerId((lastRoll.id || lastRoll.timestamp));
          }
        }
      }
    }
  }, [globalData, metrics.score]);

  // Se ficou no estado WIN/LOSS, volta pro STANDBY rapidamente após algumas rodadas
  // Aqui estamos simplificando, ele voltará para STANDBY se o score cair ou depois de 1 rodada
  useEffect(() => {
    if ((sniperState === 'WIN' || sniperState === 'LOSS') && metrics.score < 80) {
       setSniperState('STANDBY');
    }
  }, [globalData, metrics.score, sniperState]);

  return {
    state: sniperState,
    countdown,
    metrics
  };
}
