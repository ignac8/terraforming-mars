import {expect} from 'chai';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {createBonusCard} from '@/server/automa/MarsBotBonusCard';
import {createAutomaGame, resetCorpRegistry} from '../corps/CorpGame';
import {maxTracks} from './BonusCardGame';

describe('SupplyAndDemandMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('takes up to 3 M€ from the corporation card', () => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpState('mcOnCard', 5);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND));
    expect(marsBot.turnResolver.megacredits).to.eq(3);
    expect(marsBot.getCorpState('mcOnCard')).to.eq(2);
    expect(marsBot.marsBotBoard.tracks[4].position).to.eq(0);
  });

  it('with no M€ on the card advances the energy track', () => {
    const {marsBot} = createAutomaGame();
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND));
    expect(marsBot.marsBotBoard.tracks[4].position).to.be.greaterThan(0);
    expect(marsBot.marsBotBoard.tracks[0].position).to.eq(0);
  });

  // A bonus card that can't resolve takes no Failed Action (rulebook A p.5 B.a; BGG 3599965 and
  // 3623553, njshaw2). Project cards still do.
  it('takes no Failed Action when advancing a maxed track', () => {
    const {marsBot} = createAutomaGame();
    maxTracks(marsBot);
    marsBot['bonusResolver'].resolve(createBonusCard(BonusCardId.B24_SUPPLY_AND_DEMAND));
    expect(marsBot.turnResolver.megacredits).to.eq(0);
  });
});
