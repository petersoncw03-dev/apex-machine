import { calculateRadar, RadarConfig } from '../engines/radarEngine';
import { calculateIA, IaConfig } from '../engines/iaEngine';
import { calculateCoresEngine } from '../engines/coresEngine';

export interface RollData {
    id?: string;
    timestamp: string;
    color: string;
    roll: number;
}

export interface SimulationResult {
    level: number;
    target: string;
    wins: number;
    losses: number;
    sa: number;
    sm: number;
    winrate: number;
    total: number;
    pnl: number;
}

const STRAT_NAMES = [
  'Cruzamento Linha x Coluna (3h)',   // 0
  'Quentes (6h - 50%+)',              // 1
  'Quentes (12h - 35%+)',             // 2
  'Quentes (22h - 22%+)',             // 3
  'Minutagem (10/20m)',               // 4
  'Horário Cheio (60/120m)',          // 5
  'Soma Anterior (+Pedra)',           // 6
  'Soma Posterior (+Pedra)',          // 7
  'Fibonacci Espaçado (3/5/8)',       // 8
  'Zero Absoluto (12h - 0%)',         // 9
  'Frequência Dinâmica (6h/12h)',     // 10
  'Fibo Filtrado (Alta Freq)',        // 11
  'Soma Sanduíche (Cores Iguais)',    // 12
  'Momentum Gaps (Chuva de Brancos)',// 13
  'Matriz de Markov (3ª Ordem)'       // 14
];

