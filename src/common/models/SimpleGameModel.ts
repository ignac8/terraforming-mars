
import {Color} from '../Color';
import {PlayerId, GameId, JudgeId, SpectatorId} from '../Types';
import {Phase} from '../Phase';
import {GameOptionsModel} from './GameOptionsModel';

export type SimpleGameModel = {
    activePlayer: Color;
    id: GameId;
    name: string;
    phase: Phase;
    players: Array<SimplePlayerModel>;
    spectatorId: SpectatorId;
    judgeId?: JudgeId;
    gameOptions: GameOptionsModel;
    lastSoloGeneration: number;
    expectedPurgeTimeMs: number;
}

type SimplePlayerModel = {
    color: Color;
    id: PlayerId;
    name: string;
}
