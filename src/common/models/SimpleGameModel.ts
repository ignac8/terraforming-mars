
import {Color} from '../Color';
import {PlayerId, GameId, SpectatorId} from '../Types';
import {Phase} from '../Phase';
import {GameOptionsModel} from './GameOptionsModel';

export type SimpleGameModel = {
    activePlayer: Color;
    id: GameId;
    name: string;
    phase: Phase;
    players: Array<SimplePlayerModel>;
    spectatorId: SpectatorId;
    gameOptions: GameOptionsModel;
    lastSoloGeneration: number;
    expectedPurgeTimeMs: number;
}

type SimplePlayerModel = {
    color: Color;
    /** Left out by api/game once a solo game ends. */
    id?: PlayerId;
    name: string;
}
