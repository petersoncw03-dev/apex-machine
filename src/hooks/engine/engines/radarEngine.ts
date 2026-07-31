export interface RollData {
    id: string;
    timestamp: string;
    color: string;
    roll: number;
}

export interface RadarConfig {
    blockSize?: 6 | 10;
    enableZonas?: boolean;
    zonaGeralHours?: number;
    zonaGeralMinWr?: number;
    zonaGeralMaxWr?: number;
    zonaCicloHours?: number;
    zonaCicloMinWr?: number;
    zonaCicloMaxWr?: number;

    enableCasas?: boolean;
    casaGeralHours?: number;
    casaGeralMinWr?: number;
    casaCicloHours?: number;
    casaCicloMinWr?: number;

    enablePadroes?: boolean;
    padraoGeralHours?: number;
    padraoGeralMinWr?: number;
}

export function calculateRadar(history: RollData[], config?: RadarConfig) {
    const zonesStats = calculateZones(history, config?.zonaGeralHours, config?.zonaCicloHours, config?.blockSize);
    const radarStats = calculatePatternsAndCasas(history, config?.casaGeralHours, config?.casaCicloHours, config?.padraoGeralHours);

    const zonaGWR = config?.zonaGeralMinWr ?? 35;
    const zonaGWRMax = config?.zonaGeralMaxWr ?? 100;
    const zonaCWR = config?.zonaCicloMinWr ?? 35;
    const zonaCWRMax = config?.zonaCicloMaxWr ?? 100;
    let hasZonasQuentes = false;
    
    for (let i = 0; i < zonesStats.blocksMicro.length; i++) {
        const bMicro = zonesStats.blocksMicro[i];
        const bMacro = zonesStats.blocksMacro[i];
        if (bMicro.status === 'ativo' 
            && bMicro.winrate >= zonaGWR && bMicro.winrate <= zonaGWRMax
            && bMacro.winrate >= zonaCWR && bMacro.winrate <= zonaCWRMax) {
            hasZonasQuentes = true;
            break;
        }
    }
    
    const casaGWR = config?.casaGeralMinWr ?? 45;
    const casaCWR = config?.casaCicloMinWr ?? 45;
    let hasCasas = false;
    
    for (const cMicro of radarStats.casasMicro) {
        if (cMicro.isLive && cMicro.winrate >= casaGWR) {
            const cMacro = radarStats.casasMacro.find((m: any) => m.num === cMicro.num && m.casa === cMicro.casa);
            if (cMacro && cMacro.winrate >= casaCWR) {
                hasCasas = true;
                break;
            }
        }
    }

    const padraoWR = config?.padraoGeralMinWr ?? 50;
    let padroesAllAcima50 = true;
    let sumAvgs = 0;
    let count = 0;
    
    for (const size of [4, 5, 6]) {
        const pat = radarStats.livePatterns[size];
        if (!pat) {
            padroesAllAcima50 = false;
            break;
        }
        if (pat.winrate <= padraoWR) {
            padroesAllAcima50 = false;
        }
        let wrL = pat.wrL !== null ? pat.wrL : pat.winrate;
        let avg = (pat.winrate + wrL) / 2;
        sumAvgs += avg;
        count++;
    }

    let hasPatterns1Pt = false;
    let hasPatterns2Pts = false;
    
    if (count === 3 && padroesAllAcima50) {
        hasPatterns1Pt = true;
        let totalAvg = sumAvgs / 3;
        if (totalAvg > 80) {
            hasPatterns2Pts = true;
            hasPatterns1Pt = false;
        }
    }

    let radarPoints = 0;
    if (config?.enableZonas !== false && hasZonasQuentes) radarPoints += 1;
    if (config?.enableCasas !== false && hasCasas) radarPoints += 1;
    if (config?.enablePadroes !== false) {
        if (hasPatterns2Pts) radarPoints += 2;
        else if (hasPatterns1Pt) radarPoints += 1;
    }

    return {
        radarPoints,
        hasZonasQuentes,
        hasCasas,
        hasPatterns1Pt,
        hasPatterns2Pts,
        radarStats,
        zonesStats
    };
}

