import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {PharmacyUnionMarsBot} from '@/server/automa/corps/promo/PharmacyUnionMarsBot';
import {ArchaeBacteria} from '@/server/cards/base/ArchaeBacteria';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {SearchForLife} from '@/server/cards/base/SearchForLife';
import {createAutomaGame, fakeCard, resetCorpRegistry, setupWithAndWithoutEffect} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('PharmacyUnionMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // The Setup box (rulebook B p.1). A microbe card the player plays costs it 4 M€, Preludes included (rulebook B p.4)
  it('swaps Meteor Shower for a science card, raises its TR for science cards, and loses 4 M€ for the microbe cards the player plays', () => {
    const {marsBot, calls} = recordingMarsBot({megacredits: 6});
    const corp = new PharmacyUnionMarsBot();

    new PharmacyUnionMarsBot().setup(marsBot);
    corp.onProjectCardResolved(marsBot, new SearchForLife());
    corp.onProjectCardResolved(marsBot, new Asteroid());
    expect(calls).deep.eq(['removeBonusCard(Meteor Shower)', 'addProjectCardsToBonusDeck(science, 1)', 'raiseTR(1)']);

    for (const [card, megacredits] of [[new Asteroid(), 6], [new ArchaeBacteria(), 2], [new ArchaeBacteria(), 0]] as const) {
      corp.onHumanCardPlayed(marsBot, card);
      expect(marsBot.megacredits).eq(megacredits);
    }
  });

  it('science card played → TR +1', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.PHARMACY_UNION)!;
    marsBot.setCorpAndSetup(corp);
    const trBefore = marsBot.player.terraformRating;
    corp.onProjectCardResolved!(marsBot, fakeCard('SciCard', {tags: [Tag.SCIENCE], cost: 10}));
    expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
  });

  it('human microbe card → lose 4 M€', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.PHARMACY_UNION)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.megacredits = 10;
    corp.onHumanCardPlayed!(marsBot, fakeCard('MicrobeCard', {tags: [Tag.MICROBE], cost: 5}));
    expect(marsBot.megacredits).to.eq(6);
  });

  // Starting tags resolve as a revealed card (rulebook B, setup step 4)
  it('raises its TR for its Science starting tag', () => {
    const {withEffect, without} = setupWithAndWithoutEffect(CardName.PHARMACY_UNION);
    expect(withEffect.tr).to.eq(without.tr + 1);
  });
});
