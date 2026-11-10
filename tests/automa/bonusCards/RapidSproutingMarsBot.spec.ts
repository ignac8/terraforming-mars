import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';

describe('RapidSproutingMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('first puts a plant on the corporation card, then spends it on a greenery', () => {
    const {game, marsBot} = createAutomaGame();
    const greeneries = () => game.board.getGreeneries(marsBot.player).length;

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B23_RAPID_SPROUTING));
    expect(greeneries()).to.eq(0);
    expect(marsBot.getCorpState('plantResources')).to.eq(1);

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B23_RAPID_SPROUTING));
    expect(greeneries()).to.eq(1);
    expect(game.getOxygenLevel()).to.eq(1);
    expect(marsBot.getCorpState('plantResources')).to.eq(0);
  });

  // The plant is spent anyway (our reading), and a bonus card that can't resolve is not a Failed Action
  // (rulebook A, p.5)
  it('spends the plant and takes no Failed Action when no greenery can be placed', () => {
    const {game, marsBot} = createAutomaGame();
    marsBot.setCorpState('plantResources', 1);
    marsBot['bonusResolver']['tilePlacer'].findGreenerySpace = () => undefined;

    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B23_RAPID_SPROUTING));

    expect(game.board.getGreeneries(marsBot.player)).is.empty;
    expect(marsBot.getCorpState('plantResources')).to.eq(0);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });
});
