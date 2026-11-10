import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BoardName} from '@/common/boards/BoardName';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {testGame} from '../../TestGame';
import {resetCorpRegistry} from '../corps/CorpGame';
import {maxTracks} from './BonusCardGame';

describe('VenusianLobbyMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('raises Venus, advances the Venus track and raises the furthest parameter', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B26_VENUSIAN_LOBBY));
    expect(game.getVenusScaleLevel()).to.eq(2);
    expect(marsBot.marsBotBoard.tracks[7].position).to.eq(1);
    // Everything is at its start, and temperature has the most steps left (19, against 14 and 9)
    expect(game.getTemperature()).to.eq(-28);
    expect(game.getOxygenLevel()).to.eq(0);
  });

  // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
  // 3623553, njshaw2). Project cards still do.
  it('takes no Failed Action when advancing a maxed track', () => {
    const [game] = testGame(1, {automa: true, venusNextExtension: true, boardName: BoardName.THARSIS});
    const marsBot = game.automaHooks!.marsBot;
    maxTracks(marsBot);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B26_VENUSIAN_LOBBY));
    expect(game.getVenusScaleLevel()).to.eq(2);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });
});
