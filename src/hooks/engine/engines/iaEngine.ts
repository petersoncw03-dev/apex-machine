// Motor IA isolado no backend
// ═══════════════════════════════════════════════════════════════════════
// MOTOR MATEMÁTICO "MINUTOS DA IA" v3.0 — Sincronização Absoluta
// ═══════════════════════════════════════════════════════════════════════
// Resolvido: O Backtester e a UI agora utilizam "Minutos Absolutos" (AbsMin).
// Isso garante que todas as estratégias (estáticas e dinâmicas) apontando
// para o mesmo minuto se acumulem perfeitamente em uma única confluência
// antes de verificar a margem de acerto, eliminando o erro de "separação"
// que congelava o SA.
// ═══════════════════════════════════════════════════════════════════════

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
  wins: number;
  total: number;
  sa: number;
  sm: number;
}

class HourlyStatTracker {
  minuteHours: Map<number, boolean>[] = Array.from({ length: 60 }, () => new Map());
  rowHours: Map<number, boolean>[] = Array.from({ length: 6 }, () => new Map());
  colHours: Map<number, boolean>[] = Array.from({ length: 10 }, () => new Map());
  maxAgeHours: number;

  constructor(hours: number) {
    this.maxAgeHours = hours;
  }

  add(t: number, m: number, isW: boolean) {
    const hourKey = Math.floor(t / 3600000);
    const row = Math.floor(m / 10);
    const col = m % 10;

    const prevMin = this.minuteHours[m].get(hourKey);
    this.minuteHours[m].set(hourKey, prevMin || isW);

    const prevRow = this.rowHours[row].get(hourKey);
    this.rowHours[row].set(hourKey, prevRow || isW);

    const prevCol = this.colHours[col].get(hourKey);
    this.colHours[col].set(hourKey, prevCol || isW);
  }

  getMinutePct(m: number, currentHourKey: number): number {
    const cutoff = currentHourKey - this.maxAgeHours;
    let total = 0, w = 0;
    for (const [hk, hadW] of this.minuteHours[m]) {
      if (hk > cutoff && hk <= currentHourKey) {
        total++;
        if (hadW) w++;
      }
    }
    return total > 0 ? (w / total) * 100 : 0;
  }

  getRowPct(row: number, currentHourKey: number): number {
    const cutoff = currentHourKey - this.maxAgeHours;
    let total = 0, w = 0;
    for (const [hk, hadW] of this.rowHours[row]) {
      if (hk > cutoff && hk <= currentHourKey) {
        total++;
        if (hadW) w++;
      }
    }
    return total > 0 ? (w / total) * 100 : 0;
  }

  getColPct(col: number, currentHourKey: number): number {
    const cutoff = currentHourKey - this.maxAgeHours;
    let total = 0, w = 0;
    for (const [hk, hadW] of this.colHours[col]) {
      if (hk > cutoff && hk <= currentHourKey) {
        total++;
        if (hadW) w++;
      }
    }
    return total > 0 ? (w / total) * 100 : 0;
  }
}

const ONE_MIN = 60_000;
const STRAT_NAMES = [
  'Cruzamento Linha x Coluna (3h)',
  'Quentes (6h - 50%+)',
  'Quentes (12h - 35%+)',
  'Quentes (22h - 22%+)',
  'Minutagem (10/20m)',
  'Horário Cheio (60/120m)',
  'Soma Anterior (+Pedra)',
  'Soma Posterior (+Pedra)',
  'Fibonacci Espaçado (3/5/8)',
  'Zero Absoluto (12h - 0%)',
  'Frequência Dinâmica (6h/12h)',
  'Fibo Filtrado (Alta Freq)',
  'Soma Sanduíche (Cores Iguais)'
];

interface AbsMinSlot {
    strats: Set<number>;
    maxCreatorTime: number;
}

