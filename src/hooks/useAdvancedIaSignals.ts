import { useMemo } from 'react';

export interface RollData {
  id?: string;
  roll: number;
  color: string;
  timestamp: string;
}

export interface IaSignalStats {
  conf: number;
  winRate: number;
  sa: number;
  sm: number;
  total: number;
  wins: number;
}

export interface StratStat {
  name: string;
  winRate: number;
}

class StatTracker {
    minCount = Array(60).fill(null).map(() => ({ total: 0, w: 0 }));
    rowCount = Array(6).fill(null).map(() => ({ total: 0, w: 0 }));
    colCount = Array(10).fill(null).map(() => ({ total: 0, w: 0 }));
    window: number[] = [];
    maxAge: number;

    constructor(hours: number) { this.maxAge = hours * 3600000; }

    add(i: number, globalData: RollData[]) {
        const t = new Date(globalData[i].timestamp).getTime();
        this.window.push(i);
        const m = new Date(globalData[i].timestamp).getMinutes();
        if (isNaN(m) || m < 0 || m > 59) return; // Proteção contra timestamps inválidos
        const isW = globalData[i].roll === 0;
        const r = Math.floor(m / 10);
        const c = m % 10;
        
        this.minCount[m].total++; if (isW) this.minCount[m].w++;
        this.rowCount[r].total++; if (isW) this.rowCount[r].w++;
        this.colCount[c].total++; if (isW) this.colCount[c].w++;

        while (this.window.length > 0) {
            const oldIdx = this.window[0];
            const oldT = new Date(globalData[oldIdx].timestamp).getTime();
            if (t - oldT > this.maxAge) {
                this.window.shift();
                const oldM = new Date(globalData[oldIdx].timestamp).getMinutes();
                if (!isNaN(oldM) && oldM >= 0 && oldM <= 59) {
                    const oldIsW = globalData[oldIdx].roll === 0;
                    const oldR = Math.floor(oldM / 10);
                    const oldC = oldM % 10;
                    
                    this.minCount[oldM].total--; if (oldIsW) this.minCount[oldM].w--;
                    this.rowCount[oldR].total--; if (oldIsW) this.rowCount[oldR].w--;
                    this.colCount[oldC].total--; if (oldIsW) this.colCount[oldC].w--;
                }
            } else {
                break;
            }
        }
    }
}