export function runMestreSimulation(
    history: RollData[], 
    maxGalesBranco: number = 5, 
    disabledBrancos: Set<number> = new Set(), 
    iaConfig: IaConfig,
    radarConfig?: RadarConfig
) {
    // Agrupamento de resultados agregados
    const resultsBrancos: Record<string, SimulationResult> = {};
    const AGG_NAMES = ['Geral (Todos)', 'Sinal Master', 'Nível 3', 'Nível 4', 'Nível 5', 'Nível 6', 'Nível 7+'];
    
    for (let i = 0; i < AGG_NAMES.length; i++) {
        resultsBrancos[AGG_NAMES[i]] = { level: i, target: AGG_NAMES[i], wins: 0, losses: 0, sa: 0, sm: 0, winrate: 0, total: 0, pnl: 0 };
    }
    
    const aggStatus: Record<string, 'standby' | 'active'> = {};
    const aggStep: Record<string, number> = {};
    for (const name of AGG_NAMES) {
        aggStatus[name] = 'standby';
        aggStep[name] = 0;
    }

    // Agrupamento de resultados individuais (As 15 estratégias)
    const resultsBrancosStrats: Record<number, SimulationResult> = {};
    for (let i = 0; i < 15; i++) {
        resultsBrancosStrats[i] = { level: i, target: STRAT_NAMES[i], wins: 0, losses: 0, sa: 0, sm: 0, winrate: 0, total: 0, pnl: 0 };
    }
    const stratStatus: ('standby' | 'active')[] = Array(15).fill('standby');
    const stratStep: number[] = Array(15).fill(0);

    // Agrupamento de resultados individuais (Os 3 do Radar)
    const resultsRadarStrats: Record<number, SimulationResult> = {};
    const RADAR_NAMES = ['Zonas Quentes', 'Casa Exata', 'Padrões de Cores'];
    for (let i = 0; i < 3; i++) {
        resultsRadarStrats[i] = { level: i, target: RADAR_NAMES[i], wins: 0, losses: 0, sa: 0, sm: 0, winrate: 0, total: 0, pnl: 0 };
    }
    const radarStatus: ('standby' | 'active')[] = Array(3).fill('standby');
    const radarStep: number[] = Array(3).fill(0);

    // Precisamos de pelo menos 1500 pedras de warmup para ter as IAs bem calculadas
    const WARMUP = 1500;
    if (history.length <= WARMUP) return { brancos: [], brancosStrats: [], radarStrats: [] };

    for (let i = WARMUP; i < history.length; i++) {
        const currentSlice = history.slice(0, i);
        const newRoll = history[i];
        
        const isBranco = newRoll.color.toUpperCase() === 'BRANCO' || newRoll.color.toUpperCase() === 'B' || newRoll.color.toUpperCase() === 'WHITE' || Number(newRoll.roll) === 0;
        const currentMin = new Date(newRoll.timestamp).getMinutes();

        const nextMin1 = (currentMin + 1) % 60;
        const nextMin2 = (currentMin + 2) % 60;

        // ==========================================
        // MESTRE DOS BRANCOS SIMULATION
        // ==========================================
        const disabledIA = new Set([4, 5, 6, 8, 9, 10, 11, 12, 13, 14]);
        const radarData = calculateRadar(currentSlice as any, radarConfig);
        const iaData3h = calculateIA(currentSlice as any, 3, disabledIA, true, iaConfig);
        const iaData1h = calculateIA(currentSlice as any, 1, disabledIA, true, iaConfig);

        // 1. Simulação INDIVIDUAL das 15 estratégias
        for (let sIdx = 0; sIdx < 15; sIdx++) {
            if (stratStatus[sIdx] === 'active') {
                const betAmount = 1.0 * Math.pow(1.078, stratStep[sIdx]);
                if (isBranco) {
                    stratStatus[sIdx] = 'standby';
                    resultsBrancosStrats[sIdx].wins++;
                    resultsBrancosStrats[sIdx].sa = 0;
                    resultsBrancosStrats[sIdx].pnl += (betAmount * 14) - betAmount;
                } else {
                    resultsBrancosStrats[sIdx].pnl -= betAmount;
                    if (stratStep[sIdx] < maxGalesBranco) {
                        stratStep[sIdx]++;
                    } else {
                        stratStatus[sIdx] = 'standby';
                        resultsBrancosStrats[sIdx].losses++;
                        resultsBrancosStrats[sIdx].sa++;
                        if (resultsBrancosStrats[sIdx].sa > resultsBrancosStrats[sIdx].sm) resultsBrancosStrats[sIdx].sm = resultsBrancosStrats[sIdx].sa;
                    }
                }
            } else {
                const triggers = iaData3h.activeStratsByMin[nextMin1].includes(sIdx) || iaData3h.activeStratsByMin[nextMin2].includes(sIdx);
                if (triggers) {
                    stratStatus[sIdx] = 'active';
                    stratStep[sIdx] = 0;
                }
            }
        }

        // 1.5 Simulação INDIVIDUAL do Radar
        for (let rIdx = 0; rIdx < 3; rIdx++) {
            if (radarStatus[rIdx] === 'active') {
                const betAmount = 1.0 * Math.pow(1.078, radarStep[rIdx]);
                if (isBranco) {
                    radarStatus[rIdx] = 'standby';
                    resultsRadarStrats[rIdx].wins++;
                    resultsRadarStrats[rIdx].sa = 0;
                    resultsRadarStrats[rIdx].pnl += (betAmount * 14) - betAmount;
                } else {
                    resultsRadarStrats[rIdx].pnl -= betAmount;
                    if (radarStep[rIdx] < maxGalesBranco) {
                        radarStep[rIdx]++;
                    } else {
                        radarStatus[rIdx] = 'standby';
                        resultsRadarStrats[rIdx].losses++;
                        resultsRadarStrats[rIdx].sa++;
                        if (resultsRadarStrats[rIdx].sa > resultsRadarStrats[rIdx].sm) resultsRadarStrats[rIdx].sm = resultsRadarStrats[rIdx].sa;
                    }
                }
            } else {
                let trigger = false;
                if (rIdx === 0 && radarData.hasZonasQuentes) trigger = true;
                if (rIdx === 1 && radarData.hasCasas) trigger = true;
                if (rIdx === 2 && (radarData.hasPatterns1Pt || radarData.hasPatterns2Pts)) trigger = true;
                
                if (trigger) {
                    radarStatus[rIdx] = 'active';
                    radarStep[rIdx] = 0;
                }
            }
        }

        // 2. Simulação AGREGADA (O Setup Principal)
        // Aplicamos os filtros manualmente para decidir o agregado
        const confs1 = iaData3h.activeStratsByMin[nextMin1].filter((s: number) => !disabledBrancos.has(s)).length;
        const confs2 = iaData3h.activeStratsByMin[nextMin2].filter((s: number) => !disabledBrancos.has(s)).length;
        const currentConfluences = Math.max(confs1, confs2);

        let iaPoints = 0;
        if (currentConfluences >= 1) {
            // A aprovação das IAs baseada no winrate das que restaram
            const stat1h = iaData1h.stats.find((s: any) => s.conf === currentConfluences);
            const stat3h = iaData3h.stats.find((s: any) => s.conf === currentConfluences);
            const wr1 = stat1h ? stat1h.winRate : 0;
            const wr3 = stat3h ? stat3h.winRate : 0;
            const maxWinrate = Math.max(wr1, wr3);
            
            if (maxWinrate > 60) iaPoints = 4;
            else if (maxWinrate > 45) iaPoints = 3;
            else if (maxWinrate > 38) iaPoints = 2;
            else if (maxWinrate > 33) iaPoints = 1;
        }
        
        const bCurrentLevel = radarData.radarPoints + iaPoints;
        const isSinalMaster = (currentConfluences >= 3 && iaPoints >= 1);
        const bFinalApproved = isSinalMaster || bCurrentLevel >= 3;

        const activeTriggers = new Set<string>();
        if (bFinalApproved) activeTriggers.add('Geral (Todos)');
        if (isSinalMaster) activeTriggers.add('Sinal Master');
        if (bCurrentLevel === 3) activeTriggers.add('Nível 3');
        if (bCurrentLevel === 4) activeTriggers.add('Nível 4');
        if (bCurrentLevel === 5) activeTriggers.add('Nível 5');
        if (bCurrentLevel === 6) activeTriggers.add('Nível 6');
        if (bCurrentLevel >= 7) activeTriggers.add('Nível 7+');

        for (const name of AGG_NAMES) {
            if (aggStatus[name] === 'active') {
                const betAmount = 1.0 * Math.pow(1.078, aggStep[name]);
                if (isBranco) {
                    aggStatus[name] = 'standby';
                    resultsBrancos[name].wins++;
                    resultsBrancos[name].sa = 0;
                    resultsBrancos[name].pnl += (betAmount * 14) - betAmount;
                } else {
                    resultsBrancos[name].pnl -= betAmount;
                    if (aggStep[name] < maxGalesBranco) {
                        aggStep[name]++;
                    } else {
                        aggStatus[name] = 'standby';
                        resultsBrancos[name].losses++;
                        resultsBrancos[name].sa++;
                        if (resultsBrancos[name].sa > resultsBrancos[name].sm) resultsBrancos[name].sm = resultsBrancos[name].sa;
                    }
                }
            } else if (activeTriggers.has(name)) {
                aggStatus[name] = 'active';
                aggStep[name] = 0;
            }
        }

    }

    const calcObj = (res: Record<string, SimulationResult>) => {
        return Object.values(res).map(r => {
            r.total = r.wins + r.losses;
            r.winrate = r.total > 0 ? (r.wins / r.total) * 100 : 0;
            return r;
        }).sort((a, b) => a.level - b.level);
    };

    const calcAgg = () => {
        return AGG_NAMES.map(name => {
            const r = resultsBrancos[name];
            r.total = r.wins + r.losses;
            r.winrate = r.total > 0 ? (r.wins / r.total) * 100 : 0;
            return r;
        });
    };

    return {
        brancos: calcAgg(),
        brancosStrats: calcObj(resultsBrancosStrats as any),
        radarStrats: calcObj(resultsRadarStrats as any)
    };
}
