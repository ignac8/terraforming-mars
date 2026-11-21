import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {MarsBotCorp} from '@/server/automa/MarsBotCorp';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {ArklightMarsBot} from '@/server/automa/corps/colonies/ArklightMarsBot';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {createAutomaGame, fakeCard, resetCorpRegistry, setupWithAndWithoutEffect, withoutEffect} from '../CorpGame';
import {recordingMarsBot, trackCubes} from '../RecordingMarsBot';

/** M€ Arklight's effect adds when MarsBot resolves `card`, against the same game without the effect. */
function arklightGain(card: IProjectCard): number {
  const corp = getMarsBotCorp(CardName.ARKLIGHT)!;
  const run = (c: MarsBotCorp) => {
    const {marsBot} = createAutomaGame();
    marsBot.setCorpAndSetup(c);
    const mcBefore = marsBot.megacredits;
    marsBot.resolveProjectCard(card);
    return marsBot.megacredits - mcBefore;
  };
  return run(corp) - run(withoutEffect(corp));
}

describe('ArklightMarsBot', () => {
  beforeEach(resetCorpRegistry);

  for (const run of [
    {tag: Tag.PLANT, expected: ['gainMc(2)']},
    {tag: Tag.ANIMAL, expected: ['gainMc(2)']},
    {tag: Tag.MICROBE, expected: []},
  ] as const) {
    it('gains 2 M€ for each Plant or Animal tag: ' + JSON.stringify(run), () => {
      const {marsBot, calls} = recordingMarsBot();

      new ArklightMarsBot().onTagResolved(marsBot, run.tag);

      expect(calls).deep.eq(run.expected);
    });
  }

  it('has a white cube on every space of the plant track', () => {
    expect(trackCubes(new ArklightMarsBot())).deep.eq(Array.from({length: 18}, (_, i) => `plant white ${i + 1}`));
  });

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
