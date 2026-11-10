import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {createAutomaGame, fakeCard, resetCorpRegistry, setupWithAndWithoutEffect} from '../CorpGame';

/** M€ Arklight's effect adds when MarsBot resolves `card`, against the same game without the effect. */
function arklightGain(card: IProjectCard): number {
  const corp = getMarsBotCorp(CardName.ARKLIGHT)!;
  const run = (c: typeof corp) => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(c);
    const mcBefore = marsBot.turnResolver.megacredits;
    marsBot.turnResolver.resolveProjectCard(card);
    return marsBot.turnResolver.megacredits - mcBefore;
  };
  return run(corp) - run({...corp, effect: undefined});
}

describe('ArklightMarsBot', () => {
  beforeEach(resetCorpRegistry);

  it('earns 2 M€ per plant or animal tag, not per card', () => {
    expect(arklightGain(fakeCard('PlantAnimal', {tags: [Tag.PLANT, Tag.ANIMAL]}))).to.eq(4);
  });

  it('earns nothing for a microbe tag', () => {
    expect(arklightGain(fakeCard('Microbe', {tags: [Tag.MICROBE]}))).to.eq(0);
  });

  // Starting tags resolve as a revealed card (rulebook B, setup step 4)
  it('earns 2 M€ for its Animal starting tag', () => {
    const {withEffect, without} = setupWithAndWithoutEffect(CardName.ARKLIGHT);
    expect(withEffect.mc).to.eq(without.mc + 2);
  });
});