function calcZoneBlocks(rolls: RollData[], blockSize: number = 6) {
    const whiteIndices = rolls.reduce((acc, r, i) => {
        if (r.color?.toLowerCase().includes('branco') || r.roll === 0) acc.push(i);
        return acc;
    }, [] as number[]);

    if (whiteIndices.length === 0) return { blocks: [], currentGap: rolls.length };

    const gaps: number[] = [];
    for (let i = 1; i < whiteIndices.length; i++) {
        gaps.push(whiteIndices[i] - whiteIndices[i - 1]);
    }

    const currentGap = rolls.length - 1 - whiteIndices[whiteIndices.length - 1];
    const nextEnt = currentGap + 1;

    const zones = blockSize === 10 ? [
        { label: '1 a 10', s: 1, e: 10 },
        { label: '11 a 20', s: 11, e: 20 },
        { label: '21 a 30', s: 21, e: 30 }
    ] : [
        { label: '1 a 6', s: 1, e: 6 },
        { label: '7 a 12', s: 7, e: 12 },
        { label: '13 a 18', s: 13, e: 18 },
        { label: '19 a 24', s: 19, e: 24 },
        { label: '25 a 30', s: 25, e: 30 },
        { label: '31 a 36', s: 31, e: 36 }
    ];

    const blocks = zones.map(z => {
        let wins = 0;
        let losses = 0;
        const outcomes: ('W' | 'L')[] = [];

        for (const g of gaps) {
            if (g >= z.s && g <= z.e) { wins++; outcomes.push('W'); }
            else if (g > z.e) { losses++; outcomes.push('L'); }
        }
        if (currentGap >= z.e) { losses++; outcomes.push('L'); }

        const cycles: { type: 'W' | 'L', count: number }[] = [];
        for (const out of outcomes) {
            if (cycles.length === 0) {
                cycles.push({ type: out, count: 1 });
            } else {
                const last = cycles[cycles.length - 1];
                if (last.type === out) last.count++;
                else cycles.push({ type: out, count: 1 });
            }
        }

        const total = wins + losses;
        const winrate = total > 0 ? (wins / total) * 100 : 0;
        let status = 'aguardando';
        if (nextEnt >= z.s && nextEnt <= z.e) status = 'ativo';
        else if (nextEnt > z.e) status = 'passou';

        return { ...z, wins, losses, total, winrate, status, cycles: cycles.slice(-7) };
    });

    return { blocks, currentGap };
}

function calculateZones(history: RollData[], microHours?: number, macroHours?: number, blockSize: number = 6) {
    const limitMicro = (microHours && microHours > 0) ? microHours * 120 : 3 * 120;
    const limitMacro = (macroHours && macroHours > 0) ? macroHours * 120 : 72 * 120;

    const rollsMicro = history.slice(-limitMicro);
    const rollsMacro = history.slice(-limitMacro);

    const rMicro = calcZoneBlocks(rollsMicro, blockSize);
    const rMacro = calcZoneBlocks(rollsMacro, blockSize);

    return { blocksMicro: rMicro.blocks, blocksMacro: rMacro.blocks, currentGap: rMicro.currentGap };
}

