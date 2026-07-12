export interface RollData {
    id?: string;
    timestamp: string;
    color: string;
    roll: number;
}

export function calculateCoresEngine(globalData: RollData[], lookbackHours: number = 3) {
    if (!globalData || globalData.length < 20) {
        return {
            matrixCols: [],
            livePatterns: { 
                avgRedPatWr: 0, 
                avgBlackPatWr: 0, 
                redPats: [0, 0, 0], 
                blackPats: [0, 0, 0] 
            },
            scheduledMinutes: []
        };
    }

    const now = new Date(globalData[globalData.length - 1].timestamp).getTime();
    const cutoff = now - (lookbackHours * 3600000);
    const recentData = globalData.filter(r => new Date(r.timestamp).getTime() >= cutoff);
    
    if (recentData.length < 20) recentData.push(...globalData.slice(-100)); // Fallback

    // 1. Matriz de Colunas (0 a 9)
    // Uma coluna X representa os minutos terminados em X (ex: coluna 3 = 03, 13, 23, 33, 43, 53)
    const colsStats = Array.from({ length: 10 }, () => ({ red: 0, black: 0, total: 0 }));
    
    for (let i = 0; i < recentData.length; i++) {
        const roll = recentData[i];
        if (roll.roll === 0) continue; // Ignora branco pra matriz de cores
        
        const min = new Date(roll.timestamp).getMinutes();
        const col = min % 10;
        
        colsStats[col].total++;
        if (roll.roll >= 1 && roll.roll <= 7) colsStats[col].red++;
        if (roll.roll >= 8 && roll.roll <= 14) colsStats[col].black++;
    }

    // 2. Padrões Ao Vivo (4, 5, 6 pedras)
    // Vamos buscar o padrão atual de tamanho 4, 5 e 6 e ver o que saiu na frente (G1 = 2 entradas)
    const getPatternWinrate = (size: number, target: 'R' | 'B') => {
        if (globalData.length < size) return 0;
        
        // O padrão atual que acabou de sair
        const currentPattern = globalData.slice(-size).map(r => r.roll === 0 ? 'B' : r.roll <= 7 ? 'R' : 'K').join('');
        
        let wins = 0;
        let total = 0;
        
        // Procura no passado
        for (let i = 0; i < recentData.length - size - 2; i++) {
            const pat = recentData.slice(i, i + size).map(r => r.roll === 0 ? 'B' : r.roll <= 7 ? 'R' : 'K').join('');
            if (pat === currentPattern) {
                total++;
                // Checa as próximas 2 pedras (G1)
                const next1 = recentData[i + size];
                const next2 = recentData[i + size + 1];
                
                let hit1 = false;
                let hit2 = false;
                
                if (target === 'R') {
                    if (next1.roll >= 1 && next1.roll <= 7) hit1 = true;
                    if (next2.roll >= 1 && next2.roll <= 7) hit2 = true;
                } else {
                    if (next1.roll >= 8 && next1.roll <= 14) hit1 = true;
                    if (next2.roll >= 8 && next2.roll <= 14) hit2 = true;
                }
                
                if (hit1 || hit2) wins++;
            }
        }
        
        return total >= 3 ? (wins / total) * 100 : 0;
    };

    const redWr4 = getPatternWinrate(4, 'R');
    const redWr5 = getPatternWinrate(5, 'R');
    const redWr6 = getPatternWinrate(6, 'R');
    const avgRedPatWr = (redWr4 + redWr5 + redWr6) / 3;

    const blackWr4 = getPatternWinrate(4, 'B');
    const blackWr5 = getPatternWinrate(5, 'B');
    const blackWr6 = getPatternWinrate(6, 'B');
    const avgBlackPatWr = (blackWr4 + blackWr5 + blackWr6) / 3;

    // 3. Minutos Quentes Específicos (0 a 59)
    const minStats = Array.from({ length: 60 }, () => ({ red: 0, black: 0, total: 0 }));
    for (let i = 0; i < recentData.length; i++) {
        const roll = recentData[i];
        if (roll.roll === 0) continue;
        const m = new Date(roll.timestamp).getMinutes();
        minStats[m].total++;
        if (roll.roll <= 7) minStats[m].red++;
        else minStats[m].black++;
    }

    const scheduledMinutes = [];
    for (let m = 0; m < 60; m++) {
        if (minStats[m].total >= 3) {
            const rWr = (minStats[m].red / minStats[m].total) * 100;
            const bWr = (minStats[m].black / minStats[m].total) * 100;
            if (rWr >= 80) scheduledMinutes.push({ minute: m, target: 'R', winrate: rWr });
            if (bWr >= 80) scheduledMinutes.push({ minute: m, target: 'B', winrate: bWr });
        }
    }

    return {
        matrixCols: colsStats, // 0 a 9
        livePatterns: { 
            avgRedPatWr, 
            avgBlackPatWr,
            redPats: [redWr4, redWr5, redWr6],
            blackPats: [blackWr4, blackWr5, blackWr6]
        },
        scheduledMinutes
    };
}