export function calculateIA(globalData: RollData[], periodHours: number = 12, disabledStrats: Set<number> = new Set(), withMargin: boolean = true, smartFilter: boolean = false) {
    const localDisabledStrats = new Set(disabledStrats);
    const scores = Array(60).fill(0);
    const activeStratsByMin = Array(60).fill(null).map(() => [] as number[]);

    if (!globalData || globalData.length < 50) {
      return {
        scores,
        activeStrats: STRAT_NAMES,
        stats: Array.from({ length: 8 }, (_, i) => ({
          conf: i + 1, winRate: 0, sa: 0, sm: 0, total: 0, wins: 0,
        })),
        stratStats: STRAT_NAMES.map(s => ({ name: s, winRate: 0, wins: 0, total: 0, sa: 0, sm: 0 })),
        disabledStrats,
        history12h: [],
        activeStratsByMin,
        iaApproved: false,
        currentIaScore: 0
      };
    }

    const times: number[] = new Array(globalData.length);
    const minutes: number[] = new Array(globalData.length);
    const isWhite: boolean[] = new Array(globalData.length);

    for (let i = 0; i < globalData.length; i++) {
      const d = new Date(globalData[i].timestamp);
      times[i] = d.getTime();
      minutes[i] = d.getMinutes();
      isWhite[i] = globalData[i].roll === 0;
    }

    const latestTime = times[times.length - 1];
    const backtestCutoff = latestTime - periodHours * 3600000;

    const s3h = new HourlyStatTracker(3);
    const s6h = new HourlyStatTracker(6);
    const s12h = new HourlyStatTracker(12);
    const s22h = new HourlyStatTracker(22);

    const whitesByAbsMin = new Map<number, number[]>();
    for (let i = 0; i < globalData.length; i++) {
        const t = times[i];
        const absMin = Math.floor(t / ONE_MIN);
        if (isWhite[i]) {
            if (!whitesByAbsMin.has(absMin)) whitesByAbsMin.set(absMin, []);
            whitesByAbsMin.get(absMin)!.push(t);
        }
    }

    const absMinSlots = new Map<number, AbsMinSlot>();
    function addSignal(absMin: number, stratIdx: number, creatorTime: number) {
        if (!absMinSlots.has(absMin)) absMinSlots.set(absMin, { strats: new Set(), maxCreatorTime: 0 });
        const slot = absMinSlots.get(absMin)!;
        slot.strats.add(stratIdx);
        if (creatorTime > slot.maxCreatorTime) slot.maxCreatorTime = creatorTime;
    }

    let pendingSomaPost: { creatorTime: number; whiteMinuteTime: number; creatorIdx: number }[] = [];
    let lastProcessedAbsMin = Math.floor(times[0] / ONE_MIN) - 1;

    for (let i = 0; i < globalData.length; i++) {
        const t = times[i];
        const m = minutes[i];
        const w = isWhite[i];
        const currentAbsMin = Math.floor(t / ONE_MIN);

        if (pendingSomaPost.length > 0 && !w) {
            const rollValue = globalData[i].roll;
            if (rollValue >= 2) {
              for (const pending of pendingSomaPost) {
                const targetTime = pending.whiteMinuteTime + rollValue * ONE_MIN;
                addSignal(Math.floor(targetTime / ONE_MIN), 7, pending.creatorTime);
              }
            }
            pendingSomaPost = [];
        }

        if (t >= backtestCutoff) {
            for (let aMin = lastProcessedAbsMin + 1; aMin <= currentAbsMin; aMin++) {
                const minOfHour = aMin % 60;
                const hk = Math.floor((aMin * ONE_MIN) / 3600000);
                const row = Math.floor(minOfHour / 10);
                const col = minOfHour % 10;
                
                if (!localDisabledStrats.has(0) && s3h.getRowPct(row, hk) >= 15 && s3h.getColPct(col, hk) >= 15) addSignal(aMin, 0, 0);
                if (!localDisabledStrats.has(1) && s6h.getMinutePct(minOfHour, hk) >= 50) addSignal(aMin, 1, 0);
                if (!localDisabledStrats.has(2) && s12h.getMinutePct(minOfHour, hk) >= 35) addSignal(aMin, 2, 0);
                if (!localDisabledStrats.has(3) && s22h.getMinutePct(minOfHour, hk) >= 22) addSignal(aMin, 3, 0);
                
                if (!localDisabledStrats.has(9)) {
                    let hasData = false; let hasWhite = false;
                    for (const [hk12, hadW] of s12h.minuteHours[minOfHour]) {
                        if (hk12 > hk - 12 && hk12 <= hk) { hasData = true; if (hadW) hasWhite = true; }
                    }
                    if (hasData && !hasWhite) addSignal(aMin, 9, 0);
                }
            }
        }
        lastProcessedAbsMin = currentAbsMin;

        if (w) {
            if (!localDisabledStrats.has(4)) {
               addSignal(Math.floor((t + 10 * ONE_MIN) / ONE_MIN), 4, t);
               addSignal(Math.floor((t + 20 * ONE_MIN) / ONE_MIN), 4, t);
            }
            if (!localDisabledStrats.has(5)) {
               addSignal(Math.floor((t + 60 * ONE_MIN) / ONE_MIN), 5, t);
               addSignal(Math.floor((t + 120 * ONE_MIN) / ONE_MIN), 5, t);
            }
            if (!localDisabledStrats.has(8)) {
               addSignal(Math.floor((t + 3 * ONE_MIN) / ONE_MIN), 8, t);
               addSignal(Math.floor((t + 5 * ONE_MIN) / ONE_MIN), 8, t);
               addSignal(Math.floor((t + 8 * ONE_MIN) / ONE_MIN), 8, t);
            }
            if (!localDisabledStrats.has(6) && i > 0 && !isWhite[i - 1]) {
               const prevRoll = globalData[i - 1].roll;
               if (prevRoll >= 2) addSignal(Math.floor((t + prevRoll * ONE_MIN) / ONE_MIN), 6, t);
            }
            if (!localDisabledStrats.has(10)) {
               let w6h = 0; let w12h = 0;
               for (let j = i - 1; j >= 0; j--) {
                 const dt = t - times[j];
                 if (dt > 12 * 3600000) break;
                 if (isWhite[j]) { w12h++; if (dt <= 6 * 3600000) w6h++; }
               }
               const avg6 = Math.round((6 * 60) / Math.max(1, w6h));
               const avg12 = Math.round((12 * 60) / Math.max(1, w12h));
               if (avg6 > 1) addSignal(Math.floor((t + avg6 * ONE_MIN) / ONE_MIN), 10, t);
               if (avg12 > 1 && avg12 !== avg6) addSignal(Math.floor((t + avg12 * ONE_MIN) / ONE_MIN), 10, t);
            }
            if (!localDisabledStrats.has(11)) {
               let whitesLastHour = 0;
               for (let j = i - 1; j >= 0; j--) {
                 if (t - times[j] > 60 * ONE_MIN) break;
                 if (isWhite[j]) whitesLastHour++;
               }
               if (whitesLastHour >= 5) {
                  addSignal(Math.floor((t + 3 * ONE_MIN) / ONE_MIN), 11, t);
                  addSignal(Math.floor((t + 5 * ONE_MIN) / ONE_MIN), 11, t);
                  addSignal(Math.floor((t + 8 * ONE_MIN) / ONE_MIN), 11, t);
               }
            }
            if (!localDisabledStrats.has(7)) pendingSomaPost.push({ creatorTime: t, creatorIdx: i, whiteMinuteTime: t });
        } else if (!localDisabledStrats.has(12) && i >= 2 && isWhite[i - 1] && !isWhite[i - 2]) {
            const prevRoll = globalData[i - 2].roll;
            const postRoll = globalData[i].roll;
            if (((prevRoll >= 1 && prevRoll <= 7 && postRoll >= 1 && postRoll <= 7) || (prevRoll >= 8 && prevRoll <= 14 && postRoll >= 8 && postRoll <= 14)) && (prevRoll + postRoll) >= 2) {
               addSignal(Math.floor((times[i - 1] + (prevRoll + postRoll) * ONE_MIN) / ONE_MIN), 12, times[i - 1]);
            }
        }

        s3h.add(t, m, w);
        s6h.add(t, m, w);
        s12h.add(t, m, w);
        s22h.add(t, m, w);
    }

    const sortedAbsMins = Array.from(absMinSlots.keys()).sort((a, b) => a - b);
    const latestAbsMin = Math.floor(latestTime / ONE_MIN);
    
    const currentGhostStats = STRAT_NAMES.map(() => ({ sa: 0, sm: 0, history2h: [] as { t: number, won: boolean }[] }));

    const isStratAllowedNow = (sIdx: number, evalAbsMin: number, useFilter: boolean) => {
        if (localDisabledStrats.has(sIdx)) return false;
        if (!useFilter || [1, 2, 12].includes(sIdx)) return true;
        const g = currentGhostStats[sIdx];
        const evalTime = evalAbsMin * ONE_MIN;
        
        while (g.history2h.length > 0 && evalTime - g.history2h[0].t > 2 * 3600000) g.history2h.shift();
        
        let validTotal = 0; let validWins = 0; let simSa = 0; let simMaxSa = 0;
        const latchTime = evalTime - 3 * ONE_MIN;
        for (const h of g.history2h) {
            if (h.t <= latchTime && h.t > latchTime - 2 * 3600000) { 
                validTotal++; 
                if (h.won) validWins++; 
            }
            if (h.won) simSa = 0; else { simSa++; if (simSa > simMaxSa) simMaxSa = simSa; }
        }
        const wr = validTotal >= 5 ? (validWins / validTotal) * 100 : 0;
        return wr >= 40 || (simMaxSa >= 4 && simSa >= Math.floor(simMaxSa * 0.8));
    };

    const stratStats: StratStat[] = STRAT_NAMES.map(name => ({ name, winRate: 0, wins: 0, total: 0, sa: 0, sm: 0 }));
    const confStats = Array.from({ length: 8 }, (_, i) => ({ conf: i + 1, total: 0, wins: 0, sa: 0, sm: 0, winRate: 0 }));

    for (const absMin of sortedAbsMins) {
        const slot = absMinSlots.get(absMin)!;
        const evalTime = absMin * ONE_MIN;

        let won = false;
        for (let offset = (withMargin ? -1 : 0); offset <= (withMargin ? 1 : 0); offset++) {
            const brancos = whitesByAbsMin.get(absMin + offset);
            if (brancos) {
                for (const bt of brancos) {
                    if (bt > slot.maxCreatorTime) { won = true; break; }
                }
            }
            if (won) break;
        }

        const allowedStrats = new Set<number>();
        for (const sIdx of slot.strats) {
            if (isStratAllowedNow(sIdx, absMin, smartFilter)) allowedStrats.add(sIdx);
        }
        
        const confLevel = allowedStrats.size;

        if (evalTime >= backtestCutoff && absMin <= latestAbsMin - (withMargin ? 1 : 0)) {
            for (const sIdx of allowedStrats) {
                const sStat = stratStats[sIdx];
                sStat.total++;
                if (won) { sStat.wins++; sStat.sa = 0; }
                else { sStat.sa++; if (sStat.sa > sStat.sm) sStat.sm = sStat.sa; }
            }

            for (let c = 1; c <= 8; c++) {
                if (confLevel >= c) {
                    const cStat = confStats[c - 1];
                    cStat.total++;
                    if (won) { cStat.wins++; cStat.sa = 0; }
                    else { cStat.sa++; if (cStat.sa > cStat.sm) cStat.sm = cStat.sa; }
                }
            }
        }

        for (const sIdx of slot.strats) {
            const g = currentGhostStats[sIdx];
            g.history2h.push({ t: evalTime, won });
            if (won) g.sa = 0; else { g.sa++; if (g.sa > g.sm) g.sm = g.sa; }
        }
    }

    const finalScoresResult = Array(60).fill(0);
    const finalStratsResult = Array(60).fill(null).map(() => new Set<number>());
    const latestM = new Date(latestTime).getMinutes();

    for (let m = 0; m < 60; m++) {
        let targetAbsMin = latestAbsMin - latestM + m;
        if (targetAbsMin <= latestAbsMin) targetAbsMin += 60; 

        const row = Math.floor(m / 10); const col = m % 10;
        const hk = Math.floor((targetAbsMin * ONE_MIN) / 3600000);
        if (isStratAllowedNow(0, targetAbsMin, smartFilter) && s3h.getRowPct(row, hk) >= 15 && s3h.getColPct(col, hk) >= 15) finalStratsResult[m].add(0);
        if (isStratAllowedNow(1, targetAbsMin, smartFilter) && s6h.getMinutePct(m, hk) >= 50) finalStratsResult[m].add(1);
        if (isStratAllowedNow(2, targetAbsMin, smartFilter) && s12h.getMinutePct(m, hk) >= 35) finalStratsResult[m].add(2);
        if (isStratAllowedNow(3, targetAbsMin, smartFilter) && s22h.getMinutePct(m, hk) >= 22) finalStratsResult[m].add(3);
        
        if (!localDisabledStrats.has(9)) {
            let hasData = false; let hasWhite = false;
            for (const [hk12, hadW] of s12h.minuteHours[m]) {
                if (hk12 > hk - 12 && hk12 <= hk) { hasData = true; if (hadW) hasWhite = true; }
            }
            if (hasData && !hasWhite && isStratAllowedNow(9, targetAbsMin, smartFilter)) finalStratsResult[m].add(9);
        }
    }

    for (const [aMin, slot] of absMinSlots.entries()) {
        if (aMin > latestAbsMin) {
            const m = aMin % 60;
            for (const sIdx of slot.strats) {
                if (isStratAllowedNow(sIdx, aMin, smartFilter)) {
                    finalStratsResult[m].add(sIdx);
                }
            }
        }
    }

    for (let m = 0; m < 60; m++) {
        finalScoresResult[m] = finalStratsResult[m].size;
    }

    const history12h = Array(60).fill(null).map(() => [] as { hourString: string, hit: boolean }[]);
    const latestHourKey = Math.floor(latestTime / 3600000);
    for (let m = 0; m < 60; m++) {
      for (let hOff = 0; hOff < 12; hOff++) {
         const targetHk = latestHourKey - hOff;
         const hit = s12h.minuteHours[m]?.get(targetHk) || false;
         const date = new Date(targetHk * 3600000);
         history12h[m].push({ hourString: date.getHours().toString().padStart(2, '0') + 'h', hit });
      }
    }

    const currentMin = new Date(latestTime).getMinutes();
    const score1 = finalScoresResult[(currentMin + 1) % 60] || 0;
    const score2 = finalScoresResult[(currentMin + 2) % 60] || 0;
    
    return {
      scores: finalScoresResult,
      activeStrats: STRAT_NAMES,
      stats: confStats.map(c => ({ ...c, winRate: c.total > 0 ? (c.wins / c.total) * 100 : 0 })),
      stratStats: stratStats.map(s => ({ ...s, winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0 })),
      history12h,
      activeStratsByMin: finalStratsResult.map(s => Array.from(s)),
      iaApproved: score1 >= 2 || score2 >= 2,
      currentIaScore: Math.max(score1, score2)
    };
}
