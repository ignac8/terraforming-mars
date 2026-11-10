import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {getMarsBotCorp} from '@/server/automa/corps/MarsBotCorpRegistry';
import {PHARMACY_UNION_MARSBOT_CORP} from '@/server/automa/corps/promo/PharmacyUnionMarsBot';
import {ArchaeBacteria} from '@/server/cards/base/ArchaeBacteria';
import {Asteroid} from '@/server/cards/base/Asteroid';
import {SearchForLife} from '@/server/cards/base/SearchForLife';
import {createAutomaGame, fakeCard, resetCorpRegistry, setupWithAndWithoutEffect} from '../CorpGame';
import {recordingMarsBot} from '../RecordingMarsBot';

describe('PharmacyUnionMarsBot', () => {
  beforeEach(resetCorpRegistry);

  // C21: the Setup box (rulebook B p.1). A microbe card the player plays costs it 4 M€, a Prelude's too (rulebook B p.4)
  it('swaps Meteor Shower for a science card, raises its TR for science cards, and loses 4 M€ for the microbe cards the player plays', () => {
    const {marsBot, calls} = recordingMarsBot({megacredits: 6});
    const effect = PHARMACY_UNION_MARSBOT_CORP.effect!;

    PHARMACY_UNION_MARSBOT_CORP.setup!(marsBot);
    effect.onProjectCardResolved!(marsBot, new SearchForLife());
    effect.onProjectCardResolved!(marsBot, new Asteroid());
    expect(calls).deep.eq(['removeBonusCard(B01)', 'addProjectCardsToBonusDeck(science, 1)', 'raiseTR(1)']);

    for (const [card, megacredits] of [[new Asteroid(), 6], [new ArchaeBacteria(), 2], [new ArchaeBacteria(), 0]] as const) {
      effect.onHumanCardPlayed!(marsBot, card);
      expect(marsBot.megacredits).eq(megacredits);
    }
  });

  it('science card played → TR +1', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.PHARMACY_UNION)!;
    marsBot.setCorpAndSetup(corp);
    const trBefore = marsBot.player.terraformRating;
    corp.effect!.onProjectCardResolved!(marsBot, fakeCard('SciCard', {tags: [Tag.SCIENCE], cost: 10}));
    expect(marsBot.player.terraformRating).to.eq(trBefore + 1);
  });

  it('human microbe card → lose 4 M€', () => {
    const {marsBot} = createAutomaGame();
    const corp = getMarsBotCorp(CardName.PHARMACY_UNION)!;
    marsBot.setCorpAndSetup(corp);
    marsBot.turnResolver.megacredits = 10;
    corp.effect!.onHumanCardPlayed!(marsBot, fakeCard('MicrobeCard', {tags: [Tag.MICROBE], cost: 5}));
    expect(marsBot.turnResolver.megacredits).to.eq(6);
  });

  // Starting tags resolve as a revealed card (rulebook B, setup step 4)
  it('raises its TR for its Science starting tag', () => {
    const {withEffect, without} = setupWithAndWithoutEffect(CardName.PHARMACY_UNION);
    expect(withEffect.tr).to.eq(without.tr + 1);
  });
});
