import {expect} from 'chai';
import {BonusCardName} from '@/common/automa/BonusCardName';
import {createBonusCard} from '@/server/automa/bonusCards/MarsBotBonusCards';

describe('MarsBotBonusCards', () => {
  it('makes a new card each time', () => {
    expect(createBonusCard(BonusCardName.METEOR_SHOWER)).not.eq(createBonusCard(BonusCardName.METEOR_SHOWER));
  });
});
