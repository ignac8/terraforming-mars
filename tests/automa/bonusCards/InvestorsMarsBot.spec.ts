import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBot} from '@/server/automa/MarsBot';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {maxTracks} from './BonusCardGame';

function setTracks(marsBot: MarsBot, positions: Array<number>) {
  positions.forEach((position, i) => {
    marsBot.marsBotBoard.tracks[i].position = position;
  });
}

describe('InvestorsMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('in an even generation advances the least-advanced track and moves the most-advanced one back', () => {
    const {game, marsBot} = createAutomaGame();
    game.generation = 2;
    setTracks(marsBot, [5, 3, 1, 4, 4, 6, 2]);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B32_INVESTORS));

    expect(marsBot.marsBotBoard.tracks.map((t) => t.position)).deep.eq([5, 3, 2, 4, 4, 5, 2]);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });

  it('does not re-trigger the space it moved the most-advanced track back from', () => {
    const {game, marsBot} = createAutomaGame();
    game.generation = 2;
    setTracks(marsBot, [5, 3, 1, 4, 4, 6, 2]);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B32_INVESTORS));

    expect(marsBot.marsBotBoard.tracks[5].regressedPositions.has(6)).is.true;
  });

  it('breaks ties toward the upper track', () => {
    const {game, marsBot} = createAutomaGame();
    game.generation = 4;
    setTracks(marsBot, [4, 1, 1, 4, 2, 2, 3]);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B32_INVESTORS));

    expect(marsBot.marsBotBoard.tracks.map((t) => t.position)).deep.eq([3, 2, 1, 4, 2, 2, 3]);
  });

  it('in an odd generation gains 1 M€ per space of the least-advanced track and moves nothing', () => {
    const {game, marsBot} = createAutomaGame();
    game.generation = 3;
    setTracks(marsBot, [5, 3, 2, 4, 4, 6, 3]);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B32_INVESTORS));

    expect(marsBot.marsBotBoard.tracks.map((t) => t.position)).deep.eq([5, 3, 2, 4, 4, 6, 3]);
    expect(marsBot.turnResolver.megacredits).to.eq(2);
  });

  // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
  // 3623553, njshaw2). Project cards still do.
  it('takes no Failed Action when advancing a maxed track and still moves the most-advanced track back', () => {
    const {game, marsBot} = createAutomaGame();
    game.generation = 2;
    maxTracks(marsBot);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B32_INVESTORS));
    expect(marsBot.turnResolver.megacredits).to.eq(0);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(17);
  });
});
