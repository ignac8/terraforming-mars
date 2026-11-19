import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBaseBonusCards} from '@/server/automa/MarsBotBonusCard';
import {MarsBotBonusResolver} from '@/server/automa/MarsBotBonusResolver';
import {setTemperature} from '../../TestingUtils';
import {createAutomaGame} from '../corps/CorpGame';

describe('LobbyistsMarsBot', () => {
  // Detailed options (rulebook pages 6-7)
  it('option (a): temp 1-2 from completion → raise 2 + destroy', () => {
    const {game, marsBot} = createAutomaGame();
    // Temperature at +4 (2 steps from max +8)
    setTemperature(game, 4);

    const cards = createBaseBonusCards();
    const b06 = cards.find((c) => c.id === BonusCardId.B06_LOBBYISTS)!;
    const bonusResolver = new MarsBotBonusResolver(marsBot);

    const destroyed = bonusResolver.resolve(b06);
    expect(game.getTemperature()).to.eq(8); // Raised 2 steps (4°C)
    expect(destroyed).to.be.true;
  });

  it('option (d): advance furthest parameter, measured in steps remaining', () => {
    const {game, marsBot} = createAutomaGame();
    // From the start temperature has 19 steps left, oxygen 14 and oceans 9

    const cards = createBaseBonusCards();
    const b06 = cards.find((c) => c.id === BonusCardId.B06_LOBBYISTS)!;
    const bonusResolver = new MarsBotBonusResolver(marsBot);

    const tempBefore = game.getTemperature();
    const destroyed = bonusResolver.resolve(b06);
    // None of a/b/c apply, so option d fires
    expect(game.getTemperature()).to.eq(tempBefore + 2);
    expect(destroyed).to.be.false; // Option d does NOT destroy
  });

  // Ocean placement tiebreakers (rulebook page 7)
  it('breaks the tie between ocean spaces by placement bonus icons', () => {
    const {game, human, marsBot} = createAutomaGame();
    setTemperature(game, -30);
    // Spaces 07 (no bonus) and 43 (one plant) each touch two oceans; 07 comes first on the board.
    for (const id of ['13', '06', '34', '44']) {
      game.simpleAddTile(human, game.board.getSpaceOrThrow(id as SpaceId), {tileType: TileType.OCEAN});
    }
    const b06 = createBaseBonusCards().find((c) => c.id === BonusCardId.B06_LOBBYISTS)!;

    marsBot['bonusResolver'].resolve(b06);

    expect(game.board.getSpaceOrThrow('43' as SpaceId).tile?.tileType).to.eq(TileType.OCEAN);
    expect(game.board.getSpaceOrThrow('07' as SpaceId).tile).is.undefined;
  });
});
