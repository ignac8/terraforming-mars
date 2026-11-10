import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {setTemperature} from '../../TestingUtils';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';

describe('DoItRightMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('raises the temperature 2 steps when it is 1 or 2 steps from a bonus', () => {
    const {game, marsBot} = createAutomaGame();
    setTemperature(game, -26);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B25_DO_IT_RIGHT));
    expect(game.getTemperature()).to.eq(-22);
  });

  it('does nothing when no branch applies', () => {
    const {game, marsBot} = createAutomaGame();
    const tr = marsBot.player.terraformRating;
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B25_DO_IT_RIGHT));
    expect(game.getTemperature()).to.eq(-30);
    expect(game.getOxygenLevel()).to.eq(0);
    expect(marsBot.player.terraformRating).to.eq(tr);
    expect(marsBot.marsBotBoard.tracks[3].position).to.eq(0);
  });
});
