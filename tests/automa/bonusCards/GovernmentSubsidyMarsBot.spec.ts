import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';

describe('GovernmentSubsidyMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('raises TR 1 step', () => {
    const {marsBot} = createAutomaGame();
    const tr = marsBot.player.terraformRating;
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B31_GOVERNMENT_SUBSIDY));
    expect(marsBot.player.terraformRating).to.eq(tr + 1);
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });
});
