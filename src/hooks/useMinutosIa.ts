import { useMemo, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════
// MOTOR MATEMÁTICO "MINUTOS DA IA" v2.0 — Reescrita Completa
// ═══════════════════════════════════════════════════════════════════════
// Regras fundamentais implementadas:
//   1. Backtester contínuo (sem vazamento de dados do futuro)
//   2. Ciclo de proteção por TEMPO (minuto -2 a +2), não por índice
//   3. Trava de Ouro (creatorTime): branco gerador nunca valida o próprio sinal
//   4. Anti-sombreamento: branco no primeiro alvo mata alvos posteriores do MESMO gerador
//   5. Soma Posterior usa pedra disponível DEPOIS do branco (sem olhar futuro)
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

export interface CycleStreak {
  type: 'W' | 'L';
  count: number;
}

export interface StratStat {
  name: string;
  winRate: number;
  winRateMicro: number;
  winRateCiclo: number;
  wins: number;
  total: number;
  winsMicro: number;
  totalMicro: number;
  winsCiclo: number;
  totalCiclo: number;
  sa: number;
  sm: number;
  currentCycleState: { type: 'W' | 'L' | null; count: number };
  currentCycleWinrate: number;
  currentCycleOccurrences: number;
  currentCycleWins: number;
  groupedCycles: CycleStreak[];
  recentCycles: { won: boolean; t: number }[];
}

// ─── Tracker de Estatísticas POR HORA ────────────────────────────────
// Conta quantas HORAS distintas (não rolls) tiveram branco em cada
// minuto/linha/coluna. Ex: "em 3 das últimas 6h, o minuto 37 deu branco = 50%"
// Isso é fundamental porque cada minuto tem ~4 rolls, e contar por roll
// daria sempre ~6.7%, nunca atingindo thresholds de 50%/35%/22%.
class HourlyStatTracker {
  // Para cada minuto (0-59): Map<hourKey, hadWhite>
  minuteHours: Map<number, boolean>[] = Array.from({ length: 60 }, () => new Map());
  // Para cada linha (0-5): Map<hourKey, hadWhite>
  rowHours: Map<number, boolean>[] = Array.from({ length: 6 }, () => new Map());
  // Para cada coluna (0-9): Map<hourKey, hadWhite>
  colHours: Map<number, boolean>[] = Array.from({ length: 10 }, () => new Map());
  maxAgeHours: number;

  constructor(hours: number) {
    this.maxAgeHours = hours;
  }

  add(t: number, m: number, isW: boolean) {
    const hourKey = Math.floor(t / 3600000);
    const row = Math.floor(m / 10);
    const col = m % 10;

    // Minuto: registrar a hora e se teve branco
    const prevMin = this.minuteHours[m].get(hourKey);
    this.minuteHours[m].set(hourKey, prevMin || isW);

    // Linha: registrar
    const prevRow = this.rowHours[row].get(hourKey);
    this.rowHours[row].set(hourKey, prevRow || isW);

    // Coluna: registrar
    const prevCol = this.colHours[col].get(hourKey);
    this.colHours[col].set(hourKey, prevCol || isW);
  }

  // Retorna { total: horas com dados, w: horas com branco } para um minuto (aceita horas customizadas)
  getMinutePct(m: number, currentHourKey: number, customHours?: number): number {
    const hoursToUse = customHours && customHours > 0 ? customHours : this.maxAgeHours;
    const cutoff = currentHourKey - hoursToUse;
    let total = 0, w = 0;
    for (const [hk, hadW] of this.minuteHours[m]) {
      if (hk > cutoff && hk <= currentHourKey) {
        total++;
        if (hadW) w++;
      }
    }
    return total > 0 ? (w / total) * 100 : 0;
  }

  // Retorna % de horas com branco para uma linha
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

  // Retorna % de horas com branco para uma coluna
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

// ─── Alvo Dinâmico (Pending Target) ────────────────────────────────
// Representa um "míssil" disparado por uma estratégia dinâmica.
interface PendingTarget {
  targetTime: number;    // Timestamp do minuto-alvo
  creatorTime: number;
    creatorIdx: number;
  stratIdx: number;      // Índice da estratégia (4-9)
  groupId: string;       // Identificador do grupo para anti-sombreamento
  priority: number;      // Ordem dentro do grupo (ex: 10m=1, 20m=2)
}

// ─── Sinal Resolvido ───────────────────────────────────────────────
// Um sinal que foi avaliado (o minuto-alvo já passou).
interface ResolvedSignal {
  targetMinute: number;  // Minuto exato do alvo (0-59)
  targetTime: number;    // Timestamp do alvo
  creatorTime: number;   // Timestamp do branco gerador
  stratIdx: number;      // Índice da estratégia
  isWin: boolean;        // Se bateu branco na janela +2/-2
}

const ONE_MIN = 60_000;
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

export interface WinrateFilterConfig {
  enabled: boolean;
  minWr: number;
  maxWr: number;
  hours: number;
}

export function useMinutosIa(
  globalData: RollData[], 
  periodHours: number, 
  disabledStrats: Set<number> = new Set(), 
  withMargin: boolean = true, 
  smartFilter: boolean = false,
  microFilter?: WinrateFilterConfig,
  macroFilter?: WinrateFilterConfig,
  minutoFilter?: WinrateFilterConfig
) {
  const latchedAllowedFiltered = useRef(new Set<string>());
  const latchedAllowedUnfiltered = useRef(new Set<string>());
  const latchedGridFiltered = useRef(new Map<number, { score: number, strats: Set<number> }>());
  const latchedGridUnfiltered = useRef(new Map<number, { score: number, strats: Set<number> }>());

  return useMemo(() => {
    const defaultDisabled = new Set([4, 5, 6, 8, 9, 10, 11, 12]);
    const localDisabledStrats = disabledStrats && disabledStrats.size > 0 
      ? new Set(disabledStrats)
      : defaultDisabled;
    const scores = Array(60).fill(0);
    const activeStratsByMin = Array(60).fill(null).map(() => [] as number[]);

    if (!globalData || globalData.length < 50) {
      return {
        scores,
        activeStrats: STRAT_NAMES,
        stats: Array.from({ length: 8 }, (_, i) => ({
          conf: i + 1, winRate: 0, sa: 0, sm: 0, total: 0, wins: 0,
        })),
        stratStats: STRAT_NAMES.map(s => ({
          name: s, winRate: 0, winRateMicro: 0, winRateCiclo: 0, wins: 0, total: 0, winsMicro: 0, totalMicro: 0, winsCiclo: 0, totalCiclo: 0, sa: 0, sm: 0,
          currentCycleState: { type: null, count: 0 }, currentCycleWinrate: 0, currentCycleOccurrences: 0, currentCycleWins: 0,
          groupedCycles: [], recentCycles: []
        })),
        disabledStrats
      };
    }

    // ════════════════════════════════════════════════════════════════
    // FASE 1: Pré-processar timestamps (evita criar Date repetidamente)
    // ════════════════════════════════════════════════════════════════
    const times: number[] = new Array(globalData.length);
    const minutes: number[] = new Array(globalData.length);
    const isWhite: boolean[] = new Array(globalData.length);

    for (let i = 0; i < globalData.length; i++) {
      const d = new Date(globalData[i].timestamp);
      times[i] = d.getTime();
      minutes[i] = d.getMinutes();
      const rVal = Number(globalData[i]?.roll);
      const cStr = String(globalData[i]?.color || '').toUpperCase();
      isWhite[i] = (!isNaN(rVal) && rVal === 0) || cStr === 'BRANCO' || cStr === 'WHITE' || cStr === 'B' || cStr === 'W' || cStr === '0';
    }

    const latestTime = times[times.length - 1];
    const backtestCutoff = latestTime - periodHours * 3600000;

    // ════════════════════════════════════════════════════════════════
    // FASE 2: Percorrer dados do passado ao presente
    //   - Alimentar StatTrackers (janelas deslizantes de 3h, 6h, 12h, 22h)
    //   - Gerar/resolver alvos dinâmicos
    //   - Registrar quais estratégias acertaram cada pedra
    // ════════════════════════════════════════════════════════════════
    const s3h = new HourlyStatTracker(3);
    const s6h = new HourlyStatTracker(6);
    const s12h = new HourlyStatTracker(12);
    const s22h = new HourlyStatTracker(22);

    // Alvos dinâmicos pendentes (ainda não resolvidos)
    let pendingTargets: PendingTarget[] = [];

    // Grupos de anti-sombreamento ativos (groupId → já foi abatido?)
    

    // Sinais resolvidos para backtest
    const resolvedSignals: ResolvedSignal[] = [];

    // Para cada pedra, quais estratégias geraram sinal naquele minuto
    // (usado para calcular scores e confluências)
    const signalsAtRoll: Set<number>[] = new Array(globalData.length);
    for (let i = 0; i < globalData.length; i++) signalsAtRoll[i] = new Set();

    // creatorTime de cada sinal dinâmico por estratégia naquele roll
    const creatorAtRoll: Map<number, number>[] = new Array(globalData.length);
    for (let i = 0; i < globalData.length; i++) creatorAtRoll[i] = new Map();

    // Precisamos saber a última pedra antes de cada branco (para Soma Anterior)
    // e a primeira pedra depois de cada branco (para Soma Posterior — resolvida com atraso)

    // Soma Posterior: quando um branco cai no índice i, precisamos esperar i+1
    // para saber qual pedra veio depois. Armazenamos brancos pendentes aqui.
    let pendingSomaPost: { creatorTime: number; whiteMinuteTime: number; creatorIdx: number }[] = [];

    for (let i = 0; i < globalData.length; i++) {
      const t = times[i];
      const m = minutes[i];
      const w = isWhite[i];

      if (isNaN(m) || m < 0 || m > 59) continue;

      // (A alimentação dos HourlyStatTrackers foi movida para o FINAL do loop
      // para evitar que um branco atual valide a si mesmo nas estratégias estáticas)

      // ── Resolver Soma Posterior pendente ────────────────────────
      // Se havia um branco esperando pela próxima pedra, agora temos ela.
      if (pendingSomaPost.length > 0 && !w) {
        // A pedra atual NÃO é branca — é a "próxima pedra" do branco anterior
        const rollValue = Number(globalData[i]?.roll || 0);
        if (rollValue >= 2) { // Evita alvo no mesmo minuto (0) ou próximo minuto (1)
          for (const pending of pendingSomaPost) {
            const targetTime = pending.whiteMinuteTime + rollValue * ONE_MIN;
            pendingTargets.push({
              targetTime,
              creatorTime: pending.creatorTime,
              creatorIdx: pending.creatorIdx,
              stratIdx: 7, // Soma Posterior
              groupId: `post_${pending.creatorTime}`,
              priority: 1,
            });
          }
        }
        pendingSomaPost = [];
      }

      // ── Verificar alvos dinâmicos que atingiram este minuto ────
      const newPending: PendingTarget[] = [];
      for (const pt of pendingTargets) {
        const diff = t - pt.targetTime;

        // Se ainda não chegou no momento do alvo (> 2 min antes)
        if (pt.targetTime - t > 2 * ONE_MIN) {
          newPending.push(pt);
          continue;
        }

        // Se está dentro da janela do alvo (entre -2min e +2min)
        if (Math.abs(diff) <= 2 * ONE_MIN) {
          signalsAtRoll[i].add(pt.stratIdx);
          creatorAtRoll[i].set(pt.stratIdx, pt.creatorTime);
          newPending.push(pt); // Mantém ativo durante toda a janela!
          continue;
        }

        // Se passou do tempo (+2min em diante), expira e sai do newPending
      }
      pendingTargets = newPending;

      // ── Verificar estratégias ESTÁTICAS para este minuto ───────
      // Só começamos a gerar sinais dentro do período de backtest
      // (mas os StatTrackers são alimentados desde o início para ter dados retroativos)
      if (t >= backtestCutoff) {
        const row = Math.floor(m / 10);
        const col = m % 10;
        const currentHourKey = Math.floor(t / 3600000);

        // E1: Cruzamento Linha x Coluna (3h) — Linha ≥66% E Coluna ≥66% (pelo menos 2h com branco nas últimas 3h)
        if (!localDisabledStrats.has(0)) {
          const rowPct = s3h.getRowPct(row, currentHourKey);
          const colPct = s3h.getColPct(col, currentHourKey);
          if (rowPct >= 66 && colPct >= 66) {
            signalsAtRoll[i].add(0);
          }
        }

        // E2: Minutos Quentes (6h — ≥50%)
        if (!localDisabledStrats.has(1) && s6h.getMinutePct(m, currentHourKey) >= 50) signalsAtRoll[i].add(1);

        // E3: Minutos Quentes (12h — ≥35%)
        if (!localDisabledStrats.has(2) && s12h.getMinutePct(m, currentHourKey) >= 35) signalsAtRoll[i].add(2);

        // E4: Minutos Quentes (22h — ≥22%)
        if (!localDisabledStrats.has(3) && s22h.getMinutePct(m, currentHourKey) >= 22) signalsAtRoll[i].add(3);

        // E9: Zero Absoluto (12h — 0%)
        // Somente conta se tivermos pelo menos 1 hora de dados nas últimas 12h para este minuto
        if (!localDisabledStrats.has(9)) {
          let hasData = false;
          let hasWhite = false;
          for (const [hk, hadW] of s12h.minuteHours[m]) {
            if (hk > currentHourKey - 12 && hk <= currentHourKey) {
              hasData = true;
              if (hadW) hasWhite = true;
            }
          }
          if (hasData && !hasWhite) signalsAtRoll[i].add(9);
        }
      }

      // ── Se caiu Branco: disparar alvos dinâmicos ───────────────
      if (w) {


        // Limpar grupos antigos do shadowedGroups (mais de 3h)
        // (não é crítico, mas evita crescimento infinito)

        const gId10 = `min10_${t}`;
        const gId60 = `min60_${t}`;
        const gIdFib = `fib_${t}`;

        // E5: Minutagem (10/20m)
        if (!localDisabledStrats.has(4)) {
          pendingTargets.push({ targetTime: t + 10 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 4, groupId: gId10, priority: 1 });
          pendingTargets.push({ targetTime: t + 20 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 4, groupId: gId10, priority: 2 });
        }

        // E6: Horário Cheio (60/120m)
        if (!localDisabledStrats.has(5)) {
          pendingTargets.push({ targetTime: t + 60 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 5, groupId: gId60, priority: 1 });
          pendingTargets.push({ targetTime: t + 120 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 5, groupId: gId60, priority: 2 });
        }

        // E8: Fibonacci (3/5/8m)
        if (!localDisabledStrats.has(8)) {
          pendingTargets.push({ targetTime: t + 3 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 8, groupId: gIdFib, priority: 1 });
          pendingTargets.push({ targetTime: t + 5 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 8, groupId: gIdFib, priority: 2 });
          pendingTargets.push({ targetTime: t + 8 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 8, groupId: gIdFib, priority: 3 });
        }

        // E7: Soma Anterior — soma o valor da pedra ANTES deste branco
        if (!localDisabledStrats.has(6) && i > 0 && !isWhite[i - 1]) {
          const prevRoll = Number(globalData[i - 1]?.roll || 0);
          if (prevRoll >= 2) { // Evita criar sinal para o exato momento atual (se fosse 0) ou proximo minuto (se fosse 1)
            pendingTargets.push({
              targetTime: t + prevRoll * ONE_MIN,
              creatorTime: t, creatorIdx: i,
              stratIdx: 6, // Soma Anterior
              groupId: `ant_${t}`,
              priority: 1,
            });
          }
        }
        // E10: Frequência Dinâmica (6h/12h)
        if (!localDisabledStrats.has(10)) {
          let w6h = 0;
          let w12h = 0;
          for (let j = i - 1; j >= 0; j--) {
            const dt = t - times[j];
            if (dt > 12 * 3600000) break;
            if (isWhite[j]) {
              w12h++;
              if (dt <= 6 * 3600000) w6h++;
            }
          }
          const avg6 = Math.round((6 * 60) / Math.max(1, w6h));
          const avg12 = Math.round((12 * 60) / Math.max(1, w12h));
          
          if (avg6 > 1) {
            pendingTargets.push({ targetTime: t + avg6 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 10, groupId: `freq_${t}`, priority: 1 });
          }
          if (avg12 > 1 && avg12 !== avg6) {
            pendingTargets.push({ targetTime: t + avg12 * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 10, groupId: `freq_${t}`, priority: 2 });
          }
        }

        // E11: Fibo Filtrado (Alta Freq)
        if (!localDisabledStrats.has(11)) {
          let whitesLastHour = 0;
          for (let j = i - 1; j >= 0; j--) {
            if (t - times[j] > 60 * ONE_MIN) break;
            if (isWhite[j]) whitesLastHour++;
          }
          if (whitesLastHour >= 5) {
            const fibs = [3, 5, 8];
            fibs.forEach((f, idx) => {
              pendingTargets.push({ targetTime: t + f * ONE_MIN, creatorTime: t, creatorIdx: i, stratIdx: 11, groupId: `fibfilt_${t}`, priority: idx + 1 });
            });
          }
        }

        // E13: Momentum Gaps (Chuva de Brancos)
        if (!localDisabledStrats.has(13)) {
          // Track gaps between recent whites
          let whites: number[] = [];
          for (let j = i; j >= 0 && whites.length < 4; j--) {
            if (isWhite[j]) whites.push(times[j]);
          }
          if (whites.length >= 4) {
            const g1 = Math.round((whites[2] - whites[3]) / ONE_MIN);
            const g2 = Math.round((whites[1] - whites[2]) / ONE_MIN);
            const g3 = Math.round((whites[0] - whites[1]) / ONE_MIN);
            if (g3 < g2 && g2 < g1 && g3 <= 15) {
              const proj = Math.max(2, g3 + Math.round((g3 - g1) / 2));
              pendingTargets.push({
                targetTime: t + proj * ONE_MIN,
                creatorTime: t, creatorIdx: i,
                stratIdx: 13,
                groupId: `mom_${t}`,
                priority: 1
              });
            }
          }
        }

        // E14: Matriz de Markov 3ª Ordem
        if (!localDisabledStrats.has(14) && i >= 3) {
          const c3 = isWhite[i-3] ? 'W' : (Number(globalData[i-3]?.roll) >= 1 && Number(globalData[i-3]?.roll) <= 7 ? 'R' : 'B');
          const c2 = isWhite[i-2] ? 'W' : (Number(globalData[i-2]?.roll) >= 1 && Number(globalData[i-2]?.roll) <= 7 ? 'R' : 'B');
          const c1 = isWhite[i-1] ? 'W' : (Number(globalData[i-1]?.roll) >= 1 && Number(globalData[i-1]?.roll) <= 7 ? 'R' : 'B');
          const stateKey = `${c3}_${c2}_${c1}`;
          
          let stateCount = 0;
          let whiteHits = 0;
          for (let j = i - 1; j >= Math.max(0, i - 1500); j--) {
            if (j >= 3) {
              const p3 = isWhite[j-3] ? 'W' : (Number(globalData[j-3]?.roll) >= 1 && Number(globalData[j-3]?.roll) <= 7 ? 'R' : 'B');
              const p2 = isWhite[j-2] ? 'W' : (Number(globalData[j-2]?.roll) >= 1 && Number(globalData[j-2]?.roll) <= 7 ? 'R' : 'B');
              const p1 = isWhite[j-1] ? 'W' : (Number(globalData[j-1]?.roll) >= 1 && Number(globalData[j-1]?.roll) <= 7 ? 'R' : 'B');
              if (`${p3}_${p2}_${p1}` === stateKey) {
                stateCount++;
                if (isWhite[j]) whiteHits++;
              }
            }
          }
          if (stateCount >= 5 && (whiteHits / stateCount) >= 0.10) {
            pendingTargets.push({
              targetTime: t + 3 * ONE_MIN,
              creatorTime: t, creatorIdx: i,
              stratIdx: 14,
              groupId: `markov_${t}`,
              priority: 1
            });
          }
        }

        // E8: Soma Posterior — precisamos esperar a PRÓXIMA pedra (não-branca)
        if (!localDisabledStrats.has(7)) {
          pendingSomaPost.push({ creatorTime: t, creatorIdx: i, whiteMinuteTime: t });
        }
      } else {
        // E12: Soma Sanduíche (Cores Iguais)
        if (!localDisabledStrats.has(12) && i >= 2) {
          if (isWhite[i - 1] && !isWhite[i - 2]) {
            const prevRoll = Number(globalData[i - 2]?.roll || 0);
            const postRoll = Number(globalData[i]?.roll || 0);
            const isPrevRed = prevRoll >= 1 && prevRoll <= 7;
            const isPrevBlack = prevRoll >= 8 && prevRoll <= 14;
            const isPostRed = postRoll >= 1 && postRoll <= 7;
            const isPostBlack = postRoll >= 8 && postRoll <= 14;

            if ((isPrevRed && isPostRed) || (isPrevBlack && isPostBlack)) {
              const soma = prevRoll + postRoll;
              if (soma >= 2) {
                pendingTargets.push({
                  targetTime: times[i - 1] + soma * ONE_MIN,
                  creatorTime: times[i - 1], creatorIdx: i - 1,
                  stratIdx: 12,
                  groupId: `sandcor_${times[i - 1]}`,
                  priority: 1
                });
              }
            }
          }
        }
      }


      // ── Alimentar HourlyStatTrackers ─────────────────────────────
      // Movido para o final para garantir que as estatísticas reflitam o estado
      // ANTES desta pedra cair, prevenindo vazamento de dados (auto-validação)
      s3h.add(t, m, w);
      s6h.add(t, m, w);
      s12h.add(t, m, w);
      s22h.add(t, m, w);
    }
    // Verifica se o minuto de um roll está dentro da janela {M-1, M, M+1} (ou apenas {M} se sem margem)
    const isMinuteInWindow = (rollMin: number, targetMin: number): boolean => {
      if (!withMargin) return rollMin === targetMin;
      const diff = Math.abs(rollMin - targetMin);
      return diff <= 1 || diff >= 59; // Wraparound: min 0 aceita min 59, e vice-versa
    };

    // Função: verifica se houve branco na janela ±1min ao redor de targetIdx (ou 0.5min se sem margem)
    // respeitando creatorTime (Trava de Ouro)
    const checkCycleWin = (targetIdx: number, creatorTime: number): boolean => {
      const targetT = times[targetIdx];
      const targetMin = minutes[targetIdx];
      // Buscar pedras que caíram de -1.5min a +1.5min do alvo (margem de segurança) ou 0.5min se sem margem
      const windowRange = withMargin ? 1.5 : 0.5;
      const windowStart = targetT - windowRange * ONE_MIN;
      const windowEnd = targetT + windowRange * ONE_MIN;

      // Buscar para trás
      for (let j = targetIdx; j >= 0 && times[j] >= windowStart; j--) {
        if (isWhite[j] && times[j] > creatorTime && isMinuteInWindow(minutes[j], targetMin)) return true;
      }
      // Buscar para frente
      for (let j = targetIdx + 1; j < globalData.length && times[j] <= windowEnd; j++) {
        if (isWhite[j] && times[j] > creatorTime && isMinuteInWindow(minutes[j], targetMin)) return true;
      }
      return false;
    };


    // ════════════════════════════════════════════════════════════════
    // FASE 2.5: MODO FANTASMA (Filtro Inteligente SA/SM/WR)
    // ════════════════════════════════════════════════════════════════
    const signalAllowed = new Set<string>();
          const currentGhostStats = STRAT_NAMES.map(() => ({ sa: 0, sm: 0, wr: 0 }));

    for (let sIdx = 0; sIdx < STRAT_NAMES.length; sIdx++) {
      let currentSa = 0;
      let maxSa = 0;
      const history2h: { t: number, won: boolean }[] = [];
      let lastEvalEnd = -1;

      const defaultMicro: WinrateFilterConfig = { enabled: true, minWr: 20, maxWr: 100, hours: 1 };
      const defaultMacro: WinrateFilterConfig = { enabled: true, minWr: 30, maxWr: 100, hours: 72 };
      const activeMicroFilter = microFilter || defaultMicro;
      const activeMacroFilter = macroFilter || defaultMacro;

      const microWindowMs = activeMicroFilter.hours * 3600000;
      const macroWindowMs = activeMacroFilter.hours * 3600000;

      for (let i = 0; i < globalData.length; i++) {
        if (!signalsAtRoll[i].has(sIdx)) continue;
        if (i <= lastEvalEnd) continue;

        const t = times[i];
        while (history2h.length > 0 && t - history2h[0].t > Math.max(microWindowMs, macroWindowMs, 24 * 3600000)) {
          history2h.shift();
        }

        const cTime = creatorAtRoll[i].get(sIdx) || 0;
        
        // Calcular Winrate Micro no momento T (últimas microHours)
        const microItems = history2h.filter(h => t - h.t <= microWindowMs);
        const microTotal = microItems.length;
        const microWins = microItems.filter(h => h.won).length;
        const microWr = microTotal >= 3 ? (microWins / microTotal) * 100 : 100;

        // Calcular Winrate Macro no momento T (últimas macroHours)
        const macroItems = history2h.filter(h => t - h.t <= macroWindowMs);
        const macroTotal = macroItems.length;
        const macroWins = macroItems.filter(h => h.won).length;
        const macroWr = macroTotal >= 3 ? (macroWins / macroTotal) * 100 : 100;

        let passMicro = true;
        if (activeMicroFilter.enabled) {
          passMicro = microWr >= activeMicroFilter.minWr && microWr <= activeMicroFilter.maxWr;
        }

        let passMacro = true;
        if (activeMacroFilter.enabled) {
          passMacro = macroWr >= activeMacroFilter.minWr && macroWr <= activeMacroFilter.maxWr;
        }

        let passMinuto = true;
        if (minutoFilter?.enabled) {
          const m = minutes[i];
          const hk = Math.floor(t / 3600000);
          const minutoWr = s12h.getMinutePct(m, hk, minutoFilter.hours);
          passMinuto = minutoWr >= minutoFilter.minWr && minutoWr <= minutoFilter.maxWr;
        }

        let allowed = passMicro && passMacro && passMinuto;
        if (smartFilter && ![1, 2, 12].includes(sIdx)) {
          let simSa = 0;
          let simMaxSa = 0;
          for (const h of history2h) {
            if (h.won) simSa = 0;
            else {
              simSa++;
              if (simSa > simMaxSa) simMaxSa = simSa;
            }
          }
          const wr2h = history2h.length >= 5 ? (history2h.filter(h => h.won).length / history2h.length) * 100 : 0;
          if (wr2h < 40 && !(simMaxSa >= 4 && simSa >= Math.floor(simMaxSa * 0.8))) {
            allowed = false;
          }
        }

        if (allowed) signalAllowed.add(`${i}_${sIdx}`);
        const won = checkCycleWin(i, cTime);
        history2h.push({ t, won });

        if (won) {
          currentSa = 0;
        } else {
          currentSa++;
          if (currentSa > maxSa) maxSa = currentSa;
        }

        const windowRange = withMargin ? 1.5 : 0.5;
        const windowEnd = t + windowRange * ONE_MIN;
        lastEvalEnd = i;
        for (let j = i + 1; j < globalData.length && times[j] <= windowEnd; j++) {
          if (signalsAtRoll[j].has(sIdx)) {
            lastEvalEnd = j;
            if (allowed) signalAllowed.add(`${j}_${sIdx}`);
          }
        }
      }

      // Salvar estado atual para os sinais futuros (Phase 3)
      const tNow = latestTime;
      while (history2h.length > 0 && tNow - history2h[0].t > 2 * 3600000) {
        history2h.shift();
      }
      const total2h = history2h.length;
      const wins2h = history2h.filter(h => h.won).length;
      currentGhostStats[sIdx] = {
        sa: currentSa,
        sm: maxSa,
        wr: total2h >= 5 ? (wins2h / total2h) * 100 : 0
      };
    }

    const isStratAllowedNow = (sIdx: number, useFilter: boolean) => {
      // Se a estratégia está desativada (manualmente ou permanente), ela NUNCA passa.
      if (localDisabledStrats.has(sIdx)) return false;
      
      // Se o filtro IA está desligado, tudo que não foi desativado manualmente passa.
      if (!useFilter) return true;
      
      // Estratégias imunes ao filtro IA de WinRate (Sempre passam se o filtro IA estiver ligado, desde que não desativadas manualmente)
      if ([1, 2, 12].includes(sIdx)) return true;
      
      const g = currentGhostStats[sIdx];
      if (g.wr >= 40) return true;
      if (g.sm >= 4 && g.sa >= Math.floor(g.sm * 0.8)) return true;
      return false;
    };

    // ════════════════════════════════════════════════════════════════
    // FASE 3: Calcular scores atuais (para o grid da tela)
    // ================================================================
    
    const finalScoresResult = Array(60).fill(0);
    const finalStratsResult = Array(60).fill(null).map(() => [] as number[]);

    const latestHourKey = Math.floor(latestTime / 3600000);
    const latestMinuteAbsolute = Math.floor(latestTime / 60000);
    const latestM = latestMinuteAbsolute % 60;

    for (const useFilter of [false, true]) {
        const rawScores = Array(60).fill(0);
        const rawStrats = Array(60).fill(null).map(() => new Set<number>());

        for (let m = 0; m < 60; m++) {
          const row = Math.floor(m / 10);
          const col = m % 10;

          if (isStratAllowedNow(0, useFilter)) {
            const rPct = s3h.getRowPct(row, latestHourKey);
            const cPct = s3h.getColPct(col, latestHourKey);
            if (rPct >= 66 && cPct >= 66) { rawScores[m]++; rawStrats[m].add(0); }
          }

          if (isStratAllowedNow(1, useFilter) && s6h.getMinutePct(m, latestHourKey) >= 50) { rawScores[m]++; rawStrats[m].add(1); }
          if (isStratAllowedNow(2, useFilter) && s12h.getMinutePct(m, latestHourKey) >= 35) { rawScores[m]++; rawStrats[m].add(2); }
          if (isStratAllowedNow(3, useFilter) && s22h.getMinutePct(m, latestHourKey) >= 22) { rawScores[m]++; rawStrats[m].add(3); }
          
          if (isStratAllowedNow(9, useFilter)) {
            let hasData = false;
            let hasWhite = false;
            for (const [hk, hadW] of s12h.minuteHours[m]) {
              if (hk > latestHourKey - 12 && hk <= latestHourKey) {
                hasData = true;
                if (hadW) hasWhite = true;
              }
            }
            if (hasData && !hasWhite) { rawScores[m]++; rawStrats[m].add(9); }
          }
        }

        const latchedAllowed = useFilter ? latchedAllowedFiltered : latchedAllowedUnfiltered;
        const latchedGrid = useFilter ? latchedGridFiltered : latchedGridUnfiltered;

        for (const pt of pendingTargets) {
            let isAllowed = isStratAllowedNow(pt.stratIdx, useFilter);
            
            if (localDisabledStrats.has(pt.stratIdx)) {
                isAllowed = false;
            } else {
                if (isAllowed) {
                    latchedAllowed.current.add(pt.groupId);
                } else if (latchedAllowed.current.has(pt.groupId)) {
                    isAllowed = true;
                }
            }
            
            if (isAllowed) {
              const targetMin = new Date(pt.targetTime).getMinutes();
              if (targetMin >= 0 && targetMin <= 59) { 
                  rawScores[targetMin]++; 
                  rawStrats[targetMin].add(pt.stratIdx);
              }
            }
        }

        // Processar e "travar" os scores finais usando latchedGrid
        for (let m = 0; m < 60; m++) {
            let diff = m - latestM;
            if (diff < -30) diff += 60;
            if (diff > 30) diff -= 60;
            
            const absMin = latestMinuteAbsolute + diff;
            
            if (diff < -10 || diff > 10) {
                if (useFilter === smartFilter) {
                    finalScoresResult[m] = 0;
                    finalStratsResult[m] = [];
                }
                continue;
            }

            let finalScore = rawScores[m];
            let finalStrats = new Set(rawStrats[m]);

            // Restaura a Trava de 3 Minutos: se diff <= 3, a nota não pode cair.
            // O Backtester agora simula essa mesma trava no passado!
            if (diff <= 3) {
                const latched = latchedGrid.current.get(absMin);
                if (latched) {
                    // Remove estratégias que o usuário desativou manualmente do latch
                    const validLatchedStrats = Array.from(latched.strats).filter(s => !localDisabledStrats.has(s));
                    
                    // O score real é o número de estratégias únicas. 
                    // Isso corrige o bug de 2 alvos da mesma estratégia somarem 2 no UI mas 1 no Backtester
                    const latchedScore = validLatchedStrats.length;
                    
                    if (latchedScore > finalStrats.size) {
                        finalScore = latchedScore;
                    } else {
                        finalScore = finalStrats.size;
                    }
                    
                    for (const s of validLatchedStrats) {
                        finalStrats.add(s);
                    }
                }
            }
            
            // Garantir que o finalScore nunca ultrapasse o número de estratégias únicas ativas
            finalScore = finalStrats.size;

            latchedGrid.current.set(absMin, { score: finalScore, strats: finalStrats });
            
            if (useFilter === smartFilter) {
                finalScoresResult[m] = finalScore;
                finalStratsResult[m] = Array.from(finalStrats);
            }
        }
        
        // Limpar velhos
        for (const key of latchedGrid.current.keys()) {
            if (key < latestMinuteAbsolute - 20) {
                latchedGrid.current.delete(key);
            }
        }
    }

    // Passar os valores finais para as variaveis antigas
    for (let m = 0; m < 60; m++) {
        scores[m] = finalScoresResult[m];
        activeStratsByMin[m] = finalStratsResult[m];
    }

    // FASE 4: Backtest — Ciclo de Proteção ±1 MINUTO (6 entradas)
    // ════════════════════════════════════════════════════════════════
    // Regra: Sinal no minuto M → verificar brancos nos minutos {M-1, M, M+1}
    // Com 2 rolls por minuto = 6 entradas na janela
    // Se nenhum branco nesses 6 rolls → Loss
    // Baseline estatístico: 1-(14/15)^6 ≈ 34.5%


    // ── Backtest por Estratégia Individual ────────────────────────
    // Aplicar Filtro Inteligente nos sinais históricos para a Confluência e Estatísticas
    const filteredSignalsAtRoll = Array(globalData.length).fill(null).map(() => new Set<number>());
    for (let i = 0; i < globalData.length; i++) {
      for (const sIdx of signalsAtRoll[i]) {
        if (signalAllowed.has(`${i}_${sIdx}`)) {
          filteredSignalsAtRoll[i].add(sIdx);
        }
      }
    }

    const stratStats: StratStat[] = STRAT_NAMES.map(name => ({
      name, winRate: 0, winRateMicro: 0, winRateCiclo: 0, wins: 0, total: 0, winsMicro: 0, totalMicro: 0, winsCiclo: 0, totalCiclo: 0, sa: 0, sm: 0,
      currentCycleState: { type: null, count: 0 }, currentCycleWinrate: 0, currentCycleOccurrences: 0, currentCycleWins: 0,
      groupedCycles: [], recentCycles: []
    }));

    const microHours = microFilter?.hours || 3;
    const macroHours = macroFilter?.hours || 24;
    const microCutoff = latestTime - microHours * 3600000;
    const cicloCutoff = latestTime - macroHours * 3600000;
    for (let sIdx = 0; sIdx < STRAT_NAMES.length; sIdx++) {
      let currentSa = 0;
      let maxSa = 0;
      let wins = 0;
      let total = 0;
      let winsMicro = 0;
      let totalMicro = 0;
      let winsCiclo = 0;
      let totalCiclo = 0;
      let lastEvalEnd = -1; // Evitar avaliar o mesmo ciclo duas vezes

      const groupedCycles: CycleStreak[] = [];
      let activeGroup: CycleStreak | null = null;

      const stateOccurrences: Record<string, number> = {};
      const stateWins: Record<string, number> = {};
      let prevStateKey: string | null = null;

      const recentCycles: { won: boolean; t: number }[] = [];

      for (let i = 0; i < globalData.length; i++) {
        if (times[i] < backtestCutoff) continue;
        if (i <= lastEvalEnd) continue;

        if (!filteredSignalsAtRoll[i].has(sIdx)) continue;

        const creator = creatorAtRoll[i].get(sIdx) || 0;
        // Verificar vitória na janela ±2min
        const won = checkCycleWin(i, creator);

        total++;
        if (times[i] >= microCutoff) totalMicro++;
        if (times[i] >= cicloCutoff) totalCiclo++;
        if (prevStateKey) {
          stateOccurrences[prevStateKey] = (stateOccurrences[prevStateKey] || 0) + 1;
          if (won) stateWins[prevStateKey] = (stateWins[prevStateKey] || 0) + 1;
        }

        if (won) {
          wins++;
          if (times[i] >= microCutoff) winsMicro++;
          if (times[i] >= cicloCutoff) winsCiclo++;
          currentSa = 0;
          if (activeGroup && activeGroup.type === 'W') {
            activeGroup.count++;
          } else {
            if (activeGroup) groupedCycles.push({ ...activeGroup });
            activeGroup = { type: 'W', count: 1 };
          }
        } else {
          currentSa++;
          if (currentSa > maxSa) maxSa = currentSa;
          if (activeGroup && activeGroup.type === 'L') {
            activeGroup.count++;
          } else {
            if (activeGroup) groupedCycles.push({ ...activeGroup });
            activeGroup = { type: 'L', count: 1 };
          }
        }

        if (activeGroup) {
          prevStateKey = `${activeGroup.type}_${activeGroup.count}`;
        }

        // Pular pedras seguintes que estão dentro da mesma janela
        // (para não contar o mesmo ciclo múltiplas vezes)
        const windowRange = withMargin ? 1.5 : 0.5;
        const windowEnd = times[i] + windowRange * ONE_MIN;
        lastEvalEnd = i;
        for (let j = i + 1; j < globalData.length && times[j] <= windowEnd; j++) {
          if (filteredSignalsAtRoll[j].has(sIdx)) lastEvalEnd = j;
          else break;
        }
      }

      if (activeGroup) {
        groupedCycles.push({ ...activeGroup });
      }

      const currentState = activeGroup || { type: null, count: 0 };
      const curKey = currentState.type ? `${currentState.type}_${currentState.count}` : '';
      const curOcc = curKey ? (stateOccurrences[curKey] || 0) : 0;
      const curW = curKey ? (stateWins[curKey] || 0) : 0;
      const curWr = curOcc > 0 ? (curW / curOcc) * 100 : (total > 0 ? (wins / total) * 100 : 0);

      stratStats[sIdx].wins = wins;
      stratStats[sIdx].total = total;
      stratStats[sIdx].winRate = total > 0 ? (wins / total) * 100 : 0;
      stratStats[sIdx].winsMicro = winsMicro;
      stratStats[sIdx].totalMicro = totalMicro;
      stratStats[sIdx].winRateMicro = totalMicro > 0 ? (winsMicro / totalMicro) * 100 : (total > 0 ? (wins / total) * 100 : 0);
      stratStats[sIdx].winsCiclo = winsCiclo;
      stratStats[sIdx].totalCiclo = totalCiclo;
      stratStats[sIdx].winRateCiclo = totalCiclo > 0 ? (winsCiclo / totalCiclo) * 100 : (total > 0 ? (wins / total) * 100 : 0);
      stratStats[sIdx].sa = currentSa;
      stratStats[sIdx].sm = maxSa;
      stratStats[sIdx].currentCycleState = currentState;
      stratStats[sIdx].currentCycleWinrate = curWr;
      stratStats[sIdx].currentCycleOccurrences = curOcc;
      stratStats[sIdx].currentCycleWins = curW;
      stratStats[sIdx].groupedCycles = groupedCycles;
      stratStats[sIdx].recentCycles = recentCycles.slice(-15);
    }

    // (A filtragem por Winrate Micro/Macro já é feita dinamicamente pedra por pedra na FASE 2.5)

    // ── Backtest por Confluência (Score >= N) ─────────────────────
    const stats: IaSignalStats[] = [];

    for (let confLvl = 1; confLvl <= 8; confLvl++) {
      let currentSa = 0;
      let maxSa = 0;
      let wins = 0;
      let total = 0;
      let lastEvalEnd = -1;

      for (let i = 0; i < globalData.length; i++) {
        if (times[i] < backtestCutoff) continue;
        if (i <= lastEvalEnd) continue;


        const validStrats = Array.from(filteredSignalsAtRoll[i]).filter(sIdx => !localDisabledStrats.has(sIdx));
        const score = validStrats.length;
        if (score < confLvl) continue;

        // Para confluência, o creatorTime é o MAIOR creatorTime entre todas as estratégias
        let maxCreator = 0;
        for (const ct of creatorAtRoll[i].values()) {
          if (ct > maxCreator) maxCreator = ct;
        }

        const won = checkCycleWin(i, maxCreator);

        total++;
        if (won) {
          wins++;
          currentSa = 0;
        } else {
          currentSa++;
          if (currentSa > maxSa) maxSa = currentSa;
        }

        const windowRange = withMargin ? 1.5 : 0.5;
        const windowEnd = times[i] + windowRange * ONE_MIN;
        lastEvalEnd = i;
        for (let j = i + 1; j < globalData.length && times[j] <= windowEnd; j++) {
          if (filteredSignalsAtRoll[j].size >= confLvl) lastEvalEnd = j;
          else break;
        }
      }

      stats.push({
        conf: confLvl,
        total,
        wins,
        winRate: total > 0 ? (wins / total) * 100 : 0,
        sa: currentSa,
        sm: maxSa,
      });
    }

    // ── Preparar Histórico 12h para o Tooltip ─────────────────────────
    const history12h = Array(60).fill(null).map(() => [] as { hourString: string, hit: boolean }[]);
    
    for (let m = 0; m < 60; m++) {
      const prevM = (m - 1 + 60) % 60;
      const nextM = (m + 1) % 60;
      for (let hOff = 0; hOff < 12; hOff++) {
         const targetHk = latestHourKey - hOff;
         const hitExact = s12h.minuteHours[m]?.get(targetHk) || false;
         const hitPrev = s12h.minuteHours[prevM]?.get(prevM === 59 ? targetHk - 1 : targetHk) || false;
         const hitNext = s12h.minuteHours[nextM]?.get(nextM === 0 ? targetHk + 1 : targetHk) || false;
         const date = new Date(targetHk * 3600000);
         const hourStr = date.getHours().toString().padStart(2, '0') + 'h';
         history12h[m].push({ hourString: hourStr, hit: hitExact || hitPrev || hitNext });
      }
    }

    return { scores, activeStrats: STRAT_NAMES, stats, stratStats, disabledStrats, history12h, activeStratsByMin };
  }, [globalData, periodHours, disabledStrats, withMargin, smartFilter]);
}
