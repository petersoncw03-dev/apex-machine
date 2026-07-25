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

export function runMestreCoresSimulation(history: RollData[], maxGalesCores: number = 1) {
    const resultsCores: Record<number, SimulationResult> = {};

    let cStatus: 'standby' | 'active' | 'win' | 'loss' = 'standby';
    let cStep = 0;
    let cLevel = 0;
    let cTarget: 'R' | 'B' | null = null;
    let cSchedMin: number | null = null;

    const WARMUP = 1500;
    if (history.length <= WARMUP) return { cores: [] };

    for (let i = WARMUP; i < history.length; i++) {
        const currentSlice = history.slice(0, i);
        const newRoll = history[i];
        
        const currentMin = new Date(newRoll.timestamp).getMinutes();
        const isRed = newRoll.roll >= 1 && newRoll.roll <= 7;
        const isBlack = newRoll.roll >= 8 && newRoll.roll <= 14;

        const nextMin1 = (currentMin + 1) % 60;
        const nextMin2 = (currentMin + 2) % 60;

        if (cStatus === 'active') {
            if (cSchedMin !== null) {
                if (cSchedMin !== currentMin) {
                    let isPast = false;
                    if (currentMin > cSchedMin && (currentMin - cSchedMin) < 5) isPast = true;
                    if (cSchedMin >= 55 && currentMin < 5) isPast = true;
                    if (isPast) {
                        cStatus = 'standby';
                        cSchedMin = null;
                        cTarget = null;
                    }
                } else {
                    cSchedMin = null; // Minuto exato chegou
                }
            }

            if (cSchedMin === null) {
                const betAmount = 1.0 * Math.pow(2.0, cStep);
                const won = (cTarget === 'R' && isRed) || (cTarget === 'B' && isBlack);
                
                if (won) {
                    cStatus = 'standby';
                    if (!resultsCores[cLevel]) resultsCores[cLevel] = { level: cLevel, target: cTarget || 'Cores', wins: 0, losses: 0, sa: 0, sm: 0, winrate: 0, total: 0, pnl: 0 };
                    resultsCores[cLevel].wins++;
                    resultsCores[cLevel].sa = 0;
                    resultsCores[cLevel].pnl += (betAmount * 2) - betAmount;
                } else {
                    if (!resultsCores[cLevel]) resultsCores[cLevel] = { level: cLevel, target: cTarget || 'Cores', wins: 0, losses: 0, sa: 0, sm: 0, winrate: 0, total: 0, pnl: 0 };
                    resultsCores[cLevel].pnl -= betAmount;
                    
                    if (cStep < maxGalesCores) {
                        cStep++;
                    } else {
                        cStatus = 'standby';
                        resultsCores[cLevel].losses++;
                        resultsCores[cLevel].sa++;
                        if (resultsCores[cLevel].sa > resultsCores[cLevel].sm) resultsCores[cLevel].sm = resultsCores[cLevel].sa;
                    }
                }
            }
        }

        if (cStatus === 'standby') {
            const coresEngine = calculateCoresEngine(currentSlice as any, 3);
            let triggerR = 0;
            let triggerB = 0;
            let scheduleR: null | number = null;
            let scheduleB: null | number = null;

            if (coresEngine.livePatterns.avgRedPatWr >= 80) triggerR++;
            if (coresEngine.livePatterns.avgBlackPatWr >= 80) triggerB++;

            const scheds = coresEngine.scheduledMinutes.filter((s: any) => s.minute === nextMin1 || s.minute === nextMin2);
            for (const s of scheds) {
                if (s.target === 'R') { triggerR++; scheduleR = s.minute; }
                if (s.target === 'B') { triggerB++; scheduleB = s.minute; }
            }

            const colTarget = (currentMin + 1) % 10;
            const colStat = coresEngine.matrixCols[colTarget];
            if (colStat.total >= 3) {
                const cRwr = (colStat.red / colStat.total) * 100;
                const cBwr = (colStat.black / colStat.total) * 100;
                if (cRwr >= 80) { triggerR++; scheduleR = nextMin1; }
                if (cBwr >= 80) { triggerB++; scheduleB = nextMin1; }
            }

            if (triggerR > 0 || triggerB > 0) {
                if (triggerR > triggerB) {
                    cStatus = 'active'; cStep = 0; cLevel = triggerR; cTarget = 'R'; cSchedMin = scheduleR;
                } else if (triggerB > triggerR) {
                    cStatus = 'active'; cStep = 0; cLevel = triggerB; cTarget = 'B'; cSchedMin = scheduleB;
                }
            }
        }
    }

    const calc = (res: Record<number, SimulationResult>) => {
        return Object.values(res).map(r => {
            r.total = r.wins + r.losses;
            r.winrate = r.total > 0 ? (r.wins / r.total) * 100 : 0;
            return r;
        }).sort((a, b) => b.level - a.level);
    };

    return {
        cores: calc(resultsCores)
    };
}