export function useAdvancedIaSignals(globalData: RollData[], periodHours: number) {
  return useMemo(() => {
    const scores = Array(60).fill(0);
    const activeStrats = [
      'Cruzamento Linha x Coluna (3h)',
      'Quentes (6h - 50%+)',
      'Quentes (12h - 35%+)',
      'Quentes (22h - 22%+)',
      'Minutagem (10/20m)',
      'Horário Cheio (60/120m)',
      'Soma Anterior (+Pedra)',
      'Soma Posterior (+Pedra)',
      'Repetição Exata (24h)',
      'Fibonacci Espaçado (3/5/8)'
    ];

    if (!globalData || globalData.length < 50) return { scores, activeStrats, stats: [], stratStats: activeStrats.map(s => ({name: s, winRate: 0})) };

    // globalData já está ordenado do Mais Antigo (0) para o Mais Novo (length - 1).
    const latestTime = new Date(globalData[globalData.length - 1].timestamp).getTime();
    
    const s3h = new StatTracker(3);
    const s6h = new StatTracker(6);
    const s12h = new StatTracker(12);
    const s22h = new StatTracker(22);

    interface PendingTarget { targetTime: number; creatorTime: number; }
    
    let pending10_20: PendingTarget[] = [];
    let pending60_120: PendingTarget[] = [];
    let pendingFibo: PendingTarget[] = [];
    let pendingSomaAnt: PendingTarget[] = [];
    let pendingSomaPost: PendingTarget[] = [];
    let pendingRep: PendingTarget[] = [];

    const projCutoff = latestTime - Math.max(periodHours, 25) * 3600000;
    
    const historicalScorePerRoll: number[] = Array(globalData.length).fill(0);
    const historicalCreatorPerRoll: number[] = Array(globalData.length).fill(0);
    const stratMatrix: boolean[][] = Array(globalData.length).fill(null).map(() => Array(10).fill(false));
    const stratCreatorMatrix: number[][] = Array(globalData.length).fill(null).map(() => Array(10).fill(0));

    // Correção: o loop i = 0 a length-1 caminha nativamente do Passado pro Presente.
    for (let i = 0; i < globalData.length; i++) {
        const t = new Date(globalData[i].timestamp).getTime();
        s3h.add(i, globalData);
        s6h.add(i, globalData);
        s12h.add(i, globalData);
        s22h.add(i, globalData);

        if (t < projCutoff) continue;
        
        const isW = globalData[i].roll === 0;
        
        if (isW) {
            pending10_20 = pending10_20.filter(p => Math.abs(p.targetTime - t) > 60000); 
            pending60_120 = pending60_120.filter(p => Math.abs(p.targetTime - t) > 60000);
            pendingFibo = pendingFibo.filter(p => Math.abs(p.targetTime - t) > 60000);
        }

        const m = new Date(t).getMinutes();
        if (isNaN(m) || m < 0 || m > 59) continue; // Proteção
        const r = Math.floor(m / 10);
        const c = m % 10;
        
        if (s3h.rowCount[r].total > 0 && s3h.colCount[c].total > 0) {
            if ((s3h.rowCount[r].w / s3h.rowCount[r].total)*100 >= 15 && (s3h.colCount[c].w / s3h.colCount[c].total)*100 >= 15) stratMatrix[i][0] = true;
        }
        if (s6h.minCount[m].total > 0 && (s6h.minCount[m].w / s6h.minCount[m].total)*100 >= 50) stratMatrix[i][1] = true;
        if (s12h.minCount[m].total > 0 && (s12h.minCount[m].w / s12h.minCount[m].total)*100 >= 35) stratMatrix[i][2] = true;
        if (s22h.minCount[m].total > 0 && (s22h.minCount[m].w / s22h.minCount[m].total)*100 >= 22) stratMatrix[i][3] = true;

        let maxCreator = 0;
        const checkPending = (arr: PendingTarget[], stratIdx: number) => {
            arr.forEach(p => { 
                if (Math.abs(p.targetTime - t) <= 60000) {
                    stratMatrix[i][stratIdx] = true;
                    stratCreatorMatrix[i][stratIdx] = p.creatorTime;
                    if (p.creatorTime > maxCreator) maxCreator = p.creatorTime;
                }
            });
        };

        checkPending(pending10_20, 4);
        checkPending(pending60_120, 5);
        checkPending(pendingSomaAnt, 6);
        checkPending(pendingSomaPost, 7);
        checkPending(pendingRep, 8);
        checkPending(pendingFibo, 9);

        historicalScorePerRoll[i] = stratMatrix[i].filter(Boolean).length;
        historicalCreatorPerRoll[i] = maxCreator;

        if (isW) {
            pending10_20.push({ targetTime: t + 10 * 60000, creatorTime: t });
            pending10_20.push({ targetTime: t + 20 * 60000, creatorTime: t });
            pending60_120.push({ targetTime: t + 60 * 60000, creatorTime: t });
            pending60_120.push({ targetTime: t + 120 * 60000, creatorTime: t });
            pendingFibo.push({ targetTime: t + 3 * 60000, creatorTime: t });
            pendingFibo.push({ targetTime: t + 5 * 60000, creatorTime: t });
            pendingFibo.push({ targetTime: t + 8 * 60000, creatorTime: t });
            pendingRep.push({ targetTime: t + 24 * 3600000, creatorTime: t });
            
            if (i > 0) {
                const prevR = globalData[i-1].roll;
                if (prevR > 0) pendingSomaAnt.push({ targetTime: t + prevR * 60000, creatorTime: t });
            }
            if (i < globalData.length - 1) {
                const nextR = globalData[i+1].roll;
                if (nextR > 0) pendingSomaPost.push({ targetTime: t + nextR * 60000, creatorTime: t });
            }
        }
    }

    const allPending = [
        ...pending10_20.map(p => ({...p, sIdx: 4})),
        ...pending60_120.map(p => ({...p, sIdx: 5})),
        ...pendingSomaAnt.map(p => ({...p, sIdx: 6})),
        ...pendingSomaPost.map(p => ({...p, sIdx: 7})),
        ...pendingRep.map(p => ({...p, sIdx: 8})),
        ...pendingFibo.map(p => ({...p, sIdx: 9}))
    ];
    
    for (let m = 0; m < 60; m++) {
        let s = 0;
        const r = Math.floor(m / 10);
        const c = m % 10;
        if (s3h.rowCount[r].total > 0 && s3h.colCount[c].total > 0 && (s3h.rowCount[r].w / s3h.rowCount[r].total)*100 >= 15 && (s3h.colCount[c].w / s3h.colCount[c].total)*100 >= 15) s++;
        if (s6h.minCount[m].total > 0 && (s6h.minCount[m].w / s6h.minCount[m].total)*100 >= 50) s++;
        if (s12h.minCount[m].total > 0 && (s12h.minCount[m].w / s12h.minCount[m].total)*100 >= 35) s++;
        if (s22h.minCount[m].total > 0 && (s22h.minCount[m].w / s22h.minCount[m].total)*100 >= 22) s++;
        scores[m] = s;
    }

    allPending.forEach(p => {
       if (p.targetTime >= latestTime - 10 * 60000 && p.targetTime <= latestTime + 24 * 3600000) {
          const m = new Date(p.targetTime).getMinutes();
          scores[m]++;
       }
    });

    const stats: IaSignalStats[] = [];
    const backtestCutoff = latestTime - periodHours * 3600000;

    for (let confLvl = 1; confLvl <= 8; confLvl++) {
        let cycles = 0;
        let wins = 0;
        let currentSa = 0;
        let maxSa = 0;

        let i = 0;
        while (i < globalData.length) {
            const t = new Date(globalData[i].timestamp).getTime();
            if (t < backtestCutoff) {
                i++;
                continue;
            }

            if (historicalScorePerRoll[i] >= confLvl) {
                let startIdx = i;
                let endIdx = i;
                let maxBlockCreator = historicalCreatorPerRoll[i];

                while (endIdx + 1 < globalData.length) {
                    if (historicalScorePerRoll[endIdx + 1] >= confLvl) {
                        endIdx++;
                        if (historicalCreatorPerRoll[endIdx] > maxBlockCreator) maxBlockCreator = historicalCreatorPerRoll[endIdx];
                    } else if (endIdx + 2 < globalData.length && historicalScorePerRoll[endIdx + 2] >= confLvl) {
                        endIdx += 2;
                        if (historicalCreatorPerRoll[endIdx] > maxBlockCreator) maxBlockCreator = historicalCreatorPerRoll[endIdx];
                    } else {
                        break;
                    }
                    if (endIdx - startIdx > 4) break; 
                }

                let evalStart = Math.max(0, startIdx - 2);
                let evalEnd = Math.min(globalData.length - 1, endIdx + 2);

                let isWin = false;
                for (let j = evalStart; j <= evalEnd; j++) {
                    const rollTime = new Date(globalData[j].timestamp).getTime();
                    if (globalData[j].roll === 0 && rollTime > maxBlockCreator) {
                        isWin = true;
                        break;
                    }
                }

                cycles++;
                if (isWin) {
                    wins++;
                    currentSa = 0;
                } else {
                    currentSa++;
                    if (currentSa > maxSa) maxSa = currentSa;
                }
                i = evalEnd + 1;
            } else {
                i++;
            }
        }

        stats.push({
            conf: confLvl,
            total: cycles,
            wins: wins,
            winRate: cycles > 0 ? (wins / cycles) * 100 : 0,
            sa: currentSa,
            sm: maxSa
        });
    }

    const stratStats: StratStat[] = activeStrats.map(s => ({ name: s, winRate: 0 }));
    
    for (let sIdx = 0; sIdx < 10; sIdx++) {
        let cycles = 0;
        let wins = 0;

        let i = 0;
        while (i < globalData.length) {
            const t = new Date(globalData[i].timestamp).getTime();
            if (t < backtestCutoff) {
                i++;
                continue;
            }

            if (stratMatrix[i][sIdx]) {
                let startIdx = i;
                let endIdx = i;
                let maxBlockCreator = stratCreatorMatrix[i][sIdx];

                while (endIdx + 1 < globalData.length) {
                    if (stratMatrix[endIdx + 1][sIdx]) {
                        endIdx++;
                        if (stratCreatorMatrix[endIdx][sIdx] > maxBlockCreator) maxBlockCreator = stratCreatorMatrix[endIdx][sIdx];
                    } else if (endIdx + 2 < globalData.length && stratMatrix[endIdx + 2][sIdx]) {
                        endIdx += 2;
                        if (stratCreatorMatrix[endIdx][sIdx] > maxBlockCreator) maxBlockCreator = stratCreatorMatrix[endIdx][sIdx];
                    } else {
                        break;
                    }
                    if (endIdx - startIdx > 4) break; 
                }

                let evalStart = Math.max(0, startIdx - 2);
                let evalEnd = Math.min(globalData.length - 1, endIdx + 2);

                let isWin = false;
                for (let j = evalStart; j <= evalEnd; j++) {
                    const rollTime = new Date(globalData[j].timestamp).getTime();
                    if (globalData[j].roll === 0 && rollTime > maxBlockCreator) {
                        isWin = true;
                        break;
                    }
                }

                cycles++;
                if (isWin) wins++;
                i = evalEnd + 1;
            } else {
                i++;
            }
        }
        stratStats[sIdx].winRate = cycles > 0 ? (wins / cycles) * 100 : 0;
    }

    return { scores, activeStrats, stats, stratStats };
  }, [globalData, periodHours]);
}
