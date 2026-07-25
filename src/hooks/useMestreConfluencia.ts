import { useMemo, useState, useEffect, useRef } from 'react';
import { calculateRadar } from './engine/engines/radarEngine';
import { calculateIA } from './engine/engines/iaEngine';

export interface RollData {
    id?: string;
    timestamp: string;
    color: string;
    roll: number;
}

export interface MestreState {
    status: 'standby' | 'active' | 'win' | 'loss';
    step: number;
    level: number;
    stones: number[];
}

export function useMestreConfluencia(globalData: RollData[]) {
    const [mestreState, setMestreState] = useState<MestreState>({
        status: 'standby',
        step: 0,
        level: 0,
        stones: [],
    });
    const [placarDiario, setPlacarDiario] = useState({ wins: 0, losses: 0, sa: 0, sm: 0, lastResetDate: new Date().getDate() });
    
    // Processa a pontuação da pedra atual
    const { levelPoints, engineState } = useMemo(() => {
        if (!globalData || globalData.length < 50) {
            return { levelPoints: 0, engineState: null };
        }
        
        // Em vez de recalcular tudo a cada render, o useMemo memoiza baseado na array de pedras.
        // Simulando o getPoints do motor.ts:
        const DEFAULT_DISABLED_IA = new Set([0, 2, 4, 5, 10, 12]);
        const radarConfig = {
            enableZonas: true, zonaGeralHours: 3, zonaGeralMinWr: 35, zonaCicloHours: 72, zonaCicloMinWr: 35,
            enableCasas: true, casaGeralHours: 3, casaGeralMinWr: 45, casaCicloHours: 72, casaCicloMinWr: 45,
            enablePadroes: true, padraoGeralHours: 6, padraoGeralMinWr: 50
        };
        const radarData = calculateRadar(globalData.slice(-1500) as any, radarConfig);
        const iaConfig = { geralHours: 3, geralMinWr: 40, cicloHours: 72, cicloMinWr: 40, minSignals: 0 };
        const iaData3h = calculateIA(globalData.slice(-1500) as any, 3, DEFAULT_DISABLED_IA, true, iaConfig);
        const iaData1h = calculateIA(globalData.slice(-1500) as any, 1, DEFAULT_DISABLED_IA, true, iaConfig);

        const currentConfluences = iaData3h.currentIaScore;
        let iaPoints = 0;
        
        if (currentConfluences >= 1) {
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
        
        const totalPoints = radarData.radarPoints + iaPoints;
        const isSinalMaster = (currentConfluences >= 3 && iaPoints >= 1);
        const finalApproved = isSinalMaster || totalPoints >= 3;

        return {
            levelPoints: finalApproved ? totalPoints : 0,
            engineState: { radarData, iaData: iaData3h }
        };
    }, [globalData]);

    const lastRollRef = useRef<string | null>(null);

    // Máquina de estados baseada na mudança da última pedra do globalData
    useEffect(() => {
        if (!globalData || globalData.length < 50) return;
        const newRoll = globalData[globalData.length - 1];
        
        if (lastRollRef.current === (newRoll.id || newRoll.timestamp)) return;
        lastRollRef.current = newRoll.id || newRoll.timestamp;

        const isBranco = newRoll.color.toUpperCase() === 'BRANCO' || newRoll.color.toUpperCase() === 'B' || newRoll.color.toUpperCase() === 'WHITE' || Number(newRoll.roll) === 0;

        // Reset Diário de Placar (Desativado a pedido do usuário)
        // const today = new Date().getDate();
        // if (placarDiario.lastResetDate !== today) {
        //     setPlacarDiario({ wins: 0, losses: 0, sa: 0, sm: 0, lastResetDate: today });
        // }

        let nextState = { ...mestreState };

        if (mestreState.status === 'active') {
            // A pedra atual conta para as rodadas ativas
            nextState.stones = [...mestreState.stones, newRoll.roll];
            
            if (isBranco) {
                nextState.status = 'win';
                setPlacarDiario({ ...placarDiario, wins: placarDiario.wins + 1, sa: 0 });
                
                // Após 7s o componente deve voltar pro standby, simularemos com setTimeout fora do state reducer
            } else {
                if (mestreState.step < 6) {
                    nextState.step = mestreState.step + 1;
                    if (levelPoints > mestreState.level) {
                        nextState.level = levelPoints;
                        nextState.step = 1; // Upgrade reinicia a contagem
                        nextState.stones = []; // Reinicia as pedras do ciclo
                    }
                } else {
                    nextState.status = 'loss';
                    setPlacarDiario({ ...placarDiario, losses: placarDiario.losses + 1, sa: placarDiario.sa + 1, sm: Math.max(placarDiario.sm, placarDiario.sa + 1) });
                }
            }
        } else {
            // Se estava WIN ou LOSS, o timeout externo vai resetar para standby.
            // Mas se engatilha um novo sinal, já podemos sobrescrever para active.
            if (levelPoints >= 3 && mestreState.status === 'standby') {
                nextState = {
                    status: 'active',
                    step: 1,
                    level: levelPoints,
                    stones: [],
                };
            }
        }
        setMestreState(nextState);
    }, [globalData, mestreState, levelPoints, placarDiario]);

    // Lida com o reset automático de WIN/LOSS para STANDBY após 7s (igual no backend)
    useEffect(() => {
        if (mestreState.status === 'win' || mestreState.status === 'loss') {
            const timer = setTimeout(() => {
                setMestreState({ status: 'standby', step: 0, level: 0, stones: [] });
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [mestreState.status]);

    return {
        mestreState,
        placarDiario,
        levelPoints,
        engineState
    };
}