function calculatePatternsAndCasas(history: RollData[], casaMicroHours?: number, casaMacroHours?: number, padraoGeralHours?: number) {
    const getC = (r: RollData) => {
        const n = r.roll;
        const col = r.color?.toLowerCase() || '';
        if (col.includes('branco') || n === 0) return 'B';
        if (col.includes('vermelho') || (n >= 1 && n <= 7)) return 'V';
        return 'P';
    };

    const hFull = history;
    if (hFull.length === 0) return { livePatterns: {} as any, casasMicro: [], casasMacro: [] };

    const lastRoll = hFull[hFull.length - 1];
    const lastRollNumber = lastRoll.roll;

    const livePatterns: Record<number, any> = {};
    const targetMargin = 6;

    const sizesConfig = padraoGeralHours && padraoGeralHours > 0 
        ? [
            { size: 4, limit: padraoGeralHours * 120 },
            { size: 5, limit: padraoGeralHours * 120 },
            { size: 6, limit: padraoGeralHours * 120 }
          ]
        : [
            { size: 4, limit: 720 },
            { size: 5, limit: 720 },
            { size: 6, limit: 1200 }
        ];

    for (const conf of sizesConfig) {
        const size = conf.size;
        const sliceAmount = conf.limit;
        const hSlice = history.slice(-sliceAmount);
        if (hSlice.length < size) continue;
        const rolls = hSlice.map(r => ({ color: getC(r), num: r.roll }));
        const patMap = new Map<string, any>();
        const liveSlice = rolls.slice(-size);
        const livePatStr = liveSlice.map(r => r.color).join('');

        for (let i = 0; i <= rolls.length - size - targetMargin; i++) {
            const patStr = rolls.slice(i, i + size).map(r => r.color).join('');
            const patLastNum = rolls[i + size - 1].num;
            if (!patMap.has(patStr)) patMap.set(patStr, { win: 0, loss: 0, winL: 0, lossL: 0 });
            const data = patMap.get(patStr)!;

            let hitB = false;
            for (let m = 0; m < targetMargin; m++) if (rolls[i + size + m].color === 'B') hitB = true;

            if (hitB) data.win++; else data.loss++;
            if (patLastNum === lastRollNumber) { if (hitB) data.winL++; else data.lossL++; }
        }

        for (const [patStr, data] of patMap.entries()) {
            if (patStr === livePatStr) {
                const total = data.win + data.loss;
                const winrate = total > 0 ? (data.win / total) * 100 : 0;
                const wrL = (data.winL + data.lossL > 0) ? (data.winL / (data.winL + data.lossL)) * 100 : null;
                livePatterns[size] = { target: 'B', winrate, wrL, total };
            }
        }
    }

    function calcCasasExatas(limitHours: number) {
        const limit = limitHours > 0 ? limitHours * 120 : 720;
        const hCasas = history.slice(-limit);
        const numEntradas = 6;
        const ce_stats = Array.from({ length: 15 }, () => ({
            totals: Array(10).fill(0), winB: Array(10).fill(0), saB: Array(10).fill(0), smB: Array(10).fill(0)
        }));

        for (let i = 0; i < hCasas.length; i++) {
            const pastRollNum = hCasas[i].roll;
            if (isNaN(pastRollNum)) continue;
            for (let c = 1; c <= 10; c++) {
                const targetStartIdx = i + c;
                if (targetStartIdx < hCasas.length) {
                    let hasB = false;
                    let maxE = Math.min(numEntradas, hCasas.length - targetStartIdx);
                    if (maxE < 1) continue;
                    for (let e = 0; e < maxE; e++) {
                        const trC = getC(hCasas[targetStartIdx + e]);
                        if (trC === 'B') hasB = true;
                    }
                    const windowClosed = maxE === numEntradas;
                    if (hasB || windowClosed) {
                        ce_stats[pastRollNum].totals[c-1]++;
                        if (hasB) {
                            ce_stats[pastRollNum].saB[c-1] = 0;
                            ce_stats[pastRollNum].winB[c-1]++;
                        } else {
                            ce_stats[pastRollNum].saB[c-1]++;
                            if (ce_stats[pastRollNum].saB[c-1] > ce_stats[pastRollNum].smB[c-1]) {
                                ce_stats[pastRollNum].smB[c-1] = ce_stats[pastRollNum].saB[c-1];
                            }
                        }
                    }
                }
            }
        }

        const casasData: any[] = [];
        for (let num = 0; num < 15; num++) {
            for (let c = 1; c <= 10; c++) {
                let isLive = false;
                for (let e = 0; e < numEntradas; e++) {
                    const gatilhoIdx = hCasas.length - c - e;
                    if (gatilhoIdx >= 0 && gatilhoIdx < hCasas.length) {
                        if (hCasas[gatilhoIdx].roll === num) {
                            isLive = true;
                            break;
                        }
                    }
                }
                const total = ce_stats[num].totals[c-1];
                const win = ce_stats[num].winB[c-1];
                const winrate = total > 0 ? (win / total) * 100 : 0;
                casasData.push({ num, casa: c, winrate, total, isLive });
            }
        }
        return casasData;
    }

    const casasMicro = calcCasasExatas(casaMicroHours ?? 3);
    const casasMacro = calcCasasExatas(casaMacroHours ?? 72);

    return { livePatterns, casasMicro, casasMacro };
}
